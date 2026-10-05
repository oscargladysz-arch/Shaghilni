import { attendeesFor } from "./events.js";
/* Recruiters and students. Students who choose to be found can be discovered by checked employers, who invite
   them to apply for a job or to an event. Employers see a short card (first name and last initial, education,
   experience level, recent job titles, skills, languages) and never a phone number, unless the person accepts
   an event invitation. Nobody who hasn't switched it on is ever listed, and anyone can block a company. */
import { fail } from "../http.js";
import { J, now } from "../db.js";

const OPEN = ["sent", "seen"];
const DAY = 86400e3;
const clean = (v, n) => String(v ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, n);
export function shortName(n) {
  const w = String(n || "").trim().split(/\s+/).filter(Boolean);
  if (w.length < 2) return w[0] || "";
  const last = w[w.length - 1].replace(/^(ال|al-|el-)/i, "");
  return `${w[0]} ${last.charAt(0).toUpperCase()}.`;
}

export function registerRecruit(r, deps) {
  const { db, core, auth, audit, notify, limit } = deps, plans = deps.plans;
  const names = p => {
    const en = p.nameEn || (core.scriptOf(p.name) === "en" ? p.name : core.translitName(p.name, "en")) || p.name || "";
    const ar = p.nameAr || (core.scriptOf(p.name) === "ar" ? p.name : core.translitName(p.name, "ar")) || p.name || "";
    return { en, ar };
  };
  const card = (id, p, invites) => {
    const e = p.edu || {}, n = names(p);
    return { id, name: { en: shortName(n.en), ar: shortName(n.ar) }, uni: e.uni || "", uniName: e.uni === "other" ? e.uniName || "" : "",
             fac: e.fac || "", status: e.status || "", country: p.country || "", year: e.status === "student" ? Number(e.year) || 0 : 0, grad: Number(e.grad) || 0, level: (p.prefs && p.prefs.level) || "", gov: p.gov || "", langs: p.langs || [],
             skills: (p.skills || []).slice(0, 8), roles: [...(p.exp || []), ...(p.acts || [])].map(x => x.role).filter(Boolean).slice(0, 3), invites, verifiedUni: deps.campus ? deps.campus.verifiedUni(id, e.uni) : "" };
  };
  const verified = ctx => {
    auth.need("employer")(ctx);
    const c = plans.companyFor(ctx.user);
    if (!c || c.status !== "verified") fail(409, "company_not_verified");
    return c;
  };
  const hiring = ctx => { const c = verified(ctx); plans.allow(ctx, c, "hire"); return c;
  };
  const student = ctx => {   // any job seeker with a profile
    auth.need("seeker")(ctx);
    const row = db.get("SELECT data FROM profiles WHERE user_id = ?", ctx.user.id);
    const p = row && J(row.data);
    if (!p) fail(409, "profile_required");
    return p;
  };
  const findable = (id, companyId) => {
    const u = db.get("SELECT * FROM users WHERE id = ? AND deleted_at IS NULL AND role = 'seeker'", id);
    const row = u && db.get("SELECT data FROM profiles WHERE user_id = ?", id);
    const p = row && J(row.data);
    if (!p || !(p.recruit && p.recruit.open === true)) return null;
    if (db.get("SELECT 1 AS x FROM recruiter_blocks WHERE user_id = ? AND company_id = ?", id, companyId)) return null;
    return { u, p };
  };

  /* ---------- employers ---------- */
  r.get("/api/employer/students", ctx => {
    const co = hiring(ctx);
    const f = k => String(ctx.query.get(k) || "").slice(0, 60);
    const fac = f("fac"), uni = f("uni"), gov = f("gov"), year = Number(f("year")) || 0, stage = f("stage"), level = f("level"), q = core.norm(f("q")).trim(), only = Number(f("id")) || 0;   // id: one card by user id, for Lite's invitation form (U-016)
    const rows = db.all(`SELECT p.user_id, p.data FROM profiles p JOIN users u ON u.id = p.user_id
      WHERE u.deleted_at IS NULL AND u.role = 'seeker' AND json_extract(p.data, '$.recruit.open') = 1
        AND NOT EXISTS (SELECT 1 FROM recruiter_blocks b WHERE b.user_id = p.user_id AND b.company_id = ?)
      ORDER BY p.updated_at DESC LIMIT 1000`, co.id);
    const mine = new Map();
    for (const i of db.all("SELECT user_id, kind, job_id, status FROM invitations WHERE company_id = ? AND status != 'withdrawn'", co.id)) {
      if (!mine.has(i.user_id)) mine.set(i.user_id, []);
      mine.get(i.user_id).push({ kind: i.kind, jobId: i.job_id, status: i.status });
    }
    const out = [];
    for (const row of rows) {
      if (only && row.user_id !== only) continue;
      const p = J(row.data); if (!p) continue;
      const e = p.edu || {};
      if ((fac && e.fac !== fac) || (uni && e.uni !== uni) || (gov && p.gov !== gov) || (year && Number(e.year) !== year)) continue;
      if ((stage === "student" && e.status !== "student") || (stage === "grad" && e.status === "student") || (level && (p.prefs || {}).level !== level)) continue;
      if (q && !core.norm([...(p.skills || []), ...(p.exp || []).map(x => x.role), ...(p.acts || []).map(x => x.role), e.course || ""].join(" ")).includes(q)) continue;
      out.push(card(row.user_id, p, mine.get(row.user_id) || []));
      if (out.length >= 60) break;
    }
    let list = ctx.query.get("verified") === "1" ? out.filter(x => x.verifiedUni) : out;
    if (ctx.query.get("event")) { const who = attendeesFor(db, ctx.query.get("event"), co.id); if (!who) fail(403, "not_attending"); list = list.filter(x => who.has(x.id)); }
    return { students: list };
  });

  r.post("/api/employer/students/:id/invite", ctx => {
    const co = hiring(ctx);
    const sid = Number(ctx.params.id);
    const who = findable(sid, co.id);
    if (!who) fail(404, "not_found");
    const kind = ctx.body.kind === "event" ? "event" : ctx.body.kind === "job" ? "job" : null;
    if (!kind) fail(422, "bad_kind");
    const open = db.get("SELECT COUNT(*) AS n FROM invitations WHERE company_id = ? AND user_id = ? AND status IN ('sent','seen')", co.id, sid).n;
    if (open >= 3) fail(429, "invite_limit");
    const allow = plans.limits(co).invites;
    if (allow != null && plans.invitesUsed(co.id) >= allow) fail(409, "invite_quota");
    const message = clean(ctx.body.message, 600);
    let jobId = null, event = null, title;
    if (kind === "job") {
      const j = db.get("SELECT * FROM jobs WHERE id = ? AND company_id = ? AND status = 'published'", Number(ctx.body.jobId), co.id);
      if (!j) fail(422, "bad_job");
      jobId = j.id; title = (J(j.data) || {}).title || {};
      if (db.get("SELECT 1 AS x FROM invitations WHERE company_id = ? AND user_id = ? AND job_id = ? AND status != 'withdrawn'", co.id, sid, jobId)) fail(409, "already_invited");
      if (db.get("SELECT 1 AS x FROM applications WHERE job_id = ? AND user_id = ? AND status != 'withdrawn'", jobId, sid)) fail(409, "already_applied");
    } else {
      const e = ctx.body.event && typeof ctx.body.event === "object" ? ctx.body.event : {};
      const ev = { title: clean(e.title, 120), date: String(e.date || "").slice(0, 10), place: clean(e.place, 160), link: String(e.link || "").trim().slice(0, 300) };
      const errors = {};
      if (ev.title.length < 3) errors.title = "required";
      const d = /^\d{4}-\d{2}-\d{2}$/.test(ev.date) ? Date.parse(ev.date + "T23:59:59Z") : NaN;
      if (!(d >= now()) || d > now() + 366 * DAY) errors.date = "bad_date";
      if (ev.link && !/^https:\/\/[^\s<>"']+$/.test(ev.link)) errors.link = "bad_link";
      if (!ev.place && !ev.link) errors.place = "required";
      if (Object.keys(errors).length) fail(422, "invalid_event", errors);
      event = ev; title = { en: ev.title, ar: ev.title };
    }
    const words = [message, event && event.title, event && event.place].filter(Boolean).join(" ");
    if (core.findFee(words)) fail(422, "invite_fee");
    if (core.findGender(words)) fail(422, "invite_bias");
    if (!limit(`invite:${co.id}`, 40, DAY)) fail(429, "invite_limit");   // counted only for invitations that pass every check
    const id = Number(db.run("INSERT INTO invitations (company_id, sender_id, user_id, kind, job_id, data, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'sent', ?, ?)",
      co.id, ctx.user.id, sid, kind, jobId, JSON.stringify({ message, event }), now(), now()).lastInsertRowid);
    audit(ctx.user.id, "invitation.sent", "invitation", id, { kind, jobId, student: sid });
    notify.text(who.u, kind === "job" ? "invite_job" : "invite_event", { co: (J(co.data) || {}).name || {}, title, date: event ? { en: event.date, ar: event.date } : {} });
    return { invitation: { id, kind, jobId, status: "sent" } };
  });

  r.get("/api/employer/invitations", ctx => {
    const co = hiring(ctx);   // the sent list carries full names and numbers after an event yes: hire level, like search (D-03)
    const rows = db.all(`SELECT i.*, p.data AS p_data, u.phone AS u_phone, j.data AS j_data FROM invitations i
      JOIN users u ON u.id = i.user_id LEFT JOIN profiles p ON p.user_id = i.user_id LEFT JOIN jobs j ON j.id = i.job_id
      WHERE i.company_id = ? ORDER BY i.created_at DESC LIMIT 200`, co.id);
    return { invitations: rows.map(i => {
      const p = J(i.p_data) || {}, d = J(i.data) || {}, n = names(p), e = p.edu || {};
      const contact = i.kind === "event" && i.status === "accepted" && !String(i.u_phone || "").startsWith("deleted:");
      return { id: i.id, kind: i.kind, status: i.status, createdAt: i.created_at, updatedAt: i.updated_at,
               student: { id: i.user_id, name: contact ? n : { en: shortName(n.en), ar: shortName(n.ar) }, phone: contact ? i.u_phone : null, fac: e.fac || "", uni: e.uni || "", year: Number(e.year) || 0 },
               job: i.job_id ? { id: i.job_id, title: (J(i.j_data) || {}).title || {} } : null, event: d.event || null, message: d.message || "" };
    }) };
  });

  r.post("/api/employer/invitations/:id/withdraw", ctx => {
    const co = hiring(ctx);   // the sent list carries full names and numbers after an event yes: hire level, like search (D-03)
    const i = db.get("SELECT * FROM invitations WHERE id = ? AND company_id = ?", Number(ctx.params.id), co.id);
    if (!i) fail(404, "not_found");
    if (!OPEN.includes(i.status)) fail(409, "bad_transition");
    db.run("UPDATE invitations SET status = 'withdrawn', updated_at = ? WHERE id = ?", now(), i.id);
    audit(ctx.user.id, "invitation.withdrawn", "invitation", i.id, {});
    return { ok: true };
  });

  /* ---------- students ---------- */
  r.put("/api/me/recruit", ctx => {
    const p = student(ctx);
    const open = ctx.body.open === true;
    p.recruit = { open };
    db.run("UPDATE profiles SET data = ?, updated_at = ? WHERE user_id = ?", JSON.stringify(p), now(), ctx.user.id);
    audit(ctx.user.id, open ? "recruit.opened" : "recruit.closed", "user", ctx.user.id, {});
    if (!open) for (const i of db.all("SELECT id FROM invitations WHERE user_id = ? AND status IN ('sent','seen')", ctx.user.id)) {   // opting out ends the open invitations too: nothing more reaches a company through them (D-32)
      db.run("UPDATE invitations SET status = 'withdrawn', updated_at = ? WHERE id = ?", now(), i.id); audit(ctx.user.id, "invitation.withdrawn", "invitation", i.id, { reason: "opted_out" });
    }
    return { open };
  });

  r.get("/api/me/invitations", ctx => {
    student(ctx);
    const rows = db.all(`SELECT i.*, c.data AS c_data, c.status AS c_status, j.data AS j_data, j.status AS j_status FROM invitations i
      JOIN companies c ON c.id = i.company_id LEFT JOIN jobs j ON j.id = i.job_id
      WHERE i.user_id = ? AND i.status != 'withdrawn' ORDER BY i.created_at DESC LIMIT 100`, ctx.user.id);
    db.run("UPDATE invitations SET status = 'seen', updated_at = ? WHERE user_id = ? AND status = 'sent'", now(), ctx.user.id);
    return { invitations: rows.map(i => {
      const c = J(i.c_data) || {}, j = J(i.j_data), d = J(i.data) || {};
      return { id: i.id, kind: i.kind, status: i.status === "sent" ? "new" : i.status, createdAt: i.created_at,
               company: { id: i.company_id, name: c.name || {}, abbr: c.abbr || "", sector: c.sector || "", verified: i.c_status === "verified" },
               job: j ? { id: i.job_id, title: j.title || {}, pay: j.pay || null, gov: j.gov || "", open: i.j_status === "published" } : null,
               event: d.event || null, message: d.message || "" };
    }) };
  });

  r.post("/api/me/invitations/:id/respond", ctx => {
    student(ctx);
    const i = db.get("SELECT * FROM invitations WHERE id = ? AND user_id = ?", Number(ctx.params.id), ctx.user.id);
    if (!i) fail(404, "not_found");
    if (!OPEN.includes(i.status)) fail(409, "bad_transition");
    const status = ctx.body.answer === "yes" ? "accepted" : ctx.body.answer === "no" ? "declined" : null;
    if (!status) fail(422, "bad_answer");
    db.run("UPDATE invitations SET status = ?, updated_at = ? WHERE id = ?", status, now(), i.id);
    audit(ctx.user.id, "invitation." + status, "invitation", i.id, {});
    return { invitation: { id: i.id, status } };
  });

  r.post("/api/me/invitations/:id/block", ctx => {
    student(ctx);
    const i = db.get("SELECT * FROM invitations WHERE id = ? AND user_id = ?", Number(ctx.params.id), ctx.user.id);
    if (!i) fail(404, "not_found");
    db.run("INSERT OR IGNORE INTO recruiter_blocks (user_id, company_id, created_at) VALUES (?, ?, ?)", ctx.user.id, i.company_id, now());
    db.run("UPDATE invitations SET status = 'declined', updated_at = ? WHERE user_id = ? AND company_id = ? AND status IN ('sent','seen')", now(), ctx.user.id, i.company_id);
    audit(ctx.user.id, "recruiter.blocked", "company", i.company_id, {});
    return { ok: true };
  });
}
