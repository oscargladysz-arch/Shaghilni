/* Route policy, part 5 (the Shaghilni team): what the admin routes do once the role check has passed. State checks on
   company verification and listing review, confirm-hire's idempotence, the audit log's limit and contents, what the
   insights, traffic and system reports may carry, and the admin's own account. Every refusal is paired with the
   allowed path succeeding on the same resource, so a 404 or 409 is never vacuous. Behaviours that are wider than the
   product rules are asserted as they are today and marked with the DEFECTS.md id, so the fix has to touch this file. */
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { ROOT } from "../server/config.js";
import { start, cast, closeAll, employerWithLiveJob, ADMIN_PHONE, PROFILE, JOB } from "./policy/harness.js";

after(closeAll);

const PHONE_UA = "Mozilla/5.0 (Linux; Android 12; SM-A125F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36";
const audits = (S, entity, id) => S.db.all("SELECT action, data FROM audit WHERE entity = ? AND entity_id = ? ORDER BY id", entity, id).map(x => ({ action: x.action, data: x.data ? JSON.parse(x.data) : null }));

test("policy admin: company review needs screening to verify and a note to reject or suspend; a draft and a suspended company are verified by id today (U-046)", async () => {
  const S = await start(), admin = await S.login(ADMIN_PHONE), A = await employerWithLiveJob(S, admin, "0955 910 001", "Review Alpha");
  const draft = await S.login("0955 910 002", "employer");
  const put = await draft.put("/api/employer/company", { company: { name: { en: "Review Draft" }, gov: "aleppo", regNo: "REG-Review-Draft", contactName: "Contact Draft", whatsapp: "0955 910 002" } });
  assert.equal(put.status, 200, put.text); const dId = put.body.company.id; assert.equal(put.body.company.status, "draft", "never submitted");
  assert.ok((await admin.get("/api/admin/companies?status=draft")).body.companies.some(c => c.id === dId), "the draft is real and the admin can list it");
  assert.equal((await S.client().get(`/api/jobs/${A.jobId}`)).status, 200, "A's listing is public while A is verified");
  // the gates: screening, the note, the id
  for (const [path, body, code] of [[`/api/admin/companies/${A.companyId}/verify`, {}, "screening_required"], [`/api/admin/companies/${A.companyId}/verify`, { screened: "true" }, "screening_required"],
    [`/api/admin/companies/${A.companyId}/reject`, {}, "note_required"], [`/api/admin/companies/${A.companyId}/reject`, { note: "   " }, "note_required"], [`/api/admin/companies/${A.companyId}/suspend`, {}, "note_required"]]) {
    const r = await admin.post(path, body); assert.equal(r.status, 422, `${path} ${JSON.stringify(body)} → ${r.text}`); assert.equal(r.body.error, code);
  }
  for (const what of ["verify", "reject", "suspend"]) { const r = await admin.post(`/api/admin/companies/999999/${what}`, { screened: true, note: "x" }); assert.equal(r.status, 404, r.text); assert.equal(r.body.error, "not_found"); }
  assert.equal(S.db.get("SELECT status FROM companies WHERE id = ?", A.companyId).status, "verified", "nothing refused above moved A");
  // U-046: a company that was never submitted is verified by id (today's behaviour; the product rule wants a state check)
  const vd = await admin.post(`/api/admin/companies/${dId}/verify`, { screened: true }); assert.equal(vd.status, 200, vd.text); assert.equal(vd.body.company.status, "verified");
  assert.equal(S.db.get("SELECT submitted_at FROM companies WHERE id = ?", dId).submitted_at, null, "U-046: verified without ever being submitted");
  // suspend with a note: the listing leaves the public site, the note is kept and audited
  const sus = await admin.post(`/api/admin/companies/${A.companyId}/suspend`, { note: "Policy test suspension" }); assert.equal(sus.status, 200, sus.text);
  assert.equal(sus.body.company.status, "suspended"); assert.equal(sus.body.company.reviewNote, "Policy test suspension");
  assert.equal((await S.client().get(`/api/jobs/${A.jobId}`)).status, 404, "a suspended company's listings are not public");
  assert.equal((await A.e.post("/api/employer/company/submit")).body.error, "suspended", "the employer cannot resubmit a suspended company");
  // U-046: a suspended company is verified by id (today's behaviour)
  const vs = await admin.post(`/api/admin/companies/${A.companyId}/verify`, { screened: true }); assert.equal(vs.status, 200, vs.text); assert.equal(vs.body.company.status, "verified");
  assert.equal((await S.client().get(`/api/jobs/${A.jobId}`)).status, 200, "and its listing is public again");
  // reject with a note works on the (re-)verified company too: no state check anywhere in setCompany (admin.js:46-56)
  const rej = await admin.post(`/api/admin/companies/${A.companyId}/reject`, { note: "Policy test rejection" }); assert.equal(rej.status, 200, rej.text); assert.equal(rej.body.company.status, "rejected");
  assert.deepEqual(audits(S, "company", A.companyId).filter(x => /^company\.(verified|suspended|rejected)$/.test(x.action)).map(x => [x.action, x.data.note]),
    [["company.verified", ""], ["company.suspended", "Policy test suspension"], ["company.verified", ""], ["company.rejected", "Policy test rejection"]], "every decision is in the audit log with its note");
  assert.deepEqual(audits(S, "company", dId).map(x => x.action), ["company.created", "company.verified"], "U-046: the draft went straight from created to verified");
});

test("policy admin: listing review approves only a pending listing of a verified company (409 bad_state, 409 company_not_verified); reject needs a note", async () => {
  const S = await start(), admin = await S.login(ADMIN_PHONE), A = await employerWithLiveJob(S, admin, "0955 910 003", "Review Beta");
  const submit = async () => { const r = await A.e.post("/api/employer/jobs", { job: JOB, submit: true }); assert.equal(r.status, 200, r.text); return r.body.job.id; };
  const j1 = await submit(), j2 = await submit(), j3 = await submit();
  const queue = (await admin.get("/api/admin/jobs")).body.jobs; assert.ok([j1, j2, j3].every(id => queue.some(j => j.id === id)), "the three listings wait in the queue");
  assert.ok(queue.every(j => j.companyStatus === "verified"), "the queue says the company is verified");
  const ok = await admin.post(`/api/admin/jobs/${j1}/approve`); assert.equal(ok.status, 200, ok.text);
  assert.equal((await S.client().get(`/api/jobs/${j1}`)).status, 200, "approved means public");
  for (const [id, why] of [[j1, "already published"], [A.jobId, "published by the harness"]]) { const r = await admin.post(`/api/admin/jobs/${id}/approve`); assert.equal(r.status, 409, why); assert.equal(r.body.error, "bad_state"); }
  const nn = await admin.post(`/api/admin/jobs/${j2}/reject`, { note: "" }); assert.equal(nn.status, 422); assert.equal(nn.body.error, "note_required");
  const rj = await admin.post(`/api/admin/jobs/${j2}/reject`, { note: "Pay is missing" }); assert.equal(rj.status, 200, rj.text);
  const again = await admin.post(`/api/admin/jobs/${j2}/approve`); assert.equal(again.status, 409); assert.equal(again.body.error, "bad_state", "a rejected listing is not approved by a second click");
  for (const what of ["approve", "reject"]) { const r = await admin.post(`/api/admin/jobs/999999/${what}`, { note: "x" }); assert.equal(r.status, 404); assert.equal(r.body.error, "not_found"); }
  // the company loses its verification while j3 waits: j3 stays pending whatever the admin clicks
  assert.equal((await admin.post(`/api/admin/companies/${A.companyId}/suspend`, { note: "Policy test suspension" })).status, 200);
  const cnv = await admin.post(`/api/admin/jobs/${j3}/approve`); assert.equal(cnv.status, 409, cnv.text); assert.equal(cnv.body.error, "company_not_verified");
  assert.equal(S.db.get("SELECT status FROM jobs WHERE id = ?", j3).status, "pending", "the refused approval changed nothing");
  assert.equal((await admin.get("/api/admin/jobs")).body.jobs.find(j => j.id === j3).companyStatus, "suspended", "and the queue shows why");
  assert.deepEqual([audits(S, "job", j1).filter(x => x.action === "job.approved").length, audits(S, "job", j2).map(x => x.action).filter(x => x.startsWith("job.re")), audits(S, "job", j3).filter(x => x.action === "job.approved").length],
    [1, ["job.rejected"], 0], "one audit row per decision, none for a refusal");
  assert.equal(audits(S, "job", j2).find(x => x.action === "job.rejected").data.note, "Pay is missing");
});

test("policy admin: confirm-hire needs a hired application (409 not_hired) and confirming twice is one confirmation: one audit row, one fee", async () => {
  const S = await start(), C = await cast(S), admin = C.admin, I = C.ids;
  const confirm = (id, body = {}) => admin.post(`/api/admin/applications/${id}/confirm-hire`, body);
  const nh = await confirm(I.appA); assert.equal(nh.status, 409, nh.text); assert.equal(nh.body.error, "not_hired", "seeker A's application is still new");
  const nf = await confirm(999999); assert.equal(nf.status, 404); assert.equal(nf.body.error, "not_found");
  assert.equal(S.db.get("SELECT hire_confirmed_at FROM applications WHERE id = ?", I.appA).hire_confirmed_at, null, "the refusals wrote nothing");
  for (const status of ["shortlisted", "hired"]) { const r = await C.A.e.put(`/api/employer/applications/${I.appA}`, { status }); assert.equal(r.status, 200, r.text); }
  assert.ok((await admin.get("/api/admin/hires")).body.hires.some(h => h.id === I.appA), "the hire waits for the team's call");
  const c1 = await confirm(I.appA, { note: "Called the employer" }); assert.equal(c1.status, 200, c1.text); assert.deepEqual(c1.body.charges, [], "A is on Pro, and seeker A never accepted the invitation: no fee");
  const t1 = S.db.get("SELECT hire_confirmed_at FROM applications WHERE id = ?", I.appA).hire_confirmed_at; assert.ok(t1 > 0);
  const c2 = await confirm(I.appA, { note: "Second click" }); assert.equal(c2.status, 200, c2.text); assert.deepEqual(c2.body.charges, []);
  assert.equal(S.db.get("SELECT hire_confirmed_at FROM applications WHERE id = ?", I.appA).hire_confirmed_at, t1, "the first confirmation's time stands");
  assert.ok((await admin.get("/api/admin/hires?state=confirmed")).body.hires.some(h => h.id === I.appA) && !(await admin.get("/api/admin/hires")).body.hires.some(h => h.id === I.appA), "listed once as confirmed");
  assert.equal(audits(S, "application", I.appA).filter(x => x.action === "hire.confirmed").length, 1, "one confirmation, one hire.confirmed row (U-128)");
  // a hire sourced through candidate search on the Free plan: the placement fee and the programme charge are raised once, however often it is confirmed
  const cardB = (await C.B.e.get("/api/employer/students")).body.students.find(x => x.id === I.cardB); assert.ok(cardB, "seeker B is findable by B");
  const inv = await C.B.e.post(`/api/employer/students/${cardB.id}/invite`, { kind: "job", jobId: I.jobB, message: "Policy invite" }); assert.equal(inv.status, 200, inv.text);
  assert.equal((await C.seekerB.post(`/api/me/invitations/${inv.body.invitation.id}/respond`, { answer: "yes" })).status, 200);
  const appB = (await C.seekerB.post(`/api/jobs/${I.jobB}/apply`, {})).body.application; assert.ok(appB && appB.id, "seeker B applied to B's job after accepting");
  for (const status of ["shortlisted", "hired"]) assert.equal((await C.B.e.put(`/api/employer/applications/${appB.id}`, { status })).status, 200);
  const prog = await admin.post("/api/admin/programmes", { name: "Policy programme", rateUsd: 100 }); assert.equal(prog.status, 200, prog.text);
  const c3 = await confirm(appB.id, { programmeId: prog.body.id }); assert.equal(c3.status, 200, c3.text);
  assert.deepEqual(c3.body.charges, [{ kind: "hire_fee", amountSyp: 2000000 }, { kind: "placement", amountUsd: 100, programme: "Policy programme" }], "the fee is the middle of the listing's pay; the programme rate is charged");
  const c4 = await confirm(appB.id, { programmeId: prog.body.id }); assert.equal(c4.status, 200, c4.text); assert.deepEqual(c4.body.charges, [], "nothing is charged twice");
  assert.deepEqual(S.db.all("SELECT kind, COUNT(*) AS n FROM charges WHERE application_id = ? GROUP BY kind ORDER BY kind", appB.id).map(x => [x.kind, x.n]), [["hire_fee", 1], ["placement", 1]]);
  assert.equal(audits(S, "application", appB.id).filter(x => x.action === "hire.confirmed").length, 1, "one confirmation, one hire.confirmed row");
});

test("policy admin: the audit log clamps limit to 1..200, takes junk limits, and holds no phone number (team invitations and offices are added by phone)", async () => {
  const S = await start(), C = await cast(S), admin = C.admin;
  const all = (await admin.get("/api/admin/audit?limit=200")).body.entries;
  assert.ok(all.length >= 30 && all.length < 200, `${all.length} rows from the cast`);
  for (const action of ["team.invited", "team.joined", "campus.office_added", "invitation.sent", "company.verified", "job.approved", "company.plan", "user.created", "terms.accepted"]) assert.ok(all.some(e => e.action === action), `${action} was logged`);
  assert.deepEqual(all.map(e => e.id), [...all.map(e => e.id)].sort((a, b) => b - a), "newest first");
  assert.deepEqual(Object.keys(all[0]).sort(), ["action", "actor_id", "created_at", "data", "entity", "entity_id", "id"]);
  assert.ok(all.every(e => e.data === null || typeof e.data === "object"), "data comes back parsed");
  const raw = JSON.stringify(all.map(({ created_at, ...e }) => e));   // timestamps are 13 digits: dropped so they cannot look like a number
  const PHONE = /\+963|\+1202|963(955|944)\d{6}|09(55|44) 9\d\d \d{3}|955900|944900/;
  assert.ok(!PHONE.test(raw), `a phone number in the audit log: ${(raw.match(PHONE) || [])[0]}`);
  assert.ok(PHONE.test(JSON.stringify((await admin.get("/api/admin/companies?status=verified")).body)), "the pattern does catch the owner numbers where they are shown on purpose");
  assert.ok(!/Policy|Seeker|Omar/.test(raw), "and no names either");
  // the limit: a bigger log than the cap, then every shape of limit
  for (let i = 0; i < 250; i++) S.db.run("INSERT INTO audit (actor_id, action, entity, entity_id, data, created_at) VALUES (NULL, 'test.noise', 'test', ?, NULL, ?)", i, Date.now());
  const n = async q => { const r = await admin.get("/api/admin/audit" + q); assert.equal(r.status, 200, q + " " + r.text); return r.body.entries.length; };
  assert.deepEqual([await n(""), await n("?limit=1"), await n("?limit=5"), await n("?limit=200"), await n("?limit=500"), await n("?limit=99999999999")], [50, 1, 5, 200, 200, 200], "default 50, cap 200");
  assert.deepEqual([await n("?limit=-5"), await n("?limit=-1"), await n("?limit=0"), await n("?limit=abc"), await n("?limit="), await n("?limit=1e9"), await n("?limit=5.9"), await n("?limit=%00"), await n("?limit=200abc")], [1, 1, 50, 50, 50, 1, 5, 50, 200],
    "a negative limit is 1 (SECURITY.md: -5 once meant everything), zero and junk are the default, 1e9 reads as 1");
  assert.equal((await admin.get("/api/admin/audit?limit=1")).body.entries[0].action, "test.noise", "limit=1 is the newest row");
});

const countMap = o => !!o && typeof o === "object" && !Array.isArray(o) && Object.values(o).every(v => typeof v === "number");
const tally = a => Array.isArray(a) && a.every(x => !!x && typeof x === "object" && "key" in x && "n" in x);
const numberish = v => typeof v === "number" || v === null;
function shapeDiffs(a, b, path, out) {
  if (numberish(a) && numberish(b)) return;   // a count, or a change that is null when the earlier period was 0
  if (tally(a) && tally(b)) return;           // a breakdown: more rows with the sample data, still { key, n }
  if (countMap(a) && countMap(b)) return;     // a by-status map: more statuses with the sample data, still counts
  if (Array.isArray(a) && Array.isArray(b)) { if (a.length !== b.length) out.push(`${path}: ${a.length} vs ${b.length} items`); else a.forEach((x, i) => shapeDiffs(x, b[i], `${path}[${i}]`, out)); return; }
  if (a && b && typeof a === "object" && typeof b === "object") { const ka = Object.keys(a).sort(), kb = Object.keys(b).sort(); if (ka.join() !== kb.join()) out.push(`${path}: keys ${ka} vs ${kb}`); for (const k of ka) if (k in b) shapeDiffs(a[k], b[k], `${path}.${k}`, out); return; }
  if (a !== b) out.push(`${path}: ${JSON.stringify(a)} vs ${JSON.stringify(b)}`);
}

test("policy admin: insights, traffic and system carry nobody's name, phone number or email; sample=1 changes counts only", async () => {
  const S = await start(), C = await cast(S), admin = C.admin, I = C.ids, enc = encodeURIComponent(I.phoneMemberA);
  // something for the reports to hide: a page view of A's listing, a phone-bearing route observed three times (the "slowest" list needs three), a client error
  assert.equal((await S.client().call("POST", "/api/t", { path: `/job/${I.jobA}`, first: true, lang: "ar", role: "seeker", conn: "3g", loadMs: 1800 }, { "user-agent": PHONE_UA })).status, 200);
  assert.equal((await S.client().call("POST", "/api/t/error", { message: "TypeError: x is undefined", source: "/app.js:10", path: `/job/${I.jobA}` }, { "user-agent": PHONE_UA })).status, 200);
  for (let i = 0; i < 3; i++) assert.equal((await C.A.e.put(`/api/employer/team/${enc}`, { role: "recruiter" })).status, 200, "A's recruiter keeps the role");
  const PII = /Policy|Seeker|Alpha|Beta|Omar|Aziz|Contact |\+963|\+1202|963955|963944|0955 9|0944 9|955900|944900|@|policy-homs/;
  assert.ok(PII.test(JSON.stringify((await admin.get("/api/admin/companies?status=verified")).body)), "the pattern catches names and numbers where they are shown on purpose");
  const got = {};
  for (const q of ["/api/admin/insights", "/api/admin/insights?sample=1", "/api/admin/insights?sample=1&days=365", "/api/admin/traffic?days=7", "/api/admin/traffic?sample=1&days=1", "/api/admin/system"]) {
    const r = await admin.get(q); assert.equal(r.status, 200, q + " " + r.text); got[q] = r.body;
    assert.ok(!PII.test(r.text), `${q} leaks: ${(r.text.match(PII) || [])[0]} … ${r.text.slice(Math.max(0, r.text.search(PII) - 60), r.text.search(PII) + 60)}`);
  }
  const T = got["/api/admin/traffic?days=7"], Y = got["/api/admin/system"];
  assert.ok(T.totals.views >= 1 && T.pages.some(p => p.key === "/job/:id"), "the page view counted, with the listing number folded away");
  assert.deepEqual([T.errors[0].key, T.errors[0].n], ["TypeError: x is undefined", 1], "the client error is counted");
  assert.ok(Y.slowest.every(x => /^(GET|POST|PUT|DELETE) \/(api|lite)/.test(x.route) && !/\d{6}/.test(x.route)), "routes are named by pattern, phone and id folded away: " + JSON.stringify(Y.slowest));
  assert.ok(Y.slowest.some(x => x.route === "PUT /api/employer/team/:phone") || Y.slowest.length === 8, "the phone-bearing route is listed by its pattern (or pushed out by eight slower ones)");
  // sample listings: the same report, only the numbers move
  const real = got["/api/admin/insights"], sample = got["/api/admin/insights?sample=1"], diffs = [];
  shapeDiffs(real, sample, "insights", diffs);
  assert.deepEqual(diffs, ["insights.period.sample: false vs true"], "sample=1 changes counts only");
  assert.ok(sample.headline.liveJobs > real.headline.liveJobs && sample.headline.verifiedCompanies > real.headline.verifiedCompanies, "and it does change them: the sample listings and companies appear");
  assert.deepEqual([real.headline.verifiedCompanies, real.headline.liveJobs, real.companies.teamMembers, real.campus.careerOffices], [2, 2, 3, 2], "the cast, without the sample data");
});

test("policy admin: an admin account cannot delete itself (409 admin_cannot_delete); an ordinary account can", async () => {
  const S = await start(), admin = await S.login(ADMIN_PHONE), seeker = await S.login("0944 910 001");
  assert.equal((await seeker.put("/api/me/profile", { profile: PROFILE })).status, 200);
  const r = await admin.del("/api/me"); assert.equal(r.status, 409, r.text); assert.equal(r.body.error, "admin_cannot_delete");
  assert.equal((await admin.get("/api/me")).body.user.role, "admin", "still signed in, still an admin");
  assert.equal(S.db.get("SELECT deleted_at FROM users WHERE phone = ?", ADMIN_PHONE).deleted_at, null);
  assert.equal(S.db.get("SELECT COUNT(*) AS n FROM audit WHERE action LIKE 'user.deleted%' OR action LIKE 'account.deleted%'").n, 0, "the refusal is not a deletion");
  const ok = await seeker.del("/api/me"); assert.equal(ok.status, 200, ok.text);
  assert.equal((await seeker.get("/api/me")).body.user, null, "the seeker is signed out and gone");
  assert.equal(S.db.get("SELECT COUNT(*) AS n FROM users WHERE phone = '+963944910001' AND deleted_at IS NULL").n, 0, "the number no longer belongs to a live account");
});

test("policy admin: /api/admin/system reports health figures only: no file path of the machine, the database size and backup age as numbers", async () => {
  const S = await start(), admin = await S.login(ADMIN_PHONE);
  const r = await admin.get("/api/admin/system"); assert.equal(r.status, 200, r.text); const Y = r.body;
  assert.deepEqual(Object.keys(Y).sort(), ["dbMb", "heapMb", "lastBackup", "memoryMb", "messages", "node", "production", "recentFailures", "requests", "rows", "slowest", "startedAt", "uptimeSeconds"], "the fields traffic.js:133-139 returns, no more");
  assert.equal(typeof Y.dbMb, "number"); assert.ok(Y.lastBackup === null || typeof Y.lastBackup === "number", "the newest backup is given as a time, never as a file name (traffic.js:131)");
  assert.deepEqual([Y.production, typeof Y.startedAt, typeof Y.uptimeSeconds, typeof Y.node], [false, "number", "number", "string"]);
  assert.deepEqual(Object.keys(Y.rows).sort(), ["applications", "jobs", "pageviews", "users"]); assert.deepEqual(Object.keys(Y.requests.lastHour).sort(), ["avgMs", "failed", "ms", "n", "ok", "refused"]);
  const strings = [], walk = v => { if (typeof v === "string") strings.push(v); else if (v && typeof v === "object") Object.values(v).forEach(walk); }; walk(Y);
  const stray = strings.filter(s => s.includes("/") && !/^(GET|POST|PUT|DELETE) \/(api|lite)/.test(s));
  assert.deepEqual(stray, [], "every string with a slash is a route pattern, never a path on the machine");
  assert.ok(!r.text.includes(ROOT) && !r.text.includes(S.cfg.dbPath) && !/\/home\/|\/tmp\/|backups|\.db"/.test(r.text), `no file path: ${r.text.slice(0, 200)}`);
  assert.ok(Y.requests.lastHour.n >= 2 && Y.requests.lastHour.failed === 0, "the sign-in and this request were counted");
});
