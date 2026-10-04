/* Card payments for plans: the hosted payment page, signed results, and switching plans on. */
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


import { loadConfig as loadCfg } from "../server/config.js";
const CARD = { PAY_PROVIDER: "test", PLAN_PRO_MONTHLY: "4000", PLAN_ENTERPRISE_MONTHLY: "20000" };
const cid = (S, name) => S.db.get("SELECT id FROM companies WHERE json_extract(data, '$.name.en') = ?", name).id;
const go = (S, path, opts = {}) => fetch(S.base + path, { redirect: "manual", ...opts });
const payOnTestPage = async (S, url, result = "paid") => { const r = await go(S, url, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: "result=" + result }); return r.headers.get("location"); };

test("card payments: off until a provider and prices are set", async () => {
  const S = await start(), admin = await S.login("+12025550199"), { e } = await employer(S, admin, "0955 770 001", "Qasioun Advisory");
  assert.equal((await S.client().get("/api/config")).body.card, null);
  assert.equal((await e.post("/api/employer/plan/checkout", { plan: "pro", months: 1 })).body.error, "card_unavailable");
});

test("card payments: pay on the provider's page, and the signed result switches the plan on", async () => {
  const S = await start(CARD);
  const admin = await S.login("+12025550199"), { e } = await employer(S, admin, "0955 771 001", "Qasioun Advisory");
  assert.deepEqual((await S.client().get("/api/config")).body.card, { currency: "SYP", pro: 4000, enterprise: 20000, months: [1, 3, 12] });
  await e.post("/api/employer/plan/request", { plan: "pro", payMethod: "wallet" });
  assert.equal((await e.post("/api/employer/plan/checkout", { plan: "pro", months: 2 })).body.error, "bad_months");
  const co = await e.post("/api/employer/plan/checkout", { plan: "pro", months: 3 });
  assert.equal(co.status, 200); assert.match(co.body.redirectUrl, /^\/pay\/test\/[0-9a-f]{32}$/);
  const pagev = await go(S, co.body.redirectUrl); assert.equal(pagev.status, 200); assert.match(await pagev.text(), /12,000 SYP/);
  assert.equal((await e.get(`/api/employer/payments/${co.body.payment}`)).body.status, "created");
  assert.equal((await e.get("/api/employer/plan")).body.plan, "free", "nothing changes until the payment is confirmed");
  const ret = await payOnTestPage(S, co.body.redirectUrl); assert.equal(ret, `/pay/return?p=${co.body.payment}`);
  assert.equal((await go(S, ret)).headers.get("location"), `/#/company/plan/paid/${co.body.payment}`);
  const st = (await e.get(`/api/employer/payments/${co.body.payment}`)).body; assert.equal(st.status, "paid");
  const P = (await e.get("/api/employer/plan")).body;
  assert.equal(P.plan, "pro"); assert.ok(Math.abs(P.planUntil - (Date.now() + 90 * 86400e3)) < 60e3, "three months of Pro");
  assert.ok(P.charges.some(c => c.kind === "plan" && c.status === "paid" && c.amountSyp === 12000), "a paid receipt is recorded");
  assert.equal(P.request, null, "the waiting manual request is closed");
  // renewing adds to the time left
  const again = await e.post("/api/employer/plan/checkout", { plan: "pro", months: 1 }); await payOnTestPage(S, again.body.redirectUrl);
  assert.ok(Math.abs((await e.get("/api/employer/plan")).body.planUntil - (P.planUntil + 30 * 86400e3)) < 60e3);
  // cancelling changes nothing
  const c3 = await e.post("/api/employer/plan/checkout", { plan: "enterprise", months: 1 }); await payOnTestPage(S, c3.body.redirectUrl, "cancelled");
  assert.equal((await e.get(`/api/employer/payments/${c3.body.payment}`)).body.status, "cancelled"); assert.equal((await e.get("/api/employer/plan")).body.plan, "pro");
  const seeker = await S.login("0933 771 002"); assert.equal((await seeker.post("/api/employer/plan/checkout", { plan: "pro", months: 1 })).status, 403);
});

test("card payments: forged, altered and repeated results change nothing", async () => {
  const S = await start(CARD), admin = await S.login("+12025550199"), { e } = await employer(S, admin, "0955 772 001", "Qasioun Advisory");
  const co = await e.post("/api/employer/plan/checkout", { plan: "enterprise", months: 1 });
  const ref = co.body.redirectUrl.split("/").pop();
  const raw = JSON.stringify({ session: ref, status: "paid", amount: 20000, currency: "SYP" });
  assert.equal((await go(S, "/pay/callback/test", { method: "POST", headers: { "x-test-signature": "0".repeat(64) }, body: raw })).status, 400, "a bad signature is refused");
  assert.equal((await e.get("/api/employer/plan")).body.plan, "free");
  const cheap = JSON.stringify({ session: ref, status: "paid", amount: 1, currency: "SYP" });
  const provider = S.app.payments.provider;
  assert.equal((await go(S, "/pay/callback/test", { method: "POST", headers: { "x-test-signature": provider.sign(cheap) }, body: cheap })).status, 400, "the wrong amount is refused");
  assert.equal((await e.get(`/api/employer/payments/${co.body.payment}`)).body.status, "failed"); assert.equal((await e.get("/api/employer/plan")).body.plan, "free");
  const co2 = await e.post("/api/employer/plan/checkout", { plan: "enterprise", months: 1 }), ref2 = co2.body.redirectUrl.split("/").pop();
  const ok = JSON.stringify({ session: ref2, status: "paid", amount: 20000, currency: "SYP" });
  for (let i = 0; i < 2; i++) assert.equal((await go(S, "/pay/callback/test", { method: "POST", headers: { "x-test-signature": provider.sign(ok) }, body: ok })).status, 200);
  const P = (await e.get("/api/employer/plan")).body; assert.equal(P.plan, "enterprise");
  assert.equal(P.charges.filter(c => c.kind === "plan" && c.status === "paid").length, 1, "a repeated result is paid only once");
});

test("card payments: the test payment page is refused in production", async () => {
  const env = { NODE_ENV: "production", PAY_PROVIDER: "test", PLAN_PRO_MONTHLY: "4000", PLAN_ENTERPRISE_MONTHLY: "20000", OTP_PEPPER: "x".repeat(40), BASE_URL: "https://shaghilni.example" };
  assert.throws(() => loadCfg({ skipDotEnv: true, isolated: true, env }), /pretend payment page/);
  assert.throws(() => loadCfg({ skipDotEnv: true, isolated: true, env: { ...env, PAY_PROVIDER: "qnb", PLAN_PRO_MONTHLY: "0" } }), /PLAN_PRO_MONTHLY/);
});
