/* =====================================================================
   Shaghilni next — domain engine, carried over unchanged from v1 (tested):
   templating, i18n, Arabic search, match model, pay, posting checks,
   onboarding validation, resume tailoring and the fact guard.
   ===================================================================== */

/* ---------- from v1 app.js ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const RAW = Symbol("raw");
const raw = s => ({ [RAW]: true, s: String(s) });
const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const esc = s => String(s).replace(/[&<>"']/g, c => ESC[c]);
const toH = v => v == null || v === false ? "" : Array.isArray(v) ? v.map(toH).join("")
  : (typeof v === "object" && v[RAW]) ? v.s : esc(v);
const html = (strs, ...vals) => raw(strs.reduce((out, s, i) => out + s + (i < vals.length ? toH(vals[i]) : ""), ""));
const put = (el, h) => { if (el) el.innerHTML = h.s; };   /* html-safe: the only HTML sink; h comes from the escaping html`` template */
const fill = (s, v = {}) => String(s).replace(/\{(\w+)\}/g, (m, k) => (k in v ? v[k] : m));
const fmt = n => Number(n).toLocaleString("en-US");
const NS = "shaghilni.app.";
const store = {
  get(k, d) { try { const v = localStorage.getItem(NS + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(NS + k, JSON.stringify(v)); } catch (e) { /* private mode */ } }
};
const THEMES = ["system", "light", "dark"];
const L = o => o == null ? "" : typeof o === "string" ? o : (o[S.lang] ?? o.en ?? "");
function pform(n) {
  if (S.lang === "ar") {
    if (n === 0) return "zero";
    if (n === 1) return "one";
    if (n === 2) return "two";
    const m = n % 100;
    if (m >= 3 && m <= 10) return "few";
    if (m >= 11 && m <= 99) return "many";
    return "other";
  }
  return n === 0 ? "zero" : n === 1 ? "one" : "other";
}
const t = (k, v) => { const s = STR[S.lang][k] ?? STR.en[k]; return s == null ? k : fill(s, v); };
const tn = (k, n, v = {}) => { const f = STR[S.lang][k] ?? STR.en[k]; return fill(f[pform(n)] ?? f.other, { n: fmt(n), ...v }); };
function listJoin(a) {
  if (a.length < 2) return a.join("");
  const last = a[a.length - 1], head = a.slice(0, -1);
  if (S.lang === "ar") return head.join("، ") + " و" + last;
  return a.length === 2 ? `${head[0]} and ${last}` : `${head.join(", ")}, and ${last}`;
}
function norm(s) {
  return String(s || "").normalize("NFKD").toLowerCase()
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, "")
    .replace(/\u0640/g, "")
    .replace(/[\u0622\u0623\u0625\u0671]/g, "\u0627")
    .replace(/[\u0649\u06CC]/g, "\u064A")
    .replace(/\u06A9/g, "\u0643")
    .replace(/\u0629/g, "\u0647")
    .replace(/\u0624/g, "\u0648").replace(/\u0626/g, "\u064A")
    .replace(/[\u0660-\u0669]/g, d => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\u06F0-\u06F9]/g, d => String(d.charCodeAt(0) - 0x06F0))
    .replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}
const ICON = {
  search: '<circle cx="11" cy="11" r="7.2"/><path d="m20 20-3.7-3.7"/>',
  pin: '<path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z"/><circle cx="12" cy="10" r="2.4"/>',
  clock: '<circle cx="12" cy="12" r="8.6"/><path d="M12 7.4V12l3 1.8"/>',
  users: '<circle cx="9" cy="8.4" r="3.2"/><path d="M3.4 19.2a5.8 5.8 0 0 1 11.2 0"/><path d="M16.4 5.6a3.2 3.2 0 0 1 0 6"/><path d="M17.6 13.8a5.8 5.8 0 0 1 3 5.4"/>',
  cap: '<path d="M2.8 8.6 12 4.4l9.2 4.2L12 12.8 2.8 8.6Z"/><path d="M6.6 10.4v4.8c0 1.4 2.4 2.6 5.4 2.6s5.4-1.2 5.4-2.6v-4.8"/>',
  gift: '<path d="M4 11.4h16v8.2a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-8.2Z"/><path d="M3 7.6h18v3.8H3z"/><path d="M12 7.6v13"/><path d="M12 7.6c-1.6-3.2-5.2-3.4-5.2-1.2 0 1.2 2.2 1.2 5.2 1.2Zm0 0c1.6-3.2 5.2-3.4 5.2-1.2 0 1.2-2.2 1.2-5.2 1.2Z"/>',
  brief: '<rect x="3" y="7.4" width="18" height="12.4" rx="2.4"/><path d="M8.6 7.4V5.8a1.6 1.6 0 0 1 1.6-1.6h3.6a1.6 1.6 0 0 1 1.6 1.6v1.6"/><path d="M3 12.6h18"/>',
  list: '<path d="M9 6.5h11M9 12h11M9 17.5h11"/><circle cx="4.6" cy="6.5" r="1"/><circle cx="4.6" cy="12" r="1"/><circle cx="4.6" cy="17.5" r="1"/>',
  building: '<rect x="4.4" y="3.6" width="15.2" height="16.8" rx="2"/><path d="M9 8h2M13 8h2M9 12h2M13 12h2M10 20.4v-3.6h4v3.6"/>',
  info: '<circle cx="12" cy="12" r="8.6"/><path d="M12 11v5.2M12 7.9h.01"/>',
  alert: '<path d="M10.3 4.2 2.9 17.4a2 2 0 0 0 1.7 3h14.8a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0Z"/><path d="M12 9.4v4.2M12 16.8h.01"/>',
  target: '<circle cx="12" cy="12" r="8.6"/><circle cx="12" cy="12" r="4.6"/><circle cx="12" cy="12" r="1.2"/>',
  bookmark: '<path d="M6.5 3.8h11a1 1 0 0 1 1 1v15.4l-6.5-4-6.5 4V4.8a1 1 0 0 1 1-1Z"/>',
  share: '<circle cx="17.6" cy="6" r="2.6"/><circle cx="6.4" cy="12" r="2.6"/><circle cx="17.6" cy="18" r="2.6"/><path d="m8.7 10.8 6.6-3.6M8.7 13.2l6.6 3.6"/>',
  chat: '<path d="M20.4 11.6a7.9 7.9 0 0 1-11.5 7.1L4.4 20.2l1.5-4.5A7.9 7.9 0 1 1 20.4 11.6Z"/>',
  copy: '<rect x="8.8" y="8.8" width="11.2" height="11.2" rx="2.2"/><path d="M5.6 15.2H4.8A1.8 1.8 0 0 1 3 13.4V4.8A1.8 1.8 0 0 1 4.8 3h8.6a1.8 1.8 0 0 1 1.8 1.8v.8"/>',
  send: '<path d="M20.5 3.5 10.8 13.2"/><path d="M20.5 3.5 14.3 20.5l-3.5-7.3-7.3-3.5 17-6.2Z"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  minus: '<path d="M7 12h10"/>',
  bang: '<path d="M12 6.5v7M12 17.5h.01"/>',
  back: '<path d="M14.5 5.5 8 12l6.5 6.5"/>',
  plus: '<path d="M12 5.5v13M5.5 12h13"/>',
  refresh: '<path d="M20 11.5A8 8 0 1 0 18 17"/><path d="M20 5.5v6h-6"/>',
  monitor: '<rect x="2.8" y="4" width="18.4" height="12.4" rx="2"/><path d="M8.6 20h6.8M12 16.4V20"/>',
  sun: '<circle cx="12" cy="12" r="4.1"/><path d="M12 2.6v2.3M12 19.1v2.3M2.6 12h2.3M19.1 12h2.3M5.4 5.4l1.6 1.6M17 17l1.6 1.6M18.6 5.4 17 7M7 17l-1.6 1.6"/>',
  moon: '<path d="M20.4 14.6A8.6 8.6 0 0 1 9.4 3.6a8.8 8.8 0 1 0 11 11Z"/>',
  shield: '<path d="M12 3.3 19 6v6.1c0 4.3-3 7.6-7 8.6-4-1-7-4.3-7-8.6V6l7-2.7Z"/><path d="m9.2 12 2 2 3.6-3.8"/>',
  cash: '<rect x="2.8" y="6.2" width="18.4" height="11.6" rx="2.4"/><circle cx="12" cy="12" r="2.6"/>',
  doc: '<path d="M7 3.5h7l4 4V20a.6.6 0 0 1-.6.6H7.6A.6.6 0 0 1 7 20V3.5Z"/><path d="M14 3.5V8h4M9.6 12h5M9.6 15.6h5"/>',
  user: '<circle cx="12" cy="8.4" r="3.6"/><path d="M5 20a7 7 0 0 1 14 0"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/>',
  trash: '<path d="M5 7h14M10 7V4.6h4V7M7 7l1 13h8l1-13"/>',
  sparkle: '<path d="M12 3.5l1.9 5.1 5.1 1.9-5.1 1.9L12 17.5l-1.9-5.1L5 10.5l5.1-1.9L12 3.5Z"/>',
  print: '<path d="M7 8.5V3.5h10v5"/><rect x="3.5" y="8.5" width="17" height="8" rx="2"/><path d="M7 14h10v6.5H7z"/>',
  lock: '<rect x="5" y="10.5" width="14" height="9.5" rx="2"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/>'
};
const FILLED = {
  verified: '<path d="M12 2.6a9.4 9.4 0 1 0 0 18.8 9.4 9.4 0 0 0 0-18.8Zm4.7 7-5.5 5.6a1 1 0 0 1-1.4 0l-2.6-2.6a1 1 0 1 1 1.4-1.4l1.9 1.9 4.8-4.9a1 1 0 0 1 1.4 1.4Z"/>',
  bolt: '<path d="M13.4 2 4.8 13.1h5.3L9.9 22l8.9-11.4h-5.6L13.4 2Z"/>',
  bookmark: '<path d="M6.5 3.8h11a1 1 0 0 1 1 1v15.4l-6.5-4-6.5 4V4.8a1 1 0 0 1 1-1Z"/>'
};
const icon = (n, sz = 14, sw = 1.8, cls = "") => raw(`<svg${cls ? ` class="${esc(cls)}"` : ""} width="${sz}" height="${sz}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ICON[n]}</svg>`);
const iconF = (n, sz = 14, cls = "") => raw(`<svg${cls ? ` class="${esc(cls)}"` : ""} width="${sz}" height="${sz}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">${FILLED[n]}</svg>`);
const STATE_ICON = {
  ok: () => icon("check", 12, 2.8), part: () => icon("minus", 12, 2.8),
  no: () => icon("x", 11, 2.8), warn: () => icon("bang", 12, 2.8)
};
function assess(j) {
  const P = PROFILE;
  if (!P) return null;
  const parts = [];
  const facs = j.recruits.map(r => r[1]), rel = (P.fac && RELATED[P.fac]) || [];
  let f;
  if (P.fac && j.recruits.some(([u, fc]) => u === P.uni && fc === P.fac)) f = { state: "ok", pts: 35, key: "fieldExactUni", vars: { fac: L(FAC[P.fac]), uni: L(UNI[P.uni]) } };
  else if (P.fac && facs.includes(P.fac)) f = { state: "ok", pts: 32, key: "fieldExact", vars: { fac: L(FAC[P.fac]) } };
  else if (j.anyFaculty) f = P.student ? { state: "ok", pts: 24, key: "fieldAny" } : { state: "part", pts: 10, key: "fieldAnyStudents" };
  else if (P.fac && facs.some(x => rel.includes(x))) f = { state: "part", pts: 21, key: "fieldRelated", vars: { fac: L(FAC[facs.find(x => rel.includes(x))]) } };
  else if (j.noDegree) f = P.fac ? { state: "part", pts: 8, key: "fieldNone" } : { state: "ok", pts: 28, key: "fieldNoneFits" };
  else f = { state: "no", pts: 0, key: "fieldMiss", vars: { fac: listJoin([...new Set(facs)].slice(0, 2).map(x => L(FAC[x]))) } };
  parts.push({ k: "fField", max: 35, ...f });

  let st;
  if (P.student) st = { student: ["ok", 30, "stageStudent"], entry: ["ok", 24, "stageEntry"], junior: ["part", 14, "stageJunior"], mid: ["no", 3, "stageMid"] }[j.level];
  else {
    const lv = P.level;
    st = { student: ["no", 0, "stageStudentOnly"], entry: ["ok", 30, "stageEntryFits"],
           junior: lv === "y1to3" || lv === "y4plus" ? ["ok", 30, "stageJuniorFits"] : ["part", lv === "lt1" ? 16 : 10, "stageJunior"],
           mid: lv === "y4plus" ? ["ok", 30, "stageMidFits"] : lv === "y1to3" ? ["part", 12, "stageMid"] : ["no", 3, "stageMid"] }[j.level];
  }
  parts.push({ k: "fStage", max: 30, state: st[0], pts: st[1], key: st[2] });

  const home = L(placeOf(P)), g = L(GOV[j.gov]);
  let p;
  if (j.gov === "remote") p = { state: "ok", pts: 20, key: "placeRemote", vars: { home } };
  else if (P.gov === "abroad") p = j.returnees ? { state: "part", pts: 16, key: "placeReturn", vars: { gov: g } } : P.relocate ? { state: "part", pts: 10, key: "placeRelocate", vars: { gov: g } } : { state: "no", pts: 6, key: "placeAbroad", vars: { gov: g, home } };
  else if (j.gov === P.gov) p = { state: "ok", pts: 20, key: "placeSame", vars: { gov: g } };
  else if ((NEAR[P.gov] || []).includes(j.gov)) p = { state: "part", pts: 12, key: "placeNear", vars: { gov: g, home } };
  else if (j.support) p = { state: "part", pts: 14, key: "placeSupport", vars: { home } };
  else if (P.relocate) p = { state: "part", pts: 10, key: "placeRelocate", vars: { gov: g } };
  else p = { state: "no", pts: 6, key: "placeFar", vars: { gov: g, home } };
  parts.push({ k: "fPlace", max: 20, ...p });

  const miss = j.langs.filter(x => !P.langs.includes(x));
  parts.push(miss.length
    ? { k: "fLang", max: 15, state: "no", pts: 5, key: "langMiss", vars: { langs: listJoin(miss.map(x => L(LANGS[x]))) } }
    : { k: "fLang", max: 15, state: "ok", pts: 15, key: "langOk", vars: { langs: listJoin(j.langs.map(x => L(LANGS[x]))) } });

  let score = parts.reduce((a, x) => a + x.pts, 0), capped = false;
  if (f.state === "no" && score > 35) { score = 35; capped = true; }
  return { score, capped, parts };
}
function initialsOf(n) {
  const w = String(n || "").trim().split(/\s+/).filter(Boolean);
  if (!w.length) return "";
  const a = w[0][0], b = w.length > 1 ? w[w.length - 1][0] : "";
  return (a + b).toUpperCase();
}
function deriveProfile(me) {
  if (!validMe(me)) return null;
  const e = me.edu, student = e.status === "student";
  const nm = me.name.trim(), nmAr = (me.nameAr || nm).trim();
  const fac = lg => (e.fac && FAC[e.fac] ? FAC[e.fac][lg] : "");
  const facYear = {};
  for (const lg of ["en", "ar"]) {
    if (student) facYear[lg] = fac(lg) ? tl(lg, "facYearFmt", { fac: fac(lg), ord: STR[lg].ordLower[e.year] || e.year }) : "";
    else if (e.status === "bachelor") facYear[lg] = fac(lg) ? tl(lg, "eduShortBachelor", { fac: fac(lg) }) : tl(lg, "edu_bachelor");
    else if (e.status === "master") facYear[lg] = fac(lg) ? tl(lg, "eduShortMaster", { fac: fac(lg) }) : tl(lg, "edu_master");
    else if (e.status === "diploma") facYear[lg] = fac(lg) ? tl(lg, "eduShortDiploma", { fac: fac(lg) }) : tl(lg, "edu_diploma");
    else facYear[lg] = tl(lg, "edu_secondary");
  }
  return { name: { en: nm, ar: nmAr }, initials: { en: initialsOf(nm), ar: initialsOf(nmAr) },
           uni: e.uni && UNI[e.uni] ? e.uni : null, fac: e.fac && FAC[e.fac] ? e.fac : null, year: e.year || 0, grad: e.grad || 0,
           gov: me.gov, country: me.country || "", langs: me.langs.length ? me.langs : ["ar"], facYear, phone: me.phone || "", email: me.email || "",
           student, status: e.status, level: (me.prefs && me.prefs.level) || "", relocate: !!me.relocate, demo: !!me.demo };
}
function rescore() { for (const j of JOBS) { const a = assess(j); j._score = a ? a.score : 0; } }
const JOB = new Map();
/* Jobs arrive from the API. Fill each bilingual field from the other language when one is missing,
   so an Arabic-only listing still reads in English and the reverse. */
function bi(o) {
  const en = o && typeof o === "object" ? o.en : o, ar = o && typeof o === "object" ? o.ar : o;
  return { en: (en && String(en).trim()) || ar || "", ar: (ar && String(ar).trim()) || en || "" };
}
function biList(o) {
  const en = (o && Array.isArray(o.en) ? o.en : []).filter(Boolean), ar = (o && Array.isArray(o.ar) ? o.ar : []).filter(Boolean);
  return { en: en.length ? en : ar, ar: ar.length ? ar : en };
}
function prepJobs(list) {
  JOBS.length = 0; JOB.clear();
  for (const raw of list) {
    const j = { ...raw, title: bi(raw.title), co: bi(raw.co), place: bi(raw.place), summary: bi(raw.summary), about: bi(raw.about),
      duties: biList(raw.duties), needs: biList(raw.needs), provides: biList(raw.provides),
      contact: { name: bi(raw.contact && raw.contact.name), role: bi(raw.contact && raw.contact.role), status: bi(raw.contact && raw.contact.status),
                 av: bi(raw.contact && raw.contact.av) }, recruits: raw.recruits || [], langs: raw.langs || ["ar"] };
    if (!j.contact.av.en) { const n = j.contact.name; j.contact.av = { en: initialsOf(n.en).slice(0, 2), ar: initialsOf(n.ar).slice(0, 2) }; }
    const bits = [j.abbr, j.tags || ""];
    for (const lg of ["en", "ar"]) {
      bits.push(j.title[lg], j.co[lg], j.place[lg], j.summary[lg], ...j.duties[lg], ...j.needs[lg], ...j.provides[lg],
        GOV[j.gov] ? GOV[j.gov][lg] : "", CAT[j.cat] ? CAT[j.cat][lg] : "", TYPE[j.type] ? TYPE[j.type][lg] : "", LEVEL[j.level] ? LEVEL[j.level][lg] : "");
      for (const [u, f] of j.recruits) bits.push(UNI[u] ? UNI[u][lg] : "", FAC[f] ? FAC[f][lg] : "");
    }
    j._hay = norm(bits.join(" "));
    j._score = 0;
    JOBS.push(j); JOB.set(j.id, j);
  }
}
function passesBase(j) {
  if (S.gov !== "all" && j.gov !== S.gov && j.gov !== "remote") return false;   // remote roles are open everywhere
  for (const term of S.qTerms) if (!j._hay.includes(term)) return false;
  return true;
}
function inTab(j, tab) {
  switch (tab) {
    case "returnees": return !!j.returnees;
    case "intern": return j.type === "intern";
    case "domestic": case "multinational": return j.cat === tab;
    case "entry": return j.level === "entry";
    case "saved": return S.saved.has(j.id);
    default: return true;
  }
}
const payHi = j => (j.pay ? j.pay[1] : 0);
const SORTS = {
  recent: (a, b) => a.days - b.days || b._score - a._score,
  match: (a, b) => b._score - a._score || a.days - b.days,
  pay: (a, b) => payHi(b) - payHi(a) || a.days - b.days
};
const results = () => JOBS.filter(j => passesBase(j) && inTab(j, S.tab)).sort(SORTS[S.sort] || SORTS.recent);
const countTab = tab => JOBS.reduce((n, j) => n + (passesBase(j) && inTab(j, tab) ? 1 : 0), 0);
const usd = n => Math.round(n / RATE.syp / 10) * 10;
const rng = (a, b) => (a === b ? fmt(a) : `${fmt(a)}–${fmt(b)}`);
function payText(j) {
  if (!j.pay) return { main: t("unpaid"), alt: "" };
  const [lo, hi] = j.pay;
  return S.lang === "ar"
    ? { main: `${rng(lo, hi)} ل.س ${t("perMonth")}`, alt: `≈ ${rng(usd(lo), usd(hi))} دولار` }
    : { main: `${rng(lo, hi)} SYP ${t("perMonth")}`, alt: `≈ $${rng(usd(lo), usd(hi))}` };
}
const ago = d => (d <= 0 ? t("today") : d === 1 ? t("yesterday") : tn("daysAgo", d));
const tier = s => (s >= 75 ? "hi" : s >= 50 ? "mid" : "lo");
const countLabel = j => (j.openings ? (j.type === "intern" ? tn("seats", j.openings) : tn("openings", j.openings)) : "");
function greetName(n) {
  const p = n.trim().split(/\s+/);
  const titles = { "Dr": "Dr", "Dr.": "Dr", "Eng.": "Eng.", "الدكتور": "دكتور", "الدكتورة": "دكتورة", "المهندس": "مهندس", "المهندسة": "مهندسة" };
  return titles[p[0]] && p[1] ? `${titles[p[0]]} ${p[1]}` : p[0];
}
async function copyText(str, fromEl) {
  try { if (navigator.clipboard && navigator.clipboard.writeText) { await navigator.clipboard.writeText(str); return true; } } catch (e) { /* fall through */ }
  try {
    let el = fromEl, tmp = null;
    if (!el) {
      tmp = el = document.createElement("textarea");
      el.value = str; el.setAttribute("readonly", "");
      el.style.cssText = "position:fixed;top:-200px;opacity:0";
      document.body.appendChild(el);
    }
    el.focus(); el.select();
    const ok = typeof document.execCommand === "function" && document.execCommand("copy");
    if (ok && el.setSelectionRange) el.setSelectionRange(0, 0);
    if (tmp) tmp.remove();
    return !!ok;
  } catch (e) { return false; }
}
const GENDER_AR = new Set(["موظفه", "موظفات", "سكرتيره", "انسه", "فتاه", "فتيات", "شابه", "شاب", "اناث", "ذكور", "بنات", "سيدات", "سيده"]);
const GENDER_EN = /\b(?:(?:females?|males?|women|men|ladies|girls|boys)\s+only|(?:female|male)\s+(?:preferred|candidates?|applicants?|staff|employees?|secretary|receptionist|workers?|cashiers?|assistants?)|must\s+be\s+(?:a\s+)?(?:female|male|woman|man)|young\s+(?:woman|man|lady))\b/i;
const FEE_EN = /\b(?:fees?|deposit|registration\s+(?:cost|charge)|training\s+(?:cost|charge)|pay\s+to\s+apply|application\s+(?:cost|charge)|processing\s+(?:fee|charge))\b/i;
const FEE_AR_PHRASES = ["رسم تسجيل", "رسم التسجيل", "رسم اشتراك", "مبلغ مالي", "دفع مبلغ", "كفاله ماليه", "تامين مالي", "مبلغ تامين", "بدل تسجيل"];
function prefixVariants(w) {
  const out = [w];
  let x = w;
  if (/^[وف]/.test(x) && x.length > 3) { x = x.slice(1); out.push(x); }
  const m = /^(ال|لل|بال|كال)/.exec(x);
  if (m && x.length > m[0].length + 1) out.push(x.slice(m[0].length));
  return out;
}
const bare = w => w.replace(/[^\p{L}\p{N}]/gu, "");
function findGender(text) {
  const m = text.match(GENDER_EN);
  if (m) return m[0];
  for (const w of text.split(/\s+/)) {
    const n = norm(w);
    if (n && prefixVariants(n).some(c => GENDER_AR.has(c))) return bare(w);
  }
  return null;
}
function findFee(text) {
  const m = text.match(FEE_EN);
  if (m) return m[0];
  const n = ` ${norm(text)} `;
  for (const p of FEE_AR_PHRASES) if (n.includes(` ${p} `)) return p;
  for (const w of text.split(/\s+/)) if (prefixVariants(norm(w)).includes("رسوم")) return bare(w);
  return null;
}
const parseMoney = s => { const d = norm(s).replace(/\D/g, ""); return d ? Math.min(parseInt(d, 10), 1e9) : 0; };
function postPayText(lo, hi) {
  const r = hi > lo ? `${fmt(lo)}–${fmt(hi)}` : fmt(lo), u = hi > lo ? `${fmt(usd(lo))}–${fmt(usd(hi))}` : fmt(usd(lo));
  return S.lang === "ar" ? `${r} ل.س ${t("perMonth")} (≈ ${u} دولار)` : `${r} SYP ${t("perMonth")} (≈ $${u})`;
}

/* ---------- from v1 onboarding.js ---------- */
const OB_STEPS = ["account", "about", "edu", "goals", "exp"];
const MONTHS = {
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  ar: ["كانون الثاني", "شباط", "آذار", "نيسان", "أيار", "حزيران", "تموز", "آب", "أيلول", "تشرين الأول", "تشرين الثاني", "كانون الأول"]
};
function clone(o) { return JSON.parse(JSON.stringify(o)); }
function uid(p) { return p + Math.random().toString(36).slice(2, 8); }
function getPath(o, path) { return path.split(".").reduce((a, k) => (a == null ? a : a[k]), o); }
function setPath(o, path, v) {
  const ks = path.split(".");
  let a = o;
  for (let i = 0; i < ks.length - 1; i++) { if (a[ks[i]] == null) a[ks[i]] = {}; a = a[ks[i]]; }
  a[ks[ks.length - 1]] = v;
}
function tl(lang, k, v) { const s = STR[lang][k] ?? STR.en[k]; return s == null ? k : fill(s, v); }
function fmtMonth(ym, lang) {
  if (!ym) return "";
  const [y, m] = ym.split("-").map(Number);
  return m ? `${MONTHS[lang][m - 1]} ${y}` : String(y);
}
function fmtRange(e, lang) {
  const a = fmtMonth(e.start, lang), b = e.current ? tl(lang, "present") : fmtMonth(e.end, lang);
  return b && b !== a ? `${a} – ${b}` : a;
}
function firstName(n) { return String(n || "").trim().split(/\s+/)[0] || ""; }
function normPhone(rawIn) {
  let n = norm(rawIn).replace(/\D/g, "");
  if (n.startsWith("00963")) n = n.slice(5);
  if (n.startsWith("963")) n = n.slice(3);
  if (n.startsWith("0")) n = n.slice(1);
  return /^9\d{8}$/.test(n) ? `+963 ${n.slice(0, 3)} ${n.slice(3, 6)} ${n.slice(6)}` : null;
}
function facKeysSorted() {
  return Object.keys(FAC).sort((a, b) => L(FAC[a]).localeCompare(L(FAC[b]), S.lang === "ar" ? "ar" : "en"));
}
function gradYears(future) {
  const out = [];
  if (future) for (let y = 2026; y <= 2033; y++) out.push(y);
  else for (let y = 2026; y >= 1995; y--) out.push(y);
  return out;
}
function optList(keys, label, cur, placeholder) {
  return html`${placeholder != null ? html`<option value="">${placeholder}</option>` : ""}${keys.map(k =>
    html`<option value="${k}"${String(k) === String(cur) ? raw(" selected") : ""}>${label(k)}</option>`)}`;
}
function blankMe(role) {
  return {
    v: 1, role, name: "", nameAr: "", nameEn: "", phone: "", email: "", gov: "", relocate: false, langs: ["ar"],
    edu: { status: role === "student" ? "student" : "", uni: "", uniName: "", fac: "", year: 0, grad: 0, gpa: "", course: "", honors: "" },
    prefs: { types: role === "student" ? ["intern"] : ["full"], fields: [], level: role === "student" ? "none" : "" },
    exp: [], acts: [], skills: [], certs: [], tailor: {}
  };
}
function validMe(m) {
  return m && m.v === 1 && m.name && m.gov && m.edu && Array.isArray(m.langs) && Array.isArray(m.exp) ? m : null;
}
const OB_VALID = {
  account: () => {
    const e = {}, ph = normPhone(OB.phoneRaw);
    if (!ph) e.phone = "obErrPhone"; else OB.d.phone = ph;
    if (OB.codeSent && !/^\d{6}$/.test(norm(OB.code).replace(/\s/g, ""))) e.code = "obErrCode";
    return e;
  },
  about: () => {
    const d = OB.d, e = {};
    if (d.name.trim().length < 2) e.name = "obErrName";
    if (!d.gov) e.gov = "obErrGov";
    if (d.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email.trim())) e.email = "obErrEmail";
    if (!d.langs.length) e.langs = "obErrLangs";
    return e;
  },
  edu: () => {
    const d = OB.d, x = d.edu, e = {}, student = d.role === "student";
    if (student) {
      if (!x.uni) e["edu.uni"] = "obErrUni";
      if (!x.fac) e["edu.fac"] = "obErrFac";
      if (!x.year) e["edu.year"] = "obErrYear";
      if (!x.grad) e["edu.grad"] = "obErrGrad";
    } else {
      if (!x.status) e["edu.status"] = "obErrLevel";
      if ((x.status === "bachelor" || x.status === "master") && !x.fac) e["edu.fac"] = "obErrFac";
    }
    if (x.uni === "other" && !String(x.uniName || "").trim()) e["edu.uniName"] = "obErrUniName";
    return e;
  },
  goals: () => {
    const d = OB.d, e = {};
    if (!d.prefs.types.length) e["prefs.types"] = "obErrTypes";
    if (d.role !== "student" && !d.prefs.level) e["prefs.level"] = "obErrExpLevel";
    return e;
  },
  exp: () => (OB.form ? { form: "obErrOpenForm" } : {})
};
function newEntryForm(kind) { return { kind, id: null, role: "", org: "", place: "", sm: "", sy: "", em: "", ey: "", current: false, bullets: "", errors: {} }; }
function entryToForm(d, kind, id) {
  const e = d[kind].find(x => x.id === id);
  if (!e) return null;
  const [sy, sm] = (e.start || "").split("-"), [ey, em] = (e.end || "").split("-");
  return { kind, id, role: e.role, org: e.org, place: e.place || "", sm: sm ? String(+sm) : "", sy: sy || "", em: em ? String(+em) : "", ey: ey || "",
           current: !!e.current, bullets: e.bullets.join("\n"), errors: {} };
}
function removeEntry(d, kind, id) {
  d[kind] = d[kind].filter(x => x.id !== id);
  if (d.tailor) for (const tgt of Object.keys(d.tailor)) for (const k of Object.keys(d.tailor[tgt])) if (k.startsWith(id + "|")) delete d.tailor[tgt][k];
}
function saveEntryForm(d, f) {
  const e = {};
  if (!f.role.trim()) e.role = "efErrRole";
  if (!f.org.trim()) e.org = "efErrOrg";
  if (!f.sm || !f.sy) e.start = "efErrStart";
  if (!f.current && (!f.em || !f.ey)) e.end = "efErrEnd";
  const start = f.sy && f.sm ? `${f.sy}-${String(f.sm).padStart(2, "0")}` : "";
  const end = !f.current && f.ey && f.em ? `${f.ey}-${String(f.em).padStart(2, "0")}` : "";
  if (start && end && end < start) e.end = "efErrOrder";
  f.errors = e;
  if (Object.keys(e).length) return false;
  const bullets = f.bullets.split(/\n+/).map(s => s.replace(/^\s*[-•*·–]\s*/, "").trim()).filter(Boolean);
  const entry = { id: f.id || uid(f.kind === "exp" ? "e" : "a"), role: f.role.trim(), org: f.org.trim(), place: f.place.trim(), start, end, current: !!f.current, bullets };
  const list = d[f.kind], i = list.findIndex(x => x.id === entry.id);
  if (i >= 0) list[i] = entry; else list.push(entry);
  return true;
}

/* ---------- from v1 resume.js ---------- */
const MAX_BULLETS = 4;
const CV_RULES = [
  { en: "Put your strongest, most relevant experience first; employers spend under 10 seconds on each resume.", ar: "ضع أقوى خبراتك وأكثرها صلة أولاً، فأصحاب العمل يقضون أقل من 10 ثوانٍ على كل سيرة." },
  { en: "Students and new graduates put Education before Experience.", ar: "الطلاب والخريجون الجدد يضعون التعليم قبل الخبرة.", src: "GW Graduate School of Education and Human Development" },
  { en: "List roles in reverse chronological order.", ar: "رتّب الأدوار من الأحدث إلى الأقدم.", src: "GW Graduate School of Education and Human Development" },
  { en: "Start every bullet with an action verb.", ar: "ابدأ كل نقطة بفعل يصف ما قمت به.", src: "GW Trachtenberg School and Elliott School career guides" },
  { en: "Describe what you did, the context, and the result, with numbers where you have them.", ar: "اذكر ما فعلته وسياقه ونتيجته، مع أرقام حين تتوفر.", src: "Common business-school practice" },
  { en: "Past tense for finished roles, present tense for current ones; no personal pronouns.", ar: "الماضي للأدوار المنتهية والمضارع للحالية، ومن دون ضمائر شخصية.", src: "Common business-school practice" },
  { en: "Keep it to one page.", ar: "اجعلها صفحة واحدة.", src: "Common business-school practice" },
  { en: "Leave out photo, date of birth, marital status and religion.", ar: "لا تضع صورة أو تاريخ الميلاد أو الحالة الاجتماعية أو الديانة.", src: "Shaghilni fair-hiring policy" }
];
const VERBS = [
  ["managing","Managed","Manage"],["organizing","Organized","Organize"],["organising","Organised","Organise"],["logging","Logged","Log"],
  ["preparing","Prepared","Prepare"],["tracking","Tracked","Track"],["writing","Wrote","Write"],["handling","Handled","Handle"],
  ["coordinating","Coordinated","Coordinate"],["supervising","Supervised","Supervise"],["training","Trained","Train"],["maintaining","Maintained","Maintain"],
  ["leading","Led","Lead"],["planning","Planned","Plan"],["answering","Answered","Answer"],["serving","Served","Serve"],["teaching","Taught","Teach"],
  ["tutoring","Tutored","Tutor"],["analyzing","Analyzed","Analyze"],["analysing","Analysed","Analyse"],["developing","Developed","Develop"],
  ["designing","Designed","Design"],["building","Built","Build"],["running","Ran","Run"],["selling","Sold","Sell"],["recording","Recorded","Record"],
  ["reporting","Reported","Report"],["monitoring","Monitored","Monitor"],["checking","Checked","Check"],["processing","Processed","Process"],
  ["creating","Created","Create"],["updating","Updated","Update"],["collecting","Collected","Collect"],["conducting","Conducted","Conduct"],
  ["delivering","Delivered","Deliver"],["driving","Drove","Drive"],["cleaning","Cleaned","Clean"],["cooking","Cooked","Cook"],
  ["translating","Translated","Translate"],["drafting","Drafted","Draft"],["reviewing","Reviewed","Review"],["testing","Tested","Test"],
  ["installing","Installed","Install"],["repairing","Repaired","Repair"],["scheduling","Scheduled","Schedule"],["ordering","Ordered","Order"],
  ["budgeting","Budgeted","Budget"],["researching","Researched","Research"],["presenting","Presented","Present"],["negotiating","Negotiated","Negotiate"],
  ["recruiting","Recruited","Recruit"],["describing","Described","Describe"],["measuring","Measured","Measure"],["calculating","Calculated","Calculate"],
  ["filing","Filed","File"],["documenting","Documented","Document"],["supporting","Supported","Support"],["assisting","Assisted","Assist"],
  ["operating","Operated","Operate"],["inspecting","Inspected","Inspect"],["editing","Edited","Edit"],["filming","Filmed","Film"],
  ["coaching","Coached","Coach"],["mentoring","Mentored","Mentor"],["welcoming","Welcomed","Welcome"],["stocking","Stocked","Stock"],
  ["packing","Packed","Pack"],["loading","Loaded","Load"],["counting","Counted","Count"],["cashing","Cashed","Cash"],["advising","Advised","Advise"]
];
const V_GER = new Map(VERBS.map(v => [v[0], v])), V_PAST = new Map(VERBS.map(v => [v[1].toLowerCase(), v])), V_BASE = new Map(VERBS.map(v => [v[2].toLowerCase(), v]));
const LEAD_VERBS = new Set(["led", "managed", "directed", "headed", "supervised", "oversaw", "spearheaded", "ran", "owned", "chaired", "founded", "manage", "lead", "direct", "supervise"]);
const HELP_START = /^(helped|help|assisted|assist|supported|support|contributed|contribute|participated|participate|took part|shadowed|observed|worked with|work with)\b/i;
const NUM_WORDS = new Set("one two three four five six seven eight nine ten eleven twelve fifteen twenty thirty forty fifty hundred hundreds thousand thousands million dozen dozens percent".split(" "));
// The same three checks in Arabic (U-010): number words, "helped" grown into "led", and places; the lists go through norm() like the text.
const arSet = words => new Set(words.split(" ").map(norm));
// Arabic number words, one number to a group in its forms (gender, case, the duals, مئة/مائة, and the duals that say "two years", "two months"...): a change of form is the same number, and only these words are numbers (fix reviews 2 and 3)
const AR_NUM = new Map("واحد واحدة واحدا|اثنان اثنين اثنتين اثنتان اثني اثنتي|ثلاث ثلاثة|أربع أربعة|خمس خمسة|ست ستة|سبع سبعة|ثمان ثماني ثمانية|تسع تسعة|عشر عشرة|عشرات|عشرين عشرون|ثلاثين ثلاثون|أربعين أربعون|خمسين خمسون|ستين ستون|سبعين سبعون|ثمانين ثمانون|تسعين تسعون|مئة مائة|مئتين مئتان مئتي مئتا مائتين مائتان مائتي مائتا|مئات|ثلاثمئة ثلاثمائة|أربعمئة أربعمائة|خمسمئة خمسمائة|ستمئة ستمائة|سبعمئة سبعمائة|ثمانمئة ثمانمائة|تسعمئة تسعمائة|ألف ألفا|ألفين ألفان ألفي|آلاف ألوف|مليون مليونا|مليونين مليونان مليوني|ملايين|مليار مليارا|مليارين ملياران ملياري|مليارات|سنتين سنتان عامين عامان|شهرين شهران|أسبوعين أسبوعان|يومين يومان|ساعتين ساعتان"
  .split("|").flatMap(g => { const f = g.split(" ").map(norm); return f.map(w => [w, f[0]]); }));
const joinHundreds = x => norm(x).replace(/(^| )(ثلاث|اربع|خمس|ست|سبع|ثمان|تسع) (ميه|مايه)(?= |$)/g, "$1$2$3");   // ثلاث مئة is ثلاثمئة
const AR_HELP = arSet("دعم إسهام أسهمت أسهم أسهمنا مساعدة مشاركة مساهمة ساعدت ساعد أساعد ساعدنا شاركت شارك أشارك شاركنا ساهمت ساهم أساهم ساهمنا دعمت عاونت تعاونت");
const AR_LEAD = arSet("قيادة إدارة إشراف ترؤس قدت قاد أقود قدنا أدرت أدار أدير أدرنا أشرفت أشرف أشرفنا ترأست ترأس تولّيت أسست أسس");
let AR_PLACES = null;   // the Arabic names of the governorates and countries, filled on first use
const leadWords = x => { const ws = norm(x).split(" "); return /^(قمت|قمنا|كنت|كنا)$/.test(ws[0]) && ws[1] ? [ws[0], ws[1].replace(/^ب(?=..)/, "")] : [ws[0] || ""]; };   // «قمت بمساعدة …» opens with its second word, less its ب; a first word keeps its ب, so «بإشراف المدير» is no bigger role (fix review 3)
const usPair = x => { const w = norm(x).split(" "), out = new Set(); for (let i = 0; i < w.length - 1; i++) { const v = prefixVariants(w[i]).find(c => c === "ولايات" || c === "مملكه"); if (v && w[i + 1] === "المتحده") out.add(v); } return out; };   // the two-word countries named in a text
const arVariants = w => { const v = new Set(prefixVariants(w)); for (const x of [...v]) if (/^[بلك]/.test(x) && x.length > 3) v.add(x.slice(1)); return [...v]; };   // و ف ال لل بال كال, and ب ل ك before a name
const EXTRA_VERBS = "achieved advised arranged audited catalogued chaired classified communicated compiled completed composed computed contributed convinced coordinated counselled demonstrated designed determined directed distributed drafted earned edited educated enabled established estimated evaluated examined executed expanded facilitated forecasted formulated founded gathered generated guided identified implemented improved increased initiated instructed interpreted interviewed introduced investigated launched maximized mediated minimized modernized motivated navigated observed obtained oversaw participated performed persuaded piloted prioritized produced programmed promoted proposed provided published purchased raised reconciled redesigned reduced resolved responded restored revised scheduled screened secured simplified solved sorted spearheaded streamlined strengthened structured summarized surveyed synthesized trained transformed upgraded utilized verified volunteered worked";
const VERB_STEMS = new Set();  // filled in cvInit(), once stem() and norm() exist
const SKILL_LEX = [
  ["excel", "Excel", "إكسل", ["excel", "اكسل", "spreadsheet", "جداول"]],
  ["english", "English", "الإنكليزية", ["english", "انكليز", "انجليز"]],
  ["reports", "Report writing", "كتابة التقارير", ["report", "تقرير", "تقارير"]],
  ["customers", "Customer service", "خدمة الزبائن", ["customer", "زبائن", "عملاء"]],
  ["cash", "Cash handling", "التعامل مع النقد", ["cash", "till", "نقد", "الصندوق", "كاشير"]],
  ["safety", "Health and safety", "الصحة والسلامة", ["safety", "hse", "nebosh", "iosh", "سلامه"]],
  ["field", "Field work", "العمل الميداني", ["field", "wellsite", "ميداني"]],
  ["geology", "Geology", "الجيولوجيا", ["geolog", "cuttings", "جيولوج"]],
  ["drilling", "Drilling", "الحفر", ["drilling", "حفر"]],
  ["autocad", "AutoCAD", "أوتوكاد", ["autocad", "اوتوكاد"]],
  ["react", "React", "React", ["react"]],
  ["audit", "Auditing", "التدقيق", ["audit", "تدقيق"]],
  ["accounting", "Accounting", "المحاسبة", ["accounting", "accountant", "محاسب"]],
  ["analysis", "Analysis", "التحليل", ["analys", "analyz", "تحليل"]],
  ["presenting", "Presenting", "العرض والتقديم", ["present", "عرض"]],
  ["team", "Teamwork", "العمل ضمن فريق", ["team", "فريق"]],
  ["sales", "Sales", "المبيعات", ["sales", "مبيعات"]],
  ["licence", "Driving licence", "إجازة القيادة", ["licence", "license", "اجازه قياده"]],
  ["lab", "Laboratory work", "العمل المخبري", ["laboratory", "lab ", "مخبر", "عينات", "samples", "sampling"]],
  ["research", "Research", "البحث", ["research", "بحث"]],
  ["video", "Video production", "الإنتاج المرئي", ["video", "camera", "تصوير"]],
  ["nursing", "Nursing", "التمريض", ["nurse", "nursing", "تمريض"]],
  ["networks", "Telecoms networks", "شبكات الاتصالات", ["telecom", "network", "شبكات"]],
  ["site", "Site supervision", "الإشراف على المواقع", ["concrete", "rebar", "site engineer", "صب"]],
  ["budget", "Budgeting", "إدارة الميزانية", ["budget", "ميزانيه"]],
  ["teaching", "Teaching and training", "التدريس والتدريب", ["tutor", "teach", "تدريس"]],
  ["scheduling", "Scheduling", "تنظيم الجداول", ["rota", "schedul", "ورديات"]],
  ["stock", "Stock control", "إدارة المخزون", ["stock", "inventory", "مخزون"]]
];
const UNI_CITY = { damascus: "damascus", aleppo: "aleppo", homs: "homs", latakia: "latakia", furat: "deirezzor", hama: "hama", hiast: "damascus", hiba: "damascus", svu: "remote", aleppoti: "aleppo" };
const STOP = new Set(("a an the and or of for to in on at by with from as is are be this that your you our we will can per each all any into over under their them his her its "
  + "في من على الى عن مع او ثم هذا هذه ذلك التي الذي كل بعد قبل عند لدى حتى غير و").split(" ").map(norm));   // through norm(), which writes ى as ي (fix review 2)
function stem(w) {
  if (/^[a-z]/.test(w)) {
    if (w.length > 5 && w.endsWith("ies")) return w.slice(0, -3) + "y";
    if (w.length > 5 && w.endsWith("ing")) return w.slice(0, -3);
    if (w.length > 4 && w.endsWith("ed")) return w.slice(0, -2);
    if (w.length > 4 && w.endsWith("es")) return w.slice(0, -2);
    if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1);
    if (w.length > 4 && w.endsWith("e")) return w.slice(0, -1);   // describe / describing -> describ
    return w;
  }
  let x = w.replace(/^(وال|بال|كال|فال|لل|ال)/, "");
  if (x.length > 4) x = x.replace(/(ات|ون|ين|ه)$/, "");
  return x.length >= 2 ? x : w;
}
function toks(s) { return norm(s).split(" ").filter(w => w.length > 2 && !STOP.has(w)).map(stem); }
function cvInit() {
  if (VERB_STEMS.size) return;
  for (const v of VERBS) for (const f of v) VERB_STEMS.add(stem(norm(f)));
  for (const w of EXTRA_VERBS.split(" ")) VERB_STEMS.add(stem(w));
}
function jobPlain(j) { return [j.title.en, j.title.ar, ...j.duties.en, ...j.duties.ar, ...j.needs.en, ...j.needs.ar, j.summary.en, j.tags || ""].join(" "); }
function jobKeywords(j) {
  const w = new Map(), add = (s, k) => { for (const x of toks(s)) w.set(x, (w.get(x) || 0) + k); };
  add(j.title.en + " " + j.title.ar, 3);
  for (const s of [...j.needs.en, ...j.needs.ar]) add(s, 2);
  for (const s of [...j.duties.en, ...j.duties.ar]) add(s, 1.5);
  add(j.tags || "", 1);
  return w;
}
function relScore(text, kw) { let s = 0; for (const x of new Set(toks(text))) s += kw.get(x) || 0; return s; }
function factsText(me) {
  const e = me.edu;
  return [me.name, me.nameAr || "", me.nameEn || "", e.gpa, e.course, e.honors, e.uniName || "",
    e.uni && UNI[e.uni] ? UNI[e.uni].en + " " + UNI[e.uni].ar : "", e.fac && FAC[e.fac] ? FAC[e.fac].en + " " + FAC[e.fac].ar : "",
    ...me.exp.flatMap(x => [x.role, x.org, x.place, ...x.bullets]), ...me.acts.flatMap(x => [x.role, x.org, x.place, ...x.bullets]),
    ...me.skills, ...(me.certs || []), ...me.langs.map(k => LANGS[k] ? LANGS[k].en + " " + LANGS[k].ar : "")].join(" ");
}
function lexHit(words, text, v) {
  if (v.includes(" ")) return (" " + text + " ").includes(" " + v + " ");
  const bare = w => w.replace(/^(وال|بال|لل|ال)/, "");
  return words.some(w => { const b = bare(w); return w === v || b === v || (v.length >= 5 && (w.startsWith(v) || b.startsWith(v))); });
}
function coverage(me, job) {
  const jt = norm(jobPlain(job)), ft = norm(factsText(me)), jw = jt.split(" "), fw = ft.split(" ");
  const have = [], miss = [];
  for (const [k, en, ar, vs] of SKILL_LEX) {
    const vn = vs.map(v => norm(v)).filter(Boolean);
    if (!vn.some(v => lexHit(jw, jt, v))) continue;
    (vn.some(v => lexHit(fw, ft, v)) ? have : miss).push({ k, label: S.lang === "ar" ? ar : en });
  }
  return { have, miss };
}
function factGuard(orig, sug, facts, jobText) {
  cvInit();
  const s = String(sug || "").trim();
  if (!s) return { ok: false, why: "gEmpty" };
  const nums = x => norm(x).match(/\d+/g) || [];
  const have = new Set(nums(orig));
  const n1 = nums(s).find(n => !have.has(n));
  if (n1) return { ok: false, why: "gNumber", tok: n1 };
  const isNum = c => NUM_WORDS.has(c) || AR_NUM.has(c), numKey = c => AR_NUM.get(c) || c, ow = new Set(joinHundreds(orig).split(" ").flatMap(arVariants).filter(isNum).map(numKey));
  const n2 = joinHundreds(s).split(" ").find(w => arVariants(w).some(c => isNum(c) && !ow.has(numKey(c))));
  if (n2) return { ok: false, why: "gNumber", tok: (s.split(/\s+/).find(r => norm(r).split(" ").includes(n2)) || n2).replace(/[^\p{L}\p{N}]/gu, "") };   // the word as written (fix review 2)
  const first = norm(s).split(" ")[0], helpAr = leadWords(orig).some(w => prefixVariants(w).some(v => AR_HELP.has(v))), li = helpAr ? leadWords(s).findIndex(w => prefixVariants(w).some(v => AR_LEAD.has(v))) : -1;
  if ((HELP_START.test(orig.trim()) && LEAD_VERBS.has(first)) || li >= 0) return { ok: false, why: "gInflate", tok: s.split(/\s+/)[Math.max(li, 0)] };   // the bigger word as written
  if (!AR_PLACES) AR_PLACES = new Set([...Object.values(GOV), ...Object.values(COUNTRY)].flatMap(x => norm(x.ar).split(" ")).flatMap(w => [w, w.replace(/^ال/, "")])
    .filter(w => w.length > 2 && !["ريف", "دير", "بلد", "اخر", "بعد", "المملكه", "مملكه", "المتحده", "متحده", "الولايات", "ولايات", "رقه", "امارات"].includes(w)).concat(["امريكا", "اميركا", "بريطانيا"]));   // each name with and without ال; the words of "ريف دمشق" or "عن بعد" that are not names, and رقة/أمارات, which are also common words, left out
  const known = new Set(norm(`${orig} ${facts}`).split(" ").flatMap(arVariants)), rw = s.split(/\s+/), pairs = usPair(`${orig} ${facts}`);
  for (let i = 0; i < rw.length - 1; i++) if (prefixVariants(norm(rw[i])).some(v => (v === "ولايات" || v === "مملكه") && !pairs.has(v)) && norm(rw[i + 1]) === "المتحده") return { ok: false, why: "gName", tok: `${rw[i]} ${rw[i + 1]}`.replace(/[^\p{L}\p{N} ]/gu, "") };   // the two-word countries: the same pair must be in the facts, not just المتحدة (fix reviews 2 and 3)
  for (const raw0 of s.split(/\s+/)) { const w = norm(raw0); if (arVariants(w).some(c => AR_PLACES.has(c)) && !arVariants(w).some(c => known.has(c))) return { ok: false, why: "gName", tok: raw0.replace(/[^\p{L}\p{N}]/gu, "") }; }
  const factSet = new Set(toks(facts)), jobSet = new Set(toks(jobText));
  const words = s.split(/\s+/);
  for (const raw0 of words) {
    const w = norm(raw0); if (w.length <= 2 || STOP.has(w)) continue;
    const st = stem(w);
    if (!factSet.has(st) && !VERB_STEMS.has(st) && jobSet.has(st)) return { ok: false, why: "gBorrowed", tok: raw0.replace(/[^\p{L}\p{N}-]/gu, "") };
  }
  for (const raw0 of words.slice(1)) {
    const w = raw0.replace(/[^\p{L}\p{N}]/gu, "");
    if (/^\p{Lu}/u.test(w) && !factSet.has(stem(norm(w)))) return { ok: false, why: "gName", tok: w };
  }
  if (s.length > orig.length * 1.6 + 40) return { ok: false, why: "gLong" };
  return { ok: true };
}
const isArabic = s => /[\u0600-\u06FF]/.test(s);
const cap1 = s => s.charAt(0).toUpperCase() + s.slice(1);
function lintBullet(text, current) {
  const out = [], s = text.trim();
  if (isArabic(s)) {
    if (/^أنا\s/.test(s)) out.push({ key: "lkPronounAr", fix: s.replace(/^أنا\s+/, "") });
    if (!/\d|[٠-٩]/.test(s)) out.push({ key: "lkNumber" });
    if (s.length > 180) out.push({ key: "lkLong" });
    return out;
  }
  let m = /^(i|we)\s+(\S+)(.*)$/i.exec(s);
  if (m) { out.push({ key: "lkPronoun", fix: cap1(m[2]) + m[3] }); return out; }
  m = /^(?:was\s+)?(?:responsible for|in charge of|tasked with)\s+(\S+)(.*)$/i.exec(s);
  if (m && V_GER.has(m[1].toLowerCase())) {
    const v = V_GER.get(m[1].toLowerCase());
    out.push({ key: "lkResponsible", fix: (current ? v[2] : v[1]) + m[2] });
  } else if (m) out.push({ key: "lkResponsibleNoFix" });
  else if (HELP_START.test(s) || /^(worked on|duties included|involved in|did)\b/i.test(s)) out.push({ key: "lkWeak" });
  else {
    const w0 = (s.split(/\s+/)[0] || "").toLowerCase(), rest = s.slice(w0.length);
    if (!current && V_BASE.has(w0) && !V_PAST.has(w0)) out.push({ key: "lkTensePast", fix: V_BASE.get(w0)[1] + rest });
    else if (current && V_PAST.has(w0) && !V_BASE.has(w0)) out.push({ key: "lkTensePresent", fix: V_PAST.get(w0)[2] + rest });
  }
  if (!/\d/.test(s)) out.push({ key: "lkNumber" });
  if (s.length > 200) out.push({ key: "lkLong" });
  else if (s.length < 25) out.push({ key: "lkShort" });
  return out;
}
const ovKey = (id, text) => id + "|" + text;
const endKey = e => (e.current ? 999999 : Number((e.end || e.start || "0").replace("-", "")));
function sortRoles(list) { return list.slice().sort((a, b) => endKey(b) - endKey(a) || Number((b.start || "0").replace("-", "")) - Number((a.start || "0").replace("-", ""))); }
function eduModel(me, lang) {
  const e = me.edu, student = e.status === "student";
  const inst = e.uni === "other" ? e.uniName : e.uni && UNI[e.uni] ? UNI[e.uni][lang] : "";
  const city = e.uni && UNI_CITY[e.uni] ? (UNI_CITY[e.uni] === "remote" ? tl(lang, "cvOnline") : tl(lang, "cvCity", { city: GOV[UNI_CITY[e.uni]][lang] })) : "";
  const fac = e.fac && FAC[e.fac] ? FAC[e.fac][lang] : "";
  let degree = "";
  if (student || e.status === "bachelor") degree = fac ? tl(lang, "cvDegBachelor", { fac }) : tl(lang, "cvDegBachelorBare");
  else if (e.status === "master") degree = fac ? tl(lang, "cvDegMaster", { fac }) : tl(lang, "cvDegMasterBare");
  else if (e.status === "diploma") degree = fac ? tl(lang, "cvDegDiploma", { fac }) : tl(lang, "cvDegDiplomaBare");
  else if (e.status === "secondary") degree = tl(lang, "cvDegSecondary");
  if (student && e.year) degree += " " + tl(lang, "cvYearParen", { ord: String(STR[lang].ordLower[e.year] || e.year) });
  const date = e.grad ? tl(lang, student ? "cvExpected" : "cvGraduated", { y: e.grad }) : "";
  return { inst, city, degree, date, gpa: e.gpa, course: e.course, honors: e.honors };
}
/* ---------- bilingual resumes ----------
   A profile can be written in Arabic, English or a mix. Each piece of free text is shown as written when it's
   already in the resume's language, and otherwise in its saved translation (profile.tr[lang] holds pairs of
   [text as written, translation]). Names are never sent for translation: nameEn and nameAr are typed by the person, or written locally by translitName. */
const AR_SCRIPT = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
function scriptOf(s) { const v = String(s || ""); return AR_SCRIPT.test(v) ? "ar" : /[A-Za-z\u00C0-\u024F]/.test(v) ? "en" : ""; }
const latinDigits = s => String(s || "").replace(/[\u0660-\u0669]/g, d => String(d.charCodeAt(0) - 0x660)).replace(/[\u06F0-\u06F9]/g, d => String(d.charCodeAt(0) - 0x6F0));
function numbersOf(s) {
  const v = latinDigits(s).replace(/(\d)[,\u066C](?=\d{3}(?!\d))/g, "$1").replace(/(\d)\u066B(?=\d)/g, "$1.");
  return new Set(v.match(/\d+(?:\.\d+)?/g) || []);
}
/* The fact check for translations: the same numbers, none dropped and none invented, in any digit style. */
function sameNumbers(a, b) { const x = numbersOf(a), y = numbersOf(b); return x.size === y.size && [...x].every(v => y.has(v)); }
function trSources(me) {
  const out = [], seen = new Set();
  const add = s => { const v = String(s || "").trim(); if (v && scriptOf(v) && !seen.has(v)) { seen.add(v); out.push(v); } };
  for (const e of [...(me.exp || []), ...(me.acts || [])]) { add(e.role); add(e.org); add(e.place); (e.bullets || []).forEach(add); }
  const d = me.edu || {};
  if (d.uni === "other") add(d.uniName);
  add(d.gpa); add(d.course); add(d.honors);
  (me.skills || []).forEach(add); (me.certs || []).forEach(add);
  for (const map of Object.values(me.tailor || {})) for (const v of Object.values(map || {})) add(v);
  return out;
}
function trMap(me, lang) {
  const pairs = (me.tr && Array.isArray(me.tr[lang])) ? me.tr[lang] : [];
  return new Map(pairs.filter(p => Array.isArray(p) && p[0] && p[1]).map(p => [String(p[0]).trim(), String(p[1])]));
}
const TR_LANG = { en: { en: "English", ar: "الإنجليزية" }, ar: { en: "Arabic", ar: "العربية" } };
function trLang(lg) { return TR_LANG[lg === "ar" ? "ar" : "en"][S.lang === "ar" ? "ar" : "en"]; }
function buildResume(me, target, lang) {
  target = "general";   // there is one resume per person: no versions per job
  const job = target !== "general" ? JOB.get(Number(target)) : null;
  const kw = job ? jobKeywords(job) : null;
  const ov = (me.tailor && me.tailor[target]) || {};
  const T = trMap(me, lang), missing = new Set();
  let used = 0;
  const tx = (s, count = true) => {
    const v = String(s || ""), sc = scriptOf(v);
    if (!sc || sc === lang) return v;
    const hit = T.get(v.trim());
    if (hit) { if (count) used++; return hit; }
    if (count) missing.add(v.trim());
    return v;
  };
  const group = kind => sortRoles(me[kind]).map(e => {
    const items = e.bullets.map((orig, i) => ({ key: ovKey(e.id, orig), orig, t: ov[ovKey(e.id, orig)] || orig, i, sc: kw ? relScore(orig, kw) : 0 }));
    const ordered = kw ? items.slice().sort((a, b) => b.sc - a.sc || a.i - b.i) : items;
    const shown = ordered.slice(0, MAX_BULLETS), hidden = ordered.slice(MAX_BULLETS);
    for (const b of shown) b.t = tx(b.t);
    for (const b of hidden) b.t = tx(b.t, false);
    return { e: { ...e, role: tx(e.role), org: tx(e.org), place: tx(e.place) }, shown, hidden, moved: ordered.some((x, k) => x.i !== k) };
  });
  const exp = group("exp"), acts = group("acts");
  const skills = (kw ? me.skills.slice().sort((a, b) => relScore(b, kw) - relScore(a, kw)) : me.skills.slice()).map(x => tx(x));
  const certs = (me.certs || []).map(x => tx(x));
  const edu = eduModel(me, lang);
  edu.inst = tx(edu.inst); edu.gpa = tx(edu.gpa); edu.course = tx(edu.course); edu.honors = tx(edu.honors);
  const student = me.edu.status === "student";
  const eduFirst = student || (me.edu.grad && me.edu.grad >= 2024) || !me.exp.length;
  const order = (eduFirst ? ["edu", "exp", "acts", "skills"] : ["exp", "edu", "acts", "skills"])
    .filter(s => (s === "exp" ? exp.length : s === "acts" ? acts.length : s === "skills" ? skills.length || me.langs.length : true));
  const contact = [me.gov === "abroad" ? placeOf(me)[lang] : tl(lang, "cvCity", { city: placeOf(me)[lang] || "" }), me.phone, me.email].filter(Boolean);
  // No name typed for this language: write it from the name as written. This happens on the device; names never go to Claude.
  const typed = lang === "ar" ? me.nameAr : me.nameEn, own = scriptOf(me.name);
  const auto = !typed && !!own && own !== lang ? translitName(me.name, lang) : "";
  const name = typed || auto || me.name, nsc = scriptOf(name);
  return { lang, job, kw, name, nameAuto: !!auto, nameMissing: !!nsc && nsc !== lang, contact, edu, exp, acts, skills,
           langs: me.langs.map(k => LANGS[k] ? LANGS[k][lang] : k), certs, order, eduFirst, trMissing: [...missing], trUsed: used };
}
function runChecks(me, R, job) {
  const basics = [], bullets = [];
  if (job) basics.push({ lv: "ok", key: "ckFocus", vars: { title: L(job.title) } });
  basics.push({ lv: "ok", key: R.eduFirst ? "ckEduFirst" : "ckExpFirst" });
  basics.push({ lv: "ok", key: "ckReverse" });
  basics.push(me.phone && me.email ? { lv: "ok", key: "ckContact" } : { lv: "todo", key: "ckContactMissing" });
  basics.push(CV.over ? { lv: "todo", key: "ckOnePage" } : { lv: "ok", key: "ckOnePageOk" });
  basics.push({ lv: "ok", key: "ckPrivate" });
  const hidden = [...R.exp, ...R.acts].reduce((n, r) => n + r.hidden.length, 0);
  if (hidden) basics.push({ lv: "info", key: "ckTrimmed", vars: { n: hidden } });
  const moved = job && [...R.exp, ...R.acts].some(r => r.moved);
  if (moved) basics.push({ lv: "ok", key: "ckReordered" });
  const need = (R.trMissing || []).length + (R.nameMissing ? 1 : 0);
  if (need) basics.push({ lv: "todo", key: "ckTrMissing", vars: { n: need, lang: trLang(R.lang) } });
  else if (R.trUsed) basics.push({ lv: "ok", key: "ckTrDone", vars: { lang: trLang(R.lang) } });
  for (const r of [...R.exp, ...R.acts]) for (const b of r.shown) {
    for (const is of lintBullet(b.orig, r.e.current)) bullets.push({ lv: "todo", key: is.key, text: b.orig, fix: is.fix, eid: r.e.id, kind: R.exp.includes(r) ? "exp" : "acts", i: b.i });
  }
  const groups = [];
  bullets.forEach((b, n) => {
    let g = groups.find(x => x.text === b.text && x.eid === b.eid);
    if (!g) groups.push(g = { text: b.text, eid: b.eid, kind: b.kind, keys: [], fix: null, fixN: -1 });
    g.keys.push(b.key);
    if (b.fix && g.fixN < 0) { g.fix = b.fix; g.fixN = n; }
  });
  const cov = job ? coverage(me, job) : null;
  const todo = basics.filter(x => x.lv === "todo").length + groups.length;
  return { basics, bullets, groups, cov, todo };
}
function aiPrompt(job, items) {
  return `You are a careful resume editor who follows US business-school resume practice as taught at the George Washington University School of Business: each bullet starts with a strong action verb; past tense for finished roles and present tense for current roles; no personal pronouns; under 25 words; the most job-relevant wording first.

The candidate's own words are the ONLY source of truth. Hard rules:
1. Never add a number, amount, percentage, date, name, place, tool, software, employer, title, certification, skill or result that is not already in that bullet.
2. Never raise the level of responsibility: "helped" must not become "led" or "managed".
3. You may reorder, tighten, and choose a more precise verb that means the same thing. Use the job's vocabulary only where the bullet already says the same thing in other words.
4. If a bullet would be stronger with a number the candidate did not give, keep it without one and put a short question for the candidate in "question".
5. Keep each bullet in its original language: Arabic stays Arabic, English stays English.

Target job: ${job.title.en} at ${job.co.en}
The job involves: ${job.duties.en.join("; ")}
It asks for: ${job.needs.en.join("; ")}

Bullets:
${JSON.stringify(items.map(x => ({ id: x.id, role: x.role, finished: !x.current, text: x.orig })))}

Reply with only a JSON array, one object per bullet, in the same order:
[{"id": "b1", "text": "the rewritten bullet", "question": ""}]`;
}
function plainResume(R) {
  const lg = R.lang, e = R.edu, out = [R.name, R.contact.join(" | "), ""];
  for (const key of R.order) {
    if (key === "edu") { out.push(tl(lg, "cvHEdu"), [e.inst, e.city].filter(Boolean).join(", "), [e.degree, e.date].filter(Boolean).join(", "));
      if (e.gpa) out.push(`${tl(lg, "cvGrade")}: ${e.gpa}`); if (e.course) out.push(`${tl(lg, "cvCoursesL")}: ${e.course}`); if (e.honors) out.push(`${tl(lg, "cvHonorsL")}: ${e.honors}`); }
    else if (key === "exp" || key === "acts") { out.push(tl(lg, key === "exp" ? "cvHExp" : "cvHActs"));
      for (const r of key === "exp" ? R.exp : R.acts) { out.push(`${r.e.role}, ${r.e.org}${r.e.place ? ", " + r.e.place : ""} (${fmtRange(r.e, lg)})`); for (const b of r.shown) out.push("- " + b.t); } }
    else { out.push(tl(lg, "cvHSkills"));
      if (R.skills.length) out.push(`${tl(lg, "cvSkillsL")}: ${R.skills.join(", ")}`); if (R.langs.length) out.push(`${tl(lg, "cvLangsL")}: ${R.langs.join(", ")}`); if (R.certs.length) out.push(`${tl(lg, "cvCertsL")}: ${R.certs.join(", ")}`); }
    out.push("");
  }
  return out.join("\n").trim();
}

/* ---------- names in the other script ----------
   A resume shows the name in the resume's language. When the person hasn't typed it in that language, it's
   written here from the name they did type. Common Syrian and Arab names get their usual spelling; anything
   else is spelled out letter by letter, and the editor asks the person to check it. This runs on the device:
   names are never sent to Claude. */
const NAME_LIST = ("محمد=Mohammad/Mohammed/Muhammad/Mohamad/Mohamed/Mhd;أحمد=Ahmad/Ahmed;محمود=Mahmoud/Mahmud;مصطفى=Mustafa/Moustafa/Mostafa;" +
  "عمر=Omar/Umar;علي=Ali;حسن=Hassan/Hasan;حسين=Hussein/Husain/Hussain/Hussien;خالد=Khaled/Khalid;يوسف=Yousef/Yusuf/Youssef/Yousif/Yosef;" +
  "إبراهيم=Ibrahim/Ebrahim;إسماعيل=Ismail/Ismael;عبد الله=Abdullah/Abdallah/Abdulla;عبد الرحمن=Abdulrahman/Abdelrahman/Abdul Rahman/Abdurrahman/Abdalrahman;" +
  "عبد الكريم=Abdulkarim/Abdelkarim/Abdul Karim;عبد العزيز=Abdulaziz/Abdelaziz/Abdul Aziz;عبد الرحيم=Abdulrahim/Abdelrahim;عبد القادر=Abdulqader/Abdelkader/Abdulkader/Abdul Qader;" +
  "عبد الحميد=Abdulhamid/Abdelhamid;عبد الغني=Abdulghani/Abdelghani;عبد اللطيف=Abdullatif/Abdellatif;عبد الناصر=Abdulnasser/Abdelnasser;عبد النور=Abdelnour/Abdulnour/Abdel Nour/Abdul Nour;" +
  "عبد المجيد=Abdulmajid/Abdelmajid;عبد السلام=Abdulsalam/Abdelsalam;عبد الهادي=Abdulhadi/Abdelhadi;عبد الوهاب=Abdulwahab/Abdelwahab;عبد الفتاح=Abdulfattah/Abdelfattah;" +
  "عبد الإله=Abdulilah/Abdelilah;عبد الباسط=Abdulbasit/Abdelbasset;عبد الحكيم=Abdulhakim/Abdelhakim;عبد الرزاق=Abdulrazzaq/Abdelrazzak;عبد المنعم=Abdulmonem/Abdelmonem;عبد الجبار=Abduljabbar;" +
  "أبو جراب=Abujrab/Abu Jrab/Abu Jarab;رامي=Rami;سامي=Sami;سامر=Samer;سمير=Samir;باسل=Bassel/Basel;بشار=Bashar;باسم=Basem/Bassem;نبيل=Nabil/Nabeel;نادر=Nader;فادي=Fadi;" +
  "فراس=Firas/Feras;غسان=Ghassan;هاني=Hani;هشام=Hisham/Hesham;عماد=Imad/Emad;جمال=Jamal;كريم=Karim/Kareem;كنان=Kinan/Kenan;ليث=Laith/Layth;مجد=Majd;ماهر=Maher;مروان=Marwan;" +
  "مازن=Mazen;مهند=Muhannad/Mohannad;نزار=Nizar;ربيع=Rabih/Rabie;رياض=Riad/Riyad;سعد=Saad;سليم=Salim/Saleem;طارق=Tarek/Tariq;وائل=Wael;وليد=Walid/Waleed;ياسر=Yasser/Yaser;" +
  "زيد=Zaid/Zeid;زياد=Ziad/Ziyad;أنس=Anas;أمجد=Amjad;عدنان=Adnan;أيمن=Ayman;أوس=Aws/Aous;بلال=Bilal;حمزة=Hamza/Hamzah;حازم=Hazem;هادي=Hadi;جاد=Jad;جواد=Jawad;كرم=Karam;" +
  "لؤي=Louay/Luay;مهدي=Mahdi/Mehdi;معاذ=Moaz/Muaz/Mouaz;نور=Nour/Noor;عبادة=Obada/Ubada;قصي=Qusai/Kusai;رائد=Raed;رامز=Ramez;راشد=Rashed/Rashid;صفوان=Safwan;شادي=Shadi;" +
  "تامر=Tamer;توفيق=Tawfiq/Tawfik;أسامة=Osama/Usama/Ousama;يامن=Yamen;زكريا=Zakaria/Zakariya;يحيى=Yahya;عيسى=Issa/Isa;إلياس=Elias/Ilyas;جورج=George/Georges;فؤاد=Fouad/Fuad;" +
  "فاروق=Farouk/Faruq;فيصل=Faisal/Faysal;حبيب=Habib;حكمت=Hikmat;جهاد=Jihad;كمال=Kamal;منصور=Mansour/Mansur;منير=Munir/Mounir;ناصر=Nasser/Naser;رفيق=Rafiq/Rafik;صبري=Sabri;" +
  "سهيل=Suhail/Souhail;طلال=Talal;وسام=Wissam/Wisam;يزن=Yazan;عمار=Ammar;غيث=Ghaith/Ghayth;حيدر=Haidar/Haider;همام=Humam;منذر=Munther/Monzer;نورس=Nawras;سعيد=Saeed/Said;" +
  "سلطان=Sultan;طه=Taha;تيسير=Tayseer/Taysir;أيهم=Ayham;بهاء=Bahaa/Baha;ضياء=Diaa/Dia;علاء=Alaa;عمرو=Amr;فارس=Fares/Faris;حسام=Hussam/Hosam;إياد=Iyad/Eyad;جعفر=Jaafar/Jafar;" +
  "مالك=Malek/Malik;معتز=Moutaz/Mutaz;مؤمن=Moamen/Mumin;مراد=Murad/Mourad;نضال=Nidal;قاسم=Qasem/Kassem;رضا=Rida/Reda;سليمان=Suleiman/Sulaiman/Soliman;صلاح=Salah;شريف=Sharif/Sherif;" +
  "ثائر=Thaer;وسيم=Wassim/Wasim;ياسين=Yassin/Yaseen;زاهر=Zaher;آدم=Adam;أمير=Amir/Ameer;أنور=Anwar;عادل=Adel/Adil;بسام=Bassam;إيهاب=Ihab/Ehab;جميل=Jamil/Jameel;خليل=Khalil/Khaleel;" +
  "مأمون=Mamoun/Mamun;نجيب=Najib/Najeeb;عبود=Abboud;هيثم=Haitham/Haytham;عصام=Issam/Essam;عمران=Imran/Omran;زهير=Zuhair/Zouhair;ماجد=Majed/Majid;أيوب=Ayoub/Ayyub;داود=Dawood/Daoud;" +
  "موسى=Mousa/Musa;يعقوب=Yacoub/Yaqub;سامح=Sameh;جلال=Jalal;ميشيل=Michel;حنا=Hanna;جوزيف=Joseph;أنطون=Antoun/Anton;نقولا=Nicolas/Nicola;" +
  "فاطمة=Fatima/Fatma/Fatimah;عائشة=Aisha/Aysha;مريم=Maryam/Mariam;زينب=Zainab/Zeinab;رنا=Rana;رشا=Rasha;ريم=Reem/Rim;ريما=Rima/Reema;رولا=Rola/Rula;ربى=Ruba/Roba;سلمى=Salma;" +
  "سارة=Sara/Sarah;سوسن=Sawsan;لينا=Lina/Leena;لمى=Lama;ليلى=Layla/Laila/Leila;ديما=Dima;دينا=Dina;ديانا=Diana;هالة=Hala;هبة=Hiba/Heba;هدى=Huda/Hoda;إيمان=Iman/Eman;جنى=Jana;" +
  "جود=Joud/Jude;لبنى=Lubna;مايا=Maya;ميس=Mais/Mays;ميرا=Mira;ندى=Nada;نادية=Nadia;نسرين=Nisreen/Nesrin;روان=Rawan;رزان=Razan;رقية=Ruqaya/Roukaya;سمر=Samar;سناء=Sanaa/Sana;" +
  "شهد=Shahd;سهى=Suha;تالا=Tala;يارا=Yara;ياسمين=Yasmin/Yasmine/Yasmeen;زينة=Zeina/Zaina;غادة=Ghada;حنان=Hanan;كندة=Kinda;لارا=Lara;لجين=Lujain/Loujain;مرح=Marah;علا=Ola/Ula;" +
  "رهف=Rahaf;رغد=Raghad;ريهام=Riham/Reham;آية=Aya/Ayah;أسماء=Asmaa/Asma;بتول=Batoul/Batool;بشرى=Bushra/Boushra;دعاء=Duaa/Doaa;فرح=Farah;غنى=Ghina/Ghena;هديل=Hadeel/Hadil;هند=Hind;" +
  "إيناس=Inas/Enas;منال=Manal;منى=Mona/Muna;ناهد=Nahed;نجوى=Najwa;رندة=Randa;رانيا=Rania/Ranya;صفاء=Safaa/Safa;سلام=Salam;سهام=Siham;وفاء=Wafaa/Wafa;يسرى=Yusra/Yousra;" +
  "زهراء=Zahraa/Zahra;أمل=Amal;أميرة=Amira/Ameera;أريج=Areej/Arij;بيان=Bayan;داليا=Dalia;مها=Maha;ملك=Malak;نوال=Nawal;رحمة=Rahma;سعاد=Souad/Suad;تمارا=Tamara;ريا=Rea/Raya/Ria/Riya;" +
  "ريتا=Rita;ماري=Marie/Mary;ماريا=Maria;" +
  "خطيب=Khatib;حداد=Haddad;خوري=Khoury/Khouri;صباغ=Sabbagh;دباغ=Dabbagh;نجار=Najjar;عطار=Attar;حلاق=Hallak/Hallaq;قصاب=Kassab/Qassab;طحان=Tahhan;سمان=Samman;حجار=Hajjar;" +
  "بيطار=Bitar/Baytar;شامي=Shami;حلبي=Halabi;حمصي=Homsi;حموي=Hamwi;مصري=Masri;كردي=Kurdi;جابري=Jabri;رفاعي=Rifai;أتاسي=Atassi/Atasi;قباني=Kabbani/Qabbani;أسعد=Asaad/Assad;" +
  "صالح=Saleh/Salih;عثمان=Othman/Uthman;عباس=Abbas;درويش=Darwish;حمدان=Hamdan;حمود=Hammoud;عيد=Eid;سويد=Sweid;زين=Zein/Zain;شيخ=Sheikh/Shaikh;نحاس=Nahhas;جندي=Jundi;ساعاتي=Saati;" +
  "مارديني=Mardini;إدلبي=Idlibi;بكري=Bakri;عمري=Omari;تميمي=Tamimi;ظاهر=Daher;عاصي=Assi;طويل=Tawil;قاضي=Kadi/Qadi;سيد=Sayed/Sayyid;حكيم=Hakim;جبر=Jabr;حبش=Habash;يونس=Younes/Yunus").split(";");
let NAME_MAPS = null;
const arKey = s => String(s || "").replace(/[\u064B-\u0652\u0670\u0640]/g, "").replace(/[أإآٱ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه").replace(/ؤ/g, "و").replace(/ئ/g, "ي").replace(/\s+/g, " ").trim();
const enKey = s => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z]/g, "");
function nameMaps() {
  if (NAME_MAPS) return NAME_MAPS;
  const ar = new Map(), en = new Map();
  for (const e of NAME_LIST) {
    const [a, list] = e.split("="), sp = list.split("/");
    if (!ar.has(arKey(a))) ar.set(arKey(a), sp[0]);
    for (const x of sp) { const k = enKey(x); if (k && !en.has(k)) en.set(k, a); }
  }
  return (NAME_MAPS = { ar, en });
}
const capWord = w => (w ? w.charAt(0).toUpperCase() + w.slice(1) : "");
const AR_EN = { "ب": "b", "ت": "t", "ث": "th", "ج": "j", "ح": "h", "خ": "kh", "د": "d", "ذ": "dh", "ر": "r", "ز": "z", "س": "s", "ش": "sh", "ص": "s", "ض": "d", "ط": "t",
  "ظ": "z", "غ": "gh", "ف": "f", "ق": "q", "ك": "k", "ل": "l", "م": "m", "ن": "n", "ه": "h" };
function arWordToEn(k) {   // k is already in arKey form; short vowels aren't written in Arabic, so "a" stands in for them
  const c = [...k]; let out = "";
  for (let i = 0; i < c.length; i++) {
    const ch = c[i], first = i === 0, last = i === c.length - 1, v = /[aeiou]$/.test(out);
    if (ch === "ا") { out += first || !v ? "a" : ""; continue; }
    if (ch === "و") { out += first || v ? "w" : "ou"; continue; }
    if (ch === "ي") { out += first || v ? "y" : "i"; continue; }
    if (ch === "ع") { out += first || !v ? "a" : ""; continue; }
    if (ch === "ء") continue;
    if (ch === "ه" && last && i > 0) { out += "a"; continue; }
    const m = AR_EN[ch]; if (!m) continue;
    if (out && !v) out += "a";
    out += m;
  }
  return out;
}
const EN_AR_DI = [["sh", "ش"], ["kh", "خ"], ["gh", "غ"], ["th", "ث"], ["dh", "ذ"], ["ch", "ش"], ["ph", "ف"], ["ou", "و"], ["oo", "و"], ["ee", "ي"], ["ai", "اي"], ["ay", "اي"], ["ei", "ي"], ["aa", "ا"]];
const EN_AR = { b: "ب", t: "ت", j: "ج", d: "د", r: "ر", z: "ز", s: "س", f: "ف", q: "ق", k: "ك", c: "ك", l: "ل", m: "م", n: "ن", w: "و", y: "ي", g: "ج", v: "ف", p: "ب", x: "كس" };
function enWordToAr(k) {
  let out = "";
  for (let i = 0; i < k.length;) {
    const two = k.slice(i, i + 2), d = EN_AR_DI.find(x => x[0] === two), first = i === 0;
    if (d) { out += first && /^[aeiou]/.test(two) ? "أ" + d[1].replace(/^ا/, "") : d[1]; i += 2; continue; }
    const ch = k[i], last = i === k.length - 1;
    if ("aeiou".includes(ch)) {
      if (first) out += ch === "i" || ch === "e" ? "إ" : "أ";
      else if (last) out += ch === "a" ? "ا" : ch === "o" || ch === "u" ? "و" : "ي";
      else if (ch === "i") out += "ي";
      else if (ch === "o" || ch === "u") out += "و";
    } else if (ch === "h") out += last ? "ه" : "ح";
    else out += EN_AR[ch] || "";
    i++;
  }
  return out.replace(/([^ا])\1+/g, "$1");
}
function arPartToEn(w) {
  const M = nameMaps().ar, k = arKey(w);
  if (M.has(k)) return M.get(k);
  if (k.length > 3 && k.startsWith("ال")) { const stem = k.slice(2); return "Al-" + (M.get(stem) || capWord(arWordToEn(stem))); }
  return capWord(arWordToEn(k));
}
function enPartToAr(w) {
  const M = nameMaps().en, k = enKey(w);
  if (!k) return "";
  if (M.has(k)) return M.get(k);
  if (/^(al|el)/.test(k) && k.length > 4 && M.has(k.slice(2))) return "ال" + M.get(k.slice(2));
  return enWordToAr(k);
}
function nameToEn(s) {
  const M = nameMaps().ar, w = s.split(" "), out = [];
  for (let i = 0; i < w.length; i++) {
    const k = arKey(w[i]), nx = w[i + 1];
    if (nx && ["عبد", "ابو", "ابن", "بن"].includes(k)) {
      const pair = M.get(arKey(w[i] + " " + nx));
      if (pair) out.push(pair);
      else if (k === "عبد") out.push("Abdul" + arPartToEn(arKey(nx).replace(/^ال/, "")).toLowerCase());
      else out.push((k === "ابو" ? "Abu " : k === "ابن" ? "Ibn " : "bin ") + arPartToEn(nx));
      i++; continue;
    }
    if (k.length > 4 && k.startsWith("عبد") && !M.has(k)) { out.push(M.get(arKey("عبد " + k.slice(3))) || "Abdul" + arPartToEn(k.slice(3).replace(/^ال/, "")).toLowerCase()); continue; }
    out.push(arPartToEn(w[i]));
  }
  return out.join(" ");
}
function nameToAr(s) {
  const M = nameMaps().en, w = s.replace(/[.'’`]/g, "").split(" "), out = [];
  const LEAD = ["abdul", "abdel", "abd", "abdal", "abu", "abou", "al", "el", "bin", "ibn"];
  for (let i = 0; i < w.length; i++) {
    const k = enKey(w[i]), nk = w[i + 1] ? enKey(w[i + 1]) : "";
    if (!k) continue;
    if (nk && LEAD.includes(k) && M.has(k + nk)) { out.push(M.get(k + nk)); i++; continue; }
    if (M.has(k)) { out.push(M.get(k)); continue; }
    if (nk && (k === "al" || k === "el")) { out.push("ال" + enPartToAr(nk)); i++; continue; }
    if (nk && ["abdul", "abdel", "abd", "abdal"].includes(k)) { out.push("عبد ال" + enPartToAr(nk.replace(/^(al|el)/, ""))); i++; continue; }
    if (nk && (k === "abu" || k === "abou")) { out.push("أبو " + enPartToAr(nk)); i++; continue; }
    if (k === "bin" || k === "ben") { out.push("بن"); continue; }
    if (k === "ibn") { out.push("ابن"); continue; }
    const parts = w[i].split("-").filter(Boolean);
    if (parts.length > 1 && /^(al|el)$/i.test(parts[0])) { out.push("ال" + enPartToAr(parts.slice(1).join(""))); continue; }
    const m = /^(abdul|abdel|abdal|abd)([a-z]{3,})$/.exec(k);
    if (m) { out.push("عبد ال" + enPartToAr(m[2].replace(/^(al|el|ul|ur|ar)(?=[a-z]{3})/, ""))); continue; }
    const m2 = /^(abu|abou)([a-z]{3,})$/.exec(k);
    if (m2) { out.push("أبو " + enPartToAr(m2[2])); continue; }
    out.push(parts.map(enPartToAr).join(" "));
  }
  return out.join(" ");
}
function translitName(name, to) {
  const s = String(name || "").replace(/\s+/g, " ").trim(), sc = scriptOf(s);
  if (!s || !sc || sc === to) return s;
  return to === "en" ? nameToEn(s) : nameToAr(s);
}

/* ---------- reading a resume someone already has ----------
   Turns the text of an uploaded resume into profile fields. It works on plain text, so it's the same for PDF,
   Word and text files, in Arabic or English. Anything it can't place is left out, nothing already in the
   profile is replaced, and the person checks the rest. */
const RS_HEAD = {
  summary: ["summary", "profile", "about me", "objective", "career objective", "professional summary", "personal statement", "نبذه", "نبذه عني", "نبذه شخصيه", "الملخص", "ملخص", "الهدف", "الهدف الوظيفي"],
  exp: ["experience", "work experience", "professional experience", "employment", "employment history", "work history", "internships", "internship", "career history",
        "الخبره", "الخبرات", "الخبره العمليه", "الخبرات العمليه", "الخبره المهنيه", "الخبرات المهنيه", "التدريب", "سجل العمل"],
  edu: ["education", "academic background", "qualifications", "academic qualifications", "education and training", "التعليم", "المؤهلات العلميه", "المؤهل العلمي", "التحصيل العلمي", "الدراسه", "المؤهلات"],
  skills: ["skills", "technical skills", "key skills", "core skills", "computer skills", "competencies", "tools", "المهارات", "مهارات", "المهارات التقنيه", "مهارات الحاسوب", "المهارات الشخصيه"],
  langs: ["languages", "language skills", "اللغات", "اللغه"],
  certs: ["certifications", "certificates", "courses", "training", "licenses", "certifications and courses", "courses and certificates", "الشهادات", "الدورات", "الدورات التدريبيه", "الشهادات والدورات", "دورات"],
  acts: ["activities", "volunteering", "volunteer experience", "volunteer work", "projects", "leadership", "extracurricular activities", "extracurricular", "clubs",
         "الانشطه", "النشاطات", "التطوع", "العمل التطوعي", "المشاريع", "الانشطه اللامنهجيه"],
  honors: ["honors", "awards", "achievements", "honors and awards", "الجوائز", "الانجازات"],
  skip: ["references", "interests", "hobbies", "personal information", "personal details", "contact", "contact information", "المعارف", "المراجع", "الهوايات", "الاهتمامات", "المعلومات الشخصيه", "معلومات التواصل", "معلومات الاتصال"]
};
const rsKey = s => arKey(String(s || "").toLowerCase()).replace(/[&،,/+]/g, " ").replace(/\band\b/g, "and").replace(/\s+/g, " ").trim();
let RS_PHRASES = null, RS_VOCAB = null;
function rsHeading(text) {
  if (!RS_PHRASES) {
    RS_PHRASES = Object.entries(RS_HEAD).flatMap(([sec, list]) => list.map(p => [rsKey(p), sec])).sort((a, b) => b[0].length - a[0].length);
    RS_VOCAB = new Set(RS_PHRASES.flatMap(([p]) => p.split(" ")).concat(["and", "of", "other", "additional", "my", "و", "اخرى", "اضافيه"]));
  }
  const h = text.replace(/^[#*•\s]+/, "").replace(/[\s:：\-–—_*|•]+$/, "").trim();
  if (!h || h.length > 48 || /\d|@/.test(h)) return null;
  const k = rsKey(h), words = k.split(" ");
  if (words.length > 5 || !words.every(w => RS_VOCAB.has(w) || RS_VOCAB.has(w.replace(/^و/, "")))) return null;
  for (const [p, sec] of RS_PHRASES) if (k === p || (" " + k + " ").includes(" " + p + " ")) return sec;
  return null;
}
const RS_MON = [["january", 1], ["february", 2], ["march", 3], ["april", 4], ["may", 5], ["june", 6], ["july", 7], ["august", 8], ["september", 9], ["october", 10], ["november", 11], ["december", 12],
  ["sept", 9], ["jan", 1], ["feb", 2], ["mar", 3], ["apr", 4], ["jun", 6], ["jul", 7], ["aug", 8], ["sep", 9], ["oct", 10], ["nov", 11], ["dec", 12],
  ["كانون الثاني", 1], ["شباط", 2], ["آذار", 3], ["اذار", 3], ["نيسان", 4], ["أيار", 5], ["ايار", 5], ["حزيران", 6], ["تموز", 7], ["آب", 8], ["اب", 8], ["أيلول", 9], ["ايلول", 9],
  ["تشرين الأول", 10], ["تشرين الاول", 10], ["تشرين الثاني", 11], ["كانون الأول", 12], ["كانون الاول", 12], ["يناير", 1], ["فبراير", 2], ["مارس", 3], ["أبريل", 4], ["ابريل", 4],
  ["مايو", 5], ["يونيو", 6], ["يوليو", 7], ["أغسطس", 8], ["اغسطس", 8], ["سبتمبر", 9], ["أكتوبر", 10], ["اكتوبر", 10], ["نوفمبر", 11], ["ديسمبر", 12]].sort((a, b) => b[0].length - a[0].length);
const reEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const RS_DATE = `(?:(?<!\\p{L})(?:${RS_MON.map(m => reEsc(m[0])).join("|")})\\.?,?\\s*(?:19|20)\\d{2}|(?<!\\d)\\d{1,2}\\s*[/.]\\s*(?:19|20)\\d{2}|(?:19|20)\\d{2}\\s*[/.-]\\s*(?:0?[1-9]|1[0-2])(?![\\d])|(?<!\\d)(?:19|20)\\d{2}(?!\\d))`;
const RS_NOW = "present|current(?:ly)?|now|ongoing|today|to date|till now|حالياً|حاليا|الآن|الان|حتى الآن|حتى الان|لغاية الآن|مستمر";
const RS_RANGE = new RegExp(`(${RS_DATE})\\s*(?:-|–|—|−|~|to|until|till|through|إلى|الى|حتى|لغاية)\\s*(${RS_DATE}|${RS_NOW})`, "iu");
const RS_ONE = new RegExp(RS_DATE, "iu");
function rsYM(tok, end) {
  const t = String(tok).toLowerCase(), y = (/(?:19|20)\d{2}/.exec(t) || [])[0];
  if (!y) return { ym: "", approx: false };
  let m = 0;
  for (const [name, n] of RS_MON) if (t.includes(name)) { m = n; break; }
  if (!m) { const a = /(\d{1,2})\s*[/.]\s*(?:19|20)\d{2}/.exec(t) || /(?:19|20)\d{2}\s*[/.-]\s*(\d{1,2})/.exec(t); if (a) m = Number(a[1]); }
  const approx = !(m >= 1 && m <= 12);
  return { ym: `${y}-${String(approx ? (end ? 12 : 1) : m).padStart(2, "0")}`, approx };
}
function rsRange(text) {
  const r = RS_RANGE.exec(text);
  if (r) {
    const a = rsYM(r[1], false), current = new RegExp(`^(?:${RS_NOW})$`, "iu").test(r[2].trim()), b = current ? { ym: "", approx: false } : rsYM(r[2], true);
    return { index: r.index, length: r[0].length, start: a.ym, end: b.ym, current, approx: a.approx || b.approx };
  }
  const o = RS_ONE.exec(text);
  if (o && text.split(/\s+/).length <= 8) { const a = rsYM(o[0], false), b = rsYM(o[0], true); return { index: o.index, length: o[0].length, start: a.ym, end: b.ym, current: false, approx: a.approx }; }
  return null;
}
const RS_ORG = /\b(company|co\.|ltd|llc|inc|group|bank|university|institute|school|ngo|organi[sz]ation|association|foundation|ministry|center|centre|agency|hospital|clinic|studio|labs?|factory|corp(?:oration)?|holding|trading|consulting|advisory|energy|telecom|logistics|crescent|unicef|undp|unhcr|wfp)\b|شركة|مؤسسة|منظمة|بنك|مصرف|جامعة|معهد|مدرسة|وزارة|مركز|جمعية|مشفى|مستشفى|الهلال|مجموعة|مكتب/i;
const RS_ROLE = /\b(intern(?:ship)?|engineer|manager|assistant|developer|accountant|officer|specialist|coordinator|analyst|teacher|tutor|volunteer|trainee|designer|consultant|representative|technician|supervisor|lead|head|director|associate|clerk|cashier|agent|translator|interpreter|researcher|nurse|pharmacist|member|president|founder|co-founder|organizer)\b|متدرب|متدربة|مهندس|مهندسة|مدير|مديرة|مساعد|مساعدة|محاسب|محاسبة|مطور|منسق|منسقة|مشرف|معلم|معلمة|مدرس|مدرسة لغة|متطوع|متطوعة|مصمم|مستشار|مندوب|فني|باحث|مترجم|ممرض|صيدلاني|عضو|رئيس|مؤسس/i;
function rsGovOf(s) {
  const k = rsKey(s);
  for (const [g, v] of Object.entries(GOV)) if (g !== "remote" && (rsKey(v.en) === k || rsKey(v.ar) === k)) return g;
  return /^(syria|سوريا|سورية)$/.test(k) ? "sy" : "";
}
function rsSplitHead(text) {
  let t = text.replace(/\s*\|\s*/g, " | ").replace(/\s+/g, " ").trim().replace(/^[|,،\-–—\s]+|[|,،\-–—\s]+$/g, "");
  let parts;
  const at = /^(.+?)\s+(?:at|@|with|في|لدى)\s+(.+)$/i.exec(t);
  if (at && !RS_ORG.test(at[1])) parts = [at[1], at[2]];
  else parts = t.split(/\s+[|—–·•]\s+|\s+-\s+/).map(x => x.trim()).filter(Boolean);
  if (parts.length === 1) parts = t.split(/\s*[,،]\s*/).filter(Boolean);
  let place = "";
  const tail = parts.length > 1 ? parts[parts.length - 1].split(/\s*[,،]\s*/) : [];
  if (tail.length > 1 && rsGovOf(tail[tail.length - 1])) { place = tail.pop(); parts[parts.length - 1] = tail.join(", "); }
  else if (parts.length > 2 && rsGovOf(parts[parts.length - 1])) place = parts.pop();
  let [role = "", ...rest] = parts, org = rest.join(", ");
  if (org && ((RS_ORG.test(role) && !RS_ORG.test(org)) || (!RS_ROLE.test(role) && RS_ROLE.test(org)))) [role, org] = [org, role];
  return { role: role.slice(0, 120), org: org.slice(0, 120), place: place.slice(0, 80) };
}
function rsEntries(lines, notes) {
  const out = []; let cur = null, pending = [];
  const rid = () => Math.random().toString(36).slice(2, 10);
  const start = (head, dr) => {
    const s = rsSplitHead(head.join(" | "));
    if (dr && dr.approx) notes.approx = true;
    cur = { id: rid(), role: s.role, org: s.org, place: s.place, start: dr ? dr.start : "", end: dr ? dr.end : "", current: !!(dr && dr.current), bullets: [] };
  };
  const flush = () => { if (cur) out.push(cur); cur = null; };
  for (const ln of lines) {
    const words = ln.text.split(/\s+/).length;
    if (ln.bullet) { if (!cur) { start(pending, null); pending = []; } cur.bullets.push(ln.text.slice(0, 300)); continue; }
    const dr = words <= 14 ? rsRange(ln.text) : null;
    if (dr) {
      const rest = (ln.text.slice(0, dr.index) + " " + ln.text.slice(dr.index + dr.length)).replace(/[()[\]]/g, " ").replace(/^[\s|,،\-–—:]+|[\s|,،\-–—:]+$/g, "").trim();
      if (cur && !cur.start && !cur.bullets.length && !rest && !pending.length) { cur.start = dr.start; cur.end = dr.end; cur.current = dr.current; if (dr.approx) notes.approx = true; continue; }
      flush(); start(rest ? [...pending, rest] : pending, dr); pending = [];
      continue;
    }
    if (cur && words >= 7) { cur.bullets.push(ln.text.slice(0, 300)); continue; }
    if (cur && !cur.bullets.length && (!cur.role || !cur.org)) {
      const s = rsSplitHead(ln.text);
      if (!cur.role) { cur.role = s.role; if (!cur.org) cur.org = s.org; } else cur.org = s.org ? s.role + ", " + s.org : s.role;
      if (s.place && !cur.place) cur.place = s.place;
      continue;
    }
    if (cur) flush();
    pending.push(ln.text); if (pending.length > 2) pending.shift();
  }
  flush();
  const ok = out.filter(e => e.role && e.org);
  notes.skipped += out.length - ok.length;
  return ok.slice(0, 20);
}
const UNI_ALIAS = { damascus: ["University of Damascus"], aleppo: ["Aleppo University"], homs: ["Al-Baath University", "Al Baath University", "Albaath University", "Baath University", "University of Homs", "جامعة البعث"],
  latakia: ["Tishreen University", "جامعة تشرين", "University of Latakia"], furat: ["Euphrates University", "Al Furat University", "Alfurat University"], hama: ["University of Hama"],
  hiast: ["Higher Institute for Applied Sciences and Technology"], hiba: ["Higher Institute of Business Administration", "المعهد العالي لإدارة الأعمال"], svu: ["SVU", "Syrian Virtual University", "الجامعة الافتراضية"], aleppoti: [] };
const FAC_ALIAS = { informatics: ["Computer Science", "Computer Engineering", "Software Engineering", "Information Technology", "Informatics", "هندسة المعلوماتية", "هندسة الحاسوب", "هندسة الحواسيب", "علوم الحاسوب", "المعلوماتية", "تقانة المعلومات"],
  telecom: ["Communications Engineering", "Communication Engineering", "Telecommunication", "هندسة الاتصالات", "الاتصالات"], electrical: ["Electronics", "Electrical and Electronic", "Power Engineering", "الهندسة الكهربائية", "هندسة الإلكترونيات"],
  mechanical: ["Mechatronics", "الهندسة الميكانيكية", "هندسة الميكاترونيكس"], civil: ["الهندسة المدنية"], petroleum: ["Petroleum", "هندسة البترول", "الهندسة النفطية", "هندسة النفط"], chemical: ["الهندسة الكيميائية"],
  business: ["Business", "Management", "MBA", "Marketing", "إدارة الأعمال"], economics: ["Accounting", "Finance", "Banking", "Economy", "الاقتصاد", "المحاسبة", "العلوم المالية والمصرفية"],
  arts: ["English Literature", "Arabic Literature", "French Literature", "Translation", "Literature", "Humanities", "الآداب", "الأدب الإنكليزي", "الأدب الإنجليزي", "اللغة الإنكليزية", "الترجمة"],
  media: ["Journalism", "Mass Communication", "Media Studies", "الإعلام", "الصحافة"], nursing: ["التمريض"], pharmacy: ["الصيدلة"], publichealth: ["الصحة العامة"], geology: ["الجيولوجيا"],
  chemistry: ["الكيمياء"], biology: ["علم الأحياء", "الأحياء"], marine: ["علوم البحار"], industrial: ["الهندسة الصناعية"], environmental: ["الهندسة البيئية"] };
const LANG_ALIAS = { ar: ["Arabic", "العربية", "عربي", "العربي"], en: ["English", "الإنكليزية", "الإنجليزية", "الانكليزية", "الانجليزية", "إنكليزي", "انكليزي", "انجليزي", "IELTS", "TOEFL"],
  fr: ["French", "الفرنسية", "فرنسي"], tr: ["Turkish", "التركية", "تركي"], ku: ["Kurdish", "الكردية", "كردي"], de: ["German", "الألمانية", "ألماني"], ru: ["Russian", "الروسية", "روسي"] };
const rsHas = (text, name) => { const a = " " + rsKey(text) + " ", b = rsKey(name); return !!b && (a.includes(" " + b + " ") || a.includes(" " + b + ".") || a.includes(" " + b + ")") || a.includes("(" + b + " ") || a.includes(" ال" + b + " ") || (b.length > 5 && a.includes(b))); };
function rsEdu(lines, text) {
  const e = { status: "", uni: "", uniName: "", fac: "", year: 0, grad: 0, gpa: "" }, all = lines.map(l => l.text).join("\n");
  for (const [k, u] of Object.entries(UNI)) if (rsHas(all, u.en) || rsHas(all, u.ar) || (UNI_ALIAS[k] || []).some(a => rsHas(all, a))) { e.uni = k; break; }
  if (!e.uni) { const l = lines.find(x => /university|college|institute|academy|جامعة|كلية|معهد|أكاديمية/i.test(x.text)); if (l) { e.uni = "other"; e.uniName = rsSplitHead(l.text.replace(RS_RANGE, "")).role.slice(0, 120); } }
  const facs = [...Object.entries(FAC).flatMap(([k, f]) => [[f.en, k], [f.ar, k]]), ...Object.entries(FAC_ALIAS).flatMap(([k, list]) => list.map(a => [a, k]))].sort((a, b) => b[0].length - a[0].length);
  for (const [name, k] of facs) if (rsHas(all, name)) { e.fac = k; break; }
  const ords = { first: 1, "1st": 1, second: 2, "2nd": 2, third: 3, "3rd": 3, fourth: 4, "4th": 4, fifth: 5, "5th": 5, sixth: 6, "6th": 6, "الأولى": 1, "الاولى": 1, "الثانية": 2, "الثالثة": 3, "الرابعة": 4, "الخامسة": 5, "السادسة": 6 };
  const yr = /(first|second|third|fourth|fifth|sixth|1st|2nd|3rd|4th|5th|6th)[- ]year|year\s*([1-6])\b|السنة\s+(الأولى|الاولى|الثانية|الثالثة|الرابعة|الخامسة|السادسة)/i.exec(all);
  if (yr) e.year = yr[2] ? Number(yr[2]) : ords[(yr[1] || yr[3]).toLowerCase()] || 0;
  const g = /(expected|anticipated|class of|graduat\w*|التخرج المتوقع|تخرج متوقع|التخرج|دفعة|خريج)\D{0,20}((?:19|20)\d{2})/i.exec(all);
  const r = rsRange(all);
  const now = new Date().getFullYear();
  if (g) e.grad = Number(g[2]); else if (r && r.end) e.grad = Number(r.end.slice(0, 4)); else { const ys = (all.match(/(?<!\d)(?:19|20)\d{2}(?!\d)/g) || []).map(Number).filter(y => y <= 2035); if (ys.length) e.grad = Math.max(...ys); }
  if (e.grad && (e.grad < 1990 || e.grad > 2035)) e.grad = 0;
  const lo = all.toLowerCase();
  if (/student|طالب|طالبة|expected|anticipated|التخرج المتوقع|تخرج متوقع/.test(lo) || (r && r.current) || (e.grad && e.grad > now) || e.year) e.status = "student";
  else if (/master|m\.?sc|mba|\bm\.?a\b|ماجستير/.test(lo)) e.status = "master";
  else if (/bachelor|b\.?sc|\bb\.?a\b|b\.?eng|degree|licen[cs]e|إجازة|بكالوريوس/.test(lo)) e.status = "bachelor";
  else if (/diploma|دبلوم|معهد/.test(lo)) e.status = "diploma";
  else if (/high school|secondary|baccalaureate|الثانوية|بكالوريا/.test(lo)) e.status = "secondary";
  const gpa = /(?:c?gpa|grade|average|المعدل|معدل)\s*[:：]?\s*([0-9]+(?:[.,][0-9]+)?\s*(?:\/\s*[0-9]+(?:[.,][0-9]+)?|%)?)/i.exec(all);
  if (gpa) e.gpa = gpa[1].replace(/\s+/g, "").slice(0, 20);
  return e;
}
function rsList(lines) {
  const out = [];
  for (const ln of lines) {
    const body = ln.text.replace(/^[^:：]{1,24}[:：]\s*/, m => (m.split(/\s+/).length <= 4 ? "" : m));
    for (let s of body.split(/\s*(?:[,،;|•·]|\s\/\s)\s*/)) {
      s = s.replace(/^[\s\-–—*]+|[\s.]+$/g, "").trim();
      if (s && s.length <= 60 && s.split(/\s+/).length <= 6 && !out.some(x => x.toLowerCase() === s.toLowerCase())) out.push(s);
    }
  }
  return out;
}
function rsLangs(text) { return Object.keys(LANGS).filter(k => [LANGS[k].en, LANGS[k].ar, ...(LANG_ALIAS[k] || [])].some(n => rsHas(text, n))); }
function parseResumeText(input) {
  const raw = String(input || "").normalize("NFKC").replace(/[\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff\u00ad\u061c]/g, "")
    .replace(/[\u0660-\u0669]/g, d => String(d.charCodeAt(0) - 0x660)).replace(/[\u06f0-\u06f9]/g, d => String(d.charCodeAt(0) - 0x6f0))
    .replace(/\r\n?/g, "\n").replace(/\t+/g, " | ").replace(/[ \u00a0]+/g, " ");
  const BUL = /^\s*(?:[•●▪◦·‣∙○■□◆◇➢➤►▸✓✔\-–—*\u2043\u2219\u25aa\u25cf\u25e6\uf0a7\uf0b7\uf076\uf0d8\uf0fc\uf0a8]|\(?\d{1,2}[.)])\s*/;
  const BUL_END = /\s+[•●▪◦‣∙○■□◆◇➢➤►▸✓✔\u2043\u2219\u25aa\u25cf\u25e6\uf0a7\uf0b7\uf076\uf0d8\uf0fc\uf0a8]$/;   // a right-to-left page can leave the bullet at the end
  const lines = raw.split("\n").map(s => s.trim()).filter(Boolean).map(s => (BUL_END.test(s) ? "• " + s.replace(BUL_END, "") : s)).map(s => { const b = BUL.exec(s); return { text: b ? s.slice(b[0].length).trim() : s, bullet: !!b && !/^\d{4}/.test(s) }; }).filter(l => l.text);
  const out = { name: "", email: "", langs: [], skills: [], certs: [], exp: [], acts: [], edu: null, honors: "", found: 0, notes: { approx: false, skipped: 0 } };
  const email = /[^\s@<>()"',;:]+@[^\s@<>()"',;:]+\.[a-z]{2,}/i.exec(raw);
  if (email) out.email = email[0].slice(0, 160);
  const sec = { top: [] }; let cur = "top", any = false;
  for (const l of lines) {
    const h = l.bullet ? null : rsHeading(l.text);
    if (h) { cur = h; any = true; sec[h] = sec[h] || []; continue; }
    const tx = l.text.replace(/[^\s@<>()"',;:]+@[^\s@<>()"',;:]+\.[a-z]{2,}/gi, "").replace(/(?:https?:\/\/|www\.)\S+|linkedin\.com\S*/gi, "").replace(/(?:\+|00)?963[\s-]?9\d{2}[\s-]?\d{3}[\s-]?\d{3}|(?<!\d)09\d{2}[\s-]?\d{3}[\s-]?\d{3}(?!\d)/g, "").replace(/[\s|·•,،\-–—]+$/g, "").replace(/^[\s|·•,،\-–—]+/g, "").trim();
    if (tx) sec[cur].push({ ...l, text: tx });
  }
  const NAME_OK = /^[\p{L}][\p{L}\p{M}'’.\-]*(?:\s+[\p{L}\p{M}'’.\-]+){1,4}$/u, NOT_NAME = /curriculum|vitae|resume|résumé|\bcv\b|السيرة|الذاتية|engineer|student|developer|manager|طالب|مهندس/i;
  for (const l of (sec.top.length ? sec.top : lines).slice(0, 8)) {
    const s = l.text.replace(/^(?:full name|name|الاسم الكامل|الاسم)\s*[:：]\s*/i, "").trim();
    if (!l.bullet && s.length <= 60 && NAME_OK.test(s) && !NOT_NAME.test(s) && !rsHeading(s)) { out.name = s; break; }
  }
  const notes = out.notes;
  if (sec.exp) out.exp = rsEntries(sec.exp, notes);
  if (sec.acts) out.acts = rsEntries(sec.acts, notes);
  if (!any) out.exp = rsEntries(lines.filter(l => l.text !== out.name && !/@/.test(l.text)), notes).filter(e => e.start);
  if (sec.edu) out.edu = rsEdu(sec.edu);
  if (sec.skills) {
    const langLines = sec.skills.filter(l => /^(languages?|اللغات|اللغة)\s*[:：]/i.test(l.text));
    out.skills = rsList(sec.skills.filter(l => !langLines.includes(l)));
    if (langLines.length) out.langs = rsLangs(langLines.map(l => l.text).join(" "));
  }
  const langText = [...(sec.langs || []).map(l => l.text), ...lines.filter(l => /^(languages?|اللغات)\s*[:：]/i.test(l.text)).map(l => l.text)].join(" \n ");
  out.langs = [...new Set([...out.langs, ...rsLangs(langText)])];
  out.skills = out.skills.filter(s => !rsLangs(s).length || s.split(/\s+/).length > 3).slice(0, 30);
  if (sec.certs) out.certs = sec.certs.map(l => l.text.trim().slice(0, 120)).filter(Boolean).slice(0, 20);
  if (sec.honors) out.honors = sec.honors.map(l => l.text).join("; ").slice(0, 200);
  out.found = (out.name ? 1 : 0) + (out.email ? 1 : 0) + out.exp.length + out.acts.length + out.skills.length + out.langs.length + out.certs.length + (out.edu && (out.edu.uni || out.edu.fac) ? 1 : 0);
  return out;
}
/* Adds what the file had and the profile lacks. Nothing already in the profile is replaced. */
function mergeImported(me0, imp) {
  const me = JSON.parse(JSON.stringify(me0)), added = { name: "", email: false, edu: false, eduFields: [], exp: 0, acts: 0, skills: 0, langs: 0, certs: 0 };
  if (imp.name) {
    const sc = scriptOf(imp.name), own = scriptOf(me.name);
    if (!me.name) { me.name = imp.name; added.name = imp.name; }
    else if (sc && own && sc !== own) { const k = sc === "ar" ? "nameAr" : "nameEn"; if (!me[k]) { me[k] = imp.name; added.name = imp.name; } }
  }
  if (imp.email && !me.email) { me.email = imp.email; added.email = true; }
  if (imp.edu) {
    const e = me.edu || (me.edu = {}), i = imp.edu;
    for (const k of ["uni", "fac", "grad", "year", "gpa"]) if (i[k] && !e[k]) { e[k] = i[k]; added.edu = true; added.eduFields.push(k); if (k === "uni" && i.uni === "other") e.uniName = i.uniName; }
    if (i.status && !e.status) { e.status = i.status; added.edu = true; }
    if (imp.honors && !e.honors) { e.honors = imp.honors; added.edu = true; }
  }
  const same = (a, b) => rsKey(a.role) === rsKey(b.role) && rsKey(a.org) === rsKey(b.org);
  for (const k of ["exp", "acts"]) {
    me[k] = me[k] || [];
    for (const x of imp[k] || []) if (me[k].length < 20 && !me[k].some(y => same(x, y))) { me[k].push(x); added[k]++; }
  }
  for (const k of ["skills", "certs"]) {
    me[k] = me[k] || [];
    for (const x of imp[k] || []) if (!me[k].some(y => y.toLowerCase() === x.toLowerCase())) { me[k].push(x); added[k]++; }
  }
  me.langs = me.langs || [];
  for (const l of imp.langs || []) if (!me.langs.includes(l)) { me.langs.push(l); added.langs++; }
  added.any = !!(added.name || added.email || added.edu || added.exp || added.acts || added.skills || added.langs || added.certs);
  return { me, added };
}

/* Where someone lives, as a name: a governorate, or their country if they live outside Syria. */
function placeOf(p) {
  if (p && p.gov === "abroad") return COUNTRY[p.country] && p.country !== "other" ? COUNTRY[p.country] : { en: "Outside Syria", ar: "خارج سوريا" };
  return (p && GOV[p.gov]) || { en: "", ar: "" };
}
/* Job alerts: does a saved search match a job? Shared by the server (to send alerts) and the app (to count new ones). */
function alertMatches(a, j) {
  if (!a || !j) return false;
  if (a.gov && j.gov !== a.gov && j.gov !== "remote") return false;   // a remote job shows under every governorate on the board, so it matches a governorate alert too (D-26)
  if (a.type && j.type !== a.type) return false;
  if (a.tab && a.tab !== "all" && !inTab(j, a.tab)) return false;
  if (a.q) { const hay = norm([j.title && j.title.en, j.title && j.title.ar, j.co && j.co.en, j.co && j.co.ar].filter(Boolean).join(" ")); if (!norm(a.q).split(" ").filter(Boolean).every(w => hay.includes(w))) return false; }
  return true;
}
function alertLabel(a, lang) {
  const parts = [];
  if (a.tab && a.tab !== "all") parts.push(tl(lang, { intern: "tabIntern", domestic: "tabDomestic", multinational: "tabMulti", entry: "tabEntry", returnees: "tabReturnees" }[a.tab] || "filterAll"));
  if (a.type && TYPE[a.type]) parts.push(TYPE[a.type][lang]);
  if (a.gov && GOV[a.gov]) parts.push(GOV[a.gov][lang]);
  if (a.q) parts.push("“" + a.q + "”");
  return parts.length ? parts.join(" · ") : tl(lang, "alAll");
}
