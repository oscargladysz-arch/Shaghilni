/* Teams: the team page, the activity log, and joining a company (answering an invitation or asking to join).
   The server checks every permission; the interface only shows each person the actions their role allows. */
const TM = { data: null, results: null, pick: null, prefill: null, act: null };
const TEAM_ROLES = ["admin", "recruiter", "hiring_manager"];
const myRole = () => (S.emp && S.emp.me && S.emp.me.role) || (S.emp && S.emp.company ? "owner" : null);
const ROLE_LEVELS = { billing: ["owner"], manage: ["owner", "admin"], hire: ["owner", "admin", "recruiter"], view: ["owner", "admin", "recruiter", "hiring_manager"] };
const canDo = level => ROLE_LEVELS[level].includes(myRole());
const roleName = r => t("tr_" + r);
const tmAgo = ts => (ts ? dayLabel(ts) : t("tmNever"));
async function renderTeam() {
  const v = $("#view"); put(v, page(stateHTML("spin", t("loading"))));
  try { TM.data = await api.get("/api/employer/team"); } catch (err) { put(v, page(stateHTML("alert", errText(err)))); return; }
  put(v, page(teamHTML()));
}
function teamHTML() {
  const D = TM.data, me = D.me.role, manage = me === "owner" || me === "admin", full = D.seats.used >= D.seats.limit;
  const roleSel = (id, cur, allowAdmin) => html`<select class="inp inp--sm" id="${id}" aria-label="${t("tmRoleL")}">${TEAM_ROLES.filter(r => allowAdmin || r !== "admin" || cur === "admin").map(r => raw(`<option value="${r}"${r === cur ? " selected" : ""}>${esc(roleName(r))}</option>`))}</select>`;
  const person = (m, kind) => {
    const self = m.phone === D.me.phone, canEdit = manage && kind === "member" && !self && (me === "owner" || m.role !== "admin");
    return html`<li class="tm-row"><span class="tm-ava" aria-hidden="true">${(m.name || "?").trim().slice(0, 1).toUpperCase()}</span>
<span class="tm-main"><b dir="auto">${m.name || phoneLabel(m.phone)}${self ? html` <span class="pill">${t("tmYou")}</span>` : ""}</b><span class="num" dir="ltr">${phoneLabel(m.phone)}</span>
<span>${kind === "owner" ? t("tr_owner") : kind === "invite" ? t("tmInvitedAs", { role: roleName(m.role) }) : roleName(m.role)}${kind !== "invite" ? " · " + t("tmActive", { when: tmAgo(m.lastActive) }) : ""}</span></span>
<span class="tm-act">${canEdit ? html`${roleSel("tmr-" + m.phone.replace(/\D/g, ""), m.role, me === "owner")}<button class="btn btn--ghost btn--sm" type="button" data-act="tm-role" data-phone="${m.phone}">${t("tmSaveRole")}</button>
${me === "owner" ? html`<button class="link" type="button" data-act="tm-transfer" data-phone="${m.phone}">${t("tmMakeOwner")}</button>` : ""}<button class="link link--muted" type="button" data-act="tm-remove" data-phone="${m.phone}">${t("tmRemove")}</button>` : ""}
${kind === "invite" && manage && (me === "owner" || m.role !== "admin") ? html`<button class="link link--muted" type="button" data-act="tm-remove" data-phone="${m.phone}">${t("tmCancelInvite")}</button>` : ""}
${self && me !== "owner" ? html`<button class="link link--muted" type="button" data-act="tm-leave">${t("tmLeave")}</button>` : ""}</span></li>`;
  };
  return html`<div class="tm-wrap"><div class="page-head"><h1 class="lh-title">${t("plTeam")}</h1><button class="btn btn--ghost" type="button" data-act="go" data-to="#/company">${t("backCompany")}</button></div>
<p class="lh-sub">${t("tmSeats", { used: D.seats.used, limit: D.seats.limit })}${manage ? html` · <a href="#/company/activity">${t("tmActivity")}</a>` : ""}</p>
${manage && D.requests.length ? html`<section class="card"><h2 class="card-h">${t("tmRequestsH")}</h2><ul class="tm-list">${D.requests.map(m => html`<li class="tm-row"><span class="tm-ava" aria-hidden="true">${(m.name || "?").slice(0, 1).toUpperCase()}</span>
<span class="tm-main"><b dir="auto">${m.name}</b><span class="num" dir="ltr">${phoneLabel(m.phone)}</span><span>${t("tmAsked", { when: tmAgo(m.since) })}</span></span>
<span class="tm-act">${roleSel("tmq-" + m.phone.replace(/\D/g, ""), "recruiter", me === "owner")}<button class="btn btn--primary btn--sm" type="button" data-act="tm-approve" data-phone="${m.phone}"${full ? raw(" disabled") : ""}>${t("cpApprove")}</button><button class="link link--muted" type="button" data-act="tm-decline" data-phone="${m.phone}">${t("cpDecline")}</button></span></li>`)}</ul>${full ? html`<p class="note">${t("tmFullNote")}</p>` : ""}</section>` : ""}
<section class="card"><h2 class="card-h">${t("tmPeopleH")}</h2><ul class="tm-list">${person({ ...D.owner, role: "owner" }, "owner")}${D.members.map(m => person(m, "member"))}</ul>
${D.invites.length ? html`<h3 class="ck-h">${t("tmInvitesH")}</h3><ul class="tm-list">${D.invites.map(m => person(m, "invite"))}</ul>` : ""}</section>
${manage ? html`<section class="card"><h2 class="card-h">${t("tmAdd")}</h2><p class="card-p">${t("tmAddP2")}</p>${full ? html`<p class="note">${t("tmFullNote")}</p>` : html`<div class="grid2"><div class="field"><label class="lbl" for="tmName">${t("tmNameL")}</label><input class="inp" id="tmName" maxlength="80" autocomplete="off"></div>
<div class="field"><label class="lbl" for="tmPhone">${t("obPhone")}</label><input class="inp" id="tmPhone" type="tel" dir="ltr" inputmode="tel" placeholder="09xx xxx xxx"></div></div>
<div class="field"><label class="lbl" for="tmRole">${t("tmRoleL")}</label>${roleSel("tmRole", "recruiter", me === "owner")}</div>
<div class="card-act"><button class="btn btn--primary" type="button" data-act="tm-invite">${icon("send", 15)}${t("tmSendInvite")}</button></div>`}</section>` : ""}
<section class="card"><h2 class="card-h">${t("tmRolesH")}</h2><dl class="kv">${["owner", ...TEAM_ROLES].map(r => html`<div class="kv-row"><dt>${roleName(r)}</dt><dd>${t("trd_" + r)}</dd></div>`)}</dl></section></div>`;
}
async function renderActivity() {
  const v = $("#view"); put(v, page(stateHTML("spin", t("loading"))));
  let A; try { A = await api.get("/api/employer/activity"); } catch (err) { put(v, page(stateHTML("alert", errText(err)))); return; }
  const line = x => t("ta_" + x.action.replace(".", "_"), { who: x.who, to: x.to ? t("est_" + x.to) : "", role: x.role ? roleName(x.role) : "" }) || x.action;
  put(v, page(html`<div class="tm-wrap"><div class="page-head"><h1 class="lh-title">${t("tmActivity")}</h1><button class="btn btn--ghost" type="button" data-act="go" data-to="#/company/team">${t("plTeam")}</button></div>
<p class="lh-sub">${t("tmActivityP")}</p>${A.activity.length ? html`<ul class="tm-log">${A.activity.map(x => html`<li><span class="tm-when">${dayLabel(x.at)}</span><span>${line(x)}${x.job ? html` · <span dir="auto">${L(bi(x.job))}</span>` : ""}</span></li>`)}</ul>` : html`<p class="empty-p">${t("tmNoActivity")}</p>`}</div>`));
}
/* Someone signed in as an employer with no company yet. */
function noCompanyHTML() {
  const P = S.emp.pending;
  if (P && P.status === "invited") return html`<h1 class="lh-title">${t("coTitle")}</h1><section class="card"><h2 class="card-h">${t("tmInvitedH", { co: L(bi(P.company)), role: roleName(P.role) })}</h2><p class="card-p">${t("tmInvitedP")}</p>
<div class="card-act"><button class="btn btn--primary" type="button" data-act="tm-accept">${t("tmAccept")}</button><button class="link link--muted" type="button" data-act="tm-refuse">${t("cpDecline")}</button></div></section>`;
  if (P && P.status === "requested") return html`<h1 class="lh-title">${t("coTitle")}</h1><section class="card"><h2 class="card-h">${t("tmWaitingH", { co: L(bi(P.company)) })}</h2><p class="card-p">${t("tmWaitingP")}</p>
<div class="card-act"><button class="link link--muted" type="button" data-act="tm-withdraw">${t("tmWithdraw")}</button></div></section>`;
  const pick = TM.pick || TM.prefill;
  return html`<h1 class="lh-title">${t("coTitle")}</h1>
<section class="card"><h2 class="card-h">${t("tmFindH")}</h2><p class="card-p">${TM.prefill ? t("tmExistsP", { co: L(bi(TM.prefill.name)) }) : t("tmFindP")}</p>
${pick ? html`<p class="tm-pick"><b>${L(bi(pick.name))}</b> <button class="link link--muted" type="button" data-act="tm-unpick">${t("tmChange")}</button></p>
<div class="field"><label class="lbl" for="tmMyName">${t("tmMyNameL")}</label><input class="inp" id="tmMyName" maxlength="80" autocomplete="name"></div>
<div class="card-act"><button class="btn btn--primary" type="button" data-act="tm-join" data-id="${pick.id}">${t("tmAskJoin")}</button></div>`
  : html`<div class="bill-form"><input class="inp" id="tmQ" placeholder="${t("tmSearchPh")}" aria-label="${t("tmSearchPh")}" autocomplete="off"><button class="btn btn--soft" type="button" data-act="tm-search">${icon("search", 15)}${t("tmSearch")}</button></div>
${TM.results ? (TM.results.length ? html`<ul class="tm-list">${TM.results.map(c => html`<li class="tm-row"><span class="tm-main"><b>${L(bi(c.name))}</b><span>${[c.gov && GOV[c.gov] ? L(GOV[c.gov]) : "", c.sector ? t("sec_" + c.sector) : ""].filter(Boolean).join(" · ")}</span></span>
<span class="tm-act"><button class="btn btn--soft btn--sm" type="button" data-act="tm-pick" data-id="${c.id}">${t("tmThisOne")}</button></span></li>`)}</ul>` : html`<p class="empty-p">${t("tmNoMatch")}</p>`) : ""}`}</section>
<section class="card"><h2 class="card-h">${t("coCreate")}</h2><p class="card-p">${t("coStatusP_draft")}</p>
<div class="card-act"><button class="btn" type="button" data-act="go" data-to="#/company/edit">${icon("building", 15)}${t("coCreate")}</button></div></section>`;
}
async function teamAct(act, el) {
  const ph = el.dataset.phone, key = ph ? ph.replace(/\D/g, "") : "";
  try {
    switch (act) {
      case "tm-invite": await api.post("/api/employer/team", { name: $("#tmName").value, phone: $("#tmPhone").value, role: $("#tmRole").value }); toast({ title: t("tTmInvited"), ic: "check" }); return renderTeam();
      case "tm-approve": await api.post(`/api/employer/team/requests/${encodeURIComponent(ph)}`, { decision: "yes", role: $("#tmq-" + key).value }); toast({ title: t("tTmApproved"), ic: "check" }); return renderTeam();
      case "tm-decline": await api.post(`/api/employer/team/requests/${encodeURIComponent(ph)}`, { decision: "no" }); return renderTeam();
      case "tm-role": await api.put(`/api/employer/team/${encodeURIComponent(ph)}`, { role: $("#tmr-" + key).value }); toast({ title: t("tTmRole"), ic: "check" }); return renderTeam();
      case "tm-remove": if (!confirm(t("tmRemoveQ"))) return; await api.del(`/api/employer/team/${encodeURIComponent(ph)}`); return renderTeam();
      case "tm-transfer": if (!confirm(t("tmTransferQ"))) return; await api.post("/api/employer/team/transfer", { phone: ph }); await loadEmployer(); toast({ title: t("tTmTransferred"), ic: "check" }); return renderTeam();
      case "tm-leave": if (!confirm(t("tmLeaveQ"))) return; await api.post("/api/employer/team/leave"); await loadEmployer(); go("#/company"); renderChrome(); return;
      case "tm-accept": await api.post("/api/employer/membership/accept"); await loadEmployer(); toast({ title: t("tTmJoined"), ic: "check" }); renderCompany(); renderChrome(); return;
      case "tm-refuse": case "tm-withdraw": await api.post(`/api/employer/membership/${act === "tm-refuse" ? "decline" : "cancel"}`); await loadEmployer(); renderCompany(); return;
      case "tm-search": { const q = ($("#tmQ") || {}).value || ""; TM.results = (await api.get(`/api/employer/companies/search?q=${encodeURIComponent(q)}`)).companies; renderCompany(); const f = $("#tmQ"); if (f) f.value = q; return; }
      case "tm-pick": TM.pick = (TM.results || []).find(c => c.id === Number(el.dataset.id)) || null; renderCompany(); { const f = $("#tmMyName"); if (f) f.focus(); } return;
      case "tm-unpick": TM.pick = null; TM.prefill = null; renderCompany(); return;
      case "tm-join": await api.post(`/api/employer/companies/${el.dataset.id}/join`, { name: ($("#tmMyName") || {}).value || "" }); TM.pick = null; TM.prefill = null; await loadEmployer(); toast({ title: t("tTmAsked"), ic: "check" }); renderCompany(); return;
    }
  } catch (err) { toast({ title: errText(err), ic: "alert" }); }
}
