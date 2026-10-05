/* Security tests, numbered after the pre-launch checklist in SECURITY.md. Each group runs its own server and
   in-memory database, so the settings it changes (caps, proof of work, production mode) can't leak between tests. */
import { test, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import vm from "node:vm";
import { readFileSync, readdirSync, mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { loadConfig, TERMS_VERSION } from "../server/config.js";
import { openDb, now } from "../server/db.js";
import { createApp } from "../server/app.js";
import { seedDemo, countDemo } from "../server/seed.js";
import { leadingZeroBits } from "../server/auth.js";
import { scanSecrets, scanCode, auditSettings, parseEnvFile } from "../scripts/security-check.js";

const realFetch = globalThis.fetch;
const servers = [];
after(() => { for (const s of servers) s.close(); globalThis.fetch = realFetch; });

async function start({ env = {}, values = {}, seed = true } = {}) {
  const cfg = loadConfig({ skipDotEnv: true, isolated: true, env: { NODE_ENV: "test", ADMIN_PHONES: "+12025550199", ...env }, values: { powBits: 0, anthropicKey: "", ...values } });
  const db = openDb(":memory:"), texts = [], logs = [];
  if (seed) seedDemo(db, () => {});
  const app = createApp({ cfg, db, log: m => logs.push(m), sms: async (to, body) => { texts.push({ to, body }); } });
  const server = http.createServer(app);
  await new Promise(r => server.listen(0, "127.0.0.1", r));
  servers.push(server);
  const base = `http://127.0.0.1:${server.address().port}`;
  const lastCode = phone => { const t = [...texts].reverse().find(x => x.to === phone); return t && /(\d{6})/.exec(t.body)[1]; };
  function client(cookie0 = "") {
    let cookie = cookie0;
    const call = async (method, path, body, headers = {}) => {
      const res = await realFetch(base + path, { method, headers: { "content-type": "application/json", "x-shaghilni": "1", ...(cookie ? { cookie } : {}), ...headers },
        body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body) });
      const sc = res.headers.get("set-cookie");
      if (sc) cookie = sc.split(";")[0].endsWith("=") ? "" : sc.split(";")[0];
      const text = await res.text();
      let json = null; try { json = JSON.parse(text); } catch { /* not json */ }
      return { status: res.status, body: json, text, headers: res.headers };
    };
    return { call, get: p => call("GET", p), post: (p, b = {}) => call("POST", p, b), put: (p, b) => call("PUT", p, b), del: p => call("DELETE", p),
             get cookie() { return cookie; }, set cookie(v) { cookie = v; } };
  }
  async function login(phone, role = "seeker") {
    const c = client();
    const r = await c.post("/api/auth/code", { phone });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const v = await c.post("/api/auth/verify", { phone, code: lastCode(r.body.phone), role, accept: true });
    assert.equal(v.status, 200, JSON.stringify(v.body));
    return c;
  }
  return { cfg, db, app, base, texts, logs, lastCode, client, login };
}
const PROFILE = { v: 1, role: "seeker", name: "Omar Aziz", gov: "aleppo", langs: ["ar"], edu: { status: "bachelor", fac: "business" },
  exp: [{ id: "e1", role: "Cashier", org: "Souq shop", start: "2024-01", end: "2025-01", bullets: ["Handled cash for 200 customers a week"] }], skills: [] };
const JOB = { title: { en: "Storekeeper" }, gov: "aleppo", type: "full", level: "entry", pay: [1800000, 2200000], langs: ["ar"], summary: { en: "Keep the stock records." } };
async function employerWithLiveJob(S, admin, phone, name) {
  const e = await S.login(phone, "employer");
  await e.put("/api/employer/company", { company: { name: { en: name }, gov: "aleppo", regNo: `REG-${name}`, contactName: `Contact ${name}`, whatsapp: phone } });
  await e.post("/api/employer/company/submit");
  const co = (await admin.get("/api/admin/companies?status=pending")).body.companies.find(c => c.name.en === name);
  await admin.post(`/api/admin/companies/${co.id}/verify`, { screened: true });
  const job = (await e.post("/api/employer/jobs", { job: JOB, submit: true })).body.job;
  await admin.post(`/api/admin/jobs/${job.id}/approve`);
  return { e, jobId: job.id, companyId: co.id };
}

test("1 · consent: new accounts must accept the terms; acceptance is recorded and the code survives a missed tick", async () => {
  const S = await start(), c = S.client();
  await c.post("/api/auth/code", { phone: "0944 000 001" });
  const code = S.lastCode("+963944000001");
  assert.equal((await c.post("/api/auth/verify", { phone: "0944 000 001", code })).body.error, "terms_required");
  assert.equal((await c.post("/api/auth/verify", { phone: "0944 000 001", code, accept: true })).status, 200, "the same code works once the box is ticked");
  const u = S.db.get("SELECT terms_version, terms_accepted_at FROM users WHERE phone = ?", "+963944000001");
  assert.equal(u.terms_version, TERMS_VERSION);
  assert.ok(u.terms_accepted_at > 0);
  const cfg = (await c.get("/api/config")).body;
  assert.equal(cfg.termsVersion, TERMS_VERSION);
});

test("1 · data handling: export, deletion that erases texts and codes, employers leaving, and retention", async () => {
  const S = await start(), admin = await S.login("+12025550199");
  const { e, jobId } = await employerWithLiveJob(S, admin, "0955 100 001", "Halab Stores");
  const s = await S.login("0944 100 001");
  await s.put("/api/me/profile", { profile: PROFILE });
  const app = (await s.post(`/api/jobs/${jobId}/apply`, {})).body.application;
  await e.put(`/api/employer/applications/${app.id}`, { status: "shortlisted" });
  await new Promise(r => setTimeout(r, 20));
  const ex = await s.get("/api/me/export");
  assert.match(ex.headers.get("content-disposition"), /attachment/);
  assert.equal(ex.body.account.phone, "+963944100001");
  assert.equal(ex.body.account.termsVersion, TERMS_VERSION);
  assert.equal(ex.body.profile.name, "Omar Aziz");
  assert.equal(ex.body.applications.length, 1);
  assert.equal(ex.body.textMessages.length, 1, "the shortlisting text is part of the export");
  assert.equal((await e.get("/api/me/export")).body.company.name.en, "Halab Stores");
  const t = now();
  S.db.run("INSERT INTO otps (phone, code_hash, created_at, expires_at) VALUES ('+963900000000', 'x', ?, ?)", t - 25 * 3600e3, t - 24 * 3600e3);
  S.db.run("INSERT INTO notifications (phone, body, created_at) VALUES ('+963900000000', 'old', ?)", t - 91 * 86400e3);
  S.db.run("UPDATE sessions SET expires_at = 1 WHERE rowid = (SELECT MIN(rowid) FROM sessions)");
  const swept = S.app.cleanup();
  assert.ok(swept.otps >= 1 && swept.notifications === 1 && swept.sessions === 1, JSON.stringify(swept));
  assert.equal((await s.del("/api/me")).status, 200);
  assert.equal(S.db.get("SELECT COUNT(*) AS n FROM notifications WHERE phone = '+963944100001'").n, 0, "texts to a deleted account are erased");
  assert.equal(S.db.get("SELECT COUNT(*) AS n FROM otps WHERE phone = '+963944100001'").n, 0, "sign-in codes of a deleted account are erased");
  assert.equal((await e.del("/api/me")).status, 200);
  assert.ok(!(await S.client().get("/api/jobs")).body.jobs.some(j => j.id === jobId), "an employer who leaves takes their listings down");
  const co = JSON.parse(S.db.get("SELECT data FROM companies WHERE owner_id IS NOT NULL AND data LIKE '%Halab%'").data);
  assert.deepEqual([co.whatsapp, co.contactName], ["", ""], "contact details are removed from the company page");
});

test("2 · access control (the equivalent of row-level security): no account can reach another's data", async () => {
  const S = await start(), admin = await S.login("+12025550199");
  const a = await employerWithLiveJob(S, admin, "0955 200 001", "Alpha Co");
  const b = await employerWithLiveJob(S, admin, "0955 200 002", "Beta Co");
  const s1 = await S.login("0944 200 001"), s2 = await S.login("0944 200 002"), guest = S.client();
  await s1.put("/api/me/profile", { profile: PROFILE });
  const app = (await s1.post(`/api/jobs/${a.jobId}/apply`, {})).body.application;
  // employer B against employer A's listing and applicant
  assert.equal((await b.e.get(`/api/employer/jobs/${a.jobId}/applications`)).status, 404);
  assert.equal((await b.e.put(`/api/employer/applications/${app.id}`, { status: "rejected" })).status, 404);
  assert.equal((await b.e.put(`/api/employer/jobs/${a.jobId}`, { job: JOB })).status, 404);
  for (const act of ["submit", "close", "reopen"]) assert.equal((await b.e.post(`/api/employer/jobs/${a.jobId}/${act}`)).status, 404, act);
  // seeker 2 against seeker 1
  assert.equal((await s2.post(`/api/me/applications/${app.id}/withdraw`)).status, 404);
  assert.equal((await s2.get("/api/me/applications")).body.applications.length, 0);
  assert.equal((await s2.get("/api/me/export")).body.applications.length, 0);
  // roles
  for (const [who, path, method] of [[s1, "/api/employer", "GET"], [s1, "/api/admin/overview", "GET"], [a.e, "/api/me/profile", "PUT"], [a.e, "/api/admin/companies", "GET"], [a.e, `/api/jobs/${b.jobId}/apply`, "POST"], [a.e, "/api/resume/translate", "POST"], [s1, "/api/employer/students", "GET"], [a.e, "/api/me/invitations", "GET"], [a.e, "/api/me/recruit", "PUT"]])
    assert.equal((await who.call(method, path, method === "GET" ? undefined : {})).status, 403, path);
  for (const path of ["/api/employer", "/api/admin/overview", "/api/me/applications", "/api/me/export"]) assert.equal((await guest.get(path)).status, 401, path);
  // the public board carries no private company data
  const board = (await guest.get("/api/jobs")).text;
  for (const secret of ["+963955200001", "REG-Alpha Co", "Contact Alpha Co"]) assert.ok(!board.includes(secret), `public board leaks ${secret}`);
  // the database is never reachable from the browser: there is no SQL or table endpoint
  assert.equal((await guest.get("/api/sql?q=select")).status, 404);
});

test("3 · server-side validation: junk in every field of every endpoint never crashes the server", async () => {
  const S = await start({ values: { apiRateLimit: 1e6, writeRateLimit: 1e6 } }), admin = await S.login("+12025550199");
  const { e, jobId } = await employerWithLiveJob(S, admin, "0955 300 001", "Fuzz Co");
  const s = await S.login("0944 300 001");
  await s.put("/api/me/profile", { profile: PROFILE });
  const deep = JSON.parse("[".repeat(500) + "]".repeat(500));
  const junk = [undefined, null, [], "text", 123, true, { __proto__: null, polluted: true }, JSON.parse('{"__proto__":{"polluted":true}}'),
    { profile: [], job: "x", company: 5, phone: {}, code: [], items: "x", status: {}, note: { a: 1 }, pow: "x", accept: "yes", channel: 7, lang: [], jobId: {}, screened: "true", cvLang: ["en"] },
    { profile: { name: { $gt: "" }, exp: "x", edu: [], langs: "ar", tailor: { "__proto__": { x: 1 }, "1": { "__proto__": "y" } } }, job: { pay: ["a", {}], title: 5, langs: {}, recruits: [[1, 2]], duties: "x" } },
    { deep }];
  const ids = [jobId, "abc", "-1", "0", "99999999", "1e9", "%00", "..%2F"];
  const routes = [["POST", "/api/auth/code"], ["POST", "/api/auth/verify"], ["GET", "/api/auth/challenge"], ["GET", "/api/jobs/:id"], ["PUT", "/api/me/lang"],
    ["PUT", "/api/me/profile"], ["POST", "/api/me/saved/:id"], ["DELETE", "/api/me/saved/:id"], ["POST", "/api/jobs/:id/apply"], ["POST", "/api/me/applications/:id/withdraw"],
    ["POST", "/api/resume/suggest"], ["POST", "/api/resume/translate"], ["PUT", "/api/employer/company"], ["POST", "/api/employer/jobs"], ["PUT", "/api/employer/jobs/:id"], ["POST", "/api/employer/jobs/:id/submit"],
    ["GET", "/api/employer/jobs/:id/applications"], ["PUT", "/api/employer/applications/:id"], ["GET", "/api/admin/companies?status=%27;drop"], ["POST", "/api/admin/companies/:id/verify"],
    ["POST", "/api/admin/companies/:id/reject"], ["POST", "/api/admin/jobs/:id/approve"], ["POST", "/api/admin/jobs/:id/reject"], ["POST", "/api/admin/applications/:id/confirm-hire"],
    ["GET", "/api/admin/audit?limit=-5"], ["GET", "/api/admin/audit?limit=abc"], ["GET", "/api/admin/hires?state=%00"],
    ["GET", "/api/employer/students?fac=%27&year=abc&q=%00"], ["POST", "/api/employer/students/:id/invite"], ["GET", "/api/employer/invitations"],
    ["POST", "/api/employer/invitations/:id/withdraw"], ["PUT", "/api/me/recruit"], ["GET", "/api/me/invitations"],
    ["POST", "/api/me/invitations/:id/respond"], ["POST", "/api/me/invitations/:id/block"]];
  let calls = 0;
  for (const who of [S.client(), s, e, admin])
    for (const [method, path] of routes)
      for (const id of ids.slice(0, path.includes(":id") ? ids.length : 1))
        for (const body of method === "GET" ? [undefined] : junk) {
          const r = await who.call(method, path.replace(":id", id), body);
          calls++;
          // Never the unhandled-exception path; 5xx only as a deliberate "outside service unavailable" answer.
          const deliberate = ["ai_unavailable", "ai_error", "ai_bad_json", "sms_failed", "sms_capped"].includes(r.body?.error);
          assert.ok(r.body?.error !== "server_error" && (r.status < 500 || deliberate), `${method} ${path.replace(":id", id)} with ${JSON.stringify(body)?.slice(0, 60)} → ${r.status} ${r.text.slice(0, 120)}`);
        }
  assert.ok(calls > 1000, `${calls} requests`);
  assert.equal(({}).polluted, undefined, "no prototype pollution");
  const lim = await admin.get("/api/admin/audit?limit=-5");
  assert.ok(lim.body.entries.length <= 50 && lim.body.entries.length >= 1, "a negative limit does not mean 'everything'");
  const big = await s.put("/api/me/profile", { profile: { ...PROFILE, name: "x".repeat(300 * 1024) } });
  assert.equal(big.status, 413);
  assert.equal((await s.call("PUT", "/api/me/profile", "{not json")).body.error, "bad_json");
  assert.equal((await s.call("PUT", "/api/me/profile", "name=x", { "content-type": "application/x-www-form-urlencoded" })).status, 415);
  const saved = (await s.get("/api/me")).body.profile;
  assert.equal(saved.name, "Omar Aziz", "junk never overwrote the real profile");
});

test("4 · errors don't leak internals", async () => {
  const S = await start(), c = S.client();
  S.db.close();   // force a real internal failure
  const r = await c.get("/api/jobs");
  assert.equal(r.status, 500);
  assert.deepEqual(Object.keys(r.body), ["error"]);
  assert.equal(r.body.error, "server_error");
  assert.ok(!/sqlite|database|at \w|\/home|node:/i.test(r.text), r.text);
  assert.ok(S.logs.some(l => /\[error\]/.test(l)), "the details go to the server log instead");
  const n = await c.get("/api/does-not-exist");
  assert.deepEqual(n.body, { error: "not_found", detail: null });
});

test("5 · sign-in failure cases", async () => {
  const S = await start(), c = await S.login("0944 500 001");
  await c.put("/api/me/profile", { profile: PROFILE });
  const forged = S.client("shg_sid=" + "A".repeat(43));
  assert.equal((await forged.get("/api/me")).body.user, null, "a made-up session token is worthless");
  assert.equal((await forged.get("/api/me/applications")).status, 401);
  assert.equal((await S.client("shg_sid=" + "x".repeat(5000)).get("/api/me")).body.user, null, "oversized tokens are ignored");
  const stolen = c.cookie;
  await c.post("/api/auth/logout");
  assert.equal((await S.client(stolen).get("/api/me/applications")).status, 401, "signing out kills the session on the server, not just in the browser");
  const d = await S.login("0944 500 002");
  S.db.run("UPDATE sessions SET expires_at = 1");
  assert.equal((await d.get("/api/me")).body.user, null, "expired sessions stop working");
  const x = S.client();
  await x.post("/api/auth/code", { phone: "0944 500 003" });
  const codeA = S.lastCode("+963944500003");
  assert.equal((await x.post("/api/auth/verify", { phone: "0944 500 004", code: codeA, accept: true })).body.error, "code_expired", "a code only works for its own number");
  S.db.run("UPDATE otps SET expires_at = 1 WHERE phone = '+963944500003'");
  assert.equal((await x.post("/api/auth/verify", { phone: "0944 500 003", code: codeA, accept: true })).body.error, "code_expired", "codes expire");
  for (let i = 0; i < 3; i++) await x.post("/api/auth/code", { phone: "0944 500 005" });
  assert.equal((await x.post("/api/auth/code", { phone: "0944 500 005" })).status, 429);
  assert.equal((await S.client().post("/api/auth/verify", { phone: "0944 500 006", code: "12345" })).body.error, "bad_code");
  assert.equal((await S.client().post("/api/auth/code", { phone: "not a phone" })).body.error, "bad_phone");
  const P = await start({ env: { NODE_ENV: "production", OTP_PEPPER: "p".repeat(40), BASE_URL: "https://shaghilni.test", OTP_DEV_ECHO: "true", SMS_PROVIDER: "textbee", TEXTBEE_API_KEY: "k", CONTACT_EMAIL: "privacy@example.com" } });
  const pc = P.client(), sent = await pc.post("/api/auth/code", { phone: "0944 500 007" });
  assert.equal(sent.body.devCode, undefined, "production never shows codes, even with OTP_DEV_ECHO=true");
  const v = await pc.post("/api/auth/verify", { phone: "0944 500 007", code: P.lastCode("+963944500007"), accept: true });
  assert.match(v.headers.get("set-cookie"), /HttpOnly; SameSite=Lax; Max-Age=\d+; Secure/);
  assert.match((await pc.get("/")).headers.get("strict-transport-security"), /max-age=31536000/);
});

test("8 · translation: Claude never sees the name or phone, and translations that change a number are dropped", async () => {
  const S = await start({ values: { anthropicKey: "test-key" } }), s = await S.login("0944 080 001");
  const profile = { v: 1, role: "seeker", name: "لينا حداد", gov: "aleppo", langs: ["ar", "en"], edu: { status: "bachelor", fac: "business" },
    exp: [{ id: "e1", role: "محاسبة", org: "شركة الفرات", start: "2023-01", end: "2025-06", bullets: ["أدرت حسابات 40 عميلاً شهرياً", "أعددت تقارير شهرية للإدارة"] }],
    skills: ["Excel", "التواصل"], certs: [] };
  assert.equal((await s.put("/api/me/profile", { profile })).status, 200);
  const sent = [], itemsOf = prompt => JSON.parse(/Items:\n(\[.*\])/.exec(prompt)[1]);
  const answers = { "محاسبة": "Accountant", "شركة الفرات": "Al-Furat Company", "أعددت تقارير شهرية للإدارة": "Prepared monthly reports for management",
    "أدرت حسابات 40 عميلاً شهرياً": "Managed accounts for 45 clients a month",   // changes a number: must be dropped
    "التواصل": "التواصل" };                                                     // Arabic left in English: must be dropped
  globalThis.fetch = async (url, opts) => {
    if (!String(url).startsWith("https://api.anthropic.com")) return realFetch(url, opts);
    const prompt = JSON.parse(opts.body).messages[0].content; sent.push(prompt);
    const out = itemsOf(prompt).map(x => ({ i: x.i, t: answers[x.text] || x.text }));
    return new Response(JSON.stringify({ content: [{ type: "text", text: JSON.stringify(out) }] }), { status: 200 });
  };
  try {
    const r = await s.post("/api/resume/translate", { to: "en" });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.deepEqual(r.body.pairs.map(p => p[1]).sort(), ["Accountant", "Al-Furat Company", "Prepared monthly reports for management"]);
    assert.equal(r.body.skipped, 2);
    assert.ok(!sent[0].includes("لينا") && !sent[0].includes("944080001"), "the prompt carries no name and no phone number");
    assert.ok(!itemsOf(sent[0]).some(x => x.text === "Excel"), "text already in English isn't sent");
    const me = (await s.get("/api/me")).body.profile;
    me.tr = { en: [...r.body.pairs, ["أدرت حسابات 40 عميلاً شهرياً", "Managed accounts for 40 clients a month"], ["a line that no longer exists", "x"]], ar: [["Excel", "Excel"]] };
    me.nameEn = "Lina Haddad";
    assert.equal((await s.put("/api/me/profile", { profile: me })).status, 200);
    const saved = (await s.get("/api/me")).body.profile;
    assert.equal(saved.tr.en.length, 4, "pairs for text that isn't in the profile are pruned");
    assert.deepEqual(saved.tr.ar, [["Excel", "Excel"]]);
    assert.equal(saved.nameEn, "Lina Haddad");
    sent.length = 0;
    assert.equal((await s.post("/api/resume/translate", { to: "en" })).status, 200);
    assert.deepEqual(itemsOf(sent[0]).map(x => x.text), ["التواصل"], "a second request only sends what is still untranslated");
    assert.equal((await s.post("/api/resume/translate", { to: "fr" })).body.error, "bad_lang");
  } finally { globalThis.fetch = realFetch; }
});

test("9 · API keys never reach the browser", async () => {
  const secrets = ["sk-ant-" + "api03-" + "S".repeat(24), "tb_" + "T".repeat(30), "tw_" + "W".repeat(30), "pepper_" + "P".repeat(40)];
  const S = await start({ env: { SMS_PROVIDER: "console" }, values: { anthropicKey: secrets[0], otpPepper: secrets[3], sms: { provider: "console", textbeeKey: secrets[1], twilioToken: secrets[2] } } });
  const c = S.client(), page = (await c.get("/")).text;
  const assets = [...page.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map(m => m[1]);
  assert.ok(assets.length >= 3);
  const bodies = [page, ...(await Promise.all(assets.map(a => realFetch(S.base + a).then(r => r.text())))),
    (await c.get("/api/config")).text, (await c.get("/api/jobs")).text, (await c.get("/api/auth/challenge")).text, (await c.get("/api/me")).text];
  for (const b of bodies) for (const s of secrets) assert.ok(!b.includes(s), "a secret reached the browser");
  assert.deepEqual(scanSecrets(), [], "no secrets committed in the code");
});

test("10 · environment lockdown: production refuses unsafe settings, and the scanner passes a good setup", () => {
  const prod = extra => () => loadConfig({ skipDotEnv: true, env: { NODE_ENV: "production", OTP_PEPPER: "p".repeat(40), BASE_URL: "https://shaghilni.test", ...extra } });
  assert.throws(prod({ OTP_PEPPER: "" }), /OTP_PEPPER/);
  assert.throws(prod({ OTP_PEPPER: "short-secret" }), /at least 32/);
  assert.throws(prod({ BASE_URL: "" }), /BASE_URL/);
  assert.throws(prod({ BASE_URL: "http://shaghilni.test" }), /https/);
  const quiet = console.warn; console.warn = () => {};
  try { assert.doesNotThrow(prod({})); } finally { console.warn = quiet; }
  const good = { NODE_ENV: "production", OTP_PEPPER: "p".repeat(40), BASE_URL: "https://shaghilni.test", ADMIN_PHONES: "+963944000000", SMS_PROVIDER: "textbee",
    TEXTBEE_API_KEY: "key", CONTACT_EMAIL: "privacy@example.com", LEGAL_NAME: "Shaghilni LLC", TRUST_PROXY: "true", SEED_DEMO: "false" };
  const rows = auditSettings(good);
  assert.deepEqual(rows.filter(r => r[0] !== "PASS"), [], JSON.stringify(rows));
  const bad = auditSettings({ ...good, SMS_PROVIDER: "console", CONTACT_EMAIL: "", ADMIN_PHONES: "" });
  assert.equal(bad.filter(r => r[0] === "FAIL").length, 3);
});

test("11 · rate limits and cost caps: text destinations, daily text cap, AI caps, and a limit on every API call", async () => {
  const S = await start({ values: { smsDailyCap: 3, aiUserDailyCap: 1, aiDailyCap: 5, apiRateLimit: 40, anthropicKey: "test-key" } });
  const s = await S.login("0944 110 001");   // text 1 of 3
  await s.put("/api/me/profile", { profile: PROFILE });
  const job = (await s.get("/api/jobs")).body.jobs[0];
  globalThis.fetch = async (url, opts) => (String(url).startsWith("https://api.anthropic.com")
    ? new Response(JSON.stringify({ content: [{ type: "text", text: '[{"id":"b1","text":"Handled cash for 200 customers weekly","question":""}]' }] }), { status: 200 })
    : realFetch(url, opts));
  const items = [{ role: "Cashier", text: "Handled cash for 200 customers a week" }];
  assert.equal((await s.post("/api/resume/suggest", { jobId: job.id, items })).status, 200);
  assert.equal((await s.post("/api/resume/suggest", { jobId: job.id, items })).body.error, "ai_capped", "a person's daily AI cap");
  globalThis.fetch = realFetch;
  const c = S.client();
  assert.equal((await c.post("/api/auth/code", { phone: "+2348031234567" })).body.error, "phone_region", "texts only go to Syria and the countries where most Syrians abroad live");
  assert.equal((await c.post("/api/auth/code", { phone: "+12025550199" })).status, 200, "admin numbers abroad are allowed");   // text 2
  assert.equal((await c.post("/api/auth/code", { phone: "0944 110 002" })).status, 200);   // text 3
  assert.equal((await c.post("/api/auth/code", { phone: "0944 110 003" })).body.error, "sms_capped", "the daily cap stops texts, and the cost");
  assert.ok(S.logs.some(l => /daily text cap/.test(l)), "and tells the admins in the log");
  let limited = false;
  for (let i = 0; i < 45 && !limited; i++) limited = (await c.get("/api/health")).status === 429;
  assert.ok(limited, "every API call counts towards the per-address limit");
});

test("12 · proof-of-work challenge (the CAPTCHA) and cross-site request rules (CORS and CSRF)", async () => {
  const S = await start({ env: { BASE_URL: "http://good.test" }, values: { powBits: 8 } }), c = S.client();
  const ch = (await c.get("/api/auth/challenge")).body;
  assert.equal(ch.bits, 8);
  assert.equal((await c.post("/api/auth/code", { phone: "0944 120 001" })).body.error, "pow_required");
  let wrong = 0; while (leadingZeroBits(createHash("sha256").update(`${ch.challenge}:${wrong}`).digest()) >= 8) wrong++;
  assert.equal((await c.post("/api/auth/code", { phone: "0944 120 001", pow: { challenge: ch.challenge, nonce: wrong } })).body.error, "pow_invalid");
  const forged = ch.challenge.replace(/\.([0-9a-f])/, (m, d) => "." + (d === "0" ? "1" : "0"));
  assert.equal((await c.post("/api/auth/code", { phone: "0944 120 001", pow: { challenge: forged, nonce: 1 } })).body.error, "pow_invalid", "challenges can't be edited");
  const ctx = { setTimeout }; vm.createContext(ctx);
  vm.runInContext(readFileSync(new URL("../public/js/pow.js", import.meta.url), "utf8") + ";this.solve = solvePow;", ctx);
  const nonce = await ctx.solve(ch.challenge, ch.bits);   // the browser's own solver
  assert.equal((await c.post("/api/auth/code", { phone: "0944 120 001", pow: { challenge: ch.challenge, nonce } })).status, 200, "the browser's solution is accepted");
  assert.equal((await c.post("/api/auth/code", { phone: "0944 120 002", pow: { challenge: ch.challenge, nonce } })).body.error, "pow_invalid", "each challenge works once");
  const evil = await c.call("POST", "/api/auth/code", { phone: "0944 120 003" }, { origin: "https://evil.example" });
  assert.deepEqual([evil.status, evil.body.error], [403, "csrf"], "writes from other sites are refused");
  assert.notEqual((await c.call("POST", "/api/auth/code", { phone: "x" }, { origin: "http://good.test" })).status, 403, "our own origin is fine");
  assert.equal((await c.call("POST", "/api/auth/code", { phone: "x" }, { "x-shaghilni": "" })).body.error, "csrf", "no app header, no write");
  const pre = await realFetch(S.base + "/api/jobs", { method: "OPTIONS", headers: { origin: "https://evil.example", "access-control-request-method": "POST", "access-control-request-headers": "x-shaghilni" } });
  assert.equal(pre.status, 403);
  assert.equal(pre.headers.get("access-control-allow-origin"), null, "no CORS permission for other sites");
  const read = await realFetch(S.base + "/api/jobs", { headers: { origin: "https://evil.example" } });
  assert.equal(read.headers.get("access-control-allow-origin"), null, "so other sites can't read responses either");
  const home = await realFetch(S.base + "/");
  assert.doesNotMatch(home.headers.get("content-security-policy"), /googleapis|gstatic/, "fonts are self-hosted");
  assert.equal(home.headers.get("cross-origin-resource-policy"), "same-origin");
  assert.equal((await realFetch(S.base + "/fonts/ibm-plex-sans-arabic-arabic-400-normal.woff2")).headers.get("content-type"), "font/woff2");
  const port = new URL(S.base).port;
  for (const trick of ["/fonts/../server/config.js", "/fonts/..%2f..%2fserver%2fconfig.js", "/assets/../../server/config.js", "/fonts/%2e%2e/%2e%2e/.env"]) {
    const raw = await new Promise((res, rej) => http.get({ host: "127.0.0.1", port, path: trick }, r => { let b = ""; r.on("data", d => { b += d; }); r.on("end", () => res(b)); }).on("error", rej));
    assert.ok(!raw.includes("loadConfig") && !raw.includes("OTP_PEPPER"), `path trick ${trick} reached a server file`);
  }
});

test("13 · the built-in scanner finds the problems it is meant to find, and the shipped code is clean", () => {
  const tmp = mkdtempSync(path.join(os.tmpdir(), "shg-scan-"));
  mkdirSync(path.join(tmp, "public")); mkdirSync(path.join(tmp, "server"));
  writeFileSync(path.join(tmp, "public", "index.html"), '<html><script>alert(1)</script><script src="https://cdn.example/x.js"></script></html>');
  writeFileSync(path.join(tmp, "server", "bad.js"), ["const key = '" + "sk-ant-" + "api03-" + "Z".repeat(30) + "';",
    "db.all(`SELECT * FROM users WHERE id = ${id}`);", "el.innerHTML = userInput;", "eval(code);"].join("\n"));
  const secrets = scanSecrets(tmp), code = scanCode(tmp);
  assert.ok(secrets.some(x => /Anthropic API key/.test(x)), secrets.join("; "));
  for (const kind of [/SQL built/, /Raw HTML/, /Dynamic code/, /Inline <script>/, /another site/]) assert.ok(code.some(x => kind.test(x)), `${kind} not caught: ${code.join("; ")}`);
  assert.deepEqual(scanSecrets(), [], "no secrets in the shipped code");
  assert.deepEqual(scanCode(), [], "no unreviewed risky patterns in the shipped code");
});

test("14 · the scanner stays clean for a correct production setup whether or not SEED_DEMO is set: sample listings are never seeded in production", () => {
  const good = { NODE_ENV: "production", OTP_PEPPER: "p".repeat(40), BASE_URL: "https://shaghilni.test", ADMIN_PHONES: "+963944000000", SMS_PROVIDER: "textbee",
    TEXTBEE_API_KEY: "key", CONTACT_EMAIL: "privacy@example.com", LEGAL_NAME: "Example Org (not a real entity)", TRUST_PROXY: "true" };
  for (const seed of [undefined, "true", "false"]) {
    const rows = auditSettings(seed === undefined ? good : { ...good, SEED_DEMO: seed });
    assert.deepEqual(rows.filter(r => r[0] !== "PASS"), [], `SEED_DEMO=${seed}: ${JSON.stringify(rows)}`);
  }
});

test("15 · the scanner fails settings that would run a public host in development mode, and catches the shipped .env.example copied as is", () => {
  const good = { NODE_ENV: "production", OTP_PEPPER: "p".repeat(40), BASE_URL: "https://shaghilni.test", ADMIN_PHONES: "+963944000000", SMS_PROVIDER: "textbee",
    TEXTBEE_API_KEY: "key", CONTACT_EMAIL: "privacy@example.com", LEGAL_NAME: "Example Org (not a real entity)", TRUST_PROXY: "true" };
  const failsOn = (rows, re) => rows.some(r => r[0] === "FAIL" && re.test(r[1]));
  assert.ok(failsOn(auditSettings({ ...good, NODE_ENV: "development" }), /NODE_ENV/), "development mode on a public host echoes codes and uses the built-in pepper: a FAIL, not a warning");
  assert.ok(failsOn(auditSettings(Object.fromEntries(Object.entries(good).filter(([k]) => k !== "NODE_ENV"))), /NODE_ENV/), "unset counts as development");
  assert.deepEqual(auditSettings(good).filter(r => r[0] !== "PASS"), [], "a correct production setup still passes cleanly");
  const template = parseEnvFile(new URL("../.env.example", import.meta.url).pathname);
  assert.ok(failsOn(auditSettings(template), /NODE_ENV/), "the template copied unchanged to a server is caught");
  assert.equal(template.OTP_DEV_ECHO, undefined, "the template does not switch on code echo by itself");
});

test("16 · sample listings are never seeded in production, whatever SEED_DEMO says; development and tests unchanged; leftover rows are counted", () => {
  const prodEnv = { NODE_ENV: "production", OTP_PEPPER: "p".repeat(40), BASE_URL: "https://shaghilni.test", ADMIN_PHONES: "+963944000000", SMS_PROVIDER: "textbee", TEXTBEE_API_KEY: "k", CONTACT_EMAIL: "privacy@example.com" };
  const cfgOf = env => { const quiet = console.warn, warned = []; console.warn = m => warned.push(String(m)); try { return { cfg: loadConfig({ skipDotEnv: true, isolated: true, env }), warned }; } finally { console.warn = quiet; } };
  assert.equal(cfgOf(prodEnv).cfg.seedDemo, false, "production with SEED_DEMO unset never seeds");
  const loud = cfgOf({ ...prodEnv, SEED_DEMO: "true" });
  assert.equal(loud.cfg.seedDemo, false, "production with SEED_DEMO=true still never seeds");
  assert.ok(loud.warned.some(m => /SEED_DEMO/.test(m)), "and says so in the log: " + JSON.stringify(loud.warned));
  assert.equal(cfgOf({ ...prodEnv, SEED_DEMO: "false" }).cfg.seedDemo, false);
  assert.equal(cfgOf({ NODE_ENV: "development" }).cfg.seedDemo, true, "development seeds by default");
  assert.equal(cfgOf({ NODE_ENV: "test" }).cfg.seedDemo, true, "so do tests");
  assert.equal(cfgOf({ NODE_ENV: "development", SEED_DEMO: "false" }).cfg.seedDemo, false, "and both can opt out");
  // A database that already holds sample rows is counted, so the start-up log and the admin screen can say so.
  const db = openDb(":memory:");
  assert.deepEqual(countDemo(db), { companies: 0, jobs: 0 });
  seedDemo(db, () => {});
  assert.deepEqual(countDemo(db), { companies: 17, jobs: 18 });
  db.run("DELETE FROM jobs WHERE is_demo = 1"); db.run("DELETE FROM companies WHERE is_demo = 1");
  assert.deepEqual(countDemo(db), { companies: 0, jobs: 0 }, "nothing left after npm run demo:remove");
});

test("17 · a number taken out of ADMIN_PHONES loses the admin role at its next sign-in, and its open sessions end (D-17)", async () => {
  const S = await start(), admin = await S.login("+12025550199");
  assert.equal((await admin.get("/api/admin/overview")).status, 200, "an admin while the number is listed");
  // the same database served by a second process whose ADMIN_PHONES no longer lists the number (a redeploy with a changed setting)
  const cfg2 = loadConfig({ skipDotEnv: true, isolated: true, env: { NODE_ENV: "test", ADMIN_PHONES: "" }, values: { powBits: 0, anthropicKey: "" } });
  const srv2 = http.createServer(createApp({ cfg: cfg2, db: S.db, log: () => {}, sms: async (to, body) => { S.texts.push({ to, body }); } }));
  await new Promise(r => srv2.listen(0, "127.0.0.1", r)); servers.push(srv2);
  const base2 = `http://127.0.0.1:${srv2.address().port}`; let jar = "";
  const call2 = async (method, path, body) => { const res = await realFetch(base2 + path, { method, headers: { "content-type": "application/json", "x-shaghilni": "1", ...(jar ? { cookie: jar } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) }); const sc = res.headers.get("set-cookie"); if (sc) jar = sc.split(";")[0]; return { status: res.status, body: await res.json().catch(() => null) }; };
  const r = await call2("POST", "/api/auth/code", { phone: "+12025550199" }); assert.equal(r.status, 200);
  const v = await call2("POST", "/api/auth/verify", { phone: "+12025550199", code: S.lastCode("+12025550199"), role: "seeker", accept: true });
  assert.equal(v.status, 200); assert.equal(v.body.user.role, "seeker", "D-17: signed in as an ordinary account, not an admin");
  assert.equal((await call2("GET", "/api/admin/overview")).status, 403, "D-17: the admin routes are closed to the new session");
  assert.equal(S.db.get("SELECT role FROM users WHERE phone = ?", "+12025550199").role, "seeker", "the role is changed in the database");
  assert.equal((await admin.get("/api/admin/overview")).status, 401, "D-17: the session opened while the number was an admin has ended");
  assert.deepEqual(S.db.all("SELECT action, data FROM audit WHERE action = 'user.demoted'").map(x => [x.action, JSON.parse(x.data)]), [["user.demoted", { from: "admin", to: "seeker" }]], "the demotion is in the audit log");
});

test("18 · no invented domain, address or entity in the code or the copy (R6, D-20)", () => {
  const dir = new URL("../", import.meta.url), files = [];
  const walk = d => { for (const f of readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); if (f.isDirectory()) walk(p); else if (f.name.endsWith(".js")) files.push(p); } };
  for (const sub of ["server", "public/js", "scripts"]) walk(path.join(dir.pathname, sub));
  const INVENTED = /shaghilni\.sy\b|@company\.com|our US company|شركتنا في الولايات المتحدة|shaghilni\.com\b/;
  const hits = files.flatMap(f => readFileSync(f, "utf8").split("\n").map((l, i) => (INVENTED.test(l) ? `${path.relative(dir.pathname, f)}:${i + 1}: ${l.trim().slice(0, 100)}` : null)).filter(Boolean));
  assert.deepEqual(hits, [], "invented domains or entities (placeholders must be obviously fake: example.com, jobs.example):\n" + hits.join("\n"));
  const prod = extra => () => loadConfig({ skipDotEnv: true, env: { NODE_ENV: "production", OTP_PEPPER: "p".repeat(40), BASE_URL: "https://shaghilni.test", ...extra } });
  assert.throws(prod({ BASE_URL: "" }), e => /BASE_URL/.test(e.message) && !/shaghilni\.sy/.test(e.message), "the BASE_URL error names an example domain, not an invented real-looking one");
});
