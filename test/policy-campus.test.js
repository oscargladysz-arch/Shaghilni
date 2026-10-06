/* Route policy, part 5 (campus): a career office sees names only for students verified at its own university, the
   student-verification codes and locks hold, withdrawing or changing university drops the badge everywhere, domains and
   partnerships stay with the office's own university, and an office account carries no profile. Every refusal is paired
   with the allowed actor succeeding on the same resource, so no 403/404/422 here is vacuous. The code is read from the
   development echo (OTP_DEV_ECHO) instead of a mail stub: it goes through the same send, lock and confirm code paths. */
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { start, cast, closeAll, PROFILE, EV } from "./policy/harness.js";

after(closeAll);

const ECHO = { env: { OTP_DEV_ECHO: "true" } };
const at = (uni, name, fac = "business") => ({ ...PROFILE, name, recruit: { open: true }, edu: { status: "bachelor", uni, fac, year: 4, grad: 2026 } });   // the profile document carries the recruiter consent (server/validate.js:59)
// Ask for the code and confirm it in one go; returns the confirm response (or the refused send).
const verify = async (st, email) => { const r = await st.post("/api/me/verify-student", { email }); if (r.status !== 200) return r; assert.match(String(r.body.devCode), /^\d{6}$/, "the echoed code"); return st.post("/api/me/verify-student/confirm", { code: r.body.devCode }); };
const studentKeys = ["applications", "fac", "hired", "id", "interviews", "name", "status", "verifiedAt", "year"];

test("policy campus: an office lists only students verified at its own university, without phone or email, and withdrawal or a change of university drops the badge everywhere", async () => {
  const S = await start(ECHO), C = await cast(S), I = C.ids;
  assert.equal((await C.officeB.post("/api/campus/domains", { domain: "policy-damascus.example" })).status, 200, "office B lists its own domain");
  const a0 = (await C.officeA.get("/api/campus")).body, b0 = (await C.officeB.get("/api/campus")).body;
  assert.equal((await C.seekerA.put("/api/me/profile", { profile: at("homs", "Seeker Alpha") })).status, 200);
  assert.equal((await C.seekerB.put("/api/me/profile", { profile: at("damascus", "Seeker Beta") })).status, 200);
  const a1 = (await C.officeA.get("/api/campus")).body, b1 = (await C.officeB.get("/api/campus")).body;
  // (6) totals: each office's student count moves only with its own university's profiles
  assert.equal(a1.stats.students - a0.stats.students, 1, "office A counts seeker A (homs) and not seeker B (damascus)");
  assert.equal(b1.stats.students - b0.stats.students, 1, "office B counts seeker B and not seeker A");
  assert.equal(a1.stats.applying - a0.stats.applying, 1, "seeker A's application to A's job counts for homs only"); assert.equal(b1.stats.applying, b0.stats.applying);
  assert.deepEqual([a1.students, b1.students], [[], []], "no names before anyone verifies");
  // (1) seeker A verifies at homs: office A lists them, office B does not, and the record carries no contact details
  const ok = await verify(C.seekerA, "Seeker.A@policy-homs.example"); assert.equal(ok.status, 200, ok.text); assert.equal(ok.body.verification.status, "verified");
  const a2 = (await C.officeA.get("/api/campus")).body, b2 = (await C.officeB.get("/api/campus")).body;
  const rec = a2.students.find(s => s.id === I.userA); assert.ok(rec, "office A lists seeker A");
  assert.deepEqual(Object.keys(rec).sort(), studentKeys, "name, faculty, year and counts only: never the phone or the email");
  assert.deepEqual([rec.name.en, rec.fac, rec.year, rec.status, rec.applications, rec.interviews, rec.hired], ["Seeker Alpha", "business", 4, "bachelor", 1, 0, []]);
  assert.ok(!/944900001|seeker\.a@/i.test(JSON.stringify(a2)), "the whole office page holds neither seeker A's number nor the address");
  assert.ok(!b2.students.some(s => s.id === I.userA), "office B (damascus) does not list a homs student");
  assert.equal(a2.stats.verified - a1.stats.verified, 1); assert.equal(b2.stats.verified, b1.stats.verified, "office B's verified total does not move");
  const card = async () => ((await C.A.e.get("/api/employer/students?verified=1")).body.students.find(s => s.id === I.cardA) || {}).verifiedUni || "";
  assert.equal(await card(), "homs", "the badge is on the candidate card");
  assert.equal((await C.seekerA.get("/api/me")).body.studentVerify.status, "verified");
  // (3) DELETE removes the badge from the card and from office A's list
  assert.equal((await C.seekerA.del("/api/me/verify-student")).status, 200);
  assert.equal((await C.seekerA.get("/api/me")).body.studentVerify.status, "none");
  assert.equal(await card(), "", "no badge on the card after withdrawal");
  const a3 = (await C.officeA.get("/api/campus")).body; assert.ok(!a3.students.some(s => s.id === I.userA), "office A no longer lists seeker A"); assert.equal(a3.stats.verified, a1.stats.verified);
  // verifying again works (the address is free again), then changing university removes it too
  const again = await verify(C.seekerA, "seeker.a@policy-homs.example"); assert.equal(again.status, 200, again.text); assert.equal(await card(), "homs");
  assert.equal((await C.seekerA.put("/api/me/profile", { profile: at("damascus", "Seeker Alpha") })).status, 200);
  assert.equal((await C.seekerA.get("/api/me")).body.studentVerify.status, "none", "the badge belongs to the profile's university");
  assert.equal(await card(), "", "no badge on the card after moving university");
  assert.ok(!(await C.officeA.get("/api/campus")).body.students.some(s => s.id === I.userA), "and office A no longer lists them");
  assert.ok(!(await C.officeB.get("/api/campus")).body.students.some(s => s.id === I.userA), "nor does office B: a homs verification never carries to damascus");
});

test("policy campus: verify-student refuses another university's domain, public webmail and an address already verified, and five wrong codes lock", async () => {
  const S = await start(ECHO), admin = await S.login("+12025550199");
  for (const [uni, domain] of [["homs", "policy-homs.example"], ["damascus", "policy-damascus.example"]]) assert.equal((await admin.post("/api/admin/campus/domains", { uni, domain })).status, 200);
  const sA = await S.login("0944 910 001"), sB = await S.login("0944 910 002"), sC = await S.login("0944 910 003");
  for (const [s, n] of [[sA, "Student One"], [sB, "Student Two"], [sC, "Student Three"]]) assert.equal((await s.put("/api/me/profile", { profile: at("homs", n) })).status, 200);
  const send = (s, email) => s.post("/api/me/verify-student", { email });
  // (2) the exact refusal codes
  let r = await send(sA, "one@policy-damascus.example"); assert.equal(r.status, 422); assert.equal(r.body.error, "email_other_uni"); assert.deepEqual(r.body.detail, { domains: ["policy-homs.example"] }, "the refusal names the right domains");
  r = await send(sA, "one@gmail.com"); assert.equal(r.status, 422); assert.equal(r.body.error, "email_wrong_domain");
  r = await send(sA, "one@policy-homs.example.evil"); assert.equal(r.status, 422); assert.equal(r.body.error, "email_wrong_domain", "a look-alike domain is not a subdomain");
  r = await send(sA, "not-an-address"); assert.equal(r.status, 422); assert.equal(r.body.error, "bad_email");
  r = await send(S.client(), "one@policy-homs.example"); assert.equal(r.status, 401, "a guest has no verification to ask for");
  assert.equal(S.db.get("SELECT COUNT(*) AS n FROM email_codes").n, 0, "no code was issued by any refusal");
  // positive control: the right domain verifies
  const ok = await verify(sA, "One@Policy-Homs.example"); assert.equal(ok.status, 200, ok.text); assert.equal(ok.body.verification.status, "verified");
  r = await send(sA, "one@policy-homs.example"); assert.equal(r.status, 409); assert.equal(r.body.error, "already_verified");
  // a second account with the same address: asking for a code answers exactly as for a free address, so nobody learns whether an address has an account (U-037); the confirmation refuses it
  r = await send(sB, "one@policy-homs.example"); assert.equal(r.status, 200, `asking never reveals that the address is taken (U-037): ${r.text}`); assert.equal(r.body.verification.status, "code_sent");
  assert.equal(S.db.get("SELECT COUNT(*) AS n FROM email_sends WHERE user_id = (SELECT id FROM users WHERE phone = '+963944910002')").n, 1, "and it spends one of the day's five sends, like any other");
  r = await sB.post("/api/me/verify-student/confirm", { code: r.body.devCode }); assert.equal(r.status, 409); assert.equal(r.body.error, "email_taken", "the right code for a taken address is refused at the confirmation");
  r = await send(sB, "two@policy-homs.example"); assert.equal(r.status, 200, "a free address is sent a code");
  S.db.run("UPDATE email_codes SET email = 'one@policy-homs.example' WHERE user_id = (SELECT id FROM users WHERE phone = '+963944910002')");   // the address was claimed between sending and confirming
  r = await sB.post("/api/me/verify-student/confirm", { code: r.body.devCode }); assert.equal(r.status, 409); assert.equal(r.body.error, "email_taken");
  assert.equal(S.db.get("SELECT COUNT(*) AS n FROM student_verifications WHERE email = 'one@policy-homs.example' AND status = 'verified'").n, 1, "still one account per address");
  // five wrong codes lock; the right code no longer opens; a fresh send starts over
  r = await send(sC, "three@policy-homs.example"); assert.equal(r.status, 200); const code = r.body.devCode, wrong = code === "000000" ? "111111" : "000000";
  for (let i = 0; i < 5; i++) { r = await sC.post("/api/me/verify-student/confirm", { code: wrong }); assert.equal(r.status, 422); assert.equal(r.body.error, "bad_code"); }
  r = await sC.post("/api/me/verify-student/confirm", { code }); assert.equal(r.status, 429); assert.equal(r.body.error, "code_locked", "the right code is refused once locked");
  assert.equal((await sC.get("/api/me")).body.studentVerify.status, "code_sent", "locked is not verified");
  r = await send(sC, "three@policy-homs.example"); assert.equal(r.status, 200, "asking again issues a fresh code");
  r = await sC.post("/api/me/verify-student/confirm", { code: r.body.devCode }); assert.equal(r.status, 200, r.text); assert.equal(r.body.verification.status, "verified");
  // withdrawing a pending code leaves nothing to confirm
  r = await send(sB, "two@policy-homs.example"); assert.equal(r.status, 200); const pending = r.body.devCode;
  assert.equal((await sB.del("/api/me/verify-student")).status, 200);
  r = await sB.post("/api/me/verify-student/confirm", { code: pending }); assert.equal(r.status, 410); assert.equal(r.body.error, "code_expired");
});

test("policy campus: domains and partnerships stay with the office's own university; the admin can drop a domain an office added", async () => {
  const S = await start(ECHO), C = await cast(S), I = C.ids;
  // (4) office A cannot add a domain for damascus: the uni in the body is ignored and the domain lands under homs (policy note "own university only")
  const spoof = await C.officeA.post("/api/campus/domains", { domain: "policy-spoof.example", uni: "damascus" });
  assert.equal(spoof.status, 200); assert.deepEqual(spoof.body.domains, [I.domainA, "policy-spoof.example"], "the answer lists homs's domains");
  assert.equal(S.db.get("SELECT uni FROM uni_domains WHERE domain = 'policy-spoof.example'").uni, "homs", "the domain belongs to office A's own university, whatever the body said");
  assert.ok(!(await C.officeB.get("/api/campus")).body.domains.includes("policy-spoof.example"), "office B never sees it");
  const mine = await C.officeB.post("/api/campus/domains", { domain: "policy-damascus.example" }); assert.equal(mine.status, 200); assert.deepEqual(mine.body.domains, ["policy-damascus.example"], "office B adds its own");
  const dup = await C.officeA.post("/api/campus/domains", { domain: "policy-damascus.example" }); assert.equal(dup.status, 409); assert.equal(dup.body.error, "domain_taken", "one domain stands for one university");
  // office A cannot drop damascus's domain, office B can
  let r = await C.officeA.del("/api/campus/domains/policy-damascus.example"); assert.equal(r.status, 404); assert.equal(r.body.error, "not_found");
  assert.equal(S.db.get("SELECT COUNT(*) AS n FROM uni_domains WHERE domain = 'policy-damascus.example'").n, 1, "still there");
  r = await C.officeB.del("/api/campus/domains/policy-damascus.example"); assert.equal(r.status, 200); assert.deepEqual(r.body.domains, []);
  // the admin's DELETE /api/admin/campus/domains/:uni/:domain for a domain the office added works, and the office's list reflects it; the wrong university is a 404
  r = await C.admin.del(`/api/admin/campus/domains/damascus/${I.domainA}`); assert.equal(r.status, 404); assert.equal(r.body.error, "not_found", "the pair must match");
  assert.ok((await C.officeA.get("/api/campus")).body.domains.includes(I.domainA), "office A still lists its domain");
  r = await C.admin.del(`/api/admin/campus/domains/homs/${I.domainA}`); assert.equal(r.status, 200); assert.deepEqual(r.body.domains, ["policy-spoof.example"]);
  assert.deepEqual((await C.officeA.get("/api/campus")).body.domains, ["policy-spoof.example"], "office A's list reflects the admin's removal");
  assert.equal(S.db.get("SELECT COUNT(*) AS n FROM audit WHERE action = 'campus.domain_removed'").n, 2, "both removals are in the audit log");
  assert.equal((await C.officeA.del(`/api/campus/domains/${I.domainA}`)).status, 404, "nothing left to remove");
  // (4) partnerships: B asks damascus; office A neither sees nor decides it, office B does
  assert.equal((await C.B.e.post("/api/employer/partners", { uni: "damascus" })).body.status, "requested");
  assert.ok(!(await C.officeA.get("/api/campus")).body.partners.some(p => p.companyId === I.companyB), "office A does not see a request made to damascus");
  const pa = (await C.officeB.get("/api/campus")).body.partners.find(p => p.companyId === I.companyB); assert.ok(pa && pa.status === "requested", "office B sees it");
  r = await C.officeA.post(`/api/campus/partners/${I.companyB}`, { decision: "yes" }); assert.equal(r.status, 404); assert.equal(r.body.error, "not_found");
  assert.equal(S.db.get("SELECT status FROM uni_partners WHERE company_id = ? AND uni = 'damascus'", I.companyB).status, "requested", "untouched");
  r = await C.officeB.post(`/api/campus/partners/${I.companyB}`, { decision: "no" }); assert.equal(r.status, 200);
  assert.deepEqual((await C.B.e.get("/api/employer")).body.partners, [{ uni: "damascus", status: "declined" }], "office B decided it");
  assert.deepEqual((await C.A.e.get("/api/employer")).body.partners, [{ uni: "homs", status: "requested" }], "A's request to homs is untouched by any of this");
});

test("policy campus: an office account is a career office and nothing else: /api/me shows the office and no profile", async () => {
  const S = await start(), admin = await S.login("+12025550199");
  const add = await admin.post("/api/admin/campus", { phone: "0944 910 301", uni: "homs", faculty: "business", name: "Policy Office Business" }); assert.equal(add.status, 200, add.text);
  const office = await S.login("0944 910 301"), me = (await office.get("/api/me")).body;
  assert.equal(me.user.role, "university"); assert.deepEqual(me.campusOffice, { uni: "homs", faculty: "business", name: "Policy Office Business" });
  assert.deepEqual(Object.keys(me).sort(), ["campusOffice", "user"], "no profile, applications, saved jobs, invitations or alerts on an office account");
  assert.deepEqual(Object.keys(me.user).sort(), ["id", "lang", "phone", "role", "termsVersion"]); assert.equal(me.user.phone, "+963944910301", "its own number only");
  // (5) a seeker's /api/me carries a profile and studentVerify, an office's never does
  const st = await S.login("0944 910 101"); assert.equal((await st.put("/api/me/profile", { profile: at("homs", "Student Five") })).status, 200);
  const sme = (await st.get("/api/me")).body; assert.equal(sme.profile.name, "Student Five"); assert.equal(sme.studentVerify.status, "none"); assert.equal(sme.campusOffice, null);
  assert.equal((await office.put("/api/me/profile", { profile: at("homs", "Office As Student") })).status, 403, "an office cannot write a seeker profile");
  assert.equal((await office.post("/api/me/verify-student", { email: "x@policy-homs.example" })).status, 403, "nor ask for a student code");
  assert.equal(S.db.get("SELECT COUNT(*) AS n FROM profiles WHERE user_id = ?", me.user.id).n, 0, "no profile row was created for the office");
  // the faculty-scoped office counts only its faculty
  const other = await S.login("0944 910 102"); assert.equal((await other.put("/api/me/profile", { profile: at("homs", "Student Six", "engineering") })).status, 200);
  const page = (await office.get("/api/campus")).body; assert.equal(page.office.faculty, "business");
  const n = S.db.get("SELECT COUNT(*) AS n FROM profiles p JOIN users u ON u.id = p.user_id WHERE u.deleted_at IS NULL AND json_extract(p.data, '$.edu.uni') = 'homs' AND json_extract(p.data, '$.edu.fac') = 'business'").n;
  assert.equal(page.stats.students, n, "the faculty office's total is its faculty's students only");
  assert.ok(n < S.db.get("SELECT COUNT(*) AS n FROM profiles p WHERE json_extract(p.data, '$.edu.uni') = 'homs'").n, "which is fewer than the university's");
});

test("policy campus: university, faculty and governorate ids are the tables' own string keys; a list or a prototype name is refused, and nothing answers 500 (U-038)", async () => {
  const S = await start(ECHO), C = await cast(S), I = C.ids;
  // (1) a seeker types a list for the university and faculty: stored as none, and the screens that read it keep answering
  assert.equal((await C.seekerB.put("/api/me/profile", { profile: at(["damascus"], "Seeker Beta", ["business"]) })).status, 200);
  const edu = JSON.parse(S.db.get("SELECT data FROM profiles WHERE user_id = ?", I.userB).data).edu;
  assert.deepEqual([typeof edu.uni, typeof edu.fac], ["string", "string"], "a list is never stored as a university or faculty");
  assert.equal((await C.seekerB.post(`/api/jobs/${I.jobA}/apply`, {})).status, 200, "seeker B applies to A's job");
  for (const [who, path] of [[C.seekerB, "/api/me"], [C.A.e, "/api/employer/students"], [C.A.e, `/api/employer/jobs/${I.jobA}/applications`], [C.recruiter, "/api/employer/students"]]) {
    const r = await who.get(path); assert.equal(r.status, 200, `${path}: ${r.text}`);
  }
  // a snapshot stored before this fix (a list frozen at apply time) no longer breaks the applicant list or the search
  const bad = JSON.stringify({ ...at("damascus", "Seeker Beta"), edu: { status: "bachelor", uni: ["damascus"], fac: "business" } });
  S.db.run("UPDATE applications SET snapshot = ? WHERE job_id = ? AND user_id = ?", bad, I.jobA, I.userB); S.db.run("UPDATE profiles SET data = ? WHERE user_id = ?", bad, I.userB);
  for (const [who, path] of [[C.A.e, `/api/employer/jobs/${I.jobA}/applications`], [C.A.e, "/api/employer/students"], [C.seekerB, "/api/me"]]) {
    const r = await who.get(path); assert.equal(r.status, 200, `stored list, ${path}: ${r.text}`);
  }
  // (2) an employer asking for a partnership: a prototype name or a list is no university
  const before = S.db.all("SELECT uni FROM uni_partners WHERE company_id = ? ORDER BY uni", I.companyA);
  for (const uni of ["constructor", "__proto__", ["homs"], ["damascus"]]) {
    const r = await C.A.e.post("/api/employer/partners", { uni }); assert.deepEqual([r.status, r.body.error], [422, "uni_required"], `partners uni ${JSON.stringify(uni)}`);
  }
  assert.deepEqual(S.db.all("SELECT uni FROM uni_partners WHERE company_id = ? ORDER BY uni", I.companyA), before, "no partnership row added");
  // (3) the admin adding a career office: refused before any account is made; a junk faculty is stored as none
  for (const [n, uni] of [["391", "toString"], ["392", ["damascus"]]]) {
    const r = await C.admin.post("/api/admin/campus", { phone: `0944 900 ${n}`, uni, name: "U-038 office" });
    assert.deepEqual([r.status, r.body.error], [422, "uni_required"], `office uni ${JSON.stringify(uni)}`);
    assert.equal(S.db.get("SELECT COUNT(*) AS n FROM users WHERE phone = ?", `+963944900${n}`).n, 0, "no account left behind");
  }
  for (const [n, faculty] of [["393", "valueOf"], ["394", ["informatics"]]]) {
    const r = await C.admin.post("/api/admin/campus", { phone: `0944 900 ${n}`, uni: "damascus", faculty, name: "U-038 office" }); assert.equal(r.status, 200, r.text);
    assert.equal(S.db.get("SELECT o.faculty FROM campus_offices o JOIN users u ON u.id = o.user_id WHERE u.phone = ?", `+963944900${n}`).faculty, "", `faculty ${JSON.stringify(faculty)} stored as none`);
  }
  // (4) the admin adding an email domain for a university
  for (const uni of ["constructor", ["homs"]]) {
    const r = await C.admin.post("/api/admin/campus/domains", { uni, domain: "u038.example" }); assert.deepEqual([r.status, r.body.error], [422, "uni_required"], `domain uni ${JSON.stringify(uni)}`);
  }
  assert.equal(S.db.get("SELECT COUNT(*) AS n FROM uni_domains WHERE domain = 'u038.example'").n, 0);
  // (4b) languages, job types and fields keep only the tables' own keys too (fix review 2)
  assert.equal((await C.seekerA.put("/api/me/profile", { profile: { ...PROFILE, langs: ["ar", "constructor", ["en"], "__proto__"], prefs: { types: ["full", "toString", ["intern"]], fields: ["constructor"] } } })).status, 200);
  const pr = JSON.parse(S.db.get("SELECT data FROM profiles WHERE user_id = ?", I.userA).data);
  assert.deepEqual([pr.langs, pr.prefs.types, pr.prefs.fields], [["ar"], ["full"], []], "profile lookups");
  const jr = await C.A.e.post("/api/employer/jobs", { job: { title: { en: "Lookup clerk" }, gov: "aleppo", type: "full", level: "entry", pay: [1, 2], langs: ["ar", "constructor", ["en"]], summary: { en: "Keep records." } } });
  assert.deepEqual(JSON.parse(S.db.get("SELECT data FROM jobs WHERE id = ?", jr.body.job.id).data).langs, ["ar"], "listing languages");
  // (5) an event: the university and governorate are none, never a prototype name or a list
  for (const over of [{ uni: "hasOwnProperty", gov: "constructor" }, { uni: ["damascus"], gov: ["aleppo"] }]) {
    const r = await C.admin.post("/api/organize/events", { event: EV(over) }); assert.equal(r.status, 200, r.text);
    const row = S.db.get("SELECT uni, data FROM events WHERE id = ?", r.body.event.id);
    assert.deepEqual([row.uni, JSON.parse(row.data).gov], ["", ""], `event ${JSON.stringify(over)}`);
  }
});
