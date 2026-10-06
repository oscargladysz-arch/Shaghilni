/* Shaghilni Lite: the core of Shaghilni as server-rendered pages, for phones on slow or expensive data. It has the
   same look as the full app (logo, colours, tab bar, company tiles) but no web fonts and no images. One small
   stylesheet and one icon file are downloaded once and cached for good. No JavaScript is needed except the
   invisible sign-in check, and an optional one-line script that makes "Save as PDF" a button. Every action goes
   through the same API handlers as the full app, in-process, so the rules, limits, texts and audit log are the
   same. Forms carry a signed token against cross-site requests. */
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { HttpError, send, parseCookies, clientIp } from "./http.js";
import { ROOT, TERMS_VERSION } from "./config.js";
import { listPublished, getPublished } from "./routes/public.js";
import { LITE_CSS, LITE_CSS_V, LITE_SPRITE, LITE_SPRITE_V, LITE_PRINT_JS, LITE_PRINT_V } from "./lite-assets.js";

const LT = {
  en: { brand: "Shaghilni", lite: "Lite", jobs: "Jobs", applied: "Applied", recruiters: "Recruiters", resume: "Resume", profile: "Profile", company: "Company", candidates: "Candidates", invitesTab: "Invitations",
    signin: "Sign in", signout: "Sign out", hire: "For recruiters", full: "Full site", privacy: "Privacy", terms: "Terms", back: "Back", liteNote: "Shaghilni Lite: a light version for slow or expensive connections.", countryHint: "Only if you live outside Syria.", applyCallBtn: "Apply by phone call", applyEmailBtn: "Apply by email", callH: "Call to apply", callP: "We added this job to your applications. Call {co} now and say you found the job on Shaghilni.", callNow: "Call", emH: "Apply by email", emP: "We added this job to your applications. Your email app opens with your resume written in; send it to {co}.", emOpen: "Write the email", emSubject: "Application: {title}, {name}", uniHere: "You’re signed in as a university career office. The career office portal is on the full site.", alertBtn: "Get alerts for this search", alerted: "Alert saved. We’ll tell you about new jobs like these.",
    search: "Search", searchPh: "Job, company or skill", all: "All", savedChip: "Saved", anywhere: "All Syria", go: "Show", noJobs: "No jobs match. Try fewer filters.", noSaved: "You haven’t saved any jobs yet. Tap the bookmark on a job to keep it here.",
    more: "More jobs", prev: "Previous jobs", today: "Posted today", daysAgo: "Posted {n} days ago", perMonth: "SYP a month", verified: "Verified employer", match: "{n}% match with your profile",
    save: "Save", saveJob: "Save this job", unsaveJob: "Remove from saved", apply: "Apply now", applyWa: "Apply by WhatsApp", applied1: "You’ve applied for this job.", seeApps: "See your applications",
    signinToApply: "You’ll be asked to sign in first. It takes a phone number and a code.", duties: "What you’ll do", needs: "What they need", provides: "What they offer",
    phoneL: "Mobile number", sendCode: "Send code", checking: "Checking…", consent: "I’m 18 or older and I agree to the Terms of use and the Privacy notice, including my data being stored and processed outside Syria.",
    consentNeeded: "Please tick the box to agree before we send a code.", codeL: "The 6-digit code we texted to {phone}", verify: "Sign in", devCode: "Test mode: your code is {code}", otherNumber: "Use a different number",
    signinH: "Sign in or create an account", signinP: "We’ll text you a code. There’s no password.", jsNote: "Signing in runs a quick check in your browser. If the button does nothing, use the full site.",
    gateH: "Sign in to see this", gateApplied: "Sign in to follow your applications.", gateRecruit: "Sign in to hear from recruiters.", gateResume: "Sign in to build your resume.", gateProfile: "Sign in to create your profile.",
    needProfile: "Create your profile first. It takes about two minutes.", createProfile: "Create your profile", hi: "{name}", strength: "Your profile is {n}% complete", strengthHint: "Next: {x}",
    strengthDone: "Your profile is complete.", edit: "Edit", editProfile: "Edit your profile", secAbout: "About you", secEdu: "Education", secExp: "Experience", secSkills: "Skills and languages", secPrefs: "What you’re looking for",
    missing: "Missing", done: "Done", stepOf: "Step {n} of 5", saveNext: "Save and continue", saveFinish: "Save and finish", skip: "Skip this step", savedAfter: "Saved after each step",
    statusL: "Your education", uniOther: "Another university", uniNameL: "University name", yearL: "Year of study", gradL: "Graduation year", gpaL: "Grade or GPA (optional)", pick: "Choose",
    expNone: "No experience added yet. Internships, part-time jobs and volunteering all count.", addExp: "Add a job or internship", editExp: "Edit this job", roleL: "Job title", orgL: "Company or organization",
    placeL: "Where (optional)", fromL: "From", toL: "To", monthPh: "YYYY-MM", currentL: "I still work here", bulletsL: "What you did, one point per line", saveExp: "Save this job", deleteExp: "Delete",
    cancel: "Cancel", skillsL: "Skills, separated by commas", certsL: "Certificates and courses, one per line", typesL: "Types of work", levelL: "Your experience", nextStep: "Continue",
    myApps: "Your applications", noApps: "You haven’t applied for anything yet.", findJobs: "Find jobs", recruitOn: "Recruiters can find you", recruitOff: "Recruiters can’t find you",
    turnOn: "Let recruiters find me", turnOff: "Stop recruiters finding me", invites: "Invitations", noInvites: "No invitations yet. Keep your profile up to date: recruiters search by faculty, skills and languages.",
    cvLangL: "Resume language", trProgress: "{lang} version translated", trLeft: "{n} lines still need translating. You can finish them on the full site.", trDone: "Fully translated",
    sendWa: "Send as text on WhatsApp", savePdf: "Save as PDF", printHint: "To save as PDF, use your browser’s Print or Share menu.", uploadCv: "Upload a resume (full site)",
    fullProfile: "Add activities, certificates and translations on the full site.", appliedDone: "Application sent. You can follow it here.", saved: "Saved.", answered: "Thanks, we’ve let them know.",
    waH: "Send your application on WhatsApp", waP: "Your application is recorded. Open WhatsApp to send your message to {co}.", openWa: "Open WhatsApp",
    waMsg: "Hello {co}, I’m {name}. I’d like to apply for {title}, which I found on Shaghilni.", waEdu: "Education: {v}", waSkills: "Skills: {v}",
    hireH: "Hire people who asked to hear from you", hireP: "Post jobs, and invite candidates to apply or to a careers day.", hire1: "Verified companies", hire2: "Ready candidates", hire3: "Event invitations",
    hireMore: "Every company is checked before it can post or search, including against sanctions lists. Candidates choose to be found, and you see only what they share.",
    hireStart: "Create a recruiter account", step1: "Your number", step2: "Your company", step3: "Verification", seekerHere: "This number is registered as a job seeker. Recruiter accounts need their own number.", adminHere: "You’re signed in as an admin.",
    coH: "Your company", coP: "We use these details to check your company. Candidates see the company name and description.", coNone: "Add your company’s details so we can check it.",
    coDraft: "Your details are saved. Send them to us to be checked.", coPending: "We’re checking your company. We’ll text you when it’s verified.", coVerified: "Your company is verified.",
    coRejected: "We couldn’t verify your company: {note}", coEdit: "Company details", coSaveDraft: "Save for later", coSubmit: "Send to be checked", submitted: "Sent. We’ll text you when your company is verified.",
    coGovL: "Governorate", coRegL: "Commercial registration number", coContactL: "Your name", coWaL: "WhatsApp number for candidates", coWebL: "Website (optional)",
    postJob: "Post a job (full site)", dash: "Full dashboard", findC: "Find candidates", sentC: "Invitations sent", stageL: "Stage", expLevelL: "Experience", invitedDone: "Invitation sent.", withdrawn: "Invitation withdrawn.",
    notFound: "That page doesn’t exist.", genericErr: "Something went wrong. Please try again.", csrf: "This form expired. Please go back and try again.", required: "Please fill this in.", invalid: "Please check this.", fixBelow: "Please check the fields marked below." },
  ar: { brand: "شغّلني", lite: "لايت", jobs: "الوظائف", applied: "طلباتي", recruiters: "التوظيف", resume: "السيرة", profile: "ملفي", company: "الشركة", candidates: "المرشحون", invitesTab: "الدعوات",
    signin: "تسجيل الدخول", signout: "تسجيل الخروج", hire: "لجهات التوظيف", full: "الموقع الكامل", privacy: "الخصوصية", terms: "الشروط", back: "رجوع", liteNote: "شغّلني لايت: نسخة خفيفة للاتصالات البطيئة أو المكلفة.", countryHint: "فقط إن كنت تعيش خارج سوريا.", applyCallBtn: "قدّم بمكالمة", applyEmailBtn: "قدّم بالإيميل", callH: "اتصل لتقدّم", callP: "ضفنا هالوظيفة لطلباتك. اتصل هلّق بـ{co} وقلّن إنك لقيت الوظيفة على شغّلني.", callNow: "اتصل", emH: "قدّم بالإيميل", emP: "ضفنا هالوظيفة لطلباتك. رح ينفتح الإيميل وسيرتك مكتوبة فيه؛ ابعته لـ{co}.", emOpen: "اكتب الإيميل", emSubject: "طلب توظيف: {title}، {name}", uniHere: "أنت مسجّل بصفة مكتب توظيف جامعي. بوابة مكتب التوظيف على الموقع الكامل.", alertBtn: "تنبيهات لهذا البحث", alerted: "حُفظ التنبيه. سنخبرك بالوظائف الجديدة المشابهة.",
    search: "ابحث", searchPh: "وظيفة أو شركة أو مهارة", all: "الكل", savedChip: "المحفوظة", anywhere: "كل سوريا", go: "اعرض", noJobs: "لا توجد وظائف مطابقة. جرّب عوامل تصفية أقل.", noSaved: "لم تحفظ أي وظيفة بعد. اضغط رمز الحفظ على أي وظيفة لتجدها هنا.",
    more: "وظائف أخرى", prev: "الوظائف السابقة", today: "نُشرت اليوم", daysAgo: "نُشرت قبل {n} يوم", perMonth: "ل.س شهرياً", verified: "صاحب عمل موثّق", match: "تناسب ملفك بنسبة {n}%",
    save: "احفظ", saveJob: "احفظ هذه الوظيفة", unsaveJob: "أزلها من المحفوظة", apply: "قدّم الآن", applyWa: "قدّم عبر واتساب", applied1: "قدّمت على هذه الوظيفة.", seeApps: "اطّلع على طلباتك",
    signinToApply: "سنطلب منك تسجيل الدخول أولاً، برقم هاتف ورمز فقط.", duties: "المهام", needs: "المتطلبات", provides: "ما يقدّمونه",
    phoneL: "رقم الجوال", sendCode: "أرسل الرمز", checking: "جارٍ التحقق…", consent: "عمري 18 سنة أو أكثر، وأوافق على شروط الاستخدام وإشعار الخصوصية، بما في ذلك تخزين بياناتي ومعالجتها خارج سوريا.",
    consentNeeded: "ضع علامة في المربع للموافقة قبل أن نرسل الرمز.", codeL: "الرمز المؤلف من 6 أرقام الذي أرسلناه إلى {phone}", verify: "دخول", devCode: "وضع التجربة: رمزك هو {code}", otherNumber: "استخدم رقماً آخر",
    signinH: "سجّل الدخول أو أنشئ حساباً", signinP: "سنرسل لك رمزاً برسالة نصية. لا توجد كلمة سر.", jsNote: "يجري تسجيل الدخول فحصاً سريعاً في متصفحك. إن لم يعمل الزر، استخدم الموقع الكامل.",
    gateH: "سجّل الدخول لترى هذا", gateApplied: "سجّل الدخول لتتابع طلباتك.", gateRecruit: "سجّل الدخول لتصلك دعوات جهات التوظيف.", gateResume: "سجّل الدخول لتبني سيرتك الذاتية.", gateProfile: "سجّل الدخول لتنشئ ملفك.",
    needProfile: "أنشئ ملفك أولاً، يستغرق ذلك دقيقتين تقريباً.", createProfile: "أنشئ ملفك", hi: "{name}", strength: "اكتمل ملفك بنسبة {n}%", strengthHint: "التالي: {x}",
    strengthDone: "ملفك مكتمل.", edit: "عدّل", editProfile: "عدّل ملفك", secAbout: "عنك", secEdu: "التعليم", secExp: "الخبرة", secSkills: "المهارات واللغات", secPrefs: "ما تبحث عنه",
    missing: "ناقص", done: "مكتمل", stepOf: "الخطوة {n} من 5", saveNext: "احفظ وتابع", saveFinish: "احفظ وأنهِ", skip: "تخطَّ هذه الخطوة", savedAfter: "يُحفظ بعد كل خطوة",
    statusL: "تعليمك", uniOther: "جامعة أخرى", uniNameL: "اسم الجامعة", yearL: "السنة الدراسية", gradL: "سنة التخرج", gpaL: "المعدل (اختياري)", pick: "اختر",
    expNone: "لم تضف أي خبرة بعد. التدريب والعمل الجزئي والتطوع كلها تُحتسب.", addExp: "أضف وظيفة أو تدريباً", editExp: "عدّل هذه الوظيفة", roleL: "المسمى الوظيفي", orgL: "الشركة أو الجهة",
    placeL: "المكان (اختياري)", fromL: "من", toL: "إلى", monthPh: "YYYY-MM", currentL: "ما زلت أعمل هنا", bulletsL: "ماذا أنجزت، نقطة في كل سطر", saveExp: "احفظ هذه الوظيفة", deleteExp: "احذف",
    cancel: "إلغاء", skillsL: "المهارات، تفصل بينها فواصل", certsL: "الشهادات والدورات، واحدة في كل سطر", typesL: "أنواع العمل", levelL: "خبرتك", nextStep: "تابع",
    myApps: "طلباتك", noApps: "لم تقدّم على أي وظيفة بعد.", findJobs: "ابحث عن وظائف", recruitOn: "يمكن لجهات التوظيف العثور عليك", recruitOff: "لا يمكن لجهات التوظيف العثور عليك",
    turnOn: "اسمح لجهات التوظيف بالعثور عليّ", turnOff: "أوقف عثور جهات التوظيف عليّ", invites: "الدعوات", noInvites: "لا دعوات بعد. حدّث ملفك، فجهات التوظيف تبحث حسب الكلية والمهارات واللغات.",
    cvLangL: "لغة السيرة", trProgress: "ترجمة النسخة {lang}", trLeft: "ما زال {n} سطراً بحاجة إلى ترجمة. يمكنك إكمالها من الموقع الكامل.", trDone: "مترجمة بالكامل",
    sendWa: "أرسلها نصاً عبر واتساب", savePdf: "احفظها PDF", printHint: "لحفظها PDF، استخدم قائمة الطباعة أو المشاركة في متصفحك.", uploadCv: "ارفع سيرة ذاتية (الموقع الكامل)",
    fullProfile: "أضف الأنشطة والشهادات والترجمات من الموقع الكامل.", appliedDone: "أُرسل طلبك. يمكنك متابعته هنا.", saved: "حُفظ.", answered: "شكراً، أبلغناهم.",
    waH: "أرسل طلبك عبر واتساب", waP: "سُجّل طلبك. افتح واتساب لترسل رسالتك إلى {co}.", openWa: "افتح واتساب",
    waMsg: "مرحباً {co}، أنا {name}. أرغب بالتقديم على وظيفة {title} التي وجدتها على شغّلني.", waEdu: "التعليم: {v}", waSkills: "المهارات: {v}",
    hireH: "وظّف من مرشحين طلبوا أن تتواصل معهم", hireP: "انشر وظائفك وادعُ المرشحين للتقديم أو إلى يوم مهني.", hire1: "شركات موثّقة", hire2: "مرشحون جاهزون", hire3: "دعوات لفعاليات",
    hireMore: "نتحقق من كل شركة قبل أن تنشر أو تبحث، بما في ذلك مطابقتها مع قوائم العقوبات. المرشحون يختارون أن يظهروا، ولا ترى إلا ما يشاركونه.",
    hireStart: "أنشئ حساب جهة توظيف", step1: "رقمك", step2: "شركتك", step3: "التوثيق", seekerHere: "هذا الرقم مسجّل لباحث عن عمل. حسابات جهات التوظيف تحتاج رقماً خاصاً بها.", adminHere: "أنت مسجّل بصفة مشرف.",
    coH: "شركتك", coP: "نستخدم هذه التفاصيل للتحقق من شركتك. يرى المرشحون اسم الشركة ووصفها.", coNone: "أضف تفاصيل شركتك لنتحقق منها.",
    coDraft: "حُفظت تفاصيلك. أرسلها إلينا للتحقق.", coPending: "نتحقق من شركتك. سنرسل لك رسالة عند توثيقها.", coVerified: "شركتك موثّقة.",
    coRejected: "لم نتمكن من توثيق شركتك: {note}", coEdit: "تفاصيل الشركة", coSaveDraft: "احفظ لوقت لاحق", coSubmit: "أرسلها للتحقق", submitted: "أُرسلت. سنرسل لك رسالة عند توثيق شركتك.",
    coGovL: "المحافظة", coRegL: "رقم السجل التجاري", coContactL: "اسمك", coWaL: "رقم واتساب للمرشحين", coWebL: "الموقع الإلكتروني (اختياري)",
    postJob: "انشر وظيفة (الموقع الكامل)", dash: "لوحة التحكم الكاملة", findC: "ابحث عن مرشحين", sentC: "الدعوات المرسلة", stageL: "المرحلة", expLevelL: "الخبرة", invitedDone: "أُرسلت الدعوة.", withdrawn: "سُحبت الدعوة.",
    notFound: "هذه الصفحة غير موجودة.", genericErr: "حدث خطأ. حاول مرة أخرى.", csrf: "انتهت صلاحية هذا النموذج. ارجع وحاول مرة أخرى.", required: "املأ هذا الحقل.", invalid: "تحقق من هذا الحقل.", fixBelow: "تحقق من الحقول المشار إليها أدناه." }
};
const MONTHS = { en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  ar: ["كانون الثاني", "شباط", "آذار", "نيسان", "أيار", "حزيران", "تموز", "آب", "أيلول", "تشرين الأول", "تشرين الثاني", "كانون الأول"] };
const STATUSES = ["student", "bachelor", "master", "diploma", "secondary"];
const LEVELS = ["none", "lt1", "y1to3", "y4plus"];
const CSS_URL = `/lite/s.${LITE_CSS_V}.css`, SPRITE_URL = `/lite/i.${LITE_SPRITE_V}.svg`, PRINT_URL = `/lite/p.${LITE_PRINT_V}.js`;

export function makeLite({ db, cfg, core, auth, limit, log }, router) {
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const POW_JS = readFileSync(path.join(ROOT, "public", "js", "pow.js"), "utf8") + `
(function () {
  var f = document.getElementById("ltPhone"); if (!f) return;
  f.addEventListener("submit", function (e) {
    var n = f.querySelector("[name=pow_nonce]"), bits = Number(f.getAttribute("data-bits") || 0);
    if (!bits || n.value) return;
    e.preventDefault();
    var b = f.querySelector("button[type=submit]"); if (b) { b.disabled = true; b.textContent = b.getAttribute("data-busy") || b.textContent; }
    solvePow(f.querySelector("[name=pow_challenge]").value, bits).then(function (nonce) { n.value = String(nonce); f.submit(); });
  });
})();`;
  const tr = (lg, k, v) => { const s = (LT[lg] && LT[lg][k]) ?? core.STR[lg][k] ?? core.STR.en[k] ?? LT.en[k] ?? k; return v ? core.fill(s, v) : s; };
  const bi = (v, lg) => (v && typeof v === "object" ? v[lg] || v.en || v.ar || "" : v || "");
  const csrfOf = id => createHmac("sha256", cfg.otpPepper || "dev").update("lite-csrf:" + id).digest("hex").slice(0, 32);
  const errText = (lg, err) => {
    if (err instanceof HttpError) {
      if (err.code === "incomplete" && Array.isArray(err.detail)) return tr(lg, "err_incomplete", { x: err.detail.map(f => tr(lg, "field_" + f)).join(lg === "ar" ? "، " : ", ") });
      const k = "err_" + err.code;
      return core.STR[lg][k] || core.STR.en[k] || tr(lg, "genericErr");
    }
    log(`[lite] ${(err && err.stack) || err}`);
    return tr(lg, "genericErr");
  };
  const fmtDate = (ts, lg) => { const d = new Date(ts); return `${d.getDate()} ${MONTHS[lg][d.getMonth()]}`; };
  const fmtNum = n => Number(n || 0).toLocaleString("en-US");
  const safeNext = (n, dflt) => (typeof n === "string" && /^\/lite(\/[\w\-/]*)?(\?[\w=&%.-]*)?$/.test(n) && !n.includes("//") ? n : dflt);
  const role = ctx => (ctx.user ? ctx.user.role : "guest");
  const I = (n, cls = "i") => `<svg class="${cls}" aria-hidden="true"><use href="${SPRITE_URL}#${n}"/></svg>`;

  async function call(ctx, method, p, body) {
    const u = new URL(p, "http://lite.local"), m = router.match(method, u.pathname);
    if (!m || m.methodNotAllowed) throw new HttpError(404, "not_found");
    const c = { req: ctx.req, res: ctx.res, url: u, query: u.searchParams, params: m.params, headers: {}, ip: ctx.ip, cookies: ctx.cookies, user: ctx.user, sessionHash: ctx.sessionHash, body: body || {} };
    let out; for (const h of m.handlers) out = await h(c);
    if (c.headers["set-cookie"]) ctx.cookiesOut.push(c.headers["set-cookie"]);
    return out ?? { ok: true };
  }
  const me = async ctx => (ctx._me !== undefined ? ctx._me : (ctx._me = ctx.user && ctx.user.role === "seeker" ? await call(ctx, "GET", "/api/me") : null));

  /* ---------- page frame ---------- */
  const TABS_SEEKER = [["/lite", "briefcase", "jobs", "jobs"], ["/lite/applications", "inbox", "applied", "applied"], ["/lite/recruiters", "users", "recruiters", "recruiters"], ["/lite/resume", "file-text", "resume", "resume"], ["/lite/me", "user", "profile", "profile"]];
  const TABS_EMPLOYER = [["/lite/hire", "building", "company", "company"], ["/lite/candidates", "user-search", "candidates", "candidates"], ["/lite/candidates/sent", "send", "invitesTab", "sent"]];
  function page(ctx, title, body, o = {}) {
    const lg = ctx.lang, other = lg === "ar" ? "en" : "ar", r = role(ctx);
    const q = new URLSearchParams(ctx.url.search); q.set("lang", other);
    const tabs = o.tabs === false ? [] : r === "employer" ? TABS_EMPLOYER : r === "admin" ? [] : TABS_SEEKER;
    const nav = tabs.length ? `<nav class="tb" style="--n:${tabs.length}" aria-label="${esc(tr(lg, "brand"))}">${tabs.map(([href, ic, k, id]) => `<a href="${href}"${o.tab === id ? ' aria-current="page"' : ""}>${I(ic)}${esc(tr(lg, k))}</a>`).join("")}</nav>` : "";
    const lead = o.back ? `<a class="bk" href="${esc(o.back)}" aria-label="${esc(tr(lg, "back"))}">${I("arrow-left", "i flip")}</a><span class="bn">${esc(o.head || title)}</span>`
      : `<a class="lg" href="${r === "employer" ? "/lite/hire" : "/lite"}" aria-label="${esc(tr(lg, "brand"))}">ش</a><span class="bn">${esc(o.head || tr(lg, "brand"))}</span><span class="pill">${esc(o.pill || tr(lg, "lite"))}</span>`;
    return `<!doctype html><html lang="${lg}" dir="${lg === "ar" ? "rtl" : "ltr"}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="color-scheme" content="light dark"><title>${esc(title)} · ${esc(tr(lg, "brand"))} ${esc(tr(lg, "lite"))}</title><link rel="icon" href="/favicon.svg"><link rel="stylesheet" href="${CSS_URL}"></head><body>
<header>${lead}${o.headEnd || ""}<a class="hl${o.headEnd ? "" : " end"}" href="${esc(ctx.url.pathname + "?" + q)}" lang="${other}">${other === "ar" ? "العربية" : "English"}</a></header>
<main>${o.flash ? `<p class="fl" role="status">${esc(o.flash)}</p>` : ""}${o.error ? `<p class="fl er" role="alert">${esc(o.error)}</p>` : ""}${body}</main>
<footer><p>${esc(tr(lg, "liteNote"))} <a href="/">${esc(tr(lg, "full"))}</a> · <a href="/lite/privacy">${esc(tr(lg, "privacy"))}</a> · <a href="/lite/terms">${esc(tr(lg, "terms"))}</a>${r === "guest" ? ` · <a href="/lite/hire">${esc(tr(lg, "hire"))}</a>` : ""}</p></footer>
${nav}${o.pow ? `<script src="/lite/pow.js" defer></script>` : ""}${o.print ? `<script src="${PRINT_URL}" defer></script>` : ""}</body></html>`;
  }
  const hidden = (ctx, extra = {}) => [`<input type="hidden" name="csrf" value="${csrfOf(ctx.anon)}">`, ...Object.entries(extra).map(([k, v]) => `<input type="hidden" name="${esc(k)}" value="${esc(v)}">`)].join("");
  const opts = (list, cur, ph) => (ph != null ? `<option value="">${esc(ph)}</option>` : "") + list.map(([v, l]) => `<option value="${esc(v)}"${String(v) === String(cur ?? "") ? " selected" : ""}>${esc(l)}</option>`).join("");
  const govList = lg => core.GOV_ORDER.filter(k => k !== "remote").map(k => [k, core.GOV[k][lg]]);
  const payText = (j, lg) => (Array.isArray(j.pay) && j.pay[0] ? `${fmtNum(j.pay[0])}${j.pay[1] && j.pay[1] !== j.pay[0] ? "–" + fmtNum(j.pay[1]) : ""} ${tr(lg, "perMonth")}` : "");
  const tile = j => `<span class="tile" style="background:${esc(core.SECTOR[j.sector] || "#475569")}" aria-hidden="true">${esc(j.abbr || "")}</span>`;
  const coLine = (j, lg) => `${esc(bi(j.co, lg))} <span style="color:#0f6e56" role="img" aria-label="${esc(tr(lg, "verified"))}">${I("circle-check")}</span>${j.gov && core.GOV[j.gov] ? " · " + esc(core.GOV[j.gov][lg]) : ""}`;
  const redirect = (ctx, to) => { ctx.status = 303; ctx.location = to; return ""; };
  const gate = (ctx, msgKey, tab) => page(ctx, tr(ctx.lang, "gateH"), `<div class="cd"><h1>${esc(tr(ctx.lang, "gateH"))}</h1><p>${esc(tr(ctx.lang, msgKey))}</p>
<a class="bt" href="/lite/signin?next=${encodeURIComponent(ctx.url.pathname)}">${esc(tr(ctx.lang, "signin"))}</a></div>`, { tab });
  const needProfile = (ctx, tab) => page(ctx, tr(ctx.lang, "createProfile"), `<div class="cd"><h1>${esc(tr(ctx.lang, "createProfile"))}</h1><p>${esc(tr(ctx.lang, "needProfile"))}</p>
<a class="bt" href="/lite/profile?step=1&next=${encodeURIComponent(ctx.url.pathname)}">${esc(tr(ctx.lang, "createProfile"))}</a></div>`, { tab });
  const saveBtn = (ctx, j, on) => `<form method="post" action="/lite/job/${j.id}/save" class="i">${hidden(ctx, { back: ctx.url.pathname + ctx.url.search })}<button class="sv" type="submit" aria-pressed="${on ? "true" : "false"}" aria-label="${esc(tr(ctx.lang, on ? "unsaveJob" : "saveJob"))}">${I("bookmark")}</button></form>`;

  /* ---------- jobs ---------- */
  async function jobsPage(ctx) {
    if (ctx.user && ctx.user.role === "employer") return redirect(ctx, "/lite/hire");   // employers work with their own listings
    const lg = ctx.lang, q = String(ctx.query.get("q") || "").slice(0, 60), gov = ctx.query.get("gov") || "", type = ctx.query.get("type") || "", savedOnly = ctx.query.get("saved") === "1", ret = ctx.query.get("returnees") === "1";
    const pg = Math.max(1, Math.min(50, Number(ctx.query.get("page")) || 1)), nq = core.norm(q).trim();
    const M = await me(ctx), prof = M && M.profile, saved = new Set((M && M.saved) || []);
    const all = listPublished(db, [...saved]).filter(j => (!gov || j.gov === gov || j.gov === "remote") && (!type || j.type === type) && (!savedOnly || saved.has(j.id)) && (!ret || j.returnees)
      && (!nq || core.norm([bi(j.title, "en"), bi(j.title, "ar"), bi(j.co, "en"), bi(j.co, "ar")].join(" ")).includes(nq)));
    // Sponsored listings are lifted, and labelled, only for signed-in job seekers they fit well.
    const spon = new Set(prof && !savedOnly ? all.filter(j => j.sponsored && ((core.fitFor(prof, j) || {}).score || 0) >= 60).slice(0, 2).map(j => j.id) : []);
    const ordered = spon.size ? [...all.filter(j => spon.has(j.id)), ...all.filter(j => !spon.has(j.id))] : all;
    const per = 12, list = ordered.slice((pg - 1) * per, pg * per);
    const link = over => { const u = new URLSearchParams(ctx.url.search); u.delete("lang"); u.delete("done"); for (const [k, v] of Object.entries(over)) { if (v === "") u.delete(k); else u.set(k, v); } const s = u.toString(); return "/lite" + (s ? "?" + s : ""); };
    const chip = (label, over, on) => `<a class="ch" href="${esc(link({ page: "", ...over }))}"${on ? ' aria-current="true"' : ""}>${esc(label)}</a>`;
    const chips = [chip(tr(lg, "all"), { type: "", saved: "", returnees: "" }, !type && !savedOnly && !ret), ...Object.keys(core.TYPE).map(k => chip(core.TYPE[k][lg], { type: k, saved: "", returnees: "" }, type === k)),
      chip(tr(lg, "tabReturnees"), { returnees: "1", type: "", saved: "" }, ret),
      ...(ctx.user && ctx.user.role === "seeker" ? [chip(tr(lg, "savedChip"), { saved: "1", type: "" }, savedOnly)] : [])].join("");
    const form = `<form method="get" action="/lite"><label for="q" class="mu" style="margin:0 0 4px">${esc(tr(lg, "search"))}</label>
<div class="row" style="flex-wrap:nowrap"><input id="q" name="q" value="${esc(q)}" placeholder="${esc(tr(lg, "searchPh"))}" enterkeyhint="search"><button class="bt" type="submit" style="width:auto;margin:0;padding:9px 14px" aria-label="${esc(tr(lg, "search"))}">${I("search")}</button></div>
${type ? `<input type="hidden" name="type" value="${esc(type)}">` : ""}${savedOnly ? `<input type="hidden" name="saved" value="1">` : ""}${ret ? `<input type="hidden" name="returnees" value="1">` : ""}
<div class="row" style="margin-top:8px;flex-wrap:nowrap"><select name="gov" aria-label="${esc(tr(lg, "coGovL"))}">${opts(govList(lg), gov, tr(lg, "anywhere"))}</select><button class="b2" type="submit" style="width:auto;margin:0;padding:8px 14px">${esc(tr(lg, "go"))}</button></div></form>`;
    const items = list.map(j => {
      const fit = prof ? core.fitFor(prof, j) : null;
      return `<article class="cd fx">${tile(j)}<div class="g1">${spon.has(j.id) ? `<span class="pill" style="background:#fff3d6;color:#7a5200">${esc(tr(lg, "sponsored"))}</span> ` : ""}<a class="t" href="/lite/job/${j.id}" dir="auto">${esc(bi(j.title, lg))}</a><div class="mu">${coLine(j, lg)}</div>
${payText(j, lg) ? `<div style="font-weight:600">${esc(payText(j, lg))}</div>` : ""}${j.returnees ? `<span class="pill">${esc(tr(lg, "returneesTag"))}</span> ` : ""}${fit ? `<span class="pill">${esc(tr(lg, "match", { n: fit.score }))}</span> ` : ""}<span class="mu">${j.days ? esc(tr(lg, "daysAgo", { n: j.days })) : esc(tr(lg, "today"))}</span></div>
${ctx.user && ctx.user.role === "seeker" ? saveBtn(ctx, j, saved.has(j.id)) : ""}</article>`;
    }).join("");
    const pager = `${pg > 1 ? `<a class="b2" href="${esc(link({ page: pg - 1 }))}">${esc(tr(lg, "prev"))}</a>` : ""}${all.length > pg * per ? `<a class="b2" href="${esc(link({ page: pg + 1 }))}">${esc(tr(lg, "more"))}</a>` : ""}`;
    const alertForm = prof && !savedOnly ? `<form method="post" action="/lite/alerts">${hidden(ctx, { q, gov, type, returnees: ret ? "1" : "" })}<button class="b3" type="submit">${I("bell")} ${esc(tr(lg, "alertBtn"))}</button></form>` : "";
    return page(ctx, tr(lg, "jobs"), `${form}<div class="chips">${chips}</div>${alertForm}${items || `<p class="cd">${esc(tr(lg, savedOnly ? "noSaved" : "noJobs"))}</p>`}${pager}`, { tab: "jobs", flash: ctx.flash });
  }
  async function jobPage(ctx) {
    if (ctx.user && ctx.user.role === "employer") return redirect(ctx, "/lite/hire");
    const lg = ctx.lang, j = getPublished(db, Number(ctx.params.id));
    if (!j) { ctx.status = 404; return page(ctx, tr(lg, "notFound"), `<div class="cd"><h1>${esc(tr(lg, "notFound"))}</h1><a class="b2" href="/lite">${esc(tr(lg, "jobs"))}</a></div>`, { tab: "jobs" }); }
    const M = await me(ctx), prof = M && M.profile, fit = prof ? core.fitFor(prof, j) : null;
    const list = (key, v) => { const a = (v && (v[lg] && v[lg].length ? v[lg] : v.en && v.en.length ? v.en : v.ar)) || []; return a.length ? `<h2>${esc(tr(lg, key))}</h2><ul class="b" dir="auto">${a.map(x => `<li dir="auto">${esc(x)}</li>`).join("")}</ul>` : ""; };
    const mine = ctx.user && ctx.user.role === "seeker" ? db.get("SELECT status FROM applications WHERE job_id = ? AND user_id = ? AND status != 'withdrawn'", j.id, ctx.user.id) : null;
    const act = mine ? `<p class="fl">${esc(tr(lg, "applied1"))} <a href="/lite/applications">${esc(tr(lg, "seeApps"))}</a></p>`
      : `<div class="cd" id="apply"><form method="post" action="/lite/job/${j.id}/apply">${hidden(ctx, { channel: "web" })}<button class="bt" type="submit">${esc(tr(lg, "apply"))}</button></form>
${j.hasWhatsapp ? `<form method="post" action="/lite/job/${j.id}/apply">${hidden(ctx, { channel: "whatsapp" })}<button class="bt wa" type="submit">${I("brand-whatsapp")} ${esc(tr(lg, "applyWa"))}</button></form>` : ""}
${j.applyCall ? `<form method="post" action="/lite/job/${j.id}/apply">${hidden(ctx, { channel: "call" })}<button class="b2" type="submit">${esc(tr(lg, "applyCallBtn"))}</button></form>` : ""}
${j.applyEmail ? `<form method="post" action="/lite/job/${j.id}/apply">${hidden(ctx, { channel: "email" })}<button class="b2" type="submit">${esc(tr(lg, "applyEmailBtn"))}</button></form>` : ""}
${ctx.user ? "" : `<p class="mu">${esc(tr(lg, "signinToApply"))}</p>`}</div>`;
    const saved = new Set((M && M.saved) || []);
    return page(ctx, bi(j.title, lg), `<div class="cd"><div class="fx">${tile(j)}<div class="g1"><h1 dir="auto" style="margin:0">${esc(bi(j.title, lg))}</h1><div class="mu">${coLine(j, lg)}${bi(j.place, lg) ? " · " + esc(bi(j.place, lg)) : ""}</div></div>
${ctx.user && ctx.user.role === "seeker" ? saveBtn(ctx, j, saved.has(j.id)) : ""}</div>${payText(j, lg) ? `<p style="font-weight:700;font-size:17px;margin:10px 0 0">${esc(payText(j, lg))}</p>` : ""}
${fit ? `<p><span class="pill">${esc(tr(lg, "match", { n: fit.score }))}</span></p>` : ""}${j.returnees ? `<p><span class="pill">${esc(tr(lg, "returneesTag"))}</span></p>` : ""}${bi(j.summary, lg) ? `<p dir="auto">${esc(bi(j.summary, lg))}</p>` : ""}</div>
${act}${list("duties", j.duties)}${list("needs", j.needs)}${list("provides", j.provides)}<p class="mu">${j.days ? esc(tr(lg, "daysAgo", { n: j.days })) : esc(tr(lg, "today"))}</p>`,
      { tab: "jobs", back: "/lite", head: tr(lg, "jobs"), flash: ctx.flash, error: ctx.error });
  }
  async function savePost(ctx) {
    const back = safeNext(ctx.body.back, "/lite");
    if (!ctx.user || ctx.user.role !== "seeker") return redirect(ctx, "/lite/signin?next=" + encodeURIComponent(back));
    const id = Number(ctx.params.id), M = await me(ctx), on = ((M && M.saved) || []).includes(id);
    try { await call(ctx, on ? "DELETE" : "POST", `/api/me/saved/${id}`); } catch (err) { ctx.error = errText(ctx.lang, err); }
    return redirect(ctx, back);
  }
  async function applyPost(ctx) {
    const lg = ctx.lang, id = Number(ctx.params.id), back = `/lite/job/${id}`;
    if (!ctx.user) return redirect(ctx, "/lite/signin?next=" + encodeURIComponent(back));
    if (ctx.user.role !== "seeker") { ctx.error = errText(lg, new HttpError(403, "forbidden")); return jobPage(ctx); }
    const M = await me(ctx), prof = M && M.profile;
    if (!prof) return redirect(ctx, "/lite/profile?step=1&next=" + encodeURIComponent(back));
    try {
      const channel = ["whatsapp", "call", "email"].includes(ctx.body.channel) ? ctx.body.channel : "web";
      const r = await call(ctx, "POST", `/api/jobs/${id}/apply`, { channel, cvLang: lg });
      if (channel === "call" && r.phone) return page(ctx, tr(lg, "callH"), `<div class="cd"><h1>${esc(tr(lg, "callH"))}</h1><p>${esc(tr(lg, "callP", { co: bi(getPublished(db, id).co, lg) }))}</p><a class="bt" href="tel:${esc(r.phone)}">${esc(tr(lg, "callNow"))} <span dir="ltr">${esc(r.phone)}</span></a>
<a class="b2" href="/lite/applications">${esc(tr(lg, "seeApps"))}</a></div>`, { tab: "applied" });
      if (channel === "email" && r.email) { const jj = getPublished(db, id), R0 = core.buildResume(prof, String(id), lg);
        const mail = `mailto:${r.email}?subject=${encodeURIComponent(tr(lg, "emSubject", { title: bi(jj.title, lg), name: R0.name }))}&body=${encodeURIComponent(core.plainResume(R0).slice(0, 1800))}`;
        return page(ctx, tr(lg, "emH"), `<div class="cd"><h1>${esc(tr(lg, "emH"))}</h1><p>${esc(tr(lg, "emP", { co: bi(jj.co, lg) }))}</p><a class="bt" href="${esc(mail)}">${esc(tr(lg, "emOpen"))}</a>
<a class="b2" href="/lite/applications">${esc(tr(lg, "seeApps"))}</a></div>`, { tab: "applied" }); }
      if (channel !== "whatsapp" || !r.whatsapp) return redirect(ctx, "/lite/applications?done=applied");
      const j = getPublished(db, id), R = core.buildResume(prof, String(id), lg);
      const edu = [prof.edu && prof.edu.uni && core.UNI[prof.edu.uni] ? core.UNI[prof.edu.uni][lg] : prof.edu && prof.edu.uniName, prof.edu && prof.edu.fac && core.FAC[prof.edu.fac] ? core.FAC[prof.edu.fac][lg] : ""].filter(Boolean).join(lg === "ar" ? "، " : ", ");
      const msg = [tr(lg, "waMsg", { co: bi(j.co, lg), name: R.name, title: bi(j.title, lg) }), edu ? tr(lg, "waEdu", { v: edu }) : "", prof.skills && prof.skills.length ? tr(lg, "waSkills", { v: prof.skills.slice(0, 8).join(", ") }) : ""].filter(Boolean).join("\n");
      const wa = `https://wa.me/${String(r.whatsapp).replace(/\D/g, "")}?text=${encodeURIComponent(msg)}`;
      return page(ctx, tr(lg, "waH"), `<div class="cd"><h1>${esc(tr(lg, "waH"))}</h1><p>${esc(tr(lg, "waP", { co: bi(j.co, lg) }))}</p><a class="bt wa" href="${esc(wa)}" rel="noopener">${I("brand-whatsapp")} ${esc(tr(lg, "openWa"))}</a>
<a class="b2" href="/lite/applications">${esc(tr(lg, "seeApps"))}</a></div>`, { tab: "applied" });
    } catch (err) { ctx.error = errText(lg, err); return jobPage(ctx); }
  }

  /* ---------- job seekers' own pages ---------- */
  async function appsPage(ctx) {
    const lg = ctx.lang; if (!ctx.user) return gate(ctx, "gateApplied", "applied");
    if (ctx.user.role !== "seeker") return redirect(ctx, "/lite");
    const M = await me(ctx); if (!M.profile) return needProfile(ctx, "applied");
    const apps = (await call(ctx, "GET", "/api/me/applications")).applications;
    const body = apps.length ? apps.map(a => `<div class="cd"><a class="t" href="/lite/job/${a.jobId}" dir="auto">${esc(bi(a.title, lg))}</a><div class="mu" dir="auto">${esc(bi(a.co, lg))}</div>
<p><span class="st">${esc(tr(lg, "st_" + a.status))}</span> <span class="mu">${esc(fmtDate(a.updatedAt, lg))}</span></p></div>`).join("")
      : `<div class="cd"><p>${esc(tr(lg, "noApps"))}</p><a class="bt" href="/lite">${esc(tr(lg, "findJobs"))}</a></div>`;
    return page(ctx, tr(lg, "myApps"), `<h1>${esc(tr(lg, "myApps"))}</h1>${body}`, { tab: "applied", flash: ctx.flash });
  }
  async function recruitersPage(ctx) {
    const lg = ctx.lang; if (!ctx.user) return gate(ctx, "gateRecruit", "recruiters");
    if (ctx.user.role !== "seeker") return redirect(ctx, "/lite");
    const M = await me(ctx), p = M.profile; if (!p) return needProfile(ctx, "recruiters");
    const inv = (await call(ctx, "GET", "/api/me/invitations")).invitations, on = !!(p.recruit && p.recruit.open);
    const btn = (id, answer, label, cls) => `<form method="post" action="/lite/invite/${id}" style="flex:1">${hidden(ctx, { answer })}<button class="${cls}" type="submit" style="margin:0">${esc(label)}</button></form>`;
    const cards = inv.length ? inv.map(i => {
      const open = i.status === "new" || i.status === "seen", job = i.kind === "job", ev = i.event || {};
      const what = job ? (i.job ? bi(i.job.title, lg) : "") : [ev.title, ev.date, ev.place].filter(Boolean).join(" · ");
      return `<div class="cd"><p class="mu">${esc(tr(lg, job ? "rcKindJob" : "rcKindEvent"))}${i.status === "new" ? ` <span class="pill">${esc(tr(lg, "rcNew"))}</span>` : ""}</p><div class="t" dir="auto">${esc(what)}</div>
<div class="mu">${esc(bi(i.company.name, lg))}${i.company.verified ? ` <span style="color:#0f6e56">${I("circle-check")}</span>` : ""}</div>${i.message ? `<p dir="auto">“${esc(i.message)}”</p>` : ""}${ev.link ? `<p><a href="${esc(ev.link)}" rel="noopener nofollow ugc">${esc(ev.link)}</a></p>` : ""}
${open ? `<div class="row" style="margin-top:8px">${job && i.job && i.job.open ? btn(i.id, "yes", tr(lg, "rcApply"), "bt") : job ? "" : btn(i.id, "yes", tr(lg, "rcYes"), "bt")}${btn(i.id, "no", tr(lg, job ? "rcNo" : "rcNoEvent"), "b2")}</div>`
       : `<p><span class="st">${esc(tr(lg, i.status === "accepted" ? (job ? "rcSaidYesJob" : "rcSaidYesEvent") : "rcSaidNo"))}</span></p>`}</div>`;
    }).join("") : `<p class="cd">${esc(tr(lg, "noInvites"))}</p>`;
    const sw = `<div class="cd"><div class="fx"><span style="color:#0f6e56">${I(on ? "circle-check" : "users")}</span><div class="g1"><div class="t">${esc(tr(lg, on ? "recruitOn" : "recruitOff"))}</div><p class="mu">${esc(tr(lg, "rcOpenP"))}</p></div></div>
<form method="post" action="/lite/recruit">${hidden(ctx, { open: on ? "0" : "1" })}<button class="${on ? "b2" : "bt"}" type="submit">${esc(tr(lg, on ? "turnOff" : "turnOn"))}</button></form></div>`;
    return page(ctx, tr(lg, "recruiters"), `<h1>${esc(tr(lg, "rcTitle"))}</h1>${sw}<h2>${esc(tr(lg, "invites"))}</h2>${cards}`, { tab: "recruiters", flash: ctx.flash, error: ctx.error });
  }
  async function invitePost(ctx) {
    if (!ctx.user) return redirect(ctx, "/lite/signin?next=%2Flite%2Frecruiters");
    const id = Number(ctx.params.id);
    try {
      await call(ctx, "POST", `/api/me/invitations/${id}/respond`, { answer: ctx.body.answer === "yes" ? "yes" : "no" });
      const inv = (await call(ctx, "GET", "/api/me/invitations")).invitations.find(x => x.id === id);
      if (ctx.body.answer === "yes" && inv && inv.kind === "job" && inv.job) return redirect(ctx, `/lite/job/${inv.job.id}#apply`);
      return redirect(ctx, "/lite/recruiters?done=answered");
    } catch (err) { ctx.error = errText(ctx.lang, err); return recruitersPage(ctx); }
  }
  async function recruitPost(ctx) {
    if (!ctx.user) return redirect(ctx, "/lite/signin?next=%2Flite%2Frecruiters");
    try { await call(ctx, "PUT", "/api/me/recruit", { open: ctx.body.open === "1" }); return redirect(ctx, "/lite/recruiters?done=saved"); }
    catch (err) { ctx.error = errText(ctx.lang, err); return recruitersPage(ctx); }
  }
  async function resumePage(ctx) {
    const lg = ctx.lang; if (!ctx.user) return gate(ctx, "gateResume", "resume");
    if (ctx.user.role !== "seeker") return redirect(ctx, "/lite");
    const M = await me(ctx), p = M.profile; if (!p) return needProfile(ctx, "resume");
    const cv = ctx.query.get("cv") === "en" || ctx.query.get("cv") === "ar" ? ctx.query.get("cv") : lg, R = core.buildResume(p, "general", cv), h = k => esc(tr(cv, k));
    const sec = [];
    for (const key of R.order) {
      if (key === "edu") { const e = R.edu; sec.push(`<h2>${h("cvHEdu")}</h2><p style="font-weight:600">${esc([e.inst, e.city].filter(Boolean).join(", "))}</p><p class="m">${esc([e.degree, e.date].filter(Boolean).join(" · "))}${e.gpa ? " · " + esc(e.gpa) : ""}</p>`); }
      else if (key === "exp" || key === "acts") {
        sec.push(`<h2>${h(key === "exp" ? "cvHExp" : "cvHActs")}</h2>` + (key === "exp" ? R.exp : R.acts).map(r => `<p style="font-weight:600">${esc(r.e.role)} · ${esc(r.e.org)}</p><p class="m">${esc(core.fmtRange(r.e, cv))}${r.e.place ? " · " + esc(r.e.place) : ""}</p>${r.shown.length ? `<ul class="b">${r.shown.map(b => `<li>${esc(b.t)}</li>`).join("")}</ul>` : ""}`).join(""));
      } else sec.push(`<h2>${h("cvHSkills")}</h2>${R.skills.length ? `<p>${h("cvSkillsL")}: ${esc(R.skills.join(", "))}</p>` : ""}${R.langs.length ? `<p>${h("cvLangsL")}: ${esc(R.langs.join(", "))}</p>` : ""}${R.certs.length ? `<p>${esc(R.certs.join(" · "))}</p>` : ""}`);
    }
    const paper = `<article class="paper" lang="${cv}" dir="${cv === "ar" ? "rtl" : "ltr"}"><h1>${esc(R.name)}</h1><p class="ct" dir="auto">${esc(R.contact.join(" · "))}</p>${sec.join("")}</article>`;
    const total = core.trSources(p).length, left = R.trMissing.length, other = cv === "ar" ? tr(lg, "langAr") : tr(lg, "langEn");
    const progress = left > 0 && total > 0 ? `<div class="cd np"><div class="row" style="justify-content:space-between"><span>${esc(tr(lg, "trProgress", { lang: cv === "ar" ? "العربية" : "English" }))}</span><span class="mu">${total - left} / ${total}</span></div>
<div class="bar"><i style="width:${Math.round((total - left) / total * 100)}%"></i></div><p class="mu">${esc(tr(lg, "trLeft", { n: left }))}</p></div>` : "";
    const wa = "https://wa.me/?text=" + encodeURIComponent(core.plainResume(R).slice(0, 1800));
    const langChip = l => `<a class="ch" href="/lite/resume?cv=${l}"${cv === l ? ' aria-current="true"' : ""} lang="${l}">${l === "ar" ? "العربية" : "English"}</a>`;
    return page(ctx, tr(lg, "resume"), `<div class="row np" style="justify-content:space-between;margin-bottom:8px"><span class="mu">${esc(tr(lg, "cvLangL"))}</span><span class="chips" style="margin:0">${langChip("en")}${langChip("ar")}</span></div>
${paper}<div class="np" style="margin-top:10px">${progress}<a class="bt wa" href="${esc(wa)}" rel="noopener">${I("brand-whatsapp")} ${esc(tr(lg, "sendWa"))}</a>
<div class="g2"><button class="b2" type="button" data-print hidden>${I("printer")} ${esc(tr(lg, "savePdf"))}</button><a class="b2" href="/#/resume">${I("upload")} ${esc(tr(lg, "uploadCv"))}</a></div>
<noscript><p class="mu">${esc(tr(lg, "printHint"))}</p></noscript><a class="b2" href="/lite/me">${I("edit")} ${esc(tr(lg, "editProfile"))}</a></div>`, { tab: "resume", print: true });
  }

  /* ---------- the profile, in five short steps ---------- */
  const blank = () => ({ v: 1, role: "seeker", name: "", nameAr: "", nameEn: "", email: "", gov: "", relocate: false, langs: ["ar"], edu: { status: "", uni: "", uniName: "", fac: "", year: 0, grad: 0, gpa: "", course: "", honors: "" },
    prefs: { types: [], fields: [], level: "" }, exp: [], acts: [], skills: [], certs: [], tailor: {}, tr: { en: [], ar: [] } });
  const secDone = p => { const e = p.edu || {}; return { about: !!(p.name && p.gov), edu: !!(e.status && (e.uni || e.status === "secondary")), exp: (p.exp || []).length + (p.acts || []).length > 0, skills: (p.skills || []).length >= 3 && (p.langs || []).length > 0, prefs: !!((p.prefs && p.prefs.types || []).length || (p.prefs && p.prefs.level)) }; };
  const SECS = [["about", "secAbout"], ["edu", "secEdu"], ["exp", "secExp"], ["skills", "secSkills"], ["prefs", "secPrefs"]];
  async function mePage(ctx) {
    const lg = ctx.lang; if (!ctx.user) return gate(ctx, "gateProfile", "profile");
    if (ctx.user.role === "employer") return redirect(ctx, "/lite/hire");
    if (ctx.user.role !== "seeker") return page(ctx, tr(lg, "profile"), `<div class="cd"><p>${esc(tr(lg, ctx.user.role === "university" ? "uniHere" : "adminHere"))}</p><a class="bt" href="/">${esc(tr(lg, "full"))}</a></div>`, { tabs: false });
    const M = await me(ctx), p = M.profile;
    const out = `<form method="post" action="/lite/signout">${hidden(ctx)}<button class="b2" type="submit">${I("logout")} ${esc(tr(lg, "signout"))}</button></form>`;
    if (!p) return page(ctx, tr(lg, "profile"), `<div class="cd"><h1>${esc(tr(lg, "createProfile"))}</h1><p>${esc(tr(lg, "needProfile"))}</p><a class="bt" href="/lite/profile?step=1">${esc(tr(lg, "createProfile"))}</a></div>${out}`, { tab: "profile", flash: ctx.flash });
    const d = secDone(p), n = Math.round(Object.values(d).filter(Boolean).length / 5 * 100), next = SECS.find(([k]) => !d[k]);
    const rows = SECS.map(([k, key], i) => `<a class="cd fx" href="/lite/profile?step=${i + 1}" style="text-decoration:none;color:inherit;align-items:center"><span style="color:${d[k] ? "#0f6e56" : "var(--mu)"}">${I(d[k] ? "circle-check" : "plus")}</span><span class="g1"><span class="t">${esc(tr(lg, key))}</span><span class="mu" style="display:block">${esc(tr(lg, d[k] ? "done" : "missing"))}</span></span><span class="mu">${I("edit")}</span></a>`).join("");
    return page(ctx, tr(lg, "profile"), `<div class="cd"><div class="fx" style="align-items:center"><span class="tile" style="background:#0f6e56">${esc(core.initialsOf(p.name) || "")}</span><div class="g1"><h1 style="margin:0" dir="auto">${esc(p.name)}</h1><div class="mu">${esc(ctx.user.phone || "")}</div></div></div>
<div class="bar"><i style="width:${n}%"></i></div><div class="t" style="font-size:14px">${esc(tr(lg, "strength", { n }))}</div><div class="mu">${esc(next ? tr(lg, "strengthHint", { x: tr(lg, next[1]) }) : tr(lg, "strengthDone"))}</div></div>
${rows}${await alertsBlock(ctx)}<p class="mu">${esc(tr(lg, "fullProfile"))} <a href="/#/profile">${esc(tr(lg, "full"))}</a></p>${out}`, { tab: "profile", flash: ctx.flash, error: ctx.error });
  }
  function stepForm(ctx, p, step, errors = {}) {
    const lg = ctx.lang, e = p.edu || {}, next = safeNext(ctx.query.get("next") || ctx.body.next, "");
    const bad = k => (errors[k] ? ` aria-invalid="true" aria-describedby="e-${k}"` : ""), msg = k => (errors[k] ? `<p class="er" id="e-${k}">${esc(tr(lg, errors[k] === "invalid" ? "invalid" : "required"))}</p>` : "");
    const head = `<div class="bar" style="margin:-12px -14px 12px;border-radius:0"><i style="width:${step * 20}%"></i></div><p class="mu" style="margin:0">${esc(tr(lg, "stepOf", { n: step }))}</p><h1>${esc(tr(lg, SECS[step - 1][1]))}</h1>`;
    const foot = (label = step === 5 ? "saveFinish" : "saveNext") => `<button class="bt" type="submit">${esc(tr(lg, label))}</button>${step < 5 ? `<a class="b3" href="/lite/profile?step=${step + 1}${next ? "&next=" + encodeURIComponent(next) : ""}">${esc(tr(lg, "skip"))}</a>` : ""}<p class="mu" style="text-align:center">${I("cloud-check")} ${esc(tr(lg, "savedAfter"))}</p>`;
    let body = "";
    if (step === 1) body = `<form method="post" action="/lite/profile">${hidden(ctx, { step: 1, ...(next ? { next } : {}) })}
<label for="n">${esc(tr(lg, "obName"))} <span class="req">*</span></label><input id="n" name="name" value="${esc(p.name || "")}" autocomplete="name" required${bad("name")}>${msg("name")}
<label for="g">${esc(tr(lg, "obGov"))} <span class="req">*</span></label><select id="g" name="gov" required${bad("gov")}>${opts(govList(lg), p.gov, tr(lg, "pick"))}<option value="abroad"${p.gov === "abroad" ? " selected" : ""}>${esc(tr(lg, "outsideSyria"))}</option></select>${msg("gov")}
<label for="co">${esc(tr(lg, "obCountry"))}</label><select id="co" name="country">${opts(Object.keys(core.COUNTRY).map(k => [k, core.COUNTRY[k][lg]]), p.country, "—")}</select><p class="mu">${esc(tr(lg, "countryHint"))}</p>
<label for="em">${esc(tr(lg, "obEmail"))}</label><input id="em" name="email" type="email" dir="ltr" value="${esc(p.email || "")}" autocomplete="email"${bad("email")}>${msg("email")}${foot()}</form>`;
    else if (step === 2) {
      const uniOpts = [...Object.keys(core.UNI).map(k => [k, core.UNI[k][lg]]), ["other", tr(lg, "uniOther")]], years = Array.from({ length: 16 }, (_, i) => new Date().getFullYear() + 6 - i).map(y => [y, String(y)]);
      body = `<form method="post" action="/lite/profile">${hidden(ctx, { step: 2, ...(next ? { next } : {}) })}
<label for="st">${esc(tr(lg, "statusL"))}</label><select id="st" name="status">${opts(STATUSES.map(s => [s, tr(lg, "edu_" + s)]), e.status, tr(lg, "pick"))}</select>
<label for="u">${esc(tr(lg, "obUni"))}</label><select id="u" name="uni"${bad("edu")}>${opts(uniOpts, e.uni, tr(lg, "pick"))}</select>
<label for="un">${esc(tr(lg, "uniNameL"))}</label><input id="un" name="uniName" value="${esc(e.uniName || "")}">
<label for="f">${esc(tr(lg, "obFac"))}</label><select id="f" name="fac"${bad("edu")}>${opts(Object.keys(core.FAC).map(k => [k, core.FAC[k][lg]]), e.fac, tr(lg, "pick"))}</select>${msg("edu")}
<div class="g2"><div><label for="y">${esc(tr(lg, "yearL"))}</label><select id="y" name="year">${opts([1, 2, 3, 4, 5, 6, 7].map(n => [n, String(n)]), e.year || "", "—")}</select></div>
<div><label for="gr">${esc(tr(lg, "gradL"))}</label><select id="gr" name="grad">${opts(years, e.grad || "", "—")}</select></div></div>
<label for="gp">${esc(tr(lg, "gpaL"))}</label><input id="gp" name="gpa" value="${esc(e.gpa || "")}" dir="ltr">${foot()}</form>`;
    } else if (step === 3) {
      const exp = p.exp || [], ei = ctx.query.get("edit"), editing = ei != null && exp[Number(ei)] ? Number(ei) : null, x = editing != null ? exp[editing] : {};
      const cards = exp.map((r, i) => `<div class="cd"><div class="fx"><div class="g1"><div class="t" dir="auto">${esc(r.role)}</div><div class="mu" dir="auto">${esc(r.org)}${r.start ? " · " + esc(core.fmtRange(r, lg)) : ""}</div>
${(r.bullets || []).slice(0, 2).map(b => `<div class="mu" dir="auto">· ${esc(b)}</div>`).join("")}</div><a class="b3" href="/lite/profile?step=3&edit=${i}" aria-label="${esc(tr(lg, "editExp"))}">${I("edit")}</a></div></div>`).join("");
      body = `${cards || `<p class="cd">${esc(tr(lg, "expNone"))}</p>`}<form method="post" action="/lite/profile/exp" class="cd" id="add">${hidden(ctx, { i: editing ?? "" })}
<div class="t">${I(editing != null ? "edit" : "plus")} ${esc(tr(lg, editing != null ? "editExp" : "addExp"))}</div>
<label for="r">${esc(tr(lg, "roleL"))} <span class="req">*</span></label><input id="r" name="role" value="${esc(x.role || "")}"${bad("role")}>${msg("role")}
<label for="o">${esc(tr(lg, "orgL"))} <span class="req">*</span></label><input id="o" name="org" value="${esc(x.org || "")}"${bad("org")}>${msg("org")}
<label for="pl">${esc(tr(lg, "placeL"))}</label><input id="pl" name="place" value="${esc(x.place || "")}">
<div class="g2"><div><label for="s">${esc(tr(lg, "fromL"))}</label><input id="s" name="start" type="month" placeholder="${esc(tr(lg, "monthPh"))}" value="${esc(x.start || "")}" dir="ltr"></div>
<div><label for="en">${esc(tr(lg, "toL"))}</label><input id="en" name="end" type="month" placeholder="${esc(tr(lg, "monthPh"))}" value="${esc(x.end || "")}" dir="ltr"></div></div>
<label class="ckl"><input type="checkbox" name="current" value="1"${x.current ? " checked" : ""}> ${esc(tr(lg, "currentL"))}</label>
<label for="bl">${esc(tr(lg, "bulletsL"))}</label><textarea id="bl" name="bullets" rows="3" dir="auto">${esc((x.bullets || []).join("\n"))}</textarea>
<button class="b2" type="submit">${esc(tr(lg, "saveExp"))}</button></form>
${editing != null ? `<form method="post" action="/lite/profile/exp/delete">${hidden(ctx, { i: editing })}<button class="b3" type="submit" style="color:var(--er)">${I("trash")} ${esc(tr(lg, "deleteExp"))}</button> <a class="b3" href="/lite/profile?step=3">${esc(tr(lg, "cancel"))}</a></form>` : ""}
<a class="bt" href="/lite/profile?step=4${next ? "&next=" + encodeURIComponent(next) : ""}">${esc(tr(lg, "nextStep"))}</a>`;
    } else if (step === 4) {
      const langs = Object.keys(core.LANGS).map(k => `<label class="ck"><input type="checkbox" name="langs" value="${k}"${(p.langs || []).includes(k) ? " checked" : ""}>${esc(core.LANGS[k][lg])}</label>`).join("");
      body = `<form method="post" action="/lite/profile">${hidden(ctx, { step: 4, ...(next ? { next } : {}) })}
<label for="sk">${esc(tr(lg, "skillsL"))}</label><input id="sk" name="skills" value="${esc((p.skills || []).join(", "))}" dir="auto">
<fieldset style="border:0;padding:0;margin:12px 0 0"><legend class="mu" style="margin-bottom:6px">${esc(tr(lg, "obLangs"))} <span class="req">*</span></legend>${langs}</fieldset>${msg("langs")}
<label for="ce">${esc(tr(lg, "certsL"))}</label><textarea id="ce" name="certs" rows="3" dir="auto">${esc((p.certs || []).join("\n"))}</textarea>${foot()}</form>`;
    } else {
      const pr = p.prefs || {}, types = Object.keys(core.TYPE).map(k => `<label class="ck"><input type="checkbox" name="types" value="${k}"${(pr.types || []).includes(k) ? " checked" : ""}>${esc(core.TYPE[k][lg])}</label>`).join("");
      const lv = LEVELS.map(k => `<label class="ck"><input type="radio" name="level" value="${k}"${pr.level === k ? " checked" : ""}>${esc(tr(lg, "lvl_" + k))}</label>`).join("");
      body = `<form method="post" action="/lite/profile">${hidden(ctx, { step: 5, ...(next ? { next } : {}) })}
<fieldset style="border:0;padding:0;margin:0"><legend class="mu" style="margin-bottom:6px">${esc(tr(lg, "typesL"))}</legend>${types}</fieldset>
<fieldset style="border:0;padding:0;margin:12px 0 0"><legend class="mu" style="margin-bottom:6px">${esc(tr(lg, "levelL"))}</legend>${lv}</fieldset>${foot()}</form>`;
    }
    return page(ctx, tr(lg, SECS[step - 1][1]), head + body, { back: "/lite/me", head: tr(lg, "profile"), tab: "profile", error: Object.keys(errors).length ? tr(lg, "fixBelow") : ctx.error, flash: ctx.flash });
  }
  async function alertsBlock(ctx) {
    const lg = ctx.lang, list = (await call(ctx, "GET", "/api/me/alerts")).alerts;
    const link = a => { const u = new URLSearchParams(); if (a.q) u.set("q", a.q); if (a.gov) u.set("gov", a.gov); if (a.type) u.set("type", a.type); if (a.tab === "returnees") u.set("returnees", "1"); if (a.tab === "intern") u.set("type", "intern"); const s = u.toString(); return "/lite" + (s ? "?" + s : ""); };
    return `<h2>${I("bell")} ${esc(tr(lg, "alertsTitle"))}</h2>` + (list.length ? list.map(a => `<div class="cd"><div class="t" dir="auto">${esc(core.alertLabel(a, lg))}</div><div class="mu">${esc(tr(lg, "alHow_" + a.channel))}${a.newCount ? ` · <span class="pill">${esc(tr(lg, "alNew", { n: a.newCount }))}</span>` : ""}</div>
<div class="row" style="margin-top:6px"><a class="b3" href="${esc(link(a))}">${esc(tr(lg, "alSee"))}</a><form method="post" action="/lite/alerts/${a.id}/delete" class="i">${hidden(ctx)}<button class="b3" type="submit" style="color:var(--er)">${esc(tr(lg, "alDelete"))}</button></form></div></div>`).join("")
      : `<p class="mu">${esc(tr(lg, "alNone"))} ${esc(tr(lg, "alTip"))}</p>`);
  }
  async function alertPost(ctx) {
    if (!ctx.user || ctx.user.role !== "seeker") return redirect(ctx, "/lite/signin?next=%2Flite");
    const b = ctx.body, M = await me(ctx), prof = M && M.profile, back = new URLSearchParams();
    for (const k of ["q", "gov", "type"]) if (b[k]) back.set(k, b[k]); if (b.returnees === "1") back.set("returnees", "1");
    const crit = { q: b.q || "", gov: b.gov || "", type: b.type || "", tab: b.returnees === "1" ? "returnees" : "" };
    try { await call(ctx, "POST", "/api/me/alerts", { alert: crit, channel: prof && prof.email ? "email" : "sms" }); back.set("done", "alerted"); }
    catch (err) { ctx.error = errText(ctx.lang, err); return jobsPage(ctx); }
    return redirect(ctx, "/lite?" + back.toString());
  }
  async function alertDelete(ctx) {
    if (!ctx.user || ctx.user.role !== "seeker") return redirect(ctx, "/lite/signin?next=%2Flite%2Fme");
    try { await call(ctx, "DELETE", `/api/me/alerts/${Number(ctx.params.id)}`); } catch (err) { /* already gone */ }
    return redirect(ctx, "/lite/me");
  }
  const stepOf = ctx => Math.max(1, Math.min(5, Number(ctx.query.get("step") || ctx.body.step) || 1));
  async function profilePage(ctx) {
    if (!ctx.user) return gate(ctx, "gateProfile", "profile");
    if (ctx.user.role !== "seeker") return redirect(ctx, "/lite/me");
    const M = await me(ctx);
    return stepForm(ctx, M.profile || blank(), stepOf(ctx));
  }
  async function saveProfile(ctx, p) { await call(ctx, "PUT", "/api/me/profile", { profile: p }); ctx._me = undefined; }
  async function profilePost(ctx) {
    if (!ctx.user) return redirect(ctx, "/lite/signin?next=%2Flite%2Fprofile");
    if (ctx.user.role !== "seeker") return redirect(ctx, "/lite/me");
    const b = ctx.body, step = stepOf(ctx), cur = (await me(ctx)).profile || blank(), p = { ...cur, edu: { ...(cur.edu || {}) }, prefs: { ...(cur.prefs || {}) } };
    if (step === 1) Object.assign(p, { name: String(b.name || "").trim(), gov: b.gov || "", country: b.gov === "abroad" ? b.country || "other" : "", email: String(b.email || "").trim() });
    if (step === 2) { const st = STATUSES.includes(b.status) ? b.status : ""; Object.assign(p.edu, { status: st, uni: b.uni || "", uniName: b.uni === "other" ? String(b.uniName || "").trim() : "", fac: b.fac || "", year: Number(b.year) || 0, grad: Number(b.grad) || 0, gpa: String(b.gpa || "").trim() }); p.role = st === "student" ? "student" : "seeker"; }
    if (step === 4) Object.assign(p, { skills: String(b.skills || "").split(/[,،]/).map(s => s.trim()).filter(Boolean), langs: [].concat(b.langs || []), certs: String(b.certs || "").split(/\r?\n/).map(s => s.trim()).filter(Boolean) });
    if (step === 5) Object.assign(p.prefs, { types: [].concat(b.types || []), level: LEVELS.includes(b.level) ? b.level : "" });
    try { await saveProfile(ctx, p); }
    catch (err) { if (err instanceof HttpError && err.detail && typeof err.detail === "object") return stepForm(ctx, p, step, err.detail); ctx.error = errText(ctx.lang, err); return stepForm(ctx, p, step); }
    const next = safeNext(b.next, "");
    if (step >= 5) return redirect(ctx, next || "/lite/me?done=saved");
    return redirect(ctx, `/lite/profile?step=${step + 1}${next ? "&next=" + encodeURIComponent(next) : ""}`);
  }
  async function expPost(ctx) {
    if (!ctx.user || ctx.user.role !== "seeker") return redirect(ctx, "/lite/signin?next=%2Flite%2Fprofile%3Fstep%3D3");
    const b = ctx.body, cur = (await me(ctx)).profile;
    if (!cur) return redirect(ctx, "/lite/profile?step=1");
    const role0 = String(b.role || "").trim(), org0 = String(b.org || "").trim(), errs = {};
    if (!role0) errs.role = "required"; if (!org0) errs.org = "required";
    const exp = [...(cur.exp || [])], i = b.i === "" || b.i == null ? null : Number(b.i);
    const entry = { ...(i != null && exp[i] ? exp[i] : {}), role: role0, org: org0, place: String(b.place || "").trim(), start: String(b.start || "").slice(0, 7), end: b.current === "1" ? "" : String(b.end || "").slice(0, 7), current: b.current === "1",
      bullets: String(b.bullets || "").split(/\r?\n/).map(s => s.replace(/^[\s•\-–*]+/, "").trim()).filter(Boolean).slice(0, 12) };
    if (Object.keys(errs).length) { ctx.query.set("step", "3"); if (i != null) ctx.query.set("edit", String(i)); return stepForm(ctx, { ...cur, exp: i != null ? exp.map((x, k) => (k === i ? entry : x)) : exp }, 3, errs); }
    if (i != null && exp[i]) exp[i] = entry; else exp.push(entry);
    try { await saveProfile(ctx, { ...cur, exp }); } catch (err) { ctx.error = errText(ctx.lang, err); ctx.query.set("step", "3"); return stepForm(ctx, cur, 3); }
    return redirect(ctx, "/lite/profile?step=3&done=saved");
  }
  async function expDelete(ctx) {
    if (!ctx.user || ctx.user.role !== "seeker") return redirect(ctx, "/lite/signin");
    const cur = (await me(ctx)).profile, i = Number(ctx.body.i);
    if (cur && cur.exp && cur.exp[i]) { try { await saveProfile(ctx, { ...cur, exp: cur.exp.filter((_, k) => k !== i) }); } catch (err) { ctx.error = errText(ctx.lang, err); } }
    return redirect(ctx, "/lite/profile?step=3");
  }

  /* ---------- signing in ---------- */
  function phoneForm(ctx, { roleWanted = "seeker", next = "", error = "", phone = "" } = {}) {
    const lg = ctx.lang, ch = auth.challenge(ctx, { count: false });   // a page view is not a sign-in attempt (D-24); sending the code is still limited
    return `<form method="post" action="/lite/signin" id="ltPhone" data-bits="${ch.bits}" class="cd">${hidden(ctx, { role: roleWanted, next, pow_challenge: ch.challenge, pow_nonce: "" })}
${error ? `<p class="er" role="alert">${esc(error)}</p>` : ""}<label for="ph">${esc(tr(lg, "phoneL"))}</label><input id="ph" name="phone" type="tel" inputmode="tel" autocomplete="tel" dir="ltr" required value="${esc(phone)}" placeholder="09xx xxx xxx">
<label class="ckl" style="margin-top:10px"><input type="checkbox" name="consent" value="1" required><span>${esc(tr(lg, "consent"))} <a href="/lite/terms">${esc(tr(lg, "terms"))}</a> · <a href="/lite/privacy">${esc(tr(lg, "privacy"))}</a></span></label>
<button class="bt" type="submit" data-busy="${esc(tr(lg, "checking"))}">${esc(tr(lg, "sendCode"))}</button>${ch.bits ? `<p class="mu">${esc(tr(lg, "jsNote"))}</p>` : ""}</form>`;
  }
  async function signinPage(ctx) {
    const lg = ctx.lang, roleWanted = ctx.query.get("role") === "employer" ? "employer" : "seeker", next = safeNext(ctx.query.get("next"), "");
    if (ctx.user) return redirect(ctx, next || (ctx.user.role === "employer" ? "/lite/hire" : "/lite/me"));
    const demo = cfg.demoLiteHint ? `<p class="fl">${esc(cfg.demoLiteHint(lg))}</p>` : "";
    return page(ctx, tr(lg, "signin"), `<h1>${esc(tr(lg, roleWanted === "employer" ? "hireStart" : "signinH"))}</h1><p class="mu">${esc(tr(lg, "signinP"))}</p>${demo}${phoneForm(ctx, { roleWanted, next })}`, { pow: true, tab: "profile" });
  }
  async function signinPost(ctx) {
    const lg = ctx.lang, b = ctx.body, roleWanted = b.role === "employer" ? "employer" : "seeker", next = safeNext(b.next, "");
    const again = error => page(ctx, tr(lg, "signin"), `<h1>${esc(tr(lg, roleWanted === "employer" ? "hireStart" : "signinH"))}</h1>${phoneForm(ctx, { roleWanted, next, error, phone: b.phone || "" })}`, { pow: true, tab: "profile" });
    if (b.consent !== "1") return again(tr(lg, "consentNeeded"));
    let r;
    try { r = await call(ctx, "POST", "/api/auth/code", { phone: b.phone, pow: { challenge: b.pow_challenge, nonce: b.pow_nonce } }); }
    catch (err) { return again(errText(lg, err)); }
    const phone = r.phone || b.phone;
    return page(ctx, tr(lg, "signin"), `<h1>${esc(tr(lg, "signin"))}</h1>${r.devCode ? `<p class="fl">${esc(tr(lg, "devCode", { code: r.devCode }))}</p>` : ""}
<form method="post" action="/lite/signin/code" class="cd">${hidden(ctx, { phone, role: roleWanted, next })}<label for="code">${esc(tr(lg, "codeL", { phone }))}</label>
<input id="code" name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" dir="ltr" required autofocus style="font-size:22px;letter-spacing:6px;text-align:center">
<button class="bt" type="submit">${esc(tr(lg, "verify"))}</button></form><a class="b3" href="/lite/signin?role=${roleWanted}${next ? "&next=" + encodeURIComponent(next) : ""}">${esc(tr(lg, "otherNumber"))}</a>`, { tab: "profile" });
  }
  async function codePost(ctx) {
    const lg = ctx.lang, b = ctx.body, roleWanted = b.role === "employer" ? "employer" : "seeker", next = safeNext(b.next, "");
    let r;
    try { r = await call(ctx, "POST", "/api/auth/verify", { phone: b.phone, code: String(b.code || "").trim(), role: roleWanted, accept: true }); }
    catch (err) {
      return page(ctx, tr(lg, "signin"), `<h1>${esc(tr(lg, "signin"))}</h1><form method="post" action="/lite/signin/code" class="cd">${hidden(ctx, { phone: b.phone || "", role: roleWanted, next })}
<p class="er" role="alert">${esc(errText(lg, err))}</p><label for="code">${esc(tr(lg, "codeL", { phone: b.phone || "" }))}</label><input id="code" name="code" inputmode="numeric" maxlength="6" dir="ltr" required autofocus style="font-size:22px;letter-spacing:6px;text-align:center">
<button class="bt" type="submit">${esc(tr(lg, "verify"))}</button></form><a class="b3" href="/lite/signin?role=${roleWanted}">${esc(tr(lg, "otherNumber"))}</a>`, { tab: "profile" });
    }
    const u = r.user || {};
    return redirect(ctx, next || (u.role === "employer" ? "/lite/hire" : "/lite/me"));
  }
  async function signoutPost(ctx) { if (ctx.user) await call(ctx, "POST", "/api/auth/logout"); return redirect(ctx, "/lite/signin"); }

  /* ---------- recruiters ---------- */
  async function hirePage(ctx) {
    const lg = ctx.lang, r = role(ctx);
    if (r === "guest") {
      const t = (ic, k) => `<div class="cd" style="margin:0;padding:8px 4px"><span style="color:#0f6e56">${I(ic)}</span><div style="font-size:12px">${esc(tr(lg, k))}</div></div>`;
      return page(ctx, tr(lg, "hire"), `<h1>${esc(tr(lg, "hireH"))}</h1><p class="mu">${esc(tr(lg, "hireP"))}</p><div class="g3" style="margin:12px 0">${t("shield-check", "hire1")}${t("user-search", "hire2")}${t("calendar-event", "hire3")}</div>
<h2>${esc(tr(lg, "hireStart"))}</h2>${phoneForm(ctx, { roleWanted: "employer", next: "/lite/hire/company" })}<div class="row mu" style="justify-content:space-between"><span>1 ${esc(tr(lg, "step1"))}</span><span>2 ${esc(tr(lg, "step2"))}</span><span>3 ${esc(tr(lg, "step3"))}</span></div>
<p class="mu">${esc(tr(lg, "hireMore"))}</p>`, { pow: true, tabs: false, pill: tr(lg, "hire") });
    }
    const out = `<form method="post" action="/lite/signout">${hidden(ctx)}<button class="b2" type="submit">${I("logout")} ${esc(tr(lg, "signout"))}</button></form>`;
    if (r !== "employer") return page(ctx, tr(lg, "hire"), `<div class="cd"><h1>${esc(tr(lg, "hireH"))}</h1><p class="fl">${esc(tr(lg, r === "admin" ? "adminHere" : "seekerHere"))}</p>${out}</div>`, { tabs: false, pill: tr(lg, "hire") });
    const emp = await call(ctx, "GET", "/api/employer"), c = emp.company, st = !c ? "none" : c.status;
    const msg = st === "none" ? tr(lg, "coNone") : st === "draft" ? tr(lg, "coDraft") : st === "pending" ? tr(lg, "coPending") : st === "verified" ? tr(lg, "coVerified") : st === "rejected" ? tr(lg, "coRejected", { note: c.reviewNote || "—" }) : tr(lg, "coPending");
    const P = emp.plan, planLine = P && st === "verified" ? `<p class="mu">${esc(tr(lg, "plYour"))}: <b>${esc(tr(lg, "pl_" + P.plan))}</b> · ${esc(tr(lg, "plInvMonth"))}: ${P.limits.invites == null ? esc(tr(lg, "plUnlimited")) : esc(tr(lg, "plOf", { a: P.usage.invites, b: P.limits.invites }))} · <a href="/#/company/plan">${esc(tr(lg, "plSee"))}</a></p>` : "";
    const acts = st === "verified" ? `${planLine}<a class="bt" href="/lite/candidates">${I("user-search")} ${esc(tr(lg, "findC"))}</a><a class="b2" href="/lite/candidates/sent">${esc(tr(lg, "sentC"))}</a><div class="g2"><a class="b2" href="/#/company/jobs/new">${esc(tr(lg, "postJob"))}</a><a class="b2" href="/#/company">${esc(tr(lg, "dash"))}</a></div>`
      : `<a class="bt" href="/lite/hire/company">${esc(tr(lg, "coEdit"))}</a>`;
    return page(ctx, tr(lg, "company"), `<div class="cd"><div class="fx" style="align-items:center"><span class="tile" style="background:#0f6e56">${esc(c && c.abbr || "")}</span><div class="g1"><h1 style="margin:0" dir="auto">${esc(c ? bi(c.name, lg) || tr(lg, "coH") : tr(lg, "coH"))}</h1>
<span class="st">${esc(st === "verified" ? tr(lg, "verified") : msg.split(".")[0])}</span></div></div><p>${esc(msg)}</p>${acts}</div>${st === "verified" ? `<a class="b3" href="/lite/hire/company">${esc(tr(lg, "coEdit"))}</a>` : ""}${out}`, { tab: "company", flash: ctx.flash });
  }
  function companyForm(ctx, c, error) {
    const lg = ctx.lang, nm = c.name || {}, ab = c.about || {};
    const f = (id, label, val, attrs = "", req = false) => `<label for="${id}">${esc(label)}${req ? ' <span class="req">*</span>' : ""}</label><input id="${id}" name="${id}" value="${esc(val || "")}"${attrs}>`;
    return page(ctx, tr(lg, "coH"), `<h1>${esc(tr(lg, "coH"))}</h1><p class="mu">${esc(tr(lg, "coP"))}</p><form method="post" action="/lite/hire/company" class="cd">${hidden(ctx)}
<div lang="ar" dir="rtl">${f("nameAr", core.STR.ar.coNameAr, nm.ar)}</div><div lang="en" dir="ltr">${f("nameEn", core.STR.en.coNameEn, nm.en)}</div>
<label for="sector">${esc(tr(lg, "coSector"))}</label><select id="sector" name="sector">${opts(Object.keys(core.SECTOR).map(k => [k, tr(lg, "sec_" + k)]), c.sector || "trade")}</select>
<label for="cat">${esc(tr(lg, "coCat"))}</label><select id="cat" name="cat">${opts(Object.keys(core.CAT).map(k => [k, bi(core.CAT[k], lg)]), c.cat || "domestic")}</select>
<label for="gov">${esc(tr(lg, "coGovL"))} <span class="req">*</span></label><select id="gov" name="gov">${opts(govList(lg), c.gov, tr(lg, "pick"))}</select>
${f("regNo", tr(lg, "coRegL"), c.regNo, ' dir="ltr"', true)}${f("contactName", tr(lg, "coContactL"), c.contactName, ' autocomplete="name"', true)}${f("whatsapp", tr(lg, "coWaL"), c.whatsapp || (ctx.user && ctx.user.phone) || "", ' type="tel" dir="ltr"', true)}
${f("website", tr(lg, "coWebL"), c.website, ' type="url" dir="ltr"')}
<div lang="ar" dir="rtl"><label for="aboutAr">${esc(core.STR.ar.coAboutAr)}</label><textarea id="aboutAr" name="aboutAr" rows="3">${esc(ab.ar || "")}</textarea></div>
<div lang="en" dir="ltr"><label for="aboutEn">${esc(core.STR.en.coAboutEn)}</label><textarea id="aboutEn" name="aboutEn" rows="3">${esc(ab.en || "")}</textarea></div>
<button class="bt" type="submit" name="submit" value="1">${esc(tr(lg, "coSubmit"))}</button><button class="b2" type="submit" name="submit" value="0">${esc(tr(lg, "coSaveDraft"))}</button></form>`, { error, back: "/lite/hire", head: tr(lg, "company"), tab: "company" });
  }
  const employerGate = async (ctx, needVerified) => {
    if (!ctx.user) return { out: redirect(ctx, "/lite/signin?role=employer&next=" + encodeURIComponent(ctx.url.pathname + ctx.url.search)) };
    if (ctx.user.role !== "employer") return { out: redirect(ctx, "/lite/hire") };
    const emp = await call(ctx, "GET", "/api/employer");
    if (needVerified && (!emp.company || emp.company.status !== "verified")) return { out: redirect(ctx, "/lite/hire") };
    return { emp };
  };
  async function companyPage(ctx) { const g = await employerGate(ctx, false); if (g.out != null) return g.out; return companyForm(ctx, g.emp.company || {}); }
  async function companyPost(ctx) {
    const lg = ctx.lang, g = await employerGate(ctx, false); if (g.out != null) return g.out;
    const b = ctx.body, company = { name: { ar: b.nameAr || "", en: b.nameEn || "" }, sector: b.sector, cat: b.cat, gov: b.gov, regNo: b.regNo, contactName: b.contactName, whatsapp: b.whatsapp, website: b.website, about: { ar: b.aboutAr || "", en: b.aboutEn || "" } };
    try {
      await call(ctx, "PUT", "/api/employer/company", { company });
      if (b.submit === "1") { await call(ctx, "POST", "/api/employer/company/submit"); return redirect(ctx, "/lite/hire?done=submitted"); }
      return redirect(ctx, "/lite/hire?done=saved");
    } catch (err) { return companyForm(ctx, { ...(g.emp.company || {}), ...company }, errText(lg, err)); }
  }
  const eduLine = (s, lg) => [s.status ? tr(lg, "edu_" + s.status) : "", s.uni === "other" ? s.uniName : s.uni && core.UNI[s.uni] ? core.UNI[s.uni][lg] : "", s.fac && core.FAC[s.fac] ? core.FAC[s.fac][lg] : "",
    s.status === "student" && s.year ? tr(lg, "rcYearN", { n: s.year }) : s.grad ? String(s.grad) : ""].filter(Boolean).join(" · ");
  async function candidatesPage(ctx) {
    const lg = ctx.lang, g = await employerGate(ctx, true); if (g.out != null) return g.out;
    const f = k => String(ctx.query.get(k) || "").slice(0, 60), qs = new URLSearchParams();
    for (const k of ["stage", "fac", "gov", "level", "q"]) if (f(k)) qs.set(k, f(k));
    const list = (await call(ctx, "GET", "/api/employer/students?" + qs)).students;
    const form = `<form method="get" action="/lite/candidates" class="cd"><div class="g2">
<select name="stage" aria-label="${esc(tr(lg, "stageL"))}">${opts([["student", tr(lg, "rcStageStudent")], ["grad", tr(lg, "rcStageGrad")]], f("stage"), tr(lg, "rcStageAll"))}</select>
<select name="level" aria-label="${esc(tr(lg, "expLevelL"))}">${opts(LEVELS.map(k => [k, tr(lg, "lvl_" + k)]), f("level"), tr(lg, "rcAnyLevel"))}</select>
<select name="fac" aria-label="${esc(tr(lg, "rcFacL"))}">${opts(Object.keys(core.FAC).map(k => [k, core.FAC[k][lg]]), f("fac"), tr(lg, "rcAnyFac"))}</select>
<select name="gov" aria-label="${esc(tr(lg, "rcGovL"))}">${opts([...govList(lg), ["abroad", tr(lg, "outsideSyria")]], f("gov"), tr(lg, "rcAnyGov"))}</select></div>
<label for="q">${esc(tr(lg, "rcQL"))}</label><input id="q" name="q" value="${esc(f("q"))}" placeholder="${esc(tr(lg, "rcQPh"))}"><button class="bt" type="submit">${I("search")} ${esc(tr(lg, "rcSearch"))}</button></form>`;
    const cards = list.map(s => `<div class="cd"><div class="fx"><span class="tile" style="background:#0f6e56">${esc(core.initialsOf(bi(s.name, lg)) || "")}</span><div class="g1"><div class="t" dir="auto">${esc(bi(s.name, lg))}</div><div class="mu">${esc(eduLine(s, lg))}</div>
<div class="mu">${esc([s.gov ? core.placeOf(s)[lg] : "", s.level ? tr(lg, "expLevelL") + ": " + tr(lg, "lvl_" + s.level) : "", (s.langs || []).map(k => core.LANGS[k] ? core.LANGS[k][lg] : k).join(", ")].filter(Boolean).join(" · "))}</div>
${s.roles.length ? `<div dir="auto" style="font-size:14px">${esc(s.roles.join(" · "))}</div>` : ""}${s.skills.length ? `<div class="chips" style="margin:6px 0 0">${s.skills.slice(0, 6).map(x => `<span class="ch" dir="auto">${esc(x)}</span>`).join("")}</div>` : ""}</div></div>
<a class="bt" href="/lite/candidates/${s.id}/invite">${I("send")} ${esc(tr(lg, "rcInvite"))}</a>${s.invites.length ? `<p class="mu">${esc(tr(lg, "rcInvitedN", { n: s.invites.length }))}</p>` : ""}</div>`).join("");
    return page(ctx, tr(lg, "findC"), `<h1>${esc(tr(lg, "findC"))}</h1><p class="mu">${esc(tr(lg, "rcFindSub"))}</p>${form}<p class="mu">${esc(tr(lg, "rcResults", { n: list.length }))}</p>${cards || `<p class="cd">${esc(tr(lg, "rcNoResultsP"))}</p>`}`, { tab: "candidates", flash: ctx.flash });
  }
  function inviteForm(ctx, g, s, vals = {}, error = "", errs = {}) {
    const lg = ctx.lang, jobs = (g.emp.jobs || []).filter(j => j.status === "published"), kind = vals.kind || (jobs.length ? "job" : "event");
    const em = k => (errs[k] ? `<p class="er">${esc(tr(lg, "rcErr_" + k))}</p>` : ""), today = new Date().toISOString().slice(0, 10);
    return page(ctx, tr(lg, "rcInvTitle"), `<h1>${esc(tr(lg, "rcInvTitle"))}</h1><div class="cd"><div class="t" dir="auto">${esc(bi(s.name, lg))}</div><div class="mu">${esc(eduLine(s, lg))}</div></div>
<form method="post" action="/lite/candidates/${s.id}/invite" class="cd">${hidden(ctx)}<fieldset style="border:0;padding:0;margin:0"><legend class="mu" style="margin-bottom:6px">${esc(tr(lg, "rcKindL"))}</legend>
<label class="ck"><input type="radio" name="kind" value="job"${kind === "job" ? " checked" : ""}${jobs.length ? "" : " disabled"}>${esc(tr(lg, "rcKJob"))}</label><label class="ck"><input type="radio" name="kind" value="event"${kind === "event" ? " checked" : ""}>${esc(tr(lg, "rcKEvent"))}</label></fieldset>
${jobs.length ? `<label for="jb">${esc(tr(lg, "rcJobL"))}</label><select id="jb" name="jobId">${opts(jobs.map(j => [j.id, bi(j.title, lg)]), vals.jobId)}</select>` : `<p class="mu">${esc(tr(lg, "rcNoJobs"))}</p>`}
<label for="et">${esc(tr(lg, "rcEvTitleL"))}</label><input id="et" name="title" maxlength="120" value="${esc(vals.title || "")}" placeholder="${esc(tr(lg, "rcEvTitlePh"))}">${em("title")}
<div class="g2"><div><label for="ed">${esc(tr(lg, "rcEvDateL"))}</label><input id="ed" name="date" type="date" min="${today}" value="${esc(vals.date || "")}">${em("date")}</div><div><label for="ep">${esc(tr(lg, "rcEvPlaceL"))}</label><input id="ep" name="place" maxlength="160" value="${esc(vals.place || "")}">${em("place")}</div></div>
<label for="el">${esc(tr(lg, "rcEvLinkL"))}</label><input id="el" name="link" type="url" dir="ltr" maxlength="300" value="${esc(vals.link || "")}" placeholder="https://">${em("link")}
<label for="msg">${esc(tr(lg, "rcMsgL"))}</label><textarea id="msg" name="message" rows="3" maxlength="600" dir="auto">${esc(vals.message || "")}</textarea><p class="mu">${esc(tr(lg, "rcMsgHint"))}</p>
<button class="bt" type="submit">${I("send")} ${esc(tr(lg, "rcSend"))}</button></form>`, { error, back: "/lite/candidates", head: tr(lg, "candidates"), tab: "candidates" });
  }
  async function findCandidate(ctx, id) { return id > 0 && (await call(ctx, "GET", `/api/employer/students?id=${id}`)).students.find(x => x.id === id) || null; }   // by id, not the first 60 (U-016)
  async function invitePage(ctx) {
    const lg = ctx.lang, g = await employerGate(ctx, true); if (g.out != null) return g.out;
    const s = await findCandidate(ctx, Number(ctx.params.id));
    if (!s) { ctx.status = 404; return page(ctx, tr(lg, "notFound"), `<div class="cd"><h1>${esc(tr(lg, "notFound"))}</h1><a class="b2" href="/lite/candidates">${esc(tr(lg, "findC"))}</a></div>`, { tab: "candidates" }); }
    return inviteForm(ctx, g, s);
  }
  async function inviteSend(ctx) {
    const lg = ctx.lang, g = await employerGate(ctx, true); if (g.out != null) return g.out;
    const id = Number(ctx.params.id), s = await findCandidate(ctx, id), b = ctx.body;
    if (!s) return redirect(ctx, "/lite/candidates");
    const body = b.kind === "job" ? { kind: "job", jobId: Number(b.jobId), message: b.message || "" } : { kind: "event", event: { title: b.title || "", date: b.date || "", place: b.place || "", link: b.link || "" }, message: b.message || "" };
    try { await call(ctx, "POST", `/api/employer/students/${id}/invite`, body); return redirect(ctx, "/lite/candidates/sent?done=invited"); }
    catch (err) { return inviteForm(ctx, g, s, b, err.code === "invalid_event" ? tr(lg, "fixBelow") : errText(lg, err), err.code === "invalid_event" && err.detail ? err.detail : {}); }
  }
  async function sentPage(ctx) {
    const lg = ctx.lang, g = await employerGate(ctx, true); if (g.out != null) return g.out;
    const list = (await call(ctx, "GET", "/api/employer/invitations")).invitations;
    const cards = list.map(i => {
      const st = i.status === "accepted" ? (i.kind === "job" ? "accepted_job" : "accepted_event") : i.status, ev = i.event || {};
      const what = i.kind === "job" ? (i.job ? bi(i.job.title, lg) : "") : [ev.title, ev.date].filter(Boolean).join(" · ");
      return `<div class="cd"><div class="t" dir="auto">${esc(bi(i.student.name, lg))}</div><div class="mu" dir="auto">${esc(what)}</div>${i.student.phone ? `<p>${esc(tr(lg, "rcPhone"))}: <a href="tel:${esc(i.student.phone)}" dir="ltr">${esc(i.student.phone)}</a></p>` : ""}
<p><span class="st">${esc(tr(lg, "rcSt_" + st))}</span> <span class="mu">${esc(fmtDate(i.createdAt, lg))}</span></p>${i.status === "sent" || i.status === "seen" ? `<form method="post" action="/lite/invitations/${i.id}/withdraw">${hidden(ctx)}<button class="b2" type="submit">${esc(tr(lg, "rcWithdraw"))}</button></form>` : ""}</div>`;
    }).join("");
    return page(ctx, tr(lg, "sentC"), `<h1>${esc(tr(lg, "sentC"))}</h1>${cards || `<div class="cd"><p>${esc(tr(lg, "rcSentEmptyH"))}</p><a class="bt" href="/lite/candidates">${esc(tr(lg, "findC"))}</a></div>`}`, { tab: "sent", flash: ctx.flash, error: ctx.error });
  }
  async function withdrawPost(ctx) {
    const lg = ctx.lang, g = await employerGate(ctx, true); if (g.out != null) return g.out;
    try { await call(ctx, "POST", `/api/employer/invitations/${Number(ctx.params.id)}/withdraw`); return redirect(ctx, "/lite/candidates/sent?done=withdrawn"); }
    catch (err) { ctx.error = errText(lg, err); return sentPage(ctx); }
  }

  /* ---------- routing ---------- */
  const ROUTES = [
    ["GET", /^\/lite\/?$/, jobsPage], ["GET", /^\/lite\/job\/(\d+)$/, jobPage, ["id"]], ["POST", /^\/lite\/job\/(\d+)\/apply$/, applyPost, ["id"]], ["POST", /^\/lite\/job\/(\d+)\/save$/, savePost, ["id"]],
    ["GET", /^\/lite\/applications$/, appsPage], ["GET", /^\/lite\/recruiters$/, recruitersPage], ["GET", /^\/lite\/resume$/, resumePage],
    ["GET", /^\/lite\/me$/, mePage], ["GET", /^\/lite\/profile$/, profilePage], ["POST", /^\/lite\/profile$/, profilePost], ["POST", /^\/lite\/profile\/exp$/, expPost], ["POST", /^\/lite\/profile\/exp\/delete$/, expDelete],
    ["POST", /^\/lite\/alerts$/, alertPost], ["POST", /^\/lite\/alerts\/(\d+)\/delete$/, alertDelete, ["id"]],
    ["POST", /^\/lite\/invite\/(\d+)$/, invitePost, ["id"]], ["POST", /^\/lite\/recruit$/, recruitPost],
    ["GET", /^\/lite\/privacy$/, ctx => legalPage(ctx, "privacy")], ["GET", /^\/lite\/terms$/, ctx => legalPage(ctx, "terms")],
    ["GET", /^\/lite\/signin$/, signinPage], ["POST", /^\/lite\/signin$/, signinPost], ["POST", /^\/lite\/signin\/code$/, codePost], ["POST", /^\/lite\/signout$/, signoutPost],
    ["GET", /^\/lite\/hire$/, hirePage], ["GET", /^\/lite\/hire\/company$/, companyPage], ["POST", /^\/lite\/hire\/company$/, companyPost],
    ["GET", /^\/lite\/candidates$/, candidatesPage], ["GET", /^\/lite\/candidates\/sent$/, sentPage], ["GET", /^\/lite\/candidates\/(\d+)\/invite$/, invitePage, ["id"]],
    ["POST", /^\/lite\/candidates\/(\d+)\/invite$/, inviteSend, ["id"]], ["POST", /^\/lite\/invitations\/(\d+)\/withdraw$/, withdrawPost, ["id"]]
  ];
  const DONE = { alerted: "alerted", applied: "appliedDone", saved: "saved", answered: "answered", submitted: "submitted", invited: "invitedDone", withdrawn: "withdrawn" };
  /* The privacy notice and the terms: the same LEGAL texts the full app shows, rendered without JavaScript (D-12). Long-form, so outside the per-page budget. */
  function legalPage(ctx, key) {
    const lg = ctx.lang, D = (core.LEGAL[lg] || core.LEGAL.en)[key], [y, m, d] = String(TERMS_VERSION).split("-").map(Number);
    const vars = { name: cfg.legalName || tr(lg, "legalNameDefault"), contact: cfg.contactEmail || tr(lg, "legalNoContact"), days: cfg.sessionDays || 30 }, f = s => esc(core.fill(s, vars));
    const other = key === "terms" ? ["privacy", "privacyTitle"] : ["terms", "termsTitle"];
    const body = `<article class="cd"><h1>${esc(D.title)}</h1><p class="mu">${esc(tr(lg, "legalUpdated", { date: `${d} ${core.MONTHS[lg][m - 1]} ${y}` }))}</p><p>${f(D.intro)}</p>${D.sections.map(s => `<h2>${esc(s.h)}</h2>${(s.p || []).map(x => `<p>${f(x)}</p>`).join("")}${s.ul ? `<ul>${s.ul.map(x => `<li>${f(x)}</li>`).join("")}</ul>` : ""}${(s.after || []).map(x => `<p>${f(x)}</p>`).join("")}`).join("")}<p><a class="b2" href="/lite/${other[0]}">${esc(tr(lg, other[1]))}</a></p></article>`;
    return page(ctx, D.title, body, { back: "/lite", head: D.title, tabs: false });
  }
  const readForm = req => new Promise((resolve, reject) => {
    let size = 0; const parts = [];
    // Past the limit: stop buffering and answer 413 (the page needs the socket alive; the answer closes it and ends the upload, as server/http.js readJson does)
    req.on("data", c => { if (size > 64 * 1024) return; size += c.length; if (size > 64 * 1024) { parts.length = 0; reject(new HttpError(413, "too_large")); } else parts.push(c); });
    req.on("end", () => { if (size > 64 * 1024) return; const q = new URLSearchParams(Buffer.concat(parts).toString("utf8")), o = {}; for (const k of new Set(q.keys())) { const all = q.getAll(k); o[k] = all.length > 1 ? all : all[0]; } resolve(o); });
    req.on("error", reject);
  });
  const FOREVER = "public, max-age=31536000, immutable";

  return async function lite(req, res, url) {
    const pth = url.pathname;
    if (pth === "/lite/pow.js") return send(req, res, 200, POW_JS, { "content-type": "application/javascript; charset=utf-8", "cache-control": "public, max-age=86400" });
    if (pth === CSS_URL) return send(req, res, 200, LITE_CSS, { "content-type": "text/css; charset=utf-8", "cache-control": FOREVER });
    if (pth === SPRITE_URL) return send(req, res, 200, LITE_SPRITE, { "content-type": "image/svg+xml; charset=utf-8", "cache-control": FOREVER });
    if (pth === PRINT_URL) return send(req, res, 200, LITE_PRINT_JS, { "content-type": "application/javascript; charset=utf-8", "cache-control": FOREVER });
    const ctx = { req, res, url, query: url.searchParams, params: {}, headers: {}, ip: clientIp(req, cfg.trustProxy), cookies: parseCookies(req.headers.cookie), user: null, body: {}, cookiesOut: [], status: 200 };
    const secure = cfg.prod ? "; Secure" : "";
    ctx.anon = /^[0-9a-f]{32}$/.test(ctx.cookies.lt || "") ? ctx.cookies.lt : null;
    if (!ctx.anon) { ctx.anon = randomBytes(16).toString("hex"); ctx.cookiesOut.push(`lt=${ctx.anon}; Path=/lite; HttpOnly; SameSite=Lax; Max-Age=31536000${secure}`); }
    const qlang = url.searchParams.get("lang");
    if (qlang === "ar" || qlang === "en") ctx.cookiesOut.push(`ll=${qlang}; Path=/lite; SameSite=Lax; Max-Age=31536000${secure}`);
    ctx.lang = qlang === "ar" || qlang === "en" ? qlang : ctx.cookies.ll === "en" || ctx.cookies.ll === "ar" ? ctx.cookies.ll : /^en/i.test(String(req.headers["accept-language"] || "")) ? "en" : "ar";
    const done = url.searchParams.get("done"); if (DONE[done]) ctx.flash = tr(ctx.lang, DONE[done]);
    let html;
    try {
      if (!limit(`a:${ctx.ip}`, cfg.apiRateLimit, 60e3)) throw new HttpError(429, "rate_limited");
      const route = ROUTES.find(([m, re]) => m === req.method && re.test(pth)) || (req.method === "HEAD" ? ROUTES.find(([m, re]) => m === "GET" && re.test(pth)) : null);
      if (!route) { ctx.status = 404; html = page(ctx, tr(ctx.lang, "notFound"), `<div class="cd"><h1>${esc(tr(ctx.lang, "notFound"))}</h1><a class="b2" href="/lite">${esc(tr(ctx.lang, "jobs"))}</a></div>`); }
      else {
        const m = route[1].exec(pth); (route[3] || []).forEach((k, i) => { ctx.params[k] = m[i + 1]; });
        if (req.method === "POST") {
          if (!limit(`w:${ctx.ip}`, cfg.writeRateLimit, 60e3)) throw new HttpError(429, "rate_limited");
          const origin = req.headers.origin;
          if ((origin && cfg.baseUrl && origin !== cfg.baseUrl) || req.headers["sec-fetch-site"] === "cross-site") throw new HttpError(403, "csrf");
          ctx.body = await readForm(req);
          const want = Buffer.from(csrfOf(ctx.anon)), got = Buffer.from(String(ctx.body.csrf || ""));
          if (!ctx.cookies.lt || got.length !== want.length || !timingSafeEqual(got, want)) throw new HttpError(403, "csrf");
        }
        auth.attach(ctx);
        html = await route[2](ctx);
      }
    } catch (err) {
      ctx.status = err instanceof HttpError ? err.status : 500;
      html = page(ctx, tr(ctx.lang, "genericErr"), `<div class="cd"><h1>${esc(err instanceof HttpError && err.code === "csrf" ? tr(ctx.lang, "csrf") : errText(ctx.lang, err))}</h1><a class="b2" href="/lite">${esc(tr(ctx.lang, "jobs"))}</a></div>`);
    }
    const headers = { "content-type": "text/html; charset=utf-8" };
    if (ctx.status === 413) headers.connection = "close";
    if (ctx.cookiesOut.length) headers["set-cookie"] = ctx.cookiesOut.flat();
    if (ctx.location) { headers.location = ctx.location; return send(req, res, ctx.status === 200 ? 303 : ctx.status, "", headers); }
    return send(req, res, ctx.status, html, headers);
  };
}
