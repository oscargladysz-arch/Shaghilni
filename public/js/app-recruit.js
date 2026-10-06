/* ---------- recruiters and students ----------
   Students, and only students, choose whether checked employers may find them, and answer invitations to
   apply for a job or to attend an event. Employers with a checked company search those students and invite
   them. Employers see a short card; a student's number is shared only when they apply or say yes to an event. */
const RC = { list: null, arm: 0, find: { stage: "", level: "", fac: "", uni: "", gov: "", year: "", q: "" }, results: null, sent: null, inv: null };

function rcDate(iso) {
  const [y, m, d] = String(iso || "").split("-").map(Number);
  return y && m && d ? `${d} ${MONTHS[S.lang][m - 1]} ${y}` : "";
}
const rcCo = c => L(bi(c && c.name));
const rcIni = name => String(name || "?").split(/\s+/).filter(Boolean).map(w => w[0]).join("").slice(0, 2);
const rcToday = () => new Date().toISOString().slice(0, 10);

/* ----- students ----- */
async function renderRecruiters() {
  const v = $("#view");
  if (S.user && role() !== "seeker") { go("#/"); return; }
  if (!S.user || !S.me) {
    put(v, page(stateHTML("users", t("rcTitle"), t(S.user ? "rcNeedProfile" : "err_login_required"), html`<button class="btn btn--primary" type="button" data-act="${S.user ? "rc-profile" : "signin"}">${t(S.user ? "obCreate" : "signIn")}</button>`)));
    return;
  }
  put(v, page(recruitersHTML(RC.list)));
  try { RC.list = (await api.get("/api/me/invitations")).invitations; }
  catch (err) {
    const box = $("#rcList");
    if (box) put(box, stateHTML("alert", errText(err), "", html`<button class="btn btn--soft" type="button" data-act="view" data-view="recruiters">${t("retry")}</button>`));
    return;
  }
  if (S.view !== "recruiters") return;
  if (S.invitesNew) { S.invitesNew = 0; renderChrome(); }
  put(v, page(recruitersHTML(RC.list)));
}
function recruitersHTML(list) {
  const open = !!(S.me && S.me.recruit && S.me.recruit.open);
  return html`<h1 class="lh-title">${t("rcTitle")}</h1><p class="lh-sub">${t("rcSub")}</p>${evTeaserHTML()}
<section class="card"><button class="rc-switch" type="button" role="switch" aria-checked="${open ? "true" : "false"}" data-act="rc-open">
<span class="rc-sw-txt"><b>${t("rcOpenL")}</b><span class="card-p">${t("rcOpenP")}</span></span><span class="rc-track" aria-hidden="true"></span></button></section>
<h2 class="sec-h rc-sec">${t("rcInvH")}</h2>
<div id="rcList">${list === null ? stateHTML("spin", t("loading"))
    : !list.length ? stateHTML("users", t(open ? "rcEmptyH" : "rcOffH"), t(open ? "rcEmptyP" : "rcOffP"))
    : html`<ul class="alist">${list.map(invCard)}</ul>`}</div>`;
}
function invCard(i) {
  const co = rcCo(i.company), job = i.kind === "job", ev = i.event || {}, open = i.status === "new" || i.status === "seen";
  const title = job ? (i.job ? L(bi(i.job.title)) : t("rcJobGone")) : ev.title;
  const where = job ? (i.job && i.job.gov && GOV[i.job.gov] ? L(GOV[i.job.gov]) : "") : [rcDate(ev.date), ev.place].filter(Boolean).join(sep());
  let act = "";
  if (RC.arm === i.id) {
    act = html`<span class="rc-confirm"><span>${t("rcBlockQ", { co })}</span><span class="rc-confirm-b"><button class="btn btn--primary" type="button" data-act="rc-block" data-id="${i.id}">${t("rcBlockYes")}</button><button class="btn btn--ghost" type="button" data-act="rc-arm" data-id="0">${t("rcCancel")}</button></span></span>`;
  } else if (open) {
    act = html`${job
      ? (i.job && i.job.open ? html`<button class="btn btn--primary" type="button" data-act="rc-apply" data-id="${i.id}" data-job="${i.job.id}">${t("rcApply")}</button>` : html`<span class="acard-s">${t("rcJobClosed")}</span>`)
      : html`<button class="btn btn--primary" type="button" data-act="rc-yes" data-id="${i.id}">${t("rcYes")}</button>`}
<button class="btn btn--ghost" type="button" data-act="rc-no" data-id="${i.id}">${t(job ? "rcNo" : "rcNoEvent")}</button>
<button class="link rc-blocklink" type="button" data-act="rc-arm" data-id="${i.id}">${t("rcBlock")}</button>`;
  } else if (job && i.status === "accepted" && i.job && i.job.open) {
    act = html`<button class="btn btn--ghost" type="button" data-act="go" data-to="#/job/${i.job.id}">${t("viewJob")}</button>`;
  }
  const said = i.status === "accepted" ? html`<span class="pill pill--good">${t(job ? "rcSaidYesJob" : "rcSaidYesEvent")}</span>` : i.status === "declined" ? html`<span class="pill">${t("rcSaidNo")}</span>` : "";
  return html`<li class="acard rc-card">
<span class="logo" style="--tile:${SECTOR[i.company.sector] || "#475569"}" aria-hidden="true">${i.company.abbr || ""}</span>
<span class="acard-main"><span class="rc-kind">${icon(job ? "brief" : "clock", 13)}<span>${t(job ? "rcKindJob" : "rcKindEvent")}</span>${i.status === "new" ? html`<span class="pill pill--good">${t("rcNew")}</span>` : ""}</span>
<span class="acard-t" dir="auto">${title}</span>
<span class="acard-s">${co}${i.company.verified ? html`<span class="rc-ver" role="img" aria-label="${t("rcVerified")}">${iconF("verified", 13)}</span>` : ""}${where ? sep() + where : ""}</span>
${i.message ? html`<span class="rc-msg" dir="auto">${i.message}</span>` : ""}
${!job && ev.link ? html`<span class="acard-s">${t("evLinkL")}: <a href="${ev.link}" target="_blank" rel="noopener nofollow ugc" dir="ltr">${ev.link}</a></span>` : ""}
${!job && i.status === "accepted" ? html`<span class="acard-s">${t("rcAttendNote", { co })}</span>` : ""}
<span class="acard-meta">${said}<span>${t("rcSentOn", { when: dayLabel(i.createdAt) })}</span></span></span>
<span class="acard-act">${act}</span></li>`;
}

/* ----- employers ----- */
async function renderStudents(tab) {
  const v = $("#view"), c = S.emp && S.emp.company;
  if (!c || c.status !== "verified") { put(v, page(html`${backLink("#/company", "navCompany")}${stateHTML("cap", t("rcFindTitle"), t("rcNeedVerified"))}`)); return; }
  put(v, page(studentsHTML(tab)));
  if (tab === "sent") await loadSent(); else await runSearch();
}
function studentsHTML(tab) {
  const f = RC.find;
  const sel = (id, key, all, opts) => html`<label class="field rc-f"><span class="lbl">${t(key)}</span><select class="inp" id="${id}">${[["", t(all)], ...opts].map(([k, l]) => html`<option value="${k}"${String(f[id.slice(2).toLowerCase()]) === String(k) ? raw(" selected") : ""}>${l}</option>`)}</select></label>`;
  const tabBtn = (to, key, on) => html`<button class="seg2-btn" type="button" data-act="go" data-to="${to}" aria-pressed="${on ? "true" : "false"}">${t(key)}</button>`;
  return html`${backLink("#/company", "navCompany")}<h1 class="lh-title">${t("rcFindTitle")}</h1><p class="lh-sub">${t("rcFindSub")}</p>
<div class="seg2 rc-tabs" role="group" aria-label="${t("rcFindTitle")}">${tabBtn("#/company/students", "rcTabFind", tab !== "sent")}${tabBtn("#/company/students/sent", "rcTabSent", tab === "sent")}</div>
${tab === "sent" ? "" : html`<div class="rc-filters">
${sel("rcStage", "rcStageL", "rcStageAll", [["student", t("rcStageStudent")], ["grad", t("rcStageGrad")]])}
${sel("rcLevel", "rcLevelL", "rcAnyLevel", ["none", "lt1", "y1to3", "y4plus"].map(k => [k, t("lvl_" + k)]))}
${sel("rcFac", "rcFacL", "rcAnyFac", Object.keys(FAC).map(k => [k, L(FAC[k])]))}
${sel("rcUni", "rcUniL", "rcAnyUni", Object.keys(UNI).map(k => [k, L(UNI[k])]))}
${sel("rcGov", "rcGovL", "rcAnyGov", [...GOV_ORDER.filter(k => k !== "remote").map(k => [k, L(GOV[k])]), ["abroad", t("outsideSyria")]])}
${sel("rcYear", "rcYearL", "rcAnyYear", [1, 2, 3, 4, 5, 6].map(n => [n, t("rcYearN", { n })]))}<label class="tick rc-f"><input type="checkbox" id="rcVer"${RC.find && RC.find.verified ? raw(" checked") : ""}><span>${t("rcVerOnly")}</span></label>
<label class="field rc-f rc-q"><span class="lbl">${t("rcQL")}</span><input class="inp" id="rcQ" type="search" enterkeyhint="search" autocomplete="off" value="${f.q}" placeholder="${t("rcQPh")}"></label>
<button class="btn btn--primary rc-go" type="button" data-act="rc-search">${icon("search", 15)}${t("rcSearch")}</button></div>`}
<div id="rcOut">${stateHTML("spin", t("loading"))}</div>`;
}
async function runSearch() {
  const out = $("#rcOut"); if (!out) return;
  const qs = new URLSearchParams(Object.entries(RC.find).filter(([, v]) => v !== "" && v != null)).toString();
  try { RC.results = (await api.get("/api/employer/students" + (qs ? "?" + qs : ""))).students; }
  catch (err) { const o = $("#rcOut"); if (o) put(o, stateHTML("alert", errText(err))); return; }
  drawResults();
}
function drawResults() {
  const out = $("#rcOut"); if (!out || !RC.results) return;
  if (!RC.results.length) { put(out, stateHTML("users", t("rcNoResultsH"), t("rcNoResultsP"))); return; }
  put(out, html`<p class="rc-count">${t("rcResults", { n: RC.results.length })}</p><ul class="alist">${RC.results.map(studentCard)}</ul>`);
}
function studentLine(s) {
  return [s.status && s.status !== "student" ? t("edu_" + s.status) : "", s.uni === "other" ? s.uniName : s.uni && UNI[s.uni] ? L(UNI[s.uni]) : "", s.fac && FAC[s.fac] ? L(FAC[s.fac]) : "",
    s.status === "student" && s.year ? t("rcYearN", { n: s.year }) : s.grad ? String(s.grad) : ""].filter(Boolean).join(sep());
}
function studentCard(s) {
  const name = L(s.name) || "—", inv = s.invites.filter(x => x.status !== "withdrawn");
  const langs = (s.langs || []).map(k => (LANGS[k] ? L(LANGS[k]) : k)).join(sep());
  return html`<li class="acard rc-card"><span class="rc-ava" aria-hidden="true">${rcIni(name)}</span>
<span class="acard-main"><span class="acard-t" dir="auto">${name}${s.verifiedUni ? html` <span class="sv-badge">${icon("shield", 12)}${t("svBadge", { uni: UNI[s.verifiedUni] ? L(UNI[s.verifiedUni]) : s.verifiedUni })}</span>` : ""}</span><span class="acard-s">${studentLine(s)}</span>
<span class="acard-s">${[s.gov ? L(placeOf(s)) : "", s.level ? t("rcLevelL") + ": " + t("lvl_" + s.level) : "", langs].filter(Boolean).join(sep())}</span>
${(s.roles || []).length ? html`<span class="acard-s" dir="auto">${s.roles.join(sep())}</span>` : ""}
${s.skills.length ? html`<span class="rc-chips">${s.skills.map(k => html`<span class="rc-chip" dir="auto">${k}</span>`)}</span>` : ""}
${inv.length ? html`<span class="acard-meta"><span class="pill pill--good">${t("rcInvitedN", { n: inv.length })}</span></span>` : ""}</span>
<span class="acard-act"><button class="btn btn--primary" type="button" data-act="rc-invite" data-id="${s.id}">${icon("send", 15)}${t("rcInvite")}</button></span></li>`;
}
function readInv() {
  const I = RC.inv; if (!I) return;
  const val = id => { const el = $("#" + id); return el ? el.value : undefined; };
  for (const [k, id] of [["job", "rcJob"], ["title", "rcEvTitle"], ["date", "rcEvDate"], ["place", "rcEvPlace"], ["link", "rcEvLink"], ["msg", "rcMsg"]]) {
    const v = val(id); if (v !== undefined) I.vals[k] = v;
  }
}
function inviteBody() {
  const I = RC.inv, jobs = ((S.emp && S.emp.jobs) || []).filter(j => j.status === "published"), e = I.errors || {}, V = I.vals;
  const bad = k => (e[k] ? raw(` aria-invalid="true" aria-describedby="rcErr-${k}"`) : "");
  const err = k => (e[k] ? html`<p class="err" id="rcErr-${k}">${t("rcErr_" + k)}</p>` : "");
  const kindBtn = (k, key) => html`<button class="seg2-btn" type="button" data-act="rc-kind" data-k="${k}" aria-pressed="${I.kind === k ? "true" : "false"}">${t(key)}</button>`;
  return html`<div class="field"><span class="lbl" id="rcKindL">${t("rcKindL")}</span><div class="seg2" role="group" aria-labelledby="rcKindL">${kindBtn("job", "rcKJob")}${kindBtn("event", "rcKEvent")}</div></div>
${I.kind === "job"
    ? (jobs.length ? html`<label class="field"><span class="lbl">${t("rcJobL")}</span><select class="inp" id="rcJob">${jobs.map(j => html`<option value="${j.id}"${String(V.job) === String(j.id) ? raw(" selected") : ""}>${L(bi(j.title))}</option>`)}</select></label>`
      : html`<p class="note">${icon("info", 15)}<span>${t("rcNoJobs")}</span></p>`)
    : html`<label class="field"><span class="lbl">${t("rcEvTitleL")}</span><input class="inp" id="rcEvTitle" maxlength="120" value="${V.title || ""}" placeholder="${t("rcEvTitlePh")}"${bad("title")}>${err("title")}</label>
<label class="field"><span class="lbl">${t("rcEvDateL")}</span><input class="inp" id="rcEvDate" type="date" min="${rcToday()}" value="${V.date || ""}"${bad("date")}>${err("date")}</label>
<label class="field"><span class="lbl">${t("rcEvPlaceL")}</span><input class="inp" id="rcEvPlace" maxlength="160" value="${V.place || ""}" placeholder="${t("rcEvPlacePh")}"${bad("place")}>${err("place")}</label>
<label class="field"><span class="lbl">${t("rcEvLinkL")}</span><input class="inp" id="rcEvLink" type="url" inputmode="url" dir="ltr" maxlength="300" value="${V.link || ""}" placeholder="https://"${bad("link")}>${err("link")}</label>`}
<label class="field"><span class="lbl">${t("rcMsgL")}</span><textarea class="inp" id="rcMsg" rows="3" maxlength="600" dir="auto" placeholder="${t("rcMsgPh")}">${V.msg || ""}</textarea></label>
<p class="fine">${t("rcMsgHint")}</p>${I.msg ? html`<p class="err" role="alert">${I.msg}</p>` : ""}`;
}
function openInvite(sid) {
  const s = (RC.results || []).find(x => x.id === sid); if (!s) return;
  const hasJobs = ((S.emp && S.emp.jobs) || []).some(j => j.status === "published");
  RC.inv = { sid, name: L(s.name), kind: hasJobs ? "job" : "event", errors: {}, msg: "", vals: {} };
  layerOpen(html`${panelHead("rcInvTitle", RC.inv.name)}<div class="p-body scroll" id="rcInvBody">${inviteBody()}</div>
<div class="p-foot"><button class="btn btn--primary rc-send" type="button" data-act="rc-send">${icon("send", 15)}${t("rcSend")}</button></div>`, { label: t("rcInvTitle") });
  syncSend();
}
function syncSend() {
  const b = $('[data-act="rc-send"]'), I = RC.inv; if (!b || !I) return;
  const none = I.kind === "job" && !((S.emp && S.emp.jobs) || []).some(j => j.status === "published");
  b.disabled = none;
}
function redrawInvite(focusSel) {
  const box = $("#rcInvBody"); if (!box) return;
  put(box, inviteBody()); syncSend();
  const f = focusSel ? $(focusSel) : box.querySelector('[aria-invalid="true"]') || box.querySelector('[role="alert"]');
  if (f && f.focus) f.focus();
}
async function sendInvite(btn) {
  const I = RC.inv; if (!I) return;
  readInv();
  const body = { kind: I.kind, message: I.vals.msg || "" };
  if (I.kind === "job") body.jobId = Number(I.vals.job || (($("#rcJob") || {}).value));
  else body.event = { title: I.vals.title || "", date: I.vals.date || "", place: I.vals.place || "", link: I.vals.link || "" };
  busy(btn, true);
  try {
    await api.post(`/api/employer/students/${I.sid}/invite`, body);
    const s = (RC.results || []).find(x => x.id === I.sid);
    if (s) s.invites.push({ kind: I.kind, jobId: body.jobId || null, status: "sent" });
    const name = I.name; RC.inv = null;
    layerClose();
    toast({ title: t("tRcSent", { name }), ic: "check" });
    drawResults();
  } catch (err) {
    busy(btn, false);
    I.errors = err.code === "invalid_event" && err.detail && typeof err.detail === "object" ? err.detail : {};
    I.msg = err.code === "invalid_event" ? "" : errText(err);
    redrawInvite();
  }
}
async function loadSent() {
  try { RC.sent = (await api.get("/api/employer/invitations")).invitations; }
  catch (err) { const o = $("#rcOut"); if (o) put(o, stateHTML("alert", errText(err))); return; }
  drawSent();
}
function drawSent() {
  const out = $("#rcOut"); if (!out || !RC.sent) return;
  if (!RC.sent.length) { put(out, stateHTML("send", t("rcSentEmptyH"), t("rcSentEmptyP"), html`<button class="btn btn--soft" type="button" data-act="go" data-to="#/company/students">${t("rcTabFind")}</button>`)); return; }
  put(out, html`<ul class="alist">${RC.sent.map(i => {
    const st = i.status === "accepted" ? (i.kind === "job" ? "accepted_job" : "accepted_event") : i.status;
    const s = i.student, name = L(s.name) || "—";
    const what = i.kind === "job" ? (i.job ? L(bi(i.job.title)) : "—") : [i.event && i.event.title, i.event && rcDate(i.event.date)].filter(Boolean).join(sep());
    return html`<li class="acard rc-card"><span class="rc-ava" aria-hidden="true">${rcIni(name)}</span>
<span class="acard-main"><span class="acard-t" dir="auto">${name}</span><span class="acard-s">${studentLine(s)}</span>
<span class="acard-s rc-what">${icon(i.kind === "job" ? "brief" : "clock", 13)}<span dir="auto">${what}</span></span>
${s.phone ? html`<span class="acard-s">${t("rcPhone")}: <a href="tel:${s.phone}" dir="ltr">${phoneLabel(s.phone)}</a></span>` : ""}
<span class="acard-meta"><span class="pill${st.startsWith("accepted") ? " pill--good" : ""}">${t("rcSt_" + st)}</span><span>${t("rcSentOn", { when: dayLabel(i.createdAt) })}</span></span></span>
<span class="acard-act">${i.status === "sent" || i.status === "seen" ? html`<button class="btn btn--ghost" type="button" data-act="rc-withdraw" data-id="${i.id}">${t("rcWithdraw")}</button>` : ""}</span></li>`;
  })}</ul>`);
}

/* ----- actions ----- */
async function recruitAct(act, el) {
  const id = Number(el.dataset.id), inv = RC.list && RC.list.find(x => x.id === id);
  const redraw = () => { if (S.view === "recruiters") put($("#view"), page(recruitersHTML(RC.list))); };
  switch (act) {
    case "rc-open": {
      const want = !(S.me && S.me.recruit && S.me.recruit.open);
      busy(el, true);
      try { const r = await api.put("/api/me/recruit", { open: want }); S.me.recruit = { open: r.open }; toast({ title: t(r.open ? "tRcOn" : "tRcOff"), ic: "check" }); }
      catch (err) { toast({ title: errText(err), ic: "alert" }); }
      redraw(); const sw = $(".rc-switch"); if (sw) sw.focus();
      return;
    }
    case "rc-arm": { RC.arm = id; redraw(); const b = id ? $(`[data-act="rc-block"][data-id="${id}"]`) : null; if (b) b.focus(); return; }
    case "rc-yes": case "rc-no": case "rc-apply": {
      busy(el, true);
      try {
        const r = await api.post(`/api/me/invitations/${id}/respond`, { answer: act === "rc-no" ? "no" : "yes" });
        if (inv) inv.status = r.invitation.status;
      } catch (err) { busy(el, false); toast({ title: errText(err), ic: "alert" }); return; }
      if (act === "rc-apply") {
        const jid = Number(el.dataset.job);
        let j = JOB.get(jid);
        if (!j) { await ensureJob(jid); j = JOB.get(jid); }
        redraw();
        if (j) { openApply(j); return; }
      }
      toast({ title: t(act === "rc-no" ? "tRcNo" : "tRcYes", { co: inv ? rcCo(inv.company) : "" }), ic: "check" });
      redraw();
      return;
    }
    case "rc-block": {
      busy(el, true);
      try {
        await api.post(`/api/me/invitations/${id}/block`);
        const cid = inv && inv.company.id;
        for (const x of RC.list || []) if (x.company.id === cid && (x.status === "new" || x.status === "seen")) x.status = "declined";
        toast({ title: t("tRcBlocked", { co: inv ? rcCo(inv.company) : "" }), ic: "check" });
      } catch (err) { toast({ title: errText(err), ic: "alert" }); }
      RC.arm = 0; redraw();
      return;
    }
    case "rc-search": {
      const v = sel => { const x = $(sel); return x ? x.value : ""; };
      RC.find = { stage: v("#rcStage"), level: v("#rcLevel"), fac: v("#rcFac"), uni: v("#rcUni"), gov: v("#rcGov"), year: v("#rcYear"), q: v("#rcQ").trim(), verified: $("#rcVer") && $("#rcVer").checked ? "1" : "" };
      const out = $("#rcOut"); if (out) put(out, stateHTML("spin", t("loading")));
      await runSearch();
      return;
    }
    case "rc-invite": openInvite(id); return;
    case "rc-profile": openOnboarding({ mode: "profile" }); return;
    case "rc-kind": readInv(); if (RC.inv) { RC.inv.kind = el.dataset.k === "event" ? "event" : "job"; RC.inv.errors = {}; RC.inv.msg = ""; redrawInvite(`[data-act="rc-kind"][data-k="${RC.inv.kind}"]`); } return;
    case "rc-send": sendInvite(el); return;
    case "rc-withdraw": {
      busy(el, true);
      try { await api.post(`/api/employer/invitations/${id}/withdraw`); const x = (RC.sent || []).find(y => y.id === id); if (x) x.status = "withdrawn"; toast({ title: t("tRcWithdrawn"), ic: "check" }); }
      catch (err) { busy(el, false); toast({ title: errText(err), ic: "alert" }); return; }
      drawSent();
      return;
    }
  }
}
