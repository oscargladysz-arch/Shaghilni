/* Events: careers days, internship fairs, talent sessions at business-council forums, diaspora evenings.
   Organisers (the Shaghilni team, or a university career office for its own university) create them and add
   companies. Job seekers sign up and get a ticket with a QR code and a short code; organisers check people in.
   Afterwards, a report gives totals only: who registered and came, from which universities, and what each
   company did next with the people it met (invitations, interviews, hires). */
import { randomInt } from "node:crypto";
import { fail } from "../http.js";
import { J, now } from "../db.js";

export const EVENT_KINDS = ["careers_day", "internship_fair", "talent_session", "diaspora"];
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";   // no 0/O or 1/I, so codes are easy to read out
const newCode = () => Array.from({ length: 6 }, () => CODE_CHARS[randomInt(CODE_CHARS.length)]).join("");
const clean = (v, n) => String(v == null ? "" : v).replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, n);
const bi = (v, n) => ({ en: clean(v && v.en, n), ar: clean(v && v.ar, n) });
// Event times are entered in Syria's time (UTC+3), as "YYYY-MM-DDTHH:MM".
const at = s => (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(String(s || "")) ? Date.parse(s + ":00+03:00") : NaN);

export function registerEvents(r, deps) {
  const { db, core, auth, audit, notify, plans } = deps;
  const seeker = auth.need("seeker"), employer = auth.need("employer");
  const office = ctx => (ctx.user.role === "university" ? db.get("SELECT * FROM campus_offices WHERE user_id = ?", ctx.user.id) : null);
  // Organisers: the Shaghilni team, or a career office that still exists. A removed office keeps the university role but no office row, and gets nothing here (D-11).
  const organiser = ctx => { auth.need("admin", "university")(ctx); if (ctx.user.role === "university" && !office(ctx)) fail(403, "no_office"); };
  const getEv = id => { const e = db.get("SELECT * FROM events WHERE id = ?", Number(id)); if (!e) fail(404, "not_found"); return e; };
  const canManage = (ctx, e) => ctx.user.role === "admin" || (ctx.user.role === "university" && (office(ctx) || {}).uni === e.uni && !!e.uni);
  const manage = (ctx, id) => { const e = getEv(id); if (!canManage(ctx, e)) fail(403, "forbidden"); return e; };
  const going = id => db.get("SELECT COUNT(*) AS n FROM event_rsvps WHERE event_id = ? AND status = 'going'", id).n;
  const coName = d => (J(d) || {}).name || {};
  const companiesOf = (id, all) => (all
    ? db.all("SELECT ec.company_id, ec.status, c.data FROM event_companies ec JOIN companies c ON c.id = ec.company_id WHERE ec.event_id = ? AND c.status = 'verified' ORDER BY ec.created_at", id)
    : db.all("SELECT ec.company_id, ec.status, c.data FROM event_companies ec JOIN companies c ON c.id = ec.company_id WHERE ec.event_id = ? AND c.status = 'verified' AND ec.status = 'confirmed' ORDER BY ec.created_at", id))
    .map(x => { const d = J(x.data) || {}; return { id: x.company_id, name: d.name || {}, abbr: (d.name && (d.name.en || "").split(/\s+/).map(w => w[0]).join("").slice(0, 2).toUpperCase()) || "", sector: d.sector || "", cat: d.cat || "", status: x.status }; });
  const out = (e, extra = {}) => { const d = J(e.data) || {}, n = going(e.id);
    return { id: e.id, title: d.title || {}, kind: d.kind || "", startsLocal: d.startsLocal || "", endsLocal: d.endsLocal || "", startsAt: e.starts_at, place: d.place || {}, gov: d.gov || "", host: d.host || "", about: d.about || {},
      link: d.link || "", uni: e.uni, capacity: e.capacity, going: n, spotsLeft: e.capacity ? Math.max(0, e.capacity - n) : null, status: e.status, ...extra }; };
  function sanitize(ctx, m, isNew) {
    m = m && typeof m === "object" ? m : {};
    const title = bi(m.title, 120); if (!title.en && !title.ar) fail(422, "invalid", { title: "required" });
    const kind = EVENT_KINDS.includes(m.kind) ? m.kind : "careers_day";
    const starts = at(m.startsLocal); if (!Number.isFinite(starts)) fail(422, "invalid", { startsLocal: "invalid" });
    if (isNew && starts < now() - 3600e3) fail(422, "invalid", { startsLocal: "past" });
    const ends = m.endsLocal && Number.isFinite(at(m.endsLocal)) && at(m.endsLocal) > starts ? m.endsLocal : "";
    const link = /^https?:\/\/[^\s]+$/.test(String(m.link || "")) ? clean(m.link, 300) : "";
    let uni = core.UNI[m.uni] ? m.uni : "";
    const o = office(ctx); if (o) uni = o.uni;   // a career office's events are always at its own university
    return { data: { title, kind, startsLocal: m.startsLocal, endsLocal: ends, place: bi(m.place, 160), gov: core.GOV[m.gov] ? m.gov : "", host: clean(m.host, 120), about: bi(m.about, 1500), link },
      starts, uni, capacity: Math.max(0, Math.min(5000, Math.round(Number(m.capacity) || 0))) };
  }

  /* ---------- everyone: upcoming events and an event page ---------- */
  r.get("/api/events", ctx => {
    const mine = ctx.user && ctx.user.role === "seeker" ? new Map(db.all("SELECT event_id, status FROM event_rsvps WHERE user_id = ?", ctx.user.id).map(x => [x.event_id, x.status])) : new Map();
    return { events: db.all("SELECT * FROM events WHERE status = 'published' AND starts_at > ? ORDER BY starts_at LIMIT 100", now() - 6 * 3600e3)
      .map(e => out(e, { companies: companiesOf(e.id).length, mine: mine.get(e.id) || null })) };
  });
  r.get("/api/events/:id", ctx => {
    const e = getEv(ctx.params.id), rs = ctx.user && ctx.user.role === "seeker" ? db.get("SELECT status, code, checked_in_at FROM event_rsvps WHERE event_id = ? AND user_id = ?", e.id, ctx.user.id) : null;
    if (e.status !== "published" && !(ctx.user && canManage(ctx, e)) && !(e.status === "cancelled" && rs)) fail(404, "not_found");   // a ticket holder can still read a cancelled event (U-041)
    return { event: out(e, { companies: companiesOf(e.id), mine: rs ? { status: e.status === "published" ? rs.status : "cancelled", code: rs.code, checkedIn: !!rs.checked_in_at } : null }) };
  });

  /* ---------- job seekers: sign up, get a ticket ---------- */
  r.post("/api/events/:id/rsvp", seeker, ctx => {
    const e = getEv(ctx.params.id); if (e.status !== "published") fail(404, "not_found");
    if (e.starts_at < now() - 3 * 3600e3) fail(409, "event_over");
    if (!db.get("SELECT 1 AS x FROM profiles WHERE user_id = ?", ctx.user.id)) fail(409, "profile_required");
    const cur = db.get("SELECT * FROM event_rsvps WHERE event_id = ? AND user_id = ?", e.id, ctx.user.id);
    if (cur && cur.status === "going") return { rsvp: { status: "going", code: cur.code } };
    if (e.capacity && going(e.id) >= e.capacity) fail(409, "event_full");
    let code = cur ? cur.code : newCode();
    for (let i = 0; !cur && i < 5 && db.get("SELECT 1 AS x FROM event_rsvps WHERE event_id = ? AND code = ?", e.id, code); i++) code = newCode();
    if (cur) db.run("UPDATE event_rsvps SET status = 'going', created_at = ? WHERE event_id = ? AND user_id = ?", now(), e.id, ctx.user.id);
    else db.run("INSERT INTO event_rsvps (event_id, user_id, code, created_at) VALUES (?, ?, ?, ?)", e.id, ctx.user.id, code, now());
    audit(ctx.user.id, "event.rsvp", "event", e.id, {});
    const d = J(e.data) || {}, when = (d.startsLocal || "").replace("T", " ");
    if (notify) notify.text(ctx.user, "event_rsvp", { title: { en: (d.title || {}).en || (d.title || {}).ar || "", ar: (d.title || {}).ar || (d.title || {}).en || "" }, when: { en: when, ar: when }, code: { en: code, ar: code } });
    return { rsvp: { status: "going", code } };
  });
  r.delete("/api/events/:id/rsvp", seeker, ctx => {
    db.run("UPDATE event_rsvps SET status = 'cancelled' WHERE event_id = ? AND user_id = ? AND checked_in_at IS NULL", Number(ctx.params.id), ctx.user.id);
    return { ok: true };
  });
  r.get("/api/me/events", seeker, ctx => ({ tickets: db.all("SELECT r.status, r.code, r.checked_in_at, e.* FROM event_rsvps r JOIN events e ON e.id = r.event_id WHERE r.user_id = ? AND r.status = 'going' ORDER BY e.starts_at", ctx.user.id)
    .map(e => out(e, { mine: { status: e.status === "published" ? "going" : "cancelled", code: e.code, checkedIn: !!e.checked_in_at } })) }));

  /* ---------- organisers: the Shaghilni team, or a career office for its own university ---------- */
  r.get("/api/organize/events", organiser, ctx => {
    const o = office(ctx), rows = o ? db.all("SELECT * FROM events WHERE uni = ? ORDER BY starts_at DESC", o.uni) : db.all("SELECT * FROM events ORDER BY starts_at DESC LIMIT 200");
    return { events: rows.map(e => out(e, { checkedIn: db.get("SELECT COUNT(*) AS n FROM event_rsvps WHERE event_id = ? AND checked_in_at IS NOT NULL", e.id).n,
      requests: db.get("SELECT COUNT(*) AS n FROM event_companies WHERE event_id = ? AND status = 'requested'", e.id).n })), uni: o ? o.uni : "" };
  });
  r.post("/api/organize/events", organiser, ctx => {
    const v = sanitize(ctx, ctx.body.event, true), status = ctx.body.publish ? "published" : "draft";
    const id = Number(db.run("INSERT INTO events (data, starts_at, status, uni, capacity, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", JSON.stringify(v.data), v.starts, status, v.uni, v.capacity, ctx.user.id, now(), now()).lastInsertRowid);
    audit(ctx.user.id, "event.created", "event", id, { status }); return { event: out(getEv(id)) };
  });
  r.put("/api/organize/events/:id", organiser, ctx => {
    const e = manage(ctx, ctx.params.id), v = sanitize(ctx, ctx.body.event, false);
    const status = ["draft", "published", "cancelled"].includes(ctx.body.status) ? ctx.body.status : e.status;
    db.run("UPDATE events SET data = ?, starts_at = ?, status = ?, uni = ?, capacity = ?, updated_at = ? WHERE id = ?", JSON.stringify(v.data), v.starts, status, v.uni, v.capacity, now(), e.id);
    audit(ctx.user.id, "event.updated", "event", e.id, { status }); return { event: out(getEv(e.id)) };
  });
  r.get("/api/organize/events/:id", organiser, ctx => {
    const e = manage(ctx, ctx.params.id);
    const people = db.all("SELECT r.user_id, r.code, r.status, r.checked_in_at, p.data AS p_data FROM event_rsvps r LEFT JOIN profiles p ON p.user_id = r.user_id WHERE r.event_id = ? ORDER BY r.created_at", e.id).map(x => {
      const p = J(x.p_data) || {}, ed = p.edu || {};
      return { name: { en: p.nameEn || p.name || "", ar: p.nameAr || p.name || "" }, uni: ed.uni || "", fac: ed.fac || "", year: Number(ed.year) || 0, status: x.status, checkedIn: !!x.checked_in_at, code: x.code };
    });
    const verified = ctx.user.role === "admin" ? db.all("SELECT id, data FROM companies WHERE status = 'verified' ORDER BY updated_at DESC LIMIT 300").map(c => ({ id: c.id, name: coName(c.data) })) : [];
    return { event: out(e, { companies: companiesOf(e.id, true) }), people, verified };
  });
  r.post("/api/organize/events/:id/companies", organiser, ctx => {
    const e = manage(ctx, ctx.params.id), cid = Number(ctx.body.companyId), st = ["confirmed", "declined", "removed"].includes(ctx.body.status) ? ctx.body.status : "confirmed";
    if (!db.get("SELECT 1 AS x FROM companies WHERE id = ? AND status = 'verified'", cid)) fail(404, "not_found");
    if (st === "removed") db.run("DELETE FROM event_companies WHERE event_id = ? AND company_id = ?", e.id, cid);
    else db.run("INSERT INTO event_companies (event_id, company_id, status, created_at) VALUES (?, ?, ?, ?) ON CONFLICT(event_id, company_id) DO UPDATE SET status = excluded.status", e.id, cid, st, now());
    audit(ctx.user.id, "event.company_" + st, "event", e.id, { company: cid }); return { ok: true };
  });
  r.post("/api/organize/events/:id/checkin", organiser, ctx => {
    const e = manage(ctx, ctx.params.id);
    // Accepts the short code, or what the ticket's QR code holds: "SHG-EV-<event>-<code>".
    const raw = core.latinDigits(String(ctx.body.code || "")).trim().toUpperCase(), m = /^SHG-EV-(\d+)-([A-Z0-9]{6})$/.exec(raw), code = m ? m[2] : raw.replace(/[^A-Z0-9]/g, "");   // latinDigits: Arabic-Indic digits are digits (U-045)
    if (m && Number(m[1]) !== e.id) fail(409, "wrong_event");
    const rs = db.get("SELECT r.*, p.data AS p_data FROM event_rsvps r LEFT JOIN profiles p ON p.user_id = r.user_id WHERE r.event_id = ? AND r.code = ?", e.id, code);
    if (!rs) fail(404, "ticket_not_found");
    const p = J(rs.p_data) || {}, who = { name: { en: p.nameEn || p.name || "", ar: p.nameAr || p.name || "" }, uni: (p.edu || {}).uni || "", fac: (p.edu || {}).fac || "" };
    if (rs.status !== "going") fail(409, "ticket_cancelled", who);
    if (rs.checked_in_at) return { already: true, person: who, at: rs.checked_in_at };
    db.run("UPDATE event_rsvps SET checked_in_at = ?, checked_in_by = ? WHERE event_id = ? AND user_id = ?", now(), ctx.user.id, e.id, rs.user_id);
    audit(ctx.user.id, "event.checkin", "event", e.id, {}); return { already: false, person: who };
  });
  r.get("/api/organize/events/:id/report", organiser, ctx => {
    const e = manage(ctx, ctx.params.id);
    const rs = db.all("SELECT r.user_id, r.status, r.checked_in_at, p.data AS p_data FROM event_rsvps r LEFT JOIN profiles p ON p.user_id = r.user_id WHERE r.event_id = ?", e.id);
    const came = rs.filter(x => x.checked_in_at), ids = came.map(x => x.user_id), ph = ids.map(() => "?").join(",") || "NULL";
    const tally = key => { const m = new Map(); for (const x of came) { const k = ((J(x.p_data) || {}).edu || {})[key] || ""; m.set(k, (m.get(k) || 0) + 1); } return [...m].map(([k, n]) => ({ key: k, n })).sort((a, b) => b.n - a.n); };
    const companies = companiesOf(e.id).map(c => ({ name: c.name,
      invites: ids.length ? db.get(/* sql-safe: only "?" placeholders */ `SELECT COUNT(*) AS n FROM invitations WHERE company_id = ? AND created_at >= ? AND user_id IN (${ph})`, c.id, e.starts_at - 7 * 86400e3, ...ids).n : 0,
      applications: ids.length ? db.get(/* sql-safe: only "?" placeholders */ `SELECT COUNT(*) AS n FROM applications a JOIN jobs j ON j.id = a.job_id WHERE j.company_id = ? AND a.created_at >= ? AND a.user_id IN (${ph})`, c.id, e.starts_at - 7 * 86400e3, ...ids).n : 0,
      interviews: ids.length ? db.get(/* sql-safe: only "?" placeholders */ `SELECT COUNT(*) AS n FROM applications a JOIN jobs j ON j.id = a.job_id WHERE j.company_id = ? AND a.created_at >= ? AND a.status IN ('interview', 'hired') AND a.user_id IN (${ph})`, c.id, e.starts_at - 7 * 86400e3, ...ids).n : 0,
      hires: ids.length ? db.get(/* sql-safe: only "?" placeholders */ `SELECT COUNT(*) AS n FROM applications a JOIN jobs j ON j.id = a.job_id WHERE j.company_id = ? AND a.created_at >= ? AND a.hire_confirmed_at IS NOT NULL AND a.user_id IN (${ph})`, c.id, e.starts_at - 7 * 86400e3, ...ids).n : 0 }));
    return { event: out(e), totals: { registered: rs.filter(x => x.status === "going").length, cancelled: rs.filter(x => x.status === "cancelled").length, checkedIn: came.length },
      byUni: tally("uni"), byFac: tally("fac"), companies };
  });

  /* ---------- companies: see events and ask to attend ---------- */
  r.get("/api/employer/events", employer, ctx => {
    const c = plans.companyFor(ctx.user); if (!c || c.status !== "verified") fail(409, "company_not_verified");
    const mine = new Map(db.all("SELECT event_id, status FROM event_companies WHERE company_id = ?", c.id).map(x => [x.event_id, x.status]));
    return { events: db.all("SELECT * FROM events WHERE status = 'published' AND starts_at > ? ORDER BY starts_at LIMIT 50", now() - 6 * 3600e3).map(e => out(e, { mine: mine.get(e.id) || null })) };
  });
  r.post("/api/employer/events/:id/attend", employer, ctx => {
    const c = plans.companyFor(ctx.user); if (!c || c.status !== "verified") fail(409, "company_not_verified"); plans.allow(ctx, c, "hire");
    const e = getEv(ctx.params.id); if (e.status !== "published") fail(404, "not_found");
    const cur = db.get("SELECT status FROM event_companies WHERE event_id = ? AND company_id = ?", e.id, c.id);
    if (cur && cur.status !== "declined") return { status: cur.status };
    db.run("INSERT INTO event_companies (event_id, company_id, status, created_at) VALUES (?, ?, 'requested', ?) ON CONFLICT(event_id, company_id) DO UPDATE SET status = 'requested'", e.id, c.id, now());
    audit(ctx.user.id, "event.company_requested", "event", e.id, { company: c.id }); return { status: "requested" };
  });
}
/* For candidate search: the people a confirmed company will meet at an event (only those who let recruiters find them). */
export function attendeesFor(db, eventId, companyId) {
  if (!db.get("SELECT 1 AS x FROM event_companies WHERE event_id = ? AND company_id = ? AND status = 'confirmed'", Number(eventId), companyId)) return null;
  return new Set(db.all("SELECT user_id FROM event_rsvps WHERE event_id = ? AND status = 'going'", Number(eventId)).map(x => x.user_id));
}
