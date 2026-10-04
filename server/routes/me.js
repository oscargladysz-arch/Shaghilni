import { applyMethods } from "../serialize.js";
import { fail } from "../http.js";
import { now, J } from "../db.js";
import { sanitizeProfile } from "../validate.js";
import { getPublished } from "./public.js";

export function registerMe(r, deps) {
  const { db, core, auth, audit } = deps;
  const seeker = auth.need("seeker");

  r.get("/api/me", ctx => {
    if (!ctx.user) return { user: null };
    const u = auth.publicUser(ctx.user);
    if (u.role === "university") return { user: u, campusOffice: db.get("SELECT uni, faculty, name FROM campus_offices WHERE user_id = ?", u.id) || null };
    if (u.role !== "seeker") return { user: u };
    const p = db.get("SELECT data FROM profiles WHERE user_id = ?", u.id);
    const saved = db.all("SELECT job_id FROM saved WHERE user_id = ? ORDER BY created_at DESC", u.id).map(x => x.job_id);
    const apps = db.all("SELECT id, job_id, status, updated_at FROM applications WHERE user_id = ?", u.id)
      .map(a => ({ id: a.id, jobId: a.job_id, status: a.status, updatedAt: a.updated_at }));
    const profile = p ? J(p.data) : null;
    const invitesNew = profile ? db.get("SELECT COUNT(*) AS n FROM invitations WHERE user_id = ? AND status = 'sent'", u.id).n : 0;
    const alertsNew = u.role === "seeker" && deps.alerts ? deps.alerts.unseen(u.id) : 0;
    const studentVerify = u.role === "seeker" && deps.campus ? deps.campus.forUser(u.id, profile) : null;
    const campusOffice = u.role === "university" ? db.get("SELECT uni, faculty, name FROM campus_offices WHERE user_id = ?", u.id) || null : null;
    return { user: u, profile, saved, applications: apps, invitesNew, alertsNew, studentVerify, campusOffice };
  });

  r.put("/api/me/lang", ctx => {
    auth.need()(ctx);
    const lang = ctx.body.lang === "en" ? "en" : "ar";
    db.run("UPDATE users SET lang = ? WHERE id = ?", lang, ctx.user.id);
    return { ok: true, lang };
  });

  r.put("/api/me/profile", seeker, ctx => {
    const profile = sanitizeProfile(core, ctx.body.profile, ctx.user.phone);
    db.run(`INSERT INTO profiles (user_id, data, updated_at) VALUES (?, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`, ctx.user.id, JSON.stringify(profile), now());
    return { profile };
  });

  r.post("/api/me/saved/:jobId", seeker, ctx => {
    const id = Number(ctx.params.jobId);
    if (!getPublished(db, id)) fail(404, "not_found");
    db.run("INSERT OR IGNORE INTO saved (user_id, job_id, created_at) VALUES (?, ?, ?)", ctx.user.id, id, now());
    return { ok: true };
  });
  r.delete("/api/me/saved/:jobId", seeker, ctx => {
    db.run("DELETE FROM saved WHERE user_id = ? AND job_id = ?", ctx.user.id, Number(ctx.params.jobId));
    return { ok: true };
  });

  r.post("/api/jobs/:id/apply", seeker, ctx => {
    const id = Number(ctx.params.id), job = getPublished(db, id);
    if (!job) fail(404, "not_found");
    const p = db.get("SELECT data FROM profiles WHERE user_id = ?", ctx.user.id);
    if (!p) fail(409, "profile_required");
    const channel = ["whatsapp", "call", "email"].includes(ctx.body.channel) ? ctx.body.channel : "web";
    const coData = J((db.get("SELECT data FROM companies WHERE id = ?", job.companyId) || {}).data) || {};
    if (channel !== "web" && !applyMethods(coData)[channel] && !job.demo) fail(409, "channel_unavailable");   // only the ways the company chose
    const cvLang = ctx.body.cvLang === "en" || ctx.body.cvLang === "ar" ? ctx.body.cvLang : null;   // which version of the resume was sent
    const existing = db.get("SELECT * FROM applications WHERE job_id = ? AND user_id = ?", id, ctx.user.id);
    let appId;
    if (existing && existing.status !== "withdrawn") appId = existing.id;
    else if (existing) {
      db.run("UPDATE applications SET status = 'new', channel = ?, cv_lang = ?, snapshot = ?, updated_at = ? WHERE id = ?", channel, cvLang, p.data, now(), existing.id);
      appId = existing.id;
    } else {
      appId = Number(db.run("INSERT INTO applications (job_id, user_id, channel, cv_lang, snapshot, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        id, ctx.user.id, channel, cvLang, p.data, now(), now()).lastInsertRowid);
      audit(ctx.user.id, "application.created", "application", appId, { jobId: id, channel, cvLang });
    }
    const out = { application: { id: appId, jobId: id, status: "new", cvLang: db.get("SELECT cv_lang FROM applications WHERE id = ?", appId).cv_lang || null } };
    if (channel === "whatsapp") out.whatsapp = applyMethods(coData).whatsapp ? coData.whatsapp : null;
    if (channel === "call") out.phone = applyMethods(coData).call ? coData.applyPhone : null;
    if (channel === "email") out.email = applyMethods(coData).email ? coData.applyEmail : null;
    return out;
  });

  r.get("/api/me/applications", seeker, ctx => {
    const rows = db.all(`SELECT a.id, a.job_id, a.status, a.channel, a.cv_lang, a.created_at, a.updated_at, j.data AS j_data, j.status AS j_status, c.data AS c_data
      FROM applications a JOIN jobs j ON j.id = a.job_id JOIN companies c ON c.id = j.company_id
      WHERE a.user_id = ? ORDER BY a.updated_at DESC`, ctx.user.id);
    return { applications: rows.map(a => {
      const jd = J(a.j_data) || {}, cd = J(a.c_data) || {};
      return { id: a.id, jobId: a.job_id, status: a.status, channel: a.channel, cvLang: a.cv_lang || null, createdAt: a.created_at, updatedAt: a.updated_at,
               jobOpen: a.j_status === "published", title: jd.title, co: cd.name, abbr: cd.abbr, sector: cd.sector, gov: jd.gov };
    }) };
  });

  r.post("/api/me/applications/:id/withdraw", seeker, ctx => {
    const a = db.get("SELECT * FROM applications WHERE id = ? AND user_id = ?", Number(ctx.params.id), ctx.user.id);
    if (!a) fail(404, "not_found");
    if (a.status === "hired") fail(409, "already_hired");
    db.run("UPDATE applications SET status = 'withdrawn', updated_at = ? WHERE id = ?", now(), a.id);
    audit(ctx.user.id, "application.withdrawn", "application", a.id, null);
    return { ok: true };
  });

  /* Everything the account holds, as one JSON file: the "download my data" button. */
  r.get("/api/me/export", ctx => {
    auth.need()(ctx);
    const u = ctx.user, iso = t => (t ? new Date(t).toISOString() : null);
    const out = { exportedAt: iso(now()),
      account: { phone: u.phone, role: u.role, language: u.lang, createdAt: iso(u.created_at), lastSignIn: iso(u.last_login_at),
                 termsVersion: u.terms_version || null, termsAcceptedAt: iso(u.terms_accepted_at) } };
    if (u.role === "seeker") {
      const p = db.get("SELECT data, updated_at FROM profiles WHERE user_id = ?", u.id);
      out.profile = p ? J(p.data) : null;
      out.savedJobs = db.all("SELECT s.job_id, s.created_at, j.data FROM saved s JOIN jobs j ON j.id = s.job_id WHERE s.user_id = ?", u.id)
        .map(x => ({ jobId: x.job_id, title: (J(x.data) || {}).title, savedAt: iso(x.created_at) }));
      out.applications = db.all(`SELECT a.*, j.data AS j_data, c.data AS c_data FROM applications a JOIN jobs j ON j.id = a.job_id
        JOIN companies c ON c.id = j.company_id WHERE a.user_id = ? ORDER BY a.created_at`, u.id)
        .map(a => ({ id: a.id, job: (J(a.j_data) || {}).title, company: (J(a.c_data) || {}).name, status: a.status, channel: a.channel, resumeLanguage: a.cv_lang || null,
                     sentAt: iso(a.created_at), updatedAt: iso(a.updated_at), profileSentToEmployer: J(a.snapshot) }));
    }
    if (u.role === "employer") {
      const c = db.get("SELECT * FROM companies WHERE owner_id = ?", u.id);
      out.company = c ? { ...J(c.data), status: c.status } : null;
      out.listings = c ? db.all("SELECT id, data, status, created_at FROM jobs WHERE company_id = ?", c.id).map(j => ({ id: j.id, ...J(j.data), status: j.status, createdAt: iso(j.created_at) })) : [];
    }
    if (u.role === "seeker") out.invitations = db.all(`SELECT i.kind, i.status, i.data, i.created_at, i.updated_at, c.data AS c_data, j.data AS j_data FROM invitations i
      JOIN companies c ON c.id = i.company_id LEFT JOIN jobs j ON j.id = i.job_id WHERE i.user_id = ? ORDER BY i.created_at`, u.id)
      .map(i => ({ from: (J(i.c_data) || {}).name, kind: i.kind, status: i.status, job: i.j_data ? (J(i.j_data) || {}).title : null,
                   event: (J(i.data) || {}).event || null, message: (J(i.data) || {}).message || "", sentAt: iso(i.created_at), updatedAt: iso(i.updated_at) }));
    if (u.role === "seeker") out.studentVerification = db.all("SELECT uni, student_no, email, method, status, created_at, decided_at FROM student_verifications WHERE user_id = ?", u.id).map(v => ({ university: v.uni, universityEmail: v.email || null, method: v.method, studentNumber: v.student_no || null, status: v.status, requestedAt: iso(v.created_at), decidedAt: v.decided_at ? iso(v.decided_at) : null }));
    if (u.role === "seeker") out.eventTickets = db.all("SELECT r.code, r.status, r.created_at, r.checked_in_at, e.data FROM event_rsvps r JOIN events e ON e.id = r.event_id WHERE r.user_id = ?", u.id).map(x => ({ event: ((J(x.data) || {}).title) || {}, code: x.code, status: x.status, signedUpAt: iso(x.created_at), checkedInAt: x.checked_in_at ? iso(x.checked_in_at) : null }));
    if (u.role === "seeker") out.jobAlerts = db.all("SELECT data, channel, created_at FROM alerts WHERE user_id = ?", u.id).map(a => ({ search: J(a.data), channel: a.channel, createdAt: iso(a.created_at) }));
    out.textMessages = db.all("SELECT body, status, created_at FROM notifications WHERE user_id = ? ORDER BY id", u.id)
      .map(n => ({ text: n.body, status: n.status, at: iso(n.created_at) }));
    ctx.headers["content-disposition"] = 'attachment; filename="shaghilni-my-data.json"';
    return out;
  });

  /* Account deletion: personal data is erased; the fact that an application or hire happened is kept, anonymised. */
  r.delete("/api/me", ctx => {
    auth.need()(ctx);
    if (ctx.user.role === "admin") fail(409, "admin_cannot_delete");
    const id = ctx.user.id, phone = ctx.user.phone;
    db.tx(() => {
      db.run("DELETE FROM profiles WHERE user_id = ?", id);
      db.run("DELETE FROM saved WHERE user_id = ?", id);
      db.run("DELETE FROM sessions WHERE user_id = ?", id);
      db.run("DELETE FROM notifications WHERE user_id = ?", id);
      db.run("DELETE FROM invitations WHERE user_id = ?", id);
      db.run("DELETE FROM alerts WHERE user_id = ?", id);
      db.run("DELETE FROM student_verifications WHERE user_id = ?", id);
      db.run("DELETE FROM email_codes WHERE user_id = ?", id);
      db.run("DELETE FROM event_rsvps WHERE user_id = ?", id);
      db.run("DELETE FROM company_members WHERE phone = ?", phone);
      db.run("DELETE FROM recruiter_blocks WHERE user_id = ?", id);
      db.run("DELETE FROM otps WHERE phone = ?", phone);
      db.run(`UPDATE applications SET snapshot = '{"deleted":true}', employer_note = NULL WHERE user_id = ?`, id);
      const c = db.get("SELECT * FROM companies WHERE owner_id = ?", id);
      if (c) {   // an employer leaving: close their listings and remove the people's contact details from the company page
        db.run("UPDATE jobs SET status = 'closed', updated_at = ? WHERE company_id = ? AND status != 'closed'", now(), c.id);
        db.run("UPDATE invitations SET status = 'withdrawn', updated_at = ? WHERE company_id = ? AND status IN ('sent','seen')", now(), c.id);
        const d = J(c.data) || {};
        db.run("UPDATE companies SET data = ?, status = 'suspended', review_note = 'Owner deleted the account', updated_at = ? WHERE id = ?",
          JSON.stringify({ ...d, contactName: "", whatsapp: "" }), now(), c.id);
      }
      db.run("UPDATE users SET phone = ?, deleted_at = ? WHERE id = ?", `deleted:${id}:${now()}`, now(), id);
    });
    audit(id, "user.deleted", "user", id, null);
    ctx.headers["set-cookie"] = auth.clearCookie();
    return { ok: true };
  });
}
