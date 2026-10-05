/* Shaghilni Lite: small server-rendered pages for slow connections, doing everything through the same API rules. */
import { test, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { loadConfig } from "../server/config.js";
import { openDb } from "../server/db.js";
import { createApp } from "../server/app.js";
import { seedDemo } from "../server/seed.js";

const servers = [];
after(() => { for (const s of servers) s.close(); });
const inDays = n => new Date(Date.now() + n * 86400e3).toISOString().slice(0, 10);
async function start(env = {}) {
  const cfg = loadConfig({ skipDotEnv: true, isolated: true, env: { NODE_ENV: "test", ADMIN_PHONES: "+12025550199", ...env }, values: { powBits: 0, anthropicKey: "" } });
  const db = openDb(":memory:"), texts = [];
  seedDemo(db, () => {});
  const server = http.createServer(createApp({ cfg, db, log: () => {}, sms: async (to, body) => { texts.push({ to, body }); } }));
  await new Promise(r => server.listen(0, "127.0.0.1", r)); servers.push(server);
  const port = server.address().port, base = `http://127.0.0.1:${port}`;
  const lastCode = phone => { const t = [...texts].reverse().find(x => x.to === phone); return t && /(\d{6})/.exec(t.body)[1]; };
  const client = () => {   // the JSON API, as the full app uses it
    let cookie = "";
    const call = async (method, path, body) => {
      const res = await fetch(base + path, { method, headers: { "content-type": "application/json", "x-shaghilni": "1", ...(cookie ? { cookie } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
      const sc = res.headers.get("set-cookie"); if (sc) cookie = sc.split(";")[0];
      const text = await res.text(); let json = null; try { json = JSON.parse(text); } catch {}
      return { status: res.status, body: json, text };
    };
    return { get: p => call("GET", p), post: (p, b = {}) => call("POST", p, b), put: (p, b) => call("PUT", p, b) };
  };
  const login = async (phone, role = "seeker") => {
    const c = client(); const r = await c.post("/api/auth/code", { phone });
    assert.equal((await c.post("/api/auth/verify", { phone, code: lastCode(r.body.phone), role, accept: true })).status, 200);
    return c;
  };
  const browser = () => {   // plain HTML forms and cookies, like a phone browser without JavaScript
    const jar = {};
    const req = async (method, path, form, headers = {}) => {
      const body = form ? new URLSearchParams(Array.isArray(form) ? form : Object.entries(form)).toString() : undefined;
      const res = await fetch(base + path, { method, redirect: "manual", body,
        headers: { ...(body ? { "content-type": "application/x-www-form-urlencoded" } : {}), cookie: Object.entries(jar).map(([k, v]) => `${k}=${v}`).join("; "), ...headers } });
      for (const c of res.headers.getSetCookie()) { const [kv] = c.split(";"), i = kv.indexOf("="), k = kv.slice(0, i), v = kv.slice(i + 1); if (!v || /Max-Age=0/i.test(c)) delete jar[k]; else jar[k] = v; }
      return { status: res.status, text: await res.text(), location: res.headers.get("location"), res };
    };
    const csrf = html => (/name="csrf" value="([0-9a-f]{32})"/.exec(html) || [])[1];
    const b = { get: p => req("GET", p), post: (p, f, h) => req("POST", p, f, h), csrf, jar };
    b.signin = async (phone, role = "seeker", next = "") => {
      const pg = await b.get("/lite/signin" + (role === "employer" ? "?role=employer" : ""));
      const r1 = await b.post("/lite/signin", { csrf: csrf(pg.text), phone, consent: "1", role, next, pow_challenge: /name="pow_challenge" value="([^"]+)"/.exec(pg.text)[1], pow_nonce: "" });
      assert.match(r1.text, /name="code"/, "a code is sent");
      const ph = /name="phone" value="([^"]+)"/.exec(r1.text)[1];
      return b.post("/lite/signin/code", { csrf: csrf(r1.text), phone: ph, code: lastCode(ph), role, next });
    };
    return b;
  };
  const raw = path => new Promise((resolve, reject) => http.get(base + path, { headers: { "accept-encoding": "gzip" } }, res => { let n = 0; res.on("data", c => { n += c.length; }); res.on("end", () => resolve({ headers: res.headers, bytes: n })); }).on("error", reject));
  return { db, texts, client, login, browser, raw };
}
const GRAD = { v: 1, role: "seeker", name: "Lina Haddad", email: "lina@example.com", gov: "damascus", langs: ["ar", "en"], edu: { status: "bachelor", uni: "damascus", fac: "business", year: 0, grad: 2023 },
  exp: [{ id: "e1", role: "Sales assistant", org: "Barada Trading", start: "2023-09", end: "", current: true, bullets: ["Served 40 customers a day"] }], acts: [], skills: ["Excel", "Sales"], certs: [] };
async function employer(S, admin, phone, name) {
  const e = await S.login(phone, "employer");
  await e.put("/api/employer/company", { company: { name: { en: name }, gov: "damascus", regNo: `REG-${name}`, contactName: `Contact ${name}`, whatsapp: phone } });
  await e.post("/api/employer/company/submit");
  const co = (await admin.get("/api/admin/companies?status=pending")).body.companies.find(c => c.name.en === name);
  await admin.post(`/api/admin/companies/${co.id}/verify`, { screened: true });
  return { e };
}

test("lite: small pages that work without JavaScript, in Arabic or English", async () => {
  const S = await start(), b = S.browser();
  const home = await b.get("/lite");
  assert.equal(home.status, 200);
  assert.match(home.text, /<html lang="ar" dir="rtl">/); assert.match(home.text, /<nav class="tb"/, "the tab bar is there");
  assert.doesNotMatch(home.text, /<script/, "the job list has no scripts");
  const wire = await S.raw("/lite"); assert.equal(wire.headers["content-encoding"], "gzip");
  const css = /href="(\/lite\/s\.[0-9a-f]{10}\.css)"/.exec(home.text)[1], spr = /href="(\/lite\/i\.[0-9a-f]{10}\.svg)#/.exec(home.text)[1];
  const c = await S.raw(css), sp = await S.raw(spr);
  assert.match(c.headers["cache-control"], /immutable/); assert.match(sp.headers["cache-control"], /immutable/, "shared files are cached for good");
  const first = wire.bytes + c.bytes + sp.bytes;
  assert.ok(first < 15000, `the whole first visit is small (${first} bytes over the wire)`);
  assert.ok(wire.bytes < 3072, `and each page after that is smaller still (${wire.bytes} bytes)`);
  const id = /href="\/lite\/job\/(\d+)"/.exec(home.text)[1];
  const job = await b.get(`/lite/job/${id}`); assert.equal(job.status, 200); assert.match(job.text, /قدّم الآن/);
  const en = await b.get("/lite?lang=en"); assert.match(en.text, /<html lang="en" dir="ltr">/); assert.match(en.text, /Shaghilni/);
  assert.match((await b.get("/lite")).text, /<html lang="en"/, "the language is remembered");
  assert.equal((await b.get("/lite?gov=quneitra&type=internship&q=%00%27")).status, 200);
  assert.equal((await b.get("/lite/nope")).status, 404);
  const gate = await b.get("/lite/applications");
  assert.equal(gate.status, 200); assert.match(gate.text, /href="\/lite\/signin\?next=%2Flite%2Fapplications"/, "signed-out visitors are asked to sign in, not dropped somewhere else");
  assert.match((await b.get("/lite/pow.js")).text, /solvePow/);
  assert.equal((await b.get("/hire")).location, "/lite/hire", "/hire is the recruiter sign-up page");
  const sign = await b.get("/lite/signin");
  assert.match(sign.text, /<script src="\/lite\/pow\.js" defer><\/script>/, "only sign-in pages load the sign-in check");
  assert.match(sign.res.headers.get("content-security-policy") || "", /script-src 'self'/, "the usual strict security headers apply");
  assert.doesNotMatch(home.text + job.text + sign.text + gate.text, /\b(rcSt_|lvl_|edu_|err_|st_)[a-z]/, "no untranslated labels");
});

test("lite: a job seeker signs in, builds a profile step by step, applies, saves a job and answers a recruiter", async () => {
  const S = await start(), admin = await S.login("+12025550199"), { e } = await employer(S, admin, "0955 720 001", "Qasioun Advisory");
  const b = S.browser();
  assert.equal((await b.signin("0933 720 001")).location, "/lite/me");
  const me0 = await b.get("/lite/me"); assert.match(me0.text, /href="\/lite\/profile\?step=1"/);
  assert.equal((await b.post("/lite/recruit", { csrf: "0".repeat(32), open: "1" })).status, 403, "a form without the page's token is refused");
  assert.equal((await b.post("/lite/recruit", { csrf: b.csrf(me0.text), open: "1" }, { "sec-fetch-site": "cross-site" })).status, 403, "and so is one sent from another site");
  const tok = b.csrf(me0.text);
  assert.equal((await b.post("/lite/profile", { csrf: tok, step: "1", name: "لينا حداد", gov: "damascus", email: "" })).location, "/lite/profile?step=2");
  for (const q of ["", "?lang=en"]) { const s2 = await b.get("/lite/profile?step=2" + q.replace("?", "&")); assert.doesNotMatch(s2.text, /\b(rcSt_|lvl_|edu_|err_|st_)[a-z]/, "every education status has a label, students included (D-04)"); }
  assert.match((await b.get("/lite/profile?step=2&lang=en")).text, /<option value="student">Current student</, "the student option is a sentence, not a key");
  await b.get("/lite/profile?step=2&lang=ar");   // back to Arabic for the rest of the flow (the language choice sticks)
  assert.equal((await b.post("/lite/profile", { csrf: tok, step: "2", status: "bachelor", uni: "damascus", uniName: "", fac: "business", year: "", grad: "2023", gpa: "" })).location, "/lite/profile?step=3");
  const noOrg = await b.post("/lite/profile/exp", { csrf: tok, i: "", role: "Sales assistant", org: "", place: "", start: "2023-09", end: "", bullets: "" });
  assert.equal(noOrg.status, 200); assert.match(noOrg.text, /aria-invalid="true"/, "a job without a company is sent back with the field marked");
  assert.equal((await b.post("/lite/profile/exp", { csrf: tok, i: "", role: "Sales assistant", org: "Barada Trading", place: "Damascus", start: "2023-09", end: "", current: "1", bullets: "Served 40 customers a day\n• Opened the shop" })).location, "/lite/profile?step=3&done=saved");
  const s4 = await b.get("/lite/profile?step=4"); assert.match(s4.text, /الخطوة 4 من 5/);
  assert.equal((await b.post("/lite/profile", [["csrf", tok], ["step", "4"], ["skills", "Excel، Sales"], ["langs", "ar"], ["langs", "en"], ["certs", ""]])).location, "/lite/profile?step=5");
  const type = /name="types" value="([a-z_]+)"/.exec((await b.get("/lite/profile?step=5")).text)[1];
  assert.equal((await b.post("/lite/profile", { csrf: tok, step: "5", types: type, level: "y1to3" })).location, "/lite/me?done=saved");
  const uid = S.db.get("SELECT user_id FROM profiles ORDER BY rowid DESC LIMIT 1").user_id, prof = JSON.parse(S.db.get("SELECT data FROM profiles WHERE user_id = ?", uid).data);
  assert.deepEqual([prof.edu.status, prof.edu.fac, prof.skills, prof.exp[0].org, prof.exp[0].current, prof.exp[0].bullets, prof.prefs.level, prof.prefs.types], ["bachelor", "business", ["Excel", "Sales"], "Barada Trading", true, ["Served 40 customers a day", "Opened the shop"], "y1to3", [type]]);
  const me1 = await b.get("/lite/me?done=saved"); assert.match(me1.text, /اكتمل ملفك بنسبة 80%/, "the profile meter counts the steps done");
  assert.equal((await b.post("/lite/recruit", { csrf: tok, open: "1" })).location, "/lite/recruiters?done=saved");
  const id = /href="\/lite\/job\/(\d+)"/.exec((await b.get("/lite")).text)[1];
  assert.equal((await b.post(`/lite/job/${id}/apply`, { csrf: tok, channel: "web" })).location, "/lite/applications?done=applied");
  assert.deepEqual({ ...S.db.get("SELECT channel, cv_lang FROM applications WHERE user_id = ? AND job_id = ?", uid, Number(id)) }, { channel: "web", cv_lang: "ar" });
  assert.match((await b.get("/lite/applications")).text, new RegExp(`href="/lite/job/${id}"`));
  assert.equal((await b.post(`/lite/job/${id}/save`, { csrf: tok, back: "/lite" })).location, "/lite");
  assert.match((await b.get("/lite?saved=1")).text, new RegExp(`href="/lite/job/${id}"`), "saved jobs show under Saved");
  assert.match((await b.get("/lite")).text, /%/, "signed-in job seekers see how well each job fits");
  assert.equal((await e.post(`/api/employer/students/${uid}/invite`, { kind: "event", event: { title: "Careers day", date: inDays(12), place: "Damascus University" } })).status, 200);
  const rc = await b.get("/lite/recruiters"); assert.match(rc.text, /Careers day/);
  const inv = /action="\/lite\/invite\/(\d+)"/.exec(rc.text)[1];
  assert.equal((await b.post(`/lite/invite/${inv}`, { csrf: tok, answer: "yes" })).location, "/lite/recruiters?done=answered");
  assert.equal(S.db.get("SELECT status FROM invitations WHERE id = ?", Number(inv)).status, "accepted");
  const cvAr = await b.get("/lite/resume"); assert.match(cvAr.text, /<article class="paper" lang="ar"/); assert.match(cvAr.text, /لينا حداد/);
  const cvEn = await b.get("/lite/resume?cv=en"); assert.match(cvEn.text, /Lina Haddad/, "the name is written in English for the English resume");
  const wa = /href="(https:\/\/wa\.me\/\?text=[^"]+)"/.exec(cvEn.text)[1]; assert.match(decodeURIComponent(wa.replace(/&amp;/g, "&")), /Barada Trading/, "the WhatsApp text carries the resume");
  assert.match(cvEn.text, /<script src="\/lite\/p\.[0-9a-f]{10}\.js" defer>/, "Save as PDF works as a button where scripts run");
  assert.equal((await b.post("/lite/signout", { csrf: tok })).location, "/lite/signin", "signing out goes to sign in or create an account");
  assert.match((await b.get("/lite/me")).text, /href="\/lite\/signin\?next=%2Flite%2Fme"/);
});

test("lite: a recruiter signs up, gets verified, then finds and invites a candidate", async () => {
  const S = await start(), admin = await S.login("+12025550199");
  const seeker = await S.login("0933 730 001"); await seeker.put("/api/me/profile", { profile: GRAD }); await seeker.put("/api/me/recruit", { open: true });
  const student = await S.login("0933 730 002"); await student.put("/api/me/profile", { profile: { ...GRAD, name: "Omar Nabil", email: "omar@example.com", edu: { status: "student", uni: "damascus", fac: "business", year: 3, grad: 2027 } } }); await student.put("/api/me/recruit", { open: true });
  const r = S.browser();
  assert.match((await r.get("/lite/hire")).text, /أنشئ حساب جهة توظيف/);
  assert.equal((await r.signin("0955 730 001", "employer", "/lite/hire/company")).location, "/lite/hire/company");
  const form = await r.get("/lite/hire/company");
  assert.match(form.text, /<div lang="ar" dir="rtl"><label for="nameAr">اسم الشركة بالعربية/); assert.match(form.text, /<div lang="en" dir="ltr"><label for="nameEn">Company name in English/);
  const sub = await r.post("/lite/hire/company", { csrf: r.csrf(form.text), nameAr: "شركة الياسمين", nameEn: "Yasmin Trading", sector: "trade", cat: "domestic", gov: "damascus",
    regNo: "DM-12345", contactName: "Rania Saleh", whatsapp: "0955 730 001", website: "", aboutAr: "", aboutEn: "", submit: "1" });
  assert.equal(sub.location, "/lite/hire?done=submitted", sub.text.slice(0, 300));
  const pend = await r.get("/lite/hire"); assert.match(pend.text, /نتحقق من شركتك/); assert.match(pend.text, /href="\/lite\/candidates"/, "recruiters get their own tabs");
  assert.equal((await r.get("/lite")).location, "/lite/hire", "employers don't see the job board");
  assert.doesNotMatch(pend.text, /<nav class="tb"[^]*href="\/lite"[ >]/, "and it isn't in their tabs");
  assert.equal((await r.get("/lite/candidates")).location, "/lite/hire", "search waits for verification");
  const co = (await admin.get("/api/admin/companies?status=pending")).body.companies.find(c => c.name.en === "Yasmin Trading");
  await admin.post(`/api/admin/companies/${co.id}/verify`, { screened: true });
  const list = await r.get("/lite/candidates?stage=grad");
  assert.match(list.text, /لينا ح\./); assert.doesNotMatch(list.text, /933730001|lina@example/, "no phone numbers or emails on candidate cards");
  const everyone = await r.get("/lite/candidates"); assert.match(everyone.text, /عمر ن\./, "the student is listed too");
  assert.doesNotMatch(everyone.text, /\b(rcSt_|lvl_|edu_|err_|st_)[a-z]/, "a student's card shows a translated status, not a raw key (D-04)");
  const id = /\/lite\/candidates\/(\d+)\/invite/.exec(list.text)[1], inv = await r.get(`/lite/candidates/${id}/invite`);
  const fee = await r.post(`/lite/candidates/${id}/invite`, { csrf: r.csrf(inv.text), kind: "event", title: "Open day", date: inDays(9), place: "Damascus", link: "", message: "There is an application fee of 5,000 SYP" });
  assert.match(fee.text, /role="alert"/, "a message asking for money is refused");
  const ok = await r.post(`/lite/candidates/${id}/invite`, { csrf: r.csrf(inv.text), kind: "event", title: "Open day", date: inDays(9), place: "Damascus, Mezzeh", link: "", message: "Come and meet the team." });
  assert.equal(ok.location, "/lite/candidates/sent?done=invited");
  assert.match((await r.get("/lite/candidates/sent?done=invited")).text, /Open day/);
  assert.equal(S.db.get("SELECT COUNT(*) AS n FROM invitations WHERE user_id = ?", Number(id)).n, 1);
  const s2 = S.browser(); await s2.signin("0933 730 001");
  assert.match((await s2.get("/lite/hire")).text, /مسجّل لباحث عن عمل/, "a job seeker's number doesn't become a recruiter account");
  assert.equal((await s2.get("/lite/candidates")).location, "/lite/hire");
});

test("lite: people abroad can say where they live, filter for returnees, and save a search as an alert", async () => {
  const S = await start(), b = S.browser();
  await b.signin("0933 750 001");
  const tok = b.csrf((await b.get("/lite/profile?step=1")).text);
  assert.match((await b.get("/lite/profile?step=1")).text, /<option value="abroad"/, "Outside Syria is a choice");
  assert.equal((await b.post("/lite/profile", { csrf: tok, step: "1", name: "Omar Nabil Al-Khatib", gov: "abroad", country: "de", email: "omar@example.com" })).location, "/lite/profile?step=2");
  const uid = S.db.get("SELECT user_id FROM profiles ORDER BY rowid DESC LIMIT 1").user_id, prof = JSON.parse(S.db.get("SELECT data FROM profiles WHERE user_id = ?", uid).data);
  assert.deepEqual([prof.gov, prof.country], ["abroad", "de"]);
  const ret = await b.get("/lite?returnees=1"); assert.match(ret.text, /aria-current="true">(For returnees|للعائدين)</);
  const all = (await b.get("/lite")).text.match(/href="\/lite\/job\/\d+"/g).length, only = (ret.text.match(/href="\/lite\/job\/\d+"/g) || []).length;
  assert.ok(only > 0 && only < all, `the filter narrows the list (${only} of ${all})`);
  const saved = await b.post("/lite/alerts", { csrf: tok, q: "", gov: "damascus", type: "", returnees: "1" });
  assert.match(saved.location, /^\/lite\?gov=damascus&returnees=1&done=alerted$/);
  const a = S.db.get("SELECT data, channel FROM alerts WHERE user_id = ?", uid);
  assert.deepEqual([JSON.parse(a.data).gov, JSON.parse(a.data).tab, a.channel], ["damascus", "returnees", "app"], "email alerts need an email service, so it falls back to the app");
  const meP = await b.get("/lite/me"); assert.match(meP.text, /action="\/lite\/alerts\/\d+\/delete"/);
  const id = /action="\/lite\/alerts\/(\d+)\/delete"/.exec(meP.text)[1];
  assert.equal((await b.post(`/lite/alerts/${id}/delete`, { csrf: tok })).location, "/lite/me");
  assert.equal(S.db.get("SELECT COUNT(*) AS n FROM alerts WHERE user_id = ?", uid).n, 0);
});

test("lite: the privacy notice and the terms are readable without JavaScript, in both languages, with the organisation's details filled in (D-12)", async () => {
  const S = await start({ LEGAL_NAME: "Example Org (not a real entity)", CONTACT_EMAIL: "privacy@example.com" }), b = S.browser();
  const ar = await b.get("/lite/privacy");
  assert.equal(ar.status, 200); assert.match(ar.text, /<html lang="ar" dir="rtl">/); assert.doesNotMatch(ar.text, /<script/, "no script on a legal page");
  assert.match(ar.text, /<h1>إشعار الخصوصية<\/h1>/, "the Arabic privacy notice"); assert.doesNotMatch(ar.text, /شروط الاستخدام<\/h1>/, "and not the terms");
  assert.ok(ar.text.includes("Example Org (not a real entity)") && ar.text.includes("privacy@example.com"), "LEGAL_NAME and CONTACT_EMAIL are filled in");
  assert.doesNotMatch(ar.text, /\{(name|contact|days|date)\}/, "no placeholder is left"); assert.match(ar.text, /2026/, "the version date is shown");
  const en = await b.get("/lite/terms?lang=en");
  assert.equal(en.status, 200); assert.match(en.text, /<html lang="en" dir="ltr">/); assert.match(en.text, /<h1>Terms of use<\/h1>/); assert.doesNotMatch(en.text, /<h1>Privacy notice/);
  assert.match(en.text, /href="\/lite\/privacy"/, "each document links to the other"); assert.doesNotMatch(en.text, /<script/);
  assert.match((await b.get("/lite/privacy")).text, /<html lang="en" dir="ltr">.*<h1>Privacy notice<\/h1>/s, "the language choice sticks (ll cookie)");
  for (const p of ["/lite/signin", "/lite", "/lite/hire"]) { const t = (await b.get(p)).text; assert.match(t, /href="\/lite\/terms"/); assert.match(t, /href="\/lite\/privacy"/); assert.doesNotMatch(t, /\/#\/(terms|privacy)/, p + " no longer points at the JavaScript-only pages"); }
  for (const p of ["/lite/privacy", "/lite/terms", "/lite/privacy?lang=ar", "/lite/terms?lang=ar"]) { const w = await S.raw(p); assert.equal(w.headers["content-encoding"], "gzip"); assert.ok(w.bytes < 6144, `${p}: long-form text, its own budget of 6 KB over the wire (${w.bytes} bytes)`); }
});

test("lite: the code field takes Arabic-Indic digits, and looking at the sign-in page spends no challenge (D-23, D-24)", async () => {
  const S = await start(), b = S.browser();
  const pg = await b.get("/lite/signin");
  const r1 = await b.post("/lite/signin", { csrf: b.csrf(pg.text), phone: "0933 790 001", consent: "1", role: "seeker", next: "", pow_challenge: /name="pow_challenge" value="([^"]+)"/.exec(pg.text)[1], pow_nonce: "" });
  const input = /<input id="code"[^>]*>/.exec(r1.text)[0];
  assert.doesNotMatch(input, /pattern=/, "D-23: no pattern attribute, so a browser lets Arabic-Indic digits through to the server, which accepts them");
  const arabic = c => String(c).replace(/[0-9]/g, d => "٠١٢٣٤٥٦٧٨٩"[d]);
  assert.equal((await b.post("/lite/signin/code", { csrf: b.csrf(r1.text), phone: "+963933790001", code: arabic(/(\d{6})/.exec([...S.texts].reverse().find(x => x.to === "+963933790001").body)[1]), role: "seeker", next: "" })).location, "/lite/me", "the code in Arabic-Indic digits signs in");
  const v = S.browser();   // D-24: sixty-one views of the sign-in page and one of the recruiter page, then the API's challenge is still there
  for (let i = 1; i <= 61; i++) { const r = await v.get("/lite/signin"); assert.equal(r.status, 200, `view ${i} of the sign-in page`); assert.match(r.text, /name="pow_challenge"/); }
  assert.equal((await v.get("/lite/hire")).status, 200);
  assert.equal((await S.client().get("/api/auth/challenge")).status, 200, "D-24: page views do not spend the address's sixty challenges");
});

test("lite: remote listings show under every governorate, and a saved listing stays past the 500 newest (D-26, D-27)", async () => {
  const S = await start(), admin = await S.login("+12025550199"), { e } = await employer(S, admin, "0955 795 001", "Remote Co"), b = S.browser();
  const post = async over => { const j = (await e.post("/api/employer/jobs", { job: { title: { en: "Field trainee" }, gov: "homs", type: "full", level: "entry", pay: [1500000, 2000000], langs: ["ar"], summary: { en: "Work with us." }, ...over }, submit: true })).body.job; await admin.post(`/api/admin/jobs/${j.id}/approve`); return j.id; };
  await post({ title: { en: "Remote Translator", ar: "مترجم عن بعد" }, gov: "remote" });
  for (const gov of ["damascus", "aleppo"]) assert.match((await b.get(`/lite?gov=${gov}&lang=en`)).text, /Remote Translator/, `D-26: the remote listing shows under ${gov}`);
  const keep = await post({ title: { en: "Keep me", ar: "احتفظ بي" }, gov: "homs" });
  assert.equal((await b.signin("0933 795 001")).location, "/lite/me");
  const job = await b.get(`/lite/job/${keep}`); assert.equal((await b.post(`/lite/job/${keep}/save`, { csrf: b.csrf(job.text) })).status, 303);
  const co = S.db.get("SELECT id FROM companies WHERE json_extract(data, '$.name.en') = ?", "Remote Co").id, t0 = Date.now();
  S.db.tx(() => { for (let i = 1; i <= 520; i++) S.db.run("INSERT INTO jobs (company_id, data, status, published_at, created_at, updated_at) VALUES (?, ?, 'published', ?, ?, ?)", co, JSON.stringify({ title: { en: "Filler " + i }, gov: "homs", type: "full", level: "entry", pay: [1500000, 2000000], langs: ["ar"], summary: { en: "x" } }), t0 + i, t0 + i, t0 + i); });
  assert.match((await b.get("/lite?saved=1&lang=en")).text, /Keep me/, "D-27: the saved listing is on the Saved page although it is older than the 500 newest");
});
