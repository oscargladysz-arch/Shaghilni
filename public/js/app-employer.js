/* ---------- employer: company, listings, job form and applicants ---------- */
const JS_TONE = { draft: "pill--muted", pending: "pill--warn", published: "pill--good", rejected: "pill--bad", closed: "pill--muted" };
const CO_TONE = { draft: "pill--muted", pending: "pill--warn", verified: "pill--good", rejected: "pill--bad", suspended: "pill--bad" };
const MOVES = { new: ["shortlisted", "interview", "rejected"], shortlisted: ["interview", "hired", "rejected", "new"], interview: ["hired", "rejected", "shortlisted"], rejected: ["shortlisted", "new"], hired: ["interview"], withdrawn: [] };
const EMP = { job: null, apps: [], appsJob: null };
const page = inner => html`<div class="page scroll"><div class="page-in">${inner}</div></div>`;
const backLink = (to, key) => html`<button class="back" type="button" data-act="go" data-to="${to}">${icon("back", 15, 2.2, "flip")}${t(key)}</button>`;

async function renderCompany() {
  const v = $("#view"), [a, b, c] = S.sub;
  if (!S.emp) {
    put(v, page(stateHTML("spin", t("loading"))));
    try { await loadEmployer(); } catch (err) { put(v, page(stateHTML("alert", errText(err), "", html`<button class="btn btn--soft" type="button" data-act="view" data-view="company">${t("retry")}</button>`))); return; }
    if (S.view !== "company") return;
    renderChrome();
  }
  if (a === "students") { renderStudents(b === "sent" ? "sent" : "find"); return; }
  if (a === "edit") { put(v, page(companyFormHTML())); return; }
  if (a === "plan") { renderPlan(); return; }
  if (a === "analytics") { renderAnalytics(); return; }
  if (a === "team") { renderTeam(); return; }
  if (a === "activity") { renderActivity(); return; }
  if (a === "jobs" && b === "new") { renderJobForm(null); return; }
  if (a === "jobs" && b && c === "applicants") { renderApplicants(Number(b)); return; }
  if (a === "jobs" && b) { renderJobForm(Number(b)); return; }
  put(v, page(dashboardHTML())); EV.emp = null; fillEmpEvents();
  // Refresh quietly, so counts like this month's invitations are always current.
  loadEmployer().then(() => { if (S.view === "company" && !S.sub[0]) { put($("#view"), page(dashboardHTML())); fillEmpEvents(); } }).catch(() => {});
}
function dashboardHTML() {
  const { company: c, jobs, missing } = S.emp;
  if (!c) return noCompanyHTML();
  const canSubmit = c.status === "draft" || c.status === "rejected";
  const p = t("coStatusP_" + c.status, { name: c.contactName || "—", phone: phoneLabel(c.whatsapp || S.user.phone), note: c.reviewNote || "—" });
  return html`<div class="page-head"><h1 class="lh-title">${L(bi(c.name))}</h1>${canDo("manage") ? html`<button class="btn" type="button" data-act="go" data-to="#/company/edit">${icon("edit", 15)}${t("coEdit")}</button>` : html`<span class="pill">${roleName(myRole())}</span>`}</div>
<section class="card"><div class="co-top"><span class="logo" style="--tile:${SECTOR[c.sector] || "#475569"}" aria-hidden="true">${c.abbr}</span>
<div class="co-txt"><span class="pill ${CO_TONE[c.status]}">${t("coStatus_" + c.status)}</span><p class="card-p">${p}</p></div></div>
${canSubmit && missing.length ? html`<p class="note">${icon("info", 15)}<span>${t("err_incomplete", { x: listJoin(missing.map(f => t("field_" + f))) })}</span></p>` : ""}
${canSubmit ? html`<div class="card-act"><button class="btn btn--primary" type="button" data-act="emp-co-submit"${missing.length ? raw(" disabled") : ""}>${icon("check", 15, 2.4)}${t("coSubmit")}</button></div>` : ""}</section>
${c.status === "verified" ? planCardHTML() : ""}${c.status === "verified" ? partnersCardHTML() : ""}${c.status === "verified" ? empEventsHTML() : ""}${c.status === "verified" && canDo("hire") ? html`<section class="card rc-promo"><h2 class="card-h">${icon("cap", 18)}<span>${t("rcEmpH")}</span></h2><p class="card-p">${t("rcEmpP")}</p><div class="card-act"><button class="btn btn--primary" type="button" data-act="go" data-to="#/company/students">${icon("users", 15)}${t("rcFind")}</button><button class="btn btn--ghost" type="button" data-act="go" data-to="#/company/students/sent">${t("rcTabSent")}</button></div></section>` : ""}
<div class="sec-head"><h2 class="sec-h">${t("listingsH")}</h2>${canDo("hire") ? html`<button class="btn btn--primary" type="button" data-act="go" data-to="#/company/jobs/new">${icon("plus", 15)}${t("newJob")}</button>` : ""}</div>
${jobs.some(j => j.postedBy && !j.mine) && jobs.some(j => j.mine) ? html`<div class="chips tm-filter" role="group" aria-label="${t("listingsH")}"><button class="chip" type="button" data-act="tm-mine" aria-pressed="${!TM.mine}">${t("tmAllListings")}</button><button class="chip" type="button" data-act="tm-mine" data-mine="1" aria-pressed="${!!TM.mine}">${t("tmMyListings")}</button></div>` : ""}
${jobs.length ? html`<ul class="alist">${jobs.filter(j => !TM.mine || j.mine).map(listingRow)}</ul>` : stateHTML("brief", t("listingsEmptyH"), canDo("hire") ? t("listingsEmptyP") : t("tmNoListingsHm"))}`;
}
function listingRow(j) {
  const n = (j.counts && j.counts.applicants) || 0;
  return html`<li class="acard"><span class="acard-main"><span class="acard-t">${L(bi(j.title)) || "—"}</span>
<span class="acard-s">${j.gov && GOV[j.gov] ? L(GOV[j.gov]) : "—"} · ${j.pay && j.pay[0] ? payText(j).main : "—"}</span>
<span class="acard-meta"><span class="pill ${JS_TONE[j.status]}">${t("js_" + j.status)}</span>${j.flags && j.flags.length ? html`<span>${t(j.flags[0].type === "contact" ? "adFlagContact" : j.flags[0].type === "fee" ? "adFlagFee" : "adFlagGender", { x: j.flags[0].word })}</span>` : ""}${j.status === "rejected" && j.reviewNote ? html`<span>${t("jNote", { note: j.reviewNote })}</span>` : ""}${j.postedBy ? html`<span>${t("tmPostedBy", { name: j.postedBy })}</span>` : ""}</span></span>
<span class="acard-act"><button class="btn btn--soft" type="button" data-act="go" data-to="#/company/jobs/${j.id}/applicants">${icon("user", 15)}${tn("jApplicants", n)}</button>
${canDo("hire") ? html`<button class="btn btn--ghost" type="button" data-act="go" data-to="#/company/jobs/${j.id}">${icon("edit", 15)}${t("jEdit")}</button>` : ""}
${canDo("hire") && (j.status === "draft" || j.status === "rejected") ? html`<button class="btn btn--ghost" type="button" data-act="emp-job-submit" data-job="${j.id}">${t("jSubmit")}</button>` : ""}
${canDo("manage") && j.status === "published" && j.sponsored ? html`<span class="pill pill--spon">${t("sponsoredUntil", { d: new Date(j.sponsoredUntil).toLocaleDateString(S.lang === "ar" ? "ar-SY" : "en-GB") })}</span><button class="link link--muted" type="button" data-act="emp-unsponsor" data-job="${j.id}">${t("sponStop")}</button>` : ""}
${canDo("manage") && j.status === "published" && !j.sponsored && S.emp.plan && S.emp.plan.limits.sponsored ? html`<button class="btn btn--ghost" type="button" data-act="emp-sponsor" data-job="${j.id}">${icon("spark", 15)}${t("sponBtn")}</button>` : ""}
${canDo("billing") && j.status === "published" && S.emp.plan && !S.emp.plan.limits.sponsored ? html`<button class="btn btn--ghost" type="button" data-act="go" data-to="#/company/plan" title="${t("sponLocked")}">${icon("spark", 15)}${t("sponBtn")}<span class="pill pill--spon">${t("pl_pro")}</span></button>` : ""}
${canDo("hire") && j.status === "published" ? html`<button class="link link--muted" type="button" data-act="emp-job-close" data-job="${j.id}">${t("jClose")}</button>` : ""}
${canDo("hire") && j.status === "closed" ? html`<button class="link" type="button" data-act="emp-job-reopen" data-job="${j.id}">${t("jReopen")}</button>` : ""}</span></li>`;
}

/* Company details */
function companyFormHTML() {
  const c = (S.emp && S.emp.company) || {}, nm = c.name || {}, ab = c.about || {};
  const fLg = id => (/Ar$/.test(id) ? "ar" : /En$/.test(id) ? "en" : "");   // bilingual fields ask in their own language
  const f = (id, key, val, extra = "") => html`<div class="field"${fLg(id) ? raw(` lang="${fLg(id)}" dir="${fLg(id) === "ar" ? "rtl" : "ltr"}"`) : ""}><label class="lbl" for="${id}">${fLg(id) ? tl(fLg(id), key) : t(key)}</label><input class="inp" id="${id}" value="${val || ""}"${raw(extra)}></div>`;
  return html`${backLink("#/company", "coTitle")}<h1 class="lh-title">${t(c.id ? "coEdit" : "coCreate")}</h1>
<section class="card form">
<div class="grid2">${f("coNameAr", "coNameAr", nm.ar, ' dir="rtl" lang="ar"')}${f("coNameEn", "coNameEn", nm.en, ' dir="ltr" lang="en"')}</div>
<div class="grid2"><div class="field"><label class="lbl" for="coSector">${t("coSector")}</label><select class="inp" id="coSector">${optList(Object.keys(SECTOR), k => t("sec_" + k), c.sector || "trade")}</select></div>
<div class="field"><label class="lbl" for="coCat">${t("coCat")}</label><select class="inp" id="coCat">${optList(Object.keys(CAT), k => L(CAT[k]), c.cat || "domestic")}</select></div></div>
<div class="grid2"><div class="field"><label class="lbl" for="coGov">${t("coGov")}</label><select class="inp" id="coGov">${optList(GOV_ORDER.filter(k => k !== "remote"), k => L(GOV[k]), c.gov, t("obPick"))}</select></div>
${f("coRegNo", "coRegNo", c.regNo, ' dir="ltr" autocomplete="off"')}</div>
<p class="hint">${t("coRegHint")}</p>
<div class="grid2">${f("coContact", "coContact", c.contactName, ' autocomplete="name"')}</div>
<fieldset class="fset ap-ways"><legend class="lbl">${t("coWaysH")}</legend><p class="hint">${t("coWaysP")}</p>
<label class="tick"><input type="checkbox" checked disabled><span>${t("coWayShg")}</span></label>
<div class="ap-way"><label class="tick"><input type="checkbox" id="coViaWa"${!c.applyVia || c.applyVia.whatsapp ? raw(" checked") : ""}><span>${icon("chat", 15)}${t("coWayWa")}</span></label>
<input class="inp" id="coWhatsapp" type="tel" inputmode="tel" dir="ltr" placeholder="09•• ••• •••" value="${c.whatsapp || ""}" aria-label="${t("coWhatsapp")}"></div>
<div class="ap-way"><label class="tick"><input type="checkbox" id="coViaCall"${c.applyVia && c.applyVia.call ? raw(" checked") : ""}><span>${icon("phone", 15)}${t("coWayCall")}</span></label>
<input class="inp" id="coApplyPhone" type="tel" inputmode="tel" dir="ltr" placeholder="09•• ••• •••" value="${c.applyPhone || ""}" aria-label="${t("coApplyPhoneL")}"></div>
<div class="ap-way"><label class="tick"><input type="checkbox" id="coViaEmail"${c.applyVia && c.applyVia.email ? raw(" checked") : ""}><span>${icon("send", 15)}${t("coWayEmail")}</span></label>
<input class="inp" id="coApplyEmail" type="email" dir="ltr" placeholder="jobs@example.com" value="${c.applyEmail || ""}" aria-label="${t("coApplyEmailL")}"></div></fieldset>
<p class="hint">${t("coWhatsappHint")}</p>
${f("coWebsite", "coWebsite", c.website, ' type="url" dir="ltr" placeholder="https://"')}
<div class="field" lang="ar" dir="rtl"><label class="lbl" for="coAboutAr">${tl("ar", "coAboutAr")}</label><textarea class="inp inp--area" id="coAboutAr" dir="rtl" lang="ar">${ab.ar || ""}</textarea></div>
<div class="field" lang="en" dir="ltr"><label class="lbl" for="coAboutEn">${tl("en", "coAboutEn")}</label><textarea class="inp inp--area" id="coAboutEn" dir="ltr" lang="en">${ab.en || ""}</textarea></div>
${c.status === "verified" ? html`<p class="note">${icon("info", 15)}<span>${t("coReverify")}</span></p>` : ""}
<div class="card-act"><button class="btn btn--primary btn--lg" type="button" data-act="emp-co-save">${icon("check", 15, 2.4)}${t("coSave")}</button></div></section>`;
}
function readCompany() {
  const v = id => ($("#" + id) ? $("#" + id).value.trim() : "");
  return { name: { en: v("coNameEn"), ar: v("coNameAr") }, sector: v("coSector"), cat: v("coCat"), gov: v("coGov"), regNo: v("coRegNo"),
           contactName: v("coContact"), whatsapp: v("coWhatsapp"), applyPhone: v("coApplyPhone"), applyEmail: v("coApplyEmail"), applyVia: { whatsapp: !!($("#coViaWa") || {}).checked, call: !!($("#coViaCall") || {}).checked, email: !!($("#coViaEmail") || {}).checked }, website: v("coWebsite"), about: { en: v("coAboutEn"), ar: v("coAboutAr") } };
}

/* Job listing form, with the same live posting checks the server enforces */
function blankJob() {
  return { title: { en: "", ar: "" }, place: { en: "", ar: "" }, gov: "", type: "full", level: "entry", mode: "onsite", pay: [0, 0], langs: ["ar"], recruits: [],
    anyFaculty: false, noDegree: false, support: false, openings: 1, summary: { en: "", ar: "" }, duties: { en: [], ar: [] }, needs: { en: [], ar: [] },
    provides: { en: [], ar: [] }, contact: { name: { en: "", ar: "" }, role: { en: "", ar: "" }, status: { en: "", ar: "" } }, tags: "" };
}
function renderJobForm(id) {
  const v = $("#view");
  if (!EMP.job || EMP.job.id !== id) {
    const j = id ? S.emp.jobs.find(x => x.id === id) : null;
    if (id && !j) { put(v, page(html`${backLink("#/company", "coTitle")}${stateHTML("alert", t("err_not_found"))}`)); return; }
    const base = blankJob(), d = j ? JSON.parse(JSON.stringify(j)) : base;
    for (const k of Object.keys(base)) if (d[k] == null) d[k] = base[k];
    for (const k of ["title", "place", "summary"]) d[k] = { en: (d[k] && d[k].en) || "", ar: (d[k] && d[k].ar) || "" };
    for (const k of ["duties", "needs", "provides"]) d[k] = { en: (d[k] && d[k].en) || [], ar: (d[k] && d[k].ar) || [] };
    EMP.job = { id, status: j ? j.status : "draft", d };
  }
  const { d, status } = EMP.job;
  // A field answered in one language asks its question in that language too, whatever language the page is in.
  const fl = path => (!path.startsWith("contact.") && (/\.(ar|en)$/.exec(path) || [])[1]) || "";
  const dirOf = lg => (lg ? raw(` lang="${lg}" dir="${lg === "ar" ? "rtl" : "ltr"}"`) : "");
  const lbl = (path, key) => html`<label class="lbl" for="jf-${path}">${fl(path) ? tl(fl(path), key) : t(key)}</label>`;
  const inp = (path, key, val, extra = "") => html`<div class="field"${dirOf(fl(path))}>${lbl(path, key)}<input class="inp" id="jf-${path}" data-jf="${path}" value="${val}"${raw(extra)}></div>`;
  const area = (path, key, val, lg) => html`<div class="field"${dirOf(fl(path))}>${lbl(path, key)}<textarea class="inp inp--area" id="jf-${path}" data-jf="${path}" dir="${lg === "ar" ? "rtl" : "ltr"}" lang="${lg}">${Array.isArray(val) ? val.join("\n") : val}</textarea></div>`;
  const sel = (path, key, keys, label, cur, ph) => html`<div class="field"><label class="lbl" for="jf-${path}">${t(key)}</label><select class="inp" id="jf-${path}" data-jf="${path}">${optList(keys, label, cur, ph)}</select></div>`;
  const tick = (path, key) => html`<label class="tick"><input type="checkbox" data-jf="${path}"${d[path] ? raw(" checked") : ""}><span>${t(key)}</span></label>`;
  put(v, page(html`${backLink("#/company", "coTitle")}<h1 class="lh-title">${t(id ? "jfEdit" : "jfNew")}</h1>
${status === "published" ? html`<p class="note">${icon("info", 15)}<span>${t("jfEditNote")}</span></p>` : ""}
<p class="hint">${t("jfLangHint")}</p>
<section class="card form jf">
<div class="grid2">${inp("title.ar", "jfTitleAr", d.title.ar, ' dir="rtl" lang="ar"')}${inp("title.en", "jfTitleEn", d.title.en, ' dir="ltr" lang="en"')}</div>
<div class="grid2">${sel("gov", "jfGov", GOV_ORDER, k => L(GOV[k]), d.gov, t("obPick"))}${inp("openings", "jfOpenings", d.openings, ' inputmode="numeric" dir="ltr"')}</div>
<div class="grid2">${inp("place.ar", "jfPlaceAr", d.place.ar, ' dir="rtl" lang="ar"')}${inp("place.en", "jfPlaceEn", d.place.en, ' dir="ltr" lang="en"')}</div>
<div class="grid3">${sel("type", "jfType", Object.keys(TYPE), k => L(TYPE[k]), d.type)}${sel("level", "jfLevel", Object.keys(LEVEL), k => L(LEVEL[k]), d.level)}${sel("mode", "jfMode", Object.keys(MODE), k => L(MODE[k]), d.mode)}</div>
<div class="grid2">${inp("pay.0", "pPayMin", d.pay[0] || "", ' inputmode="numeric" dir="ltr" class="num"')}${inp("pay.1", "pPayMax", d.pay[1] || "", ' inputmode="numeric" dir="ltr"')}</div>
<div class="field"><span class="lbl">${t("jfLangs")}</span><div class="chips">${Object.keys(LANGS).map(l => html`<button class="chip" type="button" data-act="emp-jf-lang" data-l="${l}" aria-pressed="${d.langs.includes(l) ? "true" : "false"}">${L(LANGS[l])}</button>`)}</div></div>
${area("summary.ar", "jfSummaryAr", d.summary.ar, "ar")}${area("summary.en", "jfSummaryEn", d.summary.en, "en")}
${area("duties.ar", "jfDutiesAr", d.duties.ar, "ar")}${area("duties.en", "jfDutiesEn", d.duties.en, "en")}
${area("needs.ar", "jfNeedsAr", d.needs.ar, "ar")}${area("needs.en", "jfNeedsEn", d.needs.en, "en")}
${area("provides.ar", "jfProvidesAr", d.provides.ar, "ar")}${area("provides.en", "jfProvidesEn", d.provides.en, "en")}
<div class="field"><span class="lbl">${t("jfRecruits")}</span>
${d.recruits.length ? html`<ul class="rec-list">${d.recruits.map(([u, f], i) => html`<li>${L(UNI[u])} · ${L(FAC[f])}<button class="ibtn" type="button" data-act="emp-jf-unrec" data-i="${i}" aria-label="${t("close")}">${icon("x", 13, 2.2)}</button></li>`)}</ul>` : ""}
<div class="grid3"><select class="inp" id="jfRecUni" aria-label="${t("obUni")}">${optList(UNI_ORDER, k => L(UNI[k]), "", t("obPick"))}</select><select class="inp" id="jfRecFac" aria-label="${t("obFac")}">${optList(facKeysSorted(), k => L(FAC[k]), "", t("obPick"))}</select><button class="btn" type="button" data-act="emp-jf-rec">${icon("plus", 15)}${t("jfAddRecruit")}</button></div></div>
<div class="ticks">${tick("anyFaculty", "jfAnyFaculty")}${tick("noDegree", "jfNoDegree")}${tick("support", "jfSupport")}${tick("returnees", "jfReturnees")}</div>
<fieldset class="fset jf-prog"><legend class="lbl">${t("progH")}</legend><p class="hint">${t("progHint")}</p><div class="chips">${Object.keys(UNI).map(k => html`<label class="tick"><input type="checkbox" data-jf-uni="${k}"${(d.unis || []).includes(k) ? raw(" checked") : ""}><span>${L(UNI[k])}</span></label>`)}</div>
<div class="grid2"><div class="field"><label class="lbl" for="jfPs">${t("progStartL")}</label><input class="inp" id="jfPs" type="month" data-jf="progStart" value="${d.progStart || ""}"></div><div class="field"><label class="lbl" for="jfPe">${t("progEndL")}</label><input class="inp" id="jfPe" type="month" data-jf="progEnd" value="${d.progEnd || ""}"></div></div></fieldset>
<div class="grid2">${inp("contact.name.ar", "jfContactName", d.contact.name.ar || d.contact.name.en, ' autocomplete="name"')}${inp("contact.role.ar", "jfContactRole", d.contact.role.ar || d.contact.role.en)}</div>
<div class="lint" aria-live="polite"><p class="lbl">${t("jfChecks")}</p><div id="lintRows"></div></div>
<div class="card-act"><button class="btn btn--lg" type="button" data-act="emp-jf-save">${t("jfSaveDraft")}</button><button class="btn btn--primary btn--lg" type="button" data-act="emp-jf-submit">${icon("check", 15, 2.4)}${t("jfSubmit")}</button></div>
</section>`));
  jfLint();
}
function jfInput(el) {
  const d = EMP.job && EMP.job.d; if (!d) return;
  if (el.dataset.jfUni) { const k = el.dataset.jfUni, set = new Set(d.unis || []); if (el.checked) set.add(k); else set.delete(k); d.unis = [...set]; jfLint(); return; }
  const path = el.dataset.jf, parts = path.split(".");
  let val = el.type === "checkbox" ? el.checked : el.value;
  if (/^(duties|needs|provides)\./.test(path)) val = val.split("\n").map(x => x.trim()).filter(Boolean);
  if (path === "openings") val = Math.max(1, parseInt(val, 10) || 1);
  if (/^pay\./.test(path)) val = parseMoney(val);
  if (path === "contact.name.ar" || path === "contact.role.ar") { const k = parts[1]; d.contact[k] = { en: val, ar: val }; jfLint(); return; }
  let o = d; for (let i = 0; i < parts.length - 1; i++) o = o[parts[i]];
  o[parts[parts.length - 1]] = val;
  jfLint();
}
function jfLint() {
  if (!$("#lintRows") || !EMP.job) return {};
  const d = EMP.job.d, text = [d.title.en, d.title.ar, d.summary.en, d.summary.ar, ...d.duties.en, ...d.duties.ar, ...d.needs.en, ...d.needs.ar].join(" ");
  const g = findGender(text), f = findFee(text), lo = d.pay[0] || 0, hi = Math.max(d.pay[1] || 0, lo);
  const rows = [
    lo > 0 ? ["ok", t("lintPayOk", { pay: postPayText(lo, hi) })] : ["part", t("lintPayMiss")],
    d.gov ? ["ok", t("lintGovOk", { gov: L(GOV[d.gov]) })] : ["part", t("lintGovMiss")],
    g ? ["warn", t("lintGenderHit", { w: g })] : ["ok", t("lintGenderOk")],
    f ? ["no", t("lintFeeHit", { w: f })] : ["ok", t("lintFeeOk")]
  ];
  put($("#lintRows"), html`${rows.map(([st, x]) => html`<div class="lint-row"><span class="state state--${st}" aria-hidden="true">${STATE_ICON[st]()}</span><span>${x}</span></div>`)}`);
  return { fee: !!f };
}
async function saveJob(submit, btn) {
  const J = EMP.job; if (!J) return;
  busy(btn, true);
  try {
    const r = J.id ? await api.put(`/api/employer/jobs/${J.id}`, { job: J.d }) : await api.post("/api/employer/jobs", { job: J.d });
    J.id = r.job.id;
    if (submit) await api.post(`/api/employer/jobs/${J.id}/submit`);
    await loadEmployer();
    EMP.job = null;
    toast({ title: t(submit ? "tJobSubmitted" : "tJobSaved"), sub: L(bi(r.job.title)), ic: "check" });
    go("#/company");
  } catch (err) {
    if (J.id) { history.replaceState(null, "", `#/company/jobs/${J.id}`); S.sub = ["jobs", String(J.id)]; }
    await loadEmployer().catch(() => {});
    toast({ title: errText(err), ic: "alert" });
  } finally { busy(btn, false); }
}

/* Applicants for one listing */
async function renderApplicants(jobId) {
  const v = $("#view"), j = S.emp.jobs.find(x => x.id === jobId);
  if (!j) { put(v, page(html`${backLink("#/company", "coTitle")}${stateHTML("alert", t("err_not_found"))}`)); return; }
  put(v, page(html`${backLink("#/company", "backAll")}<h1 class="lh-title">${t("apH")}</h1><p class="lh-sub">${L(bi(j.title))}</p><div id="apList">${stateHTML("spin", t("loading"))}</div>`));
  try { EMP.apps = (await api.get(`/api/employer/jobs/${jobId}/applications`)).applications; EMP.appsJob = jobId; }
  catch (err) { const box = $("#apList"); if (box) put(box, stateHTML("alert", errText(err))); return; }
  drawApplicants();
}
function drawApplicants() {
  const box = $("#apList"); if (!box) return;
  if (!EMP.apps.length) { put(box, stateHTML("inbox", t("apEmptyH"), t("apEmptyP"))); return; }
  put(box, html`<ul class="alist">${EMP.apps.map(a => {
    const p = a.profile || {}, P = p.deleted ? null : deriveProfile(p);
    return html`<li class="acard acard--ap" id="ap-${a.id}"><span class="acard-main">
<span class="acard-t">${P ? L(P.name) : "—"}${a.verifiedUni ? html` <span class="sv-badge">${icon("shield", 12)}${t("svBadge", { uni: UNI[a.verifiedUni] ? L(UNI[a.verifiedUni]) : a.verifiedUni })}</span>` : ""}</span><span class="acard-s">${P ? [L(P.facYear), p.gov && GOV[p.gov] ? L(GOV[p.gov]) : ""].filter(Boolean).join(" · ") : t("apDeleted")}</span>
<span class="acard-meta"><span class="pill ${APP_TONE[a.status] || ""}">${t("est_" + a.status)}</span><span>${t("apApplied", { when: dayLabel(a.createdAt) })}</span>${a.cvLang ? html`<span>${t("apCvTag", { lang: trLang(a.cvLang) })}</span>` : ""}${a.channel && a.channel !== "web" ? html`<span>${t("appVia_" + a.channel)}</span>` : ""}${a.status === "hired" && !a.hireConfirmed ? html`<span>${t("apHiredNote")}</span>` : ""}</span>
${P ? html`<span class="acard-act">
${a.phone ? html`<a class="btn btn--ghost" href="tel:${a.phone}">${icon("phone", 15)}${t("apCall")}</a><a class="btn btn--ghost" href="https://wa.me/${a.phone.replace(/\D/g, "")}" target="_blank" rel="noopener">${icon("chat", 15)}WhatsApp</a>` : ""}
<button class="btn btn--soft" type="button" data-act="emp-resume" data-app="${a.id}">${icon("doc", 15)}${t("apResume")}</button></span>
${a.movedBy || a.noteBy ? html`<span class="tm-by">${[a.movedBy ? t("tmMovedBy", { name: a.movedBy }) : "", a.noteBy ? t("tmNoteBy", { name: a.noteBy }) : ""].filter(Boolean).join(" · ")}</span>` : ""}
${canDo("hire") && (MOVES[a.status] || []).length && !a.hireConfirmed ? html`<span class="moves"><span class="lbl">${t("apMove")}</span>${MOVES[a.status].map(s => html`<button class="chip" type="button" data-act="emp-move" data-app="${a.id}" data-to="${s}">${t("est_" + s)}</button>`)}</span>` : ""}
<span class="field"><label class="lbl" for="apNote-${a.id}">${t("apNote")}</label><textarea class="inp inp--note" id="apNote-${a.id}">${a.note}</textarea>
<button class="link" type="button" data-act="emp-note" data-app="${a.id}">${t("apSaveNote")}</button></span>` : ""}
</span></li>`;
  })}</ul>`);
}
/* The resume opens in the language the applicant chose to send (older applications: the language they wrote in); the employer can switch. */
function openApplicantResume(appId) {
  const a = EMP.apps.find(x => x.id === appId); if (!a || !a.profile || a.profile.deleted) return;
  const p = a.profile, text = [p.name, ...(p.exp || []).map(e => e.role + " " + (e.bullets || []).join(" "))].join(" ");
  const lg = a.cvLang || (/[\u0600-\u06FF]/.test(text) ? "ar" : "en");
  layerOpen(html`${panelHead("apResume", L(deriveProfile(p).name))}<div class="p-body scroll">
<div class="seg2" role="group" aria-label="${t("cvLangLbl")}">${["ar", "en"].map(l => html`<button class="seg2-btn" type="button" data-act="emp-resume-lang" data-app="${appId}" data-l="${l}" lang="${l}" aria-pressed="${l === lg ? "true" : "false"}">${l === "ar" ? "العربية" : "English"}</button>`)}</div>
${a.cvLang ? html`<p class="ap-sent">${t("apSentIn", { lang: trLang(a.cvLang) })}</p>` : ""}
<div class="paper-wrap" id="apPaper">${paperHTML(buildResume(p, String(EMP.appsJob), lg))}</div></div>`,
    { label: t("apResume"), returnFocus: document.activeElement });
}
async function moveApp(appId, to, btn) {
  busy(btn, true);
  try {
    await api.put(`/api/employer/applications/${appId}`, { status: to });
    const a = EMP.apps.find(x => x.id === appId); if (a) a.status = to;
    toast({ title: t("tMoved", { x: t("est_" + to) }), ic: "check" });
    drawApplicants(); loadEmployer().catch(() => {});
  } catch (err) { toast({ title: errText(err), ic: "alert" }); busy(btn, false); }
}

async function empAct(act, el) {
  if (act === "tm-mine") { TM.mine = !!el.dataset.mine; return renderCompany(); }
  if (act.startsWith("tm-")) return teamAct(act, el);
  if (/^emp-(plan-req|plan-want|plan-pay|plan-months|plan-card|sponsor|unsponsor|report)$/.test(act)) return planAct(act, el);
  const jobId = el.dataset.job ? Number(el.dataset.job) : null;
  const call = async (fn, okKey) => {
    busy(el, true);
    try { await fn(); await loadEmployer(); toast({ title: t(okKey), ic: "check" }); renderCompany(); renderChrome(); }
    catch (err) { toast({ title: errText(err), ic: "alert" }); busy(el, false); }
  };
  switch (act) {
    case "emp-co-save": busy(el, true);
      try { await api.put("/api/employer/company", { company: readCompany() }); await loadEmployer(); toast({ title: t("tCoSaved"), ic: "check" }); go("#/company"); renderChrome(); }
      catch (err) {
        if (err.code === "company_exists") { TM.prefill = err.detail || (err.body && err.body.detail) || null; TM.pick = null; busy(el, false); go("#/company"); return; }
        toast({ title: errText(err), ic: "alert" }); busy(el, false); }
      break;
    case "emp-co-submit": call(() => api.post("/api/employer/company/submit"), "tCoSubmitted"); break;
    case "emp-job-submit": call(() => api.post(`/api/employer/jobs/${jobId}/submit`), "tJobSubmitted"); break;
    case "emp-job-close": call(() => api.post(`/api/employer/jobs/${jobId}/close`), "tJobClosed"); break;
    case "emp-job-reopen": call(() => api.post(`/api/employer/jobs/${jobId}/reopen`), "tJobReopened"); break;
    case "emp-jf-save": saveJob(false, el); break;
    case "emp-jf-submit": saveJob(true, el); break;
    case "emp-jf-lang": { const d = EMP.job.d, l = el.dataset.l, i = d.langs.indexOf(l);
      if (i >= 0) d.langs.splice(i, 1); else d.langs.push(l);
      el.setAttribute("aria-pressed", i >= 0 ? "false" : "true"); break; }
    case "emp-jf-rec": { const u = $("#jfRecUni").value, f = $("#jfRecFac").value, d = EMP.job.d;
      if (u && f && !d.recruits.some(r => r[0] === u && r[1] === f)) { d.recruits.push([u, f]); renderJobForm(EMP.job.id); } break; }
    case "emp-jf-unrec": EMP.job.d.recruits.splice(Number(el.dataset.i), 1); renderJobForm(EMP.job.id); break;
    case "emp-resume": openApplicantResume(Number(el.dataset.app)); break;
    case "emp-resume-lang": { const a = EMP.apps.find(x => x.id === Number(el.dataset.app)), box = $("#apPaper"); if (!a || !box) break;
      put(box, paperHTML(buildResume(a.profile, String(EMP.appsJob), el.dataset.l)));
      for (const b of $$('[data-act="emp-resume-lang"]')) b.setAttribute("aria-pressed", b.dataset.l === el.dataset.l ? "true" : "false"); break; }
    case "emp-move": moveApp(Number(el.dataset.app), el.dataset.to, el); break;
    case "emp-note": { const id = Number(el.dataset.app), ta = $("#apNote-" + id); busy(el, true);
      try { await api.put(`/api/employer/applications/${id}`, { note: ta.value }); const a = EMP.apps.find(x => x.id === id); if (a) a.note = ta.value; toast({ title: t("tNoteSaved"), ic: "check" }); }
      catch (err) { toast({ title: errText(err), ic: "alert" }); }
      busy(el, false); break; }
  }
}
