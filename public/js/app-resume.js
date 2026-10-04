/* ---------- resume helper ---------- */
function goView(v, target) {
  popClose();
  if (Layer.open) layerClose(true);
  if (v === "resume" && !S.me) {
    if (S.user && S.user.role !== "seeker") { go("#/"); return; }
    openOnboarding({ mode: S.user ? "profile" : "new", reason: t("obReasonCv"), returnTo: { act: "resume", id: target } });
    if (S.view === "resume") { S.view = "jobs"; render(); }
    return;
  }
  if (v === "saved" && S.view !== "saved") { S.listTab = S.tab; S.tab = "saved"; }
  if (v !== "saved" && S.tab === "saved") S.tab = S.listTab || "all";   // leaving Saved by any route restores the filter
  if (v === "resume") { cvInit(); CV.target = "general"; CV.focus = target != null && JOB.has(Number(target)) ? String(target) : null; CV.lang = S.lang; CV.form = null; CV.ai = { st: "idle", items: [], ctl: null, msg: "" }; CV.tr = { st: "idle" }; CV.trEdit = false;
    if (S.cvOpenTr) { CV.lang = S.cvOpenTr; CV.trEdit = true; CV.tab = "facts"; S.cvOpenTr = null; } }
  S.view = v;
  render();
  const h = $("#view h1"); if (h && v !== "jobs" && v !== "saved" && byKeyboard()) h.focus();
}
function paperHTML(R) {
  const lg = R.lang, e = R.edu;
  const sec = key => {
    if (key === "edu") return html`<section class="pp-sec"><h3 class="pp-h">${tl(lg, "cvHEdu")}</h3><div class="pp-item">
<div class="pp-row"><span class="pp-strong">${e.inst || e.degree}</span><span class="pp-date">${e.city}</span></div>
${e.inst ? html`<div class="pp-row"><span class="pp-meta">${e.degree}</span><span class="pp-date">${e.date}</span></div>` : html`<div class="pp-row"><span></span><span class="pp-date">${e.date}</span></div>`}
${e.gpa ? html`<p class="pp-line">${tl(lg, "cvGrade")}: ${e.gpa}</p>` : ""}${e.course ? html`<p class="pp-line">${tl(lg, "cvCoursesL")}: ${e.course}</p>` : ""}${e.honors ? html`<p class="pp-line">${tl(lg, "cvHonorsL")}: ${e.honors}</p>` : ""}
</div></section>`;
    if (key === "exp" || key === "acts") return html`<section class="pp-sec"><h3 class="pp-h">${tl(lg, key === "exp" ? "cvHExp" : "cvHActs")}</h3>${(key === "exp" ? R.exp : R.acts).map(r => html`<div class="pp-item">
<div class="pp-row"><span><span class="pp-strong">${r.e.role}</span>, ${r.e.org}${r.e.place ? html`, ${r.e.place}` : ""}</span><span class="pp-date">${fmtRange(r.e, lg)}</span></div>
${r.shown.length ? html`<ul class="pp-ul">${r.shown.map(b => html`<li class="pp-li" data-key="${b.key}">${b.t}</li>`)}</ul>` : ""}</div>`)}</section>`;
    const j = lg === "ar" ? "، " : ", ";
    return html`<section class="pp-sec"><h3 class="pp-h">${tl(lg, "cvHSkills")}</h3>
${R.skills.length ? html`<p class="pp-line"><span class="pp-strong">${tl(lg, "cvSkillsL")}:</span> ${R.skills.join(j)}</p>` : ""}
${R.langs.length ? html`<p class="pp-line"><span class="pp-strong">${tl(lg, "cvLangsL")}:</span> ${R.langs.join(j)}</p>` : ""}
${R.certs.length ? html`<p class="pp-line"><span class="pp-strong">${tl(lg, "cvCertsL")}:</span> ${R.certs.join(j)}</p>` : ""}</section>`;
  };
  return html`<article class="paper" id="cvPaper" lang="${lg}" dir="${lg === "ar" ? "rtl" : "ltr"}">
<header class="pp-head"><h2 class="pp-name">${R.name}</h2><p class="pp-contact">${R.contact.map((c, i) => html`${i ? "  |  " : ""}<bdi>${c}</bdi>`)}</p></header>${R.order.map(sec)}</article>`;
}
function renderResume() {
  const v = $("#view"), me = S.me;
  if (!me) return;
  put(v, html`<div class="cv">
${CV.focus && JOB.get(Number(CV.focus)) ? (() => { const fj = JOB.get(Number(CV.focus)); return html`<div class="cv-focus" role="status">${icon("target", 18)}<span class="cv-focus-t"><b>${t("cvFocusH", { title: L(fj.title), co: L(fj.co) })}</b><span>${t("cvFocusP")}</span></span><button class="btn btn--soft btn--sm" type="button" data-act="cv-focus-done">${t("cvFocusDone")}</button></div>`; })() : ""}
<div class="cv-top">
  <div class="seg2" role="group" aria-label="${t("cvLangLbl")}">${["en", "ar"].map(l => html`<button class="seg2-btn" type="button" data-act="cv-lang" data-l="${l}" lang="${l}" aria-pressed="${CV.lang === l ? "true" : "false"}">${l === "ar" ? "العربية" : "English"}</button>`)}</div>
  <button class="btn" type="button" data-act="cv-copy">${icon("copy", 15)}${t("cvCopy")}</button>
  <button class="btn btn--primary" type="button" data-act="cv-print">${icon("print", 15)}${t("cvPrint")}</button>
</div>
<div class="cv-tabs"><div class="seg2" role="group" id="cvTabs"></div></div>
<div class="cv-grid" id="cvGrid" data-tab="${CV.tab}">
  <section class="cv-col cv-col--facts scroll" id="cvFacts" aria-label="${t("cvFactsH")}"></section>
  <section class="cv-col cv-col--preview scroll" id="cvPreview" aria-label="${t("cvTab_preview")}"></section>
  <section class="cv-col cv-col--checks scroll" id="cvChecks" aria-label="${t("cvChecksH")}"></section>
</div></div>`);
  renderCvFacts(); renderCvSide();
}
function renderCvFacts() {
  const box = $("#cvFacts"), me = S.me;
  if (!box || !me) return;
  if (CV.trEdit) { put(box, trEditorHTML(me)); return; }
  const e = me.edu, R = buildResume(me, CV.target, S.lang);
  put(box, html`<h2 class="cv-h">${t("cvFactsH")}</h2><p class="cv-sub">${t("cvFactsP")}</p>
${importCardHTML("cv")}
<div class="fgroup"><h3 class="fgroup-h">${t("cvContact")}</h3>
<div class="field"><label class="lbl" for="cvName">${t("obName")}</label><input class="inp" id="cvName" data-cv="name" value="${me.name}"></div>
<div class="field"><label class="lbl" for="cvPhone">${t("obPhone")}</label><input class="inp" id="cvPhone" data-cv="phone" dir="ltr" value="${me.phone}"></div>
<div class="field"><label class="lbl" for="cvEmail">${t("obEmail")}</label><input class="inp" id="cvEmail" data-cv="email" dir="ltr" value="${me.email}"></div></div>
<div class="fgroup"><h3 class="fgroup-h">${t("cvEdu")}</h3><p class="fline">${[R.edu.inst, R.edu.degree, R.edu.date].filter(Boolean).join(sep())}</p>
<div class="field"><label class="lbl" for="cvGpa">${t("obGpa")}</label><input class="inp" id="cvGpa" data-cv="edu.gpa" dir="ltr" value="${e.gpa || ""}"></div>
<div class="field"><label class="lbl" for="cvCourses">${t("cvCourses")}</label><input class="inp" id="cvCourses" data-cv="edu.course" placeholder="${t("cvCoursesPh")}" value="${e.course || ""}"></div>
<div class="field"><label class="lbl" for="cvHonors">${t("cvHonors")}</label><input class="inp" id="cvHonors" data-cv="edu.honors" value="${e.honors || ""}"></div>
<button class="link" type="button" data-act="edit-profile">${t("cvEditEdu")}</button></div>
<div class="fgroup"><h3 class="fgroup-h">${t("cvExpAct")}</h3>${entryList(me, "cv")}
${CV.form ? entryFormHTML(CV.form, "cv") : html`<div class="alt"><button class="btn btn--soft" type="button" data-act="cv-add" data-kind="exp">${icon("plus", 15)}${t("obAddExp")}</button><button class="btn" type="button" data-act="cv-add" data-kind="acts">${icon("plus", 15)}${t("obAddAct")}</button></div>`}</div>
<div class="fgroup">${skillsEditor(me, "cv")}
<div class="field"><label class="lbl" for="cvCert">${t("cvCerts")}</label><div class="addrow"><input class="inp" id="cvCert" data-skill="cert" placeholder="${t("cvCertPh")}"><button class="btn" type="button" data-act="cv-cert">${t("obAdd")}</button></div>
${(me.certs || []).length ? html`<div class="chips">${me.certs.map((c, i) => html`<span class="tag">${c}<button class="tag-x" type="button" data-act="cv-uncert" data-i="${i}" aria-label="${t("removeX", { x: c })}">${icon("x", 11, 2.6)}</button></span>`)}</div>` : ""}</div></div>`);
}
function renderCvSide(swapKey) {
  if (S.view !== "resume" || !S.me || !$("#cvPreview")) return;
  // One resume. A job only focuses the checks and suggestions on it; it never makes another version.
  const me = S.me, job = CV.focus ? JOB.get(Number(CV.focus)) : null, R = buildResume(me, "general", CV.lang);
  put($("#cvPreview"), html`${trBarHTML(R)}<div class="stage">${paperHTML(R)}</div>`);
  const pp = $("#cvPaper"); CV.over = !!(pp && pp.clientHeight && pp.scrollHeight > pp.clientHeight + 2);
  if (swapKey && !reduced()) { const li = $(`#cvPaper .pp-li[data-key="${CSS.escape ? CSS.escape(swapKey) : swapKey}"]`); if (li) { li.dataset.swap = "true"; nextFrame(() => { li.dataset.swap = "false"; }); } }
  const ck = runChecks(me, R, job);
  put($("#cvChecks"), checksHTML(ck, job));
  put($("#cvTabs"), html`${["facts", "preview", "checks"].map(k => html`<button class="seg2-btn" type="button" data-act="cv-tab" data-pane="${k}" aria-pressed="${CV.tab === k ? "true" : "false"}">${t("cvTab_" + k)}${k === "checks" && ck.todo ? html` <span class="num">(${ck.todo})</span>` : ""}</button>`)}`);
  $("#cvGrid").dataset.tab = CV.tab;
}
function ckIcon(lv) { const k = lv === "ok" ? "ok" : lv === "todo" ? "warn" : "part"; return html`<span class="state state--${k}" aria-hidden="true">${STATE_ICON[k]()}</span>`; }
function checksHTML(ck, job) {
  return html`<h2 class="cv-h">${t("cvChecksH")}</h2>${aiHTML(job)}
${ck.cov ? html`<div class="ck-group"><h3 class="ck-h">${icon("target", 15)}${t("cvFitH")}</h3>
${ck.cov.have.length ? html`<p class="ck-sub">${t("cvFitHave")}</p><div class="cov">${ck.cov.have.map(x => html`<span class="cov-chip cov-chip--have">${icon("check", 11, 2.6)}${x.label}</span>`)}</div>` : ""}
${ck.cov.miss.length ? html`<p class="ck-sub">${t("cvFitMiss")}</p><div class="cov">${ck.cov.miss.map(x => html`<button class="cov-chip cov-chip--miss" type="button" data-act="cv-addskill" data-k="${x.k}">${icon("plus", 11, 2.6)}${x.label}</button>`)}</div><p class="hint">${t("cvFitMissHint")}</p>` : ""}
${!ck.cov.have.length && !ck.cov.miss.length ? html`<p class="ck-sub">${t("cvFitNone")}</p>` : ""}</div>` : ""}
<div class="ck-group"><h3 class="ck-h">${icon("list", 15)}${t("cvBulletsH")}</h3>
${ck.groups.length ? html`<ul class="ck-list">${ck.groups.map(g => html`<li class="ck-item">${ckIcon("todo")}<span class="ck-txt"><span class="ck-quote">${g.text}</span>${g.keys.map(k => html`<span>${t(k)}</span>`)}
${g.fix ? html`<span class="ck-fix">${t("cvFixTo")} ${g.fix}</span>` : ""}
<span class="ck-act">${g.fix ? html`<button class="btn btn--soft" type="button" data-act="cv-fix" data-n="${g.fixN}">${t("cvApplyFix")}</button>` : ""}<button class="link" type="button" data-act="cv-edit" data-kind="${g.kind}" data-eid="${g.eid}">${t("cvEditBullet")}</button></span></span></li>`)}</ul>` : html`<p class="ck-sub">${t("cvBulletsOk")}</p>`}</div>
<div class="ck-group"><h3 class="ck-h">${icon("shield", 15)}${t("cvBasicsH")}</h3><ul class="ck-list">${ck.basics.map(b => html`<li class="ck-item">${ckIcon(b.lv)}<span class="ck-txt">${t(b.key, b.vars)}</span></li>`)}</ul></div>
<details class="rules"><summary class="rules-sum">${t("cvRulesH")}</summary><ul class="rules-list">${CV_RULES.map(r => html`<li>${S.lang === "ar" ? r.ar : r.en}<span class="rules-src">${r.src}</span></li>`)}</ul></details>`;
}
function aiHTML(job) {
  if (!S.cfg.ai) return html`<p class="note">${icon("info", 15)}<span>${t("aiUnavailable")}</span></p>`;
  if (!job) return html`<div class="ai"><h3 class="ai-h">${icon("sparkle", 15)}${t("aiH")}</h3><p class="ai-p">${t("aiPickJob")}</p></div>`;
  const a = CV.ai, ok = a.items.filter(x => x.ok && !x.done), skipped = a.items.filter(x => !x.ok && x.why !== "gSame"), qs = a.items.filter(x => x.q);
  return html`<div class="ai"><h3 class="ai-h">${icon("sparkle", 15)}${t("aiH")}</h3><p class="ai-p">${t("aiP")}</p>
<div class="alt">${a.st === "busy" ? html`<span class="ai-p" aria-live="polite" style="display:inline-flex;align-items:center;gap:8px"><span class="spin" aria-hidden="true"></span>${t("aiThinking")}</span><button class="btn" type="button" data-act="cv-ai-stop">${t("aiStop")}</button>`
    : html`<button class="btn btn--primary" type="button" data-act="cv-ai">${icon("sparkle", 15)}${t(a.st === "done" ? "aiAgain" : "aiRun")}</button>`}</div>
<p class="ai-p">${t("aiPrivacy")}</p>${a.msg ? html`<p class="err">${a.msg}</p>` : ""}
${a.st === "done" ? html`${ok.length ? html`<ul class="ck-list">${a.items.map((x, n) => (x.ok && !x.done ? html`<li class="ai-item"><span class="ai-old">${x.orig}</span><span class="ai-new">${x.sug}</span><span class="ck-act"><button class="btn btn--soft" type="button" data-act="cv-ai-use" data-n="${n}">${t("aiUse")}</button><button class="link" type="button" data-act="cv-ai-keep" data-n="${n}">${t("aiKeep")}</button></span></li>` : ""))}</ul>`
  : html`<p class="ai-p">${t(a.items.some(x => x.done) ? "aiAllDone" : "aiNothing")}</p>`}
${qs.length ? html`<p class="ck-sub">${t("aiQuestions")}</p>${qs.map(x => html`<p class="ai-q">${icon("info", 13)}<span>${x.q}</span></p>`)}` : ""}
${skipped.length ? html`<details class="rules"><summary class="rules-sum">${tn("aiSkipped", skipped.length)}</summary><ul class="rules-list">${skipped.map(x => html`<li>${x.sug || x.orig}<span class="rules-src">${t(x.why, { x: x.tok || "" })}</span></li>`)}</ul></details>` : ""}` : ""}</div>`;
}
async function runAi() {
  const job = CV.focus ? JOB.get(Number(CV.focus)) : null;
  if (!S.cfg.ai || !job) return;
  const R = buildResume(S.me, "general", CV.lang), items = [];
  let n = 0;
  for (const r of [...R.exp, ...R.acts]) for (const b of r.shown) items.push({ id: "b" + (++n), key: b.key, eid: r.e.id, orig: b.orig, role: r.e.role, current: !!r.e.current });
  if (!items.length) { CV.ai = { st: "idle", items: [], ctl: null, msg: t("aiNoBullets") }; renderCvSide(); return; }
  const ticket = {};
  CV.ai = { st: "busy", items: [], ctl: ticket, msg: "" }; renderCvSide();
  try {
    await saveMe(true);   // the server only accepts bullets that are already in the saved profile
    const out = await api.post("/api/resume/suggest", { jobId: job.id, items: items.map(x => ({ role: x.role, current: x.current, text: x.orig })) });
    if (CV.ai.ctl !== ticket) return;   // stopped or restarted meanwhile
    const facts = factsText(S.me), jt = jobPlain(job);
    CV.ai = { st: "done", ctl: null, msg: "", items: items.map((it, i) => {
      const r = (out.items || [])[i] || {}, sug = String(r.sug || "").trim(), q = String(r.q || "").trim();
      const local = !sug || norm(sug) === norm(it.orig) ? { ok: false, why: "gSame" } : factGuard(it.orig, sug, facts, jt);
      const g = r.ok === false ? { ok: false, why: r.why, tok: r.tok } : local;
      return { ...it, sug, q, ...g, done: false }; }) };
  } catch (e) {
    if (CV.ai.ctl !== ticket) return;
    if (e.code === "ai_unavailable") S.cfg.ai = false;
    CV.ai = { st: "idle", items: [], ctl: null, msg: e.code === "rate_limited" ? t("aiRate") : e.code === "ai_bad_json" ? t("aiBadJson") : errText(e) };
  }
  renderCvSide();
}
let cvUndo = null;
function cvAct(act, el) {
  const me = S.me;
  switch (act) {
    case "cv-tab": CV.tab = el.dataset.pane; renderCvSide(); break;
    case "cv-lang": CV.lang = el.dataset.l; if (!CV.tr || CV.tr.st !== "busy") CV.tr = { st: "idle" }; renderResume(); break;
    case "cv-print": {
      const done = () => { document.body.classList.remove("print-cv"); window.removeEventListener("afterprint", done); };
      document.body.classList.add("print-cv"); window.addEventListener("afterprint", done);
      try { window.print(); } catch (e) { done(); toast({ title: t("cvPrintFail"), ic: "alert" }); }
      break;
    }
    case "cv-copy": copyText(plainResume(buildResume(me, CV.target, CV.lang))).then(ok => toast(ok ? { title: t("cvCopied"), sub: t("cvCopiedS"), ic: "copy" } : { title: t("tShareFail"), ic: "alert" })); break;
    case "cv-fix": {
      const R = buildResume(me, CV.target, CV.lang), b = runChecks(me, R, JOB.get(Number(CV.target))).bullets[Number(el.dataset.n)];
      if (!b || !b.fix) break;
      const entry = me[b.kind].find(x => x.id === b.eid); if (!entry) break;
      cvUndo = { kind: b.kind, eid: b.eid, i: b.i, text: entry.bullets[b.i] };
      entry.bullets[b.i] = b.fix; saveMe();
      renderCvSide(ovKey(b.eid, b.fix));
      toast({ title: t("cvFixed"), sub: b.fix, action: { act: "cv-undo", label: t("undo") } });
      break;
    }
    case "cv-undo": { if (!cvUndo) break; const en = me[cvUndo.kind].find(x => x.id === cvUndo.eid); if (en) { en.bullets[cvUndo.i] = cvUndo.text; saveMe(); } cvUndo = null; renderCvSide(); break; }
    case "cv-addskill": {
      const lex = SKILL_LEX.find(x => x[0] === el.dataset.k); if (!lex) break;
      const label = S.lang === "ar" ? lex[2] : lex[1];
      if (el.dataset.confirm !== "1") { el.dataset.confirm = "1"; el.textContent = t("cvFitConfirm", { x: label }); break; }
      if (!me.skills.some(s => norm(s) === norm(label))) me.skills.push(label);
      saveMe(); renderCvFacts(); renderCvSide(); break;
    }
    case "cv-add": CV.form = newEntryForm(el.dataset.kind); CV.tab = "facts"; renderCvFacts(); renderCvSide(); { const r = $("#cvRole"); if (r) r.focus(); } break;
    case "cv-edit": CV.form = entryToForm(me, el.dataset.kind, el.dataset.eid); CV.tab = "facts"; renderCvFacts(); renderCvSide(); { const b = $("#cvBullets"); if (b) b.focus(); } break;
    case "cv-del": removeEntry(me, el.dataset.kind, el.dataset.eid); saveMe(); renderCvFacts(); renderCvSide(); break;
    case "cv-cancel": CV.form = null; renderCvFacts(); break;
    case "cv-save": if (saveEntryForm(me, CV.form)) { CV.form = null; saveMe(); setProfile(me, true); renderCvSide(); } renderCvFacts(); break;
    case "cv-skill": addSkill(me, "cv"); saveMe(); renderCvFacts(); renderCvSide(); { const s2 = $("#cvSkill"); if (s2) s2.focus(); } break;
    case "cv-unskill": me.skills.splice(Number(el.dataset.i), 1); saveMe(); renderCvFacts(); renderCvSide(); break;
    case "cv-cert": { const inp = $("#cvCert"); if (!inp) break; const v = inp.value.trim(); me.certs = me.certs || [];
      if (v && !me.certs.some(c => norm(c) === norm(v))) me.certs.push(v); saveMe(); renderCvFacts(); renderCvSide(); { const c = $("#cvCert"); if (c) c.focus(); } break; }
    case "cv-uncert": me.certs.splice(Number(el.dataset.i), 1); saveMe(); renderCvFacts(); renderCvSide(); break;
    case "cv-ai": runAi(); break;
    case "cv-tr-run": runTranslate(); break;
    case "cv-tr-stop": CV.tr = { st: "idle" }; renderCvSide(); if (CV.trEdit) renderCvFacts(); break;
    case "cv-tr-edit": {
      CV.trEdit = true; CV.tab = "facts"; renderCvFacts(); renderCvSide();
      const f = [...document.querySelectorAll("#cvFacts .tr-inp, #trName")].find(x => !x.value) || $("#cvFacts .tr-inp");
      if (f) f.focus();
      break;
    }
    case "cv-tr-close": CV.trEdit = false; renderCvFacts(); renderCvSide(); break;
    case "cv-tr-keep": { const src = (CV.trRows || [])[Number(el.dataset.i)]; if (src) { setTr(me, CV.lang, src, src); saveMe(); renderCvFacts(); renderCvSide(); } break; }
    case "cv-ai-stop": CV.ai = { st: "idle", items: [], ctl: null, msg: "" }; renderCvSide(); break;
    case "cv-ai-use": {   // an accepted suggestion rewrites the line in the profile itself: there is one resume
      const x = CV.ai.items[Number(el.dataset.n)]; if (!x || !x.ok) break;
      const entry = [...(me.exp || []), ...(me.acts || [])].find(e => e.id === x.eid), i = entry ? (entry.bullets || []).indexOf(x.orig) : -1;
      if (i < 0) break;
      entry.bullets[i] = x.sug; x.done = true; saveMe(); renderCvSide(); break; }
    case "cv-focus-done": go("#/resume"); break;
    case "cv-ai-keep": { const x = CV.ai.items[Number(el.dataset.n)]; if (x) { x.done = true; renderCvSide(); } break; }
    default: break;
  }
}
function cvInput(el) {
  if (S.view !== "resume" || !S.me) return;
  if (el.dataset.tr != null) {
    const src = (CV.trRows || [])[Number(el.dataset.tr)];
    if (src) {
      setTr(S.me, CV.lang, src, el.value);
      const meta = el.closest(".tr-row") && el.closest(".tr-row").querySelector(".tr-meta");   // the editor isn't re-rendered while typing
      if (meta) meta.hidden = !!el.value.trim();
      saveMe(); renderCvSide();
    }
    return;
  }
  if (el.dataset.trname) { S.me[el.dataset.trname === "nameAr" ? "nameAr" : "nameEn"] = el.value.trim(); saveMe(); renderCvSide(); return; }
  if (el.dataset.cv) { setPath(S.me, el.dataset.cv, el.value); saveMe(); if (["name", "phone", "email"].includes(el.dataset.cv)) { setProfile(S.me, true); renderChrome(); } renderCvSide(); return; }
  if (el.dataset.ef && CV.form) formInput(CV.form, el, renderCvFacts);
}


/* ---------- the resume in the other language ----------
   Translations live in the profile as pairs, so employers who switch an applicant's resume to English or
   Arabic see them too. People can write them, or ask Claude for drafts; either way they check every line. */
function setTr(me, lg, src, value) {
  if (!me.tr || typeof me.tr !== "object") me.tr = { en: [], ar: [] };
  const arr = Array.isArray(me.tr[lg]) ? me.tr[lg] : (me.tr[lg] = []);
  const i = arr.findIndex(x => x[0] === src), v = String(value || "").trim();
  if (!v) { if (i >= 0) arr.splice(i, 1); } else if (i >= 0) arr[i][1] = v; else arr.push([src, v]);
}
function trRows(me, lg) { return trSources(me).filter(s => { const sc = scriptOf(s); return sc && sc !== lg; }); }
const trRunBtn = () => html`<button class="btn btn--primary" type="button" data-act="cv-tr-run">${icon("sparkle", 15)}${t("trRun")}</button>`;
const trBusyHTML = () => html`<span class="ai-p trbar-busy"><span class="spin" aria-hidden="true"></span>${t("trBusy")}</span>`;
function trBarHTML(R) {
  const a = CV.tr || { st: "idle" }, need = R.trMissing.length + (R.nameMissing ? 1 : 0), ai = !!S.cfg.ai && R.trMissing.length > 0;
  if (a.st === "busy") return html`<div class="ai trbar" role="status">${trBusyHTML()}<div class="alt"><button class="btn" type="button" data-act="cv-tr-stop">${t("trStop")}</button></div></div>`;
  if (!need && !R.trUsed && a.st !== "done") return "";
  return html`<div class="ai trbar" role="status">
<p class="ai-p trbar-h">${icon(need ? "info" : "check", 15)}<span>${need ? t("ckTrMissing", { n: need, lang: trLang(R.lang) }) : t("trFrom")}</span></p>
${a.st === "done" ? html`<p class="ai-p">${t("trDone", { n: a.n })}</p>${a.skipped ? html`<p class="ai-p">${t("trSkipped", { n: a.skipped })}</p>` : ""}${a.left ? html`<p class="ai-p">${t("trLeft")}</p>` : ""}` : ""}
${a.msg ? html`<p class="err">${a.msg}</p>` : ""}
<div class="alt">${ai ? trRunBtn() : ""}<button class="btn${ai ? "" : " btn--soft"}" type="button" data-act="cv-tr-edit">${t(R.trUsed || a.st === "done" ? "trEdit" : "trWrite")}</button></div>
${ai ? html`<p class="ai-p trbar-fine">${t("trPrivacy")}</p>` : ""}</div>`;
}
function trEditorHTML(me) {
  const lg = CV.lang, rows = CV.trRows = trRows(me, lg), T = trMap(me, lg), L2 = trLang(lg), dir = lg === "ar" ? "rtl" : "ltr";
  const nameKey = lg === "ar" ? "nameAr" : "nameEn", nsc = scriptOf(me.name), showName = (!!nsc && nsc !== lg) || !!me[nameKey];
  const autoName = !me[nameKey] && nsc && nsc !== lg ? translitName(me.name, lg) : "";   // written on this device, never sent anywhere
  const empty = rows.filter(s => !T.get(s)).length;
  return html`<div class="tr-ed"><h2 class="cv-h">${t("trEditH", { lang: L2 })}</h2><p class="cv-sub">${t("trEditP", { lang: L2 })}</p>
${S.cfg.ai && empty ? html`<div class="alt">${CV.tr && CV.tr.st === "busy" ? trBusyHTML() : trRunBtn()}</div><p class="ai-p trbar-fine">${t("trPrivacy")}</p>` : ""}
${showName ? html`<div class="field"><label class="lbl" for="trName">${t("trNameL", { lang: L2 })}</label><input class="inp" id="trName" data-trname="${nameKey}" dir="${dir}" lang="${lg}" value="${me[nameKey] || autoName}" placeholder="${me.name}"><p class="hint">${t(autoName ? "trNameAuto" : "trNameHint")}</p></div>` : ""}
${rows.length ? html`<ol class="tr-list">${rows.map((src, i) => { const v = T.get(src) || ""; return html`<li class="tr-row"><p class="tr-src" dir="auto">${src}</p>
<textarea class="inp tr-inp" data-tr="${i}" dir="${dir}" lang="${lg}" rows="2" aria-label="${t("trInL", { lang: L2 })}">${v}</textarea>${v ? "" : html`<p class="tr-meta"><span class="tr-miss">${t("trEmpty")}</span>${lg === "ar" ? html`<button class="link" type="button" data-act="cv-tr-keep" data-i="${i}">${t("trKeep")}</button>` : ""}</p>`}</li>`; })}</ol>`
    : html`<p class="note">${icon("check", 15)}<span>${t("trNothing", { lang: L2 })}</span></p>`}
<div class="alt"><button class="btn btn--primary" type="button" data-act="cv-tr-close">${t("trDoneBtn")}</button></div></div>`;
}
async function runTranslate() {
  if (!S.cfg.ai || !S.me) return;
  const to = CV.lang, ticket = {};
  CV.tr = { st: "busy", ctl: ticket };
  renderCvSide(); if (CV.trEdit) renderCvFacts();
  try {
    await saveMe(true);   // the server translates what's saved
    const out = await api.post("/api/resume/translate", { to });
    if (!CV.tr || CV.tr.ctl !== ticket) return;   // stopped meanwhile
    const T = trMap(S.me, to);
    for (const [src, dst] of out.pairs || []) if (!T.get(src)) setTr(S.me, to, src, dst);
    await saveMe(true);
    CV.tr = { st: "done", n: (out.pairs || []).length, skipped: out.skipped || 0, left: out.left || 0 };
  } catch (e) {
    if (!CV.tr || CV.tr.ctl !== ticket) return;
    if (e.code === "ai_unavailable") S.cfg.ai = false;
    CV.tr = { st: "idle", msg: e.code === "rate_limited" ? t("aiRate") : e.code === "ai_bad_json" ? t("aiBadJson") : errText(e) };
  }
  renderCvSide(); if (CV.trEdit) renderCvFacts();
}
