/* Abuse and cost guards: which countries sign-in texts may go to, daily caps on texts and AI calls,
   and phone masking for logs. Counters live in the database, so they survive restarts. */
export const dayKey = (t = Date.now()) => new Date(t).toISOString().slice(0, 10);
export const mask = phone => { const s = String(phone || ""); return s.length > 7 ? `${s.slice(0, 5)}•••${s.slice(-3)}` : "•••"; };

export function makeGuard({ db, cfg, log }) {
  const midnight = () => { const d = new Date(); d.setUTCHours(0, 0, 0, 0); return d.getTime(); };
  let warnedDay = "";
  const guard = {
    /* Texts go only to allowed country codes (Syria by default), which blocks international SMS-pumping fraud.
       Admin numbers are always allowed so founders abroad can sign in. */
    smsAllowed(phone) {
      const p = String(phone || "");
      return cfg.adminPhones.includes(p) || !cfg.smsAllowedPrefixes.length || cfg.smsAllowedPrefixes.some(x => p.startsWith(x));
    },
    smsSentToday() {
      const t = midnight();
      return db.get("SELECT COUNT(*) AS n FROM otps WHERE created_at >= ?", t).n
        + db.get("SELECT COUNT(*) AS n FROM notifications WHERE created_at >= ? AND status != 'failed'", t).n;
    },
    smsCapReached() {
      const hit = guard.smsSentToday() >= cfg.smsDailyCap;
      if (hit && warnedDay !== dayKey()) { warnedDay = dayKey(); log(`[guard] daily text cap of ${cfg.smsDailyCap} reached; texts pause until 00:00 UTC`); }
      return hit;
    },
    /* International texts: allowed countries only, and at most smsIntlDailyCap a day in total. */
    intlCapReached(phone) {
      const p = String(phone || "");
      if (p.startsWith("+963") || cfg.adminPhones.includes(p)) return false;
      return guard.usage("sms-intl") >= cfg.smsIntlDailyCap;
    },
    countIntl(phone) { const p = String(phone || ""); if (!p.startsWith("+963") && !cfg.adminPhones.includes(p)) guard.bump("sms-intl"); },
    usage(kind) { const r = db.get("SELECT n FROM usage WHERE day = ? AND kind = ?", dayKey(), kind); return r ? r.n : 0; },
    bump(kind) { db.run("INSERT INTO usage (day, kind, n) VALUES (?, ?, 1) ON CONFLICT(day, kind) DO UPDATE SET n = n + 1", dayKey(), kind); }
  };
  return guard;
}
