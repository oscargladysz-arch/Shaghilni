/* Universities: career offices, verified students, employer partners and internship programmes. */
import { test, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { loadConfig } from "../server/config.js";
import { openDb } from "../server/db.js";
import { createApp } from "../server/app.js";
import { seedDemo } from "../server/seed.js";
import * as coreMod from "../server/core.js";

const servers = [];
after(() => { for (const s of servers) s.close(); });
async function start(env = {}, extra = {}) {
  const cfg = loadConfig({ skipDotEnv: true, isolated: true, env: { NODE_ENV: "test", ADMIN_PHONES: "+12025550199", ...env }, values: { powBits: 0, anthropicKey: "" } });
  const db = openDb(":memory:"), texts = [];
  seedDemo(db, () => {});
  const app = createApp({ cfg, db, log: () => {}, sms: async (to, body) => { texts.push({ to, body }); }, ...extra }), server = http.createServer(app);
  await new Promise(r => server.listen(0, "127.0.0.1", r)); servers.push(server);
  const base = `http://127.0.0.1:${server.address().port}`;
  const lastCode = phone => { const t = [...texts].reverse().find(x => x.to === phone); return t && /(\d{6})/.exec(t.body)[1]; };
  const client = () => {
    let cookie = "";
    const call = async (method, path, body) => {
      const res = await fetch(base + path, { method, headers: { "content-type": "application/json", "x-shaghilni": "1", ...(cookie ? { cookie } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
      const sc = res.headers.get("set-cookie"); if (sc) cookie = sc.split(";")[0];
      const text = await res.text(); let json = null; try { json = JSON.parse(text); } catch {}
      return { status: res.status, body: json, text };
    };
    return { get: p => call("GET", p), post: (p, b = {}) => call("POST", p, b), put: (p, b) => call("PUT", p, b), del: p => call("DELETE", p) };
  };
  const login = async (phone, role = "seeker") => {
    const c = client(); const r = await c.post("/api/auth/code", { phone });
    assert.equal((await c.post("/api/auth/verify", { phone, code: lastCode(r.body.phone), role, accept: true })).status, 200);
    return c;
  };
  const core = typeof coreMod.loadCore === "function" ? coreMod.loadCore() : coreMod.core || coreMod.default;
  return { db, texts, client, login, app, core };
}
async function publish(S, admin, e, over = {}) {
  const job = (await e.post("/api/employer/jobs", { job: { ...JOB, ...over }, submit: true })).body.job;
  await admin.post(`/api/admin/jobs/${job.id}/approve`); return job.id;
}
const STUDENT = { v: 1, role: "seeker", name: "Omar Nabil Al-Khatib", email: "omar@example.com", gov: "homs", langs: ["ar", "en"],
  edu: { status: "student", uni: "homs", fac: "petroleum", year: 4, grad: 2027 },
  exp: [{ id: "e1", role: "Field intern", org: "Orontes Energy", start: "2025-06", end: "2025-09", bullets: ["Logged pressure readings at 12 wells every day"] }],
  acts: [], skills: ["Excel", "AutoCAD"], certs: [] };
const GRAD = { ...STUDENT, name: "Lina Haddad", email: "lina@example.com", edu: { status: "bachelor", uni: "damascus", fac: "business", year: 0, grad: 2023 } };
const JOB = { title: { en: "Field trainee" }, gov: "homs", type: "intern", level: "entry", pay: [1500000, 2000000], langs: ["ar"], summary: { en: "Train with our field team." } };
const inDays = n => new Date(Date.now() + n * 86400e3).toISOString().slice(0, 10);
async function employer(S, admin, phone, name, verify = true) {
  const e = await S.login(phone, "employer");
  await e.put("/api/employer/company", { company: { name: { en: name }, gov: "homs", regNo: `REG-${name}`, contactName: `Contact ${name}`, whatsapp: phone } });
  await e.post("/api/employer/company/submit");
  if (!verify) return { e };
  const co = (await admin.get("/api/admin/companies?status=pending")).body.companies.find(c => c.name.en === name);
  await admin.post(`/api/admin/companies/${co.id}/verify`, { screened: true });
  const job = (await e.post("/api/employer/jobs", { job: JOB, submit: true })).body.job;
  await admin.post(`/api/admin/jobs/${job.id}/approve`);
  return { e, jobId: job.id };
}


const profileAt = (uni, fac = "petroleum", status = "student") => ({ ...GRAD, gov: "homs", edu: { ...(GRAD.edu || {}), status, uni, fac, year: 3, grad: 2027 } });

// A pretend email service that keeps what it sends, so tests read the code from the email itself.
const mailbox = []; const EMAIL = { email: async (to, subject, text) => { mailbox.push({ to, subject, text }); } };
const codeFor = to => { const m = [...mailbox].reverse().find(x => x.to === to); return m ? (m.text.match(/\b(\d{6})\b/) || [])[1] : null; };
const verifyByEmail = async (st, email) => { const r = await st.post("/api/me/verify-student", { email }); if (r.status !== 200) return r; return st.post("/api/me/verify-student/confirm", { code: codeFor(email.toLowerCase()) }); };

test("universities: students verify themselves with their university email, and offices see names only for verified students", async () => {
  const S = await start({}, EMAIL), admin = await S.login("+12025550199");
  await admin.post("/api/admin/campus", { phone: "0944 780 001", uni: "homs", name: "Homs University Career Office" }); const office = await S.login("0944 780 001");
  const a = await S.login("0933 780 101"); await a.put("/api/me/profile", { profile: profileAt("homs") });
  const b = await S.login("0933 780 102"); await b.put("/api/me/profile", { profile: profileAt("homs", "business") });
  const other = await S.login("0933 780 103"); await other.put("/api/me/profile", { profile: profileAt("damascus") });
  assert.equal((await a.post("/api/me/verify-student", { email: "omar@student.hu.example" })).body.error, "uni_no_email", "a university without a domain can't verify by email yet");
  assert.equal((await office.post("/api/campus/domains", { domain: "gmail.com" })).body.error, "bad_domain", "public webmail can never stand for a university");
  assert.equal((await office.post("/api/campus/domains", { domain: "@HU.example" })).body.domains[0], "hu.example", "offices add their students' domain");
  await admin.post("/api/admin/campus/domains", { uni: "damascus", domain: "damascus-university.example" });
  assert.equal((await office.post("/api/campus/domains", { domain: "damascus-university.example" })).body.error, "domain_taken");
  assert.equal((await a.post("/api/me/verify-student", { email: "omar@gmail.com" })).body.error, "email_wrong_domain");
  assert.equal((await a.post("/api/me/verify-student", { email: "omar@damascus-university.example" })).body.error, "email_other_uni");
  const sent = await a.post("/api/me/verify-student", { email: "Omar.K@student.hu.example" });
  assert.equal(sent.status, 200, "a subdomain of the university's domain counts"); assert.equal(sent.body.verification.status, "code_sent");
  const code = codeFor("omar.k@student.hu.example"); assert.match(code, /^\d{6}$/, "the code arrives by email"); assert.equal(sent.body.devCode, undefined, "and never in the response outside development");
  for (let i = 0; i < 5; i++) assert.equal((await a.post("/api/me/verify-student/confirm", { code: code === "000000" ? "111111" : "000000" })).body.error, "bad_code");
  assert.equal((await a.post("/api/me/verify-student/confirm", { code })).body.error, "code_locked", "five wrong tries lock the code");
  const ok = await verifyByEmail(a, "omar.k@student.hu.example"); assert.equal(ok.body.verification.status, "verified");
  assert.match(ok.body.verification.email, /^om.+@student\.hu\.example$/, "the address is shown masked");
  assert.equal((await verifyByEmail(b, "omar.k@student.hu.example")).body.error, "email_taken", "one address verifies one account");
  const D = (await office.get("/api/campus")).body;
  assert.equal(D.stats.students, 2); assert.equal(D.stats.verified, 1); assert.equal(D.students.length, 1, "names only for verified students"); assert.equal(D.students[0].name.en, GRAD.name);
  assert.equal(D.requests, undefined, "no manual approvals any more"); assert.deepEqual(D.domains, ["hu.example"]);
  await a.put("/api/me/profile", { profile: profileAt("damascus") }); assert.equal((await a.get("/api/me")).body.studentVerify.status, "none", "changing university ends the badge");
  await a.put("/api/me/profile", { profile: profileAt("homs") });
  assert.equal((await a.get("/api/campus")).status, 403); assert.equal((await office.get("/api/employer")).status, 403);
  await a.del("/api/me"); assert.equal(S.db.get("SELECT COUNT(*) AS n FROM student_verifications WHERE email = 'omar.k@student.hu.example'").n, 0, "deleting the account deletes the verification");
  for (let i = 0; i < 3; i++) await b.post("/api/me/verify-student", { email: `b${i}@hu.example` });   // b already spent one send on the taken address above, which counts since U-037
  assert.equal((await b.post("/api/me/verify-student", { email: "b9@hu.example" })).status, 200);
  assert.equal((await b.post("/api/me/verify-student", { email: "b10@hu.example" })).body.error, "too_many_emails", "at most five code emails a day");
});

test("universities: without an email service, sending refuses clearly rather than failing silently", async () => {
  const S = await start(), admin = await S.login("+12025550199");
  await admin.post("/api/admin/campus/domains", { uni: "homs", domain: "hu.example" });
  const a = await S.login("0933 781 201"); await a.put("/api/me/profile", { profile: profileAt("homs") });
  assert.equal((await a.post("/api/me/verify-student", { email: "x@hu.example" })).body.error, "email_unavailable");
});

test("universities: employers see verified students, partner with universities and aim internship programmes at them", async () => {
  const S = await start({}, EMAIL), admin = await S.login("+12025550199"), { e } = await employer(S, admin, "0955 781 001", "Qasioun Advisory");
  await admin.post("/api/admin/campus", { phone: "0944 781 001", uni: "homs" }); const office = await S.login("0944 781 001");
  const st = await S.login("0933 781 101"); await st.put("/api/me/profile", { profile: profileAt("homs") }); await st.put("/api/me/recruit", { open: true });
  const other = await S.login("0933 781 102"); await other.put("/api/me/profile", { profile: profileAt("homs") }); await other.put("/api/me/recruit", { open: true });
  await office.post("/api/campus/domains", { domain: "hu.example" });
  assert.equal((await verifyByEmail(st, "student@hu.example")).body.verification.status, "verified");
  const all = (await e.get("/api/employer/students")).body.students, only = (await e.get("/api/employer/students?verified=1")).body.students;
  assert.equal(all.filter(x => x.verifiedUni === "homs").length, 1, "the badge is on the verified student's card"); assert.equal(only.length, 1, "and the filter shows only verified students");
  assert.equal((await e.post("/api/employer/partners", { uni: "homs" })).body.status, "requested");
  const P = (await office.get("/api/campus")).body.partners; assert.equal(P.length, 1); assert.equal(P[0].status, "requested");
  await office.post(`/api/campus/partners/${P[0].companyId}`, { decision: "yes" });
  assert.deepEqual((await e.get("/api/employer")).body.partners, [{ uni: "homs", status: "approved" }]);
  const job = (await e.post("/api/employer/jobs", { job: { ...JOB, type: "intern", unis: ["homs", "nowhere"], progStart: "2027-06", progEnd: "2027-08" }, submit: true })).body.job;
  await admin.post(`/api/admin/jobs/${job.id}/approve`);
  const pub = (await S.client().get("/api/jobs")).body.jobs.find(j => j.id === job.id);
  assert.deepEqual([pub.unis, pub.progStart, pub.progEnd, pub.partnerUnis], [["homs"], "2027-06", "2027-08", ["homs"]], "unknown universities are dropped, and the partner badge shows");
  await st.post(`/api/jobs/${job.id}/apply`, { channel: "web", cvLang: "ar" });
  const I = (await office.get("/api/campus")).body.internships.find(x => x.id === job.id); assert.equal(I.applicants, 1, "the office sees how many of its students applied");
  const apps = (await e.get(`/api/employer/jobs/${job.id}/applications`)).body.applications; assert.equal(apps[0].verifiedUni, "homs", "the badge is on the application too");
  assert.equal(pub.type, "intern", "the listing is an internship");
  for (const st2 of ["shortlisted", "interview", "hired"]) await e.put(`/api/employer/applications/${apps[0].id}`, { status: st2 });
  await admin.post(`/api/admin/applications/${apps[0].id}/confirm-hire`, {});
  const T = (await office.get("/api/campus")).body.stats; assert.deepEqual([T.internsHired, T.hires, T.employers], [1, 1, 1], "a confirmed intern hire is counted");
});

test("universities: a verification code typed with Arabic-Indic digits is accepted (U-034)", async () => {
  const S = await start({}, EMAIL), admin = await S.login("+12025550199");
  await admin.post("/api/admin/campus/domains", { uni: "homs", domain: "hu.example" });
  const a = await S.login("0933 785 101"); await a.put("/api/me/profile", { profile: profileAt("homs") });
  assert.equal((await a.post("/api/me/verify-student", { email: "omar@hu.example" })).status, 200);
  const arabic = s => String(s).replace(/[0-9]/g, d => "٠١٢٣٤٥٦٧٨٩"[d]);
  const ok = await a.post("/api/me/verify-student/confirm", { code: arabic(codeFor("omar@hu.example")) });
  assert.equal(ok.status, 200, ok.text); assert.equal(ok.body.verification.status, "verified", "the right code in Arabic-Indic digits verifies the student");
});

test("universities: a career office's own export includes its office record, and deleting the account removes it (D-22)", async () => {
  const S = await start(), admin = await S.login("+12025550199");
  await admin.post("/api/admin/campus", { phone: "0944 786 001", uni: "homs", name: "Homs Career Office" }); const office = await S.login("0944 786 001");
  const ex = (await office.get("/api/me/export")).body;
  assert.equal(ex.account.role, "university"); assert.deepEqual([ex.campusOffice && ex.campusOffice.university, ex.campusOffice && ex.campusOffice.name], ["homs", "Homs Career Office"], "D-22: the export carries the office record");
  const uid = S.db.get("SELECT id FROM users WHERE phone = ?", "+963944786001").id;
  assert.equal((await office.del("/api/me")).status, 200);
  assert.equal(S.db.get("SELECT COUNT(*) AS n FROM campus_offices WHERE user_id = ?", uid).n, 0, "D-22: the office row, with the contact name, goes with the account");
  assert.ok(!(await admin.get("/api/admin/campus")).body.offices.some(o => o.phone === "+963944786001"), "and the admin's office list no longer shows it");
});
