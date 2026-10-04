/* ---------- settings ---------- */
const THEME_BG = { light: "#F4F4F2", dark: "#0D0E0F" };
function applyTheme() {
  const r = document.documentElement;
  if (S.theme === "system") r.removeAttribute("data-theme"); else r.setAttribute("data-theme", S.theme);
  store.set("theme", S.theme);
  const l = $("#tcLight"), d = $("#tcDark");   /* status bar follows the chosen theme */
  if (l && d) { l.content = S.theme === "dark" ? THEME_BG.dark : THEME_BG.light; d.content = S.theme === "light" ? THEME_BG.light : THEME_BG.dark; }
}
/* A light/dark switch is a big brightness change: crossfade it briefly instead of snapping (never for keyboard or reduced motion) */
function setTheme(k) {
  const a = document.activeElement, refocus = a && a.dataset ? a.dataset.act : null;
  const go = () => {
    S.theme = k; applyTheme(); renderChrome();
    if (S.view === "profile") render();
    if (OB.open) renderOnb();
    if (refocus === "theme") { const b = OB.open ? $('#onb [data-act="theme"]') : $("#themeBtn"); if (b) b.focus(); }
    else if (refocus === "theme-set") { const b = $(`[data-act="theme-set"][data-theme="${k}"]`); if (b) b.focus(); }
  };
  if (document.startViewTransition && !byKeyboard() && !reduced()) document.startViewTransition(go); else go();
}
function setLang(l) {
  if (l === S.lang) return;
  S.lang = l; store.set("lang", l);
  if (S.user) api.put("/api/me/lang", { lang: l }).catch(() => {});
  const r = document.documentElement; r.lang = l; r.dir = l === "ar" ? "rtl" : "ltr";
  const v = $("#view"); v.dataset.v = "";
  for (const x of Toasts.items) toastRemove(x.id, true);   // toasts are snapshots in the old language
  render();
  if (OB.open) renderOnb();
  if (Layer.open) layerClose(true);
}
function clearFilters() { S.q = ""; S.qTerms = []; S.gov = "all"; if (S.view !== "saved") S.tab = "all"; const q = $("#q"); if (q) q.value = ""; const g = $("#gov"); if (g) g.value = "all"; renderRows(); renderDetailPane(); }

/* ---------- events ---------- */
document.addEventListener("keydown", () => { lastInput = "keyboard"; }, true);
document.addEventListener("pointerdown", () => { lastInput = "pointer"; }, true);
document.addEventListener("click", e => {
  if (Layer.suppressClick) { Layer.suppressClick = false; if (e.target.closest && e.target.closest(".grab, .p-head")) { e.preventDefault(); return; } }
  if (Pop.open && !$("#pop").contains(e.target) && !e.target.closest("#me")) popClose();
  const el = e.target.closest ? e.target.closest("[data-act]") : null;
  if (!el || !el.dataset.act) { if (e.target.classList && e.target.classList.contains("scrim")) layerClose(); return; }
  const act = el.dataset.act, id = el.dataset.id ? Number(el.dataset.id) : null, j = id != null ? JOB.get(id) : null;
  switch (act) {
    case "view": popClose(); go(VIEW_HASH[el.dataset.view] || "#/"); break;
    case "open": if (j) openJob(id); break;
    case "filter": S.tab = el.dataset.tab; renderRows(); renderDetailPane(); break;
    case "save": if (j) toggleSave(id); break;
    case "share": if (j) shareJob(j); break;
    case "apply": if (j) openApply(j); break;
    case "wa": if (j) openWa(j); break;
    case "apply-email": if (j) openWa(j, "email"); break;
    case "apply-call": if (j) callApply(j); break;
    case "resume": go("#/resume" + (id ? "/" + id : "")); break;
    case "clear": clearFilters(); break;
    case "post": popClose(); if (role() === "employer") go("#/company/jobs/new"); else if (!S.user) location.href = "/hire"; break;   // the recruiter sign-up page
    case "signin": popClose(); openOnboarding({ mode: "signin" }); break;
    case "signout": popClose(); signOut(); break;
    case "demo-open": case "demo-close": case "demo-as": case "demo-switch": case "demo-leave": if (typeof demoAct === "function") demoAct(act, el); break;
    case "onb-profile": popClose(); openOnboarding({ mode: "profile" }); break;
    case "go": popClose(); go(el.dataset.to); break;
    case "withdraw": withdraw(Number(el.dataset.app), Number(el.dataset.job), el); break;
    case "reload": location.reload(); break;
    case "export": exportData(el); break;
    case "me": if (isNarrow()) go("#/profile"); else if (Pop.open) popClose(); else popOpen(el, popHTML()); break;
    case "edit-profile": popClose(); openOnboarding({ mode: "edit" }); break;
    case "lang": setLang(S.lang === "ar" ? "en" : "ar"); break;
    case "lang-set": setLang(el.dataset.l); break;
    case "theme": setTheme(darkNow() ? "light" : "dark"); break;
    case "theme-set": setTheme(el.dataset.theme); break;
    case "layer-close": layerClose(); break;
    case "apply-send": sendApply(el); break;
    case "apply-cv-lang": case "apply-cv-prev": case "apply-cv-fix": applyCvAct(act, el); break;
    case "wa-lang": { S.waLang = el.dataset.l; const wj = JOB.get(S.waJob), ta = $("#waMsg"); if (wj && ta) { ta.value = waMsg(wj, S.waLang); ta.dir = S.waLang === "ar" ? "rtl" : "ltr"; ta.lang = S.waLang; }
      { const n = $("#waCvNote"); if (n) put(n, waCvNoteHTML()); }
      for (const b of $$('[data-act="wa-lang"]')) b.setAttribute("aria-pressed", b.dataset.l === S.waLang ? "true" : "false"); break; }
    case "wa-open": openWhatsapp(el); break;
    case "wa-copy": copyText($("#waMsg").value, $("#waMsg")).then(ok => { const l = $("#waCopyLbl"); if (l) l.textContent = t(ok ? "waCopied" : "waCopy"); }); break;
    case "undo-unsave": if (j && !S.saved.has(id)) toggleSave(id); toastRemove(Number(el.dataset.toast)); break;
    case "cv-undo": cvAct(act, el); toastRemove(Number(el.dataset.toast)); break;
    default:
      if (act.startsWith("onb-")) onbAct(act, el);
      else if (act.startsWith("emp-")) empAct(act, el);
      else if (act.startsWith("adm-")) admAct(act, el);
      else if (act.startsWith("cv-")) cvAct(act, el);
      else if (act.startsWith("rc-")) recruitAct(act, el);
      else if (act.startsWith("al-")) alertAct(act, el);
      else if (act.startsWith("ev-")) eventsAct(act, el);
      else if (act.startsWith("tm-")) empAct(act, el);
      else if (act.startsWith("ins-")) insightsAct(act, el);
      else if (act.startsWith("tr-") || act.startsWith("sy-")) trafficAct(act, el);
      else if (act.startsWith("cp-") || act.startsWith("sv-") || act === "emp-partner" || act.startsWith("adm-campus")) campusAct(act, el);
      else if (act.startsWith("im-")) importAct(act, el);
      break;
  }
});
for (const type of ["input", "change"]) document.addEventListener(type, e => {
  const el = e.target;
  if (!el || !el.dataset) return;
  const isChange = type === "change";
  if (el.id === "q" && !isChange) { S.q = el.value; S.qTerms = norm(S.q).split(" ").filter(Boolean); renderRows(); renderDetailPane(); return; }
  if (el.id === "gov" && isChange) { S.gov = el.value; renderRows(); renderDetailPane(); return; }
  if (el.id === "sort" && isChange) { S.sort = el.value; renderRows(); return; }
  if (el.id === "plMonths" && isChange) { planAct("emp-plan-months", el); return; }
  if (el.type === "file" && el.dataset.import) { if (isChange) importFile(el); return; }
  if (el.dataset.jf != null || el.dataset.jfUni) { jfInput(el); return; }
  if (el.closest("#onb")) { if (!isChange || el.tagName === "SELECT" || el.type === "checkbox") onbInput(el); return; }
  if (el.closest(".cv")) { if (!isChange || el.tagName === "SELECT" || el.type === "checkbox") cvInput(el); }
});
document.addEventListener("pointerdown", e => {
  const h = e.target.closest && e.target.closest("[data-hold]");
  if (h) { holdStart(h); return; }
  if (Layer.open && $("#panel").contains(e.target)) sheetDragStart(e);
});
document.addEventListener("pointermove", sheetDragMove);
for (const ev of ["pointerup", "pointercancel"]) document.addEventListener(ev, e => { holdCancel(); sheetDragEnd(e); });
document.addEventListener("pointerleave", holdCancel, true);
document.addEventListener("keyup", e => { if ((e.key === " " || e.key === "Enter") && Hold.el) holdCancel(); });
document.addEventListener("keydown", e => {
  const tg = e.target, typing = !!tg && (/^(INPUT|TEXTAREA|SELECT)$/.test(tg.tagName) || tg.isContentEditable);
  if ((e.key === " " || e.key === "Enter") && tg && tg.dataset && tg.dataset.hold) { e.preventDefault(); if (!e.repeat) holdStart(tg); return; }
  if (e.key === "Escape") {
    if (Pop.open) { e.preventDefault(); popClose(true); return; }
    if (Layer.open) { e.preventDefault(); layerClose(); return; }
    if (OB.open && OB.step !== "welcome") { e.preventDefault(); closeOnboarding(); return; }
    if (tg && tg.id === "q" && tg.value) { tg.value = ""; S.q = ""; S.qTerms = []; renderRows(); renderDetailPane(); }
    return;
  }
  if (e.key === "Enter" && tg && tg.dataset && tg.dataset.skill) {
    e.preventDefault();
    if (tg.dataset.skill === "onb") onbAct("onb-skill", tg); else if (tg.dataset.skill === "cv") cvAct("cv-skill", tg); else cvAct("cv-cert", tg);
    return;
  }
  if (OB.open) { if (e.key === "Enter" && tg && tg.tagName === "INPUT" && tg.type !== "checkbox" && !tg.closest(".eform")) { e.preventDefault(); obNext(); } return; }
  if (Layer.open || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === "/" && !typing) { e.preventDefault(); const q = $("#q"); if (q) { q.focus(); q.select(); } return; }
  if (typing || isNarrow() || (S.view !== "jobs" && S.view !== "saved")) return;
  const dirn = e.key === "ArrowDown" || e.key === "j" ? 1 : e.key === "ArrowUp" || e.key === "k" ? -1 : 0;
  if (!dirn) return;
  e.preventDefault();
  const list = results(); if (!list.length) return;
  const i = list.findIndex(x => x.id === S.open), nx = list[Math.max(0, Math.min(list.length - 1, (i < 0 ? -1 : i) + dirn))];
  openJob(nx.id, { focusRow: true });   /* keyboard-driven: no animation anywhere on this path */
});
/* ---------- routing: #/, #/job/12, #/saved, #/applications, #/resume/12, #/profile, #/company/..., #/admin/... ---------- */
const VIEW_HASH = { campus: "#/campus", analytics: "#/company/analytics", alerts: "#/alerts", recruiters: "#/recruiters", jobs: "#/", saved: "#/saved", applications: "#/applications", resume: "#/resume", profile: "#/profile", company: "#/company", admin: "#/admin" };
function go(hash) {
  if (Layer.open && Layer.pushed) {
    // An open sheet owns the current history entry. Closing it with history.back() would race the new address
    // (the back step lands after it and undoes it), so close it in place and let the new page take over the entry.
    layerClose(true, true);
    history.replaceState(null, "", hash);
    route();
    return;
  }
  if (Layer.open) layerClose(true);
  if (location.hash === hash || (hash === "#/" && !location.hash)) route(); else location.hash = hash;
}
function route() {
  const p = (location.hash || "").replace(/^#\/?/, "").split("/").filter(Boolean);
  const [a, b] = p;
  popClose();
  if (!S.loaded) return;
  // Employers work with their own listings: the public job board isn't part of their account.
  if (role() === "employer" && !["company", "profile", "privacy", "terms"].includes(a)) { history.replaceState(null, "", "#/company"); S.sub = []; goView("company"); return; }
  if (role() === "university" && !["campus", "organize", "profile", "privacy", "terms"].includes(a)) { history.replaceState(null, "", "#/campus"); S.sub = []; goView("campus"); return; }
  if (a === "job") {
    const id = Number(b);
    if (!JOB.has(id)) {   // a link to a listing published after this tab loaded: fetch it before giving up
      ensureJob(id).then(ok => {
        if (ok) { if (location.hash === "#/job/" + id) route(); return; }
        history.replaceState(null, "", "#/"); goView("jobs"); toast({ title: t("err_not_found"), ic: "alert" });
      });
      return;
    }
    if (S.view !== "jobs" && S.view !== "saved") goView("jobs");
    if (S.open !== id || isNarrow()) openJob(id, { noHistory: true });
    return;
  }
  if (Layer.open && !OB.open) layerClose(true, true);   // the address has already changed: stepping back would undo it
  const guard = need => {
    if (role() === need) return true;
    history.replaceState(null, "", "#/"); goView("jobs");
    if (!S.user) openOnboarding({ mode: "signin", role: need === "employer" ? "employer" : "seeker" });
    else toast({ title: t("err_forbidden"), ic: "alert" });
    return false;
  };
  switch (a) {
    case undefined: case "jobs": goView("jobs"); break;
    case "saved": goView("saved"); break;
    case "applications": goView("applications"); break;
    case "recruiters": goView("recruiters"); break;
    case "alerts": goView("alerts"); break;
    case "campus": if (guard("university")) { S.sub = p.slice(1); goView("campus"); } break;
    case "events": S.sub = p.slice(1); goView("events"); break;
    case "organize": if (S.user && (role() === "admin" || role() === "university")) { S.sub = p.slice(1); goView("organize"); } else { history.replaceState(null, "", "#/"); goView("jobs"); } break;
    case "resume": goView("resume", b ? Number(b) : null); break;   // with a job: tailor the one resume for it
    case "profile": goView("profile"); break;
    case "privacy": case "terms": S.sub = [a]; goView("legal"); break;
    case "company": if (guard("employer")) { S.sub = p.slice(1); goView("company"); } break;
    case "admin": if (guard("admin")) { S.sub = p.slice(1); goView("admin"); } break;
    case "signin": history.replaceState(null, "", "#/"); goView("jobs"); if (!S.user) openOnboarding({ mode: "signin" }); break;
    default: history.replaceState(null, "", "#/"); goView("jobs");
  }
  if (typeof trackView === "function" && S.loaded) trackView();   // count the page (only which page, never what was typed)
}
window.addEventListener("popstate", () => {
  if (Layer.ignorePop) { Layer.ignorePop = false; return; }
  if (Layer.open) layerClose(false, true);
});
window.addEventListener("hashchange", () => { if (Layer.ignoreHash) { Layer.ignoreHash = false; return; } route(); });
function bindMedia() {
  if (!window.matchMedia) return;
  const mq = window.matchMedia(NARROW_Q);
  const on = () => { if (Layer.open && $("#panel").classList.contains("panel--detail")) layerClose(true); $("#view").dataset.v = ""; render(); };
  const dq = window.matchMedia("(prefers-color-scheme: dark)");   /* keep the switch's icon honest when the phone changes theme */
  const onScheme = () => { if (S.theme === "system") { renderChrome(); if (OB.open) renderOnb(); } };
  if (dq && dq.addEventListener) dq.addEventListener("change", onScheme); else if (dq && dq.addListener) dq.addListener(onScheme);
  if (mq.addEventListener) mq.addEventListener("change", on); else if (mq.addListener) mq.addListener(on);
}

/* ---------- boot ---------- */
function hydrateIcons() { /* html-safe: built-in icon markup */ for (const el of $$("[data-icon]")) el.outerHTML = icon(el.dataset.icon, Number(el.dataset.size) || 16, 1.8, el.getAttribute("class") || "").s; }
let jobsLoadedAt = 0;
async function loadJobs() { const r = await api.get("/api/jobs"); prepJobs(r.jobs || []); jobsLoadedAt = Date.now(); }
async function ensureJob(id) {
  if (JOB.has(id)) return true;
  try { const r = await api.get(`/api/jobs/${id}`); prepJobs([...JOBS, r.job]); rescore(); if (S.view === "jobs" || S.view === "saved") { renderJobsHead(); renderRows(); } return JOB.has(id); }
  catch (e) { return false; }
}
/* A tab left open for a while refreshes the board when the person comes back to it. */
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible" || !S.loaded || Date.now() - jobsLoadedAt < 5 * 60e3) return;
  loadJobs().then(() => { rescore(); if (S.view === "jobs" || S.view === "saved") { renderRows(); renderDetailPane(); renderChrome(); } }).catch(() => {});
});
async function loadEmployer() { S.emp = await api.get("/api/employer"); }
async function loadAdminCounts() {
  const o = await api.get("/api/admin/overview");
  S.admin = { ...(S.admin || {}), overview: o, queued: o.queues.companies + o.queues.jobs + o.queues.hires };
}
async function loadSession() {
  const me = await api.get("/api/me");
  S.user = me.user || null;
  S.saved = new Set(me.saved || []);
  S.apps = new Map((me.applications || []).filter(a => a.status !== "withdrawn").map(a => [a.jobId, { id: a.id, status: a.status }]));
  S.applied = new Set(S.apps.keys());
  S.me = me.profile || null;
  S.invitesNew = me.invitesNew || 0; S.alertsNew = me.alertsNew || 0; S.studentVerify = me.studentVerify || null; S.campusOffice = me.campusOffice || null;
  setProfile(S.me, true);
  if (S.user && S.user.lang !== S.lang) api.put("/api/me/lang", { lang: S.lang }).catch(() => {});
  if (S.user && S.user.role === "employer") await loadEmployer().catch(() => { S.emp = null; });
  if (S.user && S.user.role === "admin") await loadAdminCounts().catch(() => {});
}
async function boot() {
  const r = document.documentElement;
  r.lang = S.lang; r.dir = S.lang === "ar" ? "rtl" : "ltr";
  hydrateIcons(); applyTheme(); bindToaster(); bindMedia();
  render();
  try {
    const [cfg] = await Promise.all([api.get("/api/config"), loadJobs(), loadSession()]);
    S.cfg = cfg;
  } catch (err) { S.loadError = true; render(); return; }
  rescore();
  S.loaded = true;
  const deep = /^#\/(job|company|admin|signin|privacy|terms)/.test(location.hash || "");   // read before routing rewrites the hash
  route();
  if (!S.user && !deep && !OB.open && !store.get("browse", false)) openOnboarding({ mode: "new" });
  if (window.__SHG_TEST__) window.__shg = { S, JOBS, OB, CV, Layer, Toasts, Pop, go, route, t, get PROFILE() { return PROFILE; } };
}
boot();

/* Shaghilni Lite: the link at the top shows while the app downloads, then stays only on slow or data-saving connections. */
(function liteLink() {
  const a = document.getElementById("liteSkip"); if (!a) return;
  const c = navigator.connection, slow = !!(c && (c.saveData || /(^|-)2g$/.test(c.effectiveType || "")));
  a.hidden = !slow;
})();
