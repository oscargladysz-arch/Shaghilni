/* Recruiters and students: who can be found, what employers see, invitations and replies. */
import { test, after } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import http from "node:http";
import { loadConfig } from "../server/config.js";
import { openDb } from "../server/db.js";
import { createApp } from "../server/app.js";
import { seedDemo } from "../server/seed.js";

const servers = [];
after(() => { for (const s of servers) s.close(); });
async function start() {
  const cfg = loadConfig({ skipDotEnv: true, isolated: true, env: { NODE_ENV: "test", ADMIN_PHONES: "+12025550199" }, values: { powBits: 0, anthropicKey: "" } });
  const db = openDb(":memory:"), texts = [];
  seedDemo(db, () => {});
  const server = http.createServer(createApp({ cfg, db, log: () => {}, sms: async (to, body) => { texts.push({ to, body }); } }));
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
  return { db, texts, client, login };
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

test("recruiters: anyone can choose to be found, only after opting in, and only by checked employers", async () => {
  const S = await start(), admin = await S.login("+12025550199");
  const { e, jobId } = await employer(S, admin, "0955 700 001", "Orontes Energy");
  const pending = (await employer(S, admin, "0955 700 002", "Unchecked Co", false)).e;
  const s = await S.login("0933 700 001"), g = await S.login("0933 700 002"), nobody = await S.login("0933 700 003"), guest = S.client();
  assert.equal((await s.put("/api/me/profile", { profile: STUDENT })).status, 200);
  assert.equal((await g.put("/api/me/profile", { profile: { ...GRAD, prefs: { types: [], fields: [], level: "y1to3" } } })).status, 200);
  assert.equal((await e.get("/api/employer/students")).body.students.length, 0, "nobody is listed before opting in");
  assert.equal((await nobody.put("/api/me/recruit", { open: true })).body.error, "profile_required", "a profile comes first");
  assert.deepEqual((await s.put("/api/me/recruit", { open: true })).body, { open: true });
  assert.deepEqual((await g.put("/api/me/recruit", { open: true })).body, { open: true }, "graduates and professionals can switch it on too");
  assert.equal((await s.put("/api/me/profile", { profile: { ...(await s.get("/api/me")).body.profile, skills: ["Excel", "AutoCAD", "Python"] } })).status, 200);
  const list = await e.get("/api/employer/students");
  assert.equal(list.body.students.length, 2, "editing the profile keeps the choice");
  const card = list.body.students.find(x => x.fac === "petroleum"), grad = list.body.students.find(x => x.fac === "business");
  assert.equal(card.name.en, "Omar K.");
  assert.deepEqual([card.fac, card.uni, card.year, card.status], ["petroleum", "homs", 4, "student"]);
  assert.deepEqual([grad.name.en, grad.name.ar, grad.status, grad.level, grad.year, grad.grad], ["Lina H.", "لينا ح.", "bachelor", "y1to3", 0, 2023]);
  assert.ok(!/933700001|933700002|omar@example|lina@example/.test(list.text), "cards carry no phone numbers or emails");
  assert.deepEqual((await e.get("/api/employer/students?stage=student")).body.students.map(x => x.fac), ["petroleum"]);
  assert.deepEqual((await e.get("/api/employer/students?stage=grad")).body.students.map(x => x.fac), ["business"]);
  assert.deepEqual((await e.get("/api/employer/students?level=y1to3")).body.students.map(x => x.fac), ["business"]);
  assert.equal((await e.get("/api/employer/students?q=python")).body.students.length, 1, "only the student added Python");
  assert.equal((await e.get("/api/employer/students?q=nursing")).body.students.length, 0);
  assert.equal((await pending.get("/api/employer/students")).body.error, "company_not_verified");
  assert.equal((await s.get("/api/employer/students")).status, 403);
  assert.equal((await guest.get("/api/employer/students")).status, 401);
  assert.equal((await e.get("/api/me/invitations")).status, 403);
  await s.put("/api/me/recruit", { open: false });
  assert.equal((await e.get("/api/employer/students")).body.students.length, 1, "switching it off hides that person again");
  assert.equal((await e.post(`/api/employer/students/${card.id}/invite`, { kind: "job", jobId })).status, 404, "and nobody can invite them");
});

test("invitations: checks, replies, contact details only after a yes, blocking and deletion", async () => {
  const S = await start(), admin = await S.login("+12025550199");
  const { e, jobId } = await employer(S, admin, "0955 710 001", "Qasioun Advisory");
  const other = await employer(S, admin, "0955 710 002", "Barada Logistics");
  const s = await S.login("0933 710 001");
  await s.put("/api/me/profile", { profile: STUDENT }); await s.put("/api/me/recruit", { open: true });
  const sid = (await e.get("/api/employer/students")).body.students[0].id;
  const job = await e.post(`/api/employer/students/${sid}/invite`, { kind: "job", jobId, message: "Your field internship fits this role." });
  assert.equal(job.status, 200, JSON.stringify(job.body));
  assert.ok(S.texts.some(t => t.to === "+963933710001" && /دعتك|invited you/.test(t.body)), "the student gets a text");
  assert.equal((await e.post(`/api/employer/students/${sid}/invite`, { kind: "job", jobId })).body.error, "already_invited");
  assert.equal((await e.post(`/api/employer/students/${sid}/invite`, { kind: "job", jobId: other.jobId })).body.error, "bad_job");
  assert.equal((await e.post(`/api/employer/students/${sid}/invite`, { kind: "event", event: { title: "Careers day", date: inDays(-2), place: "Homs University" } })).body.error, "invalid_event");
  assert.equal((await e.post(`/api/employer/students/${sid}/invite`, { kind: "event", event: { title: "Careers day", date: inDays(10), place: "Homs" }, message: "There is an application fee of 5,000 SYP" })).body.error, "invite_fee");
  assert.equal((await e.post(`/api/employer/students/${sid}/invite`, { kind: "event", event: { title: "Careers day", date: inDays(10), place: "Homs University, main hall" } })).status, 200);
  assert.equal((await s.get("/api/me")).body.invitesNew, 2);
  const inbox = (await s.get("/api/me/invitations")).body.invitations;
  assert.deepEqual(inbox.map(i => [i.kind, i.status]).sort(), [["event", "new"], ["job", "new"]]);
  assert.equal(inbox.find(i => i.kind === "job").company.name.en, "Qasioun Advisory");
  assert.equal((await s.get("/api/me")).body.invitesNew, 0, "opening the inbox marks them seen");
  const ev = inbox.find(i => i.kind === "event"), jb = inbox.find(i => i.kind === "job");
  assert.equal((await s.post(`/api/me/invitations/${ev.id}/respond`, { answer: "yes" })).body.invitation.status, "accepted");
  assert.equal((await s.post(`/api/me/invitations/${jb.id}/respond`, { answer: "no" })).body.invitation.status, "declined");
  assert.equal((await s.post(`/api/me/invitations/${jb.id}/respond`, { answer: "yes" })).body.error, "bad_transition");
  const sent = (await e.get("/api/employer/invitations")).body.invitations;
  const sentEv = sent.find(i => i.kind === "event"), sentJob = sent.find(i => i.kind === "job");
  assert.equal(sentEv.student.phone, "+963933710001", "accepting an event shares the student's number with that employer");
  assert.equal(sentEv.student.name.en, "Omar Nabil Al-Khatib");
  assert.equal(sentJob.student.phone, null);
  assert.equal(sentJob.student.name.en, "Omar K.");
  for (let i = 0; i < 3; i++) assert.equal((await e.post(`/api/employer/students/${sid}/invite`, { kind: "event", event: { title: `Open day ${i}`, date: inDays(20 + i), place: "Damascus" } })).status, 200);
  assert.equal((await e.post(`/api/employer/students/${sid}/invite`, { kind: "event", event: { title: "One too many", date: inDays(30), place: "Damascus" } })).body.error, "invite_limit", "at most three open invitations per student");
  const openOne = (await e.get("/api/employer/invitations")).body.invitations.find(i => i.status === "sent");
  assert.equal((await e.post(`/api/employer/invitations/${openOne.id}/withdraw`)).status, 200);
  assert.ok(!(await s.get("/api/me/invitations")).body.invitations.some(i => i.id === openOne.id), "withdrawn invitations disappear for the student");
  const anyInvite = (await s.get("/api/me/invitations")).body.invitations[0];
  assert.equal((await s.post(`/api/me/invitations/${anyInvite.id}/block`)).status, 200);
  assert.equal((await e.get("/api/employer/students")).body.students.length, 0, "a blocked company can't find the student");
  assert.equal((await e.post(`/api/employer/students/${sid}/invite`, { kind: "event", event: { title: "Again", date: inDays(12), place: "Homs" } })).status, 404);
  assert.equal((await other.e.get("/api/employer/students")).body.students.length, 1, "other companies still can");
  assert.equal((await s.del("/api/me")).status, 200);
  assert.equal(S.db.get("SELECT COUNT(*) AS n FROM invitations WHERE user_id = ?", sid).n, 0, "deleting the account deletes the invitations");
  assert.equal(S.db.get("SELECT COUNT(*) AS n FROM recruiter_blocks WHERE user_id = ?", sid).n, 0);
});

test("recruiters: an online event invitation shows its link in the full app's inbox card, as Lite does (U-013)", () => {
  const js = f => readFileSync(new URL(`../public/js/${f}`, import.meta.url), "utf8"), ctx = vm.createContext({ console, S: { lang: "en" } });
  for (const f of ["lookups.js", "i18n.js", "i18n2.js", "i18n3.js", "i18n4.js", "engine.js"]) vm.runInContext(js(f), ctx, { filename: f });
  vm.runInContext('const sep = () => ", "; function dayLabel(ts) { return String(ts); }', ctx);   // the two helpers app-recruit.js borrows from app.js and app-seeker.js
  vm.runInContext(js("app-recruit.js"), ctx, { filename: "app-recruit.js" });
  ctx.inv = { id: 7, kind: "event", status: "new", company: { name: { en: "Online Co" }, abbr: "OC", sector: "trade", verified: true }, message: "", createdAt: 1,
    event: { title: "Online open day", date: "2026-10-16", place: "", link: "https://meet.example.com/open-day" } };
  const card = vm.runInContext("invCard(inv).s", ctx);
  assert.match(card, /href="https:\/\/meet\.example\.com\/open-day"/, "the link the company typed is on the card");
  assert.match(card, /rel="noopener[^"]*"/, "and opens without handing the page to the other site");
  ctx.inv.event = { ...ctx.inv.event, link: 'https://x.example/"><script>' }; assert.doesNotMatch(vm.runInContext("invCard(inv).s", ctx), /<script>/, "escaped like every other value");
});

