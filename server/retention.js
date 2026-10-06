/* Deletes data once it is no longer needed. Runs at start-up and every hour. The periods here are the
   ones promised in the privacy notice: keep the two in step. */
import { now } from "./db.js";

export const RETENTION = { otpHours: 24, notificationDays: 90, usageDays: 60, trafficDays: 180 };

export function cleanup(db) {
  const t = now();
  return {
    otps: db.run("DELETE FROM otps WHERE created_at < ?", t - RETENTION.otpHours * 3600e3).changes,
    emailCodes: db.run("DELETE FROM email_codes WHERE created_at < ?", t - RETENTION.otpHours * 3600e3).changes,   // university email codes, with the typed address, like sign-in codes (U-035)
    studentEmails: db.run("UPDATE student_verifications SET email = NULL WHERE status = 'withdrawn' AND email IS NOT NULL").changes,   // the address is kept only while it verifies an account
    sessions: db.run("DELETE FROM sessions WHERE expires_at < ?", t).changes,
    notifications: db.run("DELETE FROM notifications WHERE created_at < ?", t - RETENTION.notificationDays * 86400e3).changes,
    usage: db.run("DELETE FROM usage WHERE day < ?", new Date(t - RETENTION.usageDays * 86400e3).toISOString().slice(0, 10)).changes,
    traffic: db.run("DELETE FROM pageviews WHERE at < ?", t - RETENTION.trafficDays * 86400e3).changes + db.run("DELETE FROM shares WHERE at < ?", t - RETENTION.trafficDays * 86400e3).changes
      + db.run("DELETE FROM client_errors WHERE at < ?", t - RETENTION.trafficDays * 86400e3).changes
  };
}
