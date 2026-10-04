/* Shapes rows into the job objects the client engine already understands. */
import { J, now } from "./db.js";

/* The ways a company lets people apply besides Shaghilni (companies from before this have WhatsApp on). */
export function applyMethods(c) {
  const d = c || {}, via = d.applyVia || { whatsapp: true };
  return { whatsapp: !!via.whatsapp && !!d.whatsapp, call: !!via.call && !!d.applyPhone, email: !!via.email && !!d.applyEmail };
}
export function companyOut(row) {
  if (!row) return null;
  const d = J(row.data) || {};
  return { id: row.id, ...d, status: row.status, reviewNote: row.review_note || "", screenedAt: row.screened_at, verifiedAt: row.verified_at,
           submittedAt: row.submitted_at, demo: !!row.is_demo, createdAt: row.created_at, updatedAt: row.updated_at };
}
export function jobOut(row, company, counts = {}) {
  const d = J(row.data) || {}, c = company || {};
  const pub = row.published_at || row.created_at;
  return {
    sponsored: !!(row.sponsored_until && row.sponsored_until > Date.now()), sponsoredUntil: row.sponsored_until || null,
    unis: ((J(row.data) || {}).unis) || [], progStart: ((J(row.data) || {}).progStart) || "", progEnd: ((J(row.data) || {}).progEnd) || "",
    id: row.id, companyId: row.company_id, abbr: c.abbr || "", sector: c.sector || "trade", cat: c.cat || "domestic",
    co: c.name || { en: "", ar: "" }, about: c.about || { en: "", ar: "" },
    ...d,
    days: Math.max(0, Math.floor((now() - pub) / 86400e3)),
    applicants: counts.applicants || 0,
    ...(m => ({ hasWhatsapp: m.whatsapp, applyCall: m.call, applyEmail: m.email }))(applyMethods(c)), demo: !!row.is_demo
  };
}
export function employerJobOut(row, company, counts = {}) {
  return { ...jobOut(row, company, counts), status: row.status, reviewNote: row.review_note || "", flags: J(row.flags) || [],
           publishedAt: row.published_at, submittedAt: row.submitted_at, updatedAt: row.updated_at, counts };
}
export function applicantCounts(db, jobIds) {
  const out = new Map();
  if (!jobIds.length) return out;
  const rows = db.all(/* sql-safe: "?" placeholders only */ `SELECT job_id, status, COUNT(*) AS n FROM applications WHERE job_id IN (${jobIds.map(() => "?").join(",")}) GROUP BY job_id, status`, ...jobIds);
  for (const r of rows) {
    const c = out.get(r.job_id) || { applicants: 0, new: 0, shortlisted: 0, interview: 0, hired: 0, rejected: 0, withdrawn: 0 };
    c[r.status] = r.n;
    if (r.status !== "withdrawn") c.applicants += r.n;
    out.set(r.job_id, c);
  }
  return out;
}
