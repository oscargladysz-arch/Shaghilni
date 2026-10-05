/* Demo accounts: a university student, a job seeker and a verified company, only in demo mode. */
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


test("demo accounts: four accounts with real-looking activity, ready to sign in to", async () => {
  const S = await start({ SEED_DEMO: "true", DEMO_ACCOUNTS: "true" }); await S.app.demoReady;
  const cfg = (await S.client().get("/api/config")).body; assert.deepEqual(cfg.demo.map(d => d.who), ["student", "seeker", "company", "university"]);
  const as = async who => { const c = S.client(); assert.equal((await c.post("/api/auth/demo", { who })).status, 200); return c; };
  const st = await as("student"), me = (await st.get("/api/me")).body;
  assert.equal(me.profile.name, "Omar Nabil Al-Khatib"); assert.equal(me.studentVerify.status, "verified");
  const apps = (await st.get("/api/me/applications")).body.applications; assert.deepEqual(apps.map(a => a.status).sort(), ["interview", "shortlisted"]);
  const inv = (await st.get("/api/me/invitations")).body.invitations; assert.ok(inv.length >= 2 && inv.some(x => x.message), "recruiters have written to him");
  assert.ok((await st.get("/api/me/events")).body.tickets.length >= 2, "and he has event tickets");
  const sk = await as("seeker"), sApps = (await sk.get("/api/me/applications")).body.applications;
  assert.deepEqual(sApps.map(a => a.status).sort(), ["interview", "rejected"]);
  assert.ok((await sk.get("/api/me/invitations")).body.invitations.some(x => x.status === "new" || x.status === "sent" || x.status === "seen"), "a job invitation is waiting for her answer");
  const co = await as("company"), emp = (await co.get("/api/employer")).body;
  assert.equal(emp.company.name.en, "Yasmin Trading"); assert.equal(emp.plan.plan, "pro");
  const an = (await co.get("/api/employer/analytics")).body; assert.ok(an.total.applications >= 5 && an.total.hired >= 1, "analytics have numbers in them");
  assert.ok((await co.get("/api/employer/events")).body.events.some(e => e.mine === "confirmed"));
  const uni = await as("university"), D = (await uni.get("/api/campus")).body;
  assert.ok(D.domains.length === 1 && D.students.length >= 2 && D.partners.length >= 2, "a student email domain, verified students and partners");
  const evs = (await uni.get("/api/organize/events")).body.events; assert.ok(evs.length >= 3);
  const past = evs.find(e => e.startsAt < Date.now()); const R = (await uni.get(`/api/organize/events/${past.id}/report`)).body;
  assert.ok(R.totals.checkedIn >= 3 && R.companies.some(c => c.hires >= 1), "a past event with a report");
  const again = await start({ SEED_DEMO: "true", DEMO_ACCOUNTS: "true" }); await again.app.demoReady;
  assert.equal(again.db.get("SELECT COUNT(*) AS n FROM users WHERE phone = '+963933000101'").n, 1);
});

test("demo accounts: the purge removes them and everything they made, and they don't come back", async () => {
  const S = await start({ SEED_DEMO: "true", DEMO_ACCOUNTS: "true" }); await S.app.demoReady;
  const jobsBefore = S.db.get("SELECT COUNT(*) AS n FROM jobs").n;
  const { purgeDemo, DEMO_PHONES } = await import("../server/demo.js"), r = purgeDemo(S.db);
  assert.ok(r.users >= 9 && r.companies === 2 && r.jobs === 4 && r.events === 4, JSON.stringify(r));
  for (const p of DEMO_PHONES) assert.equal(S.db.get("SELECT COUNT(*) AS n FROM users WHERE phone = ?", p).n, 0);
  assert.equal(S.db.get("SELECT COUNT(*) AS n FROM jobs").n, jobsBefore - 4, "the sample listings stay");
  for (const t of ["events", "event_rsvps", "invitations", "applications", "student_verifications", "campus_offices"]) assert.equal(S.db.get(`SELECT COUNT(*) AS n FROM ${t}`).n, 0, t + " is empty again");
  assert.deepEqual((await S.client().get("/api/config")).body.demo, [], "the home screen no longer offers them");
  const { seedDemoAccounts } = await import("../server/demo.js");
  await seedDemoAccounts({ db: S.db, cfg: { demoAccounts: true, seedDemo: true, prod: false }, router: null });
  assert.equal(S.db.get("SELECT COUNT(*) AS n FROM users WHERE phone = ?", DEMO_PHONES[0]).n, 0, "and they aren't created again");
});

test("demo accounts: never in production, and no demo sign-in without demo mode", async () => {
  const off = await start({}); await off.app.demoReady;
  assert.equal((await off.client().post("/api/auth/demo", { who: "student" })).status, 404, "no route without demo data");
  assert.deepEqual((await off.client().get("/api/config")).body.demo, []);
  const { demoOn } = await import("../server/demo.js");
  assert.equal(demoOn({ demoAccounts: true, seedDemo: true, prod: true }), false, "demo accounts are never made in production");
  assert.equal(demoOn({ demoAccounts: false, seedDemo: true, prod: false }), false, "or unless asked for");
  assert.equal(demoOn({ demoAccounts: true, seedDemo: true, prod: false }), true);
});
