/* Universities. A career office signs in to see how its students are doing on Shaghilni, verify students who ask,
   and approve employers as partners. It sees totals for all its students, but names and activity only for students
   who asked to be verified by it (they agree to that when they ask). */
import { createHmac, randomInt } from "node:crypto";
import { fail } from "../http.js";
import { J, now } from "../db.js";
import { e164 } from "../validate.js";

export function makeCampus({ db }) {
  // A student counts as verified only for the university in their profile now.
  const verifiedUni = (userId, uni) => (uni && db.get("SELECT 1 AS x FROM student_verifications WHERE user_id = ? AND uni = ? AND status = 'verified'", userId, uni) ? uni : "");
  const domainsOf = uni => db.all("SELECT domain FROM uni_domains WHERE uni = ? ORDER BY domain", uni).map(x => x.domain);
  const mask = email => { const [u, d] = String(email || "").split("@"); return u && d ? `${u.slice(0, 2)}${"•".repeat(Math.max(1, Math.min(6, u.length - 2)))}@${d}` : ""; };
  const forUser = (userId, profile) => {
    const uni = profile && profile.edu && profile.edu.uni; if (!uni) return null;
    const domains = domainsOf(uni);
    const v = db.get("SELECT status, uni, email, created_at, decided_at FROM student_verifications WHERE user_id = ? AND uni = ? AND status = 'verified' ORDER BY id DESC LIMIT 1", userId, uni);
    if (v) return { status: "verified", uni, email: mask(v.email), at: v.decided_at || v.created_at, domains };
    const code = db.get("SELECT email, expires_at FROM email_codes WHERE user_id = ? AND uni = ? AND expires_at > ?", userId, uni, now());
    return code ? { status: "code_sent", uni, email: mask(code.email), domains } : { status: "none", uni, domains };
  };
  return { verifiedUni, forUser, domainsOf, mask };
}

export function registerCampus(r, deps) {
  const { db, core, auth, audit, notify } = deps, campus = deps.campus;
  const seeker = auth.need("seeker"), uniOnly = auth.need("university"), admin = auth.need("admin"), employer = auth.need("employer");
  const office = ctx => { const o = db.get("SELECT * FROM campus_offices WHERE user_id = ?", ctx.user.id); if (!o) fail(403, "no_office"); return o; };
  const profileOf = uid => { const p = db.get("SELECT data FROM profiles WHERE user_id = ?", uid); return p ? J(p.data) || {} : null; };
  const inScope = (o, p) => p && p.edu && p.edu.uni === o.uni && (!o.faculty || p.edu.fac === o.faculty);
  const names = p => ({ en: p.nameEn || p.name || "", ar: p.nameAr || p.name || "" });

  /* ---------- students: ask their university to verify them ---------- */
  // Public webmail can never stand for a university.
  const PUBLIC_MAIL = new Set(["gmail.com", "googlemail.com", "yahoo.com", "hotmail.com", "outlook.com", "live.com", "msn.com", "icloud.com", "me.com", "aol.com", "mail.ru", "yandex.com", "yandex.ru", "proton.me", "protonmail.com", "gmx.com", "gmx.de", "web.de", "zoho.com"]);
  const hostOk = d => /^(?=.{4,120}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/.test(d) && !PUBLIC_MAIL.has(d);
  const uniForEmail = email => { const d = email.split("@")[1] || ""; const rows = db.all("SELECT uni, domain FROM uni_domains");
    const hit = rows.find(x => d === x.domain || d.endsWith("." + x.domain)); return hit ? hit.uni : null; };   // students' addresses may sit on a subdomain
  const codeHash = (userId, code) => createHmac("sha256", deps.cfg.otpPepper || "dev-pepper").update(`student-email:${userId}:${code}`).digest("hex");
  r.post("/api/me/verify-student", seeker, async ctx => {
    const p = profileOf(ctx.user.id); if (!p) fail(409, "profile_required");
    const uni = p.edu && p.edu.uni; if (!uni || !core.UNI[uni]) fail(422, "uni_required");
    if (campus.forUser(ctx.user.id, p).status === "verified") fail(409, "already_verified");
    const email = String(ctx.body.email || "").trim().toLowerCase();
    if (!/^[^\s@]{1,64}@[^\s@]{3,190}$/.test(email)) fail(422, "bad_email");
    if (!campus.domainsOf(uni).length) fail(409, "uni_no_email");
    const belongs = uniForEmail(email);
    if (belongs !== uni) fail(422, belongs ? "email_other_uni" : "email_wrong_domain", { domains: campus.domainsOf(uni) });
    if (db.get("SELECT 1 AS x FROM student_verifications WHERE email = ? AND status = 'verified' AND user_id != ?", email, ctx.user.id)) fail(409, "email_taken");
    if (db.get("SELECT COUNT(*) AS n FROM email_sends WHERE user_id = ? AND sent_at > ?", ctx.user.id, now() - 86400e3).n >= 5) fail(429, "too_many_emails");
    if (!deps.email && !deps.cfg.otpEcho) fail(503, "email_unavailable");
    const code = String(randomInt(0, 1e6)).padStart(6, "0");
    db.run("INSERT INTO email_codes (user_id, email, uni, code_hash, attempts, created_at, expires_at) VALUES (?, ?, ?, ?, 0, ?, ?) ON CONFLICT(user_id) DO UPDATE SET email = excluded.email, uni = excluded.uni, code_hash = excluded.code_hash, attempts = 0, created_at = excluded.created_at, expires_at = excluded.expires_at",
      ctx.user.id, email, uni, codeHash(ctx.user.id, code), now(), now() + 15 * 60e3);
    db.run("INSERT INTO email_sends (user_id, sent_at) VALUES (?, ?)", ctx.user.id, now());
    const ar = ctx.user.lang !== "en", uniName = core.UNI[uni][ar ? "ar" : "en"];
    if (deps.email) {
      try { await deps.email(email, ar ? `رمز التحقق من ${uniName}: ${code}` : `Your ${uniName} verification code: ${code}`,
        ar ? `رمزك ${code}. أدخله في ملفك على شغّلني لتوثّق أنك من طلاب ${uniName}. ينتهي خلال 15 دقيقة. إن لم تطلب هذا فتجاهل الرسالة.`
           : `Your code is ${code}. Enter it on your Shaghilni profile to verify you're a student at ${uniName}. It expires in 15 minutes. If you didn't ask for this, ignore this email.`); }
      catch (e) { db.run("DELETE FROM email_codes WHERE user_id = ?", ctx.user.id); fail(502, "email_failed"); }
    }
    audit(ctx.user.id, "student.email_code_sent", "user", ctx.user.id, { uni });
    return { verification: campus.forUser(ctx.user.id, p), ...(deps.cfg.otpEcho ? { devCode: code } : {}) };
  });
  r.post("/api/me/verify-student/confirm", seeker, ctx => {
    const p = profileOf(ctx.user.id); if (!p) fail(409, "profile_required");
    const row = db.get("SELECT * FROM email_codes WHERE user_id = ?", ctx.user.id);
    if (!row || row.expires_at <= now()) fail(410, "code_expired");
    if (row.attempts >= 5) fail(429, "code_locked");
    if (String(ctx.body.code || "").replace(/\D/g, "") === "" || codeHash(ctx.user.id, String(ctx.body.code).replace(/\D/g, "")) !== row.code_hash) {
      db.run("UPDATE email_codes SET attempts = attempts + 1 WHERE user_id = ?", ctx.user.id); fail(422, "bad_code");
    }
    if ((p.edu || {}).uni !== row.uni) fail(409, "uni_changed");
    if (db.get("SELECT 1 AS x FROM student_verifications WHERE email = ? AND status = 'verified' AND user_id != ?", row.email, ctx.user.id)) fail(409, "email_taken");
    db.tx(() => {
      db.run("UPDATE student_verifications SET status = 'withdrawn', decided_at = ? WHERE user_id = ? AND status IN ('pending', 'verified')", now(), ctx.user.id);
      db.run("INSERT INTO student_verifications (user_id, uni, student_no, status, email, method, created_at, decided_at) VALUES (?, ?, '', 'verified', ?, 'email', ?, ?)", ctx.user.id, row.uni, row.email, now(), now());
      db.run("DELETE FROM email_codes WHERE user_id = ?", ctx.user.id);
    });
    audit(ctx.user.id, "student.verified_by_email", "user", ctx.user.id, { uni: row.uni });
    return { verification: campus.forUser(ctx.user.id, p) };
  });
  r.delete("/api/me/verify-student", seeker, ctx => {
    db.run("DELETE FROM email_codes WHERE user_id = ?", ctx.user.id);
    db.run("UPDATE student_verifications SET status = 'withdrawn', decided_at = ? WHERE user_id = ? AND status IN ('pending', 'verified')", now(), ctx.user.id);
    audit(ctx.user.id, "student.verify_withdrawn", "user", ctx.user.id, {}); return { ok: true };
  });

  /* ---------- the career office ---------- */
  r.get("/api/campus", uniOnly, ctx => {
    const o = office(ctx), fac = o.faculty;
    const scope = `json_extract(p.data, '$.edu.uni') = ?${fac ? " AND json_extract(p.data, '$.edu.fac') = ?" : ""}`, sv = fac ? [o.uni, fac] : [o.uni];
    const q = (sql, ...extra) => db.get(sql, ...sv, ...extra);
    const stats = {
      students: q(`SELECT COUNT(*) AS n FROM profiles p JOIN users u ON u.id = p.user_id WHERE u.deleted_at IS NULL AND ${scope}`).n,   /* sql-safe: fixed fragments */
      verified: q(`SELECT COUNT(DISTINCT v.user_id) AS n FROM student_verifications v JOIN profiles p ON p.user_id = v.user_id WHERE v.status = 'verified' AND v.uni = json_extract(p.data, '$.edu.uni') AND ${scope}`).n,   /* sql-safe: fixed fragments */
      applying: q(`SELECT COUNT(DISTINCT a.user_id) AS n FROM applications a JOIN profiles p ON p.user_id = a.user_id WHERE a.status != 'withdrawn' AND ${scope}`).n,   /* sql-safe: fixed fragments */
      internsHired: q(`SELECT COUNT(*) AS n FROM applications a JOIN jobs j ON j.id = a.job_id JOIN profiles p ON p.user_id = a.user_id WHERE a.hire_confirmed_at IS NOT NULL AND json_extract(j.data, '$.type') = 'intern' AND ${scope}`).n,   /* sql-safe: fixed fragments */
      hires: q(`SELECT COUNT(*) AS n FROM applications a JOIN profiles p ON p.user_id = a.user_id WHERE a.hire_confirmed_at IS NOT NULL AND ${scope}`).n,   /* sql-safe: fixed fragments */
      employers: q(`SELECT COUNT(DISTINCT j.company_id) AS n FROM applications a JOIN jobs j ON j.id = a.job_id JOIN profiles p ON p.user_id = a.user_id WHERE a.hire_confirmed_at IS NOT NULL AND ${scope}`).n };   /* sql-safe: fixed fragments */
    const students = db.all("SELECT DISTINCT v.user_id, v.decided_at FROM student_verifications v WHERE v.uni = ? AND v.status = 'verified' ORDER BY v.decided_at DESC LIMIT 300", o.uni)
      .map(v => ({ v, p: profileOf(v.user_id) })).filter(x => inScope(o, x.p)).map(({ v, p }) => {
        const apps = db.all("SELECT a.status, a.hire_confirmed_at, j.data AS j_data FROM applications a JOIN jobs j ON j.id = a.job_id WHERE a.user_id = ? AND a.status != 'withdrawn'", v.user_id);
        return { id: v.user_id, name: names(p), fac: p.edu.fac || "", status: p.edu.status || "", year: Number(p.edu.year) || 0, applications: apps.length,
          interviews: apps.filter(a => a.status === "interview" || a.status === "hired").length, hired: apps.filter(a => a.hire_confirmed_at).map(a => ((J(a.j_data) || {}).title) || {}), verifiedAt: v.decided_at };
      });
    const partners = db.all("SELECT x.company_id, x.status, x.created_at, c.data AS c_data FROM uni_partners x JOIN companies c ON c.id = x.company_id WHERE x.uni = ? AND c.status = 'verified' ORDER BY x.created_at DESC", o.uni)
      .map(x => { const d = J(x.c_data) || {}; return { companyId: x.company_id, name: d.name || {}, sector: d.sector || "", cat: d.cat || "", status: x.status, createdAt: x.created_at }; });
    const jobs = db.all("SELECT j.id, j.data, j.company_id, c.data AS c_data FROM jobs j JOIN companies c ON c.id = j.company_id WHERE j.status = 'published' AND c.status = 'verified' ORDER BY j.published_at DESC LIMIT 300")
      .map(j => ({ j, d: J(j.data) || {} })).filter(x => (x.d.unis || []).includes(o.uni)).map(({ j, d }) => {
        const mine = db.all("SELECT a.user_id FROM applications a WHERE a.job_id = ? AND a.status != 'withdrawn'", j.id).filter(a => inScope(o, profileOf(a.user_id))).length;
        return { id: j.id, title: d.title || {}, company: (J(j.c_data) || {}).name || {}, type: d.type || "", progStart: d.progStart || "", progEnd: d.progEnd || "", seats: d.seats || 0, applicants: mine };
      });
    return { office: { uni: o.uni, faculty: o.faculty, name: o.name }, stats, domains: campus.domainsOf(o.uni), students, partners, internships: jobs };
  });
  const addDomain = (ctx, uni, raw) => {
    const d = String(raw || "").trim().toLowerCase().replace(/^@/, "").replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    if (!hostOk(d)) fail(422, "bad_domain");
    if (db.get("SELECT 1 AS x FROM uni_domains WHERE domain = ?", d)) fail(409, "domain_taken");
    db.run("INSERT INTO uni_domains (uni, domain, added_by, created_at) VALUES (?, ?, ?, ?)", uni, d, ctx.user.id, now());
    audit(ctx.user.id, "campus.domain_added", "user", ctx.user.id, { uni, domain: d }); return { ok: true, domains: campus.domainsOf(uni) };
  };
  const dropDomain = (ctx, uni, d) => { const n = db.run("DELETE FROM uni_domains WHERE uni = ? AND domain = ?", uni, String(d || "").toLowerCase()).changes; if (!n) fail(404, "not_found");
    audit(ctx.user.id, "campus.domain_removed", "user", ctx.user.id, { uni, domain: d }); return { ok: true, domains: campus.domainsOf(uni) }; };
  r.post("/api/campus/domains", uniOnly, ctx => addDomain(ctx, office(ctx).uni, ctx.body.domain));
  r.delete("/api/campus/domains/:domain", uniOnly, ctx => dropDomain(ctx, office(ctx).uni, ctx.params.domain));
  r.post("/api/admin/campus/domains", admin, ctx => { if (!core.UNI[ctx.body.uni]) fail(422, "uni_required"); return addDomain(ctx, ctx.body.uni, ctx.body.domain); });
  r.delete("/api/admin/campus/domains/:uni/:domain", admin, ctx => dropDomain(ctx, ctx.params.uni, ctx.params.domain));
  r.post("/api/campus/partners/:companyId", uniOnly, ctx => {
    const o = office(ctx), yes = ctx.body.decision === "yes";
    const n = db.run("UPDATE uni_partners SET status = ?, decided_at = ?, decided_by = ? WHERE company_id = ? AND uni = ?", yes ? "approved" : "declined", now(), ctx.user.id, Number(ctx.params.companyId), o.uni).changes;
    if (!n) fail(404, "not_found");
    audit(ctx.user.id, yes ? "partner.approved" : "partner.declined", "company", Number(ctx.params.companyId), { uni: o.uni });
    return { ok: true };
  });

  /* ---------- employers: ask a university to partner ---------- */
  r.post("/api/employer/partners", employer, ctx => {
    const c = deps.plans.companyFor(ctx.user); if (!c || c.status !== "verified") fail(409, "company_not_verified"); deps.plans.allow(ctx, c, "manage");
    const uni = core.UNI[ctx.body.uni] ? ctx.body.uni : null; if (!uni) fail(422, "uni_required");
    const cur = db.get("SELECT status FROM uni_partners WHERE company_id = ? AND uni = ?", c.id, uni);
    if (cur && cur.status !== "declined") return { ok: true, status: cur.status };
    db.run("INSERT INTO uni_partners (company_id, uni, status, created_at) VALUES (?, ?, 'requested', ?) ON CONFLICT(company_id, uni) DO UPDATE SET status = 'requested', created_at = excluded.created_at, decided_at = NULL, decided_by = NULL", c.id, uni, now());
    audit(ctx.user.id, "partner.requested", "company", c.id, { uni }); return { ok: true, status: "requested" };
  });

  /* ---------- the admin adds career offices ---------- */
  r.get("/api/admin/campus", admin, () => ({ offices: db.all("SELECT o.*, u.phone, u.last_login_at FROM campus_offices o JOIN users u ON u.id = o.user_id WHERE u.deleted_at IS NULL ORDER BY o.created_at DESC")
    .map(o => ({ userId: o.user_id, uni: o.uni, faculty: o.faculty, name: o.name, phone: o.phone, lastLoginAt: o.last_login_at, domains: campus.domainsOf(o.uni),
      verified: db.get("SELECT COUNT(*) AS n FROM student_verifications WHERE uni = ? AND status = 'verified'", o.uni).n })) }));
  r.post("/api/admin/campus", admin, ctx => {
    const phone = e164(core, ctx.body.phone); if (!phone) fail(422, "invalid_phone");
    const uni = core.UNI[ctx.body.uni] ? ctx.body.uni : null; if (!uni) fail(422, "uni_required");
    const fac = ctx.body.faculty && core.FAC[ctx.body.faculty] ? ctx.body.faculty : "";
    const name = String(ctx.body.name || "").trim().slice(0, 120);
    if (db.get("SELECT 1 AS x FROM users WHERE phone = ? AND deleted_at IS NULL", phone)) fail(409, "phone_taken");
    const uid = Number(db.run("INSERT INTO users (phone, role, lang, created_at) VALUES (?, 'university', 'ar', ?)", phone, now()).lastInsertRowid);
    db.run("INSERT INTO campus_offices (user_id, uni, faculty, name, created_at) VALUES (?, ?, ?, ?, ?)", uid, uni, fac, name, now());
    audit(ctx.user.id, "campus.office_added", "user", uid, { uni, faculty: fac }); return { ok: true, userId: uid };
  });
  r.delete("/api/admin/campus/:userId", admin, ctx => {
    const uid = Number(ctx.params.userId), n = db.run("DELETE FROM campus_offices WHERE user_id = ?", uid).changes; if (!n) fail(404, "not_found");
    db.run("DELETE FROM sessions WHERE user_id = ?", uid); audit(ctx.user.id, "campus.office_removed", "user", uid, {}); return { ok: true };
  });
}
