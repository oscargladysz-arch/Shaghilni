/* A small HTTP toolkit: routing with :params, JSON bodies, cookies, errors and security headers. */
import { gzipSync } from "node:zlib";

export class HttpError extends Error {
  constructor(status, code, detail) { super(code); this.status = status; this.code = code; this.detail = detail; }
}
export const fail = (status, code, detail) => { throw new HttpError(status, code, detail); };

export function createRouter() {
  const routes = [];
  const add = method => (pattern, ...handlers) => {
    const keys = [];
    const re = new RegExp("^" + pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/:(\w+)/g, (_, k) => { keys.push(k); return "([^/]+)"; }) + "/?$");
    routes.push({ method, pattern, re, keys, handlers });
  };
  return {
    get: add("GET"), post: add("POST"), put: add("PUT"), delete: add("DELETE"),
    routes: () => routes.map(r => ({ method: r.method, pattern: r.pattern })),   // read-only listing, for the route-policy tests
    match(method, pathname) {
      let pathMatched = false;
      for (const r of routes) {
        const m = r.re.exec(pathname);
        if (!m) continue;
        pathMatched = true;
        if (r.method !== method) continue;
        const params = {};
        try { r.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); }); } catch { return null; }   // a malformed percent-encoding is an unknown address, not a server error (D-40)
        return { handlers: r.handlers, params };
      }
      return pathMatched ? { methodNotAllowed: true } : null;
    }
  };
}

export function parseCookies(header) {
  const out = {};
  for (const part of String(header || "").split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    const k = part.slice(0, i).trim(), v = part.slice(i + 1).trim();
    if (k) { try { out[k] = decodeURIComponent(v); } catch { out[k] = v; } }
  }
  return out;
}

export function readJson(req, limit = 256 * 1024) {
  return new Promise((resolve, reject) => {
    const type = String(req.headers["content-type"] || "");
    if (req.method === "GET" || req.method === "HEAD") return resolve({});
    let size = 0; const chunks = [];
    // Past the limit: stop buffering and answer 413. The socket stays open long enough for the answer to arrive;
    // the response then closes the connection, which ends the upload (destroying it here would lose the answer).
    req.on("data", c => { if (size > limit) return; size += c.length; if (size > limit) { chunks.length = 0; reject(new HttpError(413, "too_large")); } else chunks.push(c); });
    req.on("end", () => {
      if (size > limit) return;
      if (!chunks.length) return resolve({});
      if (!type.includes("application/json")) return reject(new HttpError(415, "json_required"));
      try { const v = JSON.parse(Buffer.concat(chunks).toString("utf8")); resolve(v && typeof v === "object" ? v : {}); }
      catch { reject(new HttpError(400, "bad_json")); }
    });
    req.on("error", reject);
  });
}

export const SECURITY_HEADERS = {
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
  "x-frame-options": "DENY",
  "permissions-policy": "camera=(self), microphone=(), geolocation=()",   // the camera is only for scanning event tickets, and the browser asks first
  "cross-origin-opener-policy": "same-origin-allow-popups",
  "cross-origin-resource-policy": "same-origin",
  "x-permitted-cross-domain-policies": "none",
  "content-security-policy": [
    "default-src 'self'", "script-src 'self'", "style-src 'self' 'unsafe-inline'",
    "font-src 'self'", "img-src 'self' data:", "connect-src 'self'",
    "frame-ancestors 'none'", "base-uri 'self'", "form-action 'self'", "object-src 'none'"
  ].join("; ")
};

export function send(req, res, status, body, headers = {}) {
  const isBuf = Buffer.isBuffer(body);
  let payload = isBuf ? body : typeof body === "string" ? Buffer.from(body) : Buffer.from(JSON.stringify(body));
  const h = { ...SECURITY_HEADERS, ...headers };
  if (!h["content-type"]) h["content-type"] = isBuf || typeof body === "string" ? "text/plain; charset=utf-8" : "application/json; charset=utf-8";
  if (!h["cache-control"]) h["cache-control"] = "no-store";
  if (payload.length > 1024 && /gzip/.test(String(req.headers["accept-encoding"] || "")) && /json|text|javascript|css|svg/.test(h["content-type"]) && !h["content-encoding"]) {
    payload = gzipSync(payload); h["content-encoding"] = "gzip"; h["vary"] = "accept-encoding";
  }
  h["content-length"] = payload.length;
  res.writeHead(status, h);
  res.end(req.method === "HEAD" ? undefined : payload);
}

/* Behind one trusted proxy (Render, Railway, Fly, nginx), the right-most X-Forwarded-For entry is the address
   the proxy itself saw, which a client cannot forge. Without TRUST_PROXY the header is ignored entirely. */
export function clientIp(req, trustProxy) {
  if (trustProxy) { const f = String(req.headers["x-forwarded-for"] || "").split(",").map(x => x.trim()).filter(Boolean); if (f.length) return f[f.length - 1]; }
  return req.socket.remoteAddress || "";
}

/* In-memory sliding-window limiter; fine for a single-process MVP. */
export function makeLimiter() {
  const hits = new Map();
  return function limit(key, max, windowMs) {
    const t = Date.now(), arr = (hits.get(key) || []).filter(x => t - x < windowMs);
    arr.w = windowMs;   // each key is pruned by its own window, so a flood of one-minute keys never wipes a daily count (fix review)
    if (arr.length >= max) { hits.set(key, arr); return false; }
    arr.push(t); hits.set(key, arr);
    if (hits.size > 50000) for (const [k, v] of hits) if (!v.length || t - v[v.length - 1] > v.w) hits.delete(k);
    return true;
  };
}
