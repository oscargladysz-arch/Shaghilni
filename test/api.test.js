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

test("seed: the 50 sample listings added for D1 pass the posting checks with no flag at all, use real lookup keys, match English and Arabic item for item, name no contact person, and describe the role without money words (D1)", async () => {
  const { readFileSync } = await import("node:fs"), { loadCore } = await import("../server/core.js"), { sanitizeJob, checkJob } = await import("../server/validate.js"), core = loadCore();
  const seed = JSON.parse(readFileSync(new URL("../seed/demo.json", import.meta.url), "utf8")), keys = new Set(seed.companies.map(c => c.key)), added = seed.jobs.slice(19);
  assert.equal(added.length, 50, "50 listings after the original 19");
  assert.equal(new Set(seed.companies.map(c => c.key)).size, seed.companies.length, "company keys are unique");
  for (const j of added) {
    const { company, daysAgo, ...data } = j, s = sanitizeJob(core, data), c = checkJob(core, s), name = (j.title || {}).en;
    assert.ok(keys.has(company), `${name}: its company is in the file`);
    assert.deepEqual([c.missing, c.fee, c.flags], [[], null, []], `${name}: passes the posting checks with no flag`);
    for (const k of ["gov", "type", "level", "mode"]) assert.equal(s[k], data[k], `${name}: ${k} is a real lookup key`);
    assert.deepEqual(s.recruits, data.recruits || [], `${name}: every university and faculty is a real key`);
    assert.ok(!("contact" in j), `${name}: no invented contact person`);
    for (const k of ["title", "summary", "place"]) assert.ok(data[k].en && data[k].ar, `${name}: ${k} in both languages`);
    for (const k of ["duties", "needs", "provides"]) assert.ok(data[k].en.length >= 2 && data[k].en.length === data[k].ar.length, `${name}: ${k} item for item in both languages`);
    const text = JSON.stringify([data.title, data.summary, data.duties, data.needs, data.provides, data.place, data.tags]);
    assert.doesNotMatch(text, /\b(?:pay|paid|payment|fees?|deposit|costs?|price|syp|usd)\b|[$€]|دفع|رسوم|مبلغ|تسديد|سداد|تكاليف|تكلفة|مصاريف|ليرة|دولار/i, `${name}: the role, not money (pay has its own field)`);
  }
});

test("public board lists the seeded demo jobs", async () => {
  const c = client(), r = await c.get("/api/jobs");
  assert.equal(r.status, 200);
  assert.equal(r.body.jobs.length, 68, "68 of the 69 sample listings pass the posting checks (D-02; 50 added for D1)");
  assert.ok(r.body.jobs.every(x => Array.isArray(x.pay) && x.pay[0] > 0), "no sample listing is on the board without pay (D-02)");
  assert.ok(r.body.jobs.every(x => !x.contact || !(x.contact.name && x.contact.name.en)), "no sample listing names an invented employee of a real organisation (D-15)");
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
  // D-30: a phone number or an email in the free text (place, contact lines, tags, provides) is flagged for the reviewer, not blocked
  const contact = await employer.put(`/api/employer/jobs/${employerJobId}`, { job: { ...JOB, place: { en: "Mezzeh, call ٠٩٥٥ ١٢٣ ٤٥٦" }, contact: { name: { en: "Rami" }, status: { en: "Write to jobs@example.com" } }, tags: "whatsapp 0944-123-456" }, submit: true });
  assert.equal(contact.status, 200, contact.text); assert.equal(contact.body.check.fee, null, "contact details are not a fee");
  const words = contact.body.check.flags.filter(f => f.type === "contact").map(f => f.word);
  assert.ok(words.length >= 3 && words.some(w => /0955 123 456/.test(w)) && words.some(w => /jobs@example\.com/.test(w)) && words.some(w => /0944-123-456/.test(w)), "D-30: the phone numbers (Arabic-Indic digits included) and the email are flagged: " + JSON.stringify(contact.body.check.flags));
  assert.deepEqual((await admin.get("/api/admin/jobs?status=pending")).body.jobs.find(x => x.id === employerJobId).flags.filter(f => f.type === "contact").map(f => f.word), words, "and the reviewer's queue carries the flags");
  const subs = db.all("SELECT data FROM audit WHERE action = 'job.submitted' AND entity_id = ?", employerJobId).map(x => x.data);
  assert.ok(subs.length && !/0955 123 456|jobs@example\.com|0944-123-456|\d{7,}/.test(subs.join(" ")), "the audit log records that contact details were flagged, never the number or the address (R12): " + subs.at(-1));
  assert.ok(JSON.parse(subs.at(-1)).flags.some(f => f.type === "contact" && !("word" in f)), "contact flags in the log carry the type only");
  const plain = await employer.put(`/api/employer/jobs/${employerJobId}`, { job: { ...JOB, summary: { en: "Summer internship 2025-2026, pay 1500000 SYP, start 12.05.2026, registration 123456." }, place: { en: "Office 2024 - 2026" } }, submit: true });
  assert.equal(plain.status, 200, plain.text); assert.deepEqual(plain.body.check.flags.filter(f => f.type === "contact"), [], "years, dates, salaries and short numbers are not contact details");
  assert.equal((await admin.post(`/api/admin/jobs/${employerJobId}/reject`, {})).body.error, "note_required");
  await employer.put(`/api/employer/jobs/${employerJobId}`, { job: JOB, submit: true });
  assert.equal((await admin.post(`/api/admin/jobs/${employerJobId}/approve`)).status, 200);
  const board = (await client().get("/api/jobs")).body.jobs;
  assert.equal(board.length, 19, "18 sample listings plus the one just approved");
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
  assert.deepEqual([ov.counts.confirmedHires, ov.queues.hires, ov.counts.liveJobs, ov.counts.demoJobs], [1, 0, 1, 68]);
  assert.equal(ov.weeks.at(-1).confirmedHires, 1);
});

test("edits send live listings and renamed companies back to review", async () => {
  await employer.put(`/api/employer/jobs/${employerJobId}`, { job: { ...JOB, openings: 3 } });
  assert.equal((await client().get("/api/jobs")).body.jobs.length, 18, "an edited listing leaves the board until reviewed");
  await employer.post(`/api/employer/jobs/${employerJobId}/submit`);
  await admin.post(`/api/admin/jobs/${employerJobId}/approve`);
  await employer.put("/api/employer/company", { company: { name: { en: "Beit Accounting Group", ar: "بيت المحاسبة" }, sector: "finance", gov: "damascus",
    regNo: "DM-12345", contactName: "Rami", whatsapp: "0955 666 777" } });
  assert.equal((await employer.get("/api/employer")).body.company.status, "pending");
  assert.equal((await client().get("/api/jobs")).body.jobs.length, 18, "a company under re-verification has no live listings");
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

test("resume suggestions: the fact guard holds back Arabic suggestions that add a number word, a bigger role or a place, as it does in English (U-010)", async () => {
  const { loadCore } = await import("../server/core.js"), { factGuard } = loadCore();
  const g = (orig, sug, facts = orig) => { const r = factGuard(orig, sug, facts, ""); return [r.ok, r.why || "", r.tok || ""]; };
  assert.deepEqual(g("ساعدت في جرد المخزون", "أدرت جرد المخزون").slice(0, 2), [false, "gInflate"], "helped → ran is a bigger role");
  assert.deepEqual(g("وساعدت في جرد المخزون", "قدت جرد المخزون").slice(0, 2), [false, "gInflate"], "with the و prefix too");
  assert.deepEqual(g("خدمت الزبائن يومياً", "خدمت خمسين زبوناً يومياً"), [false, "gNumber", "خمسين"], "a number word that was not there");
  assert.deepEqual(g("خدمت الزبائن يومياً", "خدمت مئات الزبائن يومياً").slice(0, 2), [false, "gNumber"], "hundreds");
  assert.deepEqual(g("رفعت المبيعات", "رفعت المبيعات بنسبة عشرين بالمئة").slice(0, 2), [false, "gNumber"], "a percentage in words");
  assert.deepEqual(g("خدمت الزبائن في المتجر", "خدمت الزبائن في متجر دمشق"), [false, "gName", "دمشق"], "a governorate the facts don't have");
  assert.deepEqual(g("خدمت الزبائن في المتجر", "خدمت الزبائن في متجر بحلب").slice(0, 2), [false, "gName"], "with a ب prefix");
  assert.deepEqual(g("بعت البضائع للزبائن", "بعت البضائع لزبائن في لبنان").slice(0, 2), [false, "gName"], "a country");
  // controls: nothing new, so nothing is held back
  assert.deepEqual(g("خدمت الزبائن في المتجر", "خدمت الزبائن في متجر دمشق", "عملت في دمشق. خدمت الزبائن في المتجر").slice(0, 1), [true], "the place is in the person's own facts");
  assert.deepEqual(g("خدمت خمسين زبوناً", "خدمت خمسين زبوناً يومياً").slice(0, 1), [true], "the number word was already there");
  assert.deepEqual(g("نظمت جداول الورديات", "رتبت جداول الورديات").slice(0, 1), [true], "a plain rewording");
  assert.deepEqual(g("ساعدت في جرد المخزون", "ساعدت في جرد المخزون أسبوعياً").slice(0, 1), [true], "still helping");
  assert.deepEqual(g("Helped with stock counts", "Led stock counts").slice(0, 2), [false, "gInflate"], "English unchanged");
});

test("account deletion erases personal data but keeps the hire on record", async () => {
  const co = (await employer.get("/api/employer")).body.company;   // renamed by the test above, so under review; a company under review reads no applicant (fix review 2): verify it again first
  assert.equal((await admin.post(`/api/admin/companies/${co.id}/verify`, { screened: true })).status, 200);
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

test("seed: a sample listing that fails the posting checks is skipped with one log line, and the invented contact block is never loaded (D-02, D-15)", () => {
  const fresh = openDb(":memory:"), lines = [];
  assert.equal(seedDemo(fresh, m => lines.push(m)), true);
  assert.equal(fresh.get("SELECT COUNT(*) AS n FROM jobs WHERE status = 'published' AND NOT (json_extract(data, '$.pay[0]') > 0)").n, 0, "nothing published without pay");
  assert.equal(fresh.get("SELECT COUNT(*) AS n FROM jobs WHERE json_extract(data, '$.title.en') = 'Laboratory Internship in Marine Sciences'").n, 0, "the pay-less sample listing is not in the database");
  assert.equal(lines.filter(l => /\[seed\] skipped .*Marine Sciences/.test(l)).length, 1, "one log line names it: " + lines.join(" / "));
  assert.equal(fresh.get("SELECT COUNT(*) AS n FROM jobs WHERE json_extract(data, '$.contact') IS NOT NULL").n, 0, "no sample listing carries a contact person (D-15; D1 answered: the names stay, development only)");
  assert.deepEqual(JSON.parse(fresh.get("SELECT data FROM audit WHERE action = 'demo.seeded'").data), { companies: 32, jobs: 68 }, "the audit row counts what was inserted");
  assert.ok(lines.some(l => /32 demo companies and 68 demo jobs added/.test(l)), "and so does the log line: " + lines.join(" / "));
});

test("resume suggestions: the Arabic fact guard reads the other number forms, «أسهمت» and two-word countries, names the word as written, and lets a gender, case or spelling change of a number word through (fix review 2)", async () => {
  const { loadCore } = await import("../server/core.js"), { factGuard } = loadCore();
  const g = (orig, sug, facts = orig, job = "") => { const r = factGuard(orig, sug, facts, job); return [r.ok, r.why || "", r.tok || ""]; };
  for (const sug of ["عملت ست سنوات في التدريس", "عملت ستّ سنوات في التدريس", "عملت ثمان سنوات في التدريس", "خدمت خمسمئة زبون يومياً", "خدمت ثلاثمائة زبون يومياً", "خدمت ألفي زبون شهرياً", "خدمت مئتي زبون", "تجاوزت المبيعات مليوناً"])
    assert.deepEqual(g("عملت في التدريس", sug).slice(0, 2), [false, "gNumber"], sug);
  assert.deepEqual(g("خدمت الزبائن", "خدمت ألفي زبون شهرياً")[2], "ألفي", "the reason names the word as written, not as normalised");
  for (const [orig, sug] of [["عملت خمس سنوات في المتجر", "عملت خمسة أعوام في المتجر"], ["عملت ثلاث سنوات في المتجر", "عملت ثلاثة أعوام في المتجر"], ["خدمت أكثر من مائة زبون", "خدمت أكثر من مئة زبون"], ["عملت عشرين ساعة", "عملت عشرون ساعة"]])
    assert.deepEqual(g(orig, sug).slice(0, 1), [true], `a number word only changed its form: ${sug}`);
  assert.deepEqual(g("أشرفت فريق المبيعات في المتجر", "أشرفت على فريق المبيعات في المتجر", "أشرفت فريق المبيعات في المتجر", "القدرة على العمل ضمن فريق").slice(0, 1), [true], "«على» is a stop word, not a word borrowed from the job");
  assert.deepEqual(g("أسهمت في جرد المخزون", "أدرت جرد المخزون").slice(0, 2), [false, "gInflate"], "«أسهمت» grown into «أدرت»");
  assert.deepEqual(g("قمت بمساعدة المدير في جرد المخزون", "أدرت جرد المخزون").slice(0, 2), [false, "gInflate"], "«قمت بمساعدة» grown into «أدرت»");
  assert.deepEqual(g("بعت البضائع للزبائن", "بعت البضائع لزبائن في الولايات المتحدة").slice(0, 2), [false, "gName"], "a two-word country");
  assert.deepEqual(g("بعت البضائع للزبائن", "بعت البضائع لزبائن في المملكة المتحدة").slice(0, 2), [false, "gName"], "and the other");
});

test("resume suggestions: the Arabic fact guard reads the duals of million and billion, مئتا and the duals of years, months, days and hours, takes only number words for numbers, and does not count «بإشراف» or «بقيادة» as a bigger role (fix review 3)", async () => {
  const { loadCore } = await import("../server/core.js"), { factGuard } = loadCore();
  const g = (orig, sug, facts = orig, job = "") => { const r = factGuard(orig, sug, facts, job); return [r.ok, r.why || "", r.tok || ""]; };
  for (const [orig, sug] of [["حققت مبيعات شهرية", "حققت مبيعات شهرية تجاوزت مليوني ليرة سورية"], ["حققت مبيعات شهرية", "حققت مبيعات شهرية تجاوزت ملياري ليرة"], ["حققت مبيعات شهرية", "حققت مبيعات شهرية تجاوزت مليارين ليرة"],
    ["حققت مبيعات شهرية", "حققت مبيعات شهرية بلغت ملياران ليرة"], ["درّبت المتطوعين", "حضر دوراتي مئتا متطوع"], ["درّبت المتطوعين", "حضر دوراتي مائتا متطوع"], ["عملت في التدريس", "عملت سنتين في التدريس"],
    ["عملت في التدريس", "عملت عامين في التدريس"], ["دربت الموظفين الجدد", "دربت الموظفين الجدد خلال شهرين"], ["بنيت ألفة مع الأطفال", "بنيت ألفة مع ألف طفل"], ["عملت مع مي في الروضة", "رعيت مئة طفل مع مي في الروضة"]])
    assert.deepEqual(g(orig, sug).slice(0, 2), [false, "gNumber"], sug);
  for (const [orig, sug] of [["عملت مع الأطفال في الروضة", "بنيت جواً من الألفة مع الأطفال في الروضة"], ["عملت مع الأطفال", "عملت مع مي في رعاية الأطفال"], ["عملت ثماني سنوات في المتجر", "عملت ثمان سنوات في المتجر"],
    ["خدمت ثلاث مئة زبون يومياً", "خدمت ثلاثمئة زبون يومياً"], ["حققت مبيعات بقيمة مليوني ليرة", "حققت مبيعات بقيمة مليونين من الليرات"], ["خدمت مئتي زبون يومياً", "خدمت مئتين من الزبائن يومياً"],
    ["ساعدت في جرد المخزون", "بإشراف المدير ساعدت في جرد المخزون"], ["شاركت في تنظيم المعرض", "بقيادة فريق الجامعة شاركت في تنظيم المعرض"], ["ساعدت في جرد المخزون", "بإدارة المتجر ساعدت في جرد المخزون"]])
    assert.deepEqual(g(orig, sug).slice(0, 1), [true], `an honest rewording: ${sug} → ${g(orig, sug)}`);
  for (const [orig, sug] of [["ساعدنا في جرد المخزون", "قمنا بإدارة جرد المخزون"], ["قمنا بمساعدة المدير في جرد المخزون", "أدرنا جرد المخزون"], ["دعم إعداد التقارير", "قيادة إعداد التقارير"], ["إسهام في إعداد التقارير", "إدارة إعداد التقارير"]])
    assert.deepEqual(g(orig, sug).slice(0, 2), [false, "gInflate"], sug);
  assert.deepEqual(g("ساعدت في جرد المخزون", "قمت بإدارة جرد المخزون")[2], "بإدارة", "the reason names the bigger word, not «قمت»");
  assert.deepEqual(g("درست إدارة الأعمال في الولايات المتحدة", "درست إدارة الأعمال في المملكة المتحدة").slice(0, 2), [false, "gName"], "the other two-word country, though المتحدة is in the facts");
  assert.deepEqual(g("بعت البضائع لزبائن", "بعت البضائع لزبائن في الولايات المتحدة", "متطوع لدى مفوضية الأمم المتحدة لشؤون اللاجئين").slice(0, 2), [false, "gName"], "the United Nations in the facts is not the United States");
  assert.deepEqual(g("بعت البضائع لزبائن", "بعت البضائع لزبائن في أمريكا").slice(0, 2), [false, "gName"], "the everyday one-word name");
  assert.deepEqual(g("درست في الولايات المتحدة", "درست إدارة الأعمال في الولايات المتحدة").slice(0, 1), [true], "the same country is no new fact");
});

test("resume suggestions: the Arabic fact guard reads the accusative and اثنا forms, the duals of days, hours and weeks, ثماني مئة as one number named as written, «كنا» openings, and one country under its other names (fix review 4)", async () => {
  const { loadCore } = await import("../server/core.js"), { factGuard } = loadCore();
  const g = (orig, sug, facts = orig, job = "") => { const r = factGuard(orig, sug, facts, job); return [r.ok, r.why || "", r.tok || ""]; };
  for (const [orig, sug] of [["عملت ثلاثاً وعشرين ساعة أسبوعياً", "عملت خمساً وعشرين ساعة أسبوعياً"], ["عملت عشر ساعات يومياً", "عملت اثنتا عشرة ساعة يومياً"], ["حضرت دورة تدريبية", "حضرت دورة تدريبية لمدة يومين"],
    ["حضرت دورة تدريبية", "حضرت دورة تدريبية مدتها ساعتين"], ["حضرت دورة تدريبية", "حضرت دورة تدريبية لمدة أسبوعين"]])
    assert.deepEqual(g(orig, sug).slice(0, 2), [false, "gNumber"], sug);
  assert.deepEqual(g("خدمت الزبائن يومياً", "خدمت ثلاث مئة زبون يومياً")[2], "ثلاث مئة", "a hundred in two words is named as written");
  for (const [orig, sug, facts] of [["عملت اثني عشر شهراً في المتجر", "عملت اثنا عشر شهراً في المتجر"], ["خدمت ثماني مئة زبون", "خدمت ثمانمئة زبون"], ["بعت لزبائن في الولايات المتحدة", "بعت المنتجات لزبائن في أمريكا"],
    ["بعت لزبائن في أميركا", "بعت المنتجات لزبائن في أمريكا"], ["بعت لزبائن في بريطانيا", "بعت المنتجات لزبائن في المملكة المتحدة"], ["بعت لزبائن في أمريكا", "بعت المنتجات لزبائن في الولايات المتحدة"]])
    assert.deepEqual(g(orig, sug, facts).slice(0, 1), [true], `the same fact in another form: ${sug} → ${g(orig, sug, facts)}`);
  for (const sug of ["كنا ندير جرد المخزون", "أشرفنا على جرد المخزون"]) assert.deepEqual(g("كنا نساعد في جرد المخزون", sug).slice(0, 2), [false, "gInflate"], sug);
});

test("resume suggestions: Latin, North or South America is not the United States, a hundred after و or ب is still one number, and the reason names the number without a stray space (fix review 5)", async () => {
  const { loadCore } = await import("../server/core.js"), { factGuard } = loadCore();
  const g = (orig, sug, facts = orig, job = "") => { const r = factGuard(orig, sug, facts, job); return [r.ok, r.why || "", r.tok || ""]; };
  for (const region of ["أمريكا اللاتينية", "أمريكا الشمالية", "أمريكا الجنوبية"])
    assert.deepEqual(g(`بعت لزبائن في ${region}`, "بعت المنتجات لزبائن في الولايات المتحدة").slice(0, 2), [false, "gName"], `${region} is not the United States`);
  for (const [orig, sug] of [["جمعت ألفاً وخمس مئة توقيع", "جمعت ألفاً وخمسمئة توقيع"], ["بعت بخمس مئة ألف ليرة", "بعت بخمسمئة ألف ليرة"]])
    assert.deepEqual(g(orig, sug).slice(0, 1), [true], `the same number: ${sug} → ${g(orig, sug)}`);
  assert.deepEqual(g("Served customers", "Served - five hundred customers")[2], "five", "the reason names the word, not the dash before it");
});

test("resume suggestions: أمريكا and بريطانيا with و, ب or ل before them still stand for the two-word names (fix review 6)", async () => {
  const { loadCore } = await import("../server/core.js"), { factGuard } = loadCore();
  const g = (orig, sug) => factGuard(orig, sug, orig, "").ok;
  for (const [orig, sug] of [["عملت مع زبائن في سوريا وأمريكا", "عملت مع زبائن في سوريا والولايات المتحدة"], ["عملت بأمريكا لمدة سنتين", "عملت في الولايات المتحدة لمدة سنتين"], ["سافرت لأمريكا للعمل", "سافرت إلى الولايات المتحدة للعمل"], ["عملت ببريطانيا", "عملت في المملكة المتحدة"]])
    assert.equal(g(orig, sug), true, `the same country: ${sug}`);
  assert.equal(g("عملت بأمريكا اللاتينية", "عملت في الولايات المتحدة"), false, "Latin America still is not the United States");
});
