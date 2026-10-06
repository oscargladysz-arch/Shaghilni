/* ---------- onboarding (first visit: motion is allowed some delight here) ---------- */
// A sign-up that started at the phone number keeps counting from it, so the steps never renumber halfway.
const obSteps = () => (OB.mode === "signin" ? ["account"] : OB.mode === "edit" || (OB.mode === "profile" && !OB.fromNew) ? OB_STEPS.slice(1) : OB_STEPS);
/* Consent sentence with links to the two documents; they open in a new tab so onboarding stays where it is. */
const docLink = (doc, key) => html`<a class="link" href="/#/${doc}" target="_blank" rel="noopener">${t(key)}</a>`;
function consentHTML() {
  return html`${t("obConsent").split(/(\{terms\}|\{privacy\})/).map(part => (part === "{terms}" ? docLink("terms", "termsTitle") : part === "{privacy}" ? docLink("privacy", "privacyTitle") : part))}`;
}
const legalLinks = () => html`${docLink("privacy", "privacyTitle")} · ${docLink("terms", "termsTitle")}`;
function obErr(path) { const k = OB.errors[path]; return k ? html`<p class="err" id="obErr-${path.replace(/\./g, "-")}">${t(k)}</p>` : ""; }
function obInv(path) { return OB.errors[path] ? raw(` aria-invalid="true" aria-describedby="obErr-${path.replace(/\./g, "-")}"`) : ""; }
function pickBtn(path, val, label) { const on = (getPath(OB.d, path) || []).includes(val); return html`<button class="pick" type="button" data-act="onb-pick" data-path="${path}" data-val="${val}" aria-pressed="${on ? "true" : "false"}">${label}</button>`; }
function setBtn(path, val, label) { const on = String(getPath(OB.d, path)) === String(val); return html`<button class="seg2-btn" type="button" data-act="onb-set" data-path="${path}" data-val="${val}" aria-pressed="${on ? "true" : "false"}">${label}</button>`; }
function entryList(d, ctx) {
  const all = [...d.exp.map(e => ({ e, kind: "exp" })), ...d.acts.map(e => ({ e, kind: "acts" }))];
  if (!all.length) return "";
  return html`<ul class="entries">${all.map(({ e, kind }) => html`<li class="entry"><span><span class="entry-h">${e.role}, ${e.org}</span><span class="entry-s">${t(kind === "exp" ? "kindExp" : "kindAct")}, ${fmtRange(e, S.lang)}</span></span>
<span class="entry-act"><button class="ibtn" type="button" data-act="${ctx}-edit" data-kind="${kind}" data-eid="${e.id}" aria-label="${t("editX", { x: e.role })}">${icon("edit", 15)}</button><button class="ibtn" type="button" data-act="${ctx}-del" data-kind="${kind}" data-eid="${e.id}" aria-label="${t("removeX", { x: e.role })}">${icon("trash", 15)}</button></span></li>`)}</ul>`;
}
function efErr(f, k) { return f.errors[k] ? html`<p class="err">${t(f.errors[k])}</p>` : ""; }
function efInv(f, k) { return f.errors[k] ? raw(' aria-invalid="true"') : ""; }
function monthPick(id, key, m, y, labelId, f) {
  const ys = []; for (let yy = 2026; yy >= 1995; yy--) ys.push(yy);
  return html`<div class="mpick"><select class="inp" id="${id}" data-ef="${key}.m" aria-labelledby="${labelId}"${efInv(f, key)}>${optList([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], mm => MONTHS[S.lang][mm - 1], m, t("efMonth"))}</select><select class="inp" data-ef="${key}.y" aria-labelledby="${labelId}"${efInv(f, key)}>${optList(ys, yy => String(yy), y, t("efYear"))}</select></div>`;
}
function entryFormHTML(f, ctx) {
  const p = ctx === "onb" ? "ob" : "cv", ex = f.kind === "exp";
  return html`<div class="eform" role="group" aria-label="${t(ex ? "obAddExp" : "obAddAct")}">
<div class="grid2"><div class="field"><label class="lbl" for="${p}Role">${t(ex ? "efRole" : "efRoleAct")}</label><input class="inp" id="${p}Role" data-ef="role" value="${f.role}"${efInv(f, "role")}>${efErr(f, "role")}</div>
<div class="field"><label class="lbl" for="${p}Org">${t(ex ? "efOrg" : "efOrgAct")}</label><input class="inp" id="${p}Org" data-ef="org" value="${f.org}"${efInv(f, "org")}>${efErr(f, "org")}</div></div>
<div class="field"><label class="lbl" for="${p}Place">${t("efPlace")}</label><input class="inp" id="${p}Place" data-ef="place" value="${f.place}"></div>
<div class="grid2"><div class="field"><span class="lbl" id="${p}StartL">${t("efStart")}</span>${monthPick(p + "Start", "start", f.sm, f.sy, p + "StartL", f)}${efErr(f, "start")}</div>
<div class="field"><span class="lbl" id="${p}EndL">${t("efEnd")}</span>${f.current ? html`<p class="now">${t("present")}</p>` : monthPick(p + "End", "end", f.em, f.ey, p + "EndL", f)}${efErr(f, "end")}</div></div>
<label class="tick"><input type="checkbox" data-ef="current"${f.current ? raw(" checked") : ""}><span>${t(ex ? "efCurrent" : "efCurrentAct")}</span></label>
<div class="field"><label class="lbl" for="${p}Bullets">${t("efBullets")}</label><textarea class="inp inp--area" id="${p}Bullets" data-ef="bullets" placeholder="${t("efBulletsPh")}">${f.bullets}</textarea><p class="hint">${t("efBulletsHint")}</p></div>
<div class="eform-act"><button class="btn btn--ghost" type="button" data-act="${ctx}-cancel">${t("cancel")}</button><button class="btn btn--primary" type="button" data-act="${ctx}-save">${t("efSave")}</button></div>
</div>`;
}
function skillsEditor(d, ctx) {
  return html`<div class="field"><label class="lbl" for="${ctx}Skill">${t("obSkills")}</label>
<div class="addrow"><input class="inp" id="${ctx}Skill" data-skill="${ctx}" enterkeyhint="done" placeholder="${t("obSkillPh")}"><button class="btn" type="button" data-act="${ctx}-skill">${t("obAdd")}</button></div>
${d.skills.length ? html`<div class="chips">${d.skills.map((s, i) => html`<span class="tag">${s}<button class="tag-x" type="button" data-act="${ctx}-unskill" data-i="${i}" aria-label="${t("removeX", { x: s })}">${icon("x", 11, 2.6)}</button></span>`)}</div>` : ""}</div>`;
}
function addSkill(d, ctx) {
  const inp = $("#" + ctx + "Skill"); if (!inp) return;
  for (const part of inp.value.split(/[,،]/)) { const v = part.trim(); if (v && !d.skills.some(s => norm(s) === norm(v))) d.skills.push(v); }
  inp.value = "";
}
const OB_RENDER = {
  welcome: () => html`<p class="word" lang="ar" dir="rtl" aria-hidden="true">شغّلني</p>
<h1 class="h-display" tabindex="-1">${t("obWelcomeH")}</h1><p class="lead">${t("obWelcomeP")}</p>
${OB.reason ? html`<p class="note">${icon("info", 15)}<span>${OB.reason}</span></p>` : ""}
<div class="roles">${[["student", "cap", "obRoleStudent", "obRoleStudentP"], ["seeker", "brief", "obRoleSeeker", "obRoleSeekerP"], ["employer", "building", "obRoleEmployer", "obRoleEmployerP"]].map(([r, ic, h, p], i) =>
  html`<button class="role" type="button" data-act="onb-role" data-role="${r}" style="--i:${i}"><span class="role-ic" aria-hidden="true">${icon(ic, 20)}</span><span><span class="role-h">${t(h)}</span><span class="role-p">${t(p)}</span></span></button>`)}</div>
${typeof demoWelcomeHTML === "function" ? demoWelcomeHTML() : ""}
<div class="alt"><button class="btn" type="button" data-act="onb-browse">${t("obBrowse")}</button><button class="link" type="button" data-act="signin">${t("signInLink")}</button></div>
<p class="privacy">${icon("lock", 13)}<span>${t("obPrivacy")} ${legalLinks()}</span></p>`,
  account: () => html`<h2 class="h-step" tabindex="-1">${t(OB.mode === "signin" ? "loginH" : "obAccountH")}</h2><p class="p-step">${t(OB.role === "employer" ? "employerSignInP" : OB.mode === "signin" ? "loginP" : "obAccountP")}</p>
${OB.reason ? html`<p class="note">${icon("info", 15)}<span>${OB.reason}</span></p>` : ""}
<div class="field"><label class="lbl" for="obPhone">${t("obPhone")}</label><div class="phone"><select class="phone-cc phone-sel" id="obCc" data-obx="cc" aria-label="${t("obCc")}">${DIAL.map(([c, k]) => raw(`<option value="${c}"${(OB.cc || "963") === c ? " selected" : ""}>+${c} ${esc(k === "sy" ? t("sySyria") : L(COUNTRY[k]))}</option>`))}</select><input class="inp" id="obPhone" data-obx="phone" type="tel" inputmode="tel" autocomplete="tel-national" dir="ltr" placeholder="9•• ••• •••" value="${OB.phoneRaw}"${OB.codeSent ? raw(" readonly") : ""}${obInv("phone")}></div>${obErr("phone")}</div>
<label class="tick tick--consent"><input type="checkbox" id="obAccept" data-obx="accept"${OB.accept ? raw(" checked") : ""}${obInv("accept")}><span>${consentHTML()}</span></label>${obErr("accept")}
${OB.codeSent ? html`<div class="field"><label class="lbl" for="obCode">${t("obCode", { phone: OB.sentTo })}</label><div class="code"><input class="inp" id="obCode" data-obx="code" inputmode="numeric" autocomplete="one-time-code" autocapitalize="none" autocorrect="off" maxlength="6" dir="ltr" value="${OB.code}"${obInv("code")}></div>${obErr("code")}
${OB.devCode ? html`<p class="hint">${t("devCode", { code: OB.devCode })}</p>` : ""}
<p class="alt"><button class="link" type="button" data-act="onb-rephone">${t("obChangeNumber")}</button><button class="link link--muted" type="button" data-act="onb-resend" id="obResend"${Date.now() < OB.resendAt ? raw(" disabled") : ""}>${Date.now() < OB.resendAt ? t("resendIn", { n: Math.ceil((OB.resendAt - Date.now()) / 1000) }) : t("resend")}</button></p></div>` : ""}`,
  about: () => { const d = OB.d; return html`<h2 class="h-step" tabindex="-1">${t("obAboutH")}</h2><p class="p-step">${t("obAboutP")}</p>
<div class="field"><label class="lbl" for="obName">${t("obName")}</label><input class="inp" id="obName" data-ob="name" autocomplete="name" value="${d.name}"${obInv("name")}>${obErr("name")}</div>
<div class="grid2"><div class="field"><label class="lbl" for="obGov">${t("obGov")}</label><select class="inp" id="obGov" data-ob="gov"${obInv("gov")}>${optList(GOV_ORDER.filter(k => k !== "remote"), k => L(GOV[k]), d.gov, t("obPick"))}${raw(`<option value="abroad"${d.gov === "abroad" ? " selected" : ""}>${esc(t("outsideSyria"))}</option>`)}</select>${obErr("gov")}</div>
${d.gov === "abroad" ? html`<div class="field"><label class="lbl" for="obCountry">${t("obCountry")}</label><select class="inp" id="obCountry" data-ob="country">${optList(Object.keys(COUNTRY), k => L(COUNTRY[k]), d.country || "", t("obPick"))}</select></div>` : ""}
<div class="field"><label class="lbl" for="obEmail">${t("obEmail")}</label><input class="inp" id="obEmail" data-ob="email" type="email" autocomplete="email" autocapitalize="none" dir="ltr" value="${d.email}"${obInv("email")}>${obErr("email")}</div></div>
<label class="tick"><input type="checkbox" data-ob="relocate"${d.relocate ? raw(" checked") : ""}><span>${t("obRelocate")}</span></label>
<fieldset class="fset"><legend class="lbl">${t("obLangs")}</legend><div class="chips">${Object.keys(LANGS).map(k => pickBtn("langs", k, L(LANGS[k])))}</div>${obErr("langs")}</fieldset>
${importCardHTML("onb")}`; },
  edu: () => { const d = OB.d, e = d.edu, st = d.role === "student", deg = st || e.status === "bachelor" || e.status === "master"; return html`
<h2 class="h-step" tabindex="-1">${t(st ? "obEduHStudent" : "obEduH")}</h2><p class="p-step">${t(st ? "obEduPStudent" : "obEduP")}</p>
${st ? "" : html`<fieldset class="fset"><legend class="lbl">${t("obLevel")}</legend><div><div class="seg2">${["secondary", "diploma", "bachelor", "master"].map(v => setBtn("edu.status", v, t("edu_" + v)))}</div></div>${obErr("edu.status")}</fieldset>`}
${deg || e.status === "diploma" ? html`<div class="grid2">${deg ? html`<div class="field"><label class="lbl" for="obUni">${t(st ? "obUni" : "obUniDone")}</label><select class="inp" id="obUni" data-ob="edu.uni" data-rerender="1"${obInv("edu.uni")}>${optList([...UNI_ORDER, "other"], k => (k === "other" ? t("obUniOther") : L(UNI[k])), e.uni, t(st ? "obPick" : "obPickOptional"))}</select>${obErr("edu.uni")}</div>` : ""}
<div class="field"><label class="lbl" for="obFac">${t("obFac")}</label><select class="inp" id="obFac" data-ob="edu.fac"${obInv("edu.fac")}>${optList(facKeysSorted(), k => L(FAC[k]), e.fac, t(deg ? "obPick" : "obPickOptional"))}</select>${obErr("edu.fac")}</div></div>` : ""}
${deg && e.uni === "other" ? html`<div class="field"><label class="lbl" for="obUniName">${t("obUniName")}</label><input class="inp" id="obUniName" data-ob="edu.uniName" value="${e.uniName || ""}"${obInv("edu.uniName")}>${obErr("edu.uniName")}</div>` : ""}
${st ? html`<fieldset class="fset"><legend class="lbl">${t("obYear")}</legend><div><div class="seg2">${[1, 2, 3, 4, 5, 6].map(y => setBtn("edu.year", y, String(y)))}</div></div>${obErr("edu.year")}</fieldset>` : ""}
${deg ? html`<div class="grid2"><div class="field"><label class="lbl" for="obGrad">${t(st ? "obGrad" : "obGradDone")}</label><select class="inp" id="obGrad" data-ob="edu.grad"${obInv("edu.grad")}>${optList(gradYears(st), y => String(y), e.grad || "", t(st ? "obPick" : "obPickOptional"))}</select>${obErr("edu.grad")}</div>
<div class="field"><label class="lbl" for="obGpa">${t("obGpa")}</label><input class="inp" id="obGpa" data-ob="edu.gpa" dir="ltr" placeholder="${t("obGpaPh")}" value="${e.gpa || ""}"></div></div>` : ""}`; },
  goals: () => { const st = OB.d.role === "student"; return html`<h2 class="h-step" tabindex="-1">${t("obGoalsH")}</h2><p class="p-step">${t("obGoalsP")}</p>
<fieldset class="fset"><legend class="lbl">${t("obTypes")}</legend><div class="chips">${["intern", "full", "part", "contract"].map(k => pickBtn("prefs.types", k, L(TYPE[k])))}</div>${obErr("prefs.types")}</fieldset>
<fieldset class="fset"><legend class="lbl">${t("obFields")}</legend><div class="chips">${Object.keys(INTERESTS).map(k => pickBtn("prefs.fields", k, L(INTERESTS[k])))}</div></fieldset>
${st ? "" : html`<fieldset class="fset"><legend class="lbl">${t("obExpLevel")}</legend><div><div class="seg2">${["none", "lt1", "y1to3", "y4plus"].map(v => setBtn("prefs.level", v, t("lvl_" + v)))}</div></div>${obErr("prefs.level")}</fieldset>`}`; },
  exp: () => html`<h2 class="h-step" tabindex="-1">${t("obExpH")}</h2><p class="p-step">${t("obExpP")}</p>
${entryList(OB.d, "onb")}
${OB.form ? entryFormHTML(OB.form, "onb") : html`<div class="alt"><button class="btn btn--soft" type="button" data-act="onb-add" data-kind="exp">${icon("plus", 15)}${t("obAddExp")}</button><button class="btn" type="button" data-act="onb-add" data-kind="acts">${icon("plus", 15)}${t("obAddAct")}</button></div>`}
${obErr("form")}${skillsEditor(OB.d, "onb")}`,
  done: () => { const P = deriveProfile(OB.d); return html`<span class="done-ic" aria-hidden="true"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path class="done-path" d="m5 12.5 4.5 4.5L19 7.5"/></svg></span>
<h1 class="h-display" tabindex="-1">${t("obDoneH", { name: firstName(OB.d.name) })}</h1><p class="lead">${t("obDoneP")}</p>
<dl class="sum">${[["prEdu", P ? L(P.facYear) : ""], ["prHome", L(GOV[OB.d.gov])], ["prLangs", listJoin(OB.d.langs.map(x => L(LANGS[x])))]].map(([k, v]) => html`<div class="kv-row"><dt>${t(k)}</dt><dd>${v}</dd></div>`)}</dl>
<div class="alt"><button class="btn btn--primary btn--lg" type="button" data-act="onb-finish" data-then="jobs">${t(OB.returnTo ? "obContinue" : "obSeeMatches")}</button><button class="btn btn--lg" type="button" data-act="onb-finish" data-then="cv">${t("obBuildCv")}</button></div>`; }
};
function renderOnb(dir) {
  const root = $("#onb");
  if (!root || !OB.open) return;
  const steps = obSteps(), n = steps.indexOf(OB.step), step = OB.step;
  const next = step === "account" ? (OB.codeSent ? "obVerify" : "obSendCode") : step === "exp" ? (OB.mode === "edit" ? "obSaveChanges" : "obFinish") : OB.mode === "edit" && n === steps.length - 1 ? "obSaveChanges" : "obNext";
  const instant = byKeyboard() || !dir;
  put(root, html`<div class="onb-top">
<span class="mark" aria-hidden="true">ش</span>
<div class="onb-prog"${n < 0 || steps.length < 2 ? raw(' style="visibility:hidden"') : ""}><span class="onb-prog-t" aria-live="polite">${n >= 0 ? t("obStepOf", { n: n + 1, total: steps.length }) : ""}</span><span class="onb-track" aria-hidden="true"><span class="onb-fill" style="--f:${n >= 0 ? ((n + 1) / steps.length).toFixed(3) : 0}"></span></span></div>
<button class="lang" type="button" data-act="lang" lang="${S.lang === "ar" ? "en" : "ar"}">${S.lang === "ar" ? "English" : "العربية"}</button>
${themeBtnHTML()}
${step !== "welcome" ? html`<button class="ibtn" type="button" data-act="onb-close" aria-label="${t(OB.mode === "edit" ? "close" : "obLater")}" title="${t(OB.mode === "edit" ? "close" : "obLater")}">${icon("x", 15, 2.2)}</button>` : ""}
</div>
<div class="onb-body scroll"><div class="onb-card" id="onbCard"${dir && !instant ? raw(` data-enter="${dir}"`) : ""}${instant ? raw(' data-instant="true" data-shown="true"') : ""}>${OB_RENDER[step]()}</div></div>
${step !== "welcome" && step !== "done" ? html`<div class="onb-foot"><div class="onb-foot-in">
${n > 0 && !(steps[n - 1] === "account" && S.user) ? html`<button class="btn btn--lg btn--ghost" type="button" data-act="onb-back">${icon("back", 15, 2.2, "flip")}${t("obBack")}</button>` : html`<span></span>`}
<span class="onb-foot-r">${step === "exp" && (OB.mode === "new" || OB.fromNew) ? html`<button class="link link--muted" type="button" data-act="onb-skip">${t("obSkip")}</button>` : ""}<button class="btn btn--primary btn--lg" type="button" data-act="onb-next"${OB.busy ? raw(' disabled aria-busy="true"') : ""}>${t(next)}</button></span>
</div></div>` : ""}`);
  const card = $("#onbCard");
  if (!instant) nextFrame(() => { card.removeAttribute("data-enter"); card.dataset.shown = "true"; });
  const bad = OB.focusErr ? root.querySelector('[aria-invalid="true"]') : null;
  if (bad) bad.focus(); else if (dir || step === "welcome") { const h = root.querySelector(".h-step, .h-display"); if (h) h.focus({ preventScroll: true }); }
  OB.focusErr = false;
}
function openOnboarding(opts = {}) {
  popClose(); if (Layer.open) layerClose(true);
  if (IMP.where === "onb") { IMP.note = ""; IMP.err = ""; }
  let mode = opts.mode || (S.user ? (S.user.role === "seeker" ? (S.me ? "edit" : "profile") : null) : "new");
  if (!mode) return;
  OB.mode = mode; OB.returnTo = opts.returnTo || null; OB.reason = opts.reason || "";
  OB.errors = {}; OB.form = null; OB.codeSent = false; OB.code = ""; OB.focusErr = false; OB.busy = false; OB.devCode = ""; OB.accept = false;
  OB.role = opts.role || (mode === "signin" ? "seeker" : OB.role || "seeker");
  if (mode === "edit" && S.me) { OB.d = clone(S.me); OB.step = "about"; }
  else if (mode === "profile") {
    const dr = store.get("meDraft", null);
    OB.d = dr && dr.v === 1 ? dr : blankMe(OB.role === "student" ? "student" : "seeker");
    OB.d.phone = S.user ? (normPhone(S.user.phone) || S.user.phone) : "";
    OB.step = "about"; OB.fromNew = false;
  } else if (mode === "signin") { OB.d = blankMe("seeker"); OB.step = "account"; OB.phoneRaw = ""; OB.fromNew = false; }
  else { OB.d = null; OB.step = "welcome"; OB.phoneRaw = ""; OB.fromNew = true; }
  OB.open = true;
  $("#onb").hidden = false; $("#app").inert = true;
  renderOnb("fwd");
}
function saveDraft() { if ((OB.mode === "new" || OB.mode === "profile") && OB.d && OB.step !== "account" && OB.step !== "welcome") { const { phone, ...rest } = OB.d; store.set("meDraft", { ...rest, phone: "" }); } }
function closeOnboarding() { saveDraft(); OB.open = false; $("#onb").hidden = true; $("#app").inert = false; }
function obGo(step, dir) { OB.step = step; OB.errors = {}; saveDraft(); renderOnb(dir || "fwd"); }
// The number as typed, with the chosen country code: Syrian numbers keep their usual forms (09…, 9…, +963…).
function obPhoneFull() { const cc = OB.cc || "963", raw = String(OB.phoneRaw || "").trim(); if (cc === "963" || /^(\+|00)/.test(raw)) return raw; return "+" + cc + latinDigits(raw).replace(/\D/g, "").replace(/^0+/, ""); }
function phoneOk(raw) { const sy = normPhone(raw); if (sy) return sy; const d = latinDigits(raw || "").replace(/[^\d+]/g, ""); return /^\+[1-9]\d{7,14}$/.test(d) ? d : null; }   // latinDigits: Arabic-Indic digits abroad too (D-19)
async function sendCode() {
  const ph = phoneOk(obPhoneFull());
  if (!ph) { OB.errors = { phone: "obErrPhone" }; OB.focusErr = true; renderOnb(); return; }
  if (!OB.accept) { OB.errors = { accept: "obErrAccept" }; OB.focusErr = true; renderOnb(); return; }
  OB.busy = true; renderOnb();
  try {
    let pow;   // the proof-of-work challenge takes a phone well under a second
    const ch = await api.get("/api/auth/challenge");
    if (ch.bits > 0) pow = { challenge: ch.challenge, nonce: await solvePow(ch.challenge, ch.bits) };
    const r = await api.post("/api/auth/code", { phone: ph, lang: S.lang, pow });
    OB.codeSent = true; OB.sentTo = ph; OB.devCode = r.devCode || ""; OB.resendAt = Date.now() + 30000; OB.errors = {};
    tickResend();
  } catch (err) { OB.errors = { phone: null }; toast({ title: errText(err), ic: "alert" }); }
  OB.busy = false; renderOnb();
  const c = $("#obCode"); if (c) c.focus();
}
function tickResend() {
  const b = $("#obResend");
  if (!OB.open || !OB.codeSent) return;
  if (b) { const left = OB.resendAt - Date.now(); b.disabled = left > 0; b.textContent = left > 0 ? t("resendIn", { n: Math.ceil(left / 1000) }) : t("resend"); }
  if (Date.now() < OB.resendAt) setTimeout(tickResend, 1000);
}
async function verifyCode() {
  const code = norm(OB.code).replace(/\D/g, "");
  if (!/^\d{6}$/.test(code)) { OB.errors = { code: "obErrCode" }; OB.focusErr = true; renderOnb(); return; }
  OB.busy = true; renderOnb();
  let r;
  try { r = await api.post("/api/auth/verify", { phone: OB.sentTo, code, role: OB.role === "employer" ? "employer" : "seeker", lang: S.lang, accept: OB.accept }); }
  catch (err) {
    OB.busy = false;
    if (err.code === "code_expired" || err.code === "too_many_attempts") { OB.codeSent = false; OB.code = ""; }
    OB.errors = { code: null }; renderOnb(); toast({ title: errText(err), ic: "alert" }); return;
  }
  S.user = r.user;
  await loadSession();
  OB.busy = false;
  const u = S.user;
  if (u.role !== "seeker") { closeOnboarding(); toast({ title: t("tSignedIn"), ic: "check" }); go(u.role === "admin" ? "#/admin" : "#/company"); return; }
  if (S.me) { const rt = OB.returnTo; closeOnboarding(); toast({ title: t("tSignedIn"), ic: "check" }); render(); runReturn(rt); return; }
  OB.mode = "profile";
  if (!OB.d || !OB.d.v) OB.d = blankMe(OB.role === "student" ? "student" : "seeker");
  OB.d.phone = normPhone(u.phone) || u.phone;
  obGo("about");
}
function obNext() {
  const step = OB.step;
  if (OB.busy) return;
  if (step === "account") { if (OB.codeSent) verifyCode(); else sendCode(); return; }
  const errs = OB_VALID[step] ? OB_VALID[step]() : {};
  OB.errors = errs;
  if (Object.keys(errs).length) { OB.focusErr = true; renderOnb(); return; }
  const steps = obSteps(), i = steps.indexOf(step);
  if (OB.mode === "edit" && i === steps.length - 1) { commitMe().then(ok => { if (ok) { closeOnboarding(); toast({ title: t("tProfileSaved"), sub: t("tProfileSavedS") }); } }); return; }
  if (step === "exp") { commitMe().then(ok => { if (ok) obGo("done"); }); return; }
  obGo(steps[i + 1]);
}
async function commitMe() {
  const d = clone(OB.d);
  d.name = d.name.trim(); d.email = (d.email || "").trim();
  if (S.me && S.me.tailor) d.tailor = S.me.tailor;
  OB.busy = true; renderOnb();
  try {
    const r = await api.put("/api/me/profile", { profile: d });
    S.me = r.profile; store.set("meDraft", null);
    setProfile(S.me);
    OB.busy = false;
    return true;
  } catch (err) {
    OB.busy = false; renderOnb();
    toast({ title: errText(err), ic: "alert" });
    return false;
  }
}
function runReturn(rt) {
  if (!rt) return;
  if (rt.act === "apply" && JOB.has(rt.id)) openApply(JOB.get(rt.id));
  else if (rt.act === "wa" && JOB.has(rt.id)) openWa(JOB.get(rt.id));
  else if (rt.act === "resume") go("#/resume" + (rt.id ? "/" + rt.id : ""));
}
function formInput(f, el, rerender) {
  const k = el.dataset.ef, map = { "start.m": "sm", "start.y": "sy", "end.m": "em", "end.y": "ey" };
  if (k === "current") { f.current = el.checked; rerender(); return; }
  f[map[k] || k] = el.value;
  if (f.errors[map[k] || k]) delete f.errors[map[k] || k];
}
function onbAct(act, el) {
  const d = OB.d;
  switch (act) {
    case "onb-open": openOnboarding({ mode: "new" }); break;
    case "onb-role": {
      OB.role = el.dataset.role;
      OB.d = blankMe(el.dataset.role === "student" ? "student" : "seeker"); OB.phoneRaw = ""; OB.codeSent = false; OB.code = ""; obGo("account"); break;
    }
    case "onb-browse": store.set("browse", true); OB.open = false; $("#onb").hidden = true; $("#app").inert = false; break;
    case "onb-close": closeOnboarding(); break;
    case "onb-next": obNext(); break;
    case "onb-back": { const s2 = obSteps(), i = s2.indexOf(OB.step); if (i > 0) obGo(s2[i - 1], "back"); break; }
    case "onb-skip": OB.form = null; commitMe().then(ok => { if (ok) obGo("done"); }); break;
    case "onb-rephone": OB.codeSent = false; OB.code = ""; OB.devCode = ""; renderOnb(); { const p = $("#obPhone"); if (p) p.focus(); } break;
    case "onb-resend": if (Date.now() >= OB.resendAt) { OB.codeSent = false; OB.code = ""; sendCode(); } break;
    case "onb-pick": { const path = el.dataset.path, v = el.dataset.val, arr = (getPath(d, path) || []).slice(), i = arr.indexOf(v);
      if (i >= 0) arr.splice(i, 1); else arr.push(v); setPath(d, path, arr); delete OB.errors[path]; saveDraft(); el.setAttribute("aria-pressed", i >= 0 ? "false" : "true"); break; }
    case "onb-set": { const v0 = el.dataset.val, v = /^\d+$/.test(v0) ? Number(v0) : v0; setPath(d, el.dataset.path, v); delete OB.errors[el.dataset.path]; saveDraft(); renderOnb(); break; }
    case "onb-finish": { const rt = OB.returnTo; OB.open = false; $("#onb").hidden = true; $("#app").inert = false;
      if (el.dataset.then === "cv") go("#/resume" + (rt && rt.act === "resume" && rt.id ? "/" + rt.id : "")); else { render(); runReturn(rt); } break; }
    case "onb-add": OB.form = newEntryForm(el.dataset.kind); delete OB.errors.form; renderOnb(); { const r = $("#obRole"); if (r) r.focus(); } break;
    case "onb-edit": OB.form = entryToForm(d, el.dataset.kind, el.dataset.eid); renderOnb(); break;
    case "onb-del": removeEntry(d, el.dataset.kind, el.dataset.eid); saveDraft(); renderOnb(); break;
    case "onb-cancel": OB.form = null; renderOnb(); break;
    case "onb-save": if (saveEntryForm(d, OB.form)) { OB.form = null; delete OB.errors.form; saveDraft(); } renderOnb(); break;
    case "onb-skill": addSkill(d, "onb"); saveDraft(); renderOnb(); { const s2 = $("#onbSkill"); if (s2) s2.focus(); } break;
    case "onb-unskill": d.skills.splice(Number(el.dataset.i), 1); saveDraft(); renderOnb(); break;
    default: break;
  }
}
function onbInput(el) {
  if (!OB.open || !OB.d) return;
  if (el.dataset.obx === "cc") { OB.cc = el.value; const p = $("#obPhone"); if (p) p.placeholder = OB.cc === "963" ? "9xx xxx xxx" : t("obPhoneIntlPh"); return; }
  if (el.dataset.obx === "phone") { OB.phoneRaw = el.value; if (OB.errors.phone && normPhone(el.value)) { delete OB.errors.phone; el.removeAttribute("aria-invalid"); } return; }
  if (el.dataset.obx === "code") { OB.code = el.value; return; }
  if (el.dataset.obx === "accept") { OB.accept = el.checked; if (OB.errors.accept) { delete OB.errors.accept; renderOnb(); } return; }
  if (el.dataset.ob === "gov") { OB.d.gov = el.value; if (el.value !== "abroad") OB.d.country = ""; if (OB.errors.gov) delete OB.errors.gov; saveDraft(); renderOnb(); const g = $("#obGov"); if (g) g.focus(); return; }
  if (el.dataset.ob) {
    const path = el.dataset.ob;
    let v = el.type === "checkbox" ? el.checked : el.value;
    if (path === "edu.grad") v = Number(v) || 0;
    setPath(OB.d, path, v);
    if (OB.errors[path]) { delete OB.errors[path]; el.removeAttribute("aria-invalid"); const er = $("#obErr-" + path.replace(/\./g, "-")); if (er) er.remove(); }
    saveDraft();
    if (el.dataset.rerender) renderOnb();
    return;
  }
  if (el.dataset.ef && OB.form) formInput(OB.form, el, () => renderOnb());
}


