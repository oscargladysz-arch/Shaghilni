/* Route policy, part 5 (employer listings): the posting checks run on the server, company verification as the gate to
   publishing, the listing state machine, the team levels on the listing family, and what an employer learns about an
   applicant (the snapshot sent, the account phone, the student badge: SECURITY.md item 1 "Minimisation"). Every refusal
   is paired with the allowed actor or state succeeding, so no 403, 409 or 422 is vacuous. The assertions marked D-05 and
   D-06 state the rule since Stage 3: an edit while a listing awaits review or is closed makes it a draft again. */
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { start, cast, employerWithLiveJob, closeAll, ADMIN_PHONE, JOB, PROFILE } from "./policy/harness.js";

after(closeAll);

const titled = en => ({ ...JOB, title: { en } });
const status = (S, id) => S.db.get("SELECT status FROM jobs WHERE id = ?", id).status;
const refused = async (what, p, code = "bad_state", st = 409) => { const r = await p; assert.equal(r.status, st, `${what}: ${r.text}`); assert.equal(r.body.error, code, what); return r; };

test("posting checks on the server: fee wording is refused (fee_requested), missing pay or governorate is refused at submit (incomplete), gendered wording is flagged and let through to review", async () => {
  const S = await start(), admin = await S.login(ADMIN_PHONE), A = await employerWithLiveJob(S, admin, "0955 910 001", "Policy Checks"), e = A.e;
  const ok = await e.post("/api/employer/jobs", { job: JOB, submit: true });   // control: a clean listing reaches review with no flag
  assert.equal(ok.status, 200, ok.text); assert.equal(ok.body.job.status, "pending"); assert.deepEqual(ok.body.job.flags, []); assert.deepEqual(ok.body.check, { missing: [], fee: null, flags: [] });
  for (const [where, job, word] of [["title", titled("Cashier, deposit required"), "deposit"], ["summary (Arabic)", { ...JOB, summary: { ar: "يدفع المتقدم رسم تسجيل قبل البدء" } }, "رسم تسجيل"], ["duties", { ...JOB, duties: { en: ["Collect the registration fees from new staff"] } }, "fees"]]) {
    const r = await refused(`fee in the ${where}`, e.post("/api/employer/jobs", { job, submit: true }), "fee_requested", 422);
    assert.equal(r.body.detail, word, `the word that tripped the check is named (${where})`);
  }
  const mine = (await e.get("/api/employer")).body.jobs;
  assert.equal(mine.filter(j => j.status === "draft").length, 3, "policy note: a create-and-submit refused for fee wording still leaves the draft behind today (the text never reaches review; a second attempt makes a second draft)");
  assert.ok(mine.every(j => j.status !== "pending" || j.title.en === "Storekeeper"), "no fee text is awaiting review");
  const noPay = await e.post("/api/employer/jobs", { job: { ...JOB, pay: [0, 0] } });
  assert.equal(noPay.status, 200, noPay.text); assert.equal(noPay.body.job.status, "draft"); assert.deepEqual(noPay.body.check.missing, ["pay"], "a draft may be saved without pay, and the server says what is missing");
  assert.deepEqual((await refused("submit without pay", e.post(`/api/employer/jobs/${noPay.body.job.id}/submit`), "incomplete", 422)).body.detail, ["pay"]);
  assert.deepEqual((await refused("create-and-submit without a governorate", e.post("/api/employer/jobs", { job: { ...JOB, gov: "" }, submit: true }), "incomplete", 422)).body.detail, ["gov"]);
  assert.deepEqual((await refused("edit-and-submit without either", e.put(`/api/employer/jobs/${noPay.body.job.id}`, { job: { ...JOB, gov: "", pay: [0, 0] }, submit: true }), "incomplete", 422)).body.detail, ["gov", "pay"]);
  assert.equal(status(S, noPay.body.job.id), "draft", "the edit is saved as a draft, nothing reaches review");
  assert.equal((await S.client().get("/api/jobs")).body.jobs.filter(j => j.companyId === A.companyId).length, 1, "only the approved listing is public");
  const g = await e.post("/api/employer/jobs", { job: { ...JOB, title: { en: "Female secretary", ar: "مطلوب سكرتيرة" } }, submit: true });
  assert.equal(g.status, 200, g.text); assert.equal(g.body.job.status, "pending", "gendered wording is allowed through to review");
  assert.deepEqual(g.body.job.flags, [{ type: "gender", word: "Female secretary" }], "and the server records the flag for the reviewer");
  assert.deepEqual(JSON.parse(S.db.get("SELECT flags FROM jobs WHERE id = ?", g.body.job.id).flags), [{ type: "gender", word: "Female secretary" }], "the flag is on the row, not only in the answer");
  assert.deepEqual(JSON.parse(S.db.get("SELECT data FROM audit WHERE action = 'job.submitted' AND entity = 'job' AND entity_id = ?", g.body.job.id).data).flags[0].type, "gender", "the submission's audit entry carries the flag");
  assert.equal((await admin.get("/api/admin/jobs?status=pending")).body.jobs.find(j => j.id === g.body.job.id).flags[0].word, "Female secretary", "the reviewer sees it in the queue");
  const gAr = await e.post("/api/employer/jobs", { job: { ...JOB, title: { ar: "مطلوب موظفة استقبال" } } });
  assert.equal(gAr.body.job.status, "draft"); assert.deepEqual(gAr.body.job.flags, [{ type: "gender", word: "موظفة" }], "Arabic wording is flagged on a draft too (engine.js findGender runs in the server sandbox)");
});

test("posting checks on the server: an explicit fee demand is refused in every box; a bare fee word outside the listing's text (a benefit, a place, a job title) goes to the reviewer as a flag (U-020, Stage 4 fix reviews)", async () => {
  const S = await start(), admin = await S.login(ADMIN_PHONE), A = await employerWithLiveJob(S, admin, "0955 910 021", "Policy Fee Fields"), e = A.e;
  for (const [where, job, word] of [["what they offer", { ...JOB, provides: { en: ["Training, deposit required before starting"] } }, "deposit required"],
    ["what they offer (Arabic)", { ...JOB, provides: { ar: ["تدريب بعد دفع رسم تسجيل"] } }, "دفع رسم"],
    ["place", { ...JOB, place: { en: "Head office, deposit required at the door" } }, "deposit required"],
    ["place, with an amount", { ...JOB, place: { en: "Head office, pay a 50,000 SYP registration fee at the door" } }, "pay a 50,000 SYP registration fee"],
    ["tags", { ...JOB, tags: "deposit required" }, "deposit required"]]) {
    const r = await refused(`fee demand in ${where}`, e.post("/api/employer/jobs", { job, submit: true }), "fee_requested", 422);
    assert.equal(r.body.detail, word, `the phrase that tripped the check is named (${where})`);
  }
  assert.equal(S.db.get("SELECT COUNT(*) AS n FROM jobs WHERE company_id = ? AND status = 'pending'", A.companyId).n, 0, "no listing asking for a fee is awaiting review");
  for (const [where, job, word] of [["contact role", { ...JOB, contact: { role: { en: "Collects the deposit" } } }, "deposit"],
    ["a benefit", { ...JOB, provides: { en: ["University tuition fees covered"] } }, "fees"],
    ["a place (Arabic)", { ...JOB, place: { ar: "مديرية الرسوم والضرائب" } }, "الرسوم"]]) {
    const r = await e.post("/api/employer/jobs", { job, submit: true }); assert.equal(r.status, 200, `fee word in ${where} goes to review: ${r.text}`);
    const row = S.db.get("SELECT status, flags FROM jobs WHERE id = ?", r.body.job.id);
    assert.equal(row.status, "pending", `${where}: awaiting review`);
    assert.deepEqual(JSON.parse(row.flags).filter(f => f.type === "fee"), [{ type: "fee", word }], `the reviewer is shown the word (${where})`);
  }
  // in the listing's own text (title, summary, duties, needs) any fee word is refused
  const own = await refused("fee in the summary", e.post("/api/employer/jobs", { job: { ...JOB, summary: { en: "Pay a deposit before starting." } }, submit: true }), "fee_requested", 422);
  assert.equal(own.body.detail, "deposit", "the word that tripped the check is named");
  // the reviewer decides on a flagged one
  const flagged = S.db.get("SELECT id FROM jobs WHERE company_id = ? AND status = 'pending' ORDER BY id LIMIT 1", A.companyId).id;
  assert.equal((await admin.post(`/api/admin/jobs/${flagged}/approve`, {})).status, 200, "the admin publishes a flagged listing after reading it");
});

test("verification gates publishing: a draft, pending or rejected company cannot submit a listing; a suspended company cannot submit, reopen or resubmit its page, and its listings leave the board", async () => {
  const S = await start(), admin = await S.login(ADMIN_PHONE), e = await S.login("0955 910 002", "employer");
  const page = { name: { en: "Policy Pending" }, gov: "aleppo", regNo: "REG-Policy Pending", contactName: "Contact Pending", whatsapp: "0955 910 002" };
  assert.equal((await e.put("/api/employer/company", { company: page })).status, 200);
  const j1 = (await e.post("/api/employer/jobs", { job: JOB })).body.job; assert.equal(j1.status, "draft", "a listing can be drafted before verification");
  await refused("submit under a never-submitted company", e.post(`/api/employer/jobs/${j1.id}/submit`), "company_not_verified");
  await refused("create-and-submit under it", e.post("/api/employer/jobs", { job: JOB, submit: true }), "company_not_verified");
  assert.equal((await e.post("/api/employer/company/submit")).body.company.status, "pending");
  await refused("submit under a pending company", e.post(`/api/employer/jobs/${j1.id}/submit`), "company_not_verified");
  const co = (await admin.get("/api/admin/companies?status=pending")).body.companies.find(c => c.name.en === "Policy Pending"); assert.ok(co, "the company awaits verification");
  assert.equal((await admin.post(`/api/admin/companies/${co.id}/reject`, { note: "Papers missing" })).body.company.status, "rejected");
  await refused("submit under a rejected company", e.post(`/api/employer/jobs/${j1.id}/submit`), "company_not_verified");
  assert.equal(status(S, j1.id), "draft", "the listing never moved");
  assert.equal((await e.post("/api/employer/company/submit")).body.company.status, "pending", "a rejected company may submit its page again");
  assert.equal((await admin.post(`/api/admin/companies/${co.id}/verify`, { screened: true })).body.company.status, "verified");
  const sub = await e.post(`/api/employer/jobs/${j1.id}/submit`); assert.equal(sub.status, 200, sub.text); assert.equal(sub.body.job.status, "pending", "verified: the same call succeeds");
  assert.equal((await admin.post(`/api/admin/jobs/${j1.id}/approve`)).status, 200);
  assert.equal((await S.client().get(`/api/jobs/${j1.id}`)).status, 200, "published and public");
  const j2 = (await e.post("/api/employer/jobs", { job: JOB, submit: true })).body.job; assert.equal(j2.status, "pending");   // awaiting review when the company is suspended
  const j3 = (await e.post("/api/employer/jobs", { job: JOB })).body.job; assert.equal(j3.status, "draft");
  assert.equal((await admin.post(`/api/admin/companies/${co.id}/suspend`, { note: "Complaint upheld" })).body.company.status, "suspended");
  assert.equal((await S.client().get(`/api/jobs/${j1.id}`)).status, 404, "a suspended company's listing leaves the board at once");
  assert.ok(!(await S.client().get("/api/jobs")).body.jobs.some(j => j.companyId === co.id), "and the list");
  await refused("resubmit the page while suspended", e.post("/api/employer/company/submit"), "suspended");
  await refused("submit a draft while suspended", e.post(`/api/employer/jobs/${j3.id}/submit`), "company_not_verified");
  await refused("the admin approving the pending listing of a suspended company", admin.post(`/api/admin/jobs/${j2.id}/approve`), "company_not_verified");
  const close = await e.post(`/api/employer/jobs/${j1.id}/close`); assert.equal(close.status, 200, close.text); assert.equal(close.body.job.status, "closed", "closing is still allowed: it takes the listing down");
  await refused("reopen while suspended", e.post(`/api/employer/jobs/${j1.id}/reopen`), "company_not_verified");
  assert.deepEqual([status(S, j1.id), status(S, j2.id), status(S, j3.id)], ["closed", "pending", "draft"]);
  assert.deepEqual(S.db.all("SELECT action FROM audit WHERE entity = 'company' AND entity_id = ? ORDER BY id", co.id).map(x => x.action), ["company.created", "company.submitted", "company.rejected", "company.submitted", "company.verified", "company.suspended"], "every decision is in the audit log");
});

test("listing state machine: submit only from draft or rejected, close only from published, reopen only from closed, approve only pending; an edit while pending or closed is a draft again (D-05, D-06)", async () => {
  const S = await start(), admin = await S.login(ADMIN_PHONE), A = await employerWithLiveJob(S, admin, "0955 910 003", "Policy States"), e = A.e;
  const pub = id => S.client().get(`/api/jobs/${id}`);
  const d = (await e.post("/api/employer/jobs", { job: JOB })).body.job; assert.equal(d.status, "draft");
  await refused("close a draft", e.post(`/api/employer/jobs/${d.id}/close`)); await refused("reopen a draft", e.post(`/api/employer/jobs/${d.id}/reopen`)); await refused("approve a draft", admin.post(`/api/admin/jobs/${d.id}/approve`));
  assert.equal((await pub(d.id)).status, 404, "a draft is not public");
  assert.equal((await e.post(`/api/employer/jobs/${d.id}/submit`)).body.job.status, "pending", "draft → submit → pending");
  await refused("submit twice", e.post(`/api/employer/jobs/${d.id}/submit`)); await refused("close pending", e.post(`/api/employer/jobs/${d.id}/close`)); await refused("reopen pending", e.post(`/api/employer/jobs/${d.id}/reopen`));
  assert.equal((await pub(d.id)).status, 404, "pending is not public");
  // D-05: an edit while pending is a draft again, so the text goes through the posting checks before an admin sees it
  const fee = await e.put(`/api/employer/jobs/${d.id}`, { job: titled("Storekeeper, deposit required") });
  assert.equal(fee.status, 200, fee.text); assert.equal(fee.body.check.fee, "deposit", "the check sees the fee word");
  assert.equal(fee.body.job.status, "draft", "D-05: an edit while pending makes the listing a draft");
  await refused("submit the fee wording", e.post(`/api/employer/jobs/${d.id}/submit`), "fee_requested", 422);
  assert.ok(!(await admin.get("/api/admin/jobs?status=pending")).body.jobs.some(j => j.id === d.id), "D-05: the edited text is not in the review queue");
  assert.equal((await e.put(`/api/employer/jobs/${d.id}`, { job: JOB })).body.job.status, "draft", "D-05: clean text again, still a draft until submitted");
  assert.equal((await e.post(`/api/employer/jobs/${d.id}/submit`)).body.job.status, "pending", "draft → submit → pending again");
  S.db.run("UPDATE jobs SET data = json_set(data, '$.title.en', 'Storekeeper, deposit required') WHERE id = ?", d.id);   // fee wording that somehow reached the queue
  await refused("approve fee wording", admin.post(`/api/admin/jobs/${d.id}/approve`), "fee_requested", 422);   // D-05: approve re-runs the posting checks
  S.db.run("UPDATE jobs SET data = json_set(data, '$.title.en', 'Storekeeper') WHERE id = ?", d.id);
  await refused("reject without a note", admin.post(`/api/admin/jobs/${d.id}/reject`, {}), "note_required", 422);
  assert.equal((await admin.post(`/api/admin/jobs/${d.id}/reject`, { note: "Say which branch" })).status, 200); assert.equal(status(S, d.id), "rejected");
  await refused("close rejected", e.post(`/api/employer/jobs/${d.id}/close`)); await refused("reopen rejected", e.post(`/api/employer/jobs/${d.id}/reopen`)); await refused("approve rejected", admin.post(`/api/admin/jobs/${d.id}/approve`));
  assert.equal((await e.post(`/api/employer/jobs/${d.id}/submit`)).body.job.status, "pending", "rejected → submit → pending");
  assert.equal((await admin.post(`/api/admin/jobs/${d.id}/reject`, { note: "Still unclear" })).status, 200);
  assert.equal((await e.put(`/api/employer/jobs/${d.id}`, { job: JOB })).body.job.status, "draft", "an edit of a rejected listing is a draft again");
  const p = A.jobId; assert.equal(status(S, p), "published"); assert.equal((await pub(p)).status, 200, "the control listing is live");
  await refused("submit published", e.post(`/api/employer/jobs/${p}/submit`)); await refused("reopen published", e.post(`/api/employer/jobs/${p}/reopen`)); await refused("approve published", admin.post(`/api/admin/jobs/${p}/approve`));
  assert.equal((await e.post(`/api/employer/jobs/${p}/close`)).body.job.status, "closed", "published → close → closed"); assert.equal((await pub(p)).status, 404, "closed listings leave the board");
  await refused("close twice", e.post(`/api/employer/jobs/${p}/close`)); await refused("submit closed", e.post(`/api/employer/jobs/${p}/submit`)); await refused("approve closed", admin.post(`/api/admin/jobs/${p}/approve`));
  // D-06: an edit while closed is a draft again; the only way back to the board is submit (posting checks) → approve
  const edited = await e.put(`/api/employer/jobs/${p}`, { job: titled("Storekeeper, deposit required") });
  assert.equal(edited.status, 200, edited.text); assert.equal(edited.body.check.fee, "deposit"); assert.equal(edited.body.job.status, "draft", "D-06: an edit while closed makes the listing a draft");
  await refused("reopen the edited draft", e.post(`/api/employer/jobs/${p}/reopen`));
  assert.equal((await pub(p)).status, 404, "D-06: the unreviewed text is not on the board");
  await refused("submit the fee wording", e.post(`/api/employer/jobs/${p}/submit`), "fee_requested", 422);
  assert.equal((await e.put(`/api/employer/jobs/${p}`, { job: titled("Storekeeper") })).body.job.status, "draft");
  assert.equal((await e.post(`/api/employer/jobs/${p}/submit`)).body.job.status, "pending", "D-06: the edited text goes back to review");
  assert.ok((await admin.get("/api/admin/jobs?status=pending")).body.jobs.some(j => j.id === p), "and is in the review queue");
  assert.equal((await admin.post(`/api/admin/jobs/${p}/approve`)).status, 200); assert.equal((await pub(p)).body.job.title.en, "Storekeeper", "reviewed text is on the board again");
  assert.deepEqual(S.db.all("SELECT action FROM audit WHERE entity = 'job' AND entity_id = ? ORDER BY id", p).map(x => x.action), ["job.created", "job.submitted", "job.approved", "job.closed", "job.updated", "job.updated", "job.submitted", "job.approved"], "every move of a listing is in the audit log");
});

test("team levels on listings: a hiring manager reads applicants and writes notes only; a recruiter runs listings and moves applicants; the company page and its submission need manage", async () => {
  const S = await start(), C = await cast(S), I = C.ids, H = C.hiring, R = C.recruiter;
  const forbidden = async (who, what, p, need) => { const r = await p; assert.equal(r.status, 403, `${who} ${what}: ${r.text}`); assert.deepEqual([r.body.error, r.body.detail], ["role_forbidden", { need }], `${who} ${what}`); };
  await forbidden("hiring manager", "create", H.post("/api/employer/jobs", { job: JOB }), "hire");
  const j = (await R.post("/api/employer/jobs", { job: JOB })).body.job; assert.equal(j && j.status, "draft", "the recruiter creates");
  await forbidden("hiring manager", "edit", H.put(`/api/employer/jobs/${j.id}`, { job: titled("Edited by the hiring manager") }), "hire");
  assert.equal((await R.put(`/api/employer/jobs/${j.id}`, { job: titled("Edited by the recruiter") })).body.job.title.en, "Edited by the recruiter", "the recruiter edits");
  await forbidden("hiring manager", "submit", H.post(`/api/employer/jobs/${j.id}/submit`), "hire");
  assert.equal((await R.post(`/api/employer/jobs/${j.id}/submit`)).body.job.status, "pending", "the recruiter submits"); assert.equal((await C.admin.post(`/api/admin/jobs/${j.id}/approve`)).status, 200);
  await forbidden("hiring manager", "close", H.post(`/api/employer/jobs/${j.id}/close`), "hire");
  assert.equal((await R.post(`/api/employer/jobs/${j.id}/close`)).body.job.status, "closed", "the recruiter closes");
  await forbidden("hiring manager", "reopen", H.post(`/api/employer/jobs/${j.id}/reopen`), "hire");
  assert.equal((await R.post(`/api/employer/jobs/${j.id}/reopen`)).body.job.status, "published", "the recruiter reopens");
  assert.equal(status(S, j.id), "published"); assert.equal(S.db.get("SELECT COUNT(*) AS n FROM jobs WHERE company_id = ?", I.companyA).n, 2, "the hiring manager's refused create left no row");
  // the pipeline: a note needs view, a stage move needs hire (test/policy-idor.test.js has the hiring manager's refused move)
  assert.equal((await H.get(`/api/employer/jobs/${I.jobA}/applications`)).body.applications[0].id, I.appA, "the hiring manager reads the applicants");
  assert.equal((await H.put(`/api/employer/applications/${I.appA}`, { note: "Good on the phone" })).status, 200, "and writes a note");
  assert.equal((await R.put(`/api/employer/applications/${I.appA}`, { status: "shortlisted" })).body.status, "shortlisted", "the recruiter moves");
  const seen = (await C.A.e.get(`/api/employer/jobs/${I.jobA}/applications`)).body.applications[0];
  assert.deepEqual([seen.status, seen.note, seen.noteBy, seen.movedBy], ["shortlisted", "Good on the phone", "Policy Hiring", "Policy Recruiter"]);
  // the company page and its submission need manage: recruiter and hiring manager refused, the company admin succeeds without re-verification
  const page = (await C.A.e.get("/api/employer")).body.company;
  const same = { name: page.name, gov: page.gov, regNo: page.regNo, contactName: page.contactName, whatsapp: page.whatsapp, about: { en: "Edited by the company admin" } };
  await forbidden("recruiter", "edit the company page", R.put("/api/employer/company", { company: same }), "manage");
  await forbidden("hiring manager", "edit the company page", H.put("/api/employer/company", { company: same }), "manage");
  await forbidden("recruiter", "submit the company page", R.post("/api/employer/company/submit"), "manage");
  await forbidden("hiring manager", "submit the company page", H.post("/api/employer/company/submit"), "manage");
  const ed = await C.cadmin.put("/api/employer/company", { company: same }); assert.equal(ed.status, 200, ed.text);
  assert.deepEqual([ed.body.company.about.en, ed.body.company.status], ["Edited by the company admin", "verified"], "the company admin edits; same name and number, so no re-verification");
  assert.equal((await C.cadmin.post("/api/employer/company/submit")).body.company.status, "verified", "the company admin may submit (a verified page comes back as is)");
  assert.equal((await C.A.e.get("/api/employer")).body.company.about.en, "Edited by the company admin", "the owner sees the admin's edit");
});

test("applicants: the employer sees the snapshot sent, the account phone and the student badge, nothing else; never the live profile; a withdrawn application disappears (SECURITY.md item 1)", async () => {
  const S = await start(), admin = await S.login(ADMIN_PHONE), A = await employerWithLiveJob(S, admin, "0955 910 004", "Policy Snapshot"), e = A.e, s = await S.login("0944 910 001");
  assert.equal((await s.put("/api/me/profile", { profile: { ...PROFILE, name: "Rana Before", email: "rana@policy.example" } })).status, 200);
  assert.deepEqual((await e.get(`/api/employer/jobs/${A.jobId}/applications`)).body.applications, [], "nobody has applied yet");
  const ap = await s.post(`/api/jobs/${A.jobId}/apply`, {}); assert.equal(ap.status, 200, ap.text);
  assert.equal((await s.put("/api/me/profile", { profile: { ...PROFILE, name: "Rana After", email: "after@policy.example", skills: ["Excel"] } })).status, 200);
  assert.equal((await s.get("/api/me")).body.profile.name, "Rana After", "the live profile changed");
  const list = (await e.get(`/api/employer/jobs/${A.jobId}/applications`)).body.applications; assert.equal(list.length, 1); const [a] = list;
  assert.deepEqual([a.profile.name, a.profile.email, a.profile.skills], ["Rana Before", "rana@policy.example", []], "the employer sees the snapshot sent with the application, not the live profile");
  assert.deepEqual(Object.keys(a).sort(), ["channel", "createdAt", "cvLang", "hireConfirmed", "hiredAt", "id", "movedBy", "note", "noteBy", "phone", "profile", "status", "updatedAt", "verifiedUni"],
    "item 1: the snapshot, the account phone and the student badge; no account email, nothing from the live profile");
  assert.equal(a.phone, "+963944910001", "the account's phone number, as item 1 allows");
  assert.equal(a.verifiedUni, "", "the current student badge (none here)");
  assert.ok(!JSON.stringify(a).includes("after@policy.example") && !JSON.stringify(a).includes("Rana After"), "nothing typed after applying reaches the employer");
  assert.equal((await s.post(`/api/me/applications/${a.id}/withdraw`)).status, 200);
  assert.deepEqual((await e.get(`/api/employer/jobs/${A.jobId}/applications`)).body.applications, [], "a withdrawn application leaves the employer's list");
});
