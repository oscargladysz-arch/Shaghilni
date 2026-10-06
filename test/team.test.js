/* Teams: several people in one company, with roles, invitations, requests to join, and a record of who did what. */
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


const cid = (S, name) => S.db.get("SELECT id FROM companies WHERE json_extract(data, '$.name.en') = ?", name).id;
const asEmployer = phone => S => S.login(phone, "employer");

test("teams: seats on every plan, invitations by text, and roles enforced on the server", async () => {
  const S = await start(), admin = await S.login("+12025550199"), { e: owner } = await employer(S, admin, "0955 800 001", "Qasioun Advisory");
  const team = async () => (await owner.get("/api/employer/team")).body;
  assert.deepEqual((await team()).seats, { used: 1, limit: 3 }, "Free: three people, counting the owner");
  assert.equal((await owner.post("/api/employer/team", { phone: "0955 800 002", role: "recruiter" })).body.error, "name_required");
  assert.equal((await owner.post("/api/employer/team", { name: "Lina", phone: "0955 800 002", role: "owner" })).body.error, "bad_role");
  assert.equal((await owner.post("/api/employer/team", { name: "Lina", phone: "0955 800 002", role: "recruiter" })).status, 200);
  assert.ok(S.texts.some(x => x.to.includes("955800002") && /invited you to join|عزمك/.test(x.body)), "the invitation goes by text");
  assert.equal((await owner.post("/api/employer/team", { name: "Karim", phone: "0955 800 003", role: "hiring_manager" })).status, 200);
  assert.equal((await owner.post("/api/employer/team", { name: "Fadi", phone: "0955 800 004", role: "recruiter" })).body.error, "team_full", "open invitations hold seats");
  await admin.post(`/api/admin/companies/${cid(S, "Qasioun Advisory")}/plan`, { plan: "pro", months: 1 });
  assert.equal((await team()).seats.limit, 10, "Pro: ten");
  // Lina signs up fresh: the invitation makes her an employer, and she accepts
  const lina = await S.login("0955 800 002");
  const pend = (await lina.get("/api/employer")).body; assert.equal(pend.company, null); assert.deepEqual([pend.pending.status, pend.pending.role], ["invited", "recruiter"]);
  assert.equal((await lina.post("/api/employer/membership/accept")).status, 200);
  const mine = (await lina.get("/api/employer")).body; assert.equal(mine.company.name.en, "Qasioun Advisory"); assert.equal(mine.me.role, "recruiter");
  const karim = await S.login("0955 800 003", "employer"); await karim.post("/api/employer/membership/accept");
  // what each role may do
  const job = (await lina.post("/api/employer/jobs", { job: JOB, submit: true })).body.job; assert.ok(job, "recruiters post jobs"); assert.equal(job.postedBy, "Lina"); assert.equal(job.mine, true);
  await admin.post(`/api/admin/jobs/${job.id}/approve`);
  assert.equal((await karim.post("/api/employer/jobs", { job: JOB })).body.error, "role_forbidden", "hiring managers don't post");
  assert.equal((await lina.put("/api/employer/company", { company: {} })).body.error, "role_forbidden", "recruiters don't edit the company");
  assert.equal((await lina.post("/api/employer/team", { name: "X", phone: "0955 800 009", role: "recruiter" })).body.error, "role_forbidden", "or the team");
  assert.equal((await lina.post("/api/employer/plan/request", { plan: "enterprise", payMethod: "wallet" })).body.error, "role_forbidden", "or billing");
  assert.equal((await karim.get("/api/employer/students")).body.error, "role_forbidden", "hiring managers don't search candidates");
  const seeker = await S.login("0933 800 101"); await seeker.put("/api/me/profile", { profile: GRAD });
  await seeker.post(`/api/jobs/${job.id}/apply`, { channel: "web", cvLang: "ar" });
  const app = (await karim.get(`/api/employer/jobs/${job.id}/applications`)).body.applications[0]; assert.ok(app, "hiring managers see applicants");
  assert.equal((await karim.put(`/api/employer/applications/${app.id}`, { status: "shortlisted" })).body.error, "role_forbidden", "but don't move them");
  assert.equal((await karim.put(`/api/employer/applications/${app.id}`, { note: "Strong answers on the phone." })).status, 200, "they do leave notes");
  await lina.put(`/api/employer/applications/${app.id}`, { status: "shortlisted" });
  const seen = (await owner.get(`/api/employer/jobs/${job.id}/applications`)).body.applications[0];
  assert.deepEqual([seen.movedBy, seen.noteBy], ["Lina", "Karim"], "everyone sees who moved them and who wrote the note");
  const act = (await owner.get("/api/employer/activity")).body.activity;
  assert.ok(act.some(x => x.action === "application.moved" && x.who === "Lina") && act.some(x => x.action === "team.joined"), "the activity log says who did what");
  assert.equal((await karim.get("/api/employer/activity")).body.error, "role_forbidden");
});

test("teams: asking to join, duplicate companies, admins, transfer, leaving and removal", async () => {
  const S = await start(), admin = await S.login("+12025550199"), { e: owner } = await employer(S, admin, "0955 801 001", "Halab Freight Co");
  const regNo = S.db.get("SELECT json_extract(data, '$.regNo') AS r FROM companies WHERE id = ?", cid(S, "Halab Freight Co")).r;
  const fadi = await S.login("0955 801 002", "employer");
  const dup = await fadi.put("/api/employer/company", { company: { name: { en: "Halab Freight Company" }, regNo: " " + String(regNo).toLowerCase() + " " } });
  assert.equal(dup.body.error, "company_exists", "a registration number already on Shaghilni points to joining instead");
  const found = (await fadi.get("/api/employer/companies/search?q=halab freight")).body.companies; assert.equal(found.length, 1);
  assert.equal((await fadi.post(`/api/employer/companies/${found[0].id}/join`, { name: "Fadi" })).body.status, "requested");
  assert.ok(S.texts.some(x => x.to.includes("955801001") && /asked to join|ينضم/.test(x.body)), "the owner is told");
  assert.equal((await fadi.post(`/api/employer/companies/${found[0].id}/join`, { name: "Fadi" })).body.error, "request_pending");
  const T = (await owner.get("/api/employer/team")).body; assert.equal(T.requests.length, 1); assert.equal(T.requests[0].name, "Fadi");
  assert.equal((await owner.post(`/api/employer/team/requests/${encodeURIComponent(T.requests[0].phone)}`, { decision: "yes", role: "admin" })).status, 200);
  assert.equal((await fadi.get("/api/employer")).body.me.role, "admin");
  // admins run the team but don't manage other admins or billing
  assert.equal((await fadi.post("/api/employer/team", { name: "Sami", phone: "0955 801 003", role: "admin" })).status, 200, "admins invite");
  const sami = await S.login("0955 801 003", "employer"); await sami.post("/api/employer/membership/accept");
  assert.equal((await fadi.del("/api/employer/team/%2B963955801003")).body.error, "role_forbidden", "only the owner removes an admin");
  assert.equal((await fadi.post("/api/employer/team/transfer", { phone: "+963955801003" })).body.error, "role_forbidden");
  // the owner hands over
  assert.equal((await owner.post("/api/employer/team/transfer", { phone: "+963955801002" })).status, 200);
  assert.equal((await fadi.get("/api/employer")).body.me.role, "owner"); assert.equal((await owner.get("/api/employer")).body.me.role, "admin", "the old owner stays on as an admin");
  assert.equal((await fadi.post("/api/employer/team/leave")).body.error, "owner_cannot_leave");
  assert.equal((await owner.post("/api/employer/team/leave")).status, 200); assert.equal((await owner.get("/api/employer")).body.company, null, "leaving ends access");
  assert.equal((await fadi.del("/api/employer/team/%2B963955801003")).status, 200); assert.equal((await sami.get("/api/employer")).body.company, null, "and so does removal");
  // Enterprise has room for fifty
  await admin.post(`/api/admin/companies/${cid(S, "Halab Freight Co")}/plan`, { plan: "enterprise", months: 1 });
  assert.equal((await fadi.get("/api/employer/team")).body.seats.limit, 50);
});

test("teams: one registration number, one company: Arabic-Indic or Persian digits and a later edit cannot make a second page for it (U-018)", async () => {
  const S = await start(), admin = await S.login("+12025550199");
  const page = (name, regNo, phone) => ({ company: { name: { en: name }, gov: "homs", regNo, contactName: `Contact ${name}`, whatsapp: phone } });
  const first = await S.login("0955 815 001", "employer"); assert.equal((await first.put("/api/employer/company", page("Number Holder", "DM-12345", "0955 815 001"))).status, 200);
  for (const [label, regNo, phone] of [["Arabic-Indic", "DM-١٢٣٤٥", "0955 815 002"], ["Persian", "DM-۱۲۳۴۵", "0955 815 003"]]) {
    const r = await (await S.login(phone, "employer")).put("/api/employer/company", page(`Copy ${label}`, regNo, phone));
    assert.deepEqual([r.status, r.body.error], [409, "company_exists"], `${label} digits are the same number`);
  }
  const third = await S.login("0955 815 004", "employer"); assert.equal((await third.put("/api/employer/company", page("Other Co", "DM-99999", "0955 815 004"))).status, 200);
  const edit = await third.put("/api/employer/company", page("Other Co", "DM-12345", "0955 815 004"));
  assert.deepEqual([edit.status, edit.body.error], [409, "company_exists"], "an existing company cannot change its number to one already on Shaghilni");
  assert.equal((await third.put("/api/employer/company", page("Other Co Renamed", "DM-99999", "0955 815 004"))).status, 200, "saving its own number again is fine");
  assert.equal((await first.put("/api/employer/company", page("Number Holder", "DM-١٢٣٤٥", "0955 815 001"))).status, 200, "and so is the holder typing its own number in Arabic-Indic digits");
});

test("teams: a registration number written with Arabic words keeps them: Damascus and Aleppo registrations that share their digits are two companies, as the same pair in Latin letters is (fix review of U-018)", async () => {
  const S = await start();
  const page = (name, regNo, phone) => ({ company: { name: { en: name }, gov: "homs", regNo, contactName: `Contact ${name}`, whatsapp: phone } });
  const put = async (phone, name, regNo) => (await S.login(phone, "employer")).put("/api/employer/company", page(name, regNo, phone));
  assert.equal((await put("0955 817 001", "Damascus Holder", "سجل تجاري دمشق ١٢٣٤٥")).status, 200);
  const aleppo = await put("0955 817 002", "Aleppo Co", "سجل تجاري حلب ١٢٣٤٥"); assert.equal(aleppo.status, 200, `another governorate's register is another number: ${aleppo.text}`);
  assert.equal((await put("0955 817 003", "Latin Damascus", "Damascus CR 12345")).status, 200, "control: the Latin pair was already two companies");
  const same = await put("0955 817 004", "Copy Damascus", "سجل تجاري  دمشق 12345"); assert.deepEqual([same.status, same.body.error], [409, "company_exists"], "the same register and number, spaced or in Latin digits, is still one company");
  const hamza = await put("0955 817 005", "Copy Hamza", "سجل تجارى دمشق ١٢٣٤٥"); assert.deepEqual([hamza.status, hamza.body.error], [409, "company_exists"], "and so is a spelling variant (ى for ي)");
});

test("teams: a registration number held by a company still awaiting verification can be joined (U-023); the request waits, unseen and untexted, until the admin verifies the holder (fix review)", async () => {
  const S = await start(), admin = await S.login("+12025550199");
  const { e: owner } = await employer(S, admin, "0955 816 001", "Pending Freight", false);   // submitted, not yet verified
  const second = await S.login("0955 816 002", "employer");
  const dup = await second.put("/api/employer/company", { company: { name: { en: "Pending Freight Too" }, gov: "homs", regNo: "REG-Pending Freight", contactName: "Second", whatsapp: "0955 816 002" } });
  assert.deepEqual([dup.status, dup.body.error, dup.body.detail.verified], [409, "company_exists", false], "the number is taken and the answer points to the company");
  const toOwner = () => S.texts.filter(x => x.to === "+963955816001").length, before = toOwner();
  const ask = await second.post(`/api/employer/companies/${dup.body.detail.id}/join`, { name: "Second Person" });
  assert.equal(ask.status, 200, `the pointer leads to a request, not a dead end: ${ask.text}`);
  // an unchecked holder (here pending; a draft squatting someone else's number likewise) gets neither the requester's name and number nor a way to text them
  assert.equal(toOwner(), before, "the unverified holder is not texted the request");
  assert.deepEqual((await owner.get("/api/employer/team")).body.requests, [], "nor sees it on the team page");
  const early = await owner.post(`/api/employer/team/requests/${encodeURIComponent("+963955816002")}`, { decision: "yes", role: "recruiter" });
  assert.deepEqual([early.status, early.body.error], [409, "company_not_verified"], "nor decides it");
  assert.equal(S.db.get("SELECT status FROM company_members WHERE phone = '+963955816002'").status, "requested", "the request waits");
  assert.equal((await admin.post(`/api/admin/companies/${dup.body.detail.id}/verify`, { screened: true })).status, 200, "the admin verifies the holder");
  const team = (await owner.get("/api/employer/team")).body;
  assert.ok(team.requests.some(r => r.name === "Second Person"), "the owner now sees the request on the team page");
  assert.equal((await owner.post(`/api/employer/team/requests/${encodeURIComponent("+963955816002")}`, { decision: "yes", role: "recruiter" })).status, 200, "and approves it");
  assert.equal(S.db.get("SELECT status FROM company_members WHERE phone = '+963955816002'").status, "active", "the person is on the team");
  // a draft holder (never submitted) is joinable so the requester is not stuck, and likewise learns nothing
  const squat = await S.login("0955 816 003", "employer");
  assert.equal((await squat.put("/api/employer/company", { company: { name: { en: "Squatter" }, gov: "homs", regNo: "REG-REAL-1", contactName: "Squatter", whatsapp: "0955 816 003" } })).status, 200);
  const real = await S.login("0955 816 004", "employer");
  const d2 = await real.put("/api/employer/company", { company: { name: { en: "Real Co" }, gov: "homs", regNo: "REG-REAL-1", contactName: "Real", whatsapp: "0955 816 004" } });
  assert.equal((await real.post(`/api/employer/companies/${d2.body.detail.id}/join`, { name: "Victim Full Name" })).status, 200);
  const sq = await squat.get("/api/employer/team");
  assert.ok(!sq.text.includes("Victim Full Name") && !sq.text.includes("955816004"), "the draft holder sees neither the name nor the number");
  assert.equal(S.texts.filter(x => x.to === "+963955816003" && /Victim/.test(x.body)).length, 0, "and is not texted the name");
  assert.equal((await squat.post(`/api/employer/team/requests/${encodeURIComponent("+963955816004")}`, { decision: "yes" })).status, 409, "and cannot approve or text the requester");
});

test("teams: invitations need a verified company and stop at twenty a day per company, cancelling included (D-10)", async () => {
  const S = await start(), admin = await S.login("+12025550199");
  const draft = await S.login("0955 810 001", "employer");
  await draft.put("/api/employer/company", { company: { name: { en: "Draft Co" }, gov: "homs", regNo: "REG-DRAFT", contactName: "Contact", whatsapp: "0955 810 001" } });
  const invites = () => S.texts.filter(x => /invited you to join|عزمك/.test(x.body)).length;   // invitation texts only (sign-in codes are texts too)
  assert.equal((await draft.post("/api/employer/team", { name: "Anyone", phone: "0955 810 002", role: "recruiter" })).body.error, "company_not_verified", "a draft company invites nobody");
  const { e: pending } = await employer(S, admin, "0955 810 003", "Pending Co", false);
  assert.equal((await pending.post("/api/employer/team", { name: "Anyone", phone: "0955 810 004", role: "recruiter" })).body.error, "company_not_verified", "nor a company still under review");
  assert.equal(invites(), 0, "and no invitation text leaves in Shaghilni's name");
  const { e: owner } = await employer(S, admin, "0955 810 005", "Verified Co");
  await admin.post(`/api/admin/companies/${cid(S, "Verified Co")}/plan`, { plan: "enterprise", months: 1 });   // fifty seats, so seats never bind here
  for (let i = 1; i <= 20; i++) {   // invite, then cancel to free the seat: the loop D-10 describes
    const n = String(i).padStart(3, "0");
    assert.equal((await owner.post("/api/employer/team", { name: `Person ${i}`, phone: `0955 811 ${n}`, role: "recruiter" })).status, 200, `invitation ${i} of 20`);
    assert.equal((await owner.del(`/api/employer/team/${encodeURIComponent("+963955811" + n)}`)).status, 200, `cancelling ${i} frees the seat, not the day's count`);
  }
  const before = invites(), r21 = await owner.post("/api/employer/team", { name: "Person 21", phone: "0955 811 021", role: "recruiter" });
  assert.deepEqual([r21.status, r21.body.error], [429, "rate_limited"], "the twenty-first invitation of the day is refused");
  assert.equal(invites(), before, "and sends no text");
  const { e: other } = await employer(S, admin, "0955 810 006", "Other Co");
  assert.equal((await other.post("/api/employer/team", { name: "Theirs", phone: "0955 812 001", role: "recruiter" })).status, 200, "the cap is per company");
});

test("teams: a team invitation texted before the account existed is in that person's export and erased with the account (U-055)", async () => {
  const S = await start(), admin = await S.login("+12025550199");
  const { e: owner } = await employer(S, admin, "0955 814 001", "Invite Export Co");
  assert.equal((await owner.post("/api/employer/team", { name: "New Recruiter", phone: "0955 814 002", role: "recruiter" })).status, 200);
  assert.equal(S.db.get("SELECT COUNT(*) AS n FROM notifications WHERE phone = '+963955814002' AND user_id IS NULL").n, 1, "the invitation went to a number with no account yet");
  const joiner = await S.login("0955 814 002", "employer");
  assert.equal((await joiner.post("/api/employer/membership/accept")).status, 200);
  const ex = (await joiner.get("/api/me/export")).body;
  assert.ok(ex.textMessages.some(t => /Invite Export Co/.test(t.text)), "the invitation text is part of the person's download");
  assert.equal((await joiner.del("/api/me")).status, 200);
  assert.equal(S.db.get("SELECT COUNT(*) AS n FROM notifications WHERE phone = '+963955814002'").n, 0, "and no text to the number is left after the account is deleted");
});

test("teams: an invitation to a number that already has an account spends the day's invitations too, so the invite form is no free account check (D-41)", async () => {
  const S = await start(), admin = await S.login("+12025550199");
  const { e: owner } = await employer(S, admin, "0955 817 001", "Oracle Check Co");
  await admin.post(`/api/admin/companies/${cid(S, "Oracle Check Co")}/plan`, { plan: "enterprise", months: 1 });
  await S.login("0944 817 001");   // a job seeker's number
  for (let i = 1; i <= 20; i++) { const r = await owner.post("/api/employer/team", { name: "Probe", phone: "0944 817 001", role: "recruiter" }); assert.equal(r.body.error, "phone_taken", `try ${i}`); }
  const r21 = await owner.post("/api/employer/team", { name: "Probe", phone: "0944 817 001", role: "recruiter" });
  assert.deepEqual([r21.status, r21.body.error], [429, "rate_limited"], "the twenty-first try of the day is refused before anything is looked up");
});

test("teams: asking to join texts the company's managers at most five times a day per account, withdrawing included (U-032)", async () => {
  const S = await start(), admin = await S.login("+12025550199");
  await employer(S, admin, "0955 813 001", "Join Target Co");
  const asker = await S.login("0955 813 002", "employer"), target = cid(S, "Join Target Co");
  const requests = () => S.texts.filter(x => /asked to join|ينضم/.test(x.body) && x.to === "+963955813001").length;   // the owner's join-request texts only
  for (let i = 1; i <= 5; i++) {   // ask, then withdraw: the loop that sent unlimited texts with the asker's own wording
    assert.equal((await asker.post(`/api/employer/companies/${target}/join`, { name: `Visit our site ${i}` })).status, 200, `request ${i} of 5`);
    assert.equal((await asker.post("/api/employer/membership/cancel")).status, 200, `withdrawing ${i} does not give the request back`);
  }
  const before = requests(), r6 = await asker.post(`/api/employer/companies/${target}/join`, { name: "Visit our site 6" });
  assert.deepEqual([r6.status, r6.body.error], [429, "rate_limited"], "the sixth request of the day is refused");
  assert.equal(requests(), before, "and texts nobody");
  assert.equal(before, 5, "five requests, five texts to the owner");
  const other = await S.login("0955 813 003", "employer");
  assert.equal((await other.post(`/api/employer/companies/${target}/join`, { name: "Someone else" })).status, 200, "the limit is per account");
});
