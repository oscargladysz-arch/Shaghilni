/* Consistent backup while the site keeps running: VACUUM INTO writes a compact copy of the database.
   Usage: npm run backup [-- /path/to/folder]   (default folder: ./backups) */
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { loadConfig, ROOT } from "../server/config.js";

const cfg = loadConfig();
const dir = path.resolve(process.argv[2] || path.join(ROOT, "backups"));
mkdirSync(dir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 16);
const out = path.join(dir, `shaghilni-${stamp}.db`);
const db = new DatabaseSync(cfg.dbPath);
db.exec(/* sql-safe: operator-supplied path, quotes escaped */ `VACUUM INTO '${out.replace(/'/g, "''")}'`);
db.close();
console.log(`Backup written: ${out}`);
