/* Traffic and system health for the Shaghilni team: counted privately by our own server. */
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


const PHONE = "Mozilla/5.0 (Linux; Android 12; SM-A125F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36";
const H = (ua, extra = {}) => ({ "content-type": "application/json", "x-shaghilni": "1", "user-agent": ua, ...extra });
const beacon = (S, path, body, headers) => fetch(S.base + path, { method: "POST", headers, body: JSON.stringify(body) });
test("traffic: page views counted privately; crawlers and do-not-track left out; link previews counted as shares", async () => {
  const S = await start(), admin = await S.login("+12025550199"), seeker = await S.login("0933 840 101");
  await beacon(S, "/api/t", { path: "/job/123", first: true, ref: "https://l.facebook.com/l.php", lang: "ar", role: "guest", conn: "3g", loadMs: 2400 }, H(PHONE));
  await beacon(S, "/api/t", { path: "/applications", lang: "ar", role: "seeker" }, H(PHONE));
  await beacon(S, "/api/t", { path: "/jobs", first: true, utmSource: "WhatsApp", utmCampaign: "Homs-Careers-Day", lang: "ar" }, H(PHONE.replace("SM-A125F", "Pixel 6")));
  await beacon(S, "/api/t", { path: "/jobs", first: true }, H("Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"));
  await beacon(S, "/api/t", { path: "/jobs", first: true }, H(PHONE, { dnt: "1" }));
  await fetch(S.base + "/", { headers: { "user-agent": "WhatsApp/2.23.20.0 A" } });
  // Lite, from a different phone and browser (Opera Mini): a separate visitor and visit
  await fetch(S.base + "/lite", { headers: { "user-agent": "Opera/9.80 (Android; Opera Mini/36.2.2254/119.132; U; en) Presto/2.12.423 Version/12.16", "accept-language": "en-GB,en;q=0.9" } });
  await beacon(S, "/api/t/error", { message: "TypeError: x is undefined", source: "/app.js:10", path: "/resume" }, H(PHONE));
  const rows = S.db.all("SELECT * FROM pageviews");
  assert.equal(rows.length, 4, "three app pages and one Lite page; the crawler and the do-not-track browser aren't counted");
  assert.ok(!Object.keys(rows[0]).some(k => /^ip|_ip$|address/i.test(k)) && !/127\.0\.0\.1|::1/.test(JSON.stringify(rows)), "no IP addresses stored");
  assert.ok(rows.some(r => r.path === "/job/:id") && !rows.some(r => r.path.includes("123")), "job numbers fold into one page");
  assert.equal(S.db.get("SELECT app FROM shares").app, "whatsapp", "a WhatsApp link preview is a share, not a visit");
  assert.equal((await seeker.get("/api/admin/traffic")).status, 403); assert.equal((await seeker.get("/api/admin/system")).status, 403);
  const R = (await admin.get("/api/admin/traffic?days=7")).body;
  assert.equal(R.totals.views, 4); assert.ok(R.totals.visitors >= 2 && R.totals.visits >= 2); assert.ok(R.now >= 2, "visitors right now");
  const src = Object.fromEntries(R.sources.map(x => [x.key, x.n]));
  assert.ok(src.facebook === 1 && src.whatsapp === 1, "Facebook from the link it came from; WhatsApp from the campaign tag");
  assert.deepEqual(R.campaigns, [{ key: "homs-careers-day", n: 1 }]);
  assert.deepEqual(R.shares.byApp, [{ key: "whatsapp", n: 1 }]);
  assert.ok(R.devices.every(d => d.key === "phone")); assert.ok(R.browsers.some(b => b.key === "Opera Mini"), "Opera Mini is recognised"); assert.deepEqual(R.connections, [{ key: "3g", n: 1 }]); assert.equal(R.speed.median, 2400);
  assert.ok(R.variants.some(v => v.key === "lite") && R.languages.some(l => l.key === "en"), "Lite pages count, in the language Lite would use");
  assert.equal(R.errors[0].key, "TypeError: x is undefined");
  assert.ok(R.pages.some(p => p.key === "/job/:id")); assert.ok(R.funnel.signups >= 1);
  const Y = (await admin.get("/api/admin/system")).body;
  assert.ok(Y.requests.lastHour.n > 5 && Y.requests.lastHour.failed === 0); assert.equal(Y.rows.pageviews, 4); assert.ok(Y.uptimeSeconds >= 0 && Y.memoryMb > 0);
  S.db.run("UPDATE pageviews SET at = ? WHERE id = ?", Date.now() - 200 * 86400e3, rows[0].id);
  assert.ok(S.app.cleanup().traffic >= 1, "page views are deleted after 180 days");
});
