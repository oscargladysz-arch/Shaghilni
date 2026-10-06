/* Insights for the Shaghilni team: totals only, real activity by default. */
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
test("insights: the team sees how the platform is doing, in totals only, without sample data", async () => {
  const S = await start(), admin = await S.login("+12025550199"), { e } = await employer(S, admin, "0955 820 001", "Qasioun Advisory");
  const st = await S.login("0933 820 101"); await st.put("/api/me/profile", { profile: { ...GRAD, name: "Hala Student", edu: { ...(GRAD.edu || {}), status: "student", uni: "homs", fac: "business", year: 3 } } }); await st.put("/api/me/recruit", { open: true });
  const ab = await S.login("+4915112345678"); await ab.put("/api/me/profile", { profile: { ...GRAD, name: "Sami Abroad", gov: "abroad", country: "de" } });
  const jid = (await e.get("/api/employer")).body.jobs[0].id;
  await st.post(`/api/jobs/${jid}/apply`, { channel: "web", cvLang: "ar" }); await ab.post(`/api/jobs/${jid}/apply`, { channel: "whatsapp", cvLang: "ar" });
  const app = S.db.get("SELECT id FROM applications WHERE user_id = (SELECT id FROM users WHERE phone = '+963933820101')").id;
  for (const s of ["shortlisted", "interview", "hired"]) await e.put(`/api/employer/applications/${app}`, { status: s });
  await admin.post(`/api/admin/applications/${app}/confirm-hire`, {});
  await admin.post(`/api/admin/companies/${cid(S, "Qasioun Advisory")}/plan`, { plan: "pro", months: 1, amountSyp: 4000 });
  const ch = (await admin.get("/api/admin/billing")).body.charges.find(c => c.kind === "plan"); await admin.post(`/api/admin/charges/${ch.id}/paid`);
  assert.equal((await st.get("/api/admin/insights")).status, 403, "only the Shaghilni team");
  const I = (await admin.get("/api/admin/insights")).body;
  assert.equal(I.period.days, 30); assert.equal(I.period.sample, false);
  assert.deepEqual([I.headline.confirmedHiresAllTime, I.headline.confirmedHires.now, I.headline.applications.now, I.headline.liveJobs, I.headline.verifiedCompanies], [1, 1, 2, 1, 1]);
  assert.equal(I.headline.users, 3, "two job seekers and one employer; the admin team isn't counted");
  assert.ok(I.headline.newUsers.now >= 3 && I.headline.activeWeek >= 3);
  assert.equal(I.headline.paidSyp, 4000); assert.equal(I.money.byKind.find(k => k.kind === "plan").paidSyp, 4000);
  assert.deepEqual([I.users.students, I.users.graduatesAndWorkers, I.users.abroad, I.users.openToRecruiters], [1, 1, 1, 1]);
  assert.deepEqual([I.hiring.funnel.hired, I.hiring.funnel.new, I.hiring.byChannel.whatsapp, I.hiring.byChannel.web], [1, 1, 1, 1]);
  assert.equal(I.jobs.withoutApplicants, 0); assert.equal(I.jobs.applicantsPerJob, 2);
  assert.equal(I.weeks.length, 12); assert.equal(I.weeks[11].hires, 1);
  assert.equal(I.attention.hires, 0); assert.equal(I.attention.companies, 0);
  const raw = JSON.stringify(I); assert.ok(!raw.includes("820101") && !raw.includes("Hala") && !raw.includes("Sami"), "no phone numbers or names, only totals");
  const all = (await admin.get("/api/admin/insights?sample=1&days=365")).body;
  assert.ok(all.headline.liveJobs > I.headline.liveJobs, "sample listings appear only when asked for"); assert.equal(all.period.days, 365);
  assert.equal((await admin.get("/api/admin/insights?days=12")).body.period.days, 30, "unknown periods fall back to 30 days");
});

test("insights: sample data left in a production database is a needs-attention item; in development it is expected", async () => {
  const prodEnv = { NODE_ENV: "production", OTP_PEPPER: "p".repeat(40), BASE_URL: "https://shaghilni.test", SMS_PROVIDER: "textbee", TEXTBEE_API_KEY: "k", CONTACT_EMAIL: "privacy@example.com" };
  const quiet = console.warn; console.warn = () => {};
  let P; try { P = await start(prodEnv); } finally { console.warn = quiet; }   // the harness seeds the 17 companies and 18 listings itself
  const admin = await P.login("+12025550199");
  const A = (await admin.get("/api/admin/insights")).body.attention;
  assert.deepEqual([A.sampleCompanies, A.sampleJobs], [17, 18], "the sample companies and listings still in the database are flagged");
  P.db.run("DELETE FROM jobs WHERE is_demo = 1"); P.db.run("DELETE FROM companies WHERE is_demo = 1");
  const B = (await admin.get("/api/admin/insights")).body.attention;
  assert.deepEqual([B.sampleCompanies, B.sampleJobs], [0, 0], "and gone once npm run demo:remove has run");
  const S = await start(), dev = await S.login("+12025550199");
  const D = (await dev.get("/api/admin/insights")).body.attention;
  assert.deepEqual([D.sampleCompanies, D.sampleJobs], [0, 0], "in development the sample data is expected, so there is no item");
});
