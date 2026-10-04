/* Insights for the Shaghilni team: how the platform is doing, in totals only (no one's personal details).
   Sample listings and demo accounts are left out unless asked for, so the numbers show real activity. */
import { fail } from "../http.js";
import { J, now } from "../db.js";

const DAY = 86400e3, WEEK = 7 * DAY;
export function registerInsights(r, deps) {
  const { db, cfg, auth } = deps, admin = auth.need("admin");
  r.get("/api/admin/insights", admin, ctx => {
    const days = [7, 30, 90, 365].includes(Number(ctx.query.get("days"))) ? Number(ctx.query.get("days")) : 30;
    const sample = ctx.query.get("sample") === "1", t = now(), since = t - days * DAY, prev = since - days * DAY;
    // What counts as real: not sample listings or their companies, not demo accounts, not the admin team.
    const demoPhones = sample ? [] : (cfg.demoPhones || []);
    const ph = demoPhones.map(() => "?").join(",") || "''";
    const U = sample ? "u.role != 'admin'" : /* sql-safe: only "?" placeholders */ `u.role != 'admin' AND u.phone NOT IN (${ph})`;
    const Jf = sample ? "1 = 1" : "j.is_demo = 0", Cf = sample ? "1 = 1" : "c.is_demo = 0";
    const P = demoPhones, n = (sql, ...a) => db.get(sql, ...a).n;
    const users = (extra = "1 = 1", ...a) => n(/* sql-safe: fixed fragments and "?" placeholders only */ `SELECT COUNT(*) AS n FROM users u WHERE u.deleted_at IS NULL AND ${U} AND ${extra}`, ...P, ...a);
    const apps = (extra = "1 = 1", ...a) => n(/* sql-safe: fixed fragments and "?" placeholders only */ `SELECT COUNT(*) AS n FROM applications a JOIN jobs j ON j.id = a.job_id JOIN users u ON u.id = a.user_id WHERE ${Jf} AND ${U} AND ${extra}`, ...P, ...a);
    const jobs = (extra = "1 = 1", ...a) => n(/* sql-safe: fixed fragments and "?" placeholders only */ `SELECT COUNT(*) AS n FROM jobs j WHERE ${Jf} AND ${extra}`, ...a);
    const cos = (extra = "1 = 1", ...a) => n(/* sql-safe: fixed fragments and "?" placeholders only */ `SELECT COUNT(*) AS n FROM companies c WHERE ${Cf} AND ${extra}`, ...a);
    const delta = (cur, before) => ({ now: cur, before, change: before ? Math.round((cur - before) / before * 100) : null });
    // job seekers' profiles, for breakdowns
    const profs = db.all(/* sql-safe: fixed fragments and "?" placeholders only */ `SELECT p.data, u.last_login_at FROM profiles p JOIN users u ON u.id = p.user_id WHERE u.deleted_at IS NULL AND u.role = 'seeker' AND ${U}`, ...P).map(x => ({ p: J(x.data) || {}, last: x.last_login_at }));
    const verifiedStudents = n(/* sql-safe: fixed fragments and "?" placeholders only */ `SELECT COUNT(DISTINCT v.user_id) AS n FROM student_verifications v JOIN users u ON u.id = v.user_id WHERE v.status = 'verified' AND u.deleted_at IS NULL AND ${U}`, ...P);
    const published = db.all(/* sql-safe: fixed fragments and "?" placeholders only */ `SELECT j.id, j.data, j.sponsored_until FROM jobs j WHERE j.status = 'published' AND ${Jf}`).map(x => ({ id: x.id, d: J(x.data) || {}, spon: x.sponsored_until > t }));
    const appsPerJob = new Map(db.all(/* sql-safe: fixed fragments and "?" placeholders only */ `SELECT a.job_id, COUNT(*) AS n FROM applications a JOIN users u ON u.id = a.user_id WHERE a.status != 'withdrawn' AND ${U} GROUP BY a.job_id`, ...P).map(x => [x.job_id, x.n]));
    const tally = (list, key) => { const m = new Map(); for (const x of list) { const k = key(x) || ""; m.set(k, (m.get(k) || 0) + 1); } return [...m].map(([k, v]) => ({ key: k, n: v })).sort((a, b) => b.n - a.n); };
    const byStatus = (table, f) => Object.fromEntries(db.all(/* sql-safe: fixed fragments and "?" placeholders only */ `SELECT status, COUNT(*) AS n FROM ${table} WHERE ${f} GROUP BY status`).map(x => [x.status, x.n]));
    const funnel = Object.fromEntries(db.all(/* sql-safe: fixed fragments and "?" placeholders only */ `SELECT a.status, COUNT(*) AS n FROM applications a JOIN jobs j ON j.id = a.job_id JOIN users u ON u.id = a.user_id WHERE ${Jf} AND ${U} GROUP BY a.status`, ...P).map(x => [x.status, x.n]));
    const oldApps = apps("a.created_at < ? AND a.status != 'withdrawn'", t - 7 * DAY), answered = apps("a.created_at < ? AND a.status NOT IN ('new', 'withdrawn')", t - 7 * DAY);
    const weeks = []; const start = t + 1 - 12 * WEEK;
    for (let i = 0; i < 12; i++) { const a = start + i * WEEK, b = a + WEEK;
      weeks.push({ from: a, users: users("u.created_at >= ? AND u.created_at < ?", a, b), jobs: jobs("j.published_at >= ? AND j.published_at < ?", a, b),
        applications: apps("a.created_at >= ? AND a.created_at < ?", a, b), hires: apps("a.hire_confirmed_at >= ? AND a.hire_confirmed_at < ?", a, b) }); }
    const money = (kind, status, col, from) => db.get(/* sql-safe: fixed fragments and "?" placeholders only */ `SELECT COALESCE(SUM(${col}), 0) AS s FROM charges WHERE status = ? ${kind ? "AND kind = ?" : ""} ${from ? "AND COALESCE(paid_at, created_at) >= ?" : ""}`, ...[status, ...(kind ? [kind] : []), ...(from ? [from] : [])]).s;
    const evF = sample ? "1 = 1" : "COALESCE(json_extract(e.data, '$.demo'), 0) != 1";
    const evIds = db.all(/* sql-safe: fixed fragments and "?" placeholders only */ `SELECT e.id, e.starts_at FROM events e WHERE e.status = 'published' AND ${evF}`).map(x => x);
    const evIn = evIds.map(e => e.id), eph = evIn.map(() => "?").join(",") || "NULL";
    return {
      period: { days, since, sample },
      headline: {
        confirmedHiresAllTime: apps("a.hire_confirmed_at IS NOT NULL"),
        users: users(), newUsers: delta(users("u.created_at >= ?", since), users("u.created_at >= ? AND u.created_at < ?", prev, since)),
        activeWeek: users("u.last_login_at >= ?", t - 7 * DAY), activeMonth: users("u.last_login_at >= ?", t - 30 * DAY),
        liveJobs: published.length, newJobs: delta(jobs("j.published_at >= ?", since), jobs("j.published_at >= ? AND j.published_at < ?", prev, since)),
        applications: delta(apps("a.created_at >= ?", since), apps("a.created_at >= ? AND a.created_at < ?", prev, since)),
        confirmedHires: delta(apps("a.hire_confirmed_at >= ?", since), apps("a.hire_confirmed_at >= ? AND a.hire_confirmed_at < ?", prev, since)),
        verifiedCompanies: cos("c.status = 'verified'"),
        paidSyp: money(null, "paid", "amount_syp", since), paidUsd: money(null, "paid", "amount_usd", since) },
      attention: { companies: cos("c.status = 'pending'"), jobs: jobs("j.status = 'pending'"), hires: apps("a.status = 'hired' AND a.hire_confirmed_at IS NULL"),
        planRequests: n("SELECT COUNT(*) AS n FROM plan_requests WHERE handled_at IS NULL"), chargesDue: n("SELECT COUNT(*) AS n FROM charges WHERE status = 'due'"),
        failedTexts: n("SELECT COUNT(*) AS n FROM notifications WHERE status = 'failed' AND created_at >= ?", t - 7 * DAY) },
      weeks,
      users: { seekers: users("u.role = 'seeker'"), employers: users("u.role = 'employer'"), careerOffices: users("u.role = 'university'"),
        withProfile: profs.length, students: profs.filter(x => (x.p.edu || {}).status === "student").length, graduatesAndWorkers: profs.filter(x => (x.p.edu || {}).status !== "student").length,
        abroad: profs.filter(x => x.p.gov === "abroad").length, openToRecruiters: profs.filter(x => x.p.recruit && x.p.recruit.open).length,
        verifiedStudents, deletedInPeriod: n(/* sql-safe: fixed fragments and "?" placeholders only */ `SELECT COUNT(*) AS n FROM users u WHERE u.deleted_at >= ? AND ${U}`, since, ...P),
        byGovernorate: tally(profs, x => x.p.gov).slice(0, 8), byUniversity: tally(profs.filter(x => (x.p.edu || {}).uni), x => x.p.edu.uni).slice(0, 8) },
      jobs: { byStatus: byStatus("jobs j", Jf), byType: tally(published, x => x.d.type), byGovernorate: tally(published, x => x.d.gov).slice(0, 8),
        withoutApplicants: published.filter(x => !appsPerJob.get(x.id)).length, applicantsPerJob: published.length ? Math.round(published.reduce((s, x) => s + (appsPerJob.get(x.id) || 0), 0) / published.length * 10) / 10 : 0,
        sponsored: published.filter(x => x.spon).length, internships: published.filter(x => x.d.type === "intern").length },
      hiring: { funnel, answeredRate: oldApps ? Math.round(answered / oldApps * 100) : null,
        byChannel: Object.fromEntries(db.all(/* sql-safe: fixed fragments and "?" placeholders only */ `SELECT a.channel, COUNT(*) AS n FROM applications a JOIN jobs j ON j.id = a.job_id JOIN users u ON u.id = a.user_id WHERE ${Jf} AND ${U} GROUP BY a.channel`, ...P).map(x => [x.channel || "web", x.n])),
        confirmedInternships: apps("a.hire_confirmed_at IS NOT NULL AND json_extract(j.data, '$.type') = 'intern'") },
      companies: { byStatus: byStatus("companies c", Cf), byPlan: Object.fromEntries(db.all(/* sql-safe: fixed fragments and "?" placeholders only */ `SELECT c.plan, COUNT(*) AS n FROM companies c WHERE c.status = 'verified' AND ${Cf} GROUP BY c.plan`).map(x => [x.plan || "free", x.n])),
        byKind: tally(db.all(/* sql-safe: fixed fragments and "?" placeholders only */ `SELECT c.data FROM companies c WHERE c.status = 'verified' AND ${Cf}`).map(x => J(x.data) || {}), d => d.cat),
        teamMembers: n(/* sql-safe: fixed fragments and "?" placeholders only */ `SELECT COUNT(*) AS n FROM company_members m JOIN companies c ON c.id = m.company_id WHERE m.status = 'active' AND ${Cf}`),
        withTeams: n(/* sql-safe: fixed fragments and "?" placeholders only */ `SELECT COUNT(DISTINCT m.company_id) AS n FROM company_members m JOIN companies c ON c.id = m.company_id WHERE m.status = 'active' AND ${Cf}`) },
      campus: { careerOffices: n("SELECT COUNT(*) AS n FROM campus_offices"), universitiesWithEmail: n("SELECT COUNT(DISTINCT uni) AS n FROM uni_domains"), verifiedStudents,
        partners: n(/* sql-safe: fixed fragments and "?" placeholders only */ `SELECT COUNT(*) AS n FROM uni_partners x JOIN companies c ON c.id = x.company_id WHERE x.status = 'approved' AND ${Cf}`),
        eventsUpcoming: evIds.filter(e => e.starts_at > t).length, eventsPast: evIds.filter(e => e.starts_at <= t).length,
        signUps: n(/* sql-safe: fixed fragments and "?" placeholders only */ `SELECT COUNT(*) AS n FROM event_rsvps WHERE status = 'going' AND event_id IN (${eph})`, ...evIn), checkIns: n(/* sql-safe: fixed fragments and "?" placeholders only */ `SELECT COUNT(*) AS n FROM event_rsvps WHERE checked_in_at IS NOT NULL AND event_id IN (${eph})`, ...evIn) },
      money: { paidSyp: money(null, "paid", "amount_syp", since), paidUsd: money(null, "paid", "amount_usd", since), dueSyp: money(null, "due", "amount_syp"), dueUsd: money(null, "due", "amount_usd"),
        byKind: ["plan", "hire_fee", "placement"].map(k => ({ kind: k, paidSyp: money(k, "paid", "amount_syp", since), paidUsd: money(k, "paid", "amount_usd", since), dueSyp: money(k, "due", "amount_syp"), dueUsd: money(k, "due", "amount_usd") })),
        cardPayments: n("SELECT COUNT(*) AS n FROM payments WHERE status = 'paid' AND paid_at >= ?", since) },
      messages: { textsSent: n("SELECT COUNT(*) AS n FROM notifications WHERE status = 'sent' AND created_at >= ?", since), textsFailed: n("SELECT COUNT(*) AS n FROM notifications WHERE status = 'failed' AND created_at >= ?", since),
        verificationEmails: n("SELECT COUNT(*) AS n FROM email_sends WHERE sent_at >= ?", since),
        invitations: n(/* sql-safe: fixed fragments and "?" placeholders only */ `SELECT COUNT(*) AS n FROM invitations i JOIN companies c ON c.id = i.company_id WHERE i.created_at >= ? AND ${Cf}`, since),
        jobAlerts: n(/* sql-safe: fixed fragments and "?" placeholders only */ `SELECT COUNT(*) AS n FROM alerts al JOIN users u ON u.id = al.user_id WHERE u.deleted_at IS NULL AND ${U}`, ...P) }
    };
  });
}
