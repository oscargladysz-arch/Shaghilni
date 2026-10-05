/* Entry point: node server/index.js */
import http from "node:http";
import { loadConfig } from "./config.js";
import { openDb } from "./db.js";
import { createApp } from "./app.js";
import { seedDemo, countDemo } from "./seed.js";

const cfg = loadConfig();
const db = openDb(cfg.dbPath);
if (cfg.seedDemo) seedDemo(db);
if (cfg.prod) { const d = countDemo(db); if (d.companies || d.jobs) console.warn(`[seed] This production database still holds ${d.companies} sample companies and ${d.jobs} sample listings. Remove them before real employers arrive: npm run demo:remove`); }
const app = createApp({ cfg, db });
const swept = () => { try { const r = app.cleanup(); if (Object.values(r).some(Boolean)) console.log("[retention] removed", JSON.stringify(r)); } catch (err) { console.error("[retention]", err.message); } };
swept(); setInterval(swept, 3600e3).unref();
// Job alerts: check every hour; each alert is sent at most about once a day.
setInterval(() => { app.runAlerts().catch(err => console.error("[alerts]", err)); }, 3600e3).unref();
process.on("unhandledRejection", err => console.error("[error] unhandled rejection:", err && err.message));
process.on("uncaughtException", err => { console.error("[error] fatal:", err && err.stack); process.exit(1); });   // let the host restart a clean process
const server = http.createServer(app);
server.listen(cfg.port, cfg.host, () => {
  console.log(`Shaghilni running on http://localhost:${cfg.port} (${cfg.env}, SMS: ${cfg.sms.provider}, AI: ${cfg.anthropicKey ? cfg.claudeModel : "off"})`);
  if (!cfg.adminPhones.length) console.log("Tip: set ADMIN_PHONES to your mobile number to get the admin screens.");
});
const stop = () => { server.close(() => { db.close(); process.exit(0); }); setTimeout(() => process.exit(0), 3000).unref(); };
process.on("SIGINT", stop); process.on("SIGTERM", stop);
