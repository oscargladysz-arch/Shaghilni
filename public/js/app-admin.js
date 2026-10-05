/* ---------- admin: overview, company verification, listing review, hire confirmation ---------- */
const ADM = { hiresConfirmed: false };
const OFAC_URL = "https://sanctionssearch.ofac.treas.gov/";
async function renderAdmin() {
  const v = $("#view"), sub = S.sub[0] || "";
  const q = (S.admin && S.admin.overview && S.admin.overview.queues) || { companies: 0, jobs: 0, hires: 0 };
  const tabs = [["", "adOverview", 0], ["companies", "adCompanies", q.companies], ["jobs", "adJobs", q.jobs], ["hires", "adHires", q.hires], ["campus", "adCampus", 0], ["events", "adEvents", 0], ["billing", "adBilling", 0], ["traffic", "adTraffic", 0], ["system", "adSystem", 0]];
  put(v, page(html`<h1 class="lh-title">${t("adTitle")}</h1>
<nav class="tabs" aria-label="${t("adTitle")}">${tabs.map(([k, key, n]) => html`<button class="tab" type="button" data-act="go" data-to="#/admin${k ? "/" + k : ""}"${sub === k ? raw(' aria-current="page"') : ""}>${t(key)}${n ? html`<span class="nav-n num">${n}</span>` : ""}</button>`)}</nav>
<div id="admBody">${stateHTML("spin", t("loading"))}</div>`));
  try {
    if (sub === "companies") await drawCompanies();
    else if (sub === "jobs") await drawJobs();
    else if (sub === "hires") await drawHires();
    else if (sub === "billing") await drawBilling();
    else if (sub === "campus") await drawCampusAdmin();
    else if (sub === "events") await drawEventsAdmin();
    else if (sub === "traffic") await drawTraffic();
    else if (sub === "system") await drawSystem();
    else { await loadAdminCounts(); await drawInsights(); }
  } catch (err) { const b = $("#admBody"); if (b) put(b, stateHTML("alert", errText(err), "", html`<button class="btn btn--soft" type="button" data-act="adm-refresh">${t("retry")}</button>`)); }
}
function drawOverview() {
  const b = $("#admBody"), o = S.admin.overview, c = o.counts;
  const max = Math.max(1, ...o.weeks.map(w => w.applications));
  const metric = (k, n, big) => html`<div class="metric${big ? " metric--big" : ""}"><span class="metric-n num">${fmt(n)}</span><span class="metric-k">${t(k)}</span></div>`;
  put(b, html`<div class="metrics">${metric("m_confirmedHires", c.confirmedHires, true)}${metric("m_hired", c.hired)}${metric("m_applications", c.applications)}${metric("m_liveJobs", c.liveJobs)}
${metric("m_employers", c.employers)}${metric("m_seekers", c.seekers)}${metric("m_profiles", c.profiles)}</div>
${c.failedTexts ? html`<p class="note note--demo">${icon("alert", 15)}<span>${t("m_failedTexts")}: ${fmt(c.failedTexts)}</span></p>` : ""}
${c.demoJobs ? html`<p class="hint">${tn("m_demo", c.demoJobs)}</p>` : ""}
<section class="card"><h2 class="card-h">${t("adWeeks")}</h2>
<div class="wk-bars" role="img" aria-label="${t("adWeeks")}">${o.weeks.map(w => html`<div class="wk-col"><span class="wk-bar" style="--h:${Math.round((w.applications / max) * 100)}%"><span class="wk-bar-in" style="--h:${w.applications ? Math.round((w.confirmedHires / w.applications) * 100) : 0}%"></span></span><span class="wk-lbl">${dayLabel(w.from)}</span></div>`)}</div>
<p class="legend"><span class="key key--a"></span>${t("wkApps")}<span class="key key--h"></span>${t("wkHires")}</p></section>
<div class="card-act">${o.queues.companies ? html`<button class="btn" type="button" data-act="go" data-to="#/admin/companies">${tn("adQueueCompanies", o.queues.companies)}</button>` : ""}
${o.queues.jobs ? html`<button class="btn" type="button" data-act="go" data-to="#/admin/jobs">${tn("adQueueJobs", o.queues.jobs)}</button>` : ""}
${o.queues.hires ? html`<button class="btn" type="button" data-act="go" data-to="#/admin/hires">${tn("adQueueHires", o.queues.hires)}</button>` : ""}</div>`);
}
async function drawCompanies() {
  const list = (await api.get("/api/admin/companies?status=pending")).companies, b = $("#admBody"); if (!b) return;
  if (!list.length) { put(b, stateHTML("check", t("adEmpty"))); return; }
  put(b, html`<ul class="alist">${list.map(c => html`<li class="acard acard--ap"><span class="acard-main">
<span class="acard-t">${c.name.ar || ""}${c.name.ar && c.name.en ? " · " : ""}${c.name.en || ""}</span>
<span class="acard-s">${t("sec_" + c.sector)} · ${L(CAT[c.cat])}${c.gov && GOV[c.gov] ? " · " + L(GOV[c.gov]) : ""}</span>
<dl class="kv">${[["adReg", c.regNo], ["adContact", c.contactName], ["coWhatsapp", phoneLabel(c.whatsapp)], ["adOwner", phoneLabel(c.ownerPhone)], ["coWebsite", c.website || "—"]].map(([k, val]) => html`<div class="kv-row"><dt>${t(k)}</dt><dd dir="auto">${val || "—"}</dd></div>`)}</dl>
${c.about && (c.about.ar || c.about.en) ? html`<p class="card-p">${L(bi(c.about))}</p>` : ""}
<a class="link" href="${OFAC_URL}" target="_blank" rel="noopener">${icon("share", 14)}${t("adSdn")}</a>
<label class="tick"><input type="checkbox" id="scr-${c.id}"><span>${t("adScreened")}</span></label>
<span class="field"><label class="lbl" for="note-c${c.id}">${t("adNote")}</label><textarea class="inp inp--note" id="note-c${c.id}"></textarea></span>
<span class="acard-act"><button class="btn btn--primary" type="button" data-act="adm-verify" data-id2="${c.id}">${icon("check", 15, 2.4)}${t("adVerify")}</button>
<button class="btn" type="button" data-act="adm-reject" data-id2="${c.id}">${t("adReject")}</button><button class="link link--muted" type="button" data-act="adm-suspend" data-id2="${c.id}">${t("adSuspend")}</button></span>
</span></li>`)}</ul>`);
}
async function drawJobs() {
  const list = (await api.get("/api/admin/jobs?status=pending")).jobs, b = $("#admBody"); if (!b) return;
  if (!list.length) { put(b, stateHTML("check", t("adEmpty"))); return; }
  put(b, html`<ul class="alist">${list.map(j => { const x = { ...j, title: bi(j.title), co: bi(j.co), summary: bi(j.summary), duties: biList(j.duties), needs: biList(j.needs), provides: biList(j.provides) };
    return html`<li class="acard acard--ap"><span class="acard-main">
<span class="acard-t">${L(x.title)}</span><span class="acard-s">${L(x.co)} · ${j.gov && GOV[j.gov] ? L(GOV[j.gov]) : "—"} · ${x.pay && x.pay[0] ? payText(x).main : "—"}</span>
<span class="acard-meta">${j.companyStatus !== "verified" ? html`<span class="pill pill--warn">${t("coStatus_" + j.companyStatus)}</span>` : ""}${(j.flags || []).map(f => html`<span class="pill pill--warn">${t(f.type === "contact" ? "adFlagContact" : "adFlagGender", { x: f.word })}</span>`)}</span>
<details class="rules"><summary class="rules-sum">${t("hAbout")}</summary><p class="card-p">${L(x.summary)}</p>${[L(bi(j.place)), L(bi(j.contact && j.contact.name)), L(bi(j.contact && j.contact.role)), L(bi(j.contact && j.contact.status)), j.tags].filter(Boolean).length ? html`<p class="card-p">${[L(bi(j.place)), L(bi(j.contact && j.contact.name)), L(bi(j.contact && j.contact.role)), L(bi(j.contact && j.contact.status)), j.tags].filter(Boolean).join(" · ")}</p>` : ""}
${[["hDuties", x.duties], ["hNeeds", x.needs], ["hProvides", x.provides]].map(([k, arr]) => (L(arr).length ? html`<p class="lbl">${t(k)}</p><ul class="rules-list">${L(arr).map(s => html`<li>${s}</li>`)}</ul>` : ""))}</details>
<span class="field"><label class="lbl" for="note-j${j.id}">${t("adNote")}</label><textarea class="inp inp--note" id="note-j${j.id}"></textarea></span>
<span class="acard-act"><button class="btn btn--primary" type="button" data-act="adm-approve" data-id2="${j.id}"${j.companyStatus !== "verified" ? raw(" disabled") : ""}>${icon("check", 15, 2.4)}${t("adApprove")}</button>
<button class="btn" type="button" data-act="adm-jreject" data-id2="${j.id}">${t("adReject")}</button></span></span></li>`; })}</ul>`);
}
async function drawHires() {
  if (!ADM.progs) { try { ADM.progs = (await api.get("/api/admin/billing")).programmes.filter(p => p.active); } catch (e) { ADM.progs = []; } }
  const list = (await api.get(`/api/admin/hires${ADM.hiresConfirmed ? "?state=confirmed" : ""}`)).hires, b = $("#admBody"); if (!b) return;
  const toggle = html`<p class="alt"><button class="link" type="button" data-act="adm-hires-toggle">${t(ADM.hiresConfirmed ? "adShowPending" : "adShowConfirmed")}</button></p>`;
  if (!list.length) { put(b, html`${stateHTML("check", t("adEmpty"))}${toggle}`); return; }
  put(b, html`${ADM.hiresConfirmed ? "" : html`<p class="note">${icon("info", 15)}<span>${t("adConfirmHint")}</span></p>`}<ul class="alist">${list.map(h => html`<li class="acard"><span class="acard-main">
<span class="acard-t">${h.seekerName || "—"}</span><span class="acard-s">${L(bi(h.title))} · ${L(bi(h.co))}</span>
<span class="acard-meta"><span>${t("adHiredOn", { when: dayLabel(h.hiredAt) })}</span>${h.contactName ? html`<span>${t("adContact")}: ${h.contactName}</span>` : ""}</span></span>
<span class="acard-act">${h.employerPhone ? html`<a class="btn btn--ghost" href="tel:${h.employerPhone}">${icon("phone", 15)}${t("adCallEmployer")}</a>` : ""}
${ADM.hiresConfirmed ? html`<span class="pill pill--good">${t("tConfirmed")}</span>` : html`${ADM.progs && ADM.progs.length ? html`<select class="inp inp--sm" id="hp-${h.id}" aria-label="${t("blProgPick")}"><option value="">${t("blNoProg")}</option>${ADM.progs.map(p => raw(`<option value="${p.id}">${esc(p.name)}</option>`))}</select>` : ""}<button class="btn btn--primary" type="button" data-act="adm-confirm" data-id2="${h.id}">${icon("check", 15, 2.4)}${t("adConfirm")}</button>`}</span></li>`)}</ul>${toggle}`);
}
async function admAct(act, el) {
  const id = Number(el.dataset.id2), note = sel => { const n = $(sel); return n ? n.value.trim() : ""; };
  const run = async (fn, okKey) => {
    busy(el, true);
    try { await fn(); toast({ title: t(okKey), ic: "check" }); await loadAdminCounts(); renderChrome(); renderAdmin(); }
    catch (err) { toast({ title: errText(err), ic: "alert" }); busy(el, false); }
  };
  switch (act) {
    case "adm-refresh": renderAdmin(); break;
    case "adm-verify": { const box = $("#scr-" + id);
      if (!box || !box.checked) { toast({ title: t("err_screening_required"), ic: "alert" }); if (box) box.focus(); break; }
      run(() => api.post(`/api/admin/companies/${id}/verify`, { screened: true, note: note("#note-c" + id) }), "tVerified"); break; }
    case "adm-reject": run(() => api.post(`/api/admin/companies/${id}/reject`, { note: note("#note-c" + id) }), "tSentBack"); break;
    case "adm-suspend": run(() => api.post(`/api/admin/companies/${id}/suspend`, { note: note("#note-c" + id) }), "tSuspended"); break;
    case "adm-approve": run(() => api.post(`/api/admin/jobs/${id}/approve`, { note: note("#note-j" + id) }).then(loadJobs).then(rescore), "tPublished"); break;
    case "adm-jreject": run(() => api.post(`/api/admin/jobs/${id}/reject`, { note: note("#note-j" + id) }), "tSentBack"); break;
    case "adm-confirm": { const pg = $("#hp-" + id); run(() => api.post(`/api/admin/applications/${id}/confirm-hire`, { programmeId: pg && pg.value ? Number(pg.value) : null }), "tConfirmed"); break; }
    case "adm-plan-set": case "adm-charge": case "adm-prog-add": billingAct(act, el); break;
    case "adm-hires-toggle": ADM.hiresConfirmed = !ADM.hiresConfirmed; renderAdmin(); break;
  }
}
