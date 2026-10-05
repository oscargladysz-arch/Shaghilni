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

/* Contract gap-fill (Stage 2): what settle() in server/payments.js:81-93 does with every kind of result it can receive. */
const signed = S => (name, raw) => go(S, `/pay/callback/${name}`, { method: "POST", headers: { "x-test-signature": S.app.payments.provider.sign(raw) }, body: raw });
const payRow = (S, id) => ({ ...S.db.get("SELECT status, paid_at FROM payments WHERE id = ?", id) });   // a plain object: node:sqlite rows have no prototype
const audits = S => S.db.get("SELECT COUNT(*) AS n FROM audit").n;

test("card payments: the wrong currency, an unknown reference and the wrong provider are refused; failed and cancelled results write no audit row", async () => {
  const logs = [], S = await start(CARD, { log: m => logs.push(String(m)) }), admin = await S.login("+12025550199"), { e } = await employer(S, admin, "0955 773 001", "Sample Advisory");
  const post = signed(S), ref = co => co.body.redirectUrl.split("/").pop(), result = (session, over = {}) => JSON.stringify({ session, status: "paid", amount: 4000, currency: "SYP", ...over });
  const co = await e.post("/api/employer/plan/checkout", { plan: "pro", months: 1 }); assert.equal(co.status, 200, co.text);
  const before = audits(S), rows = S.db.get("SELECT COUNT(*) AS n FROM payments").n;
  // a result addressed to a provider that isn't the configured one: 404 (payments.js:82), nothing changes; the name is [a-z]+ (payments.js:99)
  assert.equal((await post("qnb", result(ref(co)))).status, 404, "qnb isn't the configured provider");
  assert.equal((await post("TEST", result(ref(co)))).status, 404);
  assert.deepEqual(payRow(S, co.body.payment), { status: "created", paid_at: null });
  // an unknown reference, correctly signed: 404 (payments.js:85), no row and no audit row appears; the test page for it is 404 too (payments.js:110)
  assert.equal((await post("test", result("f".repeat(32)))).status, 404, "unknown provider_ref");
  assert.equal((await go(S, `/pay/test/${"f".repeat(32)}`)).status, 404);
  assert.equal(S.db.get("SELECT COUNT(*) AS n FROM payments").n, rows); assert.equal(audits(S), before);
  assert.deepEqual(payRow(S, co.body.payment), { status: "created", paid_at: null });
  // the right amount in the wrong currency: 400, the payment is marked failed, a log line names only the payment id, no audit row (payments.js:88)
  assert.equal((await post("test", result(ref(co), { currency: "USD" }))).status, 400, "currency mismatch");
  assert.equal(payRow(S, co.body.payment).status, "failed");
  assert.ok(logs.includes(`[payments] payment ${co.body.payment}: amount or currency didn't match`), logs.join("\n"));
  assert.equal((await e.get("/api/employer/plan")).body.plan, "free");
  assert.equal(audits(S), before, "a mismatch writes no audit row: only the status and a log line (payments.js:88)");   // recorded behaviour; SECURITY.md:399 covers paid payments only
  assert.equal(S.db.get("SELECT COUNT(*) AS n FROM audit WHERE action = 'plan.card_paid'").n, 0);
  // control: the same result in the right currency, in any letter case (payments.js:88 upper-cases it), is accepted and switches the plan on
  const co2 = await e.post("/api/employer/plan/checkout", { plan: "pro", months: 1 }); assert.equal(co2.status, 200, co2.text);
  assert.equal((await post("test", result(ref(co2), { currency: "syp" }))).status, 200);
  assert.equal(payRow(S, co2.body.payment).status, "paid"); assert.equal((await e.get("/api/employer/plan")).body.plan, "pro");
  const paidAudit = S.db.get("SELECT actor_id, entity, entity_id, data FROM audit WHERE action = 'plan.card_paid'");
  assert.equal(paidAudit.entity, "company"); assert.deepEqual(JSON.parse(paidAudit.data), { plan: "pro", months: 1, amount: 4000, currency: "SYP", payment: co2.body.payment });
  // a cancelled result on a paid payment changes nothing (payments.js:86); a failed result after a cancelled one changes nothing (payments.js:91: only 'created' moves)
  const after = audits(S);
  assert.equal((await post("test", result(ref(co2), { status: "cancelled" }))).status, 200);
  assert.equal(payRow(S, co2.body.payment).status, "paid"); assert.equal((await e.get("/api/employer/plan")).body.plan, "pro");
  const co3 = await e.post("/api/employer/plan/checkout", { plan: "enterprise", months: 1 }); assert.equal(co3.status, 200, co3.text);
  const mid = audits(S);   // plan.checkout was written (payments.js:77)
  assert.equal(mid, after + 1); assert.equal(S.db.get("SELECT action FROM audit ORDER BY id DESC LIMIT 1").action, "plan.checkout");
  assert.equal((await post("test", result(ref(co3), { status: "cancelled", amount: 20000 }))).status, 200);
  assert.deepEqual(payRow(S, co3.body.payment), { status: "cancelled", paid_at: null });
  assert.equal(audits(S), mid, "a cancelled result writes no audit row: payments.js:91 updates the status only");   // recorded behaviour; DEFECTS.md Area 7 (callback row)
  assert.equal((await post("test", result(ref(co3), { status: "failed", amount: 20000 }))).status, 200);
  assert.equal(payRow(S, co3.body.payment).status, "cancelled"); assert.equal(audits(S), mid);
  assert.equal((await e.get("/api/employer/plan")).body.plan, "pro");
});

test("card payments: /pay/return only redirects, whatever the id, and reveals nothing about somebody else's payment", async () => {
  const S = await start(CARD), admin = await S.login("+12025550199");
  const A = await employer(S, admin, "0955 774 001", "Sample Advisory"), B = await employer(S, admin, "0955 774 002", "Sample Logistics");
  const co = await A.e.post("/api/employer/plan/checkout", { plan: "pro", months: 1 }); assert.equal(co.status, 200, co.text); const id = co.body.payment;
  const snap = () => ({ pay: payRow(S, id), audits: audits(S), plan: S.db.get("SELECT plan, plan_until FROM companies WHERE id = ?", cid(S, "Sample Advisory")) });
  const s0 = snap();
  for (const [p, to] of [[String(id), String(id)], ["999999", "999999"], ["abc", "0"], ["", "0"], [encodeURIComponent("//evil.example/x"), "0"]]) {
    for (const method of ["GET", "POST"]) {
      const r = await go(S, `/pay/return?p=${p}`, { method });
      assert.equal(r.status, 303, `${method} p=${p}`); assert.equal(r.headers.get("location"), `/#/company/plan/paid/${to}`, "a relative location only (payments.js:101-102)");
    }
  }
  assert.deepEqual(snap(), s0, "the return page changes nothing: no status, audit or plan change");
  // the page the redirect lands on asks /api/employer/payments/:id, which is scoped to the caller's company (payments.js:124)
  assert.equal((await B.e.get(`/api/employer/payments/${id}`)).status, 404); assert.equal((await B.e.get(`/api/employer/payments/${id}`)).body.error, "not_found");
  assert.equal((await A.e.get(`/api/employer/payments/${id}`)).body.status, "created", "control: the payment exists and its owner sees it");
  assert.equal((await S.client().get(`/api/employer/payments/${id}`)).status, 401);
});

test("card payments: PAY_PROVIDER=qnb in development keeps the card option off until the adapter is completed (ready=false)", async () => {
  const logs = [], S = await start({ ...CARD, PAY_PROVIDER: "qnb" }, { log: m => logs.push(String(m)) }), admin = await S.login("+12025550199"), { e } = await employer(S, admin, "0955 775 001", "Sample Advisory");
  assert.equal(S.app.payments.provider.name, "qnb"); assert.equal(S.app.payments.provider.ready, false);
  assert.ok(logs.includes("[payments] PAY_PROVIDER=qnb is set, but its adapter isn't completed: card payments are switched off."), logs.join("\n"));
  assert.equal((await S.client().get("/api/config")).body.card, null, "no card option (payments.js:53-54)");
  const co = await e.post("/api/employer/plan/checkout", { plan: "pro", months: 1 });
  assert.equal(co.status, 409); assert.equal(co.body.error, "card_unavailable");
  assert.equal(S.db.get("SELECT COUNT(*) AS n FROM payments").n, 0, "no payment row is created before the provider check (payments.js:68)");
  assert.equal((await go(S, `/pay/test/${"a".repeat(32)}`)).status, 404, "the test payment page exists only for the test provider (payments.js:108)");
  assert.equal((await go(S, "/pay/callback/test", { method: "POST", body: "{}" })).status, 404, "results for the unconfigured test provider (payments.js:82)");
  assert.equal((await go(S, "/pay/callback/qnb", { method: "POST", body: "{}" })).status, 400, "the unfinished verify() trusts nothing (payments.js:45,84)");
  assert.equal((await go(S, "/pay/return?p=1")).status, 303, "the return page still only redirects");
  // control: the same settings with the test provider switch the card option on for the same employer
  const T = await start(CARD), tadmin = await T.login("+12025550199"), te = (await employer(T, tadmin, "0955 775 001", "Sample Advisory")).e;
  assert.deepEqual((await T.client().get("/api/config")).body.card, { currency: "SYP", pro: 4000, enterprise: 20000, months: [1, 3, 12] });
  assert.equal((await te.post("/api/employer/plan/checkout", { plan: "pro", months: 1 })).status, 200);
});
