/* University career offices: totals for their students, the student email domains that verify students, verified students, employer partners
   and internship programmes aimed at their university. Names appear only for students who asked to be verified. */
const CP = { data: null };
const CP_TABS = [["", "cpOverview"], ["email", "cpEmail"], ["students", "cpStudents"], ["partners", "cpPartners"], ["internships", "cpInternships"], ["events", "cpEvents"]];
async function renderCampus() {
  const v = $("#view"); put(v, page(stateHTML("spin", t("loading"))));
  try { CP.data = await api.get("/api/campus"); if (S.sub[0] === "events") CP.events = (await api.get("/api/organize/events")).events; } catch (err) { put(v, page(stateHTML("alert", err.code === "no_office" ? t("cpNoOffice") : errText(err)))); return; }
  put(v, page(campusHTML()));
}
const uniName = k => (UNI[k] ? L(UNI[k]) : k);
function campusHTML() {
  const D = CP.data, sub = S.sub[0] || "", o = D.office, S2 = D.stats;
  const count = k => k === "partners" ? D.partners.filter(p => p.status === "requested").length : 0;
  const tabs = html`<div class="adm-tabs" role="tablist">${CP_TABS.map(([k, lab]) => html`<button class="chip${sub === k ? " is-on" : ""}" type="button" role="tab" aria-selected="${sub === k}" data-act="go" data-to="#/campus${k ? "/" + k : ""}">${t(lab)}${count(k) ? html` <span class="chip-n">${count(k)}</span>` : ""}</button>`)}</div>`;
  const head = html`<h1 class="lh-title">${uniName(o.uni)}</h1><p class="p-page">${o.faculty && FAC[o.faculty] ? L(FAC[o.faculty]) + " · " : ""}${t("cpOfficeOf")}</p>${tabs}`;
  const m = (k, n) => html`<div class="metric"><span class="metric-n num">${fmt(n)}</span><span class="metric-k">${t(k)}</span></div>`;
  let body;
  if (sub === "email") body = html`<section class="card"><h2 class="card-h">${icon("shield", 18)}<span>${t("cpEmailH")}</span></h2><p class="card-p">${t("cpEmailP")}</p>
${D.domains.length ? html`<ul class="tm-list">${D.domains.map(d => html`<li class="tm-row"><span class="tm-main"><b class="num" dir="ltr">@${d}</b><span>${t("cpEmailSub", { d })}</span></span><span class="tm-act"><button class="link link--muted" type="button" data-act="cp-domain-del" data-d="${d}">${t("tmRemove")}</button></span></li>`)}</ul>`
  : html`<p class="note">${t("cpEmailNone")}</p>`}
<div class="bill-form"><input class="inp" id="cpDomain" dir="ltr" placeholder="${t("cpDomainPh")}" aria-label="${t("cpDomainL")}" autocomplete="off"><button class="btn btn--soft" type="button" data-act="cp-domain-add">${icon("plus", 15)}${t("blAdd")}</button></div>
<p class="note">${icon("info", 15)}<span>${t("cpEmailHint")}</span></p></section>`;
  else if (sub === "students") body = D.students.length ? html`<p class="note">${t("cpStudentsNote")}</p><div class="tscroll"><table class="tbl"><thead><tr><th>${t("cpName")}</th><th>${t("obFac")}</th><th>${t("cpApps")}</th><th>${t("cpInterviews")}</th><th>${t("cpHired")}</th></tr></thead>
<tbody>${D.students.map(s => html`<tr><td dir="auto">${L(s.name)}</td><td>${FAC[s.fac] ? L(FAC[s.fac]) : "—"}${s.status === "student" && s.year ? " · " + t("rcYearN", { n: s.year }) : ""}</td><td class="num">${fmt(s.applications)}</td><td class="num">${fmt(s.interviews)}</td><td>${s.hired.length ? s.hired.map(x => L(bi(x))).join(", ") : "—"}</td></tr>`)}</tbody></table></div>` : html`<p class="empty-p">${t("cpNoStudents")}</p>`;
  else if (sub === "partners") body = D.partners.length ? html`<ul class="alist">${D.partners.map(p => html`<li class="acard"><span class="acard-main"><span class="acard-t">${L(bi(p.name)) || "—"}</span><span class="acard-s">${t("sec_" + p.sector)}${p.cat && CAT[p.cat] ? " · " + L(CAT[p.cat]) : ""}</span>
<span class="acard-meta"><span class="pill ${p.status === "approved" ? "pill--good" : p.status === "requested" ? "pill--warn" : ""}">${t("cpP_" + p.status)}</span></span></span>
${p.status === "requested" ? html`<span class="acard-act"><button class="btn btn--primary btn--sm" type="button" data-act="cp-partner" data-id2="${p.companyId}" data-yes="1">${t("cpApprove")}</button><button class="link link--muted" type="button" data-act="cp-partner" data-id2="${p.companyId}">${t("cpDecline")}</button></span>` : ""}</li>`)}</ul><p class="note">${t("cpPartnerHint")}</p>` : html`<p class="empty-p">${t("cpNoPartners")}</p>`;
  else if (sub === "events") body = orgListHTML(CP.events || [], false);
  else if (sub === "internships") body = D.internships.length ? html`<ul class="alist">${D.internships.map(j => html`<li class="acard"><span class="acard-main"><span class="acard-t">${L(bi(j.title))}</span><span class="acard-s">${L(bi(j.company))}${j.progStart ? " · " + progRange(j) : ""}</span>
<span class="acard-meta"><span class="pill pill--good">${t("cpApplicantsN", { n: fmt(j.applicants) })}</span></span></span></li>`)}</ul>` : html`<p class="empty-p">${t("cpNoInternships")}</p>`;
  else body = html`<div class="metrics">${m("cpStudentsN", S2.students)}${m("cpVerifiedN", S2.verified)}${m("cpApplyingN", S2.applying)}${m("cpInternsN", S2.internsHired)}${m("cpHiresN", S2.hires)}${m("cpEmployersN", S2.employers)}</div>
<p class="note">${t("cpTotalsNote")}</p>${D.domains.length ? "" : html`<section class="card"><p class="card-p">${t("cpEmailNudge")}</p><div class="card-act"><button class="btn btn--primary" type="button" data-act="go" data-to="#/campus/email">${t("cpEmailSet")}</button></div></section>`}`;
  return html`<div class="cp-wrap">${head}${body}</div>`;
}
function progRange(j) { const f = ym => { if (!ym) return ""; const [y, mo] = ym.split("-").map(Number); return new Date(Date.UTC(y, mo - 1, 1)).toLocaleDateString(S.lang === "ar" ? "ar-SY" : "en-GB", { month: "short", year: "numeric", timeZone: "UTC" }); }; return [f(j.progStart), f(j.progEnd)].filter(Boolean).join(" – "); }
async function campusAct(act, el) {
  const id = el.dataset.id2, yes = !!el.dataset.yes;
  try {
    if (act === "cp-domain-add") { await api.post("/api/campus/domains", { domain: ($("#cpDomain") || {}).value || "" }); toast({ title: t("tCpDomain"), ic: "check" }); }
    else if (act === "cp-domain-del") { if (!confirm(t("cpDomainDelQ"))) return; await api.del(`/api/campus/domains/${encodeURIComponent(el.dataset.d)}`); }
    else if (act === "cp-verify") { await api.post(`/api/campus/verify/${id}`, { decision: yes ? "yes" : "no" }); toast({ title: t(yes ? "tCpVerified" : "tCpDeclined"), ic: "check" }); }
    else if (act === "cp-partner") { await api.post(`/api/campus/partners/${id}`, { decision: yes ? "yes" : "no" }); toast({ title: t(yes ? "tCpPartner" : "tCpDeclined"), ic: "check" }); }
    else if (act === "sv-send") { const r = await api.post("/api/me/verify-student", { email: ($("#svEmail") || {}).value || "" }); S.studentVerify = r.verification; SV.dev = r.devCode || ""; toast({ title: t("tSvSent2"), ic: "check" }); render(); { const f = $("#svCode"); if (f) f.focus(); } return; }
    else if (act === "sv-confirm") { const r = await api.post("/api/me/verify-student/confirm", { code: ($("#svCode") || {}).value || "" }); S.studentVerify = r.verification; SV.dev = ""; toast({ title: t("tSvDone"), ic: "check" }); render(); return; }
    else if (act === "sv-change") { await api.del("/api/me/verify-student"); S.studentVerify = { ...S.studentVerify, status: "none", email: "" }; SV.dev = ""; render(); { const f = $("#svEmail"); if (f) f.focus(); } return; }
    else if (act === "sv-withdraw") { await api.del("/api/me/verify-student"); S.studentVerify = { status: "none", uni: S.studentVerify && S.studentVerify.uni }; toast({ title: t("tSvWithdrawn"), ic: "check" }); render(); return; }
    else if (act === "emp-partner") { const u = ($("#ptUni") || {}).value; if (!u) return; await api.post("/api/employer/partners", { uni: u }); toast({ title: t("tPtSent"), ic: "check" }); await loadEmployer(); renderCompany(); return; }
    else if (act === "adm-campus-add") { await api.post("/api/admin/campus", { phone: $("#caPhone").value, uni: $("#caUni").value, faculty: $("#caFac").value, name: $("#caName").value }); toast({ title: t("tCaAdded"), ic: "check" }); await drawCampusAdmin(); return; }
    else if (act === "adm-campus-dadd") { await api.post("/api/admin/campus/domains", { uni: el.dataset.uni, domain: ($("#cad-" + id) || {}).value || "" }); toast({ title: t("tCpDomain"), ic: "check" }); await drawCampusAdmin(); return; }
    else if (act === "adm-campus-ddel") { await api.del(`/api/admin/campus/domains/${encodeURIComponent(el.dataset.uni)}/${encodeURIComponent(el.dataset.d)}`); await drawCampusAdmin(); return; }
    else if (act === "adm-campus-del") { await api.del(`/api/admin/campus/${id}`); toast({ title: t("tCaRemoved"), ic: "check" }); await drawCampusAdmin(); return; }
    await renderCampus();
  } catch (err) { toast({ title: errText(err), ic: "alert" }); }
}
/* A student's verification card, on their profile: verified by a code sent to their university email. */
const SV = { dev: "" };
function studentVerifyHTML() {
  const V = S.studentVerify, P = PROFILE; if (!V || !P || !V.uni || !UNI[V.uni]) return "";
  const u = uniName(V.uni), doms = (V.domains || []).map(d => "@" + d).join(t("orSep"));
  if (V.status === "verified") return html`<section class="card sv sv--ok"><h2 class="card-h">${icon("shield", 18)}<span>${t("svVerifiedH", { uni: u })}</span></h2><p class="card-p">${t("svVerifiedP2", { email: V.email || "" })}</p><div class="card-act"><button class="link link--muted" type="button" data-act="sv-withdraw">${t("svRemove")}</button></div></section>`;
  if (!(V.domains || []).length) return "";   // nothing a student can do until their university adds its domain, so no dead-end card
  if (V.status === "code_sent") return html`<section class="card sv"><h2 class="card-h">${icon("shield", 18)}<span>${t("svCodeH")}</span></h2><p class="card-p">${t("svCodeP", { email: V.email })}</p>
<div class="field"><label class="lbl" for="svCode">${t("svCodeL")}</label><input class="inp" id="svCode" inputmode="numeric" autocomplete="one-time-code" maxlength="6" dir="ltr"></div>${SV.dev ? html`<p class="note">${t("svDevCode", { code: SV.dev })}</p>` : ""}
<div class="card-act"><button class="btn btn--primary" type="button" data-act="sv-confirm">${t("svConfirm")}</button><button class="link link--muted" type="button" data-act="sv-change">${t("svOtherEmail")}</button></div></section>`;
  return html`<section class="card sv"><h2 class="card-h">${icon("shield", 18)}<span>${t("svAskH", { uni: u })}</span></h2><p class="card-p">${t("svEmailP", { domains: doms })}</p>
<div class="field"><label class="lbl" for="svEmail">${t("svEmailL")}</label><input class="inp" id="svEmail" type="email" dir="ltr" autocomplete="email" placeholder="${"name@" + (V.domains[0] || "")}"></div>
<p class="note">${icon("info", 15)}<span>${t("svShare2", { uni: u })}</span></p><div class="card-act"><button class="btn btn--primary" type="button" data-act="sv-send">${icon("send", 15)}${t("svSend")}</button></div></section>`;
}
/* The employer's universities card. */
function partnersCardHTML() {
  const ps = (S.emp && S.emp.partners) || [], have = new Set(ps.map(p => p.uni));
  const opts = Object.keys(UNI).filter(k => !have.has(k) || ps.find(p => p.uni === k && p.status === "declined"));
  return html`<section class="card"><h2 class="card-h">${icon("cap", 18)}<span>${t("ptTitle")}</span></h2><p class="card-p">${t("ptIntro")}</p>
${ps.length ? html`<ul class="pt-list">${ps.map(p => html`<li><span>${uniName(p.uni)}</span><span class="pill ${p.status === "approved" ? "pill--good" : p.status === "requested" ? "pill--warn" : ""}">${t("cpP_" + p.status)}</span></li>`)}</ul>` : ""}
${opts.length && canDo("manage") ? html`<div class="bill-form"><select class="inp inp--sm" id="ptUni" aria-label="${t("ptPick")}"><option value="">${t("ptPick")}</option>${opts.map(k => raw(`<option value="${k}">${esc(uniName(k))}</option>`))}</select><button class="btn btn--soft btn--sm" type="button" data-act="emp-partner">${t("ptAsk")}</button></div>` : ""}</section>`;
}
/* Admin: career offices. */
async function drawCampusAdmin() {
  const b = $("#admBody"), D = await api.get("/api/admin/campus");
  put(b, html`<section class="card bill"><h2 class="card-h">${t("caOffices")}</h2>${D.offices.length ? html`<ul class="alist">${D.offices.map(o => html`<li class="acard"><span class="acard-main"><span class="acard-t">${uniName(o.uni)}${o.faculty && FAC[o.faculty] ? " · " + L(FAC[o.faculty]) : ""}</span>
<span class="acard-s">${o.name || "—"} · <span class="num" dir="ltr">${phoneLabel(o.phone)}</span> · ${t("caVerifiedN", { n: o.verified })}</span>
<span class="acard-s">${(o.domains || []).length ? o.domains.map(d => html`<span class="num" dir="ltr">@${d}</span> <button class="link link--muted" type="button" data-act="adm-campus-ddel" data-uni="${o.uni}" data-d="${d}">${t("tmRemove")}</button>`) : t("caNoDomain")}</span>
<span class="bill-form"><input class="inp inp--sm" id="cad-${o.userId}" dir="ltr" placeholder="${t("cpDomainPh")}" aria-label="${t("cpDomainL")}"><button class="btn btn--soft btn--sm" type="button" data-act="adm-campus-dadd" data-id2="${o.userId}" data-uni="${o.uni}">${t("blAdd")}</button></span></span><span class="acard-act"><button class="link link--muted" type="button" data-act="adm-campus-del" data-id2="${o.userId}">${t("tmRemove")}</button></span></li>`)}</ul>` : html`<p class="empty-p">${t("caNone")}</p>`}</section>
<section class="card bill"><h2 class="card-h">${t("caAdd")}</h2><p class="card-p">${t("caAddP")}</p><div class="bill-form"><select class="inp inp--sm" id="caUni" aria-label="${t("obUni")}">${Object.keys(UNI).map(k => raw(`<option value="${k}">${esc(uniName(k))}</option>`))}</select>
<select class="inp inp--sm" id="caFac" aria-label="${t("obFac")}"><option value="">${t("caAllFac")}</option>${Object.keys(FAC).map(k => raw(`<option value="${k}">${esc(L(FAC[k]))}</option>`))}</select>
<input class="inp inp--sm" id="caName" placeholder="${t("caName")}" aria-label="${t("caName")}"><input class="inp inp--sm" id="caPhone" type="tel" dir="ltr" placeholder="09xx xxx xxx" aria-label="${t("obPhone")}"><button class="btn btn--soft btn--sm" type="button" data-act="adm-campus-add">${t("blAdd")}</button></div></section>`);
}
