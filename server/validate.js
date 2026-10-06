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
    langs: [...new Set((Array.isArray(m.langs) ? m.langs : []).filter(l => core.LANGS[l]))].slice(0, 7),
    edu: {
      status: ["student", "secondary", "diploma", "bachelor", "master"].includes(e.status) ? e.status : (role === "student" ? "student" : ""),
      uni: e.uni === "other" ? "other" : keyOf(core.UNI, e.uni), uniName: clean(e.uniName, 120), fac: keyOf(core.FAC, e.fac),
      year: intIn(e.year, 0, 7), grad: e.grad ? intIn(e.grad, 1990, 2035) : 0,
      gpa: clean(e.gpa, 20), course: clean(e.course, 300), honors: clean(e.honors, 200)
    },
    prefs: {
      types: [...new Set((Array.isArray(m.prefs && m.prefs.types) ? m.prefs.types : []).filter(k => core.TYPE[k]))],
      fields: [...new Set((Array.isArray(m.prefs && m.prefs.fields) ? m.prefs.fields : []).filter(k => core.INTERESTS[k]))],
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
    langs: [...new Set((Array.isArray(j.langs) ? j.langs : []).filter(l => core.LANGS[l]))].slice(0, 7),
    recruits: (Array.isArray(j.recruits) ? j.recruits : []).filter(r => Array.isArray(r) && keyOf(core.UNI, r[0]) && keyOf(core.FAC, r[1])).slice(0, 10).map(r => [r[0], r[1]]),
    anyFaculty: bool(j.anyFaculty), noDegree: bool(j.noDegree), support: bool(j.support), returnees: bool(j.returnees), unis: (Array.isArray(j.unis) ? j.unis : []).map(k => keyOf(core.UNI, k)).filter(Boolean).filter((k, i, a) => a.indexOf(k) === i).slice(0, 8), progStart: /^\d{4}-(0[1-9]|1[0-2])$/.test(String(j.progStart || "")) ? j.progStart : "", progEnd: /^\d{4}-(0[1-9]|1[0-2])$/.test(String(j.progEnd || "")) ? j.progEnd : "", openings: intIn(j.openings || 1, 1, 500),
    summary: bi(j.summary, 1500), duties: biList(j.duties, 12, 200), needs: biList(j.needs, 12, 200), provides: biList(j.provides, 12, 200),
    contact: { name: bi(j.contact && j.contact.name, 80), role: bi(j.contact && j.contact.role, 100), status: bi(j.contact && j.contact.status, 120) },
    tags: clean(j.tags, 300)
  };
}
/* Posting checks, the same ones the employer sees while typing: pay and place are required,
   asking candidates for a fee blocks the listing, gendered wording is flagged for review, and so is a fee word in
   the place, contact lines, what the job offers or the tags. */
export function checkJob(core, j) {
  const missing = [];
  if (!j.title.en && !j.title.ar) missing.push("title");
  if (!j.gov) missing.push("gov");
  if (!(j.pay[0] > 0)) missing.push("pay");
  if (!j.langs.length) missing.push("langs");
  if (!j.summary.en && !j.summary.ar) missing.push("summary");
  const text = [j.title.en, j.title.ar, j.summary.en, j.summary.ar, ...j.duties.en, ...j.duties.ar, ...j.needs.en, ...j.needs.ar].join(" ");
  const aside = [j.place.en, j.place.ar, j.contact.name.en, j.contact.name.ar, j.contact.role.en, j.contact.role.ar, j.contact.status.en, j.contact.status.ar, ...j.provides.en, ...j.provides.ar, j.tags].join(" "), all = [text, aside].join(" ");
  const fee = core.findFee(text), gender = core.findGender(text), flags = gender ? [{ type: "gender", word: gender }] : [];
  const feeAside = !fee && core.findFee(aside); if (feeAside) flags.push({ type: "fee", word: feeAside });   // fee words in the other boxes go to the reviewer, so no box is a way round the check (U-020) and a benefit such as "tuition fees covered" is not refused (fix review)
  // Contact details anywhere in the free text are flagged for the reviewer, not blocked: the number is meant to reach a signed-in applicant only (D-30)
  const every = core.latinDigits(all);
  for (const w of new Set((every.match(/\+?\d[\d\s\-().]{5,}\d|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) || []).map(x => x.trim()).filter(x => x.includes("@") || x.replace(/\D/g, "").length >= 9)).values()) { if (flags.length >= 6) break; flags.push({ type: "contact", word: w }); }
  return { missing, fee: fee || null, flags };
}

/* A saved search for job alerts: only known filters, and a short keyword. */
export const ALERT_TABS = ["intern", "domestic", "multinational", "entry", "returnees"];
export function sanitizeAlert(core, m) {
  m = m && typeof m === "object" ? m : {};
  return { q: clean(m.q, 60), gov: keyOf(core.GOV, m.gov), type: keyOf(core.TYPE, m.type), tab: ALERT_TABS.includes(m.tab) ? m.tab : "" };
}
