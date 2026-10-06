/* Route policy, part 5 (public board, account, applications, resume AI, alerts): what a guest or a seeker who has not
   applied can learn about an employer, which listings are reachable at all, what applying reveals and when, what one
   account's export and deletion cover, the alert cap, the AI gates without a key, and the language switch.
   Every refusal is paired with a positive control so no 404 is vacuous; a "today:" comment marks recorded behaviour
   (with its DEFECTS.md id where one exists) so the later fix has to touch the assertion. */
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { start, cast, closeAll, employerWithLiveJob, ADMIN_PHONE, PROFILE, JOB } from "./policy/harness.js";

after(closeAll);

/* Company fields that only the company page (employer side) may carry: never on a public listing. "applyEmail" is also
   the name of the public boolean, so it is checked by type below. */
const COMPANY_PRIVATE = ["whatsapp", "applyPhone", "regNo", "contactName", "website", "applyVia", "ownerPhone", "reviewNote", "status"];
/* Everything serialize.js jobOut + sanitizeJob put on a public listing today (server/serialize.js:15-27, server/validate.js:109-122): a new field has to be added here on purpose. */
const PUBLIC_JOB_KEYS = ["sponsored", "sponsoredUntil", "unis", "progStart", "progEnd", "id", "companyId", "abbr", "sector", "cat", "co", "about", "days", "applicants", "hasWhatsapp", "applyCall", "applyEmail", "demo", "partnerUnis",
  "title", "place", "gov", "type", "level", "mode", "pay", "langs", "recruits", "anyFaculty", "noDegree", "support", "returnees", "openings", "summary", "duties", "needs", "provides", "contact", "tags"].sort();
const noSecrets = (text, secrets, where) => { for (const s of secrets) assert.ok(!text.includes(s), `${where} carries ${s}`); };
const seekerWithProfile = async (S, phone, name = "Policy Seeker") => { const c = await S.login(phone); assert.equal((await c.put("/api/me/profile", { profile: { ...PROFILE, name } })).status, 200); return c; };
const count = (S, sql, ...args) => S.db.get(`SELECT COUNT(*) AS n FROM ${sql}`, ...args).n;   /* sql-safe: table and where clause are test literals */

test("public board: a guest and a seeker who has not applied learn which ways to apply exist, never the numbers, the address, the registration or the contact person", async () => {
  const S = await start(), admin = await S.login(ADMIN_PHONE), guest = S.client();
  const A = await employerWithLiveJob(S, admin, "0955 910 001", "Public Alpha");
  const CO = { name: { en: "Public Alpha" }, gov: "aleppo", regNo: "REG-Public Alpha", contactName: "Contact Public Alpha", whatsapp: "0955 910 001", applyVia: { whatsapp: true, call: true, email: true }, applyPhone: "0955 910 003", applyEmail: "jobs@public-alpha.example", website: "https://public-alpha.example" };
  const put = await A.e.put("/api/employer/company", { company: CO }); assert.equal(put.status, 200, put.text);
  assert.equal(put.body.company.status, "verified", "same name and registration number: the company stays verified");
  assert.deepEqual([put.body.company.whatsapp, put.body.company.applyPhone, put.body.company.applyEmail], ["+963955910001", "+963955910003", "jobs@public-alpha.example"], "the employer side holds the real details (positive control)");
  const SECRETS = ["+963955910001", "955910001", "+963955910003", "955910003", "jobs@public-alpha.example", "public-alpha.example", "REG-Public Alpha", "Contact Public Alpha"];
  const seeker = await seekerWithProfile(S, "0944 910 001");
  for (const [who, c] of [["guest", guest], ["seeker who has not applied", seeker]]) {
    const board = await c.get("/api/jobs"), one = await c.get(`/api/jobs/${A.jobId}`);
    assert.equal(board.status, 200); assert.equal(one.status, 200, `${who}: the live listing is readable`);
    const onBoard = board.body.jobs.find(j => j.id === A.jobId); assert.ok(onBoard, `${who}: the live listing is on the board`);
    for (const j of [onBoard, one.body.job]) {
      assert.deepEqual([j.co.en, j.hasWhatsapp, j.applyCall, j.applyEmail], ["Public Alpha", true, true, true], `${who}: the listing says which ways exist`);
      assert.deepEqual(Object.keys(j).sort(), PUBLIC_JOB_KEYS, `${who}: every public field is on the allow-list`);
      for (const k of COMPANY_PRIVATE) assert.equal(k in j, false, `${who}: listing carries company field ${k}`);
      assert.equal(typeof j.applyEmail, "boolean", `${who}: applyEmail is a switch, not the address`);
    }
    for (const j of board.body.jobs) { for (const k of COMPANY_PRIVATE) assert.equal(k in j, false, `${who}: board listing ${j.id} carries ${k}`); assert.equal(typeof j.applyEmail, "boolean"); }   // sample listings too
    noSecrets(board.text, SECRETS, `${who}: GET /api/jobs`); noSecrets(one.text, SECRETS, `${who}: GET /api/jobs/${A.jobId}`);
  }
  // D-30 (fixed in Stage 3): numbers and emails in the free-text place, contact and tags fields are flagged for the reviewer; the text itself is still the employer's to publish once reviewed
  const loud = await A.e.post("/api/employer/jobs", { job: { ...JOB, title: { en: "Loud listing" }, place: { en: "Call 0955 910 003" }, contact: { name: { en: "Contact Public Alpha" }, status: { en: "jobs@public-alpha.example" } }, tags: "0955 910 001" }, submit: true });
  assert.equal(loud.status, 200, loud.text); assert.deepEqual(loud.body.check.flags.map(f => f.type + ":" + f.word).sort(), ["contact:0955 910 001", "contact:0955 910 003", "contact:jobs@public-alpha.example"], "D-30: every number and email in the text is a contact flag for the reviewer");
  assert.equal((await admin.post(`/api/admin/jobs/${loud.body.job.id}/approve`)).status, 200);
  const pub = (await guest.get(`/api/jobs/${loud.body.job.id}`)).body.job;
  assert.deepEqual([pub.place.en, pub.contact.name.en, pub.contact.status.en, pub.tags], ["Call 0955 910 003", "Contact Public Alpha", "jobs@public-alpha.example", "0955 910 001"], "the reviewer approved it, so the text reaches guests as written (the flags never do)");
});

test("unlisted listings: draft, pending, rejected and closed jobs and the jobs of a suspended or re-verifying company answer 404 not_found to guests and seekers on read, save and apply, like a job that never existed", async () => {
  const S = await start(), admin = await S.login(ADMIN_PHONE), guest = S.client();
  const A = await employerWithLiveJob(S, admin, "0955 910 001", "Unlisted Alpha"), B = await employerWithLiveJob(S, admin, "0955 910 002", "Unlisted Beta");
  const s = await seekerWithProfile(S, "0944 910 001");
  const post = async over => { const r = await A.e.post("/api/employer/jobs", { job: { ...JOB, title: { en: over.title } }, submit: !!over.submit }); assert.equal(r.status, 200, r.text); return r.body.job; };
  const draft = await post({ title: "Draft" }), pending = await post({ title: "Pending", submit: true }), rejected = await post({ title: "Rejected", submit: true });
  assert.equal((await admin.post(`/api/admin/jobs/${rejected.id}/reject`, { note: "Not for the board" })).status, 200);
  const third = await post({ title: "Third", submit: true }); assert.equal((await admin.post(`/api/admin/jobs/${third.id}/approve`)).status, 200);
  const unreachable = async (id, why) => {
    assert.ok(!(await guest.get("/api/jobs")).body.jobs.some(j => j.id === id), `${why}: not on the board`);
    for (const [who, c] of [["guest", guest], ["seeker", s]]) { const r = await c.get(`/api/jobs/${id}`); assert.deepEqual([r.status, r.body.error], [404, "not_found"], `${why}: ${who} GET → ${r.status} ${r.text.slice(0, 80)}`); }
    const save = await s.post(`/api/me/saved/${id}`); assert.deepEqual([save.status, save.body.error], [404, "not_found"], `${why}: save → ${save.text.slice(0, 80)}`);
    const apply = await s.post(`/api/jobs/${id}/apply`, {}); assert.deepEqual([apply.status, apply.body.error], [404, "not_found"], `${why}: apply → ${apply.text.slice(0, 80)}`);
    assert.equal(count(S, "applications WHERE job_id = ?", id), 0, `${why}: no application row`);
  };
  const reachable = async (id, why) => { for (const c of [guest, s]) assert.equal((await c.get(`/api/jobs/${id}`)).status, 200, `${why}: readable`); assert.ok((await guest.get("/api/jobs")).body.jobs.some(j => j.id === id), `${why}: on the board`); };
  const mine = (await A.e.get("/api/employer")).body.jobs;
  assert.deepEqual([draft, pending, rejected, third].map(j => (mine.find(x => x.id === j.id) || {}).status), ["draft", "pending", "rejected", "published"], "the employer holds all four (positive control)");
  await unreachable(draft.id, "draft"); await unreachable(pending.id, "pending"); await unreachable(rejected.id, "rejected"); await unreachable(999999, "no such job");
  // closed: live first (save and apply succeed), then gone
  await reachable(A.jobId, "A's live job"); assert.equal((await s.post(`/api/me/saved/${A.jobId}`)).status, 200);
  const applied = await s.post(`/api/jobs/${A.jobId}/apply`, {}); assert.equal(applied.status, 200, applied.text);
  assert.equal((await A.e.post(`/api/employer/jobs/${A.jobId}/close`)).status, 200);
  for (const [who, c] of [["guest", guest], ["the applicant", s]]) { const r = await c.get(`/api/jobs/${A.jobId}`); assert.deepEqual([r.status, r.body.error], [404, "not_found"], `closed: ${who}`); }
  assert.ok(!(await guest.get("/api/jobs")).body.jobs.some(j => j.id === A.jobId), "closed: off the board");
  assert.equal((await s.get("/api/me/applications")).body.applications.find(a => a.id === applied.body.application.id).jobOpen, false, "the applicant keeps the application, marked closed");
  assert.equal((await s.post(`/api/jobs/${A.jobId}/apply`, {})).status, 404, "closed: no new applications");
  // suspended company: its published job vanishes with it
  await reachable(B.jobId, "B's live job"); assert.equal((await admin.post(`/api/admin/companies/${B.companyId}/suspend`, { note: "Policy suspension" })).status, 200);
  await unreachable(B.jobId, "job of a suspended company");
  // a company that changed its identity is back under review: its live job is unlisted until the admin verifies again
  await reachable(third.id, "A's third job"); const rename = await A.e.put("/api/employer/company", { company: { name: { en: "Unlisted Alpha Group" }, gov: "aleppo", regNo: "REG-Unlisted Alpha", contactName: "Contact Unlisted Alpha", whatsapp: "0955 910 001" } });
  assert.equal(rename.body.company.status, "pending", rename.text); await unreachable(third.id, "job of a company under re-verification");
  assert.equal((await admin.post(`/api/admin/companies/${A.companyId}/verify`, { screened: true })).status, 200); await reachable(third.id, "A's third job after re-verification");
});

test("applying reveals only the ways the company switched on, only in the apply answer: a refused channel leaves no application, and neither the listing nor the seeker's application list carries the number", async () => {
  const S = await start(), admin = await S.login(ADMIN_PHONE);
  const A = await employerWithLiveJob(S, admin, "0955 910 001", "Reveal Alpha");   // WhatsApp on, call and email off
  const s = await seekerWithProfile(S, "0944 910 001");
  for (const channel of ["call", "email"]) { const r = await s.post(`/api/jobs/${A.jobId}/apply`, { channel }); assert.deepEqual([r.status, r.body.error], [409, "channel_unavailable"], `${channel} is off → ${r.text.slice(0, 80)}`); }
  assert.equal(count(S, "applications WHERE user_id = (SELECT id FROM users WHERE phone = '+963944910001')"), 0, "a refused channel leaves no application");
  assert.equal(count(S, "audit WHERE action = 'application.created'"), 0);
  const wa = await s.post(`/api/jobs/${A.jobId}/apply`, { channel: "whatsapp", cvLang: "ar" }); assert.equal(wa.status, 200, wa.text);
  assert.deepEqual(Object.keys(wa.body).sort(), ["application", "whatsapp"], "only the chosen channel's key is in the answer");
  assert.equal(wa.body.whatsapp, "+963955910001", "the switched-on channel is revealed to the applicant");
  const NUM = ["+963955910001", "955910001", "955 910 001"];
  noSecrets((await s.get(`/api/jobs/${A.jobId}`)).text, NUM, "the listing, read by the applicant,"); noSecrets((await s.get("/api/jobs")).text, NUM, "the board, read by the applicant,");
  const list = await s.get("/api/me/applications"); assert.equal(list.body.applications[0].channel, "whatsapp"); noSecrets(list.text, NUM, "the seeker's application list");
  noSecrets((await s.get("/api/me")).text, NUM, "GET /api/me");
  // the switch, not the stored value, governs: WhatsApp off with the number still on file, call and email on
  const CO = { name: { en: "Reveal Alpha" }, gov: "aleppo", regNo: "REG-Reveal Alpha", contactName: "Contact Reveal Alpha", whatsapp: "0955 910 001", applyVia: { whatsapp: false, call: true, email: true }, applyPhone: "0955 910 003", applyEmail: "jobs@reveal-alpha.example" };
  const put = await A.e.put("/api/employer/company", { company: CO }); assert.equal(put.body.company.status, "verified", put.text); assert.equal(put.body.company.whatsapp, "+963955910001", "the number is still on file");
  const pub = (await S.client().get(`/api/jobs/${A.jobId}`)).body.job; assert.deepEqual([pub.hasWhatsapp, pub.applyCall, pub.applyEmail], [false, true, true]);
  const s2 = await seekerWithProfile(S, "0944 910 002");
  const off = await s2.post(`/api/jobs/${A.jobId}/apply`, { channel: "whatsapp" }); assert.deepEqual([off.status, off.body.error], [409, "channel_unavailable"], "WhatsApp switched off is refused although the number is stored");
  const em = await s2.post(`/api/jobs/${A.jobId}/apply`, { channel: "email", cvLang: "en" }); assert.equal(em.status, 200, em.text);
  assert.deepEqual([Object.keys(em.body).sort(), em.body.email], [["application", "email"], "jobs@reveal-alpha.example"]);
  const s3 = await seekerWithProfile(S, "0944 910 003");
  const call = await s3.post(`/api/jobs/${A.jobId}/apply`, { channel: "call" }); assert.deepEqual([Object.keys(call.body).sort(), call.body.phone], [["application", "phone"], "+963955910003"]);
  const web = await s3.post(`/api/jobs/${A.jobId}/apply`, { channel: "junk-channel" }); assert.equal(web.status, 200);
  assert.deepEqual(Object.keys(web.body), ["application"], "today: an unknown channel is treated as 'web' (no reveal) rather than refused");
  // today: a second apply over another channel on an open application reveals that channel too, but the stored application keeps its first channel
  const again = await s2.post(`/api/jobs/${A.jobId}/apply`, { channel: "call" }); assert.equal(again.body.application.id, em.body.application.id); assert.equal(again.body.phone, "+963955910003");
  assert.equal(S.db.get("SELECT channel FROM applications WHERE id = ?", em.body.application.id).channel, "email", "today: the stored channel is the first one");
});

test("applications: applying twice keeps one row and one audit entry, a hired application cannot be withdrawn, and a withdrawn one is re-opened with a fresh snapshot by applying again", async () => {
  const S = await start(), admin = await S.login(ADMIN_PHONE);
  const A = await employerWithLiveJob(S, admin, "0955 910 001", "Pipeline Alpha");
  const s = await seekerWithProfile(S, "0944 910 001", "Hired Seeker"), s2 = await seekerWithProfile(S, "0944 910 002", "Second Seeker");
  const first = (await s.post(`/api/jobs/${A.jobId}/apply`, {})).body.application, twice = (await s.post(`/api/jobs/${A.jobId}/apply`, {})).body.application;
  assert.equal(twice.id, first.id); assert.equal(count(S, "applications WHERE job_id = ?", A.jobId), 1, "one row"); assert.equal(count(S, "audit WHERE action = 'application.created' AND entity_id = ?", first.id), 1, "one audit entry");
  for (const status of ["shortlisted", "interview", "hired"]) assert.equal((await A.e.put(`/api/employer/applications/${first.id}`, { status })).status, 200, status);
  const w = await s.post(`/api/me/applications/${first.id}/withdraw`); assert.deepEqual([w.status, w.body.error], [409, "already_hired"]);
  assert.equal(S.db.get("SELECT status FROM applications WHERE id = ?", first.id).status, "hired", "still hired");
  assert.equal(count(S, "audit WHERE action = 'application.withdrawn'"), 0);
  const onHired = await s.post(`/api/jobs/${A.jobId}/apply`, {});   // today: re-applying on a hired application answers 200 with status "new" while the row stays hired (no DEFECTS.md entry yet)
  assert.deepEqual([onHired.status, onHired.body.application.id, onHired.body.application.status, S.db.get("SELECT status FROM applications WHERE id = ?", first.id).status], [200, first.id, "new", "hired"]);
  // a plain application can be withdrawn (positive control) and re-opened by applying again
  const second = (await s2.post(`/api/jobs/${A.jobId}/apply`, { cvLang: "ar" })).body.application;
  const missing = await s2.post("/api/me/applications/999999/withdraw"); assert.deepEqual([missing.status, missing.body.error], [404, "not_found"]);
  assert.equal((await s2.post(`/api/me/applications/${second.id}/withdraw`)).status, 200);
  assert.equal(S.db.get("SELECT status FROM applications WHERE id = ?", second.id).status, "withdrawn"); assert.equal(count(S, "audit WHERE action = 'application.withdrawn' AND entity_id = ?", second.id), 1);
  assert.equal((await s2.post(`/api/me/applications/${second.id}/withdraw`)).status, 200, "today (U-084): withdrawing twice is accepted (idempotent)");
  assert.ok(!(await A.e.get(`/api/employer/jobs/${A.jobId}/applications`)).body.applications.some(a => a.id === second.id), "a withdrawn application leaves the employer's list");
  assert.equal((await s2.put("/api/me/profile", { profile: { ...PROFILE, name: "Second Seeker Renamed" } })).status, 200);
  const re = await s2.post(`/api/jobs/${A.jobId}/apply`, { channel: "whatsapp", cvLang: "en" }); assert.equal(re.status, 200, re.text);
  assert.deepEqual([re.body.application.id, re.body.application.status, re.body.application.cvLang], [second.id, "new", "en"], "the same application is re-opened");
  const row = S.db.get("SELECT status, channel, cv_lang, snapshot FROM applications WHERE id = ?", second.id);
  assert.deepEqual([row.status, row.channel, row.cv_lang, JSON.parse(row.snapshot).name], ["new", "whatsapp", "en", "Second Seeker Renamed"], "status, channel, resume language and snapshot are refreshed");
  assert.equal((await A.e.get(`/api/employer/jobs/${A.jobId}/applications`)).body.applications.find(a => a.id === second.id).profile.name, "Second Seeker Renamed", "the employer sees the fresh snapshot");
  assert.equal(count(S, "audit WHERE action = 'application.created' AND entity_id = ?", second.id), 1, "today (U-083): re-applying after a withdrawal writes no audit entry (the one entry is from the first apply)");
  assert.equal(count(S, "applications WHERE job_id = ?", A.jobId), 2, "still one row per seeker");
});

test("export and deletion: seeker A's file holds A's data only, and deleting A erases every row that names A while the application record stays, anonymised", async () => {
  const S = await start(), C = await cast(S), I = C.ids, A = C.seekerA;
  assert.equal((await C.A.e.put(`/api/employer/applications/${I.appA}`, { note: "Private employer note" })).status, 200);
  assert.equal((await A.post(`/api/me/saved/${I.jobA}`)).status, 200);
  assert.equal((await A.post(`/api/me/invitations/${I.invA}/block`)).status, 200, "A blocks the recruiter: a recruiter_blocks row");
  const ex = await A.get("/api/me/export"); assert.equal(ex.status, 200); assert.match(ex.headers.get("content-disposition") || "", /attachment/);
  assert.deepEqual(Object.keys(ex.body).sort(), ["account", "applications", "eventTickets", "exportedAt", "invitations", "jobAlerts", "profile", "savedJobs", "studentVerification", "textMessages"], "every section is on the allow-list");
  assert.equal(ex.body.account.phone, "+963944900001"); assert.equal(ex.body.profile.name, "Seeker Alpha");
  assert.deepEqual([ex.body.applications.length, ex.body.applications[0].company.en, ex.body.applications[0].profileSentToEmployer.name], [1, "Policy Alpha", "Seeker Alpha"]);
  assert.deepEqual([ex.body.invitations.length, ex.body.invitations[0].from.en, ex.body.eventTickets.length, ex.body.eventTickets[0].code, ex.body.jobAlerts.length, ex.body.jobAlerts[0].search.q, ex.body.savedJobs[0].jobId], [1, "Policy Alpha", 1, I.ticketA, 1, "store", I.jobA]);
  noSecrets(ex.text, ["Seeker Beta", "944900002", "Policy Beta", "REG-Policy Alpha", "Contact Policy Alpha", "955900001", "Private employer note", "Policy Recruiter", "955900012"], "seeker A's export");
  assert.ok(!("company" in ex.body) && !("listings" in ex.body), "no employer sections for a seeker");
  const exB = (await C.seekerB.get("/api/me/export")).body;
  assert.deepEqual([exB.applications.length, exB.invitations.length, exB.eventTickets.length, exB.jobAlerts.length, exB.savedJobs.length], [0, 0, 0, 0, 0], "seeker B's export has nothing of A's");
  noSecrets(JSON.stringify(exB), ["Seeker Alpha", "944900001"], "seeker B's export");
  const admin = await C.admin.del("/api/me"); assert.deepEqual([admin.status, admin.body.error], [409, "admin_cannot_delete"]); assert.ok((await C.admin.get("/api/me")).body.user, "the admin is still signed in");
  const uid = I.userA, phone = "+963944900001", alertsBefore = count(S, "alerts"), invBefore = count(S, "invitations"), rsvpBefore = count(S, "event_rsvps");
  const byUser = ["profiles", "saved", "sessions", "notifications", "invitations", "alerts", "student_verifications", "email_codes", "event_rsvps", "recruiter_blocks"];
  for (const t of ["profiles", "saved", "sessions", "notifications", "invitations", "alerts", "event_rsvps", "recruiter_blocks"]) assert.ok(count(S, `${t} WHERE user_id = ?`, uid) > 0, `${t}: A has rows to erase (positive control)`);
  const del = await A.del("/api/me"); assert.equal(del.status, 200, del.text);
  assert.equal((await A.get("/api/me")).body.user, null, "signed out at once");
  for (const t of byUser) assert.equal(count(S, `${t} WHERE user_id = ?`, uid), 0, `${t}: nothing of A's is left`);
  assert.equal(count(S, "otps WHERE phone = ?", phone), 0); assert.equal(count(S, "company_members WHERE phone = ?", phone), 0);
  const app = S.db.get("SELECT status, snapshot, employer_note FROM applications WHERE id = ?", I.appA);
  assert.deepEqual([app.status, app.snapshot, app.employer_note], ["new", '{"deleted":true}', null], "the application stays, anonymised, without the employer's note");
  const u = S.db.get("SELECT phone, deleted_at FROM users WHERE id = ?", uid); assert.match(u.phone, /^deleted:/); assert.ok(u.deleted_at > 0);
  assert.equal(count(S, "audit WHERE action = 'user.deleted' AND entity_id = ?", uid), 1);
  assert.equal(count(S, "users WHERE phone = ?", phone), 0, "the number no longer names an account");
  assert.deepEqual([count(S, "alerts"), count(S, "invitations"), count(S, "event_rsvps")], [alertsBefore - 1, invBefore - 1, rsvpBefore - 1], "only A's rows went");
  assert.equal((await C.seekerB.get("/api/me")).body.profile.name, "Seeker Beta", "seeker B is untouched");
  assert.equal((await C.A.e.get(`/api/employer/jobs/${I.jobA}/applications`)).body.applications.find(a => a.id === I.appA).phone, null, "the employer no longer sees the number");
});

test("job alerts: at most five, no duplicates, and B's alert is 404 not_found to A on PUT (with a body) and DELETE while A's own are editable", async () => {
  const S = await start(), a = await S.login("0944 910 001"), b = await S.login("0944 910 002");
  const mk = async (c, q, channel = "sms") => c.post("/api/me/alerts", { alert: { q }, channel });
  const bAlert = (await mk(b, "beta search", "app")).body.alert; assert.ok(bAlert && bAlert.id, "B has an alert");
  const ids = [];
  for (let i = 1; i <= 5; i++) {
    if (i === 5) { const dup = await mk(a, "search 1"); assert.deepEqual([dup.status, dup.body.error], [409, "alert_exists"]); }   // below the cap a duplicate is refused as such
    const r = await mk(a, `search ${i}`); assert.equal(r.status, 200, r.text); assert.equal(r.body.alert.channel, S.db.get("SELECT channel FROM alerts WHERE id = ?", r.body.alert.id).channel); ids.push(r.body.alert.id);
  }
  const sixth = await mk(a, "search 6"); assert.deepEqual([sixth.status, sixth.body.error], [409, "alert_limit"]);
  const dupAtCap = await mk(a, "search 1"); assert.equal(dupAtCap.body.error, "alert_limit", "today: at the cap the limit answers before the duplicate check");
  assert.equal((await a.get("/api/me/alerts")).body.alerts.length, 5); assert.equal(count(S, "alerts WHERE user_id = (SELECT id FROM users WHERE phone = '+963944910001')"), 5);
  const bRow = () => S.db.get("SELECT data, channel FROM alerts WHERE id = ?", bAlert.id);
  const before = bRow();
  const putB = await a.put(`/api/me/alerts/${bAlert.id}`, { alert: { q: "hijacked" }, channel: "sms" }); assert.deepEqual([putB.status, putB.body.error], [404, "not_found"]);
  const delB = await a.del(`/api/me/alerts/${bAlert.id}`); assert.deepEqual([delB.status, delB.body.error], [404, "not_found"]);
  assert.deepEqual(bRow(), before, "B's alert is exactly as it was");
  const putOwn = await b.put(`/api/me/alerts/${bAlert.id}`, { alert: { q: "renamed" }, channel: "sms" }); assert.equal(putOwn.status, 200, putOwn.text);
  assert.deepEqual([putOwn.body.alert.channel, bRow().channel], ["sms", "sms"], "B changes its own alert's channel (positive control)");
  assert.equal(JSON.parse(bRow().data).q, "beta search", "today: PUT changes the channel only; a new search in the body is ignored");
  assert.equal((await a.del(`/api/me/alerts/${ids[0]}`)).status, 200); const gone = await a.del(`/api/me/alerts/${ids[0]}`); assert.deepEqual([gone.status, gone.body.error], [404, "not_found"], "deleting twice");
  assert.equal((await mk(a, "search 6")).status, 200, "a freed slot can be used again");
  assert.equal((await a.get("/api/me/alerts")).body.alerts.length, 5); assert.equal(count(S, "alerts WHERE user_id = (SELECT id FROM users WHERE phone = '+963944910002')"), 1, "B still has its one alert");
});

test("resume AI without an API key: suggest and translate answer 503 ai_unavailable before anything else and never reach the network", async () => {
  const S = await start(), admin = await S.login(ADMIN_PHONE);
  const A = await employerWithLiveJob(S, admin, "0955 910 001", "Resume Alpha");
  const s = await seekerWithProfile(S, "0944 910 001"), bare = await S.login("0944 910 002");
  assert.equal((await S.client().get("/api/config")).body.ai, false, "the client is told the helper is off");
  const realFetch = globalThis.fetch; let outbound = 0;
  globalThis.fetch = async (url, opts) => { if (/anthropic/.test(String(url))) { outbound++; throw new Error("network reached"); } return realFetch(url, opts); };
  try {
    const items = [{ role: "Cashier", text: "Handled cash for 200 customers a week" }];
    for (const [who, c, path, body] of [["seeker", s, "/api/resume/suggest", { jobId: A.jobId, items }], ["seeker", s, "/api/resume/translate", { to: "en" }], ["seeker", s, "/api/resume/translate", { to: "ar" }],
      ["seeker without a profile", bare, "/api/resume/suggest", { jobId: A.jobId, items }], ["seeker without a profile", bare, "/api/resume/translate", { to: "en" }], ["seeker", s, "/api/resume/suggest", { jobId: 999999, items }]]) {
      const r = await c.post(path, body); assert.deepEqual([r.status, r.body.error], [503, "ai_unavailable"], `${who} ${path} → ${r.status} ${r.text.slice(0, 80)}`);   // today: the key check comes before the job and profile checks
    }
    const lang = await s.post("/api/resume/translate", { to: "fr" }); assert.deepEqual([lang.status, lang.body.error], [422, "bad_lang"], "the language check still comes first");
  } finally { globalThis.fetch = realFetch; }
  assert.equal(outbound, 0, "no request left the server");
});

test("language: PUT /api/me/lang stores ar or en and nothing else", async () => {
  const S = await start(), s = await S.login("0944 910 001");
  const stored = () => S.db.get("SELECT lang FROM users WHERE phone = '+963944910001'").lang;
  for (const lang of ["en", "ar", "en"]) { const r = await s.put("/api/me/lang", { lang }); assert.deepEqual([r.status, r.body.lang, stored(), (await s.get("/api/me")).body.user.lang], [200, lang, lang, lang]); }
  for (const lang of ["fr", "EN", "ar-SY", "", 1, null, undefined]) { const r = await s.put("/api/me/lang", { lang }); assert.deepEqual([r.status, r.body.lang, stored()], [200, "ar", "ar"], `today: ${JSON.stringify(lang)} falls back to Arabic rather than 422`); }
  assert.equal((await s.put("/api/me/lang", "{not json")).status, 400, "malformed JSON is refused");
});
