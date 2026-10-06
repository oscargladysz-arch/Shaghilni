/* =====================================================================
   Shaghilni next — interface
   One delegated click handler (data-act); views render from state.
   ===================================================================== */

/* ---------- state ---------- */
const S = {
  lang: store.get("lang", "ar") === "en" ? "en" : "ar",
  theme: THEMES.includes(store.get("theme")) ? store.get("theme") : "system",
  q: "", qTerms: [], gov: "all", tab: "all", sort: "recent",
  view: "jobs", sub: [], listTab: "all", open: null,
  user: null, cfg: { ai: false, dev: false }, loaded: false, loadError: false,
  saved: new Set(), applied: new Set(), apps: new Map(),
  me: null, prevMe: null, applyJob: null, waJob: null, waLang: "en",
  emp: null, admin: null
};
let PROFILE = null;
const OB = { open: false, step: "welcome", mode: "new", d: null, errors: {}, codeSent: false, code: "", phoneRaw: "", form: null, returnTo: null, reason: "", focusErr: false, role: "seeker", busy: false, devCode: "", resendAt: 0 };
const CV = { target: "general", lang: "en", tab: "preview", form: null, over: false, ai: { st: "idle", items: [], ctl: null, msg: "" }, sample: undefined, sampleAsked: true };
const FILTERS = [["all", "filterAll"], ["intern", "tabIntern"], ["domestic", "tabDomestic"], ["multinational", "tabMulti"], ["returnees", "tabReturnees"], ["entry", "tabEntry"]];
Object.assign(ICON, {
  chev: '<path d="M9.5 6l6 6-6 6"/>',
  calendar: '<rect x="4" y="5.5" width="16" height="14.5" rx="2"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/>',
  camera: '<path d="M4 8.5h3l1.6-2.5h6.8L17 8.5h3v10H4z"/><circle cx="12" cy="13.2" r="3.4"/>',
  pencil: '<path d="M4.5 19.5l1-4L15.8 5.2a2 2 0 0 1 2.8 0l.2.2a2 2 0 0 1 0 2.8L8.5 18.5l-4 1Z"/>',
  back: '<path d="M14.5 6 8.5 12l6 6"/>',
  cap: '<path d="M3 9l9-4 9 4-9 4-9-4Z"/><path d="M7 11v4c0 1.5 2.5 3 5 3s5-1.5 5-3v-4"/><path d="M21 9v5"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6.3 6.3l2.5 2.5M15.2 15.2l2.5 2.5M6.3 17.7l2.5-2.5M15.2 8.8l2.5-2.5"/>',
  bell: '<path d="M6.5 16.5V11a5.5 5.5 0 0 1 11 0v5.5l1.5 1.5H5l1.5-1.5Z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
  home: '<path d="M4 11.5 12 5l8 6.5"/><path d="M6.5 10v9.5h11V10"/><path d="M10 19.5v-5h4v5"/>',
  doc: '<path d="M7 3.5h7l4 4V20a.6.6 0 0 1-.6.6H7.6A.6.6 0 0 1 7 20V3.5Z"/><path d="M14 3.5V8h4M9.6 12h5M9.6 15.6h5"/>',
  user: '<circle cx="12" cy="8.4" r="3.6"/><path d="M5 20a7 7 0 0 1 14 0"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/>',
  trash: '<path d="M5 7h14M10 7V4.6h4V7M7 7l1 13h8l1-13"/>',
  sparkle: '<path d="M12 3.5l1.9 5.1 5.1 1.9-5.1 1.9L12 17.5l-1.9-5.1L5 10.5l5.1-1.9L12 3.5Z"/>',
  print: '<path d="M7 8.5V3.5h10v5"/><rect x="3.5" y="8.5" width="17" height="8" rx="2"/><path d="M7 14h10v6.5H7z"/>',
  lock: '<rect x="5" y="10.5" width="14" height="9.5" rx="2"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/>',
  home: '<path d="M4 10.5 12 4l8 6.5V20H4v-9.5Z"/><path d="M9.5 20v-5.5h5V20"/>',
  inbox: '<path d="M3.5 13.5 6 5.5h12l2.5 8V19a.6.6 0 0 1-.6.6H4.1a.6.6 0 0 1-.6-.6v-5.5Z"/><path d="M3.5 13.5h5l1.2 2.2h4.6l1.2-2.2h5"/>',
  gauge: '<path d="M4 17a8 8 0 1 1 16 0"/><path d="m12 17 4.2-5"/>',
  phone: '<path d="M6.5 4h3l1.5 4-2 1.3a10 10 0 0 0 5.7 5.7l1.3-2 4 1.5v3A1.5 1.5 0 0 1 18.5 19 14.5 14.5 0 0 1 5 5.5 1.5 1.5 0 0 1 6.5 4Z"/>',
  out: '<path d="M14 4.5h4.4a.6.6 0 0 1 .6.6v13.8a.6.6 0 0 1-.6.6H14"/><path d="M10 8l-4 4 4 4M6 12h9"/>'
});
const THEME_ICON = { system: "monitor", light: "sun", dark: "moon" };
/* What the person is actually looking at right now, whatever the setting says */
const darkNow = () => S.theme === "dark" || (S.theme === "system" && !!(window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches));
function themeBtnHTML() {
  const d = darkNow(), l = t(d ? "themeToLight" : "themeToDark");
  return html`<button class="ibtn" type="button" data-act="theme" aria-label="${l}" title="${l}">${icon(d ? "sun" : "moon", 17)}</button>`;
}
const role = () => (S.user ? S.user.role : "guest");
const isSeeker = () => role() === "seeker" || role() === "guest";
const isStudent = () => role() === "seeker" && !!(S.me && S.me.edu && S.me.edu.status === "student");

/* ---------- live profile ---------- */
function setProfile(me, quiet) {
  PROFILE = deriveProfile(me);
  rescore();
  if (!quiet) render();
}
/* Profile edits (resume helper, bullet fixes) are saved to the server shortly after the last change. */
let saveTimer = 0;
function saveMe(now) {
  clearTimeout(saveTimer);
  const go = () => api.put("/api/me/profile", { profile: S.me }).catch(err => toast({ title: errText(err), ic: "alert" }));
  if (now) return go();
  saveTimer = setTimeout(go, 700);
  return null;
}

/* ---------- chrome ---------- */
// Which navigation item is current. Analytics lives inside the company pages, so it's matched by its sub-page.
function navOn(v) {
  if (v === "analytics") return S.view === "company" && S.sub[0] === "analytics";
  if (v === "company") return S.view === "company" && S.sub[0] !== "analytics";
  return S.view === v;
}
function navItems() {
  const r = role();
  if (r === "employer") return [["company", "building", "navCompany"], ["analytics", "gauge", "plAnalytics"], ["profile", "user", "navProfile"]];
  if (r === "university") return [["campus", "cap", "navCampus"], ["profile", "user", "navProfile"]];
  if (r === "admin") return [["jobs", "brief", "navJobs"], ["admin", "gauge", "navAdmin"], ["profile", "user", "navProfile"]];
  // Five tabs at most on a phone: Saved lives on the job board (and in the sidebar), so Recruiters gets a tab.
  return [["jobs", "brief", "navJobs"], ["applications", "inbox", "navApps"], ["recruiters", "users", "navRecruit"], ["resume", "doc", "navResume"], ["profile", "user", "navProfile"]];
}
function meLabel() {
  if (!S.user) return { name: t("signIn"), sub: t("obCreate"), ini: null };
  const initials = name => String(name || "").trim().split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase();
  if (S.user.role === "employer") { const c = S.emp && S.emp.company, nm = c ? L(bi(c.name)) : ""; return { name: nm || t("navCompany"), sub: phoneLabel(S.user.phone), ini: nm ? initials(nm) : null }; }
  if (S.user.role === "admin") return { name: t("navAdmin"), sub: phoneLabel(S.user.phone), ini: "AD" };
  // A career office shows its university and "Career office", both in the app's language (the office name the admin typed is in one language only).
  if (role() === "university") { const o = S.campusOffice || {}; return { name: UNI[o.uni] ? L(UNI[o.uni]) : (o.name || t("navCampus")), sub: t("navCampus"), ini: UNI[o.uni] ? initials(L(UNI[o.uni])) : null }; }
  return PROFILE ? { name: L(PROFILE.name), sub: L(PROFILE.facYear), ini: L(PROFILE.initials) } : { name: t("obCreate"), sub: phoneLabel(S.user.phone), ini: null };
}
function renderChrome() {
  const r = role(), rail = navItems().filter(n => n[0] !== "profile");
  if (r === "guest" || r === "seeker") rail.splice(1, 0, ["saved", "bookmark", "navSaved"]);   // the sidebar has room for Saved too
  const extra = r === "employer" && (typeof canDo !== "function" || !S.emp || !S.emp.company || canDo("hire")) ? html`<li><button class="nav-btn" type="button" data-act="go" data-to="#/company/jobs/new" aria-label="${t("newJob")}"><span class="nav-ic">${icon("plus", 18)}</span><span class="nav-lbl">${t("newJob")}</span></button></li>`
    : r === "guest" ? html`<li><button class="nav-btn" type="button" data-act="post" aria-label="${t("navPost")}"><span class="nav-ic">${icon("plus", 18)}</span><span class="nav-lbl">${t("navPost")}</span></button></li>` : "";
  put($("#nav"), html`${rail.map(([v, ic, k]) => html`<li><button class="nav-btn" type="button" data-act="view" data-view="${v}"${navOn(v) ? raw(' aria-current="page"') : ""} aria-label="${t(k)}"><span class="nav-ic">${v === "saved" && navOn(v) ? iconF("bookmark", 18) : icon(ic, 18)}</span><span class="nav-lbl">${t(k)}</span>${v === "saved" && S.saved.size ? html`<span class="nav-n num">${S.saved.size}</span>` : ""}${v === "admin" && S.admin && S.admin.queued ? html`<span class="nav-n num">${S.admin.queued}</span>` : ""}${v === "recruiters" && S.invitesNew ? html`<span class="nav-badge" aria-hidden="true">${S.invitesNew}</span><span class="sr-only">${t("rcNewSr", { n: S.invitesNew })}</span>` : ""}</button></li>`)}${extra}`);
  const m = meLabel();
  put($("#me"), html`<span class="avatar" aria-hidden="true">${m.ini || icon("user", 16)}</span><span class="me-txt"><span class="me-name">${m.name}</span><span class="me-sub" dir="auto">${m.sub}</span></span>`);
  $("#me").setAttribute("aria-label", m.name); $("#pop").setAttribute("aria-label", m.name);   // the account menu is a dialog: named like the button that opens it (U-184)
  put($("#tabbar"), html`${navItems().map(([v, ic, k]) => html`<button class="tab-btn" type="button" data-act="view" data-view="${v}"${navOn(v) ? raw(' aria-current="page"') : ""}>${S.view === v && v === "saved" ? iconF("bookmark", 22) : icon(ic, 22)}<span>${t(k)}</span>${v === "recruiters" && S.invitesNew ? html`<span class="tab-badge" aria-hidden="true">${S.invitesNew}</span><span class="sr-only">${t("rcNewSr", { n: S.invitesNew })}</span>` : ""}</button>`)}`);
  $("#tabbar").style.gridTemplateColumns = `repeat(${navItems().length}, 1fr)`;
  $("#tabbar").setAttribute("aria-label", t("navAria")); $("#nav").setAttribute("aria-label", t("navAria"));
  $("#langBtn").textContent = S.lang === "ar" ? "English" : "العربية";
  $("#langBtn").setAttribute("lang", S.lang === "ar" ? "en" : "ar");
  const th = $("#themeBtn"), dk = darkNow(), tl2 = t(dk ? "themeToLight" : "themeToDark");
  put(th, icon(dk ? "sun" : "moon", 17)); th.setAttribute("aria-label", tl2); th.title = tl2;
  $("#brandWord").textContent = S.lang === "ar" ? "شغّلني" : "Shaghilni";
  $("#railTitle").textContent = S.lang === "ar" ? "شغّلني" : "Shaghilni";
  $("#railSub").textContent = t("brandSub");
  $("#skip").textContent = t("skipLink");
  document.title = t("pageTitle");
}

/* ---------- views ---------- */
function render() {
  if (typeof demoBanner === "function") demoBanner();
  renderChrome();
  const v = $("#view");
  if (!S.loaded) { v.dataset.v = "loading"; put(v, S.loadError ? stateHTML("alert", t("err_offline"), "", html`<button class="btn btn--soft" type="button" data-act="reload">${t("retry")}</button>`) : stateHTML("spin", t("loading"))); return; }
  if (S.view === "jobs" || S.view === "saved") { if (v.dataset.v !== "jobs") { put(v, jobsShell()); v.dataset.v = "jobs"; bindListScroll(); } renderJobsHead(); renderRows(); renderDetailPane(); }
  else if (S.view === "resume") { v.dataset.v = "resume"; renderResume(); }
  else if (S.view === "applications") { v.dataset.v = "applications"; renderApplications(); }
  else if (S.view === "recruiters") { v.dataset.v = "recruiters"; renderRecruiters(); }
  else if (S.view === "alerts") { v.dataset.v = "alerts"; renderAlerts(); }
  else if (S.view === "campus") { v.dataset.v = "campus"; renderCampus(); }
  else if (S.view === "events") { v.dataset.v = "events"; stopScan(); renderEvents(); }
  else if (S.view === "organize") { v.dataset.v = "organize"; stopScan(); EV.form = null; renderOrganize(); }
  else if (S.view === "company") { v.dataset.v = "company"; renderCompany(); }
  else if (S.view === "admin") { v.dataset.v = "admin"; renderAdmin(); }
  else if (S.view === "legal") { v.dataset.v = "legal"; put(v, legalHTML(S.sub[0])); }
  else { v.dataset.v = "profile"; put(v, profileHTML()); segSync(v, true); }
}
function stateHTML(ic, h, p, action) {
  return html`<div class="empty" role="status">${ic === "spin" ? html`<span class="spin spin--lg" aria-hidden="true"></span>` : ""}
<h2 class="empty-h">${ic === "spin" ? "" : html`<span class="empty-ic" aria-hidden="true">${icon(ic, 20)}</span>`}${h}</h2>${p ? html`<p class="empty-p">${p}</p>` : ""}${action || ""}</div>`;
}
function jobsShell() {
  return html`<div class="jobs">
<section class="list-pane" aria-labelledby="lhTitle"><div class="list-scroll scroll" id="listScroll">
  <div class="list-head" id="listHead" data-scrolled="false"></div>
  <ul class="rows" id="rows"></ul>
</div></section>
<section class="detail-pane" id="detailPane"><div class="detail-scroll scroll" id="detailScroll"></div></section>
</div>`;
}
function bindListScroll() {
  const sc = $("#listScroll");
  if (sc) sc.addEventListener("scroll", () => { const h = $("#listHead"); if (h) h.dataset.scrolled = sc.scrollTop > 4 ? "true" : "false"; }, { passive: true });
}
function renderJobsHead() {
  const head = $("#listHead");
  if (!head) return;
  const saved = S.view === "saved";
  const keepQ = S.q, focused = document.activeElement && document.activeElement.id === "q";
  if (!focused || head.dataset.lang !== S.lang || head.dataset.saved !== String(saved)) {
    put(head, html`<div class="lh-row lh-row--board"><div class="lh-t"><h1 class="lh-title" id="lhTitle">${t(saved ? "savedTitle" : "jobsTitle")}</h1><span class="lh-count num" id="count" aria-live="polite"></span></div>
<div class="lh-tools">${isSeeker() && !saved ? html`<button class="btn btn--ghost lh-saved" type="button" data-act="view" data-view="alerts" aria-label="${t("alertsTitle")}${S.alertsNew ? " (" + S.alertsNew + ")" : ""}">${icon("bell", 15)}<span class="lh-saved-l">${t("alertSaveShort")}</span>${S.alertsNew ? html`<span class="lh-saved-n">${S.alertsNew}</span>` : ""}</button>` : ""}${isSeeker() && !saved ? html`<button class="btn btn--ghost lh-saved" type="button" data-act="view" data-view="saved" aria-label="${t("navSaved")}">${icon("bookmark", 15)}<span class="lh-saved-l">${t("navSaved")}</span>${S.saved.size ? html`<span class="lh-saved-n">${S.saved.size}</span>` : ""}</button>` : ""}
<label class="gov-wrap">${icon("pin", 14)}<span class="sr-only">${t("govAria")}</span><select class="gov" id="gov">${[["all", t("govAll")], ...GOV_ORDER.map(k => [k, L(GOV[k])])].map(([k, l]) => html`<option value="${k}"${k === S.gov ? raw(" selected") : ""}>${l}</option>`)}</select></label></div></div>
<label class="search">${icon("search", 17)}<span class="sr-only">${t("searchAria")}</span><input class="search-inp" id="q" type="search" enterkeyhint="search" autocomplete="off" spellcheck="false" placeholder="${t("searchPh")}" value="${keepQ}"><kbd class="kbd" aria-hidden="true">/</kbd></label>
${saved ? "" : html`<div class="lh-tools"><div class="seg" id="seg" role="group" aria-label="${t("filtersAria")}"></div>
<select class="sort" id="sort" aria-label="${t("listSortAria")}"><option value="recent"${S.sort === "recent" ? raw(" selected") : ""}>${t("sortRecent")}</option><option value="match"${S.sort === "match" ? raw(" selected") : ""}${PROFILE ? "" : raw(" disabled")}>${t("sortMatch")}</option><option value="pay"${S.sort === "pay" ? raw(" selected") : ""}>${t("sortPay")}</option></select></div>`}`);
    head.dataset.lang = S.lang; head.dataset.saved = String(saved);
    const sg = $("#seg"); if (sg) sg.addEventListener("scroll", () => segEdge(sg), { passive: true });
  }
}
function segHTML() {
  const btns = interactive => FILTERS.map(([k, key]) => html`<button class="seg-btn" type="button" data-act="${interactive ? "filter" : ""}" data-tab="${k}"${interactive ? "" : raw(' tabindex="-1"')} aria-pressed="${S.tab === k ? "true" : "false"}">${t(key)}<span class="seg-n num">${countTab(k)}</span></button>`);
  return html`<div class="seg-inner"><div class="seg-track">${btns(true)}</div><div class="seg-copy" aria-hidden="true"><div class="seg-track">${btns(false)}</div></div></div>`;
}
function ringHTML(score, lg) { return html`<span class="ring${lg ? " ring--lg" : ""} tier-${tier(score)}" style="--p:${score}" aria-hidden="true"></span>`; }
/* Sponsored listings are verified like every job. They're lifted to the top, and labelled, only for signed-in job seekers they fit well. */
function sponsoredFirst(list) {
  list.forEach(j => { j._spon = false; });
  if (!PROFILE || S.view === "saved") return list;
  const top = list.filter(j => j.sponsored && (j._score || 0) >= 60).slice(0, 2);
  top.forEach(j => { j._spon = true; });
  return top.length ? [...top, ...list.filter(j => !top.includes(j))] : list;
}
function rowHTML(j) {
  const pay = payText(j), on = S.saved.has(j.id);
  return html`<li class="row" data-id="${j.id}"${S.open === j.id ? raw(' aria-current="true"') : ""}>
<button class="row-hit" type="button" data-act="open" data-id="${j.id}" aria-label="${L(j.title) + sep() + L(j.co)}"></button>
<span class="logo" style="--tile:${SECTOR[j.sector] || "#475569"}" aria-hidden="true">${j.abbr}</span>
<span class="row-main">${j._spon ? html`<span class="spon-tag">${t("sponsored")}</span>` : ""}<span class="row-title">${L(j.title)}</span><span class="row-meta">${L(j.co) + sep() + L(GOV[j.gov])}</span><span class="row-pay num">${pay.main}</span></span>
<span class="row-side">${PROFILE ? html`<span class="fitchip">${ringHTML(j._score)}<span class="num">${j._score}%</span></span>` : ""}
${S.applied.has(j.id) ? html`<span class="row-flag">${t("applied")}</span>` : ""}
<button class="ibtn row-save" type="button" data-act="save" data-id="${j.id}" aria-pressed="${on ? "true" : "false"}" aria-label="${t(on ? "unsave" : "save")}">${on ? iconF("bookmark", 16) : icon("bookmark", 16)}</button></span>
</li>`;
}
function renderRows() {
  let list = results(); const rows = $("#rows");
  if (!rows) return;
  if (!isNarrow() && list.length && (S.open == null || !list.some(j => j.id === S.open))) S.open = list[0].id;
  if (!list.length && !isNarrow()) S.open = null;
  $("#count").textContent = tn("countJobs", list.length);
  const seg = $("#seg");
  if (seg) keepFocus(() => { put(seg, segHTML()); }, seg);
  keepFocus(() => {
    list = sponsoredFirst(list);
    put(rows, list.length ? html`${list.map(rowHTML)}` : html`<li class="empty"><span class="empty-ic">${icon(S.view === "saved" ? "bookmark" : "search", 22)}</span>
<h2 class="empty-h">${t(S.view === "saved" && !S.qTerms.length ? "savedEmptyH" : "emptyH")}</h2><p class="empty-p">${t(S.view === "saved" && !S.qTerms.length ? "savedEmptyP" : "emptyP")}</p>
${S.view === "saved" && !S.qTerms.length ? html`<button class="btn btn--soft" type="button" data-act="view" data-view="jobs">${t("savedEmptyCta")}</button>` : html`<button class="btn btn--soft" type="button" data-act="clear">${t("emptyBtn")}</button>`}</li>`);
  }, rows);
  if (seg) { segSync(seg, false); segEdge(seg); }
}
/* fade the strip's far edge only while there is more to scroll to */
function segEdge(seg) { const end = Math.abs(seg.scrollLeft) + seg.clientWidth >= seg.scrollWidth - 2; seg.dataset.end = end ? "true" : "false"; }
function keepFocus(fn, scope) {
  const a = document.activeElement, inside = a && scope && scope.contains(a) && a.dataset;
  const sel = inside ? `[data-act="${a.dataset.act}"]${a.dataset.id ? `[data-id="${a.dataset.id}"]` : ""}${a.dataset.tab ? `[data-tab="${a.dataset.tab}"]` : ""}` : null;
  fn();
  if (sel) { const el = scope.querySelector(sel); if (el) el.focus({ preventScroll: true }); }
}
function markCurrent() { for (const el of $$("#rows .row")) { if (Number(el.dataset.id) === S.open) el.setAttribute("aria-current", "true"); else el.removeAttribute("aria-current"); } }

/* ---------- detail (pane on desktop, sheet on phones) ---------- */
function fitHTML(j) {
  const a = assess(j);
  if (!a) return html`<div class="fit-cta"><p>${t("whyNoProfile")}</p><button class="btn btn--primary" type="button" data-act="onb-open">${icon("user", 15)}<span>${t("obCreate")}</span></button></div>`;
  const P = PROFILE, tr = tier(a.score);
  return html`<div class="fit tier-${tr}">
${ringHTML(a.score, true)}
<div><p class="fit-n num">${a.score}%</p><p class="fit-tier">${t("scoreTier_" + tr)}</p><p class="fit-cap">${P.fac && P.uni ? t("whyCap", { fac: L(FAC[P.fac]), uni: L(UNI[P.uni]), home: L(placeOf(P)) }) : t("whyCapAlt", { edu: L(P.facYear), home: L(placeOf(P)) })}</p></div>
<div class="fit-rows">${a.parts.map(p => html`<div class="fit-row"><span class="fit-k">${t(p.k)}</span><span>${t(p.key, p.vars)}</span><span class="fit-pts num">${p.pts}/${p.max}</span><span class="meter"><span class="meter-fill" style="--w:${(p.pts / p.max).toFixed(3)}"></span></span></div>`)}</div>
${a.capped ? html`<p class="fine" style="grid-column:1 / -1">${t("capped")}</p>` : ""}
</div>`;
}
function whoChips(j) {
  const P = PROFILE || {}, chips = [];
  if (j.anyFaculty) chips.push(html`<span class="chip">${t("anyFac")}</span>`);
  if (j.noDegree) chips.push(html`<span class="chip">${t("noDegree")}</span>`);
  for (const [u, f] of j.recruits) { const you = u === P.uni && f === P.fac; chips.push(html`<span class="chip${you ? " chip--you" : ""}">${L(UNI[u]) + sep() + L(FAC[f])}${you ? html` (${t("you")})` : ""}</span>`); }
  return html`<div class="chips">${chips}</div>${j.alumni ? html`<p class="fine">${tn("alumni", j.alumni)}</p>` : ""}`;
}
function actionButtons(j, sheet) {
  const applied = S.applied.has(j.id), on = S.saved.has(j.id);
  const primary = applied ? html`<span class="btn btn--done${sheet ? " btn--lg" : ""}">${icon("check", 15, 2.4)}${t("appliedBtn")}</span>`
    : html`<button class="btn btn--primary${sheet ? " btn--lg" : ""}" type="button" data-act="apply" data-id="${j.id}">${iconF("bolt", 14)}${t("applyBtn")}</button>`;
  // Besides Shaghilni, only the ways the company chose (sample listings keep WhatsApp, to show how it works).
  const ways = [[j.hasWhatsapp || j.demo, "wa", "chat", "waBtn"], [j.applyCall, "apply-call", "phone", "callBtn"], [j.applyEmail, "apply-email", "send", "emailBtn"]].filter(w => w[0]);
  const wa = applied ? "" : html`${ways.map(([, act, ic, k]) => html`<button class="btn${sheet ? " btn--lg" : ""}" type="button" data-act="${act}" data-id="${j.id}">${icon(ic, 15)}${t(k)}</button>`)}`;
  if (sheet) return html`${primary}${wa}`;
  return html`${primary}${wa}<button class="ibtn" type="button" data-act="save" data-id="${j.id}" aria-pressed="${on ? "true" : "false"}" aria-label="${t(on ? "unsave" : "save")}" title="${t(on ? "unsave" : "save")}">${on ? iconF("bookmark", 17) : icon("bookmark", 17)}</button><button class="ibtn" type="button" data-act="share" data-id="${j.id}" aria-label="${t("share")}" title="${t("share")}">${icon("share", 17)}</button>`;
}
function detailHTML(j, sheet) {
  const pay = payText(j), cnt = countLabel(j);
  return html`<article class="detail">
<header class="d-head"><span class="logo logo--lg" style="--tile:${SECTOR[j.sector] || "#475569"}" aria-hidden="true">${j.abbr}</span>
<div class="d-id"><h2 class="d-title" id="${sheet ? "panelTitle" : "detailTitle"}">${L(j.title)}</h2>
<p class="d-co"><strong>${L(j.co)}</strong><span class="verified">${iconF("verified", 14)}<span class="sr-only">${t("verified")}</span></span><span>${CAT[j.cat].emoji} ${L(CAT[j.cat])}</span>${j.returnees ? html`<span class="d-ret">${icon("home", 13)}${t("returneesTag")}</span>` : ""}${j._spon ? html`<span class="spon-tag">${t("sponsored")}</span>` : ""}${(j.partnerUnis || []).length ? html`<span class="d-ret">${icon("cap", 13)}${t("ptBadge", { uni: j.partnerUnis.map(k => UNI[k] ? L(UNI[k]) : k).join(sep()) })}</span>` : ""}</p>${(j.unis || []).length || j.progStart ? html`<p class="note">${icon("cap", 15)}<span>${t("progLine", { when: j.progStart ? progRange(j) : "—", unis: (j.unis || []).map(k => UNI[k] ? L(UNI[k]) : k).join(sep()) || t("progAny") })}</span></p>` : ""}${j._spon ? html`<p class="note">${icon("info", 15)}<span>${t("sponWhy")}</span></p>` : ""}
<p class="d-meta"><span>${icon("pin", 13)}${L(j.place)}</span><span>${icon("clock", 13)}${ago(j.days)}</span><span class="num">${icon("users", 13)}${tn("applicants", j.applicants)}</span>${cnt ? html`<span>${cnt}</span>` : ""}</p></div></header>
<div class="actions">${sheet ? html`<button class="ibtn" type="button" data-act="save" data-id="${j.id}" aria-pressed="${S.saved.has(j.id) ? "true" : "false"}" aria-label="${t(S.saved.has(j.id) ? "unsave" : "save")}">${S.saved.has(j.id) ? iconF("bookmark", 17) : icon("bookmark", 17)}</button><button class="ibtn" type="button" data-act="share" data-id="${j.id}" aria-label="${t("share")}">${icon("share", 17)}</button>` : actionButtons(j, false)}${PROFILE ? html`<button class="btn btn--soft" type="button" data-act="resume" data-id="${j.id}">${icon("doc", 15)}${t("cvTailorBtn")}</button>` : ""}</div>
<dl class="facts">
<div class="fact"><dt class="fact-k">${t("kPay")}</dt><dd class="fact-v num">${pay.main}</dd>${pay.alt ? html`<dd class="fact-s num">${pay.alt}</dd>` : ""}</div>
<div class="fact"><dt class="fact-k">${t("kType")}</dt><dd class="fact-v">${L(TYPE[j.type])}</dd></div>
<div class="fact"><dt class="fact-k">${t("kLevel")}</dt><dd class="fact-v">${L(LEVEL[j.level])}</dd></div>
<div class="fact"><dt class="fact-k">${t("kLang")}</dt><dd class="fact-v">${listJoin(j.langs.map(x => L(LANGS[x])))}</dd></div>
</dl>
${j.pay ? html`<p class="fine">${t("payNote", { rate: RATE.syp, stamp: L(RATE.stamp) })}</p>` : ""}
<section class="sec"><h3 class="sec-h">${t("hWhy")}</h3>${fitHTML(j)}</section>
<section class="sec"><h3 class="sec-h">${t("hAbout")}</h3><p class="prose">${L(j.summary)}</p></section>
<section class="sec"><h3 class="sec-h">${t("hDuties")}</h3><ul class="bul">${L(j.duties).map(x => html`<li>${x}</li>`)}</ul></section>
<section class="sec"><h3 class="sec-h">${t("hNeeds")}</h3><ul class="bul">${L(j.needs).map(x => html`<li>${x}</li>`)}</ul></section>
<section class="sec"><h3 class="sec-h">${t("hProvides")}</h3><ul class="bul bul--ok">${L(j.provides).map(x => html`<li>${x}</li>`)}</ul></section>
<section class="sec"><h3 class="sec-h">${t("hWho")}</h3>${whoChips(j)}</section>
${L(j.contact.name) ? html`<section class="sec"><h3 class="sec-h">${t("hContact")}</h3><div class="person"><span class="person-av" aria-hidden="true">${L(j.contact.av)}</span><span class="person-txt"><span class="person-name">${L(j.contact.name)}</span><span>${L(j.contact.role)}</span><span>${L(j.contact.status)}</span></span></div></section>` : ""}
${L(j.about) ? html`<section class="sec"><h3 class="sec-h">${t("hAboutCo")}</h3><p class="prose">${L(j.about)}</p></section>` : ""}
${j.demo ? html`<p class="note note--demo">${icon("alert", 15)}<span>${t("demoNote", { co: L(j.co) })}</span></p>` : ""}
<p class="note">${icon("shield", 15)}<span>${t("safety")}</span></p>
</article>
${sheet ? html`<div class="sheet-actions">${actionButtons(j, true)}</div>` : ""}`;
}
function renderDetailPane() {
  const box = $("#detailScroll");
  if (!box) return;
  const j = JOB.get(S.open);
  const keep = box.dataset.jid === String(S.open) ? box.scrollTop : 0;
  if (!j) put(box, html`<div class="empty"><span class="empty-ic">${icon("brief", 22)}</span><h2 class="empty-h">${t("blankH")}</h2><p class="empty-p">${t("blankP")}</p></div>`);
  else put(box, detailHTML(j, false));
  box.dataset.jid = String(S.open);
  box.scrollTop = keep;
  $("#detailPane").setAttribute("aria-label", j ? L(j.title) : t("detailAria"));
}
function openJob(id, opts = {}) {
  const j = JOB.get(id);
  if (!j) return;
  S.open = id;
  markCurrent();
  if (isNarrow()) {
    layerOpen(html`<div class="p-body scroll" id="sheetScroll">${detailHTML(j, true)}</div>`, { detail: true, history: !opts.noHistory, hash: "#/job/" + id, label: L(j.title),
      onClose: () => { if (isNarrow()) { S.open = null; markCurrent(); try { history.replaceState(null, "", "#/"); } catch (e) { /* sandbox */ } } } });
  } else {
    try { history.replaceState(null, "", "#/job/" + id); } catch (e) { /* sandbox */ }
    renderDetailPane();
    if (opts.focusRow) { const b = $(`#rows .row-hit[data-id="${id}"]`); if (b) { b.focus({ preventScroll: true }); b.closest(".row").scrollIntoView && b.closest(".row").scrollIntoView({ block: "nearest" }); } }
  }
}
function refreshOpenSheet() {
  if (!Layer.open || !$("#sheetScroll") || S.open == null) return;
  const sc = $("#sheetScroll"), top = sc.scrollTop;
  put(sc, detailHTML(JOB.get(S.open), true));
  sc.scrollTop = top;
}

/* ---------- panels: apply and WhatsApp ---------- */
function panelHead(titleKey, sub) {
  return html`<div class="p-head"><div><h2 class="p-title" id="panelTitle">${t(titleKey)}</h2>${sub ? html`<p class="p-sub">${sub}</p>` : ""}</div><button class="ibtn" type="button" data-act="layer-close" aria-label="${t("close")}">${icon("x", 15, 2.2)}</button></div>`;
}
/* Applying needs a signed-in job seeker with a profile; anything missing routes through onboarding and back. */
function needProfile(returnTo) {
  if (!S.user) { openOnboarding({ reason: t("obReasonApply"), returnTo }); return true; }
  if (!isSeeker()) { toast({ title: t("err_forbidden"), ic: "alert" }); return true; }
  if (!PROFILE) { openOnboarding({ mode: "profile", reason: t("obReasonApply"), returnTo }); return true; }
  return false;
}
function busy(btn, on) { if (!btn) return; btn.disabled = on; btn.setAttribute("aria-busy", on ? "true" : "false"); }
function openApply(j) {
  if (needProfile({ act: "apply", id: j.id })) return;
  S.applyJob = j.id;
  S.applyCv = { lang: defaultCvLang(j), prev: false };
  const P = PROFILE;
  layerOpen(html`${panelHead("aTitle", L(j.title) + sep() + L(j.co))}
<div class="p-body scroll">
  <dl class="sum">${[["obName", L(P.name)], ["obPhone", P.phone], ["obEmail", P.email || "—"], ["prEdu", L(P.facYear)]].map(([k, v]) =>
    html`<div class="kv-row"><dt>${t(k)}</dt><dd${k === "obPhone" || k === "obEmail" ? raw(' dir="ltr"') : ""}>${v}</dd></div>`)}</dl>
  <button class="link" type="button" data-act="edit-profile">${icon("edit", 14)}${t("prEdit")}</button>
  <div id="applyCv">${applyCvHTML(j)}</div>
  ${j.demo ? html`<p class="note note--demo">${icon("alert", 15)}<span>${t("demoListing")}</span></p>` : ""}
</div>
<div class="p-foot"><button class="btn btn--primary btn--lg btn--block" type="button" data-act="apply-send" data-autofocus>${icon("send", 15)}${t("aSend")}</button><p class="fine">${t("aFine")}</p></div>`,
  { label: t("aTitle"), returnFocus: document.activeElement });
}
function markApplied(jobId, app) { S.apps.set(jobId, { id: app.id, status: app.status }); S.applied.add(jobId); }
function afterApplied(j, titleKey, subKey, ic) {
  layerClose(true);
  if (isNarrow() && S.open === j.id) openJob(j.id, { noHistory: true });
  renderRows(); renderDetailPane();
  toast(j.demo ? { title: t(titleKey), sub: t("demoListing"), ic } : { title: t(titleKey), sub: t(subKey, { co: L(j.co) }), ic });
}
async function sendApply(btn) {
  const j = JOB.get(S.applyJob); if (!j) return;
  busy(btn, true);
  try {
    await saveMe(true);   // the employer receives exactly what the preview shows
    const r = await api.post(`/api/jobs/${j.id}/apply`, { cvLang: S.applyCv ? S.applyCv.lang : null }); markApplied(j.id, r.application); afterApplied(j, "tApplied", "tAppliedS", "check"); }
  catch (err) { toast({ title: errText(err), ic: "alert" }); }
  finally { busy(btn, false); }
}
const sep = () => (S.lang === "ar" ? "، " : ", ");
const phoneLabel = p => (p ? normPhone(p) || p : "");
function waMsg(j, lg) {
  const P = PROFILE, pick = o => (o ? (o[lg] ?? o.en) : "");
  const edu = [P.uni ? UNI[P.uni][lg] : "", P.facYear[lg]].filter(Boolean).join(" — ");
  return fill(STR[lg].waTpl, { greet: greetName(pick(j.contact.name)), title: pick(j.title), co: pick(j.co), name: P.name[lg] || P.name.en, edu: edu ? "\n" + edu : "", phone: P.phone, cv: "" }).replace(/ +([,،])/g, "$1");
}
function openWa(j, via = "whatsapp") {
  if (needProfile({ act: via === "email" ? "apply-email" : "wa", id: j.id })) return;
  S.waJob = j.id; S.waVia = via;
  const on = via === "email" ? j.applyEmail : j.hasWhatsapp;
  S.waLang = j.langs.includes("en") ? S.lang : "ar";
  layerOpen(html`${panelHead(via === "email" ? "emTitle" : "waTitle", L(j.title) + sep() + L(j.co))}
<div class="p-body scroll">
  <div class="person"><span class="person-av" aria-hidden="true">${L(j.contact.av) || j.abbr}</span><span class="person-txt"><span class="person-name">${L(j.contact.name) || L(j.co)}</span><span>${L(j.contact.role)}</span></span></div>
  ${on ? "" : html`<p class="note note--demo">${icon("alert", 15)}<span>${j.demo ? t("demoListing") : t("waUnavailable")}</span></p>`}
  <div class="field"><div class="lh-row"><label class="lbl" for="waMsg">${t("waMsgLbl")}</label>
    <div class="seg2" role="group" aria-label="${t("waLangLbl")}">${["ar", "en"].map(l => html`<button class="seg2-btn" type="button" data-act="wa-lang" data-l="${l}" lang="${l}" aria-pressed="${S.waLang === l ? "true" : "false"}">${l === "ar" ? "العربية" : "English"}</button>`)}</div></div>
    <textarea class="inp inp--msg" id="waMsg" dir="${S.waLang === "ar" ? "rtl" : "ltr"}" lang="${S.waLang}" spellcheck="false">${waMsg(j, S.waLang)}</textarea><p class="hint">${t("waEdit")}</p></div>
  <p class="note" id="waCvNote">${waCvNoteHTML()}</p>
  <p class="note">${icon("info", 15)}<span>${t("waWhy")}</span></p>
</div>
<div class="p-foot"><div class="p-foot-row"><button class="btn btn--primary btn--lg" type="button" data-act="wa-open" data-autofocus${on || j.demo ? "" : raw(" disabled")}>${icon(via === "email" ? "send" : "chat", 15)}${t(via === "email" ? "emOpen" : "waOpen")}</button><button class="btn btn--lg" type="button" data-act="wa-copy">${icon("copy", 15)}<span id="waCopyLbl">${t("waCopy")}</span></button></div><p class="fine">${t(S.waVia === "email" ? "emFine" : "waFine")}</p></div>`,
  { label: t("waTitle"), returnFocus: document.activeElement });
}
async function openWhatsapp(btn) {
  const j = JOB.get(S.waJob); if (!j) return;
  const msg = $("#waMsg").value;
  const email = S.waVia === "email";
  const win = !email && j.hasWhatsapp ? window.open("", "_blank") : null;   // opened now, inside the tap, so phones don't block it
  busy(btn, true);
  try {
    const r = await api.post(`/api/jobs/${j.id}/apply`, { channel: email ? "email" : "whatsapp", cvLang: S.waLang });   // the resume goes in the message's language
    markApplied(j.id, r.application);
    if (email && r.email) { location.href = `mailto:${r.email}?subject=${encodeURIComponent(t("emSubject", { title: L(j.title), name: PROFILE ? L(PROFILE.name) : "" }))}&body=${encodeURIComponent(msg)}`; afterApplied(j, "tEm", "tEmS", "send"); return; }
    if (r.whatsapp) {
      const url = `https://wa.me/${r.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(msg)}`;
      if (win) win.location.href = url; else location.href = url;
    } else if (win) win.close();
    afterApplied(j, "tWa", "tWaS", "chat");
  } catch (err) { if (win) win.close(); toast({ title: errText(err), ic: "alert" }); }
  finally { busy(btn, false); }
}
/* Applying by phone: record it, then dial the number the company chose. */
async function callApply(j) {
  if (!S.user) { openOnboarding({ reason: t("obReasonApply"), returnTo: `#/job/${j.id}` }); return; }
  if (needProfile({ act: "apply-call", id: j.id })) return;
  if (!confirm(t("callQ", { co: L(j.co) }))) return;
  try { const r = await api.post(`/api/jobs/${j.id}/apply`, { channel: "call", cvLang: S.lang }); markApplied(j.id, r.application);
    if (r.phone) location.href = "tel:" + r.phone; afterApplied(j, "tCall", "tCallS", "phone"); }
  catch (err) { toast({ title: errText(err), ic: "alert" }); }
}
async function toggleSave(id) {
  const j = JOB.get(id); if (!j) return;
  if (!S.user) { openOnboarding({ reason: t("err_login_required") }); return; }
  if (!isSeeker()) return;
  const had = S.saved.has(id);
  if (had) S.saved.delete(id); else S.saved.add(id);
  renderChrome(); renderRows(); renderDetailPane(); refreshOpenSheet();
  try {
    if (had) await api.del(`/api/me/saved/${id}`); else await api.post(`/api/me/saved/${id}`);
    toast(had ? { title: t("tUnsaved"), sub: L(j.title), ic: "bookmark", action: { act: "undo-unsave", id, label: t("undo") } } : { title: t("tSaved"), sub: t("tSavedS"), ic: "bookmark" });
  } catch (err) {
    if (had) S.saved.add(id); else S.saved.delete(id);
    renderChrome(); renderRows(); renderDetailPane(); refreshOpenSheet();
    toast({ title: errText(err), ic: "alert" });
  }
}
async function shareJob(j) {
  const url = location.href.split("#")[0] + "#/job/" + j.id, text = t("shareText", { title: L(j.title), co: L(j.co) });
  if (navigator.share && window.matchMedia && window.matchMedia("(pointer: coarse)").matches) {
    try { await navigator.share({ title: text, text, url }); return; } catch (e) { if (e && e.name === "AbortError") return; }
  }
  const ok = await copyText(url);
  toast(ok ? { title: t("tShared"), sub: t("tSharedS"), ic: "share" } : { title: t("tShareFail"), sub: url, ic: "alert" });
}

/* ---------- the resume that goes with an application ----------
   Quick apply attaches the person's Shaghilni resume, in the language they pick, and the employer opens it
   in that language. Lines not yet translated are counted, with a way to finish them before sending. */
function defaultCvLang(j) {
  if ((j.langs || []).includes("en")) return "en";   // the job asks for English
  const src = trSources(S.me || {}), ar = src.filter(s => scriptOf(s) === "ar").length;
  return src.length && ar * 2 < src.length ? "en" : "ar";   // otherwise the language it's mostly written in
}
function applyCvHTML(j) {
  const a = S.applyCv, lg = a.lang, R = buildResume(S.me, String(j.id), lg), need = R.trMissing.length + (R.nameMissing ? 1 : 0);
  return html`<section class="cvatt" aria-labelledby="cvattH"><h3 class="cvatt-h" id="cvattH">${t("aCvH")}</h3>
<div class="cvatt-card"><span class="cvatt-ic" aria-hidden="true">${icon("doc", 18)}</span>
<span class="cvatt-txt"><span class="cvatt-name" dir="auto">${R.name}</span><span class="cvatt-meta">${t("aCvMeta")}</span></span>
<span class="pill pill--good">${t("attached")}</span></div>
<div class="cvatt-row"><span class="cvatt-lbl" id="cvattLang">${t("aCvLang")}</span>
<div class="seg2" role="group" aria-labelledby="cvattLang">${["ar", "en"].map(l => html`<button class="seg2-btn" type="button" data-act="apply-cv-lang" data-l="${l}" lang="${l}" aria-pressed="${l === lg ? "true" : "false"}">${l === "ar" ? "العربية" : "English"}</button>`)}</div>
<button class="link cvatt-prev-btn" type="button" data-act="apply-cv-prev" aria-expanded="${a.prev ? "true" : "false"}"${a.prev ? raw(' aria-controls="cvattPrev"') : ""}>${t(a.prev ? "aCvHide" : "aCvPreview")}</button></div>
<p class="cvatt-st${need ? " cvatt-st--warn" : ""}" role="status">${icon(need ? "alert" : "check", 14)}<span>${need ? `${t("ckTrMissing", { n: need, lang: trLang(lg) })}. ${t("aCvAsIs")}` : t("aCvReady", { lang: trLang(lg) })}</span></p>
${need ? html`<button class="link cvatt-fix" type="button" data-act="apply-cv-fix">${t("aCvFix")}</button>` : ""}
${a.prev ? html`<div class="stage cvatt-prev" id="cvattPrev">${raw(paperHTML(R).s.replace('id="cvPaper"', 'id="cvattPaper"'))}</div>` : ""}</section>`;
}
function applyCvAct(act, el) {
  const j = JOB.get(S.applyJob), box = $("#applyCv");
  if (!j || !S.applyCv) return;
  if (act === "apply-cv-fix") { S.cvOpenTr = S.applyCv.lang; go(`#/resume/${j.id}`); return; }   // opens the translation editor in that language
  if (act === "apply-cv-lang") S.applyCv.lang = el.dataset.l === "en" ? "en" : "ar";
  if (act === "apply-cv-prev") S.applyCv.prev = !S.applyCv.prev;
  if (!box) return;
  put(box, applyCvHTML(j));
  const again = act === "apply-cv-lang" ? box.querySelector(`[data-act="apply-cv-lang"][data-l="${S.applyCv.lang}"]`) : box.querySelector('[data-act="apply-cv-prev"]');
  if (again) again.focus();
}
const waCvNoteHTML = () => html`${icon("doc", 15)}<span>${t("waCvNote", { lang: trLang(S.waLang) })}</span>`;
