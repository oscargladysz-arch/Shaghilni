/* How people can apply: on Shaghilni always, plus WhatsApp, a call or email if the company chose them. */
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
  return { db, texts, client, login, app, core, base };
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
test("applying: only the ways the company chose, each recorded in its dashboard", async () => {
  const S = await start(), admin = await S.login("+12025550199"), { e } = await employer(S, admin, "0955 830 001", "Qasioun Advisory");
  const co = (await e.get("/api/employer")).body.company;
  assert.deepEqual(co.applyVia, { whatsapp: true, call: false, email: false }, "set up before this: WhatsApp stays on");
  // switch to email and calls only
  const r1 = await e.put("/api/employer/company", { company: { ...co, applyVia: { whatsapp: false, call: true, email: true }, applyPhone: "", applyEmail: "" } });
  assert.ok(r1.status === 200); assert.ok((await e.get("/api/employer")).body.missing.includes("applyPhone"), "a chosen way needs its details");
  await e.put("/api/employer/company", { company: { ...co, applyVia: { whatsapp: false, call: true, email: true }, applyPhone: "0955 830 002", applyEmail: "Jobs@Qasioun.example" } });
  const jid = (await e.get("/api/employer")).body.jobs[0].id, pub = (await S.client().get("/api/jobs")).body.jobs.find(x => x.id === jid);
  assert.deepEqual([pub.hasWhatsapp, pub.applyCall, pub.applyEmail], [false, true, true]);
  assert.equal(JSON.stringify(pub).includes("830002") || JSON.stringify(pub).includes("qasioun.example"), false, "numbers and addresses appear only once someone applies");
  const a = await S.login("0933 830 101"); await a.put("/api/me/profile", { profile: GRAD });
  assert.equal((await a.post(`/api/jobs/${jid}/apply`, { channel: "whatsapp", cvLang: "ar" })).body.error, "channel_unavailable");
  const em = (await a.post(`/api/jobs/${jid}/apply`, { channel: "email", cvLang: "en" })).body; assert.equal(em.email, "jobs@qasioun.example");
  const b = await S.login("0933 830 102"); await b.put("/api/me/profile", { profile: GRAD });
  assert.equal((await b.post(`/api/jobs/${jid}/apply`, { channel: "call", cvLang: "ar" })).body.phone, "+963955830002");
  const apps = (await e.get(`/api/employer/jobs/${jid}/applications`)).body.applications;
  assert.deepEqual(apps.map(x => x.channel).sort(), ["call", "email"], "every way in is in the dashboard, labelled");
  const lite = await (await fetch(S.base + `/lite/job/${jid}`)).text();
  assert.ok(lite.includes('"call"') && lite.includes('"email"') && !lite.includes('value="whatsapp"'), "Lite offers the same ways");
});
