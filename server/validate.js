/* Input sanitising: every field typed, length-capped and checked against the lookup tables. */
import { fail } from "./http.js";

const clean = (v, max) => String(v ?? "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim().slice(0, max);
const bool = v => v === true;
const intIn = (v, lo, hi) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : lo; };
const bi = (o, max) => ({ en: clean(o && o.en, max), ar: clean(o && o.ar, max) });
const biList = (o, items, max) => ({
  en: (Array.isArray(o && o.en) ? o.en : []).map(x => clean(x, max)).filter(Boolean).slice(0, items),
  ar: (Array.isArray(o && o.ar) ? o.ar : []).map(x => clean(x, max)).filter(Boolean).slice(0, items)
});
export const keyOf = (table, v) => (typeof v === "string" && Object.prototype.hasOwnProperty.call(table, v) ? v : "");   // a string and the table's own key: never a list (["damascus"] is coerced to a key) or a prototype name (U-038)
// The no-fees rule (R7, A-51): a demand whose payer is the candidate (a candidate, trainee, intern or student paying with a modal or a sum, "you" paying a sum or a fee, «على المتقدمين دفع», «يجب تسديد مبلغ»), not negated in its own clause, is refused in every box;
// other payment wording, in any box, is a flag for the reviewer, who reads every listing before it goes live: a fee or payment word, «دفع», «تسديد», «رسوم», «قسط», «تكلفة», and any sum of money with its currency or in thousands. Refusal is built for precision, the flag for recall; the cases are pinned by test/fee-corpus.test.js (fix reviews 1 to 7).
const WHO_SG = String.raw`(?:candidate|applicant|trainee|intern|student|participant)`, WHO = String.raw`${WHO_SG}s?`, MODAL = String.raw`(?:must|should|will|shall|(?:has|have|needs?)\s+to|(?:is|are)\s+(?:required|expected)\s+to)`, NUM = String.raw`[\d٠-٩][\d٠-٩,.]{0,20}`;   // a bounded run: no quadratic scan of "1,1,1,…"
const CUR = String.raw`(?:syp\b|s\.?\s?p\b|usd\b|eur\b|\$|€|dollars?\b|euros?\b|pounds?\b|ل\.?\s?س|ليرة|ليره|ليرات|دولار|يورو)`;
const SUM_EN = String.raw`(?:[\$€]\s?(?!0\b)[\d٠-٩]|${NUM}\s*(?:thousand\s+|million\s+)?${CUR}|(?:an?\s+|the\s+)?(?:fees?|deposit)\b|for\s+your\s+own\b)`;   // a sum, a fee or "for your own": "Intern pay: 400,000" and "10 daily visits" are none
const FEE_DEMAND = new RegExp(String.raw`\b(?:pay\s+to\s+apply|deposit\s+(?:is\s+)?required|required\s+deposit|paid\s+by\s+(?:the\s+)?${WHO}|${WHO}\s+${MODAL}\s+pay\b(?!\s+(?:\w+\s+)?(?:attention|heed|nothing|no|zero|visits?)\b)|(?:${WHO_SG}\s+pays|${WHO_SG}s\s+pay)\s+${SUM_EN}|you(?:['’]ll|\s+will|\s+must|\s+should)?(?:\s+(?:have|need)\s+to|\s+are\s+(?:required|expected)\s+to)?\s+pay\s+${SUM_EN}|(?<=^|[.,;!?]\s*)pay\s+(?:a|an)\s+(?:[\w,.]+\s+){0,2}?${NUM}\s+(?:[\w,.]+\s+){0,2}?(?:fee|deposit)\b)`, "gi");
const NEG_EN = /\b(?:no|not|never|don['’]t|doesn['’]t|without)\b/i, SEP = /[.,;:!?\n،؛؟]/, clauseOf = t => t.split(SEP).pop();   // "No fees or deposit required", "You don't have to pay to apply": negated in their own clause
const CAND_AR = "(?:ال)?(?:متقدم|متقدمين|متقدمون|متقدمه|متقدمات|مرشح|مرشحين|مرشحون|مرشحه|مرشحات|متدرب|متدربين|متدربون|متدربه|متدربات)", SUM_AR = "(?:(?:ال)?(?:رسم|رسوم|مبلغ|تامين|كفاله|تكاليف|ثمن|قسط)|\\d+)", SUM_AR_A = "(?:رسم|رسوم|مبلغ|تامين|كفاله|تكاليف|ثمن|قسط|\\d+)", PAY_AR = "(?:دفع|تسديد|سداد)";   // after norm (ة → ه, ى → ي); SUM_AR_A: an indefinite sum, so «يجب تسديد المبلغ المستحق للموردين» is a duty
const FEE_DEMAND_AR = new RegExp(` (?:[وف]?(?:(?:يدفع|تدفع|يدفعون|يدفعها|تدفعها|يسدد|تسدد) ${CAND_AR}|(?<! (?:مكافاه|مكافات|راتب|رواتب|اجر|اجور|اجره|بدل|منحه) )${CAND_AR} (?:يدفع|تدفع|يدفعون|يسدد|تسدد) ${SUM_AR}|(?:علي|من) ${CAND_AR} (?:(?!عدم )\\S+ )?${PAY_AR}|(?:يلتزم|تلتزم) ${CAND_AR} (?:بدفع|بتسديد|بسداد)|(?:يتحمل|تتحمل) (?:${CAND_AR}|انت|انتم) (?:${PAY_AR}|${SUM_AR}|نفقات)|علي (?:حساب|نفقه) ${CAND_AR})|(?:عليك|عليكم|يجب|يتوجب|يتعين|المطلوب|مطلوب|يشترط|تشترط|نشترط|يطلب|تطلب|نطلب)(?: (?!عدم )\\S+)? (?:دفع|بدفع|تسديد|بتسديد|سداد) ${SUM_AR_A}|(?:بعد|مقابل) (دفع (?:رسم|رسوم|مبلغ)))(?= )`, "g");   // و/ف may open a clause before a payer, not before an impersonal «يتعين تسديد مبلغ الضريبة» (a duty)   // «مكافأة المتدرب تُدفع شهرياً» has no sum and «مكافأة المتدرب تدفع ٤٠٠ ألف» is the trainee's pay; «عدم دفع» is an anti-scam notice
const NEG_AR = / [وف]?(?:لا|لن|لم|ليس|ليست|ليسا|ما|بدون|دون|غير)(?: \S+){0,3}$/;   // a negation before the demand in its clause («ولا يدفع المتدرب», «ليس مطلوباً من المتدرب دفع», «لا يطلب أبداً من …»); not «في حال عدم الالتزام». A negated demand is flagged, never dropped
const SOFT_AR = / (?:نحو|الي) /;   // «تدفع المتدربين نحو التطور»: the verb pushes; flagged, not refused
const feeDemand = (core, text) => {   // { fee } refuses; { soft } is a demand's shape that is negated or may not be one, and goes to the reviewer as a flag (fix review 7)
  let soft = null;
  for (const m of text.matchAll(FEE_DEMAND)) { if (!NEG_EN.test(clauseOf(text.slice(0, m.index)))) return { fee: m[0] }; soft = soft || m[0]; }
  for (const part of core.norm(text.replace(/[.,;!?\n،؛؟]+/g, " ǂ ")).split("ǂ")) {   // one norm pass; a demand may run across «:», not across a comma or a full stop, and so may its negation
    const n = ` ${part.trim()} `;
    for (const a of n.matchAll(FEE_DEMAND_AR)) { const w = (a[1] || a[0]).trim(); if (NEG_AR.test(n.slice(0, a.index)) || SOFT_AR.test(n.slice(a.index + a[0].length, a.index + a[0].length + 6))) soft = soft || w; else return { fee: w }; }
  }
  return { fee: null, soft }; };
const FEE_FLAG_EN = new RegExp(String.raw`\b(?:you|${WHO})\b[^.;!?\n]{0,30}?\bpay(?:s|ing|ment)?\b|\bpaid\s+by\b|\bcover\s+(?:the\s+)?costs?\s+of\b|\bat\s+(?:their|your|his|her)\s+own\s+(?:cost|expense)\b|\b(?:pay|pays|paying|paid|payment|payable|charged?|charges|costs?|price|fees?|deposit|transfer|send)\b[^.;!?\n]{0,25}?(?:[\d٠-٩]|\bsyp\b|\busd\b|[\$€]|ل\.?\s?س)|${NUM}\s*${CUR}[^.;!?\n]{0,25}?\b(?:pay|paid|payment|payable|fee|deposit|costs?|required)\b`, "i");
const FEE_FLAG_AR = / [وف]?(?:ال|بال|لل|ب|ل)?(?:دفع|يدفع|تدفع|بدفع|يدفعون|يدفعها|تدفعها|يدفعه|تدفعه|ادفع|ادفعوا|تسديد|بتسديد|سداد|يسدد|تسدد|يسدده|يسددها|رسوم|مبلغ|قسط|اقساط|تكلفه|كلفه|(?:تكاليف|مصاريف|نفقات)(?:ه|ها|هم)?|يتحملها|يتحمله|كفاله|تامين مالي|علي (?:حساب|نفقت)(?:ه|ها|هم|ك|كم))(?= )| (?:ال)?رسم(?: \S+){0,3} \d/;
const SUM_ANY = new RegExp(String.raw`[\$€]\s?[\d٠-٩]|${NUM}\s*(?:k\b\s*|thousand\s+|million\s+|ألف\s+|الف\s+|مليون\s+)?${CUR}|[\d٠-٩]{1,4}\s*(?:ألف|الف|آلاف|مليون)`, "i");   // any sum of money in the free text, with its currency or in thousands: pay is its own field, so a sum in the text is worth the reviewer's glance (fix reviews 6 and 7)
const feeFlag = (core, text) => { const m = text.match(FEE_FLAG_EN); if (m) return m[0].trim().slice(0, 40); const a = ` ${core.norm(text)} `.match(FEE_FLAG_AR); if (a) return a[0].trim(); const u = text.match(SUM_ANY); return u ? u[0].trim() : null; };
const ym = v => (/^\d{4}-(0[1-9]|1[0-2])$/.test(String(v || "")) ? String(v) : "");

export function e164(core, raw) {
  const sy = core.normPhone(raw || "");
  if (sy) return sy.replace(/\s/g, "");
  const d = core.latinDigits(raw || "").replace(/[^\d+]/g, "");   // Arabic-Indic and Persian digits count as digits abroad too (D-19)
  return /^\+[1-9]\d{7,14}$/.test(d) ? d : null;
}

/* Seeker profile (same shape the client engine uses). The phone always comes from the verified account. */
export function sanitizeProfile(core, input, phone) {
  const m = input && typeof input === "object" ? input : {};
  const role = m.role === "student" ? "student" : "seeker";
  const entry = x => ({
    id: clean(x && x.id, 20) || Math.random().toString(36).slice(2, 10),
    role: clean(x && x.role, 120), org: clean(x && x.org, 120), place: clean(x && x.place, 80),
    start: ym(x && x.start), end: x && x.current ? "" : ym(x && x.end), current: bool(x && x.current),
    bullets: (Array.isArray(x && x.bullets) ? x.bullets : []).map(b => clean(b, 300)).filter(Boolean).slice(0, 12)
  });
  const e = m.edu || {};
  const p = {
    v: 1, role,
    name: clean(m.name, 100), nameAr: clean(m.nameAr, 100), nameEn: clean(m.nameEn, 100), phone: core.normPhone(phone) || phone,
    email: clean(m.email, 160), gov: m.gov === "abroad" ? "abroad" : keyOf(core.GOV, m.gov), country: m.gov === "abroad" ? keyOf(core.COUNTRY, m.country) || "other" : "", relocate: bool(m.relocate),
    langs: [...new Set((Array.isArray(m.langs) ? m.langs : []).filter(l => keyOf(core.LANGS, l)))].slice(0, 7),
    edu: {
      status: ["student", "secondary", "diploma", "bachelor", "master"].includes(e.status) ? e.status : (role === "student" ? "student" : ""),
      uni: e.uni === "other" ? "other" : keyOf(core.UNI, e.uni), uniName: clean(e.uniName, 120), fac: keyOf(core.FAC, e.fac),
      year: intIn(e.year, 0, 7), grad: e.grad ? intIn(e.grad, 1990, 2035) : 0,
      gpa: clean(e.gpa, 20), course: clean(e.course, 300), honors: clean(e.honors, 200)
    },
    prefs: {
      types: [...new Set((Array.isArray(m.prefs && m.prefs.types) ? m.prefs.types : []).filter(k => keyOf(core.TYPE, k)))],
      fields: [...new Set((Array.isArray(m.prefs && m.prefs.fields) ? m.prefs.fields : []).filter(k => keyOf(core.INTERESTS, k)))],
      level: ["none", "lt1", "y1to3", "y4plus"].includes(m.prefs && m.prefs.level) ? m.prefs.level : ""
    },
    exp: (Array.isArray(m.exp) ? m.exp : []).slice(0, 20).map(entry).filter(x => x.role && x.org),
    acts: (Array.isArray(m.acts) ? m.acts : []).slice(0, 20).map(entry).filter(x => x.role && x.org),
    skills: [...new Set((Array.isArray(m.skills) ? m.skills : []).map(s => clean(s, 60)).filter(Boolean))].slice(0, 40),
    certs: [...new Set((Array.isArray(m.certs) ? m.certs : []).map(s => clean(s, 120)).filter(Boolean))].slice(0, 20),
    tailor: {}
  };
  // One resume per person: no versions per job, so nothing is kept under p.tailor.
  // Translations of the resume's free text, per language: [text as written, the same text in that language].
  // Only pairs for text still in the profile are kept, so edited or removed lines don't pile up.
  // Whether checked employers may find this person and send invitations. Off for a new profile; changed only by PUT /api/me/recruit (U-012).
  p.recruit = { open: !!(m.recruit && m.recruit.open === true) };
  const have = new Set(core.trSources(p));
  p.tr = { en: [], ar: [] };
  for (const lg of ["en", "ar"]) {
    const seen = new Set();
    for (const pair of (Array.isArray(m.tr && m.tr[lg]) ? m.tr[lg] : []).slice(0, 400)) {
      if (!Array.isArray(pair)) continue;
      const src = clean(pair[0], 300), dst = clean(pair[1], 400);
      if (!src || !dst || seen.has(src) || !have.has(src) || core.scriptOf(src) === lg) continue;
      seen.add(src); p.tr[lg].push([src, dst]);
    }
  }
  const errors = {};
  if (p.name.length < 2) errors.name = "required";
  if (!p.gov) errors.gov = "required";
  if (!p.langs.length) errors.langs = "required";
  if (p.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email)) errors.email = "invalid";
  if (role === "student" && (!p.edu.uni || !p.edu.fac)) errors.edu = "required";
  if (Object.keys(errors).length) fail(422, "invalid_profile", errors);
  return p;
}

export function sanitizeCompany(core, input) {
  const c = input && typeof input === "object" ? input : {};
  const name = bi(c.name, 100);
  const website = clean(c.website, 200);
  return {
    name, abbr: clean(c.abbr, 5) || core.initialsOf(name.en || name.ar).slice(0, 3).toUpperCase(),
    sector: keyOf(core.SECTOR, c.sector) || "trade", cat: keyOf(core.CAT, c.cat) || "domestic", gov: keyOf(core.GOV, c.gov),
    about: bi(c.about, 1500), whatsapp: c.whatsapp ? (e164(core, c.whatsapp) || "") : "",
    // How people may apply besides Shaghilni. Companies set up before this have WhatsApp on.
    applyVia: { whatsapp: c.applyVia ? !!c.applyVia.whatsapp : true, call: !!(c.applyVia && c.applyVia.call), email: !!(c.applyVia && c.applyVia.email) },
    applyPhone: c.applyPhone ? (e164(core, c.applyPhone) || "") : "",
    applyEmail: /^[^\s@]{1,64}@[^\s@]{3,190}$/.test(String(c.applyEmail || "").trim()) ? String(c.applyEmail).trim().toLowerCase() : "",
    website: /^https?:\/\/[^\s]+$/i.test(website) ? website : "", regNo: clean(c.regNo, 60), contactName: clean(c.contactName, 100)
  };
}
export function companyMissing(c) {
  const miss = [];
  if (!c.name.en && !c.name.ar) miss.push("name");
  if (!c.gov) miss.push("gov");
  if (!c.regNo) miss.push("regNo");
  if (!c.contactName) miss.push("contactName");
  { const via = c.applyVia || { whatsapp: true };
    if (via.whatsapp && !c.whatsapp) miss.push("whatsapp");
    if (via.call && !c.applyPhone) miss.push("applyPhone");
    if (via.email && !c.applyEmail) miss.push("applyEmail"); }
  return miss;
}

export function sanitizeJob(core, input) {
  const j = input && typeof input === "object" ? input : {};
  const lo = intIn(j.pay && j.pay[0], 0, 100000000), hi = intIn(j.pay && j.pay[1], 0, 100000000);
  return {
    title: bi(j.title, 120), place: bi(j.place, 120), gov: keyOf(core.GOV, j.gov),
    type: keyOf(core.TYPE, j.type) || "full", level: keyOf(core.LEVEL, j.level) || "entry", mode: keyOf(core.MODE, j.mode) || "onsite",
    pay: [lo, Math.max(lo, hi)],
    langs: [...new Set((Array.isArray(j.langs) ? j.langs : []).filter(l => keyOf(core.LANGS, l)))].slice(0, 7),
    recruits: (Array.isArray(j.recruits) ? j.recruits : []).filter(r => Array.isArray(r) && keyOf(core.UNI, r[0]) && keyOf(core.FAC, r[1])).slice(0, 10).map(r => [r[0], r[1]]),
    anyFaculty: bool(j.anyFaculty), noDegree: bool(j.noDegree), support: bool(j.support), returnees: bool(j.returnees), unis: (Array.isArray(j.unis) ? j.unis : []).map(k => keyOf(core.UNI, k)).filter(Boolean).filter((k, i, a) => a.indexOf(k) === i).slice(0, 8), progStart: /^\d{4}-(0[1-9]|1[0-2])$/.test(String(j.progStart || "")) ? j.progStart : "", progEnd: /^\d{4}-(0[1-9]|1[0-2])$/.test(String(j.progEnd || "")) ? j.progEnd : "", openings: intIn(j.openings || 1, 1, 500),
    summary: bi(j.summary, 1500), duties: biList(j.duties, 12, 200), needs: biList(j.needs, 12, 200), provides: biList(j.provides, 12, 200),
    contact: { name: bi(j.contact && j.contact.name, 80), role: bi(j.contact && j.contact.role, 100), status: bi(j.contact && j.contact.status, 120) },
    tags: clean(j.tags, 300)
  };
}
/* Posting checks, the same ones the employer sees while typing: pay and the governorate are required,
   a fee word in the listing's own text or a demand for the candidate's money in any box blocks the listing, gendered wording
   is flagged for review, and so is a fee word in the place, contact lines, what the job offers or the tags. */
export function checkJob(core, j) {
  const missing = [];
  if (!j.title.en && !j.title.ar) missing.push("title");
  if (!j.gov) missing.push("gov");
  if (!(j.pay[0] > 0)) missing.push("pay");
  if (!j.langs.length) missing.push("langs");
  if (!j.summary.en && !j.summary.ar) missing.push("summary");
  const text = [j.title.en, j.title.ar, j.summary.en, j.summary.ar, ...j.duties.en, ...j.duties.ar, ...j.needs.en, ...j.needs.ar].join(" ");
  const aside = [j.place.en, j.place.ar, j.contact.name.en, j.contact.name.ar, j.contact.role.en, j.contact.role.ar, j.contact.status.en, j.contact.status.ar, ...j.provides.en, ...j.provides.ar, j.tags].join(" "), all = [text, aside].join(" ");
  const boxes = [j.title.en, j.title.ar, j.summary.en, j.summary.ar, ...j.duties.en, ...j.duties.ar, ...j.needs.en, ...j.needs.ar, j.place.en, j.place.ar, j.contact.name.en, j.contact.name.ar, j.contact.role.en, j.contact.role.ar, j.contact.status.en, j.contact.status.ar, ...j.provides.en, ...j.provides.ar, j.tags];
  const dem = boxes.map(b => feeDemand(core, b)), fee = core.findFee(text) || (dem.find(d => d.fee) || {}).fee, gender = core.findGender(text), flags = gender ? [{ type: "gender", word: gender }] : [];
  const feeAside = !fee && (core.findFee(aside) || (dem.find(d => d.soft) || {}).soft || boxes.map(b => feeFlag(core, b)).find(Boolean)); if (feeAside) flags.push({ type: "fee", word: feeAside });   // fee words in the other boxes go to the reviewer, so no box is a way round the check (U-020) and a benefit such as "tuition fees covered" is not refused (fix review)
  // Contact details anywhere in the free text are flagged for the reviewer, not blocked: the number is meant to reach a signed-in applicant only (D-30)
  const every = core.latinDigits(all);
  for (const w of new Set((every.match(/\+?\d[\d\s\-().]{5,}\d|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) || []).map(x => x.trim()).filter(x => x.includes("@") || x.replace(/\D/g, "").length >= 9)).values()) { if (flags.length >= 6) break; flags.push({ type: "contact", word: w }); }
  return { missing, fee: fee || null, flags };
}

/* A flagged word as the audit log keeps it: a run of nine digits or more, however it is separated, is masked as a phone number; a sum or a date stays as the reviewer read it (R12, D-176, D-190). */
export const hideNumbers = s => String(s).replace(/\+?[\d٠-٩۰-۹][\d٠-٩۰-۹\s\-–—‐‑−().\/_·٬٫\u200e\u200f\u061c]*[\d٠-٩۰-۹]/g, m => ((m.match(/[\d٠-٩۰-۹]/g) || []).length >= 9 ? "•••" : m));
/* A saved search for job alerts: only known filters, and a short keyword. */
export const ALERT_TABS = ["intern", "domestic", "multinational", "entry", "returnees"];
export function sanitizeAlert(core, m) {
  m = m && typeof m === "object" ? m : {};
  return { q: clean(m.q, 60), gov: keyOf(core.GOV, m.gov), type: keyOf(core.TYPE, m.type), tab: ALERT_TABS.includes(m.tab) ? m.tab : "" };
}
