/* Job alerts. People save a search; when new jobs that match go live, they hear about it at most about once a day,
   by email (through any email-sending service with a simple HTTP API) or by text, and always inside the app.
   Texts go through the same notifier, so the country list and the daily caps apply. */
import { fail } from "./http.js";
import { J, now } from "./db.js";
import { getPublished } from "./routes/public.js";
import { sanitizeAlert } from "./validate.js";

const DAY = 86400e3;
export function makeEmail(cfg, log) {
  if (!(cfg.emailApiUrl && cfg.emailApiKey && cfg.emailFrom)) return null;
  return async (to, subject, text) => {
    const res = await fetch(cfg.emailApiUrl, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${cfg.emailApiKey}` },
      body: JSON.stringify({ from: cfg.emailFrom, to, subject, text }) });
    if (!res.ok) throw new Error(`email ${res.status}`);
  };
}
export function makeAlerts({ db, cfg, core, notify, email, log }) {
  const matchingSince = (crit, since, max = 500) => db.all("SELECT id FROM jobs WHERE status = 'published' AND published_at > ? ORDER BY published_at DESC LIMIT ?", since, max)
    .map(r => getPublished(db, r.id)).filter(j => j && core.alertMatches(crit, j));
  const liteLink = crit => { const q = new URLSearchParams(); if (crit.q) q.set("q", crit.q); if (crit.gov) q.set("gov", crit.gov); if (crit.type) q.set("type", crit.type); if (crit.tab === "intern") q.set("type", "intern"); if (crit.tab === "returnees") q.set("returnees", "1"); const s = q.toString(); return `${cfg.baseUrl || ""}/lite${s ? "?" + s : ""}`; };
  async function run(t = now()) {
    const rows = db.all(`SELECT a.*, u.phone, u.lang, u.deleted_at, p.data AS p_data FROM alerts a JOIN users u ON u.id = a.user_id LEFT JOIN profiles p ON p.user_id = a.user_id WHERE a.channel != 'app'`);
    let sent = 0;
    for (const a of rows) {
      if (a.deleted_at || (a.last_sent_at && t - a.last_sent_at < DAY * 0.8)) continue;
      const crit = J(a.data) || {}, jobs = matchingSince(crit, a.last_sent_at || a.created_at, 200).slice(0, 10);
      if (!jobs.length) continue;
      const lang = a.lang === "en" ? "en" : "ar", prof = J(a.p_data) || {}, link = liteLink(crit);
      try {
        if (a.channel === "email") {
          if (!email || !prof.email) continue;
          const lines = jobs.map(j => `- ${(j.title && (j.title[lang] || j.title.en || j.title.ar)) || ""}, ${(j.co && (j.co[lang] || j.co.en || j.co.ar)) || ""}\n  ${cfg.baseUrl || ""}/lite/job/${j.id}`).join("\n");
          const subject = lang === "ar" ? `وظائف جديدة لتنبيهك على شغّلني: ${core.alertLabel(crit, "ar")}` : `New jobs for your Shaghilni alert: ${core.alertLabel(crit, "en")}`;
          const intro = lang === "ar" ? `وجدنا ${jobs.length} وظائف جديدة تطابق تنبيهك.` : `We found ${jobs.length} new jobs that match your alert.`;
          const outro = lang === "ar" ? `كل الوظائف المطابقة: ${link}\n\nلإيقاف هذه الرسائل، احذف التنبيه من صفحة التنبيهات في شغّلني.` : `All matching jobs: ${link}\n\nTo stop these emails, delete the alert on the Alerts page in Shaghilni.`;
          await email(prof.email, subject, `${intro}\n\n${lines}\n\n${outro}`);
        } else if (a.channel === "sms") {
          const n = String(jobs.length);
          notify.text({ id: a.user_id, phone: a.phone, lang: a.lang }, "alert_digest", { n: { en: n, ar: n }, what: { en: core.alertLabel(crit, "en"), ar: core.alertLabel(crit, "ar") }, link: { en: link, ar: link } });
        }
        db.run("UPDATE alerts SET last_sent_at = ? WHERE id = ?", t, a.id); sent++;
      } catch (err) { log(`[alerts] alert ${a.id} failed: ${err.message}`); }
    }
    return { sent };
  }
  function register(r, { auth, audit, guard }) {
    const seeker = auth.need("seeker");
    const out = a => ({ id: a.id, ...(J(a.data) || {}), channel: a.channel, createdAt: a.created_at });
    const newCount = a => matchingSince(J(a.data) || {}, a.seen_at || a.created_at).length;
    r.get("/api/me/alerts", seeker, ctx => {
      const rows = db.all("SELECT * FROM alerts WHERE user_id = ? ORDER BY created_at", ctx.user.id);
      return { alerts: rows.map(a => ({ ...out(a), newCount: newCount(a) })), emailOn: !!email, textOk: guard.smsAllowed(ctx.user.phone) };
    });
    const channelOf = (ctx, want) => {
      if (want === "email" && email) return "email";
      if (want === "sms" && guard.smsAllowed(ctx.user.phone)) return "sms";
      return "app";
    };
    r.post("/api/me/alerts", seeker, ctx => {
      const crit = sanitizeAlert(core, ctx.body.alert), rows = db.all("SELECT data FROM alerts WHERE user_id = ?", ctx.user.id);
      if (rows.length >= 5) fail(409, "alert_limit");
      if (rows.some(x => JSON.stringify(J(x.data)) === JSON.stringify(crit))) fail(409, "alert_exists");
      const channel = channelOf(ctx, ctx.body.channel);
      const id = Number(db.run("INSERT INTO alerts (user_id, data, channel, created_at, seen_at) VALUES (?, ?, ?, ?, ?)", ctx.user.id, JSON.stringify(crit), channel, now(), now()).lastInsertRowid);
      audit(ctx.user.id, "alert.created", "alert", id, { channel });
      return { alert: { id, ...crit, channel, newCount: 0 } };
    });
    r.put("/api/me/alerts/:id", seeker, ctx => {
      const a = db.get("SELECT * FROM alerts WHERE id = ? AND user_id = ?", Number(ctx.params.id), ctx.user.id); if (!a) fail(404, "not_found");
      const channel = channelOf(ctx, ctx.body.channel); db.run("UPDATE alerts SET channel = ? WHERE id = ?", channel, a.id); return { alert: { ...out(a), channel } };
    });
    r.delete("/api/me/alerts/:id", seeker, ctx => {
      const n = db.run("DELETE FROM alerts WHERE id = ? AND user_id = ?", Number(ctx.params.id), ctx.user.id).changes; if (!n) fail(404, "not_found"); return { ok: true };
    });
    r.post("/api/me/alerts/seen", seeker, ctx => { db.run("UPDATE alerts SET seen_at = ? WHERE user_id = ?", now(), ctx.user.id); return { ok: true }; });
  }
  const unseen = userId => db.all("SELECT * FROM alerts WHERE user_id = ?", userId).reduce((n, a) => n + matchingSince(J(a.data) || {}, a.seen_at || a.created_at, 200).length, 0);
  return { run, register, unseen };
}
