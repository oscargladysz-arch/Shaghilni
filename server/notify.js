/* Text-message notifications to job seekers when an employer moves their application. Queued in the
   database first, so failures are visible to the admin instead of silently lost. */
import { now } from "./db.js";
import { mask } from "./guard.js";

const TEXT = {
  shortlisted: { en: "Shaghilni: {co} shortlisted you for {title}. They may contact you on this number.",
                 ar: "شغّلني: {co} حطّتك بالقائمة القصيرة لوظيفة {title}. ممكن يحكوك على هالرقم." },
  interview:   { en: "Shaghilni: {co} would like to interview you for {title}. Expect a call or WhatsApp message from them.",
                 ar: "شغّلني: ترغب {co} بإجراء مقابلة معك لوظيفة {title}. انتظر اتصالاً أو رسالة واتساب منهم." },
  hired:       { en: "Shaghilni: Congratulations. {co} marked you as hired for {title}.",
                 ar: "شغّلني: مبروك! سجّلتك {co} موظفاً في وظيفة {title}." },
  rejected:    { en: "Shaghilni: {co} has moved ahead with other candidates for {title}. New jobs are added every week.",
                 ar: "شغّلني: اختارت {co} مرشحين آخرين لوظيفة {title}. تُضاف وظائف جديدة كل أسبوع." }
,
  invite_job:  { en: "Shaghilni: {co} invited you to apply for {title}. Open Shaghilni to reply.",
                 ar: "شغّلني: دعتك {co} للتقديم على وظيفة {title}. افتح شغّلني للرد." },
  event_rsvp: { en: "Shaghilni: you're going to {title} on {when}. Your ticket code is {code}. Show it at the door.",
                ar: "شغّلني: سجّلت لحضور {title} بتاريخ {when}. رمز تذكرتك {code}، فرجيه عالباب." },
  team_invite: { en: "Shaghilni: {by} invited you to join {co} as {role}. Sign in with this number to accept.",
                 ar: "شغّلني: {by} عزمك تنضم لـ{co} بصفة {role}. فوت بهالرقم لتقبل." },
  team_request: { en: "Shaghilni: {name} asked to join {co}. Open your team page to approve or decline.",
                  ar: "شغّلني: {name} بدّه ينضم لـ{co}. فوت على صفحة الفريق لتوافق أو ترفض." },
  team_approved: { en: "Shaghilni: you've joined {co} as {role}. Sign in to start.", ar: "شغّلني: صرت بفريق {co} بصفة {role}. فوت لتبلّش." },
  team_declined: { en: "Shaghilni: {co} didn't approve your request to join.", ar: "شغّلني: {co} ما وافقت على طلب انضمامك." },
  student_verified: { en: "Shaghilni: {uni} has verified you as its student. Employers now see the badge on your profile.",
                      ar: "شغّلني: {uni} أكّدت إنك من طلابها. هلّق الشركات بتشوف الشارة على ملفك." },
  student_verify_declined: { en: "Shaghilni: {uni} couldn't verify you as its student. Check your student number in your profile and ask again.",
                             ar: "شغّلني: {uni} ما قدرت تأكّد إنك من طلابها. جرّب مرة تانية من ملفك." },
  alert_digest: { en: "Shaghilni: {n} new jobs for your alert ({what}). See them: {link}",
                  ar: "شغّلني: في {n} وظائف جديدة لتنبيهك ({what}). شوفها: {link}" },
  invite_event: { en: "Shaghilni: {co} invited you to {title} on {date}. Open Shaghilni to reply.",
                  ar: "شغّلني: {co} عزمتك على {title} بتاريخ {date}. فوت على شغّلني لترد." }
};

export function makeNotifier({ db, sms, log, guard }) {
  function send(user, tpl, vars) {
    if (!tpl || !user || !user.phone || user.phone.startsWith("deleted:")) return;
    const lang = user.lang === "en" ? "en" : "ar";
    const body = tpl[lang].replace(/\{(\w+)\}/g, (_, k) => (vars[k] && (vars[k][lang] || vars[k].en || vars[k].ar)) || "");
    // Same guards as sign-in texts: allowed countries only, and nothing once today's cap is reached.
    const blocked = !guard.smsAllowed(user.phone) ? "blocked: destination not allowed" : guard.smsCapReached() ? "blocked: daily text cap reached"
      : guard.intlCapReached(user.phone) ? "blocked: daily international text cap reached" : "";
    if (!blocked) guard.countIntl(user.phone);
    const r = db.run("INSERT INTO notifications (user_id, phone, body, status, error, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      user.id, user.phone, body, blocked ? "failed" : "queued", blocked || null, now());
    if (blocked) return;
    const id = Number(r.lastInsertRowid);
    sms(user.phone, body)
      .then(() => db.run("UPDATE notifications SET status = 'sent', sent_at = ? WHERE id = ?", now(), id))
      .catch(err => { log(`[notify] text to ${mask(user.phone)} failed: ${err.message}`); db.run("UPDATE notifications SET status = 'failed', error = ? WHERE id = ?", String(err.message).slice(0, 300), id); });
  }
  const notifyStatus = (user, status, vars) => send(user, TEXT[status], vars);
  notifyStatus.text = (user, key, vars) => send(user, TEXT[key], vars);   // any other template, same guards
  return notifyStatus;
}
