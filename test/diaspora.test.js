/* Syrians abroad: signing in from another country, living outside Syria, job alerts, and jobs that welcome people coming home. */
import { test, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { readFileSync } from "node:fs";
import { loadConfig } from "../server/config.js";
import { openDb } from "../server/db.js";
import { createApp } from "../server/app.js";
import { seedDemo } from "../server/seed.js";
import * as coreMod from "../server/core.js";
import { parseEnvFile } from "../scripts/security-check.js";

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


test("diaspora: numbers abroad can sign in, within their own daily cap; a profile can live outside Syria", async () => {
  const S = await start({ SMS_INTL_DAILY_CAP: "2" }), c = S.client();
  const de = await c.post("/api/auth/code", { phone: "+49 1512 3456789" });
  assert.equal(de.status, 200, "a German number gets a code"); assert.equal(de.body.phone, "+4915123456789");
  assert.equal((await c.post("/api/auth/code", { phone: "+2348031234567" })).body.error, "phone_region", "countries off the list still get nothing");
  assert.equal((await c.post("/api/auth/code", { phone: "+90 532 123 4567" })).status, 200);
  assert.equal((await c.post("/api/auth/code", { phone: "+46 70 123 4567" })).body.error, "sms_capped", "international texts stop at their own cap");
  assert.equal((await c.post("/api/auth/code", { phone: "0944 120 001" })).status, 200, "Syrian numbers are not affected by the international cap");
  const s = await S.login("0933 740 001");
  const p = { ...GRAD, gov: "abroad", country: "de", relocate: true };
  assert.equal((await s.put("/api/me/profile", { profile: p })).status, 200);
  const me = (await s.get("/api/me")).body.profile; assert.deepEqual([me.gov, me.country], ["abroad", "de"]);
  const R = S.core.buildResume(me, "general", "en"); assert.ok(R.contact.some(x => /Germany/.test(x)), "the resume says where they live");
  // D-25: the fit caption says where they live too, through placeOf, which the app's fit box must use (app.js has no test runtime: the source is pinned)
  const cap = l => S.core.fill(S.core.STR[l].whyCapAlt, { edu: "x", home: S.core.placeOf(me)[l] });
  assert.match(cap("en"), /living in Germany/); assert.match(cap("ar"), /مقيم في ألمانيا/); assert.doesNotMatch(cap("en") + cap("ar"), /living in \.|مقيم في \./);
  const app = readFileSync(new URL("../public/js/app.js", import.meta.url), "utf8");
  assert.ok(!app.includes("home: L(GOV[P.gov])") && app.includes("home: L(placeOf(P))"), "D-25: the fit box builds {home} with placeOf, so people abroad do not read \"living in .\"");
  assert.equal((await s.put("/api/me/profile", { profile: { ...GRAD, gov: "abroad", country: "atlantis" } })).status, 200);
  assert.equal((await s.get("/api/me")).body.profile.country, "other", "an unknown country is stored as another country");
  const base = (await S.client().get("/api/jobs")).body.jobs[0], remote = { ...base, gov: "remote" }, onsite = { ...base, gov: "damascus", returnees: true };
  assert.equal(S.core.fitFor(me, remote).parts.find(x => x.key === "placeRemote").state, "ok", "remote jobs fit people abroad");
  assert.equal(S.core.fitFor(me, onsite).parts.find(x => x.key === "placeReturn").state, "part", "and jobs that welcome returnees count for them");
});

test("job alerts: save a search, count new matches, and get one digest a day by email or text", async () => {
  const mails = [];
  const S = await start({}, { email: async (to, subject, text) => { mails.push({ to, subject, text }); } }), admin = await S.login("+12025550199");
  const { e } = await employer(S, admin, "0955 740 001", "Qasioun Advisory");
  const s = await S.login("0933 740 002"); await s.put("/api/me/profile", { profile: { ...GRAD, email: "omar@example.com" } });
  const t = await S.login("0933 740 003"); await t.put("/api/me/profile", { profile: GRAD });
  assert.equal((await e.get("/api/me/alerts")).status, 403, "alerts are for job seekers");
  const a1 = await s.post("/api/me/alerts", { alert: { q: "Accountant", gov: "damascus", tab: "nope" }, channel: "email" });
  assert.equal(a1.status, 200); assert.deepEqual([a1.body.alert.q, a1.body.alert.gov, a1.body.alert.tab, a1.body.alert.channel], ["Accountant", "damascus", "", "email"]);
  assert.equal((await s.post("/api/me/alerts", { alert: { q: "Accountant", gov: "damascus" }, channel: "email" })).body.error, "alert_exists");
  assert.equal((await t.post("/api/me/alerts", { alert: { gov: "damascus" }, channel: "sms" })).body.alert.channel, "sms");
  const jid = await publish(S, admin, e, { title: { en: "Junior Accountant", ar: "محاسب مبتدئ" }, gov: "damascus" });
  const other = await publish(S, admin, e, { title: { en: "Driver", ar: "سائق" }, gov: "aleppo" });
  const list = (await s.get("/api/me/alerts")).body;
  assert.equal(list.alerts[0].newCount, 1, "only the matching job counts"); assert.equal(list.emailOn, true);
  assert.equal((await s.get("/api/me")).body.alertsNew, 1, "and the app can show it");
  const run1 = await S.app.runAlerts(); assert.equal(run1.sent, 2, "one email and one text");
  assert.equal(mails.length, 1); assert.equal(mails[0].to, "omar@example.com"); assert.match(mails[0].text, new RegExp(`/lite/job/${jid}`)); assert.doesNotMatch(mails[0].text, new RegExp(`/lite/job/${other}\\b`));
  assert.ok(S.texts.some(x => /new jobs for your alert|وظائف جديدة لتنبيهك/.test(x.body)), "the text goes through the usual notifier");
  await publish(S, admin, e, { title: { en: "Senior Accountant", ar: "محاسب أول" }, gov: "damascus" });
  assert.equal((await S.app.runAlerts()).sent, 0, "at most one digest a day");
  assert.equal((await S.app.runAlerts(Date.now() + 86400e3)).sent, 2, "the next day, the new job is sent");
  await s.post("/api/me/alerts/seen"); assert.equal((await s.get("/api/me/alerts")).body.alerts[0].newCount, 0);
  for (let i = 0; i < 4; i++) await s.post("/api/me/alerts", { alert: { q: "x" + i } });
  assert.equal((await s.post("/api/me/alerts", { alert: { q: "x9" } })).body.error, "alert_limit", "up to 5 alerts");
  assert.equal((await s.del(`/api/me/alerts/${a1.body.alert.id}`)).status, 200);
  assert.equal((await t.del(`/api/me/alerts/${a1.body.alert.id}`)).status, 404, "nobody can delete someone else's alert");
  const exp = (await s.get("/api/me/export")).body; assert.equal(exp.jobAlerts.length, 4, "alerts are in the data export");
});

test("returnees: employers can say they welcome Syrians coming home, and people can filter for it", async () => {
  const S = await start(), admin = await S.login("+12025550199"), { e } = await employer(S, admin, "0955 740 010", "Qasioun Advisory");
  const jid = await publish(S, admin, e, { returnees: true });
  const j = (await S.client().get("/api/jobs")).body.jobs.find(x => x.id === jid); assert.equal(j.returnees, true);
  assert.equal(S.core.alertMatches({ tab: "returnees" }, j), true); assert.equal(S.core.alertMatches({ tab: "returnees" }, { ...j, returnees: false }), false);
  // D-13: the demo marks its own multinational listings as welcoming returnees; a real multinational employer's listing is never rewritten, on any later start
  const real = await S.login("0955 740 011", "employer");
  await real.put("/api/employer/company", { company: { name: { en: "Orontes Global" }, cat: "multinational", gov: "damascus", regNo: "REG-OG", contactName: "Contact", whatsapp: "0955 740 011" } });
  await real.post("/api/employer/company/submit");
  const co = (await admin.get("/api/admin/companies?status=pending")).body.companies.find(c => c.name.en === "Orontes Global"); await admin.post(`/api/admin/companies/${co.id}/verify`, { screened: true });
  const realId = await publish(S, admin, real, { returnees: false });
  assert.equal(seedDemo(S.db, () => {}), false, "a second start seeds nothing");
  const after = (await S.client().get("/api/jobs")).body.jobs;
  assert.equal(after.find(x => x.id === realId).returnees, false, "the real employer's listing keeps returnees: false (D-13)");
  assert.equal(S.db.get("SELECT json_extract(data, '$.returnees') AS r FROM jobs WHERE id = ?", realId).r, 0);
  assert.ok(after.filter(x => x.demo && x.co.en === "Chevron").every(x => x.returnees === true), "the demo's own multinational listings still say so");
});

test("diaspora: the shipped .env.example keeps the default destinations (Syria plus the diaspora countries) instead of narrowing texts to Syria", () => {
  const template = parseEnvFile(new URL("../.env.example", import.meta.url).pathname);
  const cfg = loadConfig({ skipDotEnv: true, isolated: true, env: { ...template, NODE_ENV: "test" } });
  for (const p of ["+963", "+49", "+90", "+961", "+1"]) assert.ok(cfg.smsAllowedPrefixes.includes(p), `${p} is allowed with the template settings (got ${cfg.smsAllowedPrefixes.join(",")})`);
});

test("diaspora: an international number typed with Arabic-Indic or Persian digits signs in and can be invited to a team (D-19)", async () => {
  const S = await start(), admin = await S.login("+12025550199"), c = S.client();
  const r1 = await c.post("/api/auth/code", { phone: "+٤٩١٥١٢٣٤٥٦٧٨٩" }); assert.equal(r1.status, 200, r1.text); assert.equal(r1.body.phone, "+4915123456789", "Arabic-Indic digits");
  const r2 = await c.post("/api/auth/code", { phone: "+۴۹۱۵۱۲۳۴۵۶۷۸۸" }); assert.equal(r2.status, 200, r2.text); assert.equal(r2.body.phone, "+4915123456788", "Persian digits");
  const { e } = await employer(S, admin, "0955 745 001", "Digits Co");
  assert.equal((await e.post("/api/employer/team", { name: "Hans", phone: "+٤٩١٥١٢٣٤٥٦٧٨٠", role: "recruiter" })).status, 200, "a teammate abroad can be invited with Arabic-Indic digits");
  assert.equal((await e.get("/api/employer/team")).body.invites[0].phone, "+4915123456780", "and is stored in E.164");
});
