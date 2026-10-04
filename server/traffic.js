/* Traffic and system health for the Shaghilni team, counted by our own server: no third-party trackers,
   no tracking cookies, and no IP addresses stored. A visitor is recognised for one day only, by a code made
   from a secret that changes every day, so visits can be counted without following anyone over time.
   Browsers that ask not to be tracked (Do Not Track, Global Privacy Control) aren't counted. */
import { createHmac, randomBytes } from "node:crypto";
import { statSync, readdirSync } from "node:fs";
import path from "node:path";
import { fail } from "./http.js";
import { now } from "./db.js";

const DAY = 86400e3;
const PREVIEWS = [["whatsapp", /WhatsApp/i], ["facebook", /facebookexternalhit|facebookcatalog|Facebot/i], ["telegram", /TelegramBot/i], ["twitter", /Twitterbot/i],
  ["linkedin", /LinkedInBot/i], ["slack", /Slackbot/i], ["discord", /Discordbot/i], ["viber", /Viber/i], ["skype", /SkypeUriPreview/i]];
const BOTS = /bot\b|crawl|spider|slurp|bingpreview|headless|lighthouse|pingdom|uptimerobot|monitor|curl\/|wget|python-requests|node-fetch|axios|go-http/i;
export function classify(ua = "") {
  const preview = (PREVIEWS.find(([, re]) => re.test(ua)) || [])[0] || null;
  const inApp = /FBAN|FBAV|FB_IAB/.test(ua) ? "Facebook app" : /Instagram/.test(ua) ? "Instagram app" : /WhatsApp/.test(ua) ? "WhatsApp app" : null;
  const browser = inApp || (/Opera Mini|OPiOS/.test(ua) ? "Opera Mini" : /OPR\/|Opera/.test(ua) ? "Opera" : /SamsungBrowser/.test(ua) ? "Samsung Internet" : /UCBrowser/.test(ua) ? "UC Browser"
    : /YaBrowser/.test(ua) ? "Yandex" : /Edg\//.test(ua) ? "Edge" : /Firefox|FxiOS/.test(ua) ? "Firefox" : /CriOS|Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Other");
  const os = /KAIOS/i.test(ua) ? "KaiOS" : /Android/.test(ua) ? "Android" : /iPhone|iPad|iPod/.test(ua) ? "iOS" : /Windows/.test(ua) ? "Windows" : /Mac OS X|Macintosh/.test(ua) ? "macOS" : /Linux|CrOS/.test(ua) ? "Linux" : "Other";
  // Opera Mini and KaiOS phones don't say "Mobile", so they're phones whatever else the identity says.
  const device = /Opera Mini|KAIOS/i.test(ua) ? "phone" : /iPad|Tablet/.test(ua) || (/Android/.test(ua) && !/Mobile/.test(ua)) ? "tablet" : /Mobi|iPhone|iPod|Android/i.test(ua) ? "phone" : "computer";
  return { preview, bot: !preview && BOTS.test(ua), browser, os, device };
}
const SOURCES = [["whatsapp", /(^|\.)whatsapp\.com$|^wa\.me$|^l\.wl\.co$/], ["facebook", /(^|\.)facebook\.com$|(^|\.)fb\.com$|^fb\.me$/], ["instagram", /(^|\.)instagram\.com$/],
  ["telegram", /^t\.me$|(^|\.)telegram\.org$/], ["google", /(^|\.)google\.[a-z.]+$/], ["linkedin", /(^|\.)linkedin\.com$|^lnkd\.in$/], ["x", /^t\.co$|(^|\.)x\.com$|(^|\.)twitter\.com$/],
  ["youtube", /(^|\.)youtube\.com$|^youtu\.be$/], ["bing", /(^|\.)bing\.com$/]];
export function sourceOf(ref, utmSource, ownHost) {
  const u = String(utmSource || "").toLowerCase().trim(); if (u) return u.replace(/[^a-z0-9._-]/g, "").slice(0, 40) || "direct";
  const h = String(ref || "").toLowerCase(); if (!h || h === ownHost) return "direct";
  return (SOURCES.find(([, re]) => re.test(h)) || [h])[0];
}
const cleanPath = p => { const s = String(p || "/").split("?")[0].split("#")[0].toLowerCase().replace(/\/\d+(?=\/|$)/g, "/:id").replace(/[^a-z0-9/:_-]/g, "").slice(0, 80); return s.startsWith("/") ? s : "/" + s; };
const cut = (v, n) => String(v == null ? "" : v).replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, n);

export function makeTraffic({ db, cfg }) {
  const secret = cfg.otpPepper || randomBytes(32).toString("hex"), started = now();
  const daySalt = new Map(), seen = new Map();
  const salt = day => { if (!daySalt.has(day)) { daySalt.clear(); daySalt.set(day, createHmac("sha256", secret).update("traffic-day:" + day).digest()); } return daySalt.get(day); };
  const today = () => new Date().toISOString().slice(0, 10);
  const visitorOf = (ip, ua) => { const day = today(); return createHmac("sha256", salt(day)).update(`${ip}|${ua}`).digest("hex").slice(0, 16); };
  const optedOut = req => req.headers["dnt"] === "1" || req.headers["sec-gpc"] === "1";
  const countryOf = req => cut(req.headers["cf-ipcountry"] || "", 2).toUpperCase().replace(/[^A-Z]/g, "");
  const allow = (visitor, kind, max) => { const k = `${today()}|${kind}|${visitor}`; const n = (seen.get(k) || 0) + 1; if (seen.size > 50000) seen.clear(); seen.set(k, n); return n <= max; };
  const ownHost = (() => { try { return new URL(cfg.baseUrl || "http://localhost").hostname; } catch { return ""; } })();
  function insertView(v) {
    db.run("INSERT INTO pageviews (at, day, visitor, path, ref, source, medium, campaign, variant, lang, device, browser, os, conn, load_ms, role, country) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      now(), today(), v.visitor, v.path, v.ref, v.source, v.medium, v.campaign, v.variant, v.lang, v.device, v.browser, v.os, v.conn, v.loadMs, v.role, v.country);
  }
  // A page of the full app, reported by the browser (POST /api/t).
  function fromBeacon(ctx) {
    const req = ctx.req, ua = String(req.headers["user-agent"] || ""), k = classify(ua), b = ctx.body || {};
    if (k.bot || k.preview || optedOut(req)) return;
    const visitor = visitorOf(ctx.ip, ua); if (!allow(visitor, "view", 400)) return;
    let ref = ""; try { ref = b.ref ? new URL(String(b.ref)).hostname.toLowerCase() : ""; } catch { ref = ""; }
    insertView({ visitor, path: cleanPath(b.path), ref: ref === ownHost ? "" : cut(ref, 80), source: b.first ? sourceOf(ref === ownHost ? "" : ref, b.utmSource, ownHost) : "",
      medium: b.first ? cut(b.utmMedium, 40).toLowerCase() : "", campaign: b.first ? cut(b.utmCampaign, 60).toLowerCase() : "", variant: "app", lang: b.lang === "en" ? "en" : b.lang === "ar" ? "ar" : "",
      device: k.device, browser: k.browser, os: k.os, conn: ["slow-2g", "2g", "3g", "4g"].includes(b.conn) ? b.conn : "", loadMs: b.first && Number.isFinite(Number(b.loadMs)) ? Math.max(0, Math.min(120000, Math.round(Number(b.loadMs)))) : null,
      role: ["guest", "seeker", "employer", "university", "admin"].includes(b.role) ? b.role : "guest", country: countryOf(req) });
  }
  // A page served by the server itself: Lite, and the first load of the app (for link previews only).
  // Lite pages count their language by the same rule Lite uses: ?lang=, then the "ll" cookie, then the browser.
  function fromServer(req, url, variant) {
    const ua = String(req.headers["user-agent"] || ""), k = classify(ua);
    if (k.preview) { db.run("INSERT INTO shares (at, day, app, path) VALUES (?, ?, ?, ?)", now(), today(), k.preview, cleanPath(url.pathname)); return; }
    if (variant !== "lite" || k.bot || optedOut(req)) return;
    const ip = req.socket && req.socket.remoteAddress || "", visitor = visitorOf(cfg.trustProxy ? (String(req.headers["x-forwarded-for"] || "").split(",").pop() || ip).trim() : ip, ua);
    if (!allow(visitor, "view", 400)) return;
    let ref = ""; try { ref = req.headers.referer ? new URL(req.headers.referer).hostname.toLowerCase() : ""; } catch { ref = ""; }
    const q = url.searchParams, first = !ref || ref !== ownHost;
    insertView({ visitor, path: cleanPath(url.pathname), ref: ref === ownHost ? "" : cut(ref, 80), source: first ? sourceOf(ref === ownHost ? "" : ref, q.get("utm_source"), ownHost) : "",
      medium: first ? cut(q.get("utm_medium"), 40).toLowerCase() : "", campaign: first ? cut(q.get("utm_campaign"), 60).toLowerCase() : "", variant: "lite",
      lang: (l => l === "en" || l === "ar" ? l : /(^|;\s*)ll=en(;|$)/.test(req.headers.cookie || "") ? "en" : /(^|;\s*)ll=ar(;|$)/.test(req.headers.cookie || "") ? "ar" : /^en/i.test(String(req.headers["accept-language"] || "")) ? "en" : "ar")(q.get("lang")), device: k.device, browser: k.browser, os: k.os, conn: "", loadMs: null, role: "guest", country: countryOf(req) });
  }
  function errorFromBeacon(ctx) {
    const ua = String(ctx.req.headers["user-agent"] || ""), k = classify(ua), b = ctx.body || {};
    if (k.bot || k.preview) return; const visitor = visitorOf(ctx.ip, ua); if (!allow(visitor, "error", 20)) return;
    db.run("INSERT INTO client_errors (at, day, message, source, path, variant, browser) VALUES (?, ?, ?, ?, ?, ?, ?)", now(), today(), cut(b.message, 300) || "Unknown error",
      cut(String(b.source || "").replace(/^https?:\/\/[^/]+/, ""), 120), cleanPath(b.path), b.variant === "lite" ? "lite" : "app", k.browser);
  }
  /* ---------- live server measurements, kept in memory (they start again when the server restarts) ---------- */
  const hours = new Map(), routes = new Map(), errors = [];
  const routeKey = (method, p) => `${method} ${p.replace(/\/\d+(?=\/|$)/g, "/:id").replace(/\/%2B\d+|\/\+\d+/g, "/:phone").slice(0, 80)}`;
  function observe(req, res, url, t0) {
    const ms = Number(process.hrtime.bigint() - t0) / 1e6, code = res.statusCode, h = Math.floor(Date.now() / 3600e3);
    const b = hours.get(h) || { n: 0, ok: 0, refused: 0, failed: 0, ms: 0 }; b.n++; b.ms += ms; if (code >= 500) b.failed++; else if (code >= 400) b.refused++; else b.ok++; hours.set(h, b);
    for (const k of hours.keys()) if (k < h - 24) hours.delete(k);
    if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/lite")) {
      const k = routeKey(req.method, url.pathname), r = routes.get(k) || { n: 0, ms: 0, max: 0 }; r.n++; r.ms += ms; r.max = Math.max(r.max, ms); routes.set(k, r);
      if (routes.size > 400) routes.clear();
    }
    if (code >= 500) { errors.unshift({ at: now(), route: routeKey(req.method, url.pathname), status: code }); errors.length = Math.min(errors.length, 30); }
  }
  /* ---------- the team's reports ---------- */
  function report(days, sample) {
    const t = now(), since = t - days * DAY, P = sample ? [] : (cfg.demoPhones || []);
    const rows = db.all("SELECT at, day, visitor, path, source, campaign, variant, lang, device, browser, os, conn, load_ms, role, country FROM pageviews WHERE at >= ? ORDER BY visitor, at LIMIT 300000", since);
    // Visits: a visitor's views with less than 30 minutes between them. Breakdowns use each visit's first page.
    const visits = []; let cur = null;
    for (const r of rows) { if (!cur || cur.visitor !== r.visitor || r.at - cur.last > 30 * 60e3) { cur = { visitor: r.visitor, first: r, last: r.at, views: 0 }; visits.push(cur); } cur.views++; cur.last = r.at; }
    const tally = (list, key, top = 10) => { const m = new Map(); for (const x of list) { const k = key(x) || ""; m.set(k, (m.get(k) || 0) + 1); } return [...m].map(([k, n]) => ({ key: k, n })).sort((a, b) => b.n - a.n).slice(0, top); };
    const firsts = visits.map(v => v.first), dayKey = days > 90 ? (d => { const x = new Date(d + "T00:00:00Z"); x.setUTCDate(x.getUTCDate() - x.getUTCDay()); return x.toISOString().slice(0, 10); }) : (d => d);
    const series = new Map(); for (let i = days - 1; i >= 0; i--) { const d = dayKey(new Date(t - i * DAY).toISOString().slice(0, 10)); if (!series.has(d)) series.set(d, { day: d, visitors: new Set(), views: 0 }); }
    for (const r of rows) { const s = series.get(dayKey(r.day)); if (s) { s.views++; s.visitors.add(r.day + r.visitor); } }
    const speeds = firsts.map(f => f.load_ms).filter(x => x != null).sort((a, b) => a - b), q = (a, p) => a.length ? a[Math.min(a.length - 1, Math.floor(a.length * p))] : null;
    const byConn = {}; for (const c of ["slow-2g", "2g", "3g", "4g"]) { const a = firsts.filter(f => f.conn === c && f.load_ms != null).map(f => f.load_ms).sort((x, y) => x - y); if (a.length) byConn[c] = { visits: a.length, median: q(a, .5) }; }
    const visitorDays = new Set(rows.map(r => r.day + r.visitor)).size;
    const n = (sql, ...a) => db.get(sql, ...a).n, ph = P.map(() => "?").join(",") || "''";
    const signups = n(/* sql-safe: only "?" placeholders */ `SELECT COUNT(*) AS n FROM users WHERE created_at >= ? AND role != 'admin' AND phone NOT IN (${ph})`, since, ...P);
    const profiles = n(/* sql-safe: only "?" placeholders */ `SELECT COUNT(*) AS n FROM profiles p JOIN users u ON u.id = p.user_id WHERE u.created_at >= ? AND u.phone NOT IN (${ph})`, since, ...P);
    const applied = n(/* sql-safe: only "?" placeholders */ `SELECT COUNT(DISTINCT a.user_id) AS n FROM applications a JOIN users u ON u.id = a.user_id WHERE a.created_at >= ? AND u.phone NOT IN (${ph})`, since, ...P);
    const hired = n(/* sql-safe: only "?" placeholders */ `SELECT COUNT(*) AS n FROM applications a JOIN users u ON u.id = a.user_id WHERE a.hire_confirmed_at >= ? AND u.phone NOT IN (${ph})`, since, ...P);
    return { period: { days, since, byWeek: days > 90 },
      now: new Set(rows.filter(r => r.at >= t - 5 * 60e3).map(r => r.visitor)).size,
      totals: { visitors: visitorDays, views: rows.length, visits: visits.length, viewsPerVisit: visits.length ? Math.round(rows.length / visits.length * 10) / 10 : 0,
        leftAfterOne: visits.length ? Math.round(visits.filter(v => v.views === 1).length / visits.length * 100) : null },
      series: [...series.values()].map(s => ({ day: s.day, visitors: s.visitors.size, views: s.views })),
      pages: tally(rows, r => r.path, 12), sources: tally(firsts, f => f.source || "direct"), campaigns: tally(firsts.filter(f => f.campaign), f => f.campaign),
      shares: { total: n("SELECT COUNT(*) AS n FROM shares WHERE at >= ?", since), byApp: db.all("SELECT app AS key, COUNT(*) AS n FROM shares WHERE at >= ? GROUP BY app ORDER BY n DESC", since),
        pages: db.all("SELECT path AS key, COUNT(*) AS n FROM shares WHERE at >= ? GROUP BY path ORDER BY n DESC LIMIT 8", since) },
      devices: tally(firsts, f => f.device), browsers: tally(firsts, f => f.browser), systems: tally(firsts, f => f.os), connections: tally(firsts.filter(f => f.conn), f => f.conn),
      languages: tally(firsts, f => f.lang || "?"), variants: tally(firsts, f => f.variant), roles: tally(firsts, f => f.role), countries: tally(firsts.filter(f => f.country), f => f.country),
      speed: { median: q(speeds, .5), slowQuarter: q(speeds, .75), measured: speeds.length, byConn },
      funnel: { visitors: visitorDays, signups, profiles, applied, hired },
      errors: db.all("SELECT message AS key, COUNT(*) AS n, MAX(at) AS last, MAX(browser) AS browser FROM client_errors WHERE at >= ? GROUP BY message ORDER BY n DESC LIMIT 10", since) };
  }
  function system() {
    const h = Math.floor(Date.now() / 3600e3), sum = keys => keys.reduce((s, k) => { const b = hours.get(k); if (b) { s.n += b.n; s.ok += b.ok; s.refused += b.refused; s.failed += b.failed; s.ms += b.ms; } return s; }, { n: 0, ok: 0, refused: 0, failed: 0, ms: 0 });
    const last1 = sum([h]), last24 = sum([...hours.keys()]);
    let dbBytes = 0; for (const f of [cfg.dbPath, cfg.dbPath + "-wal"]) { try { dbBytes += statSync(f).size; } catch { /* in memory, or no WAL file */ } }
    let lastBackup = null; try { const dir = path.join(path.dirname(cfg.dbPath), "..", "backups"); const files = readdirSync(dir).filter(f => /\.db$|\.sqlite$/.test(f)).map(f => statSync(path.join(dir, f)).mtimeMs).sort((a, b) => b - a); lastBackup = files[0] || null; } catch { lastBackup = null; }
    const mem = process.memoryUsage(), count = table => db.get(/* sql-safe: fixed table names */ `SELECT COUNT(*) AS n FROM ${table}`).n;
    return { startedAt: started, uptimeSeconds: Math.round(process.uptime()), node: process.version, memoryMb: Math.round(mem.rss / 1048576), heapMb: Math.round(mem.heapUsed / 1048576),
      dbMb: Math.round(dbBytes / 104857.6) / 10, lastBackup, production: !!cfg.prod,
      requests: { lastHour: { ...last1, avgMs: last1.n ? Math.round(last1.ms / last1.n) : 0 }, lastDay: { ...last24, avgMs: last24.n ? Math.round(last24.ms / last24.n) : 0 } },
      slowest: [...routes].filter(([, r]) => r.n >= 3).map(([k, r]) => ({ route: k, n: r.n, avgMs: Math.round(r.ms / r.n), maxMs: Math.round(r.max) })).sort((a, b) => b.avgMs - a.avgMs).slice(0, 8),
      recentFailures: errors.slice(0, 15),
      rows: { users: count("users"), jobs: count("jobs"), applications: count("applications"), pageviews: count("pageviews") },
      messages: { textsFailedDay: db.get("SELECT COUNT(*) AS n FROM notifications WHERE status = 'failed' AND created_at >= ?", now() - DAY).n, textsSentDay: db.get("SELECT COUNT(*) AS n FROM notifications WHERE status = 'sent' AND created_at >= ?", now() - DAY).n } };
  }
  function register(r, { auth }) {
    const admin = auth.need("admin");
    r.post("/api/t", ctx => { fromBeacon(ctx); return { ok: true }; });
    r.post("/api/t/error", ctx => { errorFromBeacon(ctx); return { ok: true }; });
    r.get("/api/admin/traffic", admin, ctx => { const d = Number(ctx.query.get("days")); return report([1, 7, 30, 90, 365].includes(d) ? d : 30, ctx.query.get("sample") === "1"); });
    r.get("/api/admin/system", admin, () => system());
  }
  return { classify, fromServer, observe, register, report, system };
}
