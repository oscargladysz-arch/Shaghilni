/* Teams: several people working in one company, like LinkedIn Page admins.
   An owner or admin invites people by phone number with a role; they accept when they sign in. People can also find
   their company and ask to join; an owner or admin approves them with a role. Every permission is checked here and in
   each employer route, never only in the interface. */
import { fail } from "../http.js";
import { J, now } from "../db.js";
import { e164 } from "../validate.js";
import { ROLES } from "../plans.js";

export function registerTeam(r, deps) {
  const { db, core, auth, audit, notify, plans, limit } = deps;
  const employer = auth.need("employer");
  const coName = c => (J(c.data) || {}).name || {};
  const active = ctx => { const c = plans.companyFor(ctx.user); if (!c) fail(409, "no_company"); return c; };
  const clean = (v, n) => String(v == null ? "" : v).replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, n);
  const pending = phone => db.get("SELECT m.*, c.data AS c_data FROM company_members m JOIN companies c ON c.id = m.company_id WHERE m.phone = ? AND m.status IN ('invited', 'requested')", phone);
  const tell = (phone, key, vars) => { if (!notify) return; const u = db.get("SELECT id, phone, lang FROM users WHERE phone = ? AND deleted_at IS NULL", phone); notify.text(u || { id: null, phone, lang: "ar" }, key, vars); };
  const roleWord = role => ({ en: { admin: "an admin", recruiter: "a recruiter", hiring_manager: "a hiring manager" }[role], ar: { admin: "مشرفاً", recruiter: "موظف توظيف", hiring_manager: "مدير توظيف" }[role] });
  const managers = c => [db.get("SELECT phone FROM users WHERE id = ?", c.owner_id), ...db.all("SELECT phone FROM company_members WHERE company_id = ? AND status = 'active' AND role = 'admin'", c.id)].filter(Boolean).map(x => x.phone);
  const seatsLeft = c => plans.limits(c).team - plans.teamUsed(c.id);
  const out = (c, m) => ({ phone: m.phone, name: m.name || "", role: m.role, status: m.status, since: m.responded_at || m.created_at,
    lastActive: m.user_id ? ((db.get("SELECT last_login_at FROM users WHERE id = ?", m.user_id) || {}).last_login_at || null) : null });

  r.get("/api/employer/team", employer, ctx => {
    const c = active(ctx), me = plans.allow(ctx, c, "view"), owner = db.get("SELECT id, phone, last_login_at FROM users WHERE id = ?", c.owner_id);
    const rows = db.all("SELECT * FROM company_members WHERE company_id = ? ORDER BY created_at", c.id);
    return { me: { role: me, phone: ctx.user.phone }, seats: { used: plans.teamUsed(c.id), limit: plans.limits(c).team },
      owner: { phone: owner ? owner.phone : null, name: plans.memberName(c, c.owner_id), lastActive: owner ? owner.last_login_at : null },
      members: rows.filter(m => m.status === "active").map(m => out(c, m)), invites: rows.filter(m => m.status === "invited").map(m => out(c, m)),
      requests: c.status === "verified" && plans.can(c, ctx.user, "manage") ? rows.filter(m => m.status === "requested").map(m => out(c, m)) : [] };   // a request waits unseen until the company is verified (fix review of U-023)
  });
  r.post("/api/employer/team", employer, ctx => {
    const c = active(ctx), me = plans.allow(ctx, c, "manage");
    if (c.status !== "verified") fail(409, "company_not_verified");   // an unchecked company sends no text in Shaghilni's name (D-10)
    const role = ROLES.includes(ctx.body.role) ? ctx.body.role : null; if (!role) fail(422, "bad_role");
    if (role === "admin" && me !== "owner") fail(403, "role_forbidden");   // only the owner makes admins, as at approval and role change (D-31, U-030)
    const name = clean(ctx.body.name, 80); if (!name) fail(422, "name_required");
    const phone = e164(core, ctx.body.phone); if (!phone) fail(422, "invalid_phone");
    if (seatsLeft(c) <= 0) fail(409, "team_full", { limit: plans.limits(c).team });
    if (!limit(`team-invite:${c.id}`, 20, 86400e3)) fail(429, "daily_limit");   // twenty invitations a day per company; cancelling does not give them back (D-10), and a refused number spends one too, so the form is no free account check (D-41)
    const u = db.get("SELECT id, role FROM users WHERE phone = ? AND deleted_at IS NULL", phone);
    if (u && u.role !== "employer") fail(409, "phone_taken");
    if (u && db.get("SELECT 1 AS x FROM companies WHERE owner_id = ?", u.id)) fail(409, "phone_taken");
    if (db.get("SELECT 1 AS x FROM company_members WHERE phone = ?", phone)) fail(409, "phone_taken");
    db.run("INSERT INTO company_members (company_id, phone, added_by, created_at, role, status, name) VALUES (?, ?, ?, ?, ?, 'invited', ?)", c.id, phone, ctx.user.id, now(), role, name);
    audit(ctx.user.id, "team.invited", "company", c.id, { role });
    tell(phone, "team_invite", { co: coName(c), role: roleWord(role), by: { en: plans.memberName(c, ctx.user.id), ar: plans.memberName(c, ctx.user.id) } });
    return { ok: true };
  });
  r.post("/api/employer/team/requests/:phone", employer, ctx => {
    const c = active(ctx); plans.allow(ctx, c, "manage");
    if (c.status !== "verified") fail(409, "company_not_verified");   // an unchecked company decides nothing and texts nobody in Shaghilni's name (D-10); a draft can hold someone else's number (fix review of U-023)
    const m = db.get("SELECT * FROM company_members WHERE company_id = ? AND phone = ? AND status = 'requested'", c.id, String(ctx.params.phone)); if (!m) fail(404, "not_found");
    if (ctx.body.decision !== "yes") { db.run("DELETE FROM company_members WHERE company_id = ? AND phone = ?", c.id, m.phone); audit(ctx.user.id, "team.request_declined", "company", c.id, {}); tell(m.phone, "team_declined", { co: coName(c) }); return { ok: true }; }
    const role = ROLES.includes(ctx.body.role) ? ctx.body.role : "recruiter";
    if (role === "admin" && plans.roleOf(c, ctx.user) !== "owner") fail(403, "role_forbidden");
    if (seatsLeft(c) <= 0) fail(409, "team_full", { limit: plans.limits(c).team });
    db.run("UPDATE company_members SET status = 'active', role = ?, responded_at = ? WHERE company_id = ? AND phone = ?", role, now(), c.id, m.phone);
    audit(ctx.user.id, "team.request_approved", "company", c.id, { role }); tell(m.phone, "team_approved", { co: coName(c), role: roleWord(role) });
    return { ok: true };
  });
  r.put("/api/employer/team/:phone", employer, ctx => {
    const c = active(ctx), me = plans.allow(ctx, c, "manage");
    const m = db.get("SELECT * FROM company_members WHERE company_id = ? AND phone = ? AND status IN ('active', 'invited')", c.id, String(ctx.params.phone)); if (!m) fail(404, "not_found");
    const role = ROLES.includes(ctx.body.role) ? ctx.body.role : null; if (!role) fail(422, "bad_role");
    if (me !== "owner" && (m.role === "admin" || role === "admin")) fail(403, "role_forbidden");   // only the owner manages admins
    db.run("UPDATE company_members SET role = ? WHERE company_id = ? AND phone = ?", role, c.id, m.phone);
    audit(ctx.user.id, "team.role_changed", "company", c.id, { from: m.role, to: role }); return { ok: true };
  });
  r.delete("/api/employer/team/:phone", employer, ctx => {
    const c = active(ctx), me = plans.allow(ctx, c, "manage");
    const m = db.get("SELECT * FROM company_members WHERE company_id = ? AND phone = ?", c.id, String(ctx.params.phone)); if (!m) fail(404, "not_found");
    if (me !== "owner" && m.role === "admin") fail(403, "role_forbidden");   // an admin, or an invitation to be one, is the owner's to remove (U-030)
    db.run("DELETE FROM company_members WHERE company_id = ? AND phone = ?", c.id, m.phone);
    audit(ctx.user.id, m.status === "invited" ? "team.invite_cancelled" : "team.removed", "company", c.id, {}); return { ok: true };
  });
  r.post("/api/employer/team/leave", employer, ctx => {
    const c = active(ctx); if (c.owner_id === ctx.user.id) fail(409, "owner_cannot_leave");
    db.run("DELETE FROM company_members WHERE company_id = ? AND phone = ?", c.id, ctx.user.phone); audit(ctx.user.id, "team.left", "company", c.id, {}); return { ok: true };
  });
  r.post("/api/employer/team/transfer", employer, ctx => {
    const c = active(ctx); plans.allow(ctx, c, "billing");
    const m = db.get("SELECT * FROM company_members WHERE company_id = ? AND phone = ? AND status = 'active'", c.id, String(ctx.body.phone || ""));
    const u = m && db.get("SELECT * FROM users WHERE phone = ? AND deleted_at IS NULL AND role = 'employer'", m.phone); if (!u) fail(404, "not_found");
    return db.tx(() => {
      db.run("DELETE FROM company_members WHERE company_id = ? AND phone = ?", c.id, m.phone);
      db.run("INSERT INTO company_members (company_id, phone, added_by, created_at, role, status, name, user_id, responded_at) VALUES (?, ?, ?, ?, 'admin', 'active', ?, ?, ?)", c.id, ctx.user.phone, u.id, now(), plans.memberName(c, ctx.user.id) || "", ctx.user.id, now());
      db.run("UPDATE companies SET owner_id = ?, data = json_set(data, '$.contactName', ?), updated_at = ? WHERE id = ?", u.id, m.name || (J(c.data) || {}).contactName || "", now(), c.id);   // the owner is named by the contact name: the new owner's, from their team row (U-031)
      audit(ctx.user.id, "team.ownership_transferred", "company", c.id, {}); return { ok: true };
    });
  });

  /* ---------- people without a company yet: answer an invitation, or find their company and ask to join ---------- */
  r.post("/api/employer/membership/:answer", employer, ctx => {
    if (plans.companyFor(ctx.user)) fail(409, "already_in_company");
    const m = pending(ctx.user.phone); if (!m) fail(404, "not_found");
    const c = db.get("SELECT * FROM companies WHERE id = ?", m.company_id);
    if (ctx.params.answer === "accept" && m.status === "invited") {
      db.run("UPDATE company_members SET status = 'active', user_id = ?, responded_at = ? WHERE company_id = ? AND phone = ?", ctx.user.id, now(), m.company_id, m.phone);
      audit(ctx.user.id, "team.joined", "company", m.company_id, { role: m.role }); return { ok: true };
    }
    if (ctx.params.answer === "decline" || ctx.params.answer === "cancel") {
      db.run("DELETE FROM company_members WHERE company_id = ? AND phone = ?", m.company_id, m.phone);
      audit(ctx.user.id, m.status === "invited" ? "team.invite_declined" : "team.request_withdrawn", "company", m.company_id, {}); return { ok: true };
    }
    fail(404, "not_found");
  });
  r.get("/api/employer/companies/search", employer, ctx => {
    const q = core.norm(String(ctx.query.get("q") || "")).trim(); if (q.length < 2) return { companies: [] };
    return { companies: db.all("SELECT id, data FROM companies WHERE status = 'verified' ORDER BY updated_at DESC LIMIT 400")
      .map(c => ({ id: c.id, d: J(c.data) || {} })).filter(x => core.norm(`${(x.d.name || {}).en || ""} ${(x.d.name || {}).ar || ""}`).includes(q)).slice(0, 8)
      .map(x => ({ id: x.id, name: x.d.name || {}, gov: x.d.gov || "", sector: x.d.sector || "" })) };
  });
  r.post("/api/employer/companies/:id/join", employer, ctx => {
    if (plans.companyFor(ctx.user)) fail(409, "already_in_company");
    if (pending(ctx.user.phone)) fail(409, "request_pending");
    const c = db.get("SELECT * FROM companies WHERE id = ? AND status IN ('draft', 'pending', 'verified')", Number(ctx.params.id)); if (!c) fail(404, "not_found");   // the company a registration number points to, even while it awaits verification (U-023); never a rejected or suspended one
    const name = clean(ctx.body.name, 80); if (!name) fail(422, "name_required");
    if (!limit(`team-join:${ctx.user.id}`, 5, 86400e3)) fail(429, "daily_limit");   // five requests a day per account, each texting the managers; withdrawing does not give one back (U-032, as D-10)
    db.run("INSERT INTO company_members (company_id, phone, added_by, created_at, role, status, name, user_id) VALUES (?, ?, ?, ?, 'recruiter', 'requested', ?, ?)", c.id, ctx.user.phone, ctx.user.id, now(), name, ctx.user.id);
    audit(ctx.user.id, "team.requested", "company", c.id, {});
    if (c.status === "verified") for (const p of managers(c)) tell(p, "team_request", { co: coName(c), name: { en: name, ar: name } });   // an unverified holder is told nothing: the request waits for the admin's check
    return { ok: true, status: "requested" };
  });

  /* ---------- who did what: the team's activity, for owners and admins ---------- */
  const LABEL = { "job.created": 1, "job.updated": 1, "job.submitted": 1, "job.closed": 1, "job.reopened": 1, "job.sponsored": 1, "job.unsponsored": 1, "application.moved": 1, "company.updated": 1, "company.submitted": 1,
    "team.invited": 1, "team.joined": 1, "team.requested": 1, "team.request_approved": 1, "team.request_declined": 1, "team.role_changed": 1, "team.removed": 1, "team.left": 1, "team.invite_cancelled": 1, "team.ownership_transferred": 1, "plan.requested": 1, "invite.sent": 1 };
  r.get("/api/employer/activity", employer, ctx => {
    const c = active(ctx); plans.allow(ctx, c, "manage");
    const jobs = db.all("SELECT id, data FROM jobs WHERE company_id = ?", c.id), jobIds = jobs.map(j => j.id), title = new Map(jobs.map(j => [j.id, ((J(j.data) || {}).title) || {}]));
    const apps = jobIds.length ? db.all(/* sql-safe: only "?" placeholders */ `SELECT id, job_id FROM applications WHERE job_id IN (${jobIds.map(() => "?").join(",")})`, ...jobIds) : [];
    const appJob = new Map(apps.map(a => [a.id, a.job_id])), ph = a => a.map(() => "?").join(",") || "NULL";
    const rows = db.all(/* sql-safe: only "?" placeholders */ `SELECT actor_id, action, entity, entity_id, data, created_at FROM audit WHERE (entity = 'company' AND entity_id = ?) OR (entity = 'job' AND entity_id IN (${ph(jobIds)})) OR (entity = 'application' AND entity_id IN (${ph(apps.map(a => a.id))})) ORDER BY created_at DESC LIMIT 150`, c.id, ...jobIds, ...apps.map(a => a.id));
    return { activity: rows.filter(x => LABEL[x.action]).slice(0, 100).map(x => { const d = J(x.data) || {}, jid = x.entity === "job" ? x.entity_id : x.entity === "application" ? appJob.get(x.entity_id) : null;
      return { at: x.created_at, who: plans.memberName(c, x.actor_id, ctx.user.lang) || "—", action: x.action, job: jid ? title.get(jid) || null : null, from: d.from || null, to: d.to || null, role: d.role || null }; }) };
  });
}
