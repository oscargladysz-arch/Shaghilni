import { fail } from "../http.js";
import { now, J } from "../db.js";
import { companyOut, employerJobOut, applicantCounts } from "../serialize.js";
import { checkJob } from "../validate.js";

export function registerAdmin(r, deps) {
  const { db, auth, audit, core } = deps, plans = deps.plans;
  const admin = auth.need("admin");
  const WEEK = 7 * 86400e3;

  r.get("/api/admin/overview", admin, () => {
    const n = sql => db.get(sql).n;
    const weeks = [];
    const start = now() + 1 - 8 * WEEK;   // the last week includes this very millisecond
    for (let i = 0; i < 8; i++) {
      const a = start + i * WEEK, b = a + WEEK;
      weeks.push({ from: a, applications: db.get("SELECT COUNT(*) AS n FROM applications WHERE created_at >= ? AND created_at < ?", a, b).n,
                   confirmedHires: db.get("SELECT COUNT(*) AS n FROM applications WHERE hire_confirmed_at >= ? AND hire_confirmed_at < ?", a, b).n });
    }
    return {
      counts: {
        seekers: n("SELECT COUNT(*) AS n FROM users WHERE role = 'seeker' AND deleted_at IS NULL"),
        profiles: n("SELECT COUNT(*) AS n FROM profiles"),
        employers: n("SELECT COUNT(*) AS n FROM companies WHERE status = 'verified' AND is_demo = 0"),
        liveJobs: n("SELECT COUNT(*) AS n FROM jobs WHERE status = 'published' AND is_demo = 0"),
        demoJobs: n("SELECT COUNT(*) AS n FROM jobs WHERE status = 'published' AND is_demo = 1"),
        applications: n("SELECT COUNT(*) AS n FROM applications WHERE status != 'withdrawn'"),
        hired: n("SELECT COUNT(*) AS n FROM applications WHERE status = 'hired'"),
        confirmedHires: n("SELECT COUNT(*) AS n FROM applications WHERE hire_confirmed_at IS NOT NULL"),
        failedTexts: n("SELECT COUNT(*) AS n FROM notifications WHERE status = 'failed'")
      },
      queues: {
        companies: n("SELECT COUNT(*) AS n FROM companies WHERE status = 'pending'"),
        jobs: n("SELECT COUNT(*) AS n FROM jobs WHERE status = 'pending'"),
        hires: n("SELECT COUNT(*) AS n FROM applications WHERE status = 'hired' AND hire_confirmed_at IS NULL")
      },
      weeks
    };
  });

  r.get("/api/admin/companies", admin, ctx => {
    const status = ctx.query.get("status") || "pending";
    const rows = db.all(`SELECT c.*, u.phone AS owner_phone, (SELECT COUNT(*) FROM jobs WHERE company_id = c.id) AS job_count
      FROM companies c LEFT JOIN users u ON u.id = c.owner_id WHERE c.status = ? AND c.is_demo = 0 ORDER BY COALESCE(c.submitted_at, c.updated_at) ASC`, status);
    return { companies: rows.map(c => ({ ...companyOut(c), ownerPhone: c.owner_phone, jobCount: c.job_count })) };
  });
  const setCompany = (ctx, status, extra = {}) => {
    const c = db.get("SELECT * FROM companies WHERE id = ?", Number(ctx.params.id));
    if (!c) fail(404, "not_found");
    const note = String(ctx.body.note || "").trim().slice(0, 1000);
    if ((status === "rejected" || status === "suspended") && !note) fail(422, "note_required");
    db.run(`UPDATE companies SET status = ?, review_note = ?, updated_at = ?, screened_at = COALESCE(?, screened_at), screened_by = COALESCE(?, screened_by),
            verified_at = COALESCE(?, verified_at), verified_by = COALESCE(?, verified_by) WHERE id = ?`,
      status, note, now(), extra.screened_at ?? null, extra.screened_by ?? null, extra.verified_at ?? null, extra.verified_by ?? null, c.id);
    audit(ctx.user.id, `company.${status}`, "company", c.id, { note });
    return { company: companyOut(db.get("SELECT * FROM companies WHERE id = ?", c.id)) };
  };
  r.post("/api/admin/companies/:id/verify", admin, ctx => {
    if (ctx.body.screened !== true) fail(422, "screening_required");   // checked against the US sanctions list
    return setCompany(ctx, "verified", { screened_at: now(), screened_by: ctx.user.id, verified_at: now(), verified_by: ctx.user.id });
  });
  r.post("/api/admin/companies/:id/reject", admin, ctx => setCompany(ctx, "rejected"));
  r.post("/api/admin/companies/:id/suspend", admin, ctx => setCompany(ctx, "suspended"));

  r.get("/api/admin/jobs", admin, ctx => {
    const status = ctx.query.get("status") || "pending";
    const rows = db.all(`SELECT j.*, c.data AS c_data, c.status AS c_status, c.id AS c_id FROM jobs j JOIN companies c ON c.id = j.company_id
      WHERE j.status = ? AND j.is_demo = 0 ORDER BY COALESCE(j.submitted_at, j.updated_at) ASC`, status);
    const counts = applicantCounts(db, rows.map(x => x.id));
    return { jobs: rows.map(j => ({ ...employerJobOut(j, companyOut({ id: j.c_id, data: j.c_data, status: j.c_status }), counts.get(j.id) || {}), companyStatus: j.c_status })) };
  });
  r.post("/api/admin/jobs/:id/approve", admin, ctx => {
    const j = db.get("SELECT j.*, c.status AS c_status FROM jobs j JOIN companies c ON c.id = j.company_id WHERE j.id = ?", Number(ctx.params.id));
    if (!j) fail(404, "not_found");
    if (j.status !== "pending") fail(409, "bad_state");
    if (j.c_status !== "verified") fail(409, "company_not_verified");
    const check = checkJob(core, J(j.data) || {}); if (check.fee) fail(422, "fee_requested", check.fee);   // the posting checks run again at approval, whatever reached the queue (D-05)
    db.run("UPDATE jobs SET status = 'published', published_at = COALESCE(published_at, ?), reviewed_by = ?, review_note = ?, updated_at = ? WHERE id = ?",
      now(), ctx.user.id, String(ctx.body.note || "").slice(0, 1000), now(), j.id);
    audit(ctx.user.id, "job.approved", "job", j.id, null);
    return { ok: true };
  });
  r.post("/api/admin/jobs/:id/reject", admin, ctx => {
    const j = db.get("SELECT * FROM jobs WHERE id = ?", Number(ctx.params.id));
    if (!j) fail(404, "not_found");
    const note = String(ctx.body.note || "").trim().slice(0, 1000);
    if (!note) fail(422, "note_required");
    db.run("UPDATE jobs SET status = 'rejected', sponsored_until = NULL, review_note = ?, reviewed_by = ?, updated_at = ? WHERE id = ?", note, ctx.user.id, now(), j.id);   // a rejected listing holds no sponsored slot (D-29)
    audit(ctx.user.id, "job.rejected", "job", j.id, { note });
    return { ok: true };
  });

  /* The one metric: hires confirmed by a call to the employer. */
  r.get("/api/admin/hires", admin, ctx => {
    const confirmed = ctx.query.get("state") === "confirmed";
    const rows = db.all(/* sql-safe: constant NULL / NOT NULL */ `SELECT a.id, a.hired_at, a.hire_confirmed_at, a.snapshot, u.phone AS s_phone, j.data AS j_data, c.data AS c_data, o.phone AS e_phone
      FROM applications a JOIN users u ON u.id = a.user_id JOIN jobs j ON j.id = a.job_id JOIN companies c ON c.id = j.company_id
      LEFT JOIN users o ON o.id = c.owner_id
      WHERE a.status = 'hired' AND a.hire_confirmed_at IS ${confirmed ? "NOT NULL" : "NULL"} ORDER BY a.hired_at DESC LIMIT 200`);
    return { hires: rows.map(h => {
      const cd = J(h.c_data) || {}, s = J(h.snapshot) || {};
      return { id: h.id, hiredAt: h.hired_at, confirmedAt: h.hire_confirmed_at, title: (J(h.j_data) || {}).title, co: cd.name,
               contactName: cd.contactName || "", employerPhone: cd.whatsapp || h.e_phone, seekerName: s.name || "", seekerPhone: h.s_phone.startsWith("deleted:") ? null : h.s_phone };
    }) };
  });
  r.post("/api/admin/applications/:id/confirm-hire", admin, ctx => {
    const a = db.get("SELECT * FROM applications WHERE id = ?", Number(ctx.params.id));
    if (!a) fail(404, "not_found");
    if (a.status !== "hired") fail(409, "not_hired");
    const first = !a.hire_confirmed_at;
    const out = [];
    if (first) {   // a repeat click is a no-op: the first confirmer, time, audit row and charges stand (U-128)
      db.run("UPDATE applications SET hire_confirmed_at = ?, hire_confirmed_by = ? WHERE id = ?", now(), ctx.user.id, a.id);
      audit(ctx.user.id, "hire.confirmed", "application", a.id, { note: String(ctx.body.note || "").slice(0, 500) });
      const j = db.get("SELECT * FROM jobs WHERE id = ?", a.job_id), c = j && db.get("SELECT * FROM companies WHERE id = ?", j.company_id);
      // A placement fee only when a Free-plan employer hires someone it found and invited through candidate search.
      const sourced = c && db.get("SELECT 1 AS x FROM invitations WHERE company_id = ? AND user_id = ? AND status = 'accepted' AND created_at <= ?", c.id, a.user_id, a.created_at);
      if (sourced && plans.limits(c).sourcedFee) {
        const amt = plans.payMid(J(j.data) || {});
        db.run("INSERT INTO charges (company_id, application_id, kind, amount_syp, note, created_at) VALUES (?, ?, 'hire_fee', ?, ?, ?)", c.id, a.id, amt, "Placement fee: a hire found through candidate search", now());
        out.push({ kind: "hire_fee", amountSyp: amt });
      }
      const prog = Number(ctx.body.programmeId) ? db.get("SELECT * FROM programmes WHERE id = ? AND active = 1", Number(ctx.body.programmeId)) : null;
      if (prog) {
        db.run("UPDATE applications SET programme_id = ? WHERE id = ?", prog.id, a.id);
        db.run("INSERT INTO charges (programme_id, company_id, application_id, kind, amount_usd, note, created_at) VALUES (?, ?, ?, 'placement', ?, ?, ?)", prog.id, c ? c.id : null, a.id, prog.rate_usd, "Confirmed placement: " + prog.name, now());
        out.push({ kind: "placement", amountUsd: prog.rate_usd, programme: prog.name });
      }
    }
    return { ok: true, charges: out };
  });

  r.get("/api/admin/audit", admin, ctx => {
    const limit = Math.max(1, Math.min(200, parseInt(ctx.query.get("limit"), 10) || 50));
    return { entries: db.all("SELECT * FROM audit ORDER BY id DESC LIMIT ?", limit).map(e => ({ ...e, data: J(e.data) })) };
  });

  /* ---------- billing: plans, charges and programmes, all handled by hand for now ---------- */
  r.get("/api/admin/billing", admin, ctx => {
    const cos = db.all("SELECT id, data, plan, plan_until, status FROM companies WHERE status = 'verified' AND is_demo = 0 ORDER BY updated_at DESC LIMIT 300");
    const requests = db.all("SELECT r.id, r.company_id, r.plan, r.pay_method, r.note, r.created_at, c.data AS c_data FROM plan_requests r JOIN companies c ON c.id = r.company_id WHERE r.handled_at IS NULL ORDER BY r.created_at");
    const charges = db.all("SELECT ch.*, c.data AS c_data, p.name AS p_name FROM charges ch LEFT JOIN companies c ON c.id = ch.company_id LEFT JOIN programmes p ON p.id = ch.programme_id WHERE ch.status = 'due' ORDER BY ch.created_at DESC LIMIT 300");
    const progs = db.all("SELECT p.*, (SELECT COUNT(*) FROM charges x WHERE x.programme_id = p.id AND x.kind = 'placement' AND x.status != 'void') AS placements, (SELECT COALESCE(SUM(amount_usd), 0) FROM charges x WHERE x.programme_id = p.id AND x.status = 'due') AS due_usd FROM programmes p ORDER BY p.created_at");
    const name = d => ((J(d) || {}).name) || {};
    return { companies: cos.map(c => ({ id: c.id, name: name(c.data), plan: plans.planOf(c), planUntil: c.plan_until })),
      requests: requests.map(x => ({ id: x.id, companyId: x.company_id, company: name(x.c_data), plan: x.plan, payMethod: x.pay_method, ref: plans.ref(x.company_id, x.id), note: x.note, createdAt: x.created_at })),
      charges: charges.map(x => ({ id: x.id, kind: x.kind, company: x.c_data ? name(x.c_data) : null, programme: x.p_name || null, amountSyp: x.amount_syp, amountUsd: x.amount_usd, note: x.note, createdAt: x.created_at })),
      programmes: progs.map(p => ({ id: p.id, name: p.name, rateUsd: p.rate_usd, active: !!p.active, placements: p.placements, dueUsd: p.due_usd })) };
  });
  r.post("/api/admin/companies/:id/plan", admin, ctx => {
    const c = db.get("SELECT * FROM companies WHERE id = ?", Number(ctx.params.id)); if (!c) fail(404, "not_found");
    const plan = ["free", "pro", "enterprise"].includes(ctx.body.plan) ? ctx.body.plan : null; if (!plan) fail(422, "bad_plan");
    const months = Math.max(0, Math.min(36, Number(ctx.body.months) || 0)), until = plan === "free" || !months ? null : now() + months * 30 * 86400e3;
    db.run("UPDATE companies SET plan = ?, plan_until = ? WHERE id = ?", plan, until, c.id);
    db.run("UPDATE plan_requests SET handled_at = ? WHERE company_id = ? AND handled_at IS NULL", now(), c.id);
    const amt = Math.max(0, Math.round(Number(ctx.body.amountSyp) || 0));
    if (amt) db.run("INSERT INTO charges (company_id, kind, amount_syp, note, created_at) VALUES (?, 'plan', ?, ?, ?)", c.id, amt, `${plan} plan${months ? ", " + months + " months" : ""}`, now());
    audit(ctx.user.id, "company.plan", "company", c.id, { plan, months, amountSyp: amt });
    return { ok: true, plan, planUntil: until };
  });
  r.post("/api/admin/charges/:id/:what", admin, ctx => {
    const ch = db.get("SELECT * FROM charges WHERE id = ?", Number(ctx.params.id)); if (!ch) fail(404, "not_found");
    const to = ctx.params.what === "paid" ? "paid" : ctx.params.what === "void" ? "void" : null; if (!to) fail(404, "not_found");
    db.run("UPDATE charges SET status = ?, paid_at = ? WHERE id = ?", to, to === "paid" ? now() : null, ch.id);
    audit(ctx.user.id, "charge." + to, "charge", ch.id, {}); return { ok: true };
  });
  r.post("/api/admin/programmes", admin, ctx => {
    const nm = String(ctx.body.name || "").trim().slice(0, 120); if (!nm) fail(422, "invalid");
    const rate = Math.max(0, Math.min(100000, Math.round(Number(ctx.body.rateUsd) || 0)));
    const id = Number(db.run("INSERT INTO programmes (name, rate_usd, created_at) VALUES (?, ?, ?)", nm, rate, now()).lastInsertRowid);
    audit(ctx.user.id, "programme.created", "programme", id, { rate }); return { ok: true, id };
  });

}
