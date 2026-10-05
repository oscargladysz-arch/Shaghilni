/* Builds the client bundle: plain scripts concatenated into one strict-mode file, fingerprinted and gzipped. */
import { readFileSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import path from "node:path";
import { ROOT } from "./config.js";

export const CLIENT_FILES = ["lookups.js", "i18n.js", "i18n2.js", "i18n3.js", "i18n4.js", "engine.js", "motion.js",
  "api.js", "pow.js", "app.js", "app-account.js", "app-seeker.js", "app-resume.js", "cv-import.js", "app-employer.js", "app-plans.js", "app-campus.js", "app-events.js", "app-team.js", "app-insights.js", "app-traffic.js", "app-admin.js", "app-audit.js", "app-recruit.js", "app-alerts.js", "legal.js", "boot.js"];
CLIENT_FILES.splice(CLIENT_FILES.includes("boot.js") ? CLIENT_FILES.indexOf("boot.js") : CLIENT_FILES.length, 0, "demo.js");   // demo-accounts (loads before the app starts)
const pub = (...p) => path.join(ROOT, "public", ...p);

export function makeAssets({ prod }) {
  let cache = null, stamp = "";
  const mtimes = () => [...CLIENT_FILES.map(f => pub("js", f)), pub("css", "app.css"), pub("index.html"), pub("js", "theme.js")]
    .map(f => { try { return statSync(f).mtimeMs; } catch { return 0; } }).join(",");
  function build() {
    const js = '(() => {\n"use strict";\n' + CLIENT_FILES.map(f => `/* ${f} */\n` + readFileSync(pub("js", f), "utf8")).join("\n") + "\n})();\n";
    const css = readFileSync(pub("css", "app.css"), "utf8");
    const theme = readFileSync(pub("js", "theme.js"), "utf8");
    const h = s => createHash("sha256").update(s).digest("hex").slice(0, 10);
    const files = {
      [`/assets/app.${h(js)}.js`]: { type: "application/javascript; charset=utf-8", body: Buffer.from(js) },
      [`/assets/app.${h(css)}.css`]: { type: "text/css; charset=utf-8", body: Buffer.from(css) },
      [`/assets/theme.${h(theme)}.js`]: { type: "application/javascript; charset=utf-8", body: Buffer.from(theme) }
    };
    for (const f of Object.values(files)) f.gz = gzipSync(f.body, { level: 9 });
    const names = Object.keys(files);
    const html = readFileSync(pub("index.html"), "utf8")
      .replace("__APP_JS__", names.find(n => n.endsWith(".js") && n.includes("/app.")))
      .replace("__APP_CSS__", names.find(n => n.endsWith(".css")))
      .replace("__THEME_JS__", names.find(n => n.includes("/theme.")));
    const favicon = readFileSync(pub("favicon.svg"));
    return { files, html: Buffer.from(html), htmlGz: gzipSync(Buffer.from(html)), favicon };
  }
  return function get() {
    if (!cache || (!prod && (stamp !== mtimes()))) { stamp = mtimes(); cache = build(); }
    return cache;
  };
}
