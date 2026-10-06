import { fail } from "../http.js";
import { PLANS } from "../plans.js";
import { now, J } from "../db.js";
import { sanitizeCompany, companyMissing, sanitizeJob, checkJob, e164 } from "../validate.js";
import { companyOut, employerJobOut, applicantCounts } from "../serialize.js";

const MOVES = {   // allowed application status changes, by current status
  new: ["shortlisted", "interview", "rejected"],
  shortlisted: ["interview", "hired", "rejected", "new"],
  interview: ["hired", "rejected", "shortlisted"],
  rejected: ["shortlisted", "new"],
  hired: ["interview"], withdrawn: []   // a hire goes back to interview only while the Shaghilni team has not confirmed it (U-003)
};

export function registerEmployer(r, deps) {
  const { db, core, auth, audit, notify, plans } = deps;
  const employer = auth.need("employer");
  const myCompany = ctx => plans.companyFor(ctx.user);
  const myJob = (ctx, id) => {
    const c = myCompany(ctx);
    const j = c && db.get("SELECT * FROM jobs WHERE id = ? AND company_id = ?", Number(id), c.id);
    if (!j) fail(404, "not_found");
    return { c, j };
  };
  const jobsOf = (c, me, lang) => {
    const rows = db.all("SELECT * FROM jobs WHERE company_id = ? ORDER BY updated_at DESC", c.id);
    const counts = applicantCounts(db, rows.map(x => x.id)), co = companyOut(c);
    return rows.map(x => ({ ...employerJobOut(x, co, counts.get(x.id) || {}), postedBy: x.created_by ? plans.memberName(c, x.created_by, lang) : null, mine: !!me && x.created_by === me }));
  };

  r.get("/api/employer", employer, ctx => {
    const c = myCompany(ctx);
    const role = c ? plans.roleOf(c, ctx.user) : null;
    const p = !c && db.get("SELECT m.status, m.role, c.data AS c_data FROM company_members m JOIN companies c ON c.id = m.company_id WHERE m.phone = ? AND m.status IN ('invited', 'requested')", ctx.user.phone);
    return { company: companyOut(c), jobs: c ? jobsOf(c, ctx.user.id, ctx.user.lang) : [], missing: c ? companyMissing(J(c.data)) : [], plan: c ? plans.summary(c) : null, isOwner: !c || c.owner_id === ctx.user.id,
      me: c ? { role, name: plans.memberName(c, ctx.user.id) } : null, pending: p ? { status: p.status, role: p.role, company: (J(p.c_data) || {}).name || {} } : null,
      partners: c ? db.all("SELECT uni, status FROM uni_partners WHERE company_id = ?", c.id) : [] };
  });

  r.put("/api/employer/company", employer, ctx => {
    { const own = myCompany(ctx); if (own) plans.allow(ctx, own, "manage");
      // one company, one page: if this registration number is already on Shaghilni, ask to join instead; Arabic-Indic digits are digits, Arabic words count like Latin ones (the governorate of the register), and an existing page changing its number is checked too (U-018, fix review)
      const key = s => core.norm(s).toUpperCase().replace(/[^A-Z0-9\u0621-\u064A]/g, ""), reg = key((ctx.body.company || {}).regNo);
      const dup = reg && (!own || key((J(own.data) || {}).regNo) !== reg) && db.all("SELECT id, data, status FROM companies").find(x => (!own || x.id !== own.id) && key((J(x.data) || {}).regNo) === reg);
      if (dup) fail(409, "company_exists", { id: dup.id, name: (J(dup.data) || {}).name || {}, verified: dup.status === "verified" });
      if (!own && db.get("SELECT 1 AS x FROM company_members WHERE phone = ? AND status IN ('invited', 'requested')", ctx.user.phone)) fail(409, "membership_pending"); }
    const data = sanitizeCompany(core, ctx.body.company);
    const c = myCompany(ctx);
    if (!c) {
      const id = Number(db.run("INSERT INTO companies (owner_id, data, created_at, updated_at) VALUES (?, ?, ?, ?)", ctx.user.id, JSON.stringify(data), now(), now()).lastInsertRowid);
      audit(ctx.user.id, "company.created", "company", id, null);
    } else {
      const old = J(c.data) || {};
      const identityChanged = old.regNo !== data.regNo || (old.name && (old.name.en !== data.name.en || old.name.ar !== data.name.ar));
      const status = c.status === "verified" && identityChanged ? "pending" : c.status;   // identity edits need re-verification
      db.run("UPDATE companies SET data = ?, status = ?, updated_at = ? WHERE id = ?", JSON.stringify(data), status, now(), c.id);
      audit(ctx.user.id, "company.updated", "company", c.id, { reverify: status !== c.status });
    }
    const cc = myCompany(ctx);
    return { company: companyOut(cc), missing: companyMissing(data) };
  });

  r.post("/api/employer/company/submit", employer, ctx => {
    { const own = myCompany(ctx); if (own) plans.allow(ctx, own, "manage"); }
    const c = myCompany(ctx);
    if (!c) fail(404, "no_company");
    const missing = companyMissing(J(c.data));
    if (missing.length) fail(422, "incomplete", missing);
    if (c.status === "verified") return { company: companyOut(c) };
    if (c.status === "suspended") fail(409, "suspended");
    db.run("UPDATE companies SET status = 'pending', submitted_at = ?, updated_at = ? WHERE id = ?", now(), now(), c.id);
    audit(ctx.user.id, "company.submitted", "company", c.id, null);
    return { company: companyOut(myCompany(ctx)) };
  });

  const submitJob = (ctx, c, jobRow, data) => {
    if (c.status !== "verified") fail(409, "company_not_verified");
    const check = checkJob(core, data);
    if (check.missing.length) fail(422, "incomplete", check.missing);
    if (check.fee) fail(422, "fee_requested", check.fee);
    db.run("UPDATE jobs SET status = 'pending', flags = ?, submitted_at = ?, updated_at = ? WHERE id = ?", JSON.stringify(check.flags), now(), now(), jobRow.id);
    audit(ctx.user.id, "job.submitted", "job", jobRow.id, { flags: check.flags.map(f => (f.type === "contact" ? { type: "contact" } : f)) });   // the log never holds the number or address itself (R12)
  };

  r.post("/api/employer/jobs", employer, ctx => {
    const c = myCompany(ctx);
    if (!c) fail(409, "no_company");
    plans.allow(ctx, c, "hire");
    const data = sanitizeJob(core, ctx.body.job);
    const id = Number(db.run("INSERT INTO jobs (company_id, data, flags, created_at, updated_at, created_by) VALUES (?, ?, ?, ?, ?, ?)",
      c.id, JSON.stringify(data), JSON.stringify(checkJob(core, data).flags), now(), now(), ctx.user.id).lastInsertRowid);
    audit(ctx.user.id, "job.created", "job", id, null);
    if (ctx.body.submit) submitJob(ctx, c, { id }, data);
    return { job: jobsOf(c, ctx.user.id, ctx.user.lang).find(x => x.id === id), check: checkJob(core, data) };
  });

  r.put("/api/employer/jobs/:id", employer, ctx => {
    const { c, j } = myJob(ctx, ctx.params.id); plans.allow(ctx, c, "hire");
    const data = sanitizeJob(core, ctx.body.job);
    const back = ["published", "rejected", "pending", "closed"].includes(j.status) ? "draft" : j.status;   // new text is reviewed again, whatever state it was in (D-05, D-06); a sponsorship ends with the edit (D-29)
    db.run("UPDATE jobs SET data = ?, status = ?, flags = ?, sponsored_until = NULL, updated_at = ? WHERE id = ?", JSON.stringify(data), back, JSON.stringify(checkJob(core, data).flags), now(), j.id);
    audit(ctx.user.id, "job.updated", "job", j.id, { from: j.status, to: back });
    if (ctx.body.submit) submitJob(ctx, c, j, data);
    return { job: jobsOf(c, ctx.user.id, ctx.user.lang).find(x => x.id === j.id), check: checkJob(core, data) };
  });

  r.post("/api/employer/jobs/:id/submit", employer, ctx => {
    plans.allow(ctx, myCompany(ctx), "hire");
    const { c, j } = myJob(ctx, ctx.params.id);
    if (!["draft", "rejected"].includes(j.status)) fail(409, "bad_state");
    submitJob(ctx, c, j, J(j.data));
    return { job: jobsOf(c, undefined, ctx.user.lang).find(x => x.id === j.id) };
  });
  r.post("/api/employer/jobs/:id/close", employer, ctx => {
    plans.allow(ctx, myCompany(ctx), "hire");
    const { c, j } = myJob(ctx, ctx.params.id);
    if (j.status !== "published") fail(409, "bad_state");
    db.run("UPDATE jobs SET status = 'closed', sponsored_until = NULL, updated_at = ? WHERE id = ?", now(), j.id);   // a closed listing holds no sponsored slot (D-29)
    audit(ctx.user.id, "job.closed", "job", j.id, null);
    return { job: jobsOf(c, undefined, ctx.user.lang).find(x => x.id === j.id) };
  });
  r.post("/api/employer/jobs/:id/reopen", employer, ctx => {
    plans.allow(ctx, myCompany(ctx), "hire");
    const { c, j } = myJob(ctx, ctx.params.id);
    if (j.status !== "closed") fail(409, "bad_state");
    if (c.status !== "verified") fail(409, "company_not_verified");
    db.run("UPDATE jobs SET status = ?, updated_at = ? WHERE id = ?", j.published_at ? "published" : "draft", now(), j.id);
    audit(ctx.user.id, "job.reopened", "job", j.id, null);
    return { job: jobsOf(c, undefined, ctx.user.lang).find(x => x.id === j.id) };
  });

  r.get("/api/employer/jobs/:id/applications", employer, ctx => {
    const { c: co, j } = myJob(ctx, ctx.params.id); plans.allow(ctx, co, "view");
    if (co.status !== "verified") fail(409, co.status === "suspended" ? "suspended" : "company_not_verified");   // only a verified company reads applicants: not a suspended one (U-022), a rejected one, or one resubmitted or sent back to review after an identity edit until the admin verifies it again (fix reviews)
    const rows = db.all(`SELECT a.*, u.phone AS u_phone FROM applications a JOIN users u ON u.id = a.user_id
      WHERE a.job_id = ? AND a.status != 'withdrawn' ORDER BY a.created_at DESC`, j.id);
    return { applications: rows.map(a => ({
      id: a.id, status: a.status, channel: a.channel, createdAt: a.created_at, updatedAt: a.updated_at, hiredAt: a.hired_at,
      hireConfirmed: !!a.hire_confirmed_at, note: a.employer_note || "", cvLang: a.cv_lang || null, profile: J(a.snapshot) || {},
      phone: a.u_phone.startsWith("deleted:") ? null : a.u_phone,
      verifiedUni: deps.campus ? deps.campus.verifiedUni(a.user_id, ((J(a.snapshot) || {}).edu || {}).uni) : "",
      movedBy: a.moved_by ? plans.memberName(co, a.moved_by, ctx.user.lang) : null, noteBy: a.note_by ? plans.memberName(co, a.note_by, ctx.user.lang) : null
    })) };
  });

  r.put("/api/employer/applications/:id", employer, ctx => {
    const c = myCompany(ctx);
    const a = c && db.get("SELECT a.*, j.data AS j_data FROM applications a JOIN jobs j ON j.id = a.job_id WHERE a.id = ? AND j.company_id = ?", Number(ctx.params.id), c.id);
    if (!a) fail(404, "not_found");
    if (c.status !== "verified") fail(409, c.status === "suspended" ? "suspended" : "company_not_verified");   // nor moves or texts anyone (U-022, fix reviews)
    const note = ctx.body.note != null ? String(ctx.body.note).slice(0, 1000) : a.employer_note;
    const status = ctx.body.status || a.status;
    plans.allow(ctx, c, status !== a.status ? "hire" : "view");   // hiring managers can write notes; moving people takes a recruiter
    if (status !== a.status && !(MOVES[a.status] || []).includes(status)) fail(409, "bad_transition", { from: a.status, to: status });
    if (status !== a.status && a.hire_confirmed_at) fail(409, "hire_confirmed");   // a confirmed hire is final
    const into = status === "hired" && a.status !== "hired";   // the basis is written only on the move into hired, and an undo and a re-hire never lower the fee (fix reviews)
    db.run("UPDATE applications SET status = ?, employer_note = ?, updated_at = ?, hired_at = CASE WHEN ? = 'hired' THEN COALESCE(hired_at, ?) ELSE NULL END, hire_pay_mid = CASE WHEN ? THEN MAX(COALESCE(hire_pay_mid, 0), COALESCE(apply_pay_mid, 0), ?) ELSE hire_pay_mid END, hire_plan = CASE WHEN ? THEN ? ELSE hire_plan END, moved_by = CASE WHEN ? THEN ? ELSE moved_by END, note_by = CASE WHEN ? THEN ? ELSE note_by END WHERE id = ?",
      status, note, now(), status, now(), into ? 1 : 0, plans.payMid(J(a.j_data) || {}), into ? 1 : 0, a.hire_plan && (PLANS[a.hire_plan] || PLANS.free).sourcedFee ? a.hire_plan : plans.planOf(c), status !== a.status ? 1 : 0, ctx.user.id, note !== a.employer_note ? 1 : 0, ctx.user.id, a.id);   // the pay shown when the person applied or at a hire, whichever is higher, and the plan at the hire decide the fee; a re-hire after an undo keeps a plan that charges it and can only raise the pay (D-09, U-029, fix reviews)
    if (status !== a.status) {
      audit(ctx.user.id, "application.moved", "application", a.id, { from: a.status, to: status });
      const seekerUser = db.get("SELECT * FROM users WHERE id = ?", a.user_id);
      if (a.status !== "hired") notify(seekerUser, status, { co: (J(c.data) || {}).name, title: (J(a.j_data) || {}).title });   // undoing a hire texts nobody: the interview text would follow a congratulations (U-003)
    }
    return { ok: true, status };
  });

  /* ---------- plans, team, sponsoring, analytics and reports ---------- */
  const verifiedCo = ctx => { const c = myCompany(ctx); if (!c || c.status !== "verified") fail(409, "company_not_verified"); return c; };
  const ownerOnly = (ctx, c) => plans.allow(ctx, c, "billing");
  r.get("/api/employer/plan", employer, ctx => {
    const c = myCompany(ctx); if (!c) fail(409, "company_not_verified");
    const charges = db.all("SELECT id, kind, amount_syp, amount_usd, status, note, created_at, paid_at FROM charges WHERE company_id = ? AND programme_id IS NULL ORDER BY created_at DESC LIMIT 100", c.id)
      .map(x => ({ id: x.id, kind: x.kind, amountSyp: x.amount_syp, amountUsd: x.amount_usd, status: x.status, note: x.note, createdAt: x.created_at, paidAt: x.paid_at }));
    const pending = db.get("SELECT id, plan, pay_method, created_at FROM plan_requests WHERE company_id = ? AND handled_at IS NULL ORDER BY created_at DESC LIMIT 1", c.id);
    return { ...plans.summary(c), charges, request: pending ? { plan: pending.plan, payMethod: pending.pay_method, ref: plans.ref(c.id, pending.id), createdAt: pending.created_at } : null, isOwner: c.owner_id === ctx.user.id };
  });
  r.post("/api/employer/plan/request", employer, ctx => {
    const c = verifiedCo(ctx); ownerOnly(ctx, c);
    const plan = ["pro", "enterprise"].includes(ctx.body.plan) ? ctx.body.plan : null; if (!plan) fail(422, "bad_plan");
    const payMethod = plans.PAY_METHODS.includes(ctx.body.payMethod) ? ctx.body.payMethod : null; if (!payMethod) fail(422, "bad_pay_method");
    if (db.get("SELECT 1 AS x FROM plan_requests WHERE company_id = ? AND handled_at IS NULL", c.id)) fail(409, "plan_request_open");
    const id = Number(db.run("INSERT INTO plan_requests (company_id, plan, pay_method, note, created_at) VALUES (?, ?, ?, ?, ?)", c.id, plan, payMethod, String(ctx.body.note || "").slice(0, 400), now()).lastInsertRowid);
    audit(ctx.user.id, "plan.requested", "company", c.id, { plan, payMethod, request: id });
    return { ok: true, ref: plans.ref(c.id, id) };
  });
  const cleanPhone = raw => e164(core, raw);
  r.post("/api/employer/jobs/:id/sponsor", employer, ctx => {
    const { c, j } = myJob(ctx, ctx.params.id); plans.allow(ctx, c, "manage");
    if (c.status !== "verified") fail(409, "company_not_verified");
    if (!ctx.body.on) { db.run("UPDATE jobs SET sponsored_until = NULL WHERE id = ?", j.id); if (j.sponsored_until > now()) audit(ctx.user.id, "job.unsponsored", "job", j.id, null); return { ok: true, sponsoredUntil: null }; }   // the end is logged like the start (D-28)
    if (j.status !== "published") fail(409, "not_published");
    const L = plans.limits(c); if (!L.sponsored) fail(403, "plan_required");
    if (!(j.sponsored_until > now()) && plans.sponsoredUsed(c.id) >= L.sponsored) fail(409, "sponsor_limit");
    const until = now() + 30 * 86400e3; db.run("UPDATE jobs SET sponsored_until = ? WHERE id = ?", until, j.id);
    audit(ctx.user.id, "job.sponsored", "job", j.id, { until }); return { ok: true, sponsoredUntil: until };
  });
  r.get("/api/employer/analytics", employer, ctx => {
    const c = verifiedCo(ctx), full = !!plans.limits(c).analytics; plans.allow(ctx, c, "view");
    const rows = db.all(`SELECT a.id, a.job_id, a.status, a.channel, a.created_at, a.hired_at, a.user_id FROM applications a JOIN jobs j ON j.id = a.job_id WHERE j.company_id = ? AND a.status != 'withdrawn'`, c.id);
    const invited = new Set(db.all("SELECT user_id, job_id FROM invitations WHERE company_id = ? AND kind = 'job' AND status = 'accepted'", c.id).map(x => x.user_id + ":" + x.job_id));
    const jobs = db.all("SELECT id, data, status FROM jobs WHERE company_id = ? ORDER BY updated_at DESC", c.id);
    const stat = list => { const by = k => list.filter(a => a.status === k).length, hired = list.filter(a => a.hired_at);
      const days = hired.map(a => (a.hired_at - a.created_at) / 86400e3).sort((x, y) => x - y);
      return { applications: list.length, shortlisted: by("shortlisted") + by("interview") + by("hired"), interview: by("interview") + by("hired"), hired: by("hired"),
        whatsapp: full ? list.filter(a => a.channel === "whatsapp").length : null, fromSearch: full ? list.filter(a => invited.has(a.user_id + ":" + a.job_id)).length : null,
        medianDaysToHire: full && days.length ? Math.round(days[Math.floor(days.length / 2)] * 10) / 10 : null }; };
    return { full, total: stat(rows), jobs: jobs.map(j => ({ id: j.id, title: (J(j.data) || {}).title || {}, status: j.status, ...stat(rows.filter(a => a.job_id === j.id)) })) };
  });
  r.get("/api/employer/reports/:kind", employer, ctx => {
    const c = verifiedCo(ctx); plans.allow(ctx, c, "manage"); plans.need(c, "reports");
    if (ctx.params.kind === "placements") {
      const rows = db.all(`SELECT a.hired_at, a.hire_confirmed_at, j.data AS j_data FROM applications a JOIN jobs j ON j.id = a.job_id WHERE j.company_id = ? AND a.hire_confirmed_at IS NOT NULL ORDER BY a.hire_confirmed_at`, c.id);
      return { rows: rows.map(x => { const d = J(x.j_data) || {}; return { hiredAt: x.hired_at, confirmedAt: x.hire_confirmed_at, jobTitle: (d.title && (d.title.en || d.title.ar)) || "", governorate: d.gov || "", type: d.type || "", payMin: (d.pay || [])[0] || 0, payMax: (d.pay || [])[1] || 0 }; }) };
    }
    if (ctx.params.kind === "compliance") {
      const ids = [c.id]; const jobIds = db.all("SELECT id FROM jobs WHERE company_id = ?", c.id).map(x => x.id);
      const appIds = db.all("SELECT a.id FROM applications a JOIN jobs j ON j.id = a.job_id WHERE j.company_id = ?", c.id).map(x => x.id), ph = n => n.map(() => "?").join(",") || "NULL";
      const rows = db.all(/* sql-safe: only "?" placeholders are inserted, one per id */ `SELECT action, entity, entity_id, data, created_at FROM audit WHERE (entity = 'company' AND entity_id = ?) OR (entity = 'job' AND entity_id IN (${ph(jobIds)})) OR (entity = 'application' AND entity_id IN (${ph(appIds)})) ORDER BY created_at`, ...ids, ...jobIds, ...appIds);
      // Verification, sanctions screening, listing reviews and confirmed hires; nobody's personal details.
      return { rows: rows.filter(x => /^(company\.(verified|rejected|suspended|submitted|plan)|job\.(approved|rejected|sponsored)|hire\.confirmed)/.test(x.action)).map(x => { const d = J(x.data) || {}; return { at: x.created_at, action: x.action, item: x.entity + " " + x.entity_id, sanctionsScreened: d.screened === true ? "yes" : "" }; }) };
    }
    fail(404, "not_found");
  });

  /* ---------- card payments for plans ---------- */
  r.post("/api/employer/plan/checkout", employer, async ctx => {
    const c = verifiedCo(ctx); ownerOnly(ctx, c);
    return deps.payments.checkout(ctx, c, String(ctx.body.plan || ""), Number(ctx.body.months) || 0);
  });
  r.get("/api/employer/payments/:id", employer, ctx => { const c = verifiedCo(ctx); return deps.payments.status(Number(ctx.params.id), c.id); });

}
