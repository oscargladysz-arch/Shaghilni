/* Route policy, part 5 (plans and money): what each plan unlocks, who on a team may buy or read billing, when a placement
   fee is charged, what the admin billing routes do when repeated, that the card return and test pages change nothing, and
   that a job seeker never touches a plan, payment or sponsor route nor sees a plan or charge field. Every refusal has a
   positive control beside it. Lines marked "record" assert today's behaviour where a policy note or DEFECTS.md id says it
   should change, so the fix has to touch this file. The feature suites (plans, payments, team) keep the happy paths. */
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { start, cast, closeAll, employerWithLiveJob, JOB, PROFILE } from "./policy/harness.js";

after(closeAll);

const MID = Math.round((JOB.pay[0] + JOB.pay[1]) / 2);   // server/plans.js:45 payMid: the middle of the published pay range
const MONEY = /plan|charge|fee|payment|billing|invoice|amountSyp|amountUsd|sponsoredUntil/i;
const plain = r => (r ? { ...r } : r);   // node:sqlite rows have no prototype, which strict deepEqual minds
const keysOf = (v, out = new Set()) => { if (Array.isArray(v)) v.forEach(x => keysOf(x, out)); else if (v && typeof v === "object") for (const k of Object.keys(v)) { out.add(k); keysOf(v[k], out); } return out; };
const hire = async (e, appId) => { for (const st of ["shortlisted", "interview", "hired"]) { const r = await e.put(`/api/employer/applications/${appId}`, { status: st }); assert.equal(r.status, 200, `move ${st}: ${r.text}`); } };
const seekerOpen = async (S, phone, name) => { const s = await S.login(phone); assert.equal((await s.put("/api/me/profile", { profile: { ...PROFILE, name } })).status, 200); assert.equal((await s.put("/api/me/recruit", { open: true })).status, 200); return { s, id: (await s.get("/api/me")).body.user.id }; };
const go = (S, path, opts = {}) => fetch(S.base + path, { redirect: "manual", ...opts });
const callback = (S, raw, sig) => go(S, "/pay/callback/test", { method: "POST", headers: { "x-test-signature": sig, "content-type": "application/json" }, body: raw });

test("policy plans: Free is refused sponsoring and reports with the real codes, Pro adds the full analytics fields, Enterprise adds reports", async () => {
  const S = await start(), C = await cast(S), free = C.B.e, pro = C.A.e;   // the cast puts A on Pro (harness.js:78); B stays Free
  assert.equal((await free.get("/api/employer/plan")).body.plan, "free"); assert.equal((await pro.get("/api/employer/plan")).body.plan, "pro");
  // sponsoring: Free → 403 plan_required (employer.js:188); the same call on Pro succeeds
  const sp = await free.post(`/api/employer/jobs/${C.ids.jobB}/sponsor`, { on: true }); assert.equal(sp.status, 403, sp.text); assert.equal(sp.body.error, "plan_required");
  assert.equal(S.db.get("SELECT sponsored_until FROM jobs WHERE id = ?", C.ids.jobB).sponsored_until, null, "the refusal sponsored nothing");
  const ok = await pro.post(`/api/employer/jobs/${C.ids.jobA}/sponsor`, { on: true }); assert.equal(ok.status, 200, ok.text); assert.ok(ok.body.sponsoredUntil > Date.now());
  // reports: an Enterprise feature (plans.js:8-10), refused to the owner on Free and on Pro with plan_required, never with a role code
  for (const [who, c] of [["Free owner", free], ["Pro owner", pro]]) for (const kind of ["placements", "compliance"]) {
    const r = await c.get(`/api/employer/reports/${kind}`); assert.equal(r.status, 403, `${who} ${kind}: ${r.text}`); assert.equal(r.body.error, "plan_required", `${who} ${kind}`);
  }
  // analytics: everyone verified gets the counts; the three "full" fields (employer.js:200-202) are null on Free and numbers on Pro
  await hire(pro, C.ids.appA);   // one hire so medianDaysToHire has a value
  const basic = (await free.get("/api/employer/analytics")).body, full = (await pro.get("/api/employer/analytics")).body;
  assert.equal(basic.full, false); assert.equal(typeof basic.total.applications, "number");
  assert.deepEqual([basic.total.whatsapp, basic.total.fromSearch, basic.total.medianDaysToHire], [null, null, null], "Free never sees the paid fields");
  assert.equal(full.full, true);
  for (const k of ["whatsapp", "fromSearch", "medianDaysToHire"]) { assert.equal(typeof full.total[k], "number", `Pro total.${k}`); assert.equal(typeof full.jobs.find(j => j.id === C.ids.jobA)[k], "number", `Pro per-job ${k}`); }
  assert.equal(full.total.hired, 1);
  // positive control for reports: once B is on Enterprise the owner reads both reports, and the placements rows carry no person
  assert.equal((await C.admin.post(`/api/admin/companies/${C.ids.companyB}/plan`, { plan: "enterprise", months: 1 })).status, 200);
  const pl = await free.get("/api/employer/reports/placements"); assert.equal(pl.status, 200, pl.text); assert.ok(Array.isArray(pl.body.rows));
  const cm = await free.get("/api/employer/reports/compliance"); assert.equal(cm.status, 200, cm.text); assert.ok(cm.body.rows.some(x => x.action === "company.verified"));
  assert.equal((await free.get("/api/employer/reports/bogus")).status, 404, "an unknown report kind is 404 even on Enterprise");
});

test("policy plans: buying is the owner's alone (403 role_forbidden for admin, recruiter, hiring manager); a payment record is readable at view level (record)", async () => {
  const S = await start(), C = await cast(S), owner = C.A.e, members = [["company admin", C.cadmin], ["recruiter", C.recruiter], ["hiring manager", C.hiring]];
  for (const [who, c] of members) {
    const rq = await c.post("/api/employer/plan/request", { plan: "enterprise", payMethod: "wallet" }); assert.equal(rq.status, 403, `${who} request: ${rq.text}`); assert.deepEqual([rq.body.error, rq.body.detail], ["role_forbidden", { need: "billing" }]);
    const co = await c.post("/api/employer/plan/checkout", { plan: "pro", months: 1 }); assert.equal(co.status, 403, `${who} checkout: ${co.text}`); assert.deepEqual([co.body.error, co.body.detail], ["role_forbidden", { need: "billing" }]);
  }
  assert.equal(S.db.get("SELECT COUNT(*) AS n FROM plan_requests WHERE company_id = ?", C.ids.companyA).n, 0, "no request was filed by a teammate");
  assert.equal(S.db.get("SELECT COUNT(*) AS n FROM payments WHERE company_id = ?", C.ids.companyA).n, 1, "only the cast's own checkout exists");
  // positive control: the owner files a request and starts a checkout with the same bodies
  const rq = await owner.post("/api/employer/plan/request", { plan: "enterprise", payMethod: "wallet" }); assert.equal(rq.status, 200, rq.text); assert.match(rq.body.ref, /^SHG-\d+-\d+$/);
  const co = await owner.post("/api/employer/plan/checkout", { plan: "pro", months: 1 }); assert.equal(co.status, 200, co.text); assert.match(co.body.redirectUrl, /^\/pay\/test\/[0-9a-f]{32}$/);
  // every team role reads the plan page, but only the owner is told so (employer.js:171 isOwner)
  for (const [who, c] of members) { const p = await c.get("/api/employer/plan"); assert.equal(p.status, 200, `${who} plan: ${p.text}`); assert.equal(p.body.isOwner, false, who); }
  assert.equal((await owner.get("/api/employer/plan")).body.isOwner, true);
  // record: GET /api/employer/payments/:id is scoped to the company but has no team-level check (employer.js:226; route-policy.js row
  // "no team-level check today (flag: billing data readable at view level)"): a hiring manager reads the owner's payment record today.
  const viewed = await C.hiring.get(`/api/employer/payments/${C.ids.payA}`); assert.equal(viewed.status, 200, viewed.text);
  assert.deepEqual([viewed.body.id, viewed.body.plan, viewed.body.months, viewed.body.status], [C.ids.payA, "pro", 1, "created"]);
  assert.equal((await C.B.e.get(`/api/employer/payments/${C.ids.payA}`)).status, 404, "another company's owner still gets nothing");
});

test("policy plans: the placement fee is charged once, on Free only, only for a hire the company invited before they applied (and who accepted), at the middle of the pay range", async () => {
  const S = await start(), admin = await S.login("+12025550199");
  const F = await employerWithLiveJob(S, admin, "0955 920 001", "Fee Free Co"), P = await employerWithLiveJob(S, admin, "0955 920 002", "Fee Pro Co");
  assert.equal((await admin.post(`/api/admin/companies/${P.companyId}/plan`, { plan: "pro", months: 1 })).status, 200);
  const sourced = await seekerOpen(S, "0944 920 001", "Sourced Hire"), direct = await seekerOpen(S, "0944 920 002", "Direct Hire"), sentOnly = await seekerOpen(S, "0944 920 003", "Invited Not Accepted");
  const late = await seekerOpen(S, "0944 920 004", "Accepted After Applying"), proHire = await seekerOpen(S, "0944 920 005", "Pro Sourced Hire");
  const invite = async (e, sid, body) => { const r = await e.post(`/api/employer/students/${sid}/invite`, body); assert.equal(r.status, 200, r.text); return r.body.invitation.id; };
  const accept = async (who, invId) => { const r = await who.s.post(`/api/me/invitations/${invId}/respond`, { answer: "yes" }); assert.equal(r.status, 200, r.text); };
  const apply = async (who, jobId) => { const r = await who.s.post(`/api/jobs/${jobId}/apply`, { channel: "web", cvLang: "ar" }); assert.equal(r.status, 200, r.text); return r.body.application.id; };
  await accept(sourced, await invite(F.e, sourced.id, { kind: "job", jobId: F.jobId }));              // invited by the Free company, accepted, then applies
  await invite(F.e, sentOnly.id, { kind: "job", jobId: F.jobId });                                     // invited, never answered
  await accept(proHire, await invite(P.e, proHire.id, { kind: "job", jobId: P.jobId }));              // the same path at the Pro company
  const apps = { sourced: await apply(sourced, F.jobId), direct: await apply(direct, F.jobId), sentOnly: await apply(sentOnly, F.jobId), late: await apply(late, F.jobId), proHire: await apply(proHire, P.jobId) };
  const date = new Date(Date.now() + 20 * 86400e3).toISOString().slice(0, 10);   // an event invitation can still be sent after an application; a job one is refused (recruit.js:103)
  await accept(late, await invite(F.e, late.id, { kind: "event", event: { title: "Open day", date, place: "Our office" } }));
  for (const [k, id] of Object.entries(apps)) await hire(k === "proHire" ? P.e : F.e, id);
  const confirm = async id => { const r = await admin.post(`/api/admin/applications/${id}/confirm-hire`, {}); assert.equal(r.status, 200, r.text); return r.body.charges; };
  assert.deepEqual(await confirm(apps.sourced), [{ kind: "hire_fee", amountSyp: MID }], "Free + accepted invitation before applying = one fee at the middle of the range");
  assert.deepEqual(await confirm(apps.sourced), [], "confirming the same hire again charges nothing");
  assert.deepEqual(await confirm(apps.direct), [], "someone who applied on their own is free to hire");
  assert.deepEqual(await confirm(apps.sentOnly), [], "an invitation that was never accepted is not sourcing");
  assert.deepEqual(await confirm(apps.late), [], "an invitation sent after the application is not sourcing (admin.js:115 compares the invitation's created_at)");
  assert.deepEqual(await confirm(apps.proHire), [], "Pro pays no placement fee (plans.js:9 sourcedFee: false)");
  const fees = S.db.all("SELECT company_id, application_id, amount_syp, status FROM charges WHERE kind = 'hire_fee'").map(plain);
  assert.deepEqual(fees, [{ company_id: F.companyId, application_id: apps.sourced, amount_syp: MID, status: "due" }], "exactly one hire_fee row in the whole database");
  assert.equal(S.db.get("SELECT COUNT(*) AS n FROM applications WHERE hire_confirmed_at IS NOT NULL").n, 5, "every hire is confirmed exactly once");
  assert.deepEqual((await F.e.get("/api/employer/plan")).body.feesDue, { n: 1, syp: MID }); assert.deepEqual((await P.e.get("/api/employer/plan")).body.feesDue, { n: 0, syp: 0 });
});

test("policy plans: the placement fee follows the plan at the hire, not at the confirmation: a Pro hire stays free after the plan ends, a Free hire keeps its fee after an upgrade (U-029)", async () => {
  const S = await start(), admin = await S.login("+12025550199");
  const F = await employerWithLiveJob(S, admin, "0955 921 001", "Free Then Pro Co"), P = await employerWithLiveJob(S, admin, "0955 921 002", "Pro Then Free Co");
  assert.equal((await admin.post(`/api/admin/companies/${P.companyId}/plan`, { plan: "pro", months: 1 })).status, 200);
  const a = await seekerOpen(S, "0944 921 001", "Hired Under Free"), b = await seekerOpen(S, "0944 921 002", "Hired Under Pro");
  const sourcedHire = async (e, jobId, who) => { const inv = await e.post(`/api/employer/students/${who.id}/invite`, { kind: "job", jobId }); assert.equal(inv.status, 200, inv.text);
    assert.equal((await who.s.post(`/api/me/invitations/${inv.body.invitation.id}/respond`, { answer: "yes" })).status, 200);
    const ap = await who.s.post(`/api/jobs/${jobId}/apply`, { channel: "web", cvLang: "ar" }); assert.equal(ap.status, 200, ap.text); await hire(e, ap.body.application.id); return ap.body.application.id; };
  const onFree = await sourcedHire(F.e, F.jobId, a), onPro = await sourcedHire(P.e, P.jobId, b);
  // between the hire and the admin's confirmation the plans swap: F moves up to Pro, P's Pro ends; a note on each hire comes after
  assert.equal((await admin.post(`/api/admin/companies/${F.companyId}/plan`, { plan: "pro", months: 1 })).status, 200);
  assert.equal((await admin.post(`/api/admin/companies/${P.companyId}/plan`, { plan: "free" })).status, 200);
  assert.equal((await F.e.put(`/api/employer/applications/${onFree}`, { note: "Starts on Sunday." })).status, 200);
  assert.equal((await P.e.put(`/api/employer/applications/${onPro}`, { note: "Starts on Sunday." })).status, 200);
  const confirm = async id => { const r = await admin.post(`/api/admin/applications/${id}/confirm-hire`, {}); assert.equal(r.status, 200, r.text); return r.body.charges; };
  assert.deepEqual(await confirm(onFree), [{ kind: "hire_fee", amountSyp: MID }], "hired on Free: the fee stands although the company is on Pro when the hire is confirmed");
  assert.deepEqual(await confirm(onPro), [], "hired on Pro: no fee although the plan ended before the confirmation (Pro promises no placement fees)");
});

test("policy plans: undoing a hire keeps its fee basis: cutting the pay to 1 or moving up to Pro and hiring again still owes the first fee; a note on a hire older than migration 17 fixes no plan (Stage 4 fix review)", async () => {
  const S = await start(), admin = await S.login("+12025550199");
  const F = await employerWithLiveJob(S, admin, "0955 922 001", "Undo Then Rehire Co"), G = await employerWithLiveJob(S, admin, "0955 922 002", "Pre Seventeen Co");
  const a = await seekerOpen(S, "0944 922 001", "Hired Twice"), b = await seekerOpen(S, "0944 922 002", "Hired Before Seventeen");
  const sourcedHire = async (e, jobId, who) => { const inv = await e.post(`/api/employer/students/${who.id}/invite`, { kind: "job", jobId }); assert.equal(inv.status, 200, inv.text);
    assert.equal((await who.s.post(`/api/me/invitations/${inv.body.invitation.id}/respond`, { answer: "yes" })).status, 200);
    const ap = await who.s.post(`/api/jobs/${jobId}/apply`, { channel: "web", cvLang: "ar" }); assert.equal(ap.status, 200, ap.text); await hire(e, ap.body.application.id); return ap.body.application.id; };
  const basis = id => plain(S.db.get("SELECT hire_pay_mid, hire_plan FROM applications WHERE id = ?", id));
  const confirm = async id => { const r = await admin.post(`/api/admin/applications/${id}/confirm-hire`, {}); assert.equal(r.status, 200, r.text); return r.body.charges; };
  // F hires on Free, undoes it, cuts the listing's pay to 1, moves up to Pro, and hires again
  const onFree = await sourcedHire(F.e, F.jobId, a); assert.deepEqual(basis(onFree), { hire_pay_mid: MID, hire_plan: "free" });
  const texts = S.texts.length;
  assert.equal((await F.e.put(`/api/employer/applications/${onFree}`, { status: "interview" })).status, 200, "undo");
  assert.equal((await F.e.put(`/api/employer/jobs/${F.jobId}`, { job: { ...JOB, pay: [1, 1] } })).status, 200, "pay cut to 1");
  assert.equal((await admin.post(`/api/admin/companies/${F.companyId}/plan`, { plan: "pro", months: 1 })).status, 200, "moved up to Pro");
  assert.equal((await F.e.put(`/api/employer/applications/${onFree}`, { status: "hired" })).status, 200, "hired again");
  assert.deepEqual(basis(onFree), { hire_pay_mid: MID, hire_plan: "free" }, "the basis of the first hire stands");
  assert.equal(S.texts.length, texts + 1, "the undo texted nobody; hiring again texts the congratulations again (a person who withdrew and re-applied after the undo must get it)");
  assert.deepEqual(await confirm(onFree), [{ kind: "hire_fee", amountSyp: MID }], "the fee is the first hire's, not 1 SYP and not waived by Pro");
  // G's hire predates migration 17 (no plan recorded): a note saved while G is on Pro must not fix Pro as the plan of the hire
  const old = await sourcedHire(G.e, G.jobId, b); S.db.run("UPDATE applications SET hire_plan = NULL WHERE id = ?", old);
  assert.equal((await admin.post(`/api/admin/companies/${G.companyId}/plan`, { plan: "pro", months: 1 })).status, 200);
  assert.equal((await G.e.put(`/api/employer/applications/${old}`, { note: "Starts on Sunday." })).status, 200);
  assert.equal(basis(old).hire_plan, null, "a note writes no plan: only the move into hired records one");
  assert.equal((await admin.post(`/api/admin/companies/${G.companyId}/plan`, { plan: "free" })).status, 200);
  assert.deepEqual(await confirm(old), [{ kind: "hire_fee", amountSyp: MID }], "with no plan recorded, the live plan (Free) decides, as documented");
});

test("policy plans: the admin plan route reads months and amount typed with Arabic-Indic or Persian digits (U-028)", async () => {
  const S = await start(), admin = await S.login("+12025550199"), { companyId } = await employerWithLiveJob(S, admin, "0955 920 031", "Digits Co");
  for (const [months, amountSyp, label] of [["٣", "٤٠٠٠", "Arabic-Indic"], ["۳", "۴۰۰۰", "Persian"]]) {
    S.db.run("DELETE FROM charges WHERE company_id = ?", companyId);
    const r = await admin.post(`/api/admin/companies/${companyId}/plan`, { plan: "pro", months, amountSyp }); assert.equal(r.status, 200, r.text);
    assert.ok(r.body.planUntil && Math.abs(r.body.planUntil - (Date.now() + 90 * 86400e3)) < 60e3, `${label}: three months, not a plan with no end date (${r.body.planUntil})`);
    assert.deepEqual(S.db.all("SELECT kind, amount_syp, status, note FROM charges WHERE company_id = ?", companyId).map(plain), [{ kind: "plan", amount_syp: 4000, status: "due", note: "pro plan, 3 months" }], `${label}: the invoice is recorded`);
  }
  const a = S.db.all("SELECT data FROM audit WHERE action = 'company.plan' AND entity_id = ? ORDER BY id", companyId).map(x => JSON.parse(x.data));
  assert.deepEqual(a.map(x => [x.months, x.amountSyp]), [[3, 4000], [3, 4000]], "and the audit row says what was set");
});

test("policy plans: the admin plan route reads grouped amounts ('4,000', '٤٬٠٠٠') and refuses a value that is not a number instead of recording no invoice or no end date (fix review)", async () => {
  const S = await start(), admin = await S.login("+12025550199"), { companyId } = await employerWithLiveJob(S, admin, "0955 920 032", "Grouped Digits Co");
  for (const [months, amountSyp, amt] of [["3", "4,000", 4000], ["٣", "٤٬٠٠٠", 4000], [3, "1,250,000", 1250000], ["", "", 0]]) {
    S.db.run("DELETE FROM charges WHERE company_id = ?", companyId);
    const r = await admin.post(`/api/admin/companies/${companyId}/plan`, { plan: "pro", months, amountSyp }); assert.equal(r.status, 200, r.text);
    assert.deepEqual(S.db.all("SELECT amount_syp FROM charges WHERE company_id = ?", companyId).map(x => x.amount_syp), amt ? [amt] : [], `${JSON.stringify(amountSyp)}: the invoice`);
    assert.equal(!!r.body.planUntil, months !== "", `${JSON.stringify(months)}: an end date when months are given`);
  }
  const before = plain(S.db.get("SELECT plan, plan_until FROM companies WHERE id = ?", companyId));
  for (const [months, amountSyp] of [["٣ أشهر", "4000"], ["3", "4000 SYP"], ["three", ""], ["-1", ""]]) {
    const r = await admin.post(`/api/admin/companies/${companyId}/plan`, { plan: "enterprise", months, amountSyp });
    assert.deepEqual([r.status, r.body.error], [422, "bad_number"], `${JSON.stringify([months, amountSyp])} is refused, not read as 0`);
  }
  assert.deepEqual(plain(S.db.get("SELECT plan, plan_until FROM companies WHERE id = ?", companyId)), before, "a refused form changes nothing");
});

test("policy plans: admin billing routes: paid and void repeat without harm (record: no state check), plan with months 0 has no end date (record), a bad plan is 422", async () => {
  const S = await start(), admin = await S.login("+12025550199"), { e, companyId } = await employerWithLiveJob(S, admin, "0955 920 011", "Billing Co");
  const chargeRow = id => plain(S.db.get("SELECT status, paid_at FROM charges WHERE id = ?", id)), audits = () => S.db.get("SELECT COUNT(*) AS n FROM audit WHERE entity = 'charge'").n;
  // a plan set by hand with an amount records a due charge; months 1 ends in 30 days
  const set = await admin.post(`/api/admin/companies/${companyId}/plan`, { plan: "pro", months: 1, amountSyp: 4000 }); assert.equal(set.status, 200, set.text);
  assert.ok(Math.abs(set.body.planUntil - (Date.now() + 30 * 86400e3)) < 60e3, "one month of Pro");
  const ch = S.db.get("SELECT id, status, amount_syp FROM charges WHERE company_id = ? AND kind = 'plan'", companyId); assert.deepEqual([ch.status, ch.amount_syp], ["due", 4000]);
  assert.equal((await e.get("/api/employer/plan")).body.feesDue.n, 1);
  // paid twice: still exactly one paid charge, each privileged call audited (R12)
  const a0 = audits();
  for (let i = 0; i < 2; i++) assert.equal((await admin.post(`/api/admin/charges/${ch.id}/paid`)).status, 200);
  assert.equal(chargeRow(ch.id).status, "paid"); assert.ok(chargeRow(ch.id).paid_at > 0); assert.equal(audits(), a0 + 2);
  assert.equal(S.db.get("SELECT COUNT(*) AS n FROM charges WHERE company_id = ?", companyId).n, 1, "no duplicate charge rows");
  assert.equal((await e.get("/api/employer/plan")).body.feesDue.n, 0);
  // void twice: the same; record: void after paid is accepted and clears paid_at (ROUTES.md "No state check (paid→void→paid)")
  for (let i = 0; i < 2; i++) assert.equal((await admin.post(`/api/admin/charges/${ch.id}/void`)).status, 200);
  assert.deepEqual(chargeRow(ch.id), { status: "void", paid_at: null }); assert.equal(audits(), a0 + 4);
  assert.equal((await admin.post(`/api/admin/charges/${ch.id}/refund`)).status, 404, "only paid and void exist (admin.js:161)");
  assert.equal((await admin.post(`/api/admin/charges/999999/paid`)).status, 404, "an unknown charge is 404");
  // record: months 0 keeps the plan with no end date (admin.js:151; ROUTES.md "months 0 → no expiry")
  const forever = await admin.post(`/api/admin/companies/${companyId}/plan`, { plan: "enterprise", months: 0 }); assert.equal(forever.status, 200, forever.text);
  assert.deepEqual([forever.body.plan, forever.body.planUntil], ["enterprise", null]);
  assert.deepEqual(plain(S.db.get("SELECT plan, plan_until FROM companies WHERE id = ?", companyId)), { plan: "enterprise", plan_until: null });
  const P = (await e.get("/api/employer/plan")).body; assert.deepEqual([P.plan, P.planUntil], ["enterprise", null], "the employer is on Enterprise with no end date");
  assert.equal(S.db.get("SELECT COUNT(*) AS n FROM charges WHERE company_id = ?", companyId).n, 1, "no amount, no charge");
  // a bad plan is 422 bad_plan and changes nothing; an unknown company is 404
  for (const plan of ["gold", "", null, "PRO"]) { const r = await admin.post(`/api/admin/companies/${companyId}/plan`, { plan, months: 1 }); assert.equal(r.status, 422, `${plan}: ${r.text}`); assert.equal(r.body.error, "bad_plan"); }
  assert.deepEqual(plain(S.db.get("SELECT plan, plan_until FROM companies WHERE id = ?", companyId)), { plan: "enterprise", plan_until: null });
  assert.equal((await admin.post("/api/admin/companies/999999/plan", { plan: "pro", months: 1 })).status, 404);
  assert.equal((await admin.post(`/api/admin/companies/${companyId}/plan`, { plan: "free" })).body.planUntil, null, "back to Free");
  assert.equal((await e.get("/api/employer/plan")).body.plan, "free");
});

test("policy payments: the return page and the test page change nothing; the callback refuses a wrong currency, an unknown session, a non-JSON body and the wrong provider", async () => {
  const S = await start(), admin = await S.login("+12025550199"), { e, companyId } = await employerWithLiveJob(S, admin, "0955 920 021", "Card Co");
  const co = await e.post("/api/employer/plan/checkout", { plan: "pro", months: 1 }); assert.equal(co.status, 200, co.text);
  const id = co.body.payment, ref = co.body.redirectUrl.split("/").pop(), sign = S.app.payments.provider.sign;
  const snapshot = () => ({ pay: plain(S.db.get("SELECT status, paid_at FROM payments WHERE id = ?", id)), co: plain(S.db.get("SELECT plan, plan_until FROM companies WHERE id = ?", companyId)), charges: S.db.get("SELECT COUNT(*) AS n FROM charges").n });
  const before = snapshot(); assert.deepEqual(before.pay, { status: "created", paid_at: null });
  // /pay/return only redirects (payments.js:100-102), whatever id it is given, even one that is not a payment
  for (const p of [id, 999999, "abc", ""]) { const r = await go(S, `/pay/return?p=${p}`); assert.equal(r.status, 303); assert.equal(r.headers.get("location"), `/#/company/plan/paid/${Number(p) || 0}`); }
  assert.equal((await go(S, "/pay/return", { method: "POST" })).status, 303, "a POST to the return page is the same redirect");
  // GET /pay/test/:session only shows the page (payments.js:111-120); unknown sessions and wrong shapes are 404
  const pg = await go(S, `/pay/test/${ref}`); assert.equal(pg.status, 200); assert.match(await pg.text(), /4,000 SYP/); assert.equal(pg.headers.get("cache-control"), "no-store");
  assert.equal((await go(S, `/pay/test/${"0".repeat(32)}`)).status, 404); assert.equal((await go(S, "/pay/test/short")).status, 404);
  assert.deepEqual(snapshot(), before, "looking at the pages changed nothing");
  assert.equal((await e.get(`/api/employer/payments/${id}`)).body.status, "created"); assert.equal((await e.get("/api/employer/plan")).body.plan, "free");
  // the callback: wrong provider name, GET, unknown session, non-JSON with a valid signature, wrong currency
  const good = { session: ref, status: "paid", amount: 4000, currency: "SYP" };
  assert.equal((await go(S, "/pay/callback/qnb", { method: "POST", body: JSON.stringify(good) })).status, 404, "no such provider is configured");
  assert.equal((await go(S, "/pay/callback/test")).status, 404, "the callback is POST only");
  const unknown = JSON.stringify({ ...good, session: "f".repeat(32) }); assert.equal((await callback(S, unknown, sign(unknown))).status, 404, "a signed result for a session we never created");
  assert.equal((await callback(S, "{not json", sign("{not json"))).status, 400, "a signed body that is not JSON");
  assert.deepEqual(snapshot(), before, "none of those touched the payment");
  const usd = JSON.stringify({ ...good, currency: "USD" }); assert.equal((await callback(S, usd, sign(usd))).status, 400, "the right amount in the wrong currency is refused");
  assert.equal(snapshot().pay.status, "failed", "and the payment is marked failed (payments.js:88)"); assert.deepEqual(snapshot().co, before.co); assert.equal(snapshot().charges, before.charges);
  const again = JSON.stringify(good); assert.equal((await callback(S, again, sign(again))).status, 200, "a later correct result is accepted by the callback");
  assert.equal(snapshot().pay.status, "paid"); assert.equal((await e.get("/api/employer/plan")).body.plan, "pro", "positive control: the signed, matching result switches the plan on");
  assert.equal(snapshot().charges, before.charges + 1, "one paid receipt");
});

test("policy plans: a job seeker is refused every plan, payment, sponsor and billing route, and no seeker-facing response carries a plan or charge field", async () => {
  const S = await start(), C = await cast(S), s = C.seekerA, I = C.ids;
  assert.equal((await C.A.e.post(`/api/employer/jobs/${I.jobA}/sponsor`, { on: true })).status, 200, "A's listing is sponsored, so the public copy is the hardest case");
  const routes = [["GET", "/api/employer/plan"], ["POST", "/api/employer/plan/request", { plan: "pro", payMethod: "wallet" }], ["POST", "/api/employer/plan/checkout", { plan: "pro", months: 1 }],
    ["GET", `/api/employer/payments/${I.payA}`], ["POST", `/api/employer/jobs/${I.jobA}/sponsor`, { on: true }], ["GET", "/api/employer/analytics"], ["GET", "/api/employer/reports/placements"],
    ["GET", "/api/admin/billing"], ["POST", `/api/admin/companies/${I.companyA}/plan`, { plan: "free" }], ["POST", "/api/admin/charges/1/paid"], ["POST", "/api/admin/programmes", { name: "X", rateUsd: 1 }]];
  const rows = () => ({ pay: plain(S.db.get("SELECT status FROM payments WHERE id = ?", I.payA)), co: plain(S.db.get("SELECT plan FROM companies WHERE id = ?", I.companyA)), charges: S.db.get("SELECT COUNT(*) AS n FROM charges").n, progs: S.db.get("SELECT COUNT(*) AS n FROM programmes").n }), beforeRows = rows();
  for (const [method, path, body] of routes) { const r = await s.call(method, path, body); assert.equal(r.status, 403, `seeker ${method} ${path}: ${r.text}`); assert.equal(r.body.error, "forbidden", `${method} ${path}`); }
  assert.deepEqual(rows(), beforeRows, "nothing moved");
  assert.equal((await C.A.e.get("/api/employer/plan")).status, 200, "positive control: the owner reads the same plan page");
  // what a seeker does see: their account and the public listing, with nothing about plans or money
  const me = await s.get("/api/me"); assert.equal(me.status, 200); assert.equal(me.body.user.id, I.userA);
  assert.deepEqual([...keysOf(me.body)].filter(k => MONEY.test(k)), [], "/api/me");
  const job = await s.get(`/api/jobs/${I.jobA}`); assert.equal(job.status, 200); assert.equal(job.body.job.sponsored, true, "the sponsored label itself is public by design (R7: pay shown, sponsored listings labelled)");
  assert.deepEqual([...keysOf(job.body)].filter(k => MONEY.test(k)), ["sponsoredUntil"], "today: the public listing carries the sponsorship's end date (serialize.js:19), a plan detail the seeker has no use for");
  const feed = (await S.client().get("/api/jobs")).body; assert.ok(feed.jobs.some(j => j.id === I.jobA));
  assert.deepEqual([...keysOf(feed)].filter(k => MONEY.test(k)), ["sponsoredUntil"], "today: same on the board feed");
  assert.ok(feed.jobs.filter(j => !j.demo).every(j => j.pay && j.pay[0] > 0), "positive control: pay is on every public listing that went through the posting checks (R7; the seeded sample with pay null is D-02)");
});
