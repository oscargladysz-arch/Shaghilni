/* Phone sign-in with one-time codes, a proof-of-work challenge against automated abuse, and cookie sessions. */
import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { fail } from "./http.js";
import { now } from "./db.js";
import { e164 } from "./validate.js";
import { TERMS_VERSION } from "./config.js";
import { mask } from "./guard.js";

const COOKIE = "shg_sid";
const POW_TTL = 5 * 60e3;
const sha = s => createHash("sha256").update(s).digest("hex");
export function leadingZeroBits(buf) {
  let n = 0;
  for (const b of buf) { if (b === 0) { n += 8; continue; } return n + Math.clz32(b) - 24; }
  return n;
}

export function makeAuth({ db, cfg, core, sms, limit, audit, log, guard }) {
  const codeHash = (phone, code) => sha(`${cfg.otpPepper}:${phone}:${code}`);
  const cookie = (value, maxAgeSec) =>
    `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSec}${cfg.prod ? "; Secure" : ""}`;
  const publicUser = u => ({ id: u.id, phone: u.phone, role: u.role, lang: u.lang, termsVersion: u.terms_version || null });

  /* Proof of work: before a text is sent, the browser must find a number whose hash with a server-signed
     challenge starts with `powBits` zero bits. A phone needs a fraction of a second; a script sending
     thousands of requests pays for every one. No third party, no puzzle for people, works offline. */
  const usedPow = new Map();
  const powSig = (exp, salt) => createHmac("sha256", cfg.otpPepper).update(`pow:${exp}.${salt}.${cfg.powBits}`).digest("hex").slice(0, 16);
  function challenge(ctx, { count = true } = {}) {   // count: false for a challenge embedded in a Lite page view; the API route always counts (D-24)
    if (count && !limit(`pow-ip:${ctx.ip}`, 60, 600e3)) fail(429, "rate_limited");
    const exp = (Date.now() + POW_TTL).toString(36), salt = randomBytes(6).toString("hex");
    return { challenge: `${exp}.${salt}.${powSig(exp, salt)}`, bits: cfg.powBits };
  }
  function checkPow(pow) {
    if (!cfg.powBits) return;
    if (!pow || typeof pow !== "object" || typeof pow.challenge !== "string" || !/^\d{1,10}$/.test(String(pow.nonce ?? ""))) fail(400, "pow_required");
    const parts = pow.challenge.split(".");
    if (parts.length !== 3 || !/^[0-9a-z]{1,12}$/.test(parts[0]) || !/^[0-9a-f]{12}$/.test(parts[1]) || !/^[0-9a-f]{16}$/.test(parts[2])) fail(400, "pow_invalid");
    const [exp, salt, sig] = parts;
    if (!timingSafeEqual(Buffer.from(powSig(exp, salt)), Buffer.from(sig))) fail(400, "pow_invalid");
    const expMs = parseInt(exp, 36);
    if (!(expMs > Date.now()) || usedPow.has(pow.challenge)) fail(400, "pow_invalid");
    if (leadingZeroBits(createHash("sha256").update(`${pow.challenge}:${pow.nonce}`).digest()) < cfg.powBits) fail(400, "pow_invalid");
    usedPow.set(pow.challenge, expMs);
    if (usedPow.size > 10000) for (const [k, v] of usedPow) if (v < Date.now()) usedPow.delete(k);
  }

  async function requestCode(ctx) {
    if (!limit(`otp-ip:${ctx.ip}`, 30, 3600e3)) fail(429, "rate_limited");
    const phone = e164(core, ctx.body.phone);
    if (!phone) fail(422, "bad_phone");
    checkPow(ctx.body.pow);
    if (!guard.smsAllowed(phone)) fail(422, "phone_region");
    const recent = db.get("SELECT COUNT(*) AS n FROM otps WHERE phone = ? AND created_at > ?", phone, now() - 15 * 60e3).n;
    if (recent >= 3) fail(429, "rate_limited");
    if (guard.smsCapReached() || guard.intlCapReached(phone)) fail(503, "sms_capped");
    guard.countIntl(phone);
    const code = String(randomInt(0, 1000000)).padStart(6, "0");
    db.run("INSERT INTO otps (phone, code_hash, created_at, expires_at, ip) VALUES (?, ?, ?, ?, ?)",
      phone, codeHash(phone, code), now(), now() + 10 * 60e3, ctx.ip);
    const lang = ctx.body.lang === "en" ? "en" : "ar";
    const text = lang === "ar" ? `رمز الدخول لشغّلني: ${code}\nلا تعطيه لحدا.` : `Your Shaghilni code: ${code}\nDo not share it with anyone.`;
    try { await sms(phone, text); }
    catch (err) { log(`[auth] text to ${mask(phone)} failed: ${err.message}`); fail(502, "sms_failed"); }
    return { ok: true, phone, ...(cfg.otpEcho ? { devCode: code } : {}) };
  }

  function verifyCode(ctx) {
    const phone = e164(core, ctx.body.phone);
    const code = core.norm(String(ctx.body.code || "")).replace(/\D/g, "");   // accepts Arabic-Indic digits too
    if (!phone) fail(422, "bad_phone");
    if (!/^\d{6}$/.test(code)) fail(422, "bad_code");
    if (!limit(`verify-ip:${ctx.ip}`, 60, 3600e3)) fail(429, "rate_limited");
    const row = db.get("SELECT * FROM otps WHERE phone = ? AND used_at IS NULL AND expires_at > ? ORDER BY id DESC LIMIT 1", phone, now());
    if (!row) fail(400, "code_expired");
    if (row.attempts >= 5) fail(429, "too_many_attempts");
    db.run("UPDATE otps SET attempts = attempts + 1 WHERE id = ?", row.id);
    const good = timingSafeEqual(Buffer.from(row.code_hash, "hex"), Buffer.from(codeHash(phone, code), "hex"));
    if (!good) fail(400, "wrong_code");

    const lang = ctx.body.lang === "en" ? "en" : "ar";
    const admin = cfg.adminPhones.includes(phone);
    // Someone invited to a company becomes an employer account, whichever button they pressed.
    const invited = db.get("SELECT 1 AS x FROM company_members WHERE phone = ? AND status = 'invited'", phone);
    const wanted = ctx.body.role === "employer" || invited ? "employer" : "seeker";
    const accept = ctx.body.accept === true;
    let user = db.get("SELECT * FROM users WHERE phone = ? AND deleted_at IS NULL", phone);
    // New accounts must accept the terms. Checked before the code is used up, so the person can tick the box and retry.
    if (!user && !accept) fail(422, "terms_required");
    db.run("UPDATE otps SET used_at = ? WHERE id = ?", now(), row.id);
    let created = false;
    if (!user) {
      const r = db.run("INSERT INTO users (phone, role, lang, created_at, terms_version, terms_accepted_at) VALUES (?, ?, ?, ?, ?, ?)",
        phone, admin ? "admin" : wanted, lang, now(), TERMS_VERSION, now());
      user = db.get("SELECT * FROM users WHERE id = ?", Number(r.lastInsertRowid));
      created = true;
      audit(user.id, "user.created", "user", user.id, { role: user.role, terms: TERMS_VERSION });
    } else {
      if (admin && user.role !== "admin") { db.run("UPDATE users SET role = 'admin' WHERE id = ?", user.id); user.role = "admin"; }
      else if (!admin && user.role === "admin") {   // taken out of ADMIN_PHONES: an ordinary account from now on, and every session opened as an admin ends (D-17, A-14)
        db.run("UPDATE users SET role = ? WHERE id = ?", wanted, user.id); db.run("DELETE FROM sessions WHERE user_id = ?", user.id); user.role = wanted;
        audit(user.id, "user.demoted", "user", user.id, { from: "admin", to: wanted });
      }
      if (accept && user.terms_version !== TERMS_VERSION) {
        db.run("UPDATE users SET terms_version = ?, terms_accepted_at = ? WHERE id = ?", TERMS_VERSION, now(), user.id);
        user.terms_version = TERMS_VERSION;
        audit(user.id, "terms.accepted", "user", user.id, { terms: TERMS_VERSION });
      }
    }
    startSession(ctx, user);
    return { user: publicUser(user), created };
  }
  function startSession(ctx, user) {
    db.run("UPDATE users SET last_login_at = ? WHERE id = ?", now(), user.id);
    const token = randomBytes(32).toString("base64url");
    const maxAge = cfg.sessionDays * 86400;
    db.run("INSERT INTO sessions (token_hash, user_id, created_at, expires_at, ua) VALUES (?, ?, ?, ?, ?)",
      sha(token), user.id, now(), now() + maxAge * 1000, String((ctx.req && ctx.req.headers && ctx.req.headers["user-agent"]) || "").slice(0, 200));
    ctx.headers["set-cookie"] = cookie(token, maxAge);
  }

  function attach(ctx) {
    const token = ctx.cookies[COOKIE];
    if (!token || token.length > 100) return;
    const s = db.get("SELECT * FROM sessions WHERE token_hash = ? AND expires_at > ?", sha(token), now());
    if (!s) return;
    const u = db.get("SELECT * FROM users WHERE id = ? AND deleted_at IS NULL", s.user_id);
    if (!u) return;
    ctx.user = u; ctx.sessionHash = s.token_hash;
  }

  function logout(ctx) {
    if (ctx.sessionHash) db.run("DELETE FROM sessions WHERE token_hash = ?", ctx.sessionHash);
    ctx.headers["set-cookie"] = cookie("", 0);
    return { ok: true };
  }

  const need = (...roles) => ctx => {
    if (!ctx.user) fail(401, "login_required");
    if (roles.length && !roles.includes(ctx.user.role)) fail(403, "forbidden");
  };
  return { requestCode, verifyCode, challenge, attach, logout, need, publicUser, startSession, clearCookie: () => cookie("", 0) };
}
