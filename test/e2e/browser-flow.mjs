/* Browser test of the whole marketplace loop: a job seeker on a phone (Arabic), an employer and an admin
   on desktops (English), each in their own browser. Runs against a fresh temporary database.
   Setup once: npm install --no-save puppeteer     Run: npm run test:e2e     Screenshots: test/e2e/shots/ */
import puppeteer from "puppeteer";
import { spawn } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

const PORT = 3999, BASE = `http://127.0.0.1:${PORT}`, DB = path.join(os.tmpdir(), "shaghilni-e2e.db"), OUT = path.join(ROOT, "test", "e2e", "shots");
fs.mkdirSync(OUT, { recursive: true });
for (const f of [DB, DB + "-wal", DB + "-shm"]) { try { fs.unlinkSync(f); } catch {} }
const srv = spawn("node", ["--disable-warning=ExperimentalWarning", "server/index.js"], { cwd: ROOT,
  env: { ...process.env, PORT: String(PORT), HOST: "127.0.0.1", DB_PATH: DB, OTP_DEV_ECHO: "true", OTP_POW_BITS: "12", ADMIN_PHONES: "+12025550123", NODE_ENV: "development", BASE_URL: BASE, DEMO_ACCOUNTS: "false", PAY_PROVIDER: "test", PLAN_PRO_MONTHLY: "4000", PLAN_ENTERPRISE_MONTHLY: "20000",
    SMS_PROVIDER: "console", TEXTBEE_API_KEY: "", TWILIO_ACCOUNT_SID: "", TWILIO_AUTH_TOKEN: "", TWILIO_FROM: "", ANTHROPIC_API_KEY: "", EMAIL_API_URL: "", EMAIL_API_KEY: "" } });   // whatever the developer's .env says, no text, email or AI call leaves this machine (U-061)
let slog = ""; srv.stdout.on("data", d => { slog += d; }); srv.stderr.on("data", d => { slog += d; });
const sleep = ms => new Promise(r => setTimeout(r, ms));
for (let i = 0; i < 50; i++) { try { if ((await fetch(BASE + "/api/health")).ok) break; } catch {} await sleep(100); }

const browsers = [];
const results = [], errs = [];
const check = (name, ok, extra = "") => { results.push(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  (" + extra + ")" : ""}`); };

async function actor(label, w, h, mobile) {
  const b = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });   // one browser per actor: separate cookie jars
  browsers.push(b);
  const page = (await b.pages())[0] || await b.newPage();
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 2, isMobile: mobile, hasTouch: mobile });
  await page.setRequestInterception(true);
  page.on("request", req => {
    const u = req.url();
    const allowed = u.startsWith(BASE) || u.startsWith("data:") || u.startsWith("about:");
    if (!allowed) return req.abort();   // e.g. the wa.me link: nothing leaves the machine
    req.continue();
  });
  page.on("pageerror", e => errs.push(`[${label}] pageerror: ${e.message}`));
  page.on("console", m => {
    if (m.type() === "error" && !/net::ERR_FAILED|ERR_BLOCKED|status of 4(09|22|29)/.test(m.text())) errs.push(`[${label}] console: ${m.text()}`);
  });
  page.on("request", r => { const u = r.url(); if (!/^(data:|blob:|about:)/.test(u) && !u.startsWith(BASE)) thirdParty.push(`[${label}] ${u}`); });
  page.label = label;
  return page;
}
const thirdParty = [];
const click = async (p, sel) => {
  await p.waitForSelector(sel, { visible: true, timeout: 8000 });
  if (/#sheetScroll|#panel|#layer|apply-send|wa-open|layer-close/.test(sel)) await sleep(450);   // let a sliding sheet or panel settle, as a person would
  await p.click(sel);
};
const typeIn = async (p, sel, text) => { await p.waitForSelector(sel, { visible: true, timeout: 8000 }); await p.$eval(sel, el => { el.value = ""; }); await p.type(sel, text); };
const shot = async (p, name) => { await sleep(500); await p.screenshot({ path: path.join(OUT, `${name}.png`) }); };
const apiGet = (p, path) => p.evaluate(async u => (await fetch(u)).json(), path);
const toastText = p => p.evaluate(() => [...document.querySelectorAll("#toaster li")].map(x => x.textContent).join(" | "));
async function signIn(p, phone) {
  await typeIn(p, "#obPhone", phone); await click(p, "#obAccept"); await click(p, '#onb [data-act="onb-next"]');
  await p.waitForFunction(() => /\d{6}/.test((document.querySelector("#onb .hint") || {}).textContent || ""), { timeout: 8000 });
  const code = await p.$eval("#onb .hint", el => el.textContent.match(/\d{6}/)[0]);
  await typeIn(p, "#obCode", code); await click(p, '#onb [data-act="onb-next"]');
}

try {
  /* A. Job seeker on a phone, in Arabic */
  const m = await actor("seeker", 390, 844, true);
  await m.goto(BASE + "/", { waitUntil: "networkidle0" });
  await m.waitForSelector("#onb:not([hidden]) .roles", { timeout: 8000 });
  check("first visit opens the Arabic welcome", await m.$eval("html", h => h.dir + h.lang) === "rtlar");
  await shot(m, "a1-welcome");
  await click(m, '[data-act="onb-role"][data-role="student"]');
  await m.waitForSelector("#obPhone", { visible: true });
  check("sign-up offers country codes, Syria first", await m.evaluate(() => { const s = document.querySelector("#obCc"); return !!s && s.options[0].value === "963" && s.value === "963" && s.options.length > 10; }));
  await typeIn(m, "#obPhone", "0944111222"); await click(m, '#onb [data-act="onb-next"]');
  await m.waitForSelector("#obErr-accept", { visible: true, timeout: 8000 });
  check("no code is sent until the consent box is ticked", !(await m.$("#obCode")));
  await click(m, "#obAccept"); await click(m, '#onb [data-act="onb-next"]');
  await m.waitForSelector("#obCode", { visible: true });
  await shot(m, "a2-code");
  const code = await m.$eval("#onb .hint", el => el.textContent.match(/\d{6}/)[0]);
  await typeIn(m, "#obCode", code); await click(m, '#onb [data-act="onb-next"]');
  await m.waitForSelector("#obName", { visible: true, timeout: 8000 });
  check("new seeker continues from sign-in into the profile", true);
  await m.waitForSelector('[data-import="onb"]', { timeout: 8000 }); await shot(m, "a2b-about");
  check("sign-up keeps one step count from the phone number, with one main button and no way back into the phone step", await m.evaluate(() =>
    /2\D+5/.test(document.querySelector(".onb-prog-t").textContent) && !document.querySelector('#onb [data-act="onb-back"]') && document.querySelectorAll("#onbCard .btn--primary").length === 0
    && !!document.querySelector("#onbCard .im-quiet") && document.querySelector("#obName").getBoundingClientRect().bottom < document.querySelector("#onbCard .im-quiet").getBoundingClientRect().top));
  await typeIn(m, "#obName", "لينا حداد"); await m.select("#obGov", "abroad"); await m.waitForSelector("#obCountry", { visible: true });
  check("choosing Outside Syria asks which country", !!(await m.$("#obCountry")));
  await m.select("#obGov", "damascus"); await sleep(200);
  check("and a governorate hides it again", !(await m.$("#obCountry")));
  await click(m, '#onb [data-act="onb-next"]');
  await m.waitForSelector("#obUni", { visible: true });
  await m.select("#obUni", "damascus");
  await m.$eval("#obFac", s => { s.value = s.options[3].value; s.dispatchEvent(new Event("change", { bubbles: true })); });
  await click(m, '[data-act="onb-set"][data-path="edu.year"][data-val="3"]');
  await m.$eval("#obGrad", s => { s.value = s.options[2].value; s.dispatchEvent(new Event("change", { bubbles: true })); });
  await click(m, '#onb [data-act="onb-next"]');
  await sleep(400); await click(m, '#onb [data-act="onb-next"]');           // goals
  await m.waitForSelector('[data-act="onb-add"]', { visible: true });
  await click(m, '[data-act="onb-add"][data-kind="exp"]');
  await typeIn(m, "#obRole", "متدربة مبيعات");
  const orgSel = await m.$('[data-ef="org"]'); if (orgSel) { await orgSel.type("كتاكيت"); }
  await m.evaluate(() => { const set = (k, v) => { const el = document.querySelector(`[data-ef="${k}"]`); if (el) { el.value = v; el.dispatchEvent(new Event(el.tagName === "SELECT" ? "change" : "input", { bubbles: true })); } };
    set("start.m", "6"); set("start.y", "2025"); set("end.m", "8"); set("end.y", "2025"); });
  const bul = await m.$('[data-ef="bullets"]'); if (bul) await bul.type("Helped with stock counts\nServed 40 customers a day");
  await click(m, '[data-act="onb-save"]'); await sleep(300);
  await shot(m, "a3-exp");
  await click(m, '#onb [data-act="onb-next"]');
  await m.waitForSelector('[data-act="onb-finish"]', { visible: true, timeout: 8000 });
  await shot(m, "a4-done");
  const me = await apiGet(m, "/api/me");
  check("profile saved on the server", me.profile && me.profile.name === "لينا حداد", me.profile ? me.profile.exp.length + " experience entries" : "no profile");
  await click(m, '[data-act="onb-finish"][data-then="jobs"]');
  await m.waitForSelector("#rows > li", { visible: true });
  check("board shows the 18 sample listings that pass the posting checks", (await m.$$eval("#rows > li", x => x.length)) === 18);
  await shot(m, "a5-board");
  await click(m, '[data-act="view"][data-view="alerts"]'); await m.waitForSelector('[data-act="al-save"]', { visible: true, timeout: 8000 });
  await shot(m, "a5b-alerts"); await click(m, '[data-act="al-save"]'); await m.waitForSelector(".al-row", { visible: true, timeout: 8000 });
  check("a job seeker can save a search as an alert", (await m.$$eval(".al-row", x => x.length)) === 1);
  await click(m, '[data-act="al-open"]'); await m.waitForSelector("#rows > li", { visible: true });
  await click(m, '#rows > li [data-act="open"]');
  await m.waitForSelector("#layer:not([hidden]) #sheetScroll", { visible: true });
  check("job opens as a sheet with a #/job route", /#\/job\/\d+/.test(await m.evaluate(() => location.hash)));
  await shot(m, "a6-sheet");
  await click(m, '#sheetScroll [data-act="apply"]');
  await m.waitForSelector('[data-act="apply-send"]', { visible: true });
  await shot(m, "a7-apply");
  check("quick apply attaches the Shaghilni resume", await m.$eval("#applyCv", x => !!x.querySelector(".pill--good") && !!x.querySelector(".cvatt-name").textContent.trim()));
  await click(m, '#applyCv [data-act="apply-cv-lang"][data-l="en"]');
  await m.waitForFunction(() => document.querySelector('#applyCv [data-l="en"]').getAttribute("aria-pressed") === "true");
  check("choosing English counts the lines still to translate", /\d/.test(await m.$eval("#applyCv .cvatt-st", x => x.textContent)) && !!(await m.$('#applyCv [data-act="apply-cv-fix"]')));
  await click(m, '#applyCv [data-act="apply-cv-prev"]');
  await m.waitForSelector("#applyCv .paper", { visible: true, timeout: 8000 });
  check("the preview shows the English resume", await m.$eval("#applyCv .paper", p => p.dir === "ltr"));
  await shot(m, "a7b-apply-english");
  await click(m, '[data-act="apply-send"]');
  await sleep(700);
  const apps1 = await apiGet(m, "/api/me/applications");
  check("web application recorded", apps1.applications && apps1.applications.length === 1, await toastText(m));
  check("the application records the English resume", apps1.applications[0].cvLang === "en");
  await m.evaluate(() => location.hash = "#/applications");
  await m.waitForSelector(".acard", { visible: true, timeout: 8000 });
  check("applications view lists it with status", (await m.$eval(".acard .pill", x => x.textContent)).includes("انبعت"));
  await shot(m, "a8-applications");

  /* B. Employer on a desktop, in English */
  const e = await actor("employer", 1280, 860, false);
  await e.goto(BASE + "/#/company", { waitUntil: "networkidle0" });
  await e.waitForSelector("#onb:not([hidden]) #obPhone", { timeout: 8000 });
  check("company route asks a guest to sign in", true);
  await click(e, '#onb [data-act="lang"]'); await sleep(200);
  await signIn(e, "0955666777");
  await e.waitForFunction(() => location.hash.startsWith("#/company") && document.querySelector(".page-in"), { timeout: 8000 });
  await sleep(300);
  await shot(e, "b1-employer-empty");
  await e.evaluate(() => location.hash = "#/company/edit");
  await e.waitForSelector("#coNameEn", { visible: true });
  await typeIn(e, "#coNameEn", "Beit Accounting"); await typeIn(e, "#coNameAr", "بيت المحاسبة");
  await e.select("#coSector", "finance"); await e.select("#coGov", "damascus");
  await typeIn(e, "#coRegNo", "DM-12345"); await typeIn(e, "#coContact", "Rami Khoury"); await typeIn(e, "#coWhatsapp", "0955666777");
  await typeIn(e, "#coAboutEn", "Bookkeeping and tax filing for shops in Damascus.");
  await shot(e, "b2-company-form");
  await click(e, '[data-act="emp-co-save"]');
  await e.waitForSelector('[data-act="emp-co-submit"]:not([disabled])', { visible: true, timeout: 8000 });
  await click(e, '[data-act="emp-co-submit"]'); await sleep(700);
  check("company submitted for verification", (await apiGet(e, "/api/employer")).company.status === "pending");
  await shot(e, "b3-company-pending");
  await e.evaluate(() => location.hash = "#/company/jobs/new");
  await e.waitForSelector('[data-jf="title.ar"]', { visible: true });
  await typeIn(e, '[data-jf="title.en"]', "Junior accountant"); await typeIn(e, '[data-jf="title.ar"]', "محاسب مبتدئ");
  await e.select('[data-jf="gov"]', "damascus");
  await typeIn(e, '[data-jf="pay.0"]', "2500000"); await typeIn(e, '[data-jf="pay.1"]', "3200000");
  await typeIn(e, '[data-jf="summary.en"]', "Keep the books for a busy accounting office. A registration fee applies.");
  await typeIn(e, '[data-jf="duties.en"]', "Prepare invoices\nReconcile accounts");
  await typeIn(e, '[data-jf="needs.en"]', "Degree in economics or commerce");
  await sleep(200);
  check("live check blocks the fee wording", (await e.$$eval(".lint-row .state--no", x => x.length)) === 1);
  await shot(e, "b4-jobform-fee");
  check("the posting form asks each question in the language of its answer", await e.evaluate(() => {
    const q = s => document.querySelector(`label[for="${s}"]`);
    return q("jf-title.ar").textContent.trim() === "المسمى الوظيفي بالعربية" && q("jf-title.ar").closest(".field").getAttribute("lang") === "ar"
      && q("jf-summary.ar").textContent.trim() === "عن الوظيفة بالعربية" && q("jf-title.en").textContent.trim() === "Job title in English"; }));
  await typeIn(e, '[data-jf="summary.en"]', "Keep the books for a busy accounting office in Mazzeh.");
  await click(e, '[data-act="emp-jf-save"]');
  await e.waitForSelector('[data-act="emp-job-submit"]', { visible: true, timeout: 8000 });
  check("draft listing saved", (await apiGet(e, "/api/employer")).jobs[0].status === "draft");
  await click(e, '[data-act="emp-job-submit"]'); await sleep(600);
  check("submitting before verification is refused with a clear message", (await toastText(e)).includes("verified"), await toastText(e));

  /* C. Admin verifies the company and publishes the listing */
  const a = await actor("admin", 1280, 860, false);
  await a.goto(BASE + "/#/admin", { waitUntil: "networkidle0" });
  await a.waitForSelector("#onb:not([hidden]) #obPhone", { timeout: 8000 });
  await click(a, '#onb [data-act="lang"]'); await sleep(200);
  await signIn(a, "+12025550123");
  await a.waitForSelector(".metrics", { visible: true, timeout: 8000 });
  check("admin phone lands on the admin overview", true);
  await shot(a, "c1-admin-overview");
  await a.evaluate(() => location.hash = "#/admin/companies");
  await a.waitForSelector('[data-act="adm-verify"]', { visible: true, timeout: 8000 });
  await click(a, '[data-act="adm-verify"]'); await sleep(300);
  check("verify needs the sanctions checkbox", (await toastText(a)).toLowerCase().includes("sanctions"));
  await a.click('input[id^="scr-"]'); await shot(a, "c2-verify-queue");
  await click(a, '[data-act="adm-verify"]'); await sleep(700);
  await e.reload({ waitUntil: "networkidle0" }); await e.waitForSelector('[data-act="emp-job-submit"]', { visible: true });
  await click(e, '[data-act="emp-job-submit"]'); await sleep(700);
  await a.evaluate(() => location.hash = "#/admin/jobs");
  await a.waitForSelector('[data-act="adm-approve"]:not([disabled])', { visible: true, timeout: 8000 });
  await shot(a, "c3-review-queue");
  await click(a, '[data-act="adm-approve"]'); await sleep(700);
  check("listing is live", (await apiGet(a, "/api/jobs")).jobs.length === 19);

  /* D. Seeker applies by WhatsApp; employer runs the pipeline; admin confirms the hire */
  await m.goto(BASE + "/#/", { waitUntil: "networkidle0" });
  await m.waitForSelector("#rows > li");
  const jobId = (await apiGet(m, "/api/jobs")).jobs.find(j => j.title.en === "Junior accountant").id;
  await m.evaluate(id => location.hash = "#/job/" + id, jobId);
  await m.waitForSelector('#sheetScroll [data-act="wa"]', { visible: true, timeout: 8000 });
  await click(m, '#sheetScroll [data-act="wa"]');
  await m.waitForSelector('[data-act="wa-open"]', { visible: true });
  await shot(m, "a9-whatsapp");
  check("WhatsApp says which resume goes with it", !!(await m.$("#waCvNote")) && (await m.$eval("#waCvNote", x => x.textContent.trim().length)) > 10);
  await m.evaluate(() => { window.open = () => { const w = { location: {} }; window.__wa = w; return w; }; });   // the chat link opens a new tab, which leaves this page in the background where Puppeteer's visibility waits never fire (D-38); the stub keeps the link on this side
  await click(m, '[data-act="wa-open"]'); await sleep(900);
  check("the chat opens on wa.me with the message", await m.evaluate(() => !!window.__wa && /^https:\/\/wa\.me\/\d+\?text=./.test(window.__wa.location.href || "")));
  check("WhatsApp application recorded", (await apiGet(m, "/api/me/applications")).applications.some(x => x.jobId === jobId && x.channel === "whatsapp"));
  await e.evaluate(id => location.hash = `#/company/jobs/${id}/applicants`, jobId);
  await e.waitForSelector(".acard--ap", { visible: true, timeout: 8000 });
  await shot(e, "b5-applicants");
  await click(e, '[data-act="emp-resume"]');
  await e.waitForSelector("#layer:not([hidden]) .paper-wrap", { visible: true, timeout: 8000 });
  check("the employer's view opens in the language the applicant sent", await e.evaluate(() => { const s = document.querySelector("#layer .ap-sent"), p = document.querySelector("#apPaper .paper");
    return !!s && !!p && p.dir === (/English|الإنجليزية/.test(s.textContent) ? "ltr" : "rtl"); }));
  await shot(e, "b6-applicant-resume");
  await click(e, '#panel [data-act="layer-close"]'); await sleep(400);
  for (const to of ["shortlisted", "interview", "hired"]) { await click(e, `[data-act="emp-move"][data-to="${to}"]`); await sleep(600); }
  const texts = slog.split("\n").filter(l => l.includes("[sms] to +963944111222:") && !/\d{6}/.test(l.split("+963944111222:")[1] || ""));
  check("seeker is texted at each stage", texts.length === 3, texts.length + " texts");
  await shot(e, "b7-hired");
  await a.evaluate(() => location.hash = "#/admin/hires");
  await a.waitForSelector('[data-act="adm-confirm"]', { visible: true, timeout: 8000 });
  await shot(a, "c4-hires");
  await a.evaluate(() => { location.hash = "#/admin/billing"; }); await a.waitForSelector("#admBody .bill", { visible: true, timeout: 8000 });
  check("the admin has a billing tab for plans, charges and programmes", (await a.$$eval("#admBody .bill", x => x.length)) === 4);
  await shot(a, "c4b-billing");
  await a.evaluate(() => { location.hash = "#/admin/hires"; }); await a.waitForSelector('[data-act="adm-confirm"]', { visible: true, timeout: 8000 });
  await a.evaluate(() => { location.hash = "#/admin/campus"; }); await a.waitForSelector("#admBody #caUni", { visible: true, timeout: 8000 });
  check("the admin has a Universities tab for adding career offices", (await a.$$eval("#admBody .bill", x => x.length)) === 2);
  await shot(a, "c4c-universities");
  await a.evaluate(() => { location.hash = "#/admin/hires"; }); await a.waitForSelector('[data-act="adm-confirm"]', { visible: true, timeout: 8000 });
  await click(a, '[data-act="adm-confirm"]'); await sleep(700);
  await a.evaluate(() => location.hash = "#/admin");
  await a.waitForSelector(".metric--big", { visible: true });
  check("confirmed hires metric reads 1", (await a.$eval(".metric--big .metric-n", x => x.textContent.trim())) === "1");
  await a.evaluate(() => location.hash = "#/admin/traffic"); await a.waitForSelector(".tr .tr-chart", { visible: true, timeout: 8000 });
  check("the team's Traffic tab shows visitors, pages and where they came from", await a.$$eval(".tr .card-h", h => h.length >= 6));
  await a.evaluate(() => location.hash = "#/admin/system"); await a.waitForSelector(".tr .metric--big", { visible: true, timeout: 8000 });
  check("the System tab shows the server's health", /Working|Errors|Quiet|شغّال|أخطاء|هادي/.test(await a.$eval(".tr .metric--big", x => x.textContent)));
  await a.evaluate(() => location.hash = "#/admin");
  await shot(a, "c5-admin-after");
  await m.evaluate(() => location.hash = "#/applications"); await m.waitForSelector(".acard .pill", { visible: true }); await sleep(400);
  check("seeker sees 'hired'", (await m.$$eval(".acard .pill", x => x.map(y => y.textContent))).includes("تم التوظيف"));
  await shot(m, "a10-hired");
  await m.evaluate(() => { location.hash = "#/"; });
  await m.waitForSelector('#rows > li [data-act="open"]', { visible: true, timeout: 8000 });
  await click(m, '#rows > li [data-act="open"]');
  await m.waitForSelector('#layer:not([hidden]) #sheetScroll', { visible: true, timeout: 8000 }); await sleep(400);
  await click(m, '#sheetScroll [data-act="resume"]');
  await m.waitForSelector(".cv-focus", { visible: true, timeout: 8000 });
  check("“Tailor my resume for this job” opens the one resume, focused on that job, with no version picker", (await m.evaluate(() => location.hash)).startsWith("#/resume/") && !(await m.$("#cvTarget")) && await m.$eval("#layer", l => l.hidden));
  await click(m, '[data-act="cv-focus-done"]'); await sleep(500);
  check("Done goes back to the plain resume", (await m.evaluate(() => location.hash)) === "#/resume" && !(await m.$(".cv-focus")));
  await m.waitForSelector(".paper", { visible: true, timeout: 8000 });
  check("resume helper renders from the saved profile", (await m.$eval(".paper", x => x.textContent)).includes("لينا حداد"));
  await shot(m, "a11-resume");
  await click(m, '[data-act="cv-lang"][data-l="en"]');
  await m.waitForSelector(".trbar", { timeout: 8000 });
  check("the English version counts the lines still in Arabic", /\d/.test(await m.$eval(".trbar", x => x.textContent)));
  if (await m.$('[data-act="cv-tab"][data-pane="preview"]')) await click(m, '[data-act="cv-tab"][data-pane="preview"]');
  await click(m, '[data-act="cv-tr-edit"]');
  await m.waitForSelector("#trName", { visible: true, timeout: 8000 });
  check("the name arrives already written in English, with a note to check it", (await m.$eval("#trName", i => i.value)) === "Lina Haddad" && /جواز|passport/.test(await m.$eval("#trName + .hint", x => x.textContent))
    && (await m.$eval("#cvPaper .pp-name", x => x.textContent)) === "Lina Haddad");
  await typeIn(m, "#trName", "Lina Haddad");
  await typeIn(m, 'textarea[data-tr="0"]', "Business analyst intern");
  await sleep(900);
  check("typed translations appear on the English resume", await m.evaluate(() => { const p = document.querySelector("#cvPaper");
    return p.dir === "ltr" && p.querySelector(".pp-name").textContent === "Lina Haddad" && p.textContent.includes("Business analyst intern"); }));
  await shot(m, "a11b-translate");
  await sleep(900);
  check("translations are saved with the profile", await m.evaluate(async () => { const me = (await (await fetch("/api/me")).json()).profile;
    return me.nameEn === "Lina Haddad" && me.tr.en.some(p => p[1] === "Business analyst intern"); }));
  check("the 'not translated yet' note clears as you type", await m.$eval(".tr-row", r => { const x = r.querySelector(".tr-meta"); return !x || x.hidden; }));
  if (await m.$('[data-act="cv-tab"][data-pane="preview"]')) { await click(m, '[data-act="cv-tab"][data-pane="preview"]'); await sleep(500); }
  await shot(m, "a11c-english");
  /* C1b. A resume the student already has: read on the phone, reviewed, then added */
  if (await m.$('[data-act="cv-tab"][data-pane="facts"]')) await click(m, '[data-act="cv-tab"][data-pane="facts"]');
  { const done = await m.$('[data-act="cv-tr-close"]'); if (done && await done.isVisible()) await click(m, '[data-act="cv-tr-close"]'); }
  const cvUp = await m.waitForSelector('input[type="file"][data-import="cv"]', { timeout: 8000 });
  await cvUp.uploadFile(ROOT + "/test/fixtures/resume-en-chrome.pdf");
  await m.waitForSelector('#panel [data-act="im-apply"]', { visible: true, timeout: 15000 });
  check("an uploaded PDF resume is read on the phone and shown for review", await m.$eval("#panel", p => p.querySelectorAll(".im-row").length >= 5 && p.textContent.includes("Orontes Energy")));
  await shot(m, "a11d-import");
  await click(m, '#panel [data-act="im-apply"]');
  await m.waitForFunction(() => document.querySelector("#layer").hidden, { timeout: 8000 });
  await sleep(1500);
  check("the resume's details join the profile, and the student's own name stays", await m.evaluate(async () => { const me = (await (await fetch("/api/me")).json()).profile;
    return me.name === "لينا حداد" && me.nameEn === "Lina Haddad" && me.skills.includes("AutoCAD") && me.exp.some(x => x.org === "Orontes Energy") && me.certs.some(c => c.startsWith("IELTS")); }));
  /* C2. Recruiters: the student opts in, a verified employer finds and invites them, the student answers */
  check("the phone tab bar has Resume, and Recruiters for students", JSON.stringify(await m.$$eval("#tabbar .tab-btn", b => b.map(x => x.dataset.view))) === JSON.stringify(["jobs", "applications", "recruiters", "resume", "profile"]));
  await m.evaluate(() => { location.hash = "#/recruiters"; });
  await m.waitForSelector(".rc-switch", { visible: true, timeout: 8000 });
  await click(m, ".rc-switch");
  await m.waitForFunction(() => document.querySelector(".rc-switch") && document.querySelector(".rc-switch").getAttribute("aria-checked") === "true", { timeout: 8000 });
  check("a student can let recruiters find them", true);
  await shot(m, "a12-recruiters-on");
  await e.evaluate(() => { location.hash = "#/company/students"; });
  await e.waitForSelector('#rcOut [data-act="rc-invite"]', { visible: true, timeout: 10000 });
  check("a verified employer finds the student, with no phone number on the card", await e.$eval("#rcOut", x => x.querySelectorAll(".rc-card").length >= 1 && !/\+963|944 ?111 ?222|0944111222/.test(x.textContent)));
  await shot(e, "b8-find-students");
  await click(e, '#rcOut [data-act="rc-invite"]');
  await e.waitForSelector("#rcInvBody", { visible: true, timeout: 8000 });
  await click(e, '[data-act="rc-kind"][data-k="event"]');
  await e.waitForSelector("#rcEvTitle", { visible: true, timeout: 8000 });
  await typeIn(e, "#rcEvTitle", "Careers day");
  await e.$eval("#rcEvDate", (el, v) => { el.value = v; }, new Date(Date.now() + 14 * 86400e3).toISOString().slice(0, 10));
  await typeIn(e, "#rcEvPlace", "Damascus University, main hall");
  await typeIn(e, "#rcMsg", "We would love to meet you at our careers day.");
  await shot(e, "b9-invite");
  await click(e, '[data-act="rc-send"]');
  await e.waitForFunction(() => !document.querySelector("#rcInvBody"), { timeout: 8000 });
  check("the employer sends an event invitation", true);
  await m.evaluate(() => { location.hash = "#/"; });
  await m.reload({ waitUntil: "networkidle0" });
  await m.waitForSelector("#tabbar .tab-badge", { visible: true, timeout: 8000 });
  check("the student sees a badge for the new invitation", (await m.$eval("#tabbar .tab-badge", x => x.textContent.trim())) === "1");
  await click(m, '#tabbar [data-view="recruiters"]');
  await m.waitForSelector('#rcList [data-act="rc-yes"]', { visible: true, timeout: 8000 });
  await shot(m, "a13-invitation");
  await click(m, '#rcList [data-act="rc-yes"]');
  await m.waitForFunction(() => !document.querySelector('#rcList [data-act="rc-yes"]') && document.querySelector("#rcList .pill--good"), { timeout: 8000 });
  check("the student says yes to the event", true);
  await e.evaluate(() => { location.hash = "#/company/students/sent"; });
  await e.waitForSelector("#rcOut .rc-card", { visible: true, timeout: 8000 });
  check("the employer sees the student is attending, with their number now shared", await e.$eval("#rcOut", x => /Attending|سيحضر/.test(x.textContent) && !!x.querySelector('a[href^="tel:+963"]')));
  await shot(e, "b10-invitations-sent");
  await e.evaluate(() => { location.hash = "#/company"; }); await e.waitForSelector(".plan-card", { visible: true, timeout: 8000 });
  check("the employer's dashboard shows their plan and this month's invitations", await e.$eval(".plan-card", el => /1/.test(el.textContent) && /5/.test(el.textContent)));
  await shot(e, "b11-plan-card");
  await e.evaluate(() => { location.hash = "#/company/plan"; }); await e.waitForSelector(".plan-grid .plan-opt", { visible: true, timeout: 8000 });
  check("the plans page compares Free, Pro and Enterprise", (await e.$$eval(".plan-opt", x => x.length)) === 3);
  await shot(e, "b12-plans");
  await e.evaluate(() => { location.hash = "#/company/team"; }); await e.waitForSelector("#tmName", { visible: true, timeout: 8000 });
  await e.type("#tmName", "Lina Haddad"); await e.type("#tmPhone", "0955 444 777"); await e.select("#tmRole", "recruiter");
  await click(e, '[data-act="tm-invite"]'); await e.waitForFunction(() => /Lina Haddad/.test(document.querySelector("#view").textContent) && /Invited/.test(document.querySelector("#view").textContent), { timeout: 8000 });
  check("the owner invites a recruiter by phone, and sees them waiting to join", true);
  await shot(e, "b12-team");
  await e.evaluate(() => { location.hash = "#/company"; }); await e.waitForSelector('.plan-card [data-to="#/company/plan"].btn--primary', { visible: true, timeout: 8000 });
  check("a Free employer sees an Upgrade button on their plan card", true);
  await click(e, '.plan-card [data-to="#/company/plan"].btn--primary'); await e.waitForSelector('[data-act="emp-plan-want"][data-plan="pro"]', { visible: true, timeout: 8000 });
  await click(e, '[data-act="emp-plan-want"][data-plan="pro"]'); await e.waitForSelector('input[name="payHow"][value="wallet"]', { visible: true, timeout: 8000 });
  check("choosing Pro asks how they'd like to pay, and waits for an answer", await e.$eval('[data-act="emp-plan-req"]', b => b.disabled));
  await click(e, 'input[name="payHow"][value="wallet"]'); await shot(e, "b12b-pay");
  await click(e, '[data-act="emp-plan-req"]'); await e.waitForSelector(".plan-next", { visible: true, timeout: 8000 });
  check("after asking, they see what happens next and a reference to quote when paying", await e.$eval(".plan-next", el => /SHG-\d+-\d+/.test(el.textContent)));
  await shot(e, "b12c-next");
  await click(e, '[data-act="emp-plan-want"][data-plan="pro"][data-card="1"]'); await e.waitForSelector("#plMonths", { visible: true, timeout: 8000 });
  await e.select("#plMonths", "3"); await sleep(300);
  check("card payment shows the total for the months chosen", await e.$eval(".pay-total", el => /12,000|١٢٬٠٠٠/.test(el.textContent)));
  await shot(e, "b12d-card");
  await Promise.all([e.waitForNavigation({ waitUntil: "load" }), click(e, '[data-act="emp-plan-card"]')]);
  check("paying by card goes to the bank's payment page", /\/pay\/test\//.test(e.url()));
  await shot(e, "b12e-bank");
  await Promise.all([e.waitForNavigation({ waitUntil: "networkidle0" }), e.click('button[value="paid"]')]);
  await e.waitForSelector(".pay-result--ok", { visible: true, timeout: 15000 });
  check("after paying, the plan is on and the payment is shown", await e.$eval(".pay-result--ok", el => /Pro|الاحترافية/.test(el.textContent)));
  await shot(e, "b12f-paid");
  await e.evaluate(() => { location.hash = "#/"; }); await sleep(400);
  check("employers go to their listings instead of the job board", await e.evaluate(() => location.hash === "#/company" && !document.querySelector("#rows")));
  check("their navigation is their company, analytics and profile", await e.$$eval("#tabbar .tab-btn, #nav .nav-btn", b => !b.some(x => x.dataset.view === "jobs") && b.some(x => x.dataset.view === "analytics")));

  // Events: the admin publishes a careers day, the student signs up and gets a ticket, the admin checks them in.
  const evId = await a.evaluate(async () => { const d = new Date(Date.now() + 7 * 86400e3 + 3 * 3600e3).toISOString().slice(0, 16);
    const r = await fetch("/api/organize/events", { method: "POST", headers: { "content-type": "application/json", "x-shaghilni": "1" }, body: JSON.stringify({ publish: true,
      event: { kind: "careers_day", title: { en: "Careers Day", ar: "يوم المهن" }, startsLocal: d, place: { en: "Main hall", ar: "القاعة الرئيسية" }, host: "Sample business council", capacity: 50 } }) });
    return (await r.json()).event.id; });
  await m.evaluate(id => { location.hash = `#/events/${id}`; }, evId); await m.waitForSelector('[data-act="ev-rsvp"]', { visible: true, timeout: 8000 });
  await shot(m, "a12b-event"); await click(m, '[data-act="ev-rsvp"]');
  await m.waitForFunction(() => { const i = document.querySelector("#evQr"); return i && i.src.startsWith("data:image/") && i.naturalWidth > 0; }, { timeout: 10000 });
  const evCode = await m.$eval(".ticket-code", el => el.textContent.trim());
  check("signing up for an event gives a ticket with a QR code and a short code", /^[A-HJ-NP-Z2-9]{6}$/.test(evCode));
  await shot(m, "a12c-ticket");
  await a.evaluate(id => { location.hash = `#/organize/${id}`; }, evId); await a.waitForSelector("#ckCode", { visible: true, timeout: 8000 });
  await a.type("#ckCode", evCode.toLowerCase()); await click(a, '[data-act="ev-checkin"]'); await a.waitForSelector("#ckRes .ck-ok", { visible: true, timeout: 8000 });
  check("an organiser checks a person in by typing their code", true);
  await sleep(600);
  check("the counts update at the door: the report counts the person who came", await a.$$eval(".metric", ms => ms.some(x => /Came|حضروا/.test(x.querySelector(".metric-k").textContent) && /^(1|١)$/.test(x.querySelector(".metric-n").textContent.trim()))));
  await shot(a, "c6-event-manage");

  await m.evaluate(() => location.hash = "#/profile");
  await m.waitForSelector('[data-act="signout"]', { visible: true, timeout: 8000 });
  await shot(m, "a12-profile");
  await click(m, '[data-act="signout"]'); await sleep(700);
  check("sign out ends the session", (await apiGet(m, "/api/me")).user === null);
  check("signing out goes back to the welcome screen", !!(await m.$("#onb:not([hidden]) .roles")));
  await m.evaluate(() => location.hash = "#/applications"); await sleep(500);
  check("signed-out applications view asks to sign in", !!(await m.$('.page [data-act="signin"]')));

  /* C3. Shaghilni Lite, on a phone with JavaScript switched off */
  check("the full app hides the Lite link on a normal connection", await m.$eval("#liteSkip", a => a.hidden));
  const lp = await m.browser().newPage();
  await lp.setViewport({ width: 360, height: 740, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await lp.setJavaScriptEnabled(false);
  let liteBytes = 0; lp.on("response", r => { if (new URL(r.url()).pathname === "/lite") liteBytes += Number(r.headers()["content-length"] || 0); });
  await lp.goto(BASE + "/lite", { waitUntil: "load" });
  check("Lite lists jobs with JavaScript switched off, in a few kilobytes", (await lp.$$eval('a[href^="/lite/job/"]', a => a.length)) >= 5 && liteBytes > 0 && liteBytes < 9000);
  await shot(lp, "l1-lite-jobs");
  await Promise.all([lp.waitForNavigation({ waitUntil: "load" }), lp.click('a[href^="/lite/job/"]')]);
  await lp.waitForSelector("#apply", { timeout: 8000 });
  await shot(lp, "l2-lite-job");
  await Promise.all([lp.waitForNavigation({ waitUntil: "load" }), lp.click('#apply button[type="submit"]')]);
  check("applying from Lite without an account goes to sign-in, then back to the job", lp.url().includes("/lite/signin?next=%2Flite%2Fjob%2F"));
  await lp.goto(BASE + "/hire", { waitUntil: "load" });
  check("/hire opens the light recruiter sign-up page, with no scripts but the sign-in check", lp.url().endsWith("/lite/hire") && (await lp.$$eval("script", s => s.map(x => x.getAttribute("src")))).every(src => src === "/lite/pow.js") && !!(await lp.$("#ltPhone")));
  await shot(lp, "l3-lite-hire");
  await lp.close();

  /* D. The legal pages, fonts and third parties */
  const L = await actor("legal", 1280, 900, false);
  await L.goto(BASE + "/#/privacy", { waitUntil: "networkidle0" });
  await L.waitForSelector(".legal h1", { visible: true, timeout: 8000 });
  check("privacy notice opens straight from a link", (await L.$eval(".legal h1", x => x.textContent)) === "إشعار الخصوصية" && !(await L.$("#onb:not([hidden])")));
  check("privacy notice has all nine sections", (await L.$$(".legal section")).length === 9);
  await shot(L, "d1-privacy");
  await L.evaluate(() => { location.hash = "#/terms"; });
  await L.waitForFunction(() => (document.querySelector(".legal h1") || {}).textContent === "شروط الاستخدام", { timeout: 8000 });
  check("terms of use have all ten sections", (await L.$$(".legal section")).length === 10);
  check("the Arabic font is self-hosted and loaded", await L.evaluate(async () => { await document.fonts.ready; return document.fonts.check("16px 'IBM Plex Sans Arabic'", "شغّلني"); }));
  check("no request went to another site (fonts, analytics, ads)", thirdParty.filter(u => !/wa\.me|whatsapp/.test(u)).length === 0);
} catch (err) {
  results.push("FAIL  script stopped: " + err.message.split("\n")[0]);
} finally {
  console.log(results.join("\n"));
  console.log(errs.length ? "BROWSER ERRORS:\n" + [...new Set(errs)].join("\n") : "no browser errors");
  const bad = slog.split("\n").filter(l => /\[error\]/.test(l)); if (bad.length) console.log("SERVER ERRORS:\n" + bad.slice(0, 5).join("\n"));
  for (const b of browsers) await b.close().catch(() => {}); srv.kill();
  if (results.some(r => r.startsWith("FAIL")) || errs.length) process.exitCode = 1;
}
