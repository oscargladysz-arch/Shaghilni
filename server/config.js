/* Configuration from environment variables (and an optional .env file). */
import { readFileSync, existsSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadDotEnv(file) {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith("#")) continue;
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
    if (!m) continue;
    let v = m[2];
    if (/^(["']).*\1$/.test(v)) v = v.slice(1, -1);
    if (!(m[1] in process.env)) process.env[m[1]] = v;
  }
}

/* The version of the Terms of Use and Privacy Notice people accept. Change it when either document changes
   materially: sign-in then records acceptance of the new version. */
export const TERMS_VERSION = "2026-10-04";

const list = v => String(v || "").split(",").map(x => x.replace(/[^\d+]/g, "")).filter(Boolean);
const num = (v, d) => (v === undefined || v === "" || !Number.isFinite(Number(v)) ? d : Number(v));

export function loadConfig(overrides = {}) {
  if (!overrides.skipDotEnv) loadDotEnv(path.join(ROOT, ".env"));
  const e = overrides.isolated ? { ...overrides.env } : { ...process.env, ...overrides.env };   // isolated: tests and the scanner ignore this machine's variables
  const env = e.NODE_ENV || "development";
  const prod = env === "production";
  const cfg = {
    env, prod,
    port: num(e.PORT, 3000),
    host: e.HOST || "0.0.0.0",
    baseUrl: (e.BASE_URL || "").replace(/\/$/, ""),
    dbPath: e.DB_PATH || path.join(ROOT, "data", "shaghilni.db"),
    sessionDays: num(e.SESSION_DAYS, 30),
    adminPhones: list(e.ADMIN_PHONES),
    otpPepper: e.OTP_PEPPER || (prod ? "" : "dev-pepper-change-me-dev-pepper-change-me"),
    otpEcho: !prod && e.OTP_DEV_ECHO === "true",           // development only: returns the code in the API response
    powBits: Math.max(0, Math.min(24, num(e.OTP_POW_BITS, 14))),   // proof-of-work difficulty for sign-in codes; 0 turns it off
    sms: {
      provider: e.SMS_PROVIDER || "console",               // console | textbee | twilio
      textbeeKey: e.TEXTBEE_API_KEY || "",
      twilioSid: e.TWILIO_ACCOUNT_SID || "", twilioToken: e.TWILIO_AUTH_TOKEN || "", twilioFrom: e.TWILIO_FROM || ""
    },
    // Syria, plus the countries where most Syrians abroad live. Texts abroad cost more, so they have their own daily cap.
    smsAllowedPrefixes: e.SMS_ALLOWED_PREFIXES === undefined ? ["+963", "+49", "+90", "+961", "+962", "+964", "+20", "+971", "+966", "+974", "+965", "+46", "+31", "+43", "+45", "+47", "+33", "+32", "+44", "+1"] : list(e.SMS_ALLOWED_PREFIXES),
    smsIntlDailyCap: num(e.SMS_INTL_DAILY_CAP, 150),
    // Demo accounts (a student, a job seeker and a verified company): only when asked for, and never in production.
    demoAccounts: e.DEMO_ACCOUNTS ? e.DEMO_ACCOUNTS === "true" : e.NODE_ENV !== "test",   // demo-accounts: on when you run it yourself, off in tests, never in production
    // Card payments: a payment provider (a bank's hosted payment page) and monthly prices in PAY_CURRENCY.
    payProvider: e.PAY_PROVIDER || "", payCurrency: (e.PAY_CURRENCY || "SYP").toUpperCase(),
    planProMonthly: num(e.PLAN_PRO_MONTHLY, 0), planEnterpriseMonthly: num(e.PLAN_ENTERPRISE_MONTHLY, 0),
    qnbGatewayUrl: e.QNB_GATEWAY_URL || "", qnbMerchantId: e.QNB_MERCHANT_ID || "", qnbApiSecret: e.QNB_API_SECRET || "", qnbWebhookSecret: e.QNB_WEBHOOK_SECRET || "",
    planProPrice: e.PLAN_PRO_PRICE || "", planEnterprisePrice: e.PLAN_ENTERPRISE_PRICE || "",
    emailApiUrl: e.EMAIL_API_URL || "", emailApiKey: e.EMAIL_API_KEY || "", emailFrom: e.EMAIL_FROM || "",
    smsDailyCap: num(e.SMS_DAILY_CAP, 1000),
    anthropicKey: e.ANTHROPIC_API_KEY || "",
    claudeModel: e.CLAUDE_MODEL || "claude-sonnet-5",
    aiDailyCap: num(e.AI_DAILY_CAP, 300),
    aiUserDailyCap: num(e.AI_USER_DAILY_CAP, 30),
    apiRateLimit: num(e.API_RATE_LIMIT, 600),              // requests per minute per address, all API calls
    writeRateLimit: num(e.WRITE_RATE_LIMIT, 240),          // of which changes (POST, PUT, DELETE)
    legalName: e.LEGAL_NAME || "",                          // your registered company name, shown in the privacy notice and terms
    contactEmail: e.CONTACT_EMAIL || "",
    seedDemo: !prod && e.SEED_DEMO !== "false",            // sample listings: development and tests only; never in production, whatever SEED_DEMO says
    trustProxy: e.TRUST_PROXY === "true",
    ...overrides.values
  };
  if (prod) {
    // Lockdown: refuse to start with settings that would be unsafe in public.
    if (!cfg.otpPepper || cfg.otpPepper.length < 32) throw new Error("OTP_PEPPER must be set in production to a random secret of at least 32 characters.");
    if (!/^https:\/\//.test(cfg.baseUrl)) throw new Error("BASE_URL must be set in production to your https:// address, for example https://jobs.example");
    if (cfg.payProvider === "test") throw new Error("PAY_PROVIDER=test is a pretend payment page for development. Use your bank's provider in production, or leave PAY_PROVIDER empty.");
    if (cfg.payProvider && !(cfg.planProMonthly > 0 && cfg.planEnterpriseMonthly > 0)) throw new Error("Card payments need PLAN_PRO_MONTHLY and PLAN_ENTERPRISE_MONTHLY, the monthly prices in PAY_CURRENCY.");
    if (!cfg.adminPhones.length) console.warn("[config] ADMIN_PHONES is empty: nobody can verify companies or publish listings.");
    if (cfg.sms.provider === "console") console.warn("[config] SMS_PROVIDER is 'console' in production: codes are only written to the log.");
    if (!cfg.contactEmail) console.warn("[config] CONTACT_EMAIL is empty: the privacy notice and terms need a contact address.");
    if (e.OTP_DEV_ECHO === "true") console.warn("[config] OTP_DEV_ECHO is ignored in production.");
    if (e.SEED_DEMO === "true") console.warn("[config] SEED_DEMO is ignored in production: sample listings are never added there.");
    if (!cfg.smsAllowedPrefixes.length) console.warn("[config] SMS_ALLOWED_PREFIXES is empty: sign-in texts can go to any country (a toll-fraud risk).");
    try { const envFile = path.join(ROOT, ".env"); if (existsSync(envFile) && (statSync(envFile).mode & 0o077)) console.warn("[config] .env is readable by other users on this machine: run chmod 600 .env"); } catch { /* not a POSIX file system */ }
  }
  return cfg;
}
