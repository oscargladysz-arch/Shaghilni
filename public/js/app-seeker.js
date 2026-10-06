/* ---------- profile, account menu and applications ---------- */
function themeSeg() { return html`<div class="seg2" role="group" aria-label="${t("setTheme")}">${THEMES.map(k => html`<button class="seg2-btn" type="button" data-act="theme-set" data-theme="${k}" aria-pressed="${S.theme === k ? "true" : "false"}">${t("theme" + k[0].toUpperCase() + k.slice(1))}</button>`)}</div>`; }
function langSeg() { return html`<div class="seg2" role="group" aria-label="${t("setLang")}">${["en", "ar"].map(l => html`<button class="seg2-btn" type="button" data-act="lang-set" data-l="${l}" lang="${l}" aria-pressed="${S.lang === l ? "true" : "false"}">${l === "ar" ? "العربية" : "English"}</button>`)}</div>`; }
function accountCard(canDelete) {
  return html`<section class="card"><div class="set"><span><span class="set-k">${t("obPhone")}</span><br><span class="prof-sub" dir="ltr">${phoneLabel(S.user.phone)}</span></span>
<button class="btn" type="button" data-act="signout">${icon("out", 15)}${t("signOut")}</button></div>
<div class="set"><span class="set-k">${t("exportH")}</span><button class="btn" type="button" data-act="export">${icon("doc", 15)}${t("exportData")}</button></div>
${canDelete ? html`<button class="hold" type="button" data-hold="delete" aria-describedby="holdHint"><span class="hold-fill" aria-hidden="true"></span><span class="hold-lbl">${t("holdDelete")}</span><span class="hold-lbl hold-lbl--on" aria-hidden="true">${t("holdDelete")}</span></button>
<p class="fine" id="holdHint" style="margin-top:8px">${t("deleteHint")}</p>` : ""}</section>`;
}
function profileHTML() {
  const P = PROFILE, r = role();
  const settings = html`<section class="card"><div class="set"><span class="set-k">${t("setLang")}</span>${langSeg()}</div><div class="set"><span class="set-k">${t("setTheme")}</span>${themeSeg()}</div></section>`;
  let top;
  if (r === "guest") top = html`<section class="card"><h2 class="card-h">${t("noProfileH")}</h2><p class="card-p">${t("noProfileP")}</p>
<div class="card-act"><button class="btn btn--primary" type="button" data-act="onb-open">${icon("user", 15)}${t("obCreate")}</button><button class="btn" type="button" data-act="signin">${t("signIn")}</button></div></section>`;
  else if (r === "seeker" && P) top = html`<section class="card"><div class="prof-top"><span class="avatar avatar--lg" aria-hidden="true">${L(P.initials)}</span><div><h2 class="prof-name">${L(P.name)}</h2><p class="prof-sub">${L(P.facYear)}</p></div></div>
<dl class="kv">${[["prHome", L(placeOf(P))], ["prLangs", listJoin(P.langs.map(x => L(LANGS[x])))], ["obPhone", P.phone], ["obEmail", P.email || "—"]].map(([k, v]) => html`<div class="kv-row"><dt>${t(k)}</dt><dd${k === "obPhone" || k === "obEmail" ? raw(' dir="ltr"') : ""}>${v}</dd></div>`)}</dl>
<div class="card-act"><button class="btn" type="button" data-act="edit-profile">${icon("edit", 15)}${t("prEdit")}</button><button class="btn btn--soft" type="button" data-act="view" data-view="resume">${icon("doc", 15)}${t("cvTitle")}</button><button class="btn btn--soft" type="button" data-act="view" data-view="alerts">${icon("bell", 15)}${t("alertsTitle")}</button></div></section>`;
  else if (r === "seeker") top = html`<section class="card"><h2 class="card-h">${t("obCreate")}</h2><p class="card-p">${t("noProfileP")}</p><div class="card-act"><button class="btn btn--primary" type="button" data-act="onb-profile">${icon("user", 15)}${t("obCreate")}</button></div></section>`;
  else top = html`<section class="card"><h2 class="card-h">${t(r === "admin" ? "navAdmin" : "navCompany")}</h2><div class="card-act"><button class="btn btn--primary" type="button" data-act="view" data-view="${r === "admin" ? "admin" : "company"}">${icon(r === "admin" ? "gauge" : "building", 15)}${t(r === "admin" ? "adTitle" : "coTitle")}</button></div></section>`;
  const hiring = r === "guest" ? html`<section class="card"><h2 class="card-h">${t("hiringH")}</h2><p class="card-p">${t("hiringP")}</p><div class="card-act"><button class="btn" type="button" data-act="post">${icon("plus", 15)}${t("navPost")}</button></div></section>` : "";
  return html`<div class="prof scroll"><div class="prof-in"><h1 class="lh-title">${t("profileTitle")}</h1>${top}${r === "seeker" && P ? studentVerifyHTML() : ""}${settings}${hiring}${S.user ? accountCard(r !== "admin") : ""}
<p class="fine legal-links">${legalLinks()}</p></div></div>`;
}
function popHTML() {
  const r = role(), m = meLabel();
  const btn = (act, ic, key, extra = "") => html`<button class="pop-btn" type="button" data-act="${act}"${raw(extra)}>${icon(ic, 16)}${t(key)}</button>`;
  const items = r === "guest" ? [btn("signin", "user", "signIn"), btn("onb-open", "sparkle", "obCreate")]
    : r === "employer" ? [btn("view", "building", "navCompany", ' data-view="company"'), btn("go", "plus", "newJob", ' data-to="#/company/jobs/new"'), btn("view", "user", "viewProfile", ' data-view="profile"'), btn("signout", "out", "signOut")]
    : r === "admin" ? [btn("view", "gauge", "navAdmin", ' data-view="admin"'), btn("view", "user", "viewProfile", ' data-view="profile"'), btn("signout", "out", "signOut")]
    : [btn("view", "user", "viewProfile", ' data-view="profile"'), btn(PROFILE ? "edit-profile" : "onb-profile", "edit", PROFILE ? "prEdit" : "obCreate"), btn("view", "doc", "cvTitle", ' data-view="resume"'), btn("signout", "out", "signOut")];
  return html`${S.user ? html`<div class="pop-head"><span class="avatar" aria-hidden="true">${m.ini || icon("user", 16)}</span><div><p class="pop-name">${m.name}</p><p class="pop-sub" dir="ltr">${phoneLabel(S.user.phone)}</p></div></div>` : ""}<div class="pop-list">${items}</div>`;
}
async function exportData(btn) {
  busy(btn, true);
  try {
    const res = await fetch("/api/me/export", { credentials: "same-origin" });
    if (!res.ok) throw new ApiError(res.status, res.status === 401 ? "login_required" : "server_error");
    const url = URL.createObjectURL(await res.blob()), a = document.createElement("a");
    a.href = url; a.download = "shaghilni-my-data.json"; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    toast({ title: t("tExported"), ic: "check" });
  } catch (err) { toast({ title: errText(err), ic: "alert" }); }
  busy(btn, false);
}
async function holdDone(what) {
  if (what !== "delete") return;
  try { await api.del("/api/me"); }
  catch (err) { toast({ title: errText(err), ic: "alert" }); return; }
  resetSession();
  toast({ title: t("tDeleted"), ic: "check" });
  go("#/"); render(); openOnboarding({ mode: "new" });
}
function resetSession() {
  S.user = null; S.me = null; S.emp = null; S.admin = null; S.saved = new Set(); S.applied = new Set(); S.apps = new Map();
  setProfile(null, true); store.set("meDraft", null);   // the next person on this phone starts with an empty profile form (D-54)
}
async function signOut() {
  try { await api.post("/api/auth/logout"); } catch (e) { /* signed out locally anyway */ }
  resetSession(); toast({ title: t("tSignedOut"), ic: "check" }); go("#/"); render(); openOnboarding({ mode: "new" });
}

/* Applications, newest first, with the stage the employer has put them in. */
const APP_TONE = { new: "", shortlisted: "pill--good", interview: "pill--good", hired: "pill--good", rejected: "pill--muted", withdrawn: "pill--muted" };
function dayLabel(ts) { const d = new Date(ts); return `${d.getDate()} ${MONTHS[S.lang][d.getMonth()]}`; }
async function renderApplications() {
  const v = $("#view");
  if (!S.user) { put(v, html`<div class="page scroll"><div class="page-in">${stateHTML("inbox", t("appsTitle"), t("err_login_required"), html`<button class="btn btn--primary" type="button" data-act="signin">${t("signIn")}</button>`)}</div></div>`); return; }
  put(v, html`<div class="page scroll"><div class="page-in"><h1 class="lh-title">${t("appsTitle")}</h1><div id="appsList">${stateHTML("spin", t("loading"))}</div></div></div>`);
  let list;
  try { list = (await api.get("/api/me/applications")).applications; }
  catch (err) { const box = $("#appsList"); if (box) put(box, stateHTML("alert", errText(err), "", html`<button class="btn btn--soft" type="button" data-act="view" data-view="applications">${t("retry")}</button>`)); return; }
  const box = $("#appsList"); if (!box || S.view !== "applications") return;
  for (const a of list) if (a.status !== "withdrawn") { S.apps.set(a.jobId, { id: a.id, status: a.status }); S.applied.add(a.jobId); }
  if (!list.length) { put(box, stateHTML("inbox", t("appsEmptyH"), t("appsEmptyP"), html`<button class="btn btn--soft" type="button" data-act="view" data-view="jobs">${t("savedEmptyCta")}</button>`)); return; }
  put(box, html`<ul class="alist">${list.map(a => html`<li class="acard">
<span class="logo" style="--tile:${SECTOR[a.sector] || "#475569"}" aria-hidden="true">${a.abbr || ""}</span>
<span class="acard-main"><span class="acard-t">${L(bi(a.title))}</span><span class="acard-s">${L(bi(a.co))}${a.gov && GOV[a.gov] ? sep() + L(GOV[a.gov]) : ""}</span>
<span class="acard-meta"><span class="pill ${APP_TONE[a.status]}">${t("st_" + a.status)}</span><span>${t("appUpdated", { when: dayLabel(a.updatedAt) })}</span>${a.channel && a.channel !== "web" ? html`<span>${t("appVia_" + a.channel)}</span>` : ""}${a.jobOpen ? "" : html`<span>${t("appClosed")}</span>`}</span></span>
<span class="acard-act">${a.jobOpen ? html`<button class="btn btn--ghost" type="button" data-act="go" data-to="#/job/${a.jobId}">${t("viewJob")}</button>` : ""}
${["new", "shortlisted", "interview"].includes(a.status) ? html`<button class="link link--muted" type="button" data-act="withdraw" data-app="${a.id}" data-job="${a.jobId}">${t("appWithdraw")}</button>` : ""}</span>
</li>`)}</ul>`);
}
async function withdraw(appId, jobId, btn) {
  busy(btn, true);
  try { await api.post(`/api/me/applications/${appId}/withdraw`); S.apps.delete(jobId); S.applied.delete(jobId); toast({ title: t("tWithdrawn"), ic: "check" }); renderApplications(); }
  catch (err) { toast({ title: errText(err), ic: "alert" }); busy(btn, false); }
}
