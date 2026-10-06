/* Employer plans (Free, Pro, Enterprise), analytics, team and reports; and the admin's billing tab.
   Hiring is free on every plan. Payments are invoiced by hand for now. */
const PLAN_KEYS = ["free", "pro", "enterprise"];
const PLAN_FEAT = { free: ["plF_post", "plF_manage", "plF_hire", "plF_team3", "plF_anBasic", "plF_inv5", "plF_fee"], pro: ["plF_allFree", "plF_team10", "plF_inv50", "plF_spon2", "plF_analytics", "plF_noFee"],
  enterprise: ["plF_allPro", "plF_invAll", "plF_spon10", "plF_team50", "plF_reports", "plF_noFee"] };
const PL = { data: null, an: null, team: null, want: null, pay: "", months: 1, result: null };
const PAY_METHODS = ["wallet", "bank_syp", "cash", "usd"];
const planName = p => t("pl_" + p);
function planCardHTML() {
  const P = S.emp && S.emp.plan; if (!P) return "";
  const lim = P.limits, u = P.usage, inv = lim.invites == null ? t("plUnlimited") : t("plOf", { a: fmt(u.invites), b: fmt(lim.invites) });
  return html`<section class="card plan-card"><div class="plan-top"><h2 class="card-h">${icon("gauge", 18)}<span>${t("plYour")}</span></h2><span class="pill pill--good">${planName(P.plan)}</span></div>
<dl class="kv"><div class="kv-row"><dt>${t("plInvMonth")}</dt><dd class="num">${inv}</dd></div><div class="kv-row"><dt>${t("plSponUsed")}</dt><dd class="num">${t("plOf", { a: fmt(u.sponsored), b: fmt(lim.sponsored) })}</dd></div>
${P.feesDue.n ? html`<div class="kv-row"><dt>${t("plFeesDue")}</dt><dd class="num">${fmt(P.feesDue.syp)} ${t("syp")}</dd></div>` : ""}</dl>
<div class="card-act">${S.emp.isOwner !== false ? html`<button class="btn ${P.plan === "free" ? "btn--primary" : "btn--soft"}" type="button" data-act="go" data-to="#/company/plan">${icon("spark", 15)}${t(P.plan === "free" ? "plUpgrade" : "plChange")}</button>` : html`<button class="btn btn--soft" type="button" data-act="go" data-to="#/company/plan">${t("plSee")}</button>`}<button class="btn btn--ghost" type="button" data-act="go" data-to="#/company/analytics">${icon("gauge", 15)}${t("plAnalytics")}</button>
<button class="btn btn--ghost" type="button" data-act="go" data-to="#/company/team">${icon("users", 15)}${t("plTeam")} <span class="num">${u.team}/${lim.team}</span></button></div></section>`;
}
async function renderPlan() {
  const v = $("#view"); put(v, page(stateHTML("spin", t("loading"))));
  try { PL.data = await api.get("/api/employer/plan"); } catch (err) { put(v, page(stateHTML("alert", errText(err)))); return; }
  // Back from the bank's payment page: show what happened, checking again for a few seconds if it isn't confirmed yet.
  if (S.sub[1] === "paid" && Number(S.sub[2])) {
    const id = Number(S.sub[2]);
    for (let i = 0; i < 6; i++) {
      try { PL.result = await api.get(`/api/employer/payments/${id}`); } catch (e) { PL.result = null; break; }
      if (PL.result.status !== "created") break;
      put(v, page(planPageHTML())); await new Promise(r => setTimeout(r, 2000));
    }
    if (PL.result && PL.result.status === "paid") { try { PL.data = await api.get("/api/employer/plan"); await loadEmployer(); } catch (e) {} }
  } else PL.result = null;
  put(v, page(planPageHTML()));
}
function payResultHTML() {
  const R = PL.result; if (!R) return "";
  const until = PL.data && PL.data.planUntil ? new Date(PL.data.planUntil).toLocaleDateString(S.lang === "ar" ? "ar-SY" : "en-GB") : "";
  if (R.status === "paid") return html`<section class="card pay-result pay-result--ok" role="status"><h2 class="card-h">${icon("check", 18, 2.4)}<span>${t("payOkH")}</span></h2><p class="card-p">${t("payOkP", { plan: planName(R.plan), amount: money(R.amount, R.currency), until })}</p></section>`;
  if (R.status === "created") return html`<section class="card pay-result" role="status"><h2 class="card-h">${t("payWaitH")}</h2><p class="card-p">${t("payWaitP")}</p></section>`;
  return html`<section class="card pay-result pay-result--no" role="status"><h2 class="card-h">${t("payNoH")}</h2><p class="card-p">${t("payNoP")}</p></section>`;
}
function planPageHTML() {
  const D = PL.data, cur = D.plan, verified = S.emp && S.emp.company && S.emp.company.status === "verified";
  const card = p => html`<article class="plan-opt${p === cur ? " is-cur" : ""}"><h2 class="plan-opt-h">${planName(p)}${p === cur ? html` <span class="pill pill--good">${t("plCurrent")}</span>` : ""}</h2>
<p class="plan-price">${p === "free" ? t("plFreePrice") : (D.prices[p] || (S.cfg && S.cfg.card ? t("plPerMonth", { amount: money(S.cfg.card[p], S.cfg.card.currency) }) : t("plContact")))}</p><ul class="plan-feat">${PLAN_FEAT[p].map(k => html`<li>${icon("check", 14, 2.4)}<span>${t(k)}</span></li>`)}</ul>
${p !== "free" && p !== cur && verified && D.isOwner ? (PL.want === p ? payFormHTML(p, !!D.request) : D.request && D.request.plan === p ? html`<p class="note">${icon("check", 15)}<span>${t("plRequested", { plan: planName(p) })}</span></p>${S.cfg && S.cfg.card ? html`<button class="btn btn--soft" type="button" data-act="emp-plan-want" data-plan="${p}" data-card="1">${t("plCardInstead")}</button>` : ""}`
  : D.request && !(S.cfg && S.cfg.card) ? "" : html`<button class="btn btn--primary" type="button" data-act="emp-plan-want" data-plan="${p}"${D.request ? raw(' data-card="1"') : ""}>${t("plChoose", { plan: planName(p) })}</button>`) : ""}</article>`;
  const ch = D.charges.map(c => html`<tr><td>${t("chK_" + c.kind)}</td><td class="num">${c.amountSyp ? fmt(c.amountSyp) + " " + t("syp") : "—"}</td><td><span class="pill ${c.status === "paid" ? "pill--good" : c.status === "void" ? "" : "pill--warn"}">${t("chS_" + c.status)}</span></td><td class="num">${new Date(c.createdAt).toLocaleDateString(S.lang === "ar" ? "ar-SY" : "en-GB")}</td></tr>`);
  return html`<div class="page-head"><h1 class="lh-title">${t("plTitle")}</h1><button class="btn btn--ghost" type="button" data-act="go" data-to="#/company">${t("backCompany")}</button></div>
${payResultHTML()}<p class="p-page">${t("plIntro")}</p><div class="plan-grid">${PLAN_KEYS.map(card)}</div>
${D.request ? html`<section class="card plan-next"><h2 class="card-h">${t("plNextH")}</h2><ol class="plan-steps"><li>${t("plNext1", { ref: D.request.ref })}</li><li>${t("plNext2", { how: t("payBy_" + D.request.payMethod) })}</li><li>${t("plNext3", { plan: planName(D.request.plan) })}</li></ol><p class="card-p">${t("plRefP")} <b class="num" dir="ltr">${D.request.ref}</b></p></section>` : ""}
<section class="card"><h2 class="card-h">${t("plHowPay")}</h2><p class="card-p">${t("plHowPayP")}</p><p class="card-p">${t("plFeeRule")}</p></section>
${D.limits.reports ? html`<section class="card"><h2 class="card-h">${t("plReports")}</h2><p class="card-p">${t("plReportsP")}</p><div class="card-act"><button class="btn btn--soft" type="button" data-act="emp-report" data-kind="placements">${icon("doc", 15)}${t("plRepPlace")}</button><button class="btn btn--soft" type="button" data-act="emp-report" data-kind="compliance">${icon("shield", 15)}${t("plRepComp")}</button></div></section>` : ""}
<h2 class="sec-h">${t("plCharges")}</h2>${ch.length ? html`<div class="tscroll"><table class="tbl"><thead><tr><th>${t("chKind")}</th><th>${t("chAmount")}</th><th>${t("chStatus")}</th><th>${t("chDate")}</th></tr></thead><tbody>${ch}</tbody></table></div>` : html`<p class="empty-p">${t("plNoCharges")}</p>`}`;
}
const money = (n, cur) => `${fmt(n)} ${cur === "SYP" ? t("syp") : cur}`;
function payFormHTML(p, cardOnly) {
  const C = S.cfg && S.cfg.card, methods = [...(C ? ["card"] : []), ...(cardOnly ? [] : PAY_METHODS)];
  const cardPart = PL.pay === "card" && C ? html`<div class="field"><label class="lbl" for="plMonths">${t("plMonthsL")}</label><select class="inp" id="plMonths">${C.months.map(m => raw(`<option value="${m}"${PL.months === m ? " selected" : ""}>${esc(t(m === 1 ? "plMonth1" : "plMonthsN", { n: m }))}</option>`))}</select></div>
<p class="pay-total">${t("plTotal")}: <b class="num">${money(C[p] * PL.months, C.currency)}</b></p><p class="note">${icon("shield", 15)}<span>${t("plCardSafe")}</span></p>
<button class="btn btn--primary" type="button" data-act="emp-plan-card" data-plan="${p}">${icon("lock", 15)}${t("plPayNow", { amount: money(C[p] * PL.months, C.currency) })}</button>` : "";
  return html`<div class="pay-form"><fieldset class="fset"><legend class="lbl">${t("plPayHow")}</legend>${methods.map(m => html`<label class="al-how"><input type="radio" name="payHow" value="${m}" data-act="emp-plan-pay"${PL.pay === m ? raw(" checked") : ""}><span><b>${t("pay_" + m)}</b><small>${t("payP_" + m)}</small></span></label>`)}</fieldset>
${cardPart}${PL.pay === "card" ? "" : html`<div class="field"><label class="lbl" for="plNote">${t("plNoteL")}</label><input class="inp" id="plNote" maxlength="400" placeholder="${t("plNotePh")}"></div>
<button class="btn btn--primary" type="button" data-act="emp-plan-req" data-plan="${p}"${PL.pay ? "" : raw(" disabled")}>${t("plSend", { plan: planName(p) })}</button>`}<button class="link link--muted" type="button" data-act="emp-plan-want" data-plan="">${t("cancel")}</button></div>`;
}
async function renderAnalytics() {
  const v = $("#view"); put(v, page(stateHTML("spin", t("loading"))));
  let A; try { A = await api.get("/api/employer/analytics"); } catch (err) { put(v, page(stateHTML("alert", errText(err)))); return; }
  const m = (k, n) => html`<div class="metric"><span class="metric-n num">${n == null ? "—" : fmt(n)}</span><span class="metric-k">${t(k)}</span></div>`, T = A.total;
  put(v, page(html`<div class="page-head"><h1 class="lh-title">${t("plAnalytics")}</h1><button class="btn btn--ghost" type="button" data-act="go" data-to="#/company">${t("backCompany")}</button></div>
<div class="metrics">${m("anApps", T.applications)}${m("anShort", T.shortlisted)}${m("anInt", T.interview)}${m("anHired", T.hired)}${A.full ? html`${m("anSearch", T.fromSearch)}${m("anWa", T.whatsapp)}${m("anDays", T.medianDaysToHire)}` : ""}</div>
${A.full ? "" : html`<section class="card"><p class="card-p">${t("plAnUpsell")}</p><div class="card-act"><button class="btn btn--soft" type="button" data-act="go" data-to="#/company/plan">${t("plSee")}</button></div></section>`}
<div class="tscroll"><table class="tbl"><thead><tr><th>${t("anJob")}</th><th>${t("anApps")}</th><th>${t("anShort")}</th><th>${t("anInt")}</th><th>${t("anHired")}</th>${A.full ? html`<th>${t("anSearch")}</th>` : ""}</tr></thead>
<tbody>${A.jobs.map(j => html`<tr><td>${L(bi(j.title)) || "—"}</td><td class="num">${fmt(j.applications)}</td><td class="num">${fmt(j.shortlisted)}</td><td class="num">${fmt(j.interview)}</td><td class="num">${fmt(j.hired)}</td>${A.full ? html`<td class="num">${fmt(j.fromSearch)}</td>` : ""}</tr>`)}</tbody></table></div>`));
}
function downloadCSV(name, rows) {
  const cols = rows.length ? Object.keys(rows[0]) : ["none"], q = v => { const s0 = String(v == null ? "" : v), s = typeof v === "string" && /^(?:[=@\t\r]|[+-](?![\d\s.]|$))/.test(s0) ? "'" + s0 : s0; return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };   // a cell that would run as a formula is kept as text (D-43)
  const iso = v => (typeof v === "number" && v > 1e12 ? new Date(v).toISOString().slice(0, 10) : v);
  const text = "\uFEFF" + [cols.join(","), ...rows.map(r => cols.map(c => q(iso(r[c]))).join(","))].join("\n");
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
async function planAct(act, el) {
  try {
    if (act === "emp-plan-want") { PL.want = el.dataset.plan || null; PL.pay = el.dataset.card ? "card" : ""; PL.months = 1; PL.result = null; put($("#view"), page(planPageHTML())); const f = $('input[name="payHow"]:checked') || $('input[name="payHow"]'); if (f) f.focus(); return; }
    if (act === "emp-plan-pay") { const was = PL.pay; PL.pay = el.value; if ((was === "card") !== (PL.pay === "card")) { put($("#view"), page(planPageHTML())); const f = $(`input[name="payHow"][value="${PL.pay}"]`); if (f) f.focus(); } else { const b2 = $('[data-act="emp-plan-req"]'); if (b2) b2.disabled = false; } return; }
    if (act === "emp-plan-months") { PL.months = Number(el.value) || 1; put($("#view"), page(planPageHTML())); const f = $("#plMonths"); if (f) f.focus(); return; }
    if (act === "emp-plan-card") { busy(el, true); const r = await api.post("/api/employer/plan/checkout", { plan: el.dataset.plan, months: PL.months }); location.href = r.redirectUrl; return; }
    if (act === "emp-plan-req") { await api.post("/api/employer/plan/request", { plan: el.dataset.plan, payMethod: PL.pay, note: ($("#plNote") || {}).value || "" }); PL.want = null; PL.pay = ""; toast({ title: t("tPlanReq"), ic: "check" }); renderPlan(); }
    else if (act === "emp-sponsor" || act === "emp-unsponsor") { await api.post(`/api/employer/jobs/${el.dataset.job}/sponsor`, { on: act === "emp-sponsor" }); toast({ title: t(act === "emp-sponsor" ? "tSponOn" : "tSponOff"), ic: "check" }); await loadEmployer(); if (S.view === "company") renderCompany(); }
    else if (act === "emp-report") { const r = await api.get(`/api/employer/reports/${el.dataset.kind}`); downloadCSV(`shaghilni-${el.dataset.kind}.csv`, r.rows); }
  } catch (err) { toast({ title: errText(err), ic: "alert" }); }
}
/* ---------- admin: billing ---------- */
async function drawBilling() {
  const b = $("#admBody"), B = await api.get("/api/admin/billing"); ADM.billing = B;
  const nm = x => L(bi(x)) || "—", opt = (p, cur) => raw(`<option value="${p}"${p === cur ? " selected" : ""}>${esc(planName(p))}</option>`);
  const planForm = (id, cur) => html`<span class="bill-form"><select class="inp inp--sm" id="bp-${id}" aria-label="${t("blPlan")}">${PLAN_KEYS.map(p => opt(p, cur))}</select><input class="inp inp--sm num" id="bm-${id}" type="text" inputmode="numeric" value="1" aria-label="${t("blMonths")}" title="${t("blMonths")}"><input class="inp inp--sm num" id="ba-${id}" type="text" inputmode="numeric" placeholder="${t("blAmount")}" aria-label="${t("blAmount")}"><button class="btn btn--soft btn--sm" type="button" data-act="adm-plan-set" data-id2="${id}">${t("blSave")}</button></span>`;
  put(b, html`<section class="card bill"><h2 class="card-h">${t("blRequests")}</h2>${B.requests.length ? html`<ul class="alist">${B.requests.map(r => html`<li class="acard"><span class="acard-main"><span class="acard-t">${nm(r.company)}</span><span class="acard-s">${t("blWants", { plan: planName(r.plan) })} · ${r.payMethod ? t("pay_" + r.payMethod) : "—"} · <b class="num" dir="ltr">${r.ref}</b>${r.note ? " · " + r.note : ""}</span></span><span class="acard-act">${planForm(r.companyId, r.plan)}</span></li>`)}</ul>` : html`<p class="empty-p">${t("blNoRequests")}</p>`}</section>
<section class="card bill"><h2 class="card-h">${t("blDue")}</h2>${B.charges.length ? html`<ul class="alist">${B.charges.map(c => html`<li class="acard"><span class="acard-main"><span class="acard-t">${c.programme ? c.programme : nm(c.company)}</span><span class="acard-s">${t("chK_" + c.kind)} · ${c.amountUsd ? "$" + fmt(c.amountUsd) : fmt(c.amountSyp) + " " + t("syp")}</span></span><span class="acard-act"><button class="btn btn--soft btn--sm" type="button" data-act="adm-charge" data-id2="${c.id}" data-to2="paid">${t("blPaid")}</button><button class="link link--muted" type="button" data-act="adm-charge" data-id2="${c.id}" data-to2="void">${t("blVoid")}</button></span></li>`)}</ul>` : html`<p class="empty-p">${t("blNoDue")}</p>`}</section>
<section class="card bill"><h2 class="card-h">${t("blPrograms")}</h2><p class="card-p">${t("blProgramsP")}</p>${B.programmes.length ? html`<ul class="alist">${B.programmes.map(p => html`<li class="acard"><span class="acard-main"><span class="acard-t">${p.name}</span><span class="acard-s">$${fmt(p.rateUsd)} · ${t("blPlacements", { n: fmt(p.placements) })}${p.dueUsd ? " · " + t("blDueUsd", { n: fmt(p.dueUsd) }) : ""}</span></span></li>`)}</ul>` : ""}
<div class="bill-form"><input class="inp inp--sm" id="pgName" placeholder="${t("blProgName")}" aria-label="${t("blProgName")}"><input class="inp inp--sm num" id="pgRate" type="number" min="0" placeholder="${t("blProgRate")}" aria-label="${t("blProgRate")}"><button class="btn btn--soft btn--sm" type="button" data-act="adm-prog-add">${t("blAdd")}</button></div></section>
<section class="card bill"><h2 class="card-h">${t("blCompanies")}</h2><ul class="alist">${B.companies.map(c => html`<li class="acard"><span class="acard-main"><span class="acard-t">${nm(c.name)}</span><span class="acard-s">${planName(c.plan)}${c.planUntil ? " · " + t("blUntil", { d: new Date(c.planUntil).toLocaleDateString(S.lang === "ar" ? "ar-SY" : "en-GB") }) : ""}</span></span><span class="acard-act">${planForm(c.id, c.plan)}</span></li>`)}</ul></section>`);
}
async function billingAct(act, el) {
  const id = el.dataset.id2;
  try {
    if (act === "adm-plan-set") { await api.post(`/api/admin/companies/${id}/plan`, { plan: $("#bp-" + id).value, months: $("#bm-" + id).value, amountSyp: $("#ba-" + id).value /* as typed: the server reads Arabic-Indic digits and grouped figures, and refuses anything else */ }); toast({ title: t("tPlanSet"), ic: "check" }); }
    else if (act === "adm-charge") { await api.post(`/api/admin/charges/${id}/${el.dataset.to2}`); toast({ title: t("tChargeDone"), ic: "check" }); }
    else if (act === "adm-prog-add") { await api.post("/api/admin/programmes", { name: $("#pgName").value, rateUsd: Number($("#pgRate").value) || 0 }); toast({ title: t("tProgAdded"), ic: "check" }); }
    await drawBilling();
  } catch (err) { toast({ title: errText(err), ic: "alert" }); }
}
