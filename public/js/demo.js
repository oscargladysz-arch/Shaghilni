/* DEMO ACCOUNTS: the "Explore the demo" card on the home screen, the account chooser, and the banner while you're
   inside. Remove with: npm run demo-accounts:uninstall. The rest of the app only checks whether these functions exist. */
Object.assign(STR.en, { dmCta: "Explore the demo", dmCtaP: "Try Shaghilni as a student, a job seeker, a company or a university career office, with sample activity.",
  dmChooseH: "Explore the demo", dmChooseP: "Pick an account. Everything inside is sample data with fictional people and companies, so tap anything.", dmClose: "Close",
  dmT_student: "Omar, a university student", dmD_student: "Applications at different stages, invitations from recruiters, event tickets and a verified-student badge.",
  dmT_seeker: "Rania, looking for work", dmD_seeker: "An interview, a rejection, a job invitation to answer, an event ticket and job alerts.",
  dmT_company: "Yasmin Trading, a company", dmD_company: "Listings with applicants at every stage, invitations sent, events, analytics and a university partner.",
  dmT_university: "Homs University career office", dmD_university: "Students to verify, employer partners, internship programmes, and events with sign-ups and a report.",
  dmAs: "Demo · {name}", dmSwitchL: "Switch demo account", dmLeaveL: "Leave the demo", dmS_student: "Omar", dmS_seeker: "Rania", dmS_company: "Yasmin Trading", dmS_university: "Homs University", dmSwitch: "Switch", dmLeave: "Leave", dmGo: "Go in" });
Object.assign(STR.ar, { dmCta: "استكشف النسخة التجريبية", dmCtaP: "جرّب شغّلني كطالب أو كباحث عن عمل أو كشركة أو كمكتب توظيف جامعي، مع نشاط تجريبي.",
  dmChooseH: "استكشف النسخة التجريبية", dmChooseP: "اختر حساباً. كل ما في داخله بيانات تجريبية بأشخاص وشركات وهمية، فاضغط على أي شيء.", dmClose: "إغلاق",
  dmT_student: "عمر، طالب جامعي", dmD_student: "طلبات في مراحل مختلفة، ودعوات من جهات توظيف، وتذاكر فعاليات، وشارة طالب موثّق.",
  dmT_seeker: "رانيا، تبحث عن عمل", dmD_seeker: "مقابلة، ورفض، ودعوة لوظيفة بانتظار ردها، وتذكرة فعالية، وتنبيهات وظائف.",
  dmT_company: "شركة الياسمين للتجارة", dmD_company: "إعلانات بمتقدمين في كل المراحل، ودعوات مرسلة، وفعاليات، وتحليلات، وشريك جامعي.",
  dmT_university: "مكتب التوظيف في جامعة حمص", dmD_university: "طلاب بانتظار التوثيق، وشركاء من أصحاب العمل، وبرامج تدريب، وفعاليات بتسجيلات وتقرير.",
  dmAs: "تجريبي · {name}", dmSwitchL: "بدّل الحساب التجريبي", dmLeaveL: "اخرج من النسخة التجريبية", dmS_student: "عمر", dmS_seeker: "رانيا", dmS_company: "الياسمين للتجارة", dmS_university: "جامعة حمص", dmSwitch: "بدّل", dmLeave: "اخرج", dmGo: "ادخل" });
function dmIcon(who) { return { student: "cap", seeker: "brief", company: "building", university: "cap" }[who] || "user"; }
function dmList() { return S.cfg && Array.isArray(S.cfg.demo) ? S.cfg.demo : []; }
function dmMe() { return S.user ? dmList().find(d => d.phone === S.user.phone) || null : null; }
function demoWelcomeHTML() {
  if (!dmList().length) return "";
  // On the welcome screen the accounts open in place: choosing one needs no interruption.
  return html`<button class="dm-cta" type="button" data-act="demo-open" aria-expanded="false" aria-controls="dmInline">${icon("sparkle", 20)}<span><b>${t("dmCta")}</b><small>${t("dmCtaP")}</small></span>${icon("chev", 18)}</button>
<div class="dm-inline" id="dmInline" hidden><p class="dm-p">${t("dmChooseP")}</p>${dmListHTML()}</div>`;
}
function demoOpen() {
  demoClose();
  const box = document.createElement("div"); box.className = "dm-scrim"; box.id = "dmBox";
  put(box, html`<div class="dm-sheet" role="dialog" aria-modal="true" aria-labelledby="dmH"><div class="dm-top"><h2 id="dmH">${t("dmChooseH")}</h2><button class="ibtn" type="button" data-act="demo-close" aria-label="${t("dmClose")}">${icon("x", 18)}</button></div>
<p class="dm-p">${t("dmChooseP")}</p>${dmListHTML()}</div>`);
  box.addEventListener("click", e => { if (e.target === box) return demoClose(); const el = e.target.closest("[data-act]"); if (el) { e.stopPropagation(); demoAct(el.dataset.act, el); } });
  box.addEventListener("keydown", e => { if (e.key === "Escape") demoClose(); });
  document.body.appendChild(box); const f = box.querySelector(".dm-acct"); if (f) f.focus();
}
function dmListHTML() {
  return html`<ul class="dm-list">${dmList().map(d => html`<li><button class="dm-acct" type="button" data-act="demo-as" data-who="${d.who}"${dmMe() && dmMe().who === d.who ? raw(' aria-current="true"') : ""}>
<span class="dm-ic">${icon(dmIcon(d.who), 18)}</span><span class="dm-t"><b>${t("dmT_" + d.who)}</b><small>${t("dmD_" + d.who)}</small></span><span class="dm-go">${t("dmGo")}</span></button></li>`)}</ul>`;
}
function demoClose() { const b = $("#dmBox"); if (b) b.remove(); }
function demoBanner() {
  const me = dmMe(); let bar = $("#dmBar");
  document.documentElement.classList.toggle("dm-on", !!me);
  if (!me) { if (bar) bar.remove(); return; }
  if (!bar) { bar = document.createElement("div"); bar.id = "dmBar"; bar.className = "dm-bar"; bar.setAttribute("role", "status"); document.body.appendChild(bar);
    bar.addEventListener("click", e => { const el = e.target.closest("[data-act]"); if (el) { e.stopPropagation(); demoAct(el.dataset.act, el); } }); }
  put(bar, html`<span class="dm-dot" aria-hidden="true"></span><span class="dm-who">${t("dmAs", { name: t("dmS_" + me.who) })}</span><button class="dm-btn" type="button" data-act="demo-switch" aria-label="${t("dmSwitchL")}">${t("dmSwitch")}</button><button class="dm-btn" type="button" data-act="demo-leave" aria-label="${t("dmLeaveL")}">${t("dmLeave")}</button>`);
}
async function demoAct(act, el) {
  if (act === "demo-open" && el && el.closest("#onb")) { const box = $("#dmInline"), open = box.hidden; box.hidden = !open; el.setAttribute("aria-expanded", String(open)); if (open) { const f = box.querySelector(".dm-acct"); if (f) f.focus(); } return; }
  if (act === "demo-open" || act === "demo-switch") return demoOpen();
  if (act === "demo-close") return demoClose();
  if (act === "demo-leave") { demoClose(); const bar = $("#dmBar"); if (bar) bar.remove(); return signOut(); }
  if (act === "demo-as") {
    const who = el.dataset.who;
    try { if (S.user) await api.post("/api/auth/logout"); await api.post("/api/auth/demo", { who }); } catch (err) { toast({ title: errText(err), ic: "alert" }); return; }
    try { localStorage.setItem("shaghilni.app.welcomed", "true"); localStorage.setItem("shaghilni.app.browse", "true"); } catch (e) { /* private mode */ }
    location.hash = who === "company" ? "#/company" : who === "university" ? "#/campus" : "#/"; location.reload();
  }
}
// Show the banner once the app has loaded who you are, and keep it right as you move around.
(function demoWatch() { if (S.loaded) demoBanner(); else setTimeout(demoWatch, 200); })();
window.addEventListener("hashchange", () => setTimeout(demoBanner, 0));
