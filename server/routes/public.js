import { fail } from "../http.js";
import { TERMS_VERSION } from "../config.js";
import { companyOut, jobOut, applicantCounts } from "../serialize.js";

/* Published jobs from companies that are verified (or demo). Search and filters run in the client. */
export function listPublished(db) {
  const rows = db.all(`SELECT j.*, c.data AS c_data, c.status AS c_status, c.id AS c_id, c.is_demo AS c_demo FROM jobs j
    JOIN companies c ON c.id = j.company_id
    WHERE j.status = 'published' AND c.status = 'verified' ORDER BY j.published_at DESC, j.id DESC LIMIT 500`);
  const counts = applicantCounts(db, rows.map(r => r.id));
  const partners = partnerMap(db);
  return rows.map(r => ({ ...jobOut(r, companyOut({ id: r.c_id, data: r.c_data, status: r.c_status, is_demo: r.c_demo }), counts.get(r.id)), partnerUnis: partners.get(r.c_id) || [] }));
}
export function getPublished(db, id) {
  const r = db.get(`SELECT j.*, c.data AS c_data, c.status AS c_status, c.id AS c_id, c.is_demo AS c_demo FROM jobs j
    JOIN companies c ON c.id = j.company_id WHERE j.id = ? AND j.status = 'published' AND c.status = 'verified'`, id);
  if (!r) return null;
  return { ...jobOut(r, companyOut({ id: r.c_id, data: r.c_data, status: r.c_status, is_demo: r.c_demo }), applicantCounts(db, [r.id]).get(r.id)), partnerUnis: partnerMap(db).get(r.c_id) || [] };
}
/* Universities whose career office has approved each company as a partner. */
function partnerMap(db) { const m = new Map(); for (const x of db.all("SELECT company_id, uni FROM uni_partners WHERE status = 'approved'")) { if (!m.has(x.company_id)) m.set(x.company_id, []); m.get(x.company_id).push(x.uni); } return m; }

export function registerPublic(r, deps) {
  const { db, auth } = deps;
  r.get("/api/auth/challenge", ctx => auth.challenge(ctx));
  r.post("/api/auth/code", ctx => auth.requestCode(ctx));
  r.post("/api/auth/verify", ctx => auth.verifyCode(ctx));
  r.post("/api/auth/logout", ctx => auth.logout(ctx));
  r.get("/api/jobs", () => ({ jobs: listPublished(db) }));
  r.get("/api/jobs/:id", ctx => {
    const j = getPublished(db, Number(ctx.params.id));
    if (!j) fail(404, "not_found");
    return { job: j };
  });
  r.get("/api/health", () => ({ ok: true }));
  r.get("/api/config", () => ({ ai: !!deps.cfg.anthropicKey, dev: !deps.cfg.prod, demo: deps.cfg.demoConfig ? deps.cfg.demoConfig() : [], card: deps.payments ? deps.payments.cardInfo() : null, legalName: deps.cfg.legalName, contactEmail: deps.cfg.contactEmail, termsVersion: TERMS_VERSION, sessionDays: deps.cfg.sessionDays }));
}
