import { gzipSync } from "node:zlib";
/* Assembles the application: API routes, sessions, CSRF defence and the static client. */
import { createRouter, parseCookies, readJson, send, clientIp, makeLimiter, HttpError, fail, SECURITY_HEADERS } from "./http.js";
import { now } from "./db.js";
import { loadCore } from "./core.js";
import { makeSms } from "./sms.js";
import { makeAuth } from "./auth.js";
import { makeNotifier } from "./notify.js";
import { makeAssets } from "./assets.js";
import { makeGuard, mask } from "./guard.js";
import { cleanup } from "./retention.js";
import { makeTraffic } from "./traffic.js";
import { readFileSync } from "node:fs";
import path from "node:path";
import { ROOT } from "./config.js";
import { registerPublic } from "./routes/public.js";
import { registerMe } from "./routes/me.js";
import { registerEmployer } from "./routes/employer.js";
import { registerAdmin } from "./routes/admin.js";
import { registerResume } from "./routes/resume.js";
import { registerRecruit } from "./routes/recruit.js";
import { makeLite } from "./lite.js";
import { makeAlerts, makeEmail } from "./alerts.js";
import { makePlans } from "./plans.js";
import { makePayments } from "./payments.js";
import { makeCampus, registerCampus } from "./routes/campus.js";
import { registerEvents } from "./routes/events.js";
import { registerTeam } from "./routes/team.js";
import { registerInsights } from "./routes/insights.js";
import { registerDemo, seedDemoAccounts, demoOn } from "./demo.js";   // demo-accounts

export function createApp({ cfg, db, log = console.log, sms: smsOverride, email: emailIn }) {
  const core = loadCore();
  const sms = smsOverride || makeSms(cfg, log);
  const limit = makeLimiter();
  const audit = (actor, action, entity, id, data) =>
    db.run("INSERT INTO audit (actor_id, action, entity, entity_id, data, created_at) VALUES (?, ?, ?, ?, ?, ?)", actor ?? null, action, entity ?? null, id ?? null, data ? JSON.stringify(data) : null, now());
  const guard = makeGuard({ db, cfg, log });
  const auth = makeAuth({ db, cfg, core, sms, limit, audit, log, guard });
  const notify = makeNotifier({ db, sms, log, guard });
  const deps = { db, cfg, core, auth, audit, notify, limit, log, guard };
  const router = createRouter();
  deps.email = emailIn === undefined ? makeEmail(cfg, log) : emailIn;
  deps.alerts = makeAlerts({ ...deps });
  deps.plans = makePlans(deps);
  deps.payments = makePayments(deps);
  deps.campus = makeCampus(deps);
  const traffic = makeTraffic({ db, cfg });
  registerPublic(router, deps); registerMe(router, deps); registerEmployer(router, deps); registerAdmin(router, deps); registerResume(router, deps); registerRecruit(router, deps); deps.alerts.register(router, deps); registerCampus(router, deps); registerEvents(router, deps); registerTeam(router, deps); registerInsights(router, deps); traffic.register(router, deps);
  const assets = makeAssets(cfg);
  const lite = makeLite(deps, router);

  async function api(req, res, url) {
    const ctx = { req, res, url, query: url.searchParams, params: {}, headers: {}, ip: clientIp(req, cfg.trustProxy), cookies: parseCookies(req.headers.cookie), user: null };
    try {
      if (!limit(`a:${ctx.ip}`, cfg.apiRateLimit, 60e3)) fail(429, "rate_limited");
      if (req.method !== "GET" && req.method !== "HEAD") {
        // CSRF: cross-site requests cannot set this header without a CORS preflight, which is never granted.
        if (req.headers["x-shaghilni"] !== "1") fail(403, "csrf");
        const origin = req.headers.origin;
        if (origin && cfg.baseUrl && origin !== cfg.baseUrl) fail(403, "csrf");
        if (!limit(`w:${ctx.ip}`, cfg.writeRateLimit, 60e3)) fail(429, "rate_limited");
      }
      const m = router.match(req.method, url.pathname);
      if (!m) fail(404, "not_found");
      if (m.methodNotAllowed) fail(405, "method_not_allowed");
      ctx.params = m.params;
      ctx.body = await readJson(req);
      auth.attach(ctx);
      let out;
      for (const h of m.handlers) out = await h(ctx);
      send(req, res, 200, out ?? { ok: true }, ctx.headers);
    } catch (err) {
      if (err instanceof HttpError) {
        if (err.status === 413) ctx.headers.connection = "close";
        return send(req, res, err.status, { error: err.code, detail: err.detail ?? null }, ctx.headers);
      }
      log(`[error] ${req.method} ${url.pathname.replace(/(?:%2B|\+)?\d{7,}/gi, m => mask(m.replace(/^%2B/i, "+")))}: ${err.stack || err}`);   // a phone number in the path (the team routes) is masked like every other log line (U-054)
      send(req, res, 500, { error: "server_error" }, ctx.headers);
    }
  }

  function file(req, res, url) {
    const a = assets();
    const gz = /gzip/.test(String(req.headers["accept-encoding"] || ""));
    const f = a.files[url.pathname];
    if (f) return send(req, res, 200, gz ? f.gz : f.body, { "content-type": f.type, "cache-control": "public, max-age=31536000, immutable", ...(gz ? { "content-encoding": "gzip", vary: "accept-encoding" } : {}) });
    if (/^\/fonts\/[a-z0-9-]+\.woff2$/.test(url.pathname)) {   // self-hosted fonts: no request ever goes to Google
      let body; try { body = readFileSync(path.join(ROOT, "public", url.pathname)); } catch { return send(req, res, 404, "Not found", { "content-type": "text/plain" }); }
      return send(req, res, 200, body, { "content-type": "font/woff2", "cache-control": "public, max-age=2592000" });
    }
    if (url.pathname === "/vendor/qrcode.js") {   // the QR library for event tickets (MIT), loaded only when a ticket is shown
      if (!file.qr) file.qr = gzipSync(readFileSync(path.join(ROOT, "public", "js", "vendor", "qrcode.js")));
      return send(req, res, 200, file.qr, { "content-type": "application/javascript; charset=utf-8", "cache-control": "public, max-age=2592000", "content-encoding": "gzip", vary: "accept-encoding" });
    }
    if (url.pathname === "/favicon.svg") return send(req, res, 200, a.favicon, { "content-type": "image/svg+xml", "cache-control": "public, max-age=86400" });
    if (url.pathname === "/robots.txt") return send(req, res, 200, "User-agent: *\nAllow: /\n", { "content-type": "text/plain" });
    if (url.pathname.startsWith("/assets/")) return send(req, res, 404, "Not found", { "content-type": "text/plain" });
    traffic.fromServer(req, url, "app");   // only link previews are counted here; the app reports its own pages
    send(req, res, 200, gz ? a.htmlGz : a.html, { "content-type": "text/html; charset=utf-8", "cache-control": "no-cache", ...(gz ? { "content-encoding": "gzip", vary: "accept-encoding" } : {}) });
  }

  function handler(req, res) {
    if (cfg.prod) res.setHeader("strict-transport-security", "max-age=31536000; includeSubDomains");   // production only: browsers then refuse plain http
    let url; try { url = new URL(req.url, "http://localhost"); } catch { return send(req, res, 400, "Bad request", { "content-type": "text/plain; charset=utf-8" }); }   // a request line the parser rejects is the sender's error, never a crash (D-39)
    const t0 = process.hrtime.bigint();
    res.on("finish", () => { try { traffic.observe(req, res, url, t0); } catch (e) { /* measuring never breaks a request */ } });
    if (url.pathname === "/hire" || url.pathname === "/hire/") { res.writeHead(302, { location: "/lite/hire" }); return res.end(); }
    // Card payments: the bank's signed results, the return page and (in development) the test payment page. Not under /api, so no CSRF header: each is checked on its own.
    if (url.pathname.startsWith("/pay/")) return deps.payments.handle(req, res, url).catch(err => { log(`[pay] ${err.stack || err}`); if (!res.headersSent) send(req, res, 500, "Server error", { "content-type": "text/plain; charset=utf-8" }); });
    if (url.pathname === "/lite" || url.pathname.startsWith("/lite/")) {
      if (req.method === "GET" && !/^\/lite\/(s|i|p)\.[a-z0-9]+\.(css|svg|js)$/.test(url.pathname)) { try { traffic.fromServer(req, url, "lite"); } catch (e) { /* counting never breaks a page */ } }
      return lite(req, res, url).catch(err => { log(`[lite] ${err.stack || err}`); if (!res.headersSent) send(req, res, 500, "Server error", { "content-type": "text/plain; charset=utf-8" }); });
    }
    if (url.pathname.startsWith("/api/")) return api(req, res, url);
    if (req.method !== "GET" && req.method !== "HEAD") return send(req, res, 405, "Method not allowed");
    return file(req, res, url);
  }
  handler.cleanup = () => cleanup(db);
  handler.traffic = traffic;
  handler.runAlerts = t => deps.alerts.run(t);
  handler.routes = router.routes;   // read-only listing of the registered JSON routes (test/policy-*.test.js)
  handler.payments = deps.payments;
  registerDemo(router, deps);   // demo-accounts
  handler.demoReady = demoOn(cfg) ? seedDemoAccounts({ ...deps, router }).catch(err => log(`[demo] ${err.stack || err}`)) : Promise.resolve();   // demo-accounts
  return handler;
}
