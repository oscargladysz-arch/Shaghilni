/* End-to-end API tests: the real app, an in-memory database, captured text messages and a stubbed Claude API. */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { loadConfig } from "../server/config.js";
import { openDb } from "../server/db.js";
import { createApp } from "../server/app.js";
import { seedDemo } from "../server/seed.js";

const ADMIN = "+12025550123", SEEKER = "0944 111 222", SEEKER2 = "0944 333 444", EMPLOYER = "0955 666 777";
const texts = [];
let server, base, db;
const realFetch = globalThis.fetch;

before(async () => {
  const cfg = loadConfig({ skipDotEnv: true, isolated: true, env: { NODE_ENV: "test", ADMIN_PHONES: ADMIN, SEED_DEMO: "true" }, values: { anthropicKey: "test-key", powBits: 0 } });
  db = openDb(":memory:");
  seedDemo(db, () => {});
  const app = createApp({ cfg, db, log: () => {}, sms: async (to, body) => { texts.push({ to, body }); } });
  server = http.createServer(app);
  await new Promise(r => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => { server.close(); globalThis.fetch = realFetch; });

function client() {
  let cookie = "";
  const call = async (method, path, body, headers = {}) => {
    const res = await realFetch(base + path, { method, headers: { "content-type": "application/json", "x-shaghilni": "1", ...(cookie ? { cookie } : {}), ...headers },
      body: body === undefined ? undefined : JSON.stringify(body) });
    const sc = res.headers.get("set-cookie");
    if (sc) cookie = sc.split(";")[0].endsWith("=") ? "" : sc.split(";")[0];
    const text = await res.text();
    let json = null; try { json = JSON.parse(text); } catch { /* not json */ }
    return { status: res.status, body: json, text, headers: res.headers };
  };
  return { call, get: p => call("GET", p), post: (p, b = {}) => call("POST", p, b), put: (p, b) => call("PUT", p, b), del: p => call("DELETE", p) };
}
const lastCode = phone => { const t = [...texts].reverse().find(x => x.to === phone); return t && /(\d{6})/.exec(t.body)[1]; };
async function login(c, phone, role, lang = "en") {
  const r1 = await c.post("/api/auth/code", { phone, lang });
  assert.equal(r1.status, 200, JSON.stringify(r1.body));
  const e = r1.body.phone;
  const r2 = await c.post("/api/auth/verify", { phone, code: lastCode(e), role, lang, accept: true });
  assert.equal(r2.status, 200, JSON.stringify(r2.body));
  return r2.body.user;
}
const PROFILE = { v: 1, role: "student", name: "Lina Haddad", gov: "damascus", langs: ["ar", "en"], email: "lina@example.com",
  edu: { status: "student", uni: "hiba", fac: "business", year: 3, grad: 2027 }, prefs: { types: ["intern"], fields: ["business"] },
  exp: [{ id: "e1", role: "Sales intern", org: "Katakit", start: "2025-06", end: "2025-08", bullets: ["Helped with stock counts", "Served 40 customers a day"] }],
  acts: [], skills: ["Excel"], hacker: "<script>" };
const JOB = { title: { en: "Junior accountant", ar: "محاسب مبتدئ" }, gov: "damascus", place: { en: "Mazzeh office" }, type: "full", level: "entry",
  pay: [2500000, 3200000], langs: ["ar"], summary: { ar: "مسك الدفاتر وإعداد الفواتير" }, duties: { ar: ["إعداد الفواتير", "مطابقة الحسابات"] },
  needs: { ar: ["خريج تجارة واقتصاد"] }, provides: { ar: ["راتب شهري"] }, recruits: [["damascus", "economics"]], openings: 2 };

let seeker, employer, admin, employerJobId, seekerAppId;

test("public board lists the seeded demo jobs", async () => {
  const c = client(), r = await c.get("/api/jobs");
  assert.equal(r.status, 200);
  assert.equal(r.body.jobs.length, 19);
  const j = r.body.jobs.find(x => x.co.en === "Chevron");
  assert.ok(j.title.en && j.title.ar && Array.isArray(j.duties.en) && j.demo === true && j.hasWhatsapp === false);
  assert.equal((await c.get(`/api/jobs/${j.id}`)).body.job.id, j.id);
  assert.equal((await c.get("/api/jobs/99999")).status, 404);
});

test("sign-in: validation, wrong codes, Arabic digits, CSRF and rate limits", async () => {
  const c = client();
  assert.equal((await c.post("/api/auth/code", { phone: "12345" })).status, 422);
  assert.equal((await c.call("POST", "/api/auth/code", { phone: SEEKER }, { "x-shaghilni": "" })).status, 403, "requests without the app header are refused");
  const r = await c.post("/api/auth/code", { phone: SEEKER, lang: "ar" });
  assert.equal(r.body.phone, "+963944111222");
  assert.equal(r.body.devCode, undefined, "codes are never echoed unless OTP_DEV_ECHO is set outside production");
  assert.match(texts.at(-1).body, /رمز الدخول/);
  assert.equal((await c.post("/api/auth/verify", { phone: SEEKER, code: "000000" })).body.error, "wrong_code");
  const code = lastCode("+963944111222"), arabic = code.replace(/\d/g, d => "٠١٢٣٤٥٦٧٨٩"[d]);
  const ok = await c.post("/api/auth/verify", { phone: SEEKER, code: arabic, role: "seeker", lang: "en", accept: true });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.user.role, "seeker");
  assert.match(ok.headers.get("set-cookie"), /HttpOnly; SameSite=Lax/);
  assert.equal((await c.post("/api/auth/verify", { phone: SEEKER, code })).body.error, "code_expired", "a code works once");
  const me = await c.get("/api/me");
  assert.equal(me.body.user.phone, "+963944111222");
  seeker = c;
  const d = client();
  for (let i = 0; i < 3; i++) await d.post("/api/auth/code", { phone: "0999 000 000" });
  assert.equal((await d.post("/api/auth/code", { phone: "0999 000 000" })).status, 429, "three codes per 15 minutes per number");
  const e = client();
  await e.post("/api/auth/code", { phone: "0998 000 000" });
  for (let i = 0; i < 5; i++) await e.post("/api/auth/verify", { phone: "0998 000 000", code: "111111" });
  assert.equal((await e.post("/api/auth/verify", { phone: "0998 000 000", code: "111111" })).body.error, "too_many_attempts");
});

test("seeker: profile is sanitised; saving and applying work", async () => {
  const bad = await seeker.put("/api/me/profile", { profile: { ...PROFILE, name: "" } });
  assert.equal(bad.status, 422);
  const r = await seeker.put("/api/me/profile", { profile: { ...PROFILE, phone: "+963911999999" } });
  assert.equal(r.status, 200);
  assert.equal(r.body.profile.phone, "+963 944 111 222", "the phone always comes from the verified account");
  assert.equal(r.body.profile.hacker, undefined, "unknown keys are dropped");
  const jobs = (await seeker.get("/api/jobs")).body.jobs, demo = jobs[0];
  assert.equal((await seeker.post(`/api/me/saved/${demo.id}`)).status, 200);
  assert.deepEqual((await seeker.get("/api/me")).body.saved, [demo.id]);
  await seeker.del(`/api/me/saved/${demo.id}`);
  assert.deepEqual((await seeker.get("/api/me")).body.saved, []);
  const wa = await seeker.post(`/api/jobs/${demo.id}/apply`, { channel: "whatsapp", cvLang: "fr" });
  assert.equal(wa.body.application.cvLang, null, "an unknown resume language is ignored");
  assert.equal(wa.status, 200);
  assert.equal(wa.body.whatsapp, null, "demo employers have no WhatsApp number");
  const again = await seeker.post(`/api/jobs/${demo.id}/apply`, {});
  assert.equal(again.body.application.id, wa.body.application.id, "applying twice keeps one application");
  assert.equal((await seeker.post(`/api/me/applications/${wa.body.application.id}/withdraw`)).status, 200);
  assert.equal((await seeker.get("/api/me/applications")).body.applications[0].status, "withdrawn");
  const noProfile = client();
  await login(noProfile, SEEKER2, "seeker");
  assert.equal((await noProfile.post(`/api/jobs/${demo.id}/apply`, {})).body.error, "profile_required");
});

test("employer: company verification gates listings; posting checks run on the server", async () => {
  employer = client();
  const u = await login(employer, EMPLOYER, "employer");
  assert.equal(u.role, "employer");
  assert.equal((await employer.put("/api/me/profile", { profile: PROFILE })).status, 403, "employers can't use seeker endpoints");
  const draft = await employer.put("/api/employer/company", { company: { name: { en: "Beit Accounting" }, sector: "finance", gov: "damascus" } });
  assert.deepEqual(draft.body.missing.sort(), ["contactName", "regNo", "whatsapp"]);
  assert.equal((await employer.post("/api/employer/company/submit")).body.error, "incomplete");
  await employer.put("/api/employer/company", { company: { name: { en: "Beit Accounting", ar: "بيت المحاسبة" }, sector: "finance", gov: "damascus",
    regNo: "DM-12345", contactName: "Rami", whatsapp: "0955 666 777", about: { en: "Bookkeeping for Damascus shops." } } });
  const sub = await employer.post("/api/employer/company/submit");
  assert.equal(sub.body.company.status, "pending");
  const created = await employer.post("/api/employer/jobs", { job: JOB });
  employerJobId = created.body.job.id;
  assert.equal(created.body.job.status, "draft");
  assert.equal((await employer.post(`/api/employer/jobs/${employerJobId}/submit`)).body.error, "company_not_verified");
});

test("admin: verification needs sanctions screening; review publishes listings", async () => {
  admin = client();
  const u = await login(admin, ADMIN, "seeker");
  assert.equal(u.role, "admin", "ADMIN_PHONES become admins whatever they ask for");
  assert.equal((await seeker.get("/api/admin/overview")).status, 403);
  const q = await admin.get("/api/admin/companies?status=pending");
  const co = q.body.companies.find(x => x.name.en === "Beit Accounting");
  assert.ok(co && co.ownerPhone === "+963955666777");
  assert.equal((await admin.post(`/api/admin/companies/${co.id}/verify`, {})).body.error, "screening_required");
  assert.equal((await admin.post(`/api/admin/companies/${co.id}/verify`, { screened: true })).body.company.status, "verified");
  const fee = await employer.put(`/api/employer/jobs/${employerJobId}`, { job: { ...JOB, needs: { ar: ["دفع رسوم تسجيل قبل البدء"] } }, submit: true });
  assert.equal(fee.body.error, "fee_requested", "asking candidates for money blocks the listing");
  const gendered = await employer.put(`/api/employer/jobs/${employerJobId}`, { job: { ...JOB, title: { en: "Junior accountant", ar: "مطلوب موظفة حسابات" } }, submit: true });
  assert.equal(gendered.status, 200);
  const pending = (await admin.get("/api/admin/jobs?status=pending")).body.jobs.find(x => x.id === employerJobId);
  assert.equal(pending.flags[0].type, "gender");
  assert.equal((await admin.post(`/api/admin/jobs/${employerJobId}/reject`, {})).body.error, "note_required");
  await employer.put(`/api/employer/jobs/${employerJobId}`, { job: JOB, submit: true });
  assert.equal((await admin.post(`/api/admin/jobs/${employerJobId}/approve`)).status, 200);
  const board = (await client().get("/api/jobs")).body.jobs;
  assert.equal(board.length, 20);
  const live = board.find(x => x.id === employerJobId);
  assert.equal(live.title.en, "Junior accountant");
  assert.equal(live.hasWhatsapp, true);
});

test("pipeline: status moves are checked, seekers are texted, hires need confirmation", async () => {
  const ap = await seeker.post(`/api/jobs/${employerJobId}/apply`, { channel: "whatsapp", cvLang: "en" });
  assert.equal(ap.body.whatsapp, "+963955666777", "the number is released only to a signed-in applicant");
  seekerAppId = ap.body.application.id;
  const list = (await employer.get(`/api/employer/jobs/${employerJobId}/applications`)).body.applications;
  assert.equal(list[0].cvLang, "en", "the employer learns which resume language was sent");
  assert.equal(list.length, 1);
  assert.equal(list[0].profile.name, "Lina Haddad");
  assert.equal(list[0].phone, "+963944111222");
  assert.equal(list[0].channel, "whatsapp");
  assert.equal((await employer.put(`/api/employer/applications/${seekerAppId}`, { status: "hired" })).body.error, "bad_transition");
  const before = texts.length;
  await employer.put(`/api/employer/applications/${seekerAppId}`, { status: "shortlisted", note: "Strong Excel" });
  await new Promise(r => setTimeout(r, 20));
  assert.equal(texts.length, before + 1);
  assert.match(texts.at(-1).body, /Beit Accounting shortlisted you for Junior accountant/);
  await employer.put(`/api/employer/applications/${seekerAppId}`, { status: "interview" });
  await employer.put(`/api/employer/applications/${seekerAppId}`, { status: "hired" });
  assert.equal((await seeker.get("/api/me/applications")).body.applications.find(x => x.id === seekerAppId).status, "hired");
  assert.equal((await seeker.post(`/api/me/applications/${seekerAppId}/withdraw`)).body.error, "already_hired");
  const hires = (await admin.get("/api/admin/hires")).body.hires;
  assert.equal(hires.length, 1);
  assert.equal(hires[0].employerPhone, "+963955666777");
  let ov = (await admin.get("/api/admin/overview")).body;
  assert.deepEqual([ov.counts.hired, ov.counts.confirmedHires, ov.queues.hires], [1, 0, 1]);
  await admin.post(`/api/admin/applications/${seekerAppId}/confirm-hire`, { note: "Called Rami" });
  ov = (await admin.get("/api/admin/overview")).body;
  assert.deepEqual([ov.counts.confirmedHires, ov.queues.hires, ov.counts.liveJobs, ov.counts.demoJobs], [1, 0, 1, 19]);
  assert.equal(ov.weeks.at(-1).confirmedHires, 1);
});

test("edits send live listings and renamed companies back to review", async () => {
  await employer.put(`/api/employer/jobs/${employerJobId}`, { job: { ...JOB, openings: 3 } });
  assert.equal((await client().get("/api/jobs")).body.jobs.length, 19, "an edited listing leaves the board until reviewed");
  await employer.post(`/api/employer/jobs/${employerJobId}/submit`);
  await admin.post(`/api/admin/jobs/${employerJobId}/approve`);
  await employer.put("/api/employer/company", { company: { name: { en: "Beit Accounting Group", ar: "بيت المحاسبة" }, sector: "finance", gov: "damascus",
    regNo: "DM-12345", contactName: "Rami", whatsapp: "0955 666 777" } });
  assert.equal((await employer.get("/api/employer")).body.company.status, "pending");
  assert.equal((await client().get("/api/jobs")).body.jobs.length, 19, "a company under re-verification has no live listings");
});

test("resume suggestions: own bullets only, and the fact guard filters Claude's output", async () => {
  const demo = (await seeker.get("/api/jobs")).body.jobs[0];
  assert.equal((await seeker.post("/api/resume/suggest", { jobId: demo.id, items: [{ text: "Ran a bank" }] })).body.error, "unknown_bullets");
  globalThis.fetch = async (url, opts) => {
    if (String(url).startsWith("https://api.anthropic.com")) {
      const body = JSON.parse(opts.body);
      assert.equal(body.model, "claude-sonnet-5");
      assert.match(body.messages[0].content, /Never add a number/);
      return new Response(JSON.stringify({ content: [{ type: "text", text: 'Here you go:\n[{"id":"b1","text":"Supported stock counts","question":"How many items?"},{"id":"b2","text":"Served 40 customers a day across 3 branches","question":""}]' }] }), { status: 200 });
    }
    return realFetch(url, opts);
  };
  const r = await seeker.post("/api/resume/suggest", { jobId: demo.id, items: [{ role: "Sales intern", text: "Helped with stock counts" }, { role: "Sales intern", text: "Served 40 customers a day" }] });
  globalThis.fetch = realFetch;
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.items[0].ok, true);
  assert.equal(r.body.items[0].q, "How many items?");
  assert.deepEqual([r.body.items[1].ok, r.body.items[1].why], [false, "gNumber"], "an invented number is blocked on the server");
});

test("account deletion erases personal data but keeps the hire on record", async () => {
  assert.equal((await seeker.del("/api/me")).status, 200);
  assert.equal((await seeker.get("/api/me")).body.user, null, "signed out");
  const list = (await employer.get(`/api/employer/jobs/${employerJobId}/applications`)).body.applications;
  assert.equal(list[0].phone, null);
  assert.equal(list[0].profile.deleted, true);
  assert.equal((await admin.get("/api/admin/overview")).body.counts.confirmedHires, 1);
  const again = client();
  const u = await login(again, SEEKER, "seeker");
  assert.notEqual(u.id, undefined, "the number can sign up again as a fresh account");
});

test("audit log records who did what", async () => {
  const actions = (await admin.get("/api/admin/audit?limit=200")).body.entries.map(e => e.action);
  for (const a of ["company.verified", "job.approved", "application.moved", "hire.confirmed", "user.deleted"]) assert.ok(actions.includes(a), a);
});

test("static client: security headers, fingerprinted gzipped assets, SPA routes", async () => {
  const c = client(), page = await realFetch(base + "/company/anything", { headers: { "accept-encoding": "gzip" } });
  assert.equal(page.status, 200);
  const csp = page.headers.get("content-security-policy");
  assert.match(csp, /script-src 'self'/);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.equal(page.headers.get("x-content-type-options"), "nosniff");
  assert.equal(page.headers.get("cache-control"), "no-cache");
  const html = await page.text();
  const js = /src="(\/assets\/app\.[0-9a-f]{10}\.js)"/.exec(html), css = /href="(\/assets\/app\.[0-9a-f]{10}\.css)"/.exec(html);
  assert.ok(js && css, "index.html points at fingerprinted assets");
  assert.ok(!/<script>/.test(html), "no inline scripts, so the strict script policy holds");
  const a = await realFetch(base + js[1], { headers: { "accept-encoding": "gzip" } });
  assert.equal(a.headers.get("cache-control"), "public, max-age=31536000, immutable");
  assert.ok((await a.text()).includes("function prepJobs"));
  assert.equal((await realFetch(base + "/assets/app.0000000000.js")).status, 404);
  assert.equal((await c.get("/api/nope")).status, 404);
  assert.equal((await c.call("PATCH", "/api/jobs")).status, 405);
  assert.equal((await c.get("/api/config")).body.ai, true);
});
