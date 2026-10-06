/* Pre-launch security scanner.   npm run security:check            checks the code and your production settings
                                   npm run security:check -- --url https://your-site   also checks the live site
   Prints PASS / WARN / FAIL lines and exits with an error if anything FAILs. Run it before launch and after changes. */
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadConfig } from "../server/config.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SKIP = new Set(["node_modules", ".git", "data", "backups", "shots", "fonts", "screenshots"]);
const TEXT = /\.(js|mjs|cjs|json|md|html|css|txt|yml|yaml|sh|example)$|^Dockerfile$|^\.env/;

function files(root) {
  const out = [];
  const walk = dir => {
    for (const name of readdirSync(dir)) {
      if (SKIP.has(name)) continue;
      const p = path.join(dir, name), st = statSync(p);
      if (st.isDirectory()) walk(p); else if (TEXT.test(name) && st.size < 2e6) out.push(p);
    }
  };
  walk(root);
  return out;
}

/* 1. Secrets that must never be committed or shipped */
const SECRET_PATTERNS = [
  ["Anthropic API key", /sk-ant-[A-Za-z0-9_-]{20,}/],
  ["OpenAI-style API key", /\bsk-[A-Za-z0-9]{32,}\b/],
  ["AWS access key", /\bAKIA[0-9A-Z]{16}\b/],
  ["Twilio account SID", /\bAC[0-9a-f]{32}\b/],
  ["Private key", /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/],
  ["Hard-coded secret", /(?:api[_-]?key|secret|token|password|pepper|key)\b\s*[:=]\s*["'][A-Za-z0-9_\-]{24,}["']/i],   // also prefixed names: textbeeKey, otpPepper, emailApiKey (D-50)
  ["Hard-coded secret", /^\s*(?:export\s+)?[A-Z0-9_]*(?:API_KEY|SECRET|TOKEN|PASSWORD|PEPPER)\s*=\s*["']?[A-Za-z0-9_\-]{24,}/m]   // a settings line: OTP_PEPPER=..., TEXTBEE_API_KEY=...
];
export function scanSecrets(root = ROOT) {
  const found = [];
  for (const f of files(root)) {
    if (/^\.env(\..+)?$/.test(path.basename(f)) && path.basename(f) !== ".env.example") continue;   // your local settings files (.env, .env.production, ...): git ignores them and they are supposed to hold secrets; the example must not
    const text = readFileSync(f, "utf8");
    for (const [label, re] of SECRET_PATTERNS) { const m = re.exec(text); if (m) found.push(`${label} in ${path.relative(root, f)} (${m[0].slice(0, 10)}…)`); }
  }
  return found;
}

/* 2. Code patterns that open the door to injection: every reviewed exception carries a marker comment */
export function scanCode(root = ROOT) {
  const found = [];
  for (const f of files(root).filter(x => /\.(js|mjs)$/.test(x) && !x.includes(`${path.sep}test${path.sep}`) && !x.endsWith("security-check.js"))) {
    const text = readFileSync(f, "utf8"), rel = path.relative(root, f);
    for (const m of text.matchAll(/db\.(?:get|all|run|exec)\(\s*(\/\*[^*]*\*\/\s*)?`([\s\S]*?)`/g))
      if (m[2].includes("${") && !(m[1] || "").includes("sql-safe")) found.push(`SQL built from a template with \${} in ${rel}: use ? placeholders`);
    text.split("\n").forEach((line, i) => {
      if (/\b(?:innerHTML|outerHTML)\s*=|insertAdjacentHTML|document\.write\(/.test(line) && !line.includes("html-safe")) found.push(`Raw HTML write in ${rel}:${i + 1}: use put() with the html\`\` template`);
      if (/\beval\s*\(|new Function\s*\(|require\(["']child_process["']\)|from ["']node:child_process["']/.test(line)) found.push(`Dynamic code or shell execution in ${rel}:${i + 1}`);
    });
  }
  const index = readFileSync(path.join(root, "public", "index.html"), "utf8");
  if (/<script(?![^>]*\bsrc=)[^>]*>/.test(index)) found.push("Inline <script> in public/index.html: the security policy blocks it");
  if (/<(?:script|link)[^>]+(?:src|href)="https?:\/\//.test(index)) found.push("public/index.html loads something from another site");
  return found;
}

/* 3. Production settings */
export function parseEnvFile(file) {
  const env = {};
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
    if (m && !line.trim().startsWith("#")) env[m[1]] = m[2].replace(/^(["'])(.*)\1$/, "$2");
  }
  return env;
}
export function auditSettings(env) {
  const out = [], add = (level, msg) => out.push([level, msg]);
  let cfg;
  // Anything but production runs the server in development mode: sign-in codes can be returned in the API response and a built-in pepper is used.
  if (env.NODE_ENV !== "production") add("FAIL", "NODE_ENV is not 'production': the server would run in development mode (codes in the API response, a built-in pepper). Set NODE_ENV=production on any public host.");
  const origWarn = console.warn; console.warn = () => {};
  try { cfg = loadConfig({ skipDotEnv: true, isolated: true, env: { ...env, NODE_ENV: "production" } }); }
  catch (err) { console.warn = origWarn; add("FAIL", err.message); return out; }
  console.warn = origWarn;
  add("PASS", "OTP_PEPPER is long enough and BASE_URL uses https");
  add(cfg.adminPhones.length ? "PASS" : "FAIL", cfg.adminPhones.length ? `ADMIN_PHONES has ${cfg.adminPhones.length} number(s)` : "ADMIN_PHONES is empty");
  add(cfg.sms.provider !== "console" ? "PASS" : "FAIL", cfg.sms.provider !== "console" ? `Texts go out through ${cfg.sms.provider}` : "SMS_PROVIDER is 'console': nobody receives sign-in codes");
  if (cfg.sms.provider === "textbee" && !cfg.sms.textbeeKey) add("FAIL", "TEXTBEE_API_KEY is missing");
  if (cfg.sms.provider === "twilio" && !(cfg.sms.twilioSid && cfg.sms.twilioToken && cfg.sms.twilioFrom)) add("FAIL", "Twilio settings are incomplete");
  add(cfg.smsAllowedPrefixes.length ? "PASS" : "WARN", cfg.smsAllowedPrefixes.length ? `Sign-in texts only go to ${cfg.smsAllowedPrefixes.join(", ")}` : "SMS_ALLOWED_PREFIXES is empty: texts can go anywhere (toll-fraud risk)");
  add(cfg.smsDailyCap <= 5000 ? "PASS" : "WARN", `Daily text cap: ${cfg.smsDailyCap}`);
  add(cfg.powBits >= 12 ? "PASS" : "WARN", cfg.powBits ? `Proof-of-work difficulty: ${cfg.powBits} bits` : "OTP_POW_BITS is 0: the sign-in challenge is off");
  if (cfg.anthropicKey) add(cfg.aiDailyCap <= 1000 ? "PASS" : "WARN", `AI caps: ${cfg.aiDailyCap} calls a day in total, ${cfg.aiUserDailyCap} per person`);
  add(cfg.contactEmail ? "PASS" : "FAIL", cfg.contactEmail ? `Privacy contact: ${cfg.contactEmail}` : "CONTACT_EMAIL is empty: the privacy notice has no contact address");
  add(env.LEGAL_NAME ? "PASS" : "WARN", env.LEGAL_NAME ? `Legal name: ${env.LEGAL_NAME}` : "LEGAL_NAME is not set: the documents say 'Shaghilni'; use your registered company name");
  add(env.TRUST_PROXY === "true" ? "PASS" : "WARN", env.TRUST_PROXY === "true" ? "TRUST_PROXY is on (right behind Render, Railway, Fly, nginx or Caddy)" : "TRUST_PROXY is off: correct only if nothing sits in front of the server");
  if (env.OTP_DEV_ECHO === "true") add("WARN", "OTP_DEV_ECHO=true is ignored in production; remove it");
  // SEED_DEMO is not checked: sample listings are never seeded in production (server/config.js). A database that already holds them is reported at start-up and on the Insights screen.
  return out;
}

/* 4. The live site */
async function liveCheck(base) {
  const out = [], add = (level, msg) => out.push([level, msg]);
  const url = base.replace(/\/$/, "");
  let res;
  try { res = await fetch(url + "/", { redirect: "manual" }); } catch (err) { add("FAIL", `Could not reach ${url}: ${err.message}`); return out; }
  const h = k => res.headers.get(k) || "";
  const csp = h("content-security-policy");
  add(/script-src 'self'/.test(csp) && /frame-ancestors 'none'/.test(csp) ? "PASS" : "FAIL", "Content-Security-Policy restricts scripts and framing");
  const hsts = /max-age=(\d+)/.exec(h("strict-transport-security"));
  if (url.startsWith("https://")) add(hsts && Number(hsts[1]) >= 15552000 ? "PASS" : "FAIL", "Strict-Transport-Security is at least 6 months");
  add(h("x-content-type-options") === "nosniff" ? "PASS" : "FAIL", "X-Content-Type-Options: nosniff");
  add(h("x-frame-options") === "DENY" ? "PASS" : "WARN", "X-Frame-Options: DENY");
  add(h("referrer-policy") ? "PASS" : "WARN", "Referrer-Policy is set");
  add(!h("x-powered-by") && !/\d/.test(h("server")) ? "PASS" : "WARN", "No software versions in the headers");
  const cfgText = await (await fetch(url + "/api/config")).text();
  add(!/key|secret|token|pepper/i.test(cfgText) ? "PASS" : "FAIL", "/api/config exposes no secrets");
  const csrf = await fetch(url + "/api/auth/code", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
  add(csrf.status === 403 ? "PASS" : "FAIL", "Writes without the app header are refused (CSRF)");
  const pre = await fetch(url + "/api/jobs", { method: "OPTIONS", headers: { origin: "https://evil.example", "access-control-request-method": "POST" } });
  add(!pre.headers.get("access-control-allow-origin") ? "PASS" : "FAIL", "Other sites get no CORS permission");
  if (url.startsWith("https://")) {
    try { const plain = await fetch(url.replace(/^https:/, "http:") + "/", { redirect: "manual" });
      add(plain.status >= 300 && plain.status < 400 && /^https:/.test(plain.headers.get("location") || "") ? "PASS" : "WARN", "http:// redirects to https://");
    } catch { add("PASS", "http:// is not served at all"); }
  }
  return out;
}

async function main() {
  const args = process.argv.slice(2), urlArg = args.indexOf("--url"), envArg = args.indexOf("--env");
  const rows = [];
  const secrets = scanSecrets(), code = scanCode();
  rows.push(secrets.length ? ["FAIL", `Possible secrets in the code:\n        ${secrets.join("\n        ")}`] : ["PASS", "No API keys, tokens or private keys in the code"]);
  rows.push(code.length ? ["FAIL", `Risky code patterns:\n        ${code.join("\n        ")}`] : ["PASS", "No unreviewed SQL building, raw HTML writes, eval or shell calls"]);
  const envFile = envArg >= 0 ? path.resolve(args[envArg + 1]) : path.join(ROOT, ".env");
  const env = { ...(existsSync(envFile) ? parseEnvFile(envFile) : {}), ...process.env };
  console.log(`Settings checked: ${existsSync(envFile) ? envFile : "environment variables"} (as production)`);
  rows.push(...auditSettings(env));
  if (existsSync(path.join(ROOT, ".env")) && (statSync(path.join(ROOT, ".env")).mode & 0o077)) rows.push(["WARN", ".env is readable by other users: run chmod 600 .env"]);
  if (urlArg >= 0) rows.push(...await liveCheck(args[urlArg + 1]));
  else rows.push(["WARN", "Live site not checked: add --url https://your-site once it's deployed"]);
  for (const [level, msg] of rows) console.log(`${level.padEnd(5)} ${msg}`);
  const fails = rows.filter(r => r[0] === "FAIL").length, warns = rows.filter(r => r[0] === "WARN").length;
  console.log(`\n${fails} failed, ${warns} warnings, ${rows.length - fails - warns} passed`);
  if (fails) process.exitCode = 1;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
