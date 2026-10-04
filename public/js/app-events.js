/* Events: careers days, internship fairs, talent sessions and diaspora evenings.
   Job seekers sign up and get a ticket (a QR code and a short code). Organisers (the Shaghilni team, or a career
   office for its own university) run events, check people in, and get a report afterwards. Companies ask to attend. */
const EV = { teaser: undefined, list: null, one: null, org: null, scan: null };
const EV_KINDS = ["careers_day", "internship_fair", "talent_session", "diaspora"];
function evWhen(e) {
  const d = new Date(e.startsAt), loc = S.lang === "ar" ? "ar-SY" : "en-GB", tz = { timeZone: "Asia/Damascus" };
  return { day: d.toLocaleDateString(loc, { day: "numeric", ...tz }), mon: d.toLocaleDateString(loc, { month: "short", ...tz }),
    full: d.toLocaleString(loc, { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", ...tz }) };
}
const evDate = e => { const w = evWhen(e); return html`<span class="ev-date" aria-hidden="true"><b>${w.day}</b><span>${w.mon}</span></span>`; };
const evUni = k => (UNI[k] ? L(UNI[k]) : "");
/* ---------- job seekers ---------- */
function evTeaserHTML() {
  if (EV.teaser === undefined) { EV.teaser = null; api.get("/api/events").then(r => { EV.teaser = r.events; const el = $("#evTeaser"); if (el) put(el, evTeaserInner()); }).catch(() => {}); }
  return html`<div id="evTeaser">${evTeaserInner()}</div>`;
}
function evTeaserInner() {
  const L2 = EV.teaser || []; if (!L2.length) return "";
  const next = L2[0];
  return html`<section class="card ev-teaser"><h2 class="card-h">${icon("calendar", 18)}<span>${t("evUpcoming")}</span>${L2.length > 1 ? html` <span class="chip-n">${L2.length}</span>` : ""}</h2>
<a class="ev-row" href="#/events/${next.id}">${evDate(next)}<span class="ev-row-t"><b>${L(bi(next.title))}</b><span>${[L(bi(next.place)), next.host].filter(Boolean).join(" · ")}</span></span>${next.mine === "going" ? html`<span class="pill pill--good">${t("evGoing")}</span>` : ""}</a>
<div class="card-act"><button class="btn btn--soft" type="button" data-act="go" data-to="#/events">${t("evSeeAll")}</button></div></section>`;
}
async function renderEvents() {
  const v = $("#view"), id = Number(S.sub[0]) || 0; put(v, page(stateHTML("spin", t("loading"))));
  try {
    if (id) { EV.one = (await api.get(`/api/events/${id}`)).event; put(v, page(evPageHTML(EV.one))); if (EV.one.mine && EV.one.mine.status === "going") drawTicket(EV.one); }
    else { EV.list = (await api.get("/api/events")).events; put(v, page(evListHTML(EV.list))); }
  } catch (err) { put(v, page(stateHTML("alert", err.code === "not_found" ? t("evNotFound") : errText(err)))); }
}
function evListHTML(list) {
  return html`<div class="ev-wrap"><h1 class="lh-title">${t("evTitle")}</h1><p class="lh-sub">${t("evSub")}</p>
${list.length ? html`<ul class="ev-list">${list.map(e => html`<li><a class="card ev-card" href="#/events/${e.id}">${evDate(e)}<span class="ev-row-t"><b>${L(bi(e.title))}</b>
<span>${t("evK_" + e.kind)}${e.host ? " · " + e.host : ""}</span><span>${[L(bi(e.place)), evUni(e.uni)].filter(Boolean).join(" · ")}</span>
<span class="ev-meta">${e.companies ? html`<span class="pill">${t("evCompaniesN", { n: e.companies })}</span>` : ""}${e.mine === "going" ? html`<span class="pill pill--good">${t("evGoing")}</span>` : e.spotsLeft === 0 ? html`<span class="pill">${t("evFull")}</span>` : e.spotsLeft != null ? html`<span class="pill">${t("evSpots", { n: e.spotsLeft })}</span>` : ""}</span></span></a></li>`)}</ul>`
  : html`<p class="empty-p">${t("evNone")}</p>`}</div>`;
}
function evPageHTML(e) {
  const w = evWhen(e), mine = e.mine, isSk = role() === "seeker";
  let act;
  if (!S.user) act = html`<p class="card-p">${t("evSignInP")}</p><div class="card-act"><button class="btn btn--primary" type="button" data-act="go" data-to="#/signin">${t("signIn")}</button></div>`;
  else if (!isSk) act = "";
  else if (!PROFILE) act = html`<p class="card-p">${t("evProfileP")}</p><div class="card-act"><button class="btn btn--primary" type="button" data-act="onb-open">${t("obCreate")}</button></div>`;
  else if (mine && mine.status === "going") act = html`<div class="ticket" id="ticket"><p class="ticket-h">${mine.checkedIn ? html`${icon("check", 18, 2.4)}${t("evCheckedIn")}` : t("evTicketH")}</p>
<img class="ticket-qr" id="evQr" alt="${t("evQrAlt")}" width="220" height="220"><p class="ticket-code num" dir="ltr">${mine.code}</p><p class="ticket-p">${t("evTicketP")}</p></div>
${mine.checkedIn ? "" : html`<div class="card-act"><button class="link link--muted" type="button" data-act="ev-cancel" data-id="${e.id}">${t("evCancel")}</button></div>`}`;
  else if (e.spotsLeft === 0) act = html`<p class="card-p">${t("evFullP")}</p>`;
  else act = html`<div class="card-act"><button class="btn btn--primary btn--lg" type="button" data-act="ev-rsvp" data-id="${e.id}">${icon("check", 16, 2.4)}${t("evAttend")}</button></div>
<p class="note">${icon("info", 15)}<span>${t("evShare")}</span></p>${e.spotsLeft != null ? html`<p class="ev-small">${t("evSpots", { n: e.spotsLeft })}</p>` : ""}`;
  return html`<div class="ev-wrap"><button class="link" type="button" data-act="go" data-to="#/events">${icon("back", 15)}${t("evAll")}</button>
<div class="ev-head">${evDate(e)}<div><h1 class="lh-title">${L(bi(e.title))}</h1><p class="ev-meta-line">${t("evK_" + e.kind)}${e.host ? " · " + t("evWith", { host: e.host }) : ""}</p></div></div>
<dl class="kv"><div class="kv-row"><dt>${t("evWhenL")}</dt><dd>${w.full}</dd></div>${L(bi(e.place)) ? html`<div class="kv-row"><dt>${t("evWhereL")}</dt><dd>${L(bi(e.place))}${e.gov && GOV[e.gov] ? ", " + L(GOV[e.gov]) : ""}</dd></div>` : ""}
${e.uni ? html`<div class="kv-row"><dt>${t("obUni")}</dt><dd>${evUni(e.uni)}</dd></div>` : ""}${e.link ? html`<div class="kv-row"><dt>${t("evLinkL")}</dt><dd><a href="${e.link}" target="_blank" rel="noopener">${e.link}</a></dd></div>` : ""}</dl>
${L(bi(e.about)) ? html`<p class="ev-about">${L(bi(e.about))}</p>` : ""}
<section class="card">${act || ""}</section>
<h2 class="sec-h">${t("evCompaniesH")}</h2>${(e.companies || []).length ? html`<ul class="ev-cos">${e.companies.map(c => html`<li><span class="ev-tile" aria-hidden="true">${c.abbr || String(L(bi(c.name)) || "?").trim().slice(0, 1).toUpperCase()}</span><span>${L(bi(c.name))}</span></li>`)}</ul>` : html`<p class="empty-p">${t("evCompaniesSoon")}</p>`}</div>`;
}
function loadQr() { return window.qrcode ? Promise.resolve() : new Promise((res, rej) => { const s = document.createElement("script"); s.src = "/vendor/qrcode.js"; s.onload = res; s.onerror = rej; document.head.appendChild(s); }); }
function drawTicket(e) {
  loadQr().then(() => { const img = $("#evQr"); if (!img) return; const q = window.qrcode(0, "M"); q.addData(`SHG-EV-${e.id}-${e.mine.code}`); q.make(); img.src = q.createDataURL(6, 2); }).catch(() => { const img = $("#evQr"); if (img) img.remove(); });
}
/* ---------- organisers ---------- */
function evFormHTML(e, pickUni) {
  const d = e || {}, v = (o, k) => (o && o[k]) || "";
  const f = (id, label, val, attrs = "") => html`<div class="field"><label class="lbl" for="${id}">${label}</label><input class="inp" id="${id}" value="${val || ""}"${raw(attrs)}></div>`;
  return html`<section class="card ev-form"><h2 class="card-h">${t(e ? "evEditH" : "evNewH")}</h2>
<div class="grid2">${f("evTitleEn", t("evTitleEn"), v(d.title, "en"), ' dir="ltr" lang="en"')}${f("evTitleAr", t("evTitleAr"), v(d.title, "ar"), ' dir="rtl" lang="ar"')}</div>
<div class="grid2"><div class="field"><label class="lbl" for="evKind">${t("evKindL")}</label><select class="inp" id="evKind">${EV_KINDS.map(k => raw(`<option value="${k}"${d.kind === k ? " selected" : ""}>${esc(t("evK_" + k))}</option>`))}</select></div>
${f("evHost", t("evHostL"), d.host, ' placeholder="' + esc(t("evHostPh")) + '"')}</div>
<div class="grid2">${f("evStart", t("evStartL"), d.startsLocal, ' type="datetime-local"')}${f("evEnd", t("evEndL"), d.endsLocal, ' type="datetime-local"')}</div>
<div class="grid2">${f("evPlaceEn", t("evPlaceEn"), v(d.place, "en"), ' dir="ltr" lang="en"')}${f("evPlaceAr", t("evPlaceAr"), v(d.place, "ar"), ' dir="rtl" lang="ar"')}</div>
<div class="grid2"><div class="field"><label class="lbl" for="evGov">${t("coGovL") || t("obGov")}</label><select class="inp" id="evGov"><option value="">—</option>${GOV_ORDER.filter(k => k !== "remote").map(k => raw(`<option value="${k}"${d.gov === k ? " selected" : ""}>${esc(L(GOV[k]))}</option>`))}</select></div>
${pickUni ? html`<div class="field"><label class="lbl" for="evUni">${t("obUni")}</label><select class="inp" id="evUni"><option value="">${t("evNoUni")}</option>${Object.keys(UNI).map(k => raw(`<option value="${k}"${d.uni === k ? " selected" : ""}>${esc(L(UNI[k]))}</option>`))}</select></div>` : ""}</div>
<div class="grid2">${f("evCap", t("evCapL"), d.capacity || "", ' type="number" min="0" max="5000" inputmode="numeric"')}${f("evLink", t("evLinkL"), d.link, ' type="url" dir="ltr" placeholder="https://"')}</div>
<div class="field" lang="en" dir="ltr"><label class="lbl" for="evAboutEn">${t("evAboutEn")}</label><textarea class="inp" id="evAboutEn" rows="3">${v(d.about, "en")}</textarea></div>
<div class="field" lang="ar" dir="rtl"><label class="lbl" for="evAboutAr">${t("evAboutAr")}</label><textarea class="inp" id="evAboutAr" rows="3">${v(d.about, "ar")}</textarea></div>
${e ? "" : html`<label class="tick"><input type="checkbox" id="evPub" checked><span>${t("evPublishNow")}</span></label>`}
<div class="card-act"><button class="btn btn--primary" type="button" data-act="ev-save" data-id="${e ? e.id : ""}">${t(e ? "evSave" : "evCreate")}</button><button class="link link--muted" type="button" data-act="ev-form-close">${t("cancel")}</button></div></section>`;
}
function orgListHTML(list, pickUni) {
  return html`<div class="ev-org">${EV.form === "new" ? evFormHTML(null, pickUni) : html`<div class="card-act" style="margin:0 0 12px"><button class="btn btn--primary" type="button" data-act="ev-new">${icon("plus", 15)}${t("evNewH")}</button></div>`}
${list.length ? html`<ul class="alist">${list.map(e => html`<li class="acard"><span class="acard-main"><span class="acard-t">${L(bi(e.title))}</span><span class="acard-s">${evWhen(e).full}${e.uni ? " · " + evUni(e.uni) : ""}</span>
<span class="acard-meta"><span class="pill ${e.status === "published" ? "pill--good" : ""}">${t("evS_" + e.status)}</span><span class="pill">${t("evGoingN", { n: e.going })}</span>${e.checkedIn ? html`<span class="pill">${t("evInN", { n: e.checkedIn })}</span>` : ""}${e.requests ? html`<span class="pill pill--warn">${t("evReqN", { n: e.requests })}</span>` : ""}</span></span>
<span class="acard-act"><button class="btn btn--soft btn--sm" type="button" data-act="go" data-to="#/organize/${e.id}">${t("evManage")}</button></span></li>`)}</ul>` : html`<p class="empty-p">${t("evNoneOrg")}</p>`}</div>`;
}
async function drawEventsAdmin() { const b = $("#admBody"); const D = await api.get("/api/organize/events"); EV.orgList = D.events; put(b, orgListHTML(D.events, true)); }
async function renderOrganize() {
  const v = $("#view"), id = Number(S.sub[0]) || 0; put(v, page(stateHTML("spin", t("loading"))));
  try { const [D, R] = await Promise.all([api.get(`/api/organize/events/${id}`), api.get(`/api/organize/events/${id}/report`)]); EV.org = { ...D, report: R }; put(v, page(orgPageHTML())); }
  catch (err) { put(v, page(stateHTML("alert", errText(err)))); }
}
function orgPageHTML() {
  const O = EV.org, e = O.event, R = O.report, admin = role() === "admin";
  const req = e.companies.filter(c => c.status === "requested"), conf = e.companies.filter(c => c.status === "confirmed");
  const m = (k, n) => html`<div class="metric"><span class="metric-n num">${fmt(n)}</span><span class="metric-k">${t(k)}</span></div>`;
  const tally = (rows, name) => rows.length ? html`<ul class="pt-list">${rows.map(x => html`<li><span>${name(x.key) || t("evUnknown")}</span><b class="num">${fmt(x.n)}</b></li>`)}</ul>` : html`<p class="empty-p">—</p>`;
  return html`<div class="ev-wrap ev-org"><button class="link" type="button" data-act="go" data-to="${admin ? "#/admin/events" : "#/campus/events"}">${icon("back", 15)}${t("evAll")}</button>
<div class="ev-head">${evDate(e)}<div><h1 class="lh-title">${L(bi(e.title))}</h1><p class="ev-meta-line">${t("evK_" + e.kind)}${e.host ? " · " + t("evWith", { host: e.host }) : ""} <span class="pill ${e.status === "published" ? "pill--good" : ""}">${t("evS_" + e.status)}</span></p></div></div>
<div class="card-act">${e.status !== "published" ? html`<button class="btn btn--primary" type="button" data-act="ev-status" data-s="published">${t("evPublish")}</button>` : html`<a class="btn btn--soft" href="#/events/${e.id}">${t("evViewPublic")}</a>`}
<button class="btn btn--ghost" type="button" data-act="ev-edit">${icon("pencil", 15)}${t("evEdit")}</button>${e.status !== "cancelled" ? html`<button class="link link--muted" type="button" data-act="ev-status" data-s="cancelled">${t("evCancelEvent")}</button>` : ""}</div>
${EV.form === "edit" ? evFormHTML(e, admin) : ""}
<section class="card ev-check"><h2 class="card-h">${icon("check", 18)}<span>${t("evCheckH")}</span></h2><p class="card-p">${t("evCheckP")}</p>
<div class="bill-form"><input class="inp" id="ckCode" dir="ltr" autocomplete="off" autocapitalize="characters" maxlength="40" placeholder="${t("evCodePh")}" aria-label="${t("evCodeL")}"><button class="btn btn--primary" type="button" data-act="ev-checkin">${t("evCheckBtn")}</button>
${"BarcodeDetector" in window ? html`<button class="btn btn--soft" type="button" data-act="ev-scan">${icon("camera", 15)}${t("evScan")}</button>` : ""}</div>
<video id="ckVideo" class="ck-video" playsinline muted hidden></video><div id="ckRes" role="status" aria-live="polite"></div></section>
<section class="card"><h2 class="card-h">${t("evReportH")}</h2><div class="metrics">${m("evRegistered", R.totals.registered)}${m("evCameN", R.totals.checkedIn)}${m("evCancelledN", R.totals.cancelled)}</div>
<div class="grid2"><div><h3 class="ck-h">${t("evByUni")}</h3>${tally(R.byUni, k => evUni(k))}</div><div><h3 class="ck-h">${t("evByFac")}</h3>${tally(R.byFac, k => (FAC[k] ? L(FAC[k]) : ""))}</div></div>
${R.companies.length ? html`<h3 class="ck-h">${t("evAfterH")}</h3><div class="tscroll"><table class="tbl"><thead><tr><th>${t("evCompany")}</th><th>${t("evInvites")}</th><th>${t("cpApps")}</th><th>${t("cpInterviews")}</th><th>${t("anHired")}</th></tr></thead>
<tbody>${R.companies.map(c => html`<tr><td>${L(bi(c.name))}</td><td class="num">${fmt(c.invites)}</td><td class="num">${fmt(c.applications)}</td><td class="num">${fmt(c.interviews)}</td><td class="num">${fmt(c.hires)}</td></tr>`)}</tbody></table></div>` : ""}
<p class="note">${t("evReportNote")}</p><div class="card-act"><button class="btn btn--soft" type="button" data-act="ev-report-csv">${icon("doc", 15)}${t("evReportCsv")}</button></div></section>
<section class="card"><h2 class="card-h">${t("evCompaniesH")}</h2>
${req.length ? html`<h3 class="ck-h">${t("evRequests")}</h3><ul class="alist">${req.map(c => html`<li class="acard"><span class="acard-main"><span class="acard-t">${L(bi(c.name))}</span></span><span class="acard-act"><button class="btn btn--primary btn--sm" type="button" data-act="ev-co" data-co="${c.id}" data-s="confirmed">${t("cpApprove")}</button><button class="link link--muted" type="button" data-act="ev-co" data-co="${c.id}" data-s="declined">${t("cpDecline")}</button></span></li>`)}</ul>` : ""}
${conf.length ? html`<ul class="alist">${conf.map(c => html`<li class="acard"><span class="acard-main"><span class="acard-t">${L(bi(c.name))}</span><span class="acard-s">${t("evConfirmed")}</span></span><span class="acard-act"><button class="link link--muted" type="button" data-act="ev-co" data-co="${c.id}" data-s="removed">${t("tmRemove")}</button></span></li>`)}</ul>` : html`<p class="empty-p">${t("evNoCompanies")}</p>`}
${admin && O.verified.length ? html`<div class="bill-form"><select class="inp inp--sm" id="evAddCo" aria-label="${t("evAddCo")}"><option value="">${t("evAddCo")}</option>${O.verified.filter(c => !e.companies.some(x => x.id === c.id)).map(c => raw(`<option value="${c.id}">${esc(L(bi(c.name)) || "—")}</option>`))}</select><button class="btn btn--soft btn--sm" type="button" data-act="ev-co-add">${t("blAdd")}</button></div>` : ""}</section>
<section class="card"><h2 class="card-h">${t("evPeopleH", { n: O.people.filter(p => p.status === "going").length })}</h2>${O.people.length ? html`<div class="tscroll"><table class="tbl"><thead><tr><th>${t("cpName")}</th><th>${t("obUni")}</th><th>${t("obFac")}</th><th>${t("evCodeL")}</th><th>${t("evInL")}</th></tr></thead>
<tbody>${O.people.map(p => html`<tr${p.status !== "going" ? raw(' class="is-off"') : ""}><td dir="auto">${L(p.name) || "—"}</td><td>${evUni(p.uni) || "—"}</td><td>${FAC[p.fac] ? L(FAC[p.fac]) : "—"}</td><td class="num" dir="ltr">${p.code}</td><td>${p.status !== "going" ? t("evCancelledShort") : p.checkedIn ? html`<span class="ck-yes" title="${t("evInL")}">${icon("check", 16, 2.4)}<span class="sr-only">${t("evInL")}</span></span>` : ""}</td></tr>`)}</tbody></table></div>` : html`<p class="empty-p">${t("evNoPeople")}</p>`}</section></div>`;
}
function evFormValues() {
  const g = id => { const el = $("#" + id); return el ? el.value : ""; };
  return { title: { en: g("evTitleEn"), ar: g("evTitleAr") }, kind: g("evKind"), host: g("evHost"), startsLocal: g("evStart"), endsLocal: g("evEnd"), place: { en: g("evPlaceEn"), ar: g("evPlaceAr") },
    gov: g("evGov"), uni: g("evUni"), capacity: Number(g("evCap")) || 0, link: g("evLink"), about: { en: g("evAboutEn"), ar: g("evAboutAr") } };
}
async function redrawOrgList() { if (role() === "admin") await drawEventsAdmin(); else await renderCampus(); }
function stopScan() { if (EV.scan) { EV.scan.stop = true; (EV.scan.stream && EV.scan.stream.getTracks() || []).forEach(x => x.stop()); EV.scan = null; } const v = $("#ckVideo"); if (v) v.hidden = true; }
async function doCheckin(code) {
  const res = $("#ckRes"); if (!code) return;
  try { const r = await api.post(`/api/organize/events/${EV.org.event.id}/checkin`, { code }); const who = L(r.person.name) || "—";
    const msg = html`<p class="ck-ok ${r.already ? "ck-again" : ""}">${icon("check", 18, 2.4)}<span><b>${who}</b> · ${[evUni(r.person.uni), FAC[r.person.fac] ? L(FAC[r.person.fac]) : ""].filter(Boolean).join(" · ")}<br>${t(r.already ? "evAlready" : "evDone")}</span></p>`;
    // Refresh the counts and the list straight away, then get ready for the next person.
    try { const id = EV.org.event.id, [D, R] = await Promise.all([api.get(`/api/organize/events/${id}`), api.get(`/api/organize/events/${id}/report`)]); EV.org = { ...D, report: R }; put($("#view"), page(orgPageHTML())); } catch (e) { /* keep the page as it is */ }
    const res2 = $("#ckRes"); if (res2) put(res2, msg);
    const c = $("#ckCode"); if (c) { c.value = ""; c.focus(); }
  } catch (err) { if (res) put(res, html`<p class="err">${errText(err)}</p>`); }
}
async function eventsAct(act, el) {
  const id = el.dataset.id;
  try {
    switch (act) {
      case "ev-rsvp": { const r = await api.post(`/api/events/${id}/rsvp`); toast({ title: t("tEvGoing", { code: r.rsvp.code }), ic: "check" }); await renderEvents(); break; }
      case "ev-cancel": await api.del(`/api/events/${id}/rsvp`); toast({ title: t("tEvCancelled"), ic: "check" }); await renderEvents(); break;
      case "ev-new": EV.form = "new"; await redrawOrgList(); { const f = $("#evTitleEn"); if (f) f.focus(); } break;
      case "ev-edit": EV.form = "edit"; put($("#view"), page(orgPageHTML())); break;
      case "ev-form-close": EV.form = null; if (S.view === "organize") put($("#view"), page(orgPageHTML())); else await redrawOrgList(); break;
      case "ev-save": {
        const body = { event: evFormValues() };
        if (id) { await api.put(`/api/organize/events/${id}`, { ...body, status: EV.org.event.status }); EV.form = null; toast({ title: t("tEvSaved"), ic: "check" }); await renderOrganize(); }
        else { const r = await api.post("/api/organize/events", { ...body, publish: !!($("#evPub") && $("#evPub").checked) }); EV.form = null; toast({ title: t("tEvCreated"), ic: "check" }); go(`#/organize/${r.event.id}`); }
        break; }
      case "ev-status": await api.put(`/api/organize/events/${EV.org.event.id}`, { event: { ...EV.org.event }, status: el.dataset.s }); toast({ title: t("tEvSaved"), ic: "check" }); await renderOrganize(); break;
      case "ev-co": await api.post(`/api/organize/events/${EV.org.event.id}/companies`, { companyId: Number(el.dataset.co), status: el.dataset.s }); await renderOrganize(); break;
      case "ev-co-add": { const c = $("#evAddCo"); if (!c || !c.value) return; await api.post(`/api/organize/events/${EV.org.event.id}/companies`, { companyId: Number(c.value), status: "confirmed" }); await renderOrganize(); break; }
      case "ev-checkin": await doCheckin((($("#ckCode") || {}).value || "").trim()); break;
      case "ev-scan": {
        if (EV.scan) { stopScan(); break; }
        const v = $("#ckVideo"), det = new window.BarcodeDetector({ formats: ["qr_code"] });
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } }); EV.scan = { stream, stop: false }; v.srcObject = stream; v.hidden = false; await v.play();
        const loop = async () => { if (!EV.scan || EV.scan.stop) return; try { const codes = await det.detect(v); if (codes.length) { const c = codes[0].rawValue; stopScan(); await doCheckin(c); return; } } catch (e) { /* keep trying */ } setTimeout(loop, 300); };
        loop(); break; }
      case "ev-report-csv": { const R = EV.org.report, rows = [{ what: "registered", n: R.totals.registered }, { what: "checked in", n: R.totals.checkedIn }, { what: "cancelled", n: R.totals.cancelled },
          ...R.byUni.map(x => ({ what: "university: " + (x.key || "unknown"), n: x.n })), ...R.byFac.map(x => ({ what: "faculty: " + (x.key || "unknown"), n: x.n })),
          ...R.companies.map(c => ({ what: "company: " + ((c.name && (c.name.en || c.name.ar)) || ""), n: `${c.invites} invitations, ${c.applications} applications, ${c.interviews} interviews, ${c.hires} hires` }))];
        downloadCSV(`shaghilni-event-${EV.org.event.id}-report.csv`, rows); break; }
      case "ev-attend": await api.post(`/api/employer/events/${id}/attend`); toast({ title: t("tEvAsked"), ic: "check" }); EV.emp = null; fillEmpEvents(); break;
      case "ev-whos": RC.find = { event: String(id) }; RC.results = null; go("#/company/students"); break;
    }
  } catch (err) { toast({ title: errText(err), ic: "alert" }); }
}
/* ---------- companies: the events card on the dashboard ---------- */
function empEventsHTML() { return html`<section class="card" id="empEvents"><h2 class="card-h">${icon("calendar", 18)}<span>${t("evTitle")}</span></h2><p class="card-p">${t("evEmpP")}</p><div id="empEvList">${empEvList()}</div></section>`; }
function empEvList() {
  if (!EV.emp) return html`<p class="note">${t("loading")}</p>`;
  if (!EV.emp.length) return html`<p class="empty-p">${t("evNone")}</p>`;
  return html`<ul class="alist">${EV.emp.slice(0, 5).map(e => html`<li class="acard"><span class="acard-main"><span class="acard-t">${L(bi(e.title))}</span><span class="acard-s">${evWhen(e).full}${e.host ? " · " + e.host : ""}</span></span>
<span class="acard-act">${e.mine === "confirmed" ? html`<button class="btn btn--primary btn--sm" type="button" data-act="ev-whos" data-id="${e.id}">${t("evWhos")}</button>` : e.mine === "requested" ? html`<span class="pill pill--warn">${t("cpP_requested")}</span>` : e.mine === "declined" ? html`<span class="pill">${t("cpP_declined")}</span>` : canDo("hire") ? html`<button class="btn btn--soft btn--sm" type="button" data-act="ev-attend" data-id="${e.id}">${t("evAskAttend")}</button>` : ""}</span></li>`)}</ul>`;
}
function fillEmpEvents() {
  const draw = () => { const el = $("#empEvList"); if (el) put(el, empEvList()); };
  if (EV.emp) { draw(); return; }
  api.get("/api/employer/events").then(r => { EV.emp = r.events; draw(); }).catch(() => { EV.emp = []; draw(); });
}
