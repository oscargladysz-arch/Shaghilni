/* Design ratchets (R10, DESIGN.md): counts of known design-rule violations in the shipped files, measured by small
   deterministic scanners and ratcheted in test/ratchets.json under "design": each count may only go down. A rise fails
   with the file:line of every occurrence; a fall is logged so the number can be lowered in the same commit (never
   refactor the violations themselves here, the brief forbids it). Counted: colours written as literals outside the
   :root token block of public/css/app.css (hex, named white/black, rgb()/rgba(), and var(--x, colour) fallbacks, each
   in its own bucket, a literal inside a var() fallback counted only as a fallback), font-size under 12 px (px, and
   rem/em/% at the 16 px root size; every cqw size counts because the .paper container is capped at 720 px, app.css
   .stage, where 1.3–1.5cqw is 9–11 px and 3.3cqw falls under 12 px below 364 px), physical left/right properties,
   colour literals in public/js/app*.js and in Lite's inline HTML/CSS (server/lite.js, server/lite-assets.js outside
   its own :root blocks), and emoji or text-symbol glyphs in string literals of public/js/*.js (icons must be SVG). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const ROOT = new URL("../", import.meta.url);
const read = p => readFileSync(new URL(p, ROOT), "utf8");
const RATCHETS = new URL("./ratchets.json", import.meta.url);
const lineOf = (src, i) => src.slice(0, i).split("\n").length;
const stripComments = src => src.replace(/\/\*[\s\S]*?\*\//g, c => c.replace(/[^\n]/g, " "));   // keeps line numbers
const HEX = /#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})(?![\w-])/gi;
const NAMED = /\b(?:white|black)\b(?!-)/gi;
const RGB = /\b(?:rgba?|hsla?)\(/gi;
const COLOURISH = /^(?:#[0-9a-f]{3,8}|rgba?\(|hsla?\(|white|black)/i;
const FALLBACK = /var\(\s*--[\w-]+\s*,\s*([^()]*(?:\([^()]*\)[^()]*)*)\)/g;
const GLYPH = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2300}-\u{23FF}\u{25A0}-\u{25FF}\u{2B00}-\u{2BFF}\u{FE0F}]/u;

/* The CSS split into declaration segments (text ending in ";" or "}") with the offset of each, so selectors and
   at-rules (text ending in "{") are never scanned: an id selector like #cad is not a colour. */
function declarations(css) {
  const out = []; let start = 0;
  for (let i = 0; i < css.length; i++) {
    const c = css[i];
    if (c === "{" || c === ";" || c === "}") { if (c !== "{" && css.slice(start, i).trim()) out.push({ at: start, text: css.slice(start, i) }); start = i + 1; }
  }
  return out;
}
/* The :root token block of app.css: from the first ":root{" line through the closing brace of the ":root[data-theme="dark"]"
   block. Every line in it must be a :root/@media opener, a closing brace or an indented declaration, which proves the
   range holds nothing but :root rules before the rest of the file is scanned. */
function tokenBlock(lines) {
  const first = lines.findIndex(l => /^:root\{/.test(l)), dark = lines.findIndex((l, i) => i > first && /^:root\[data-theme="dark"\]\{/.test(l));
  assert.ok(first >= 0 && dark > first, "app.css has the light and dark :root token blocks");
  const last = lines.findIndex((l, i) => i > dark && /^\}\}?$/.test(l));
  for (let i = first; i <= last; i++) assert.match(lines[i], /^(?::root|@media|\}|\s+[\w-]+:)/, `app.css:${i + 1} is inside the token block but is not a :root line`);
  return { first: first + 1, last: last + 1 };   // 1-based, inclusive
}
function cssOutsideTokens() {
  const src = stripComments(read("public/css/app.css")), lines = src.split("\n"), block = tokenBlock(lines);
  const kept = lines.map((l, i) => i + 1 >= block.first && i + 1 <= block.last ? "" : l).join("\n");
  return { src: kept, block, decls: declarations(kept) };
}
const sizePx = (n, unit) => unit === "px" ? n : unit === "rem" || unit === "em" ? n * 16 : unit === "%" ? n * 16 / 100 : NaN;

function ratchet(name, found, counts) {
  const r = (JSON.parse(readFileSync(RATCHETS, "utf8")).design || {})[name];
  const list = found.map(f => `${f.where} ${f.what}`).join("\n  ");
  assert.ok(Number.isInteger(r), `test/ratchets.json needs design.${name}; measured now: ${found.length}\n  ${list}`);
  console.log(`design.${name}: ${found.length} (ratchet ${r})`);
  assert.ok(found.length <= r, `design.${name} went up from ${r} to ${found.length}; every occurrence:\n  ${list}`);
  if (found.length < r) console.log(`design.${name} fell: lower test/ratchets.json to ${found.length}`);
  counts[name] = found.length;
}

test("ratchets: hard-coded colours outside the token block of app.css (hex, named, rgb, var fallbacks)", () => {
  const { src, block, decls } = cssOutsideTokens();
  console.log(`app.css token block: lines ${block.first}-${block.last} (excluded)`);
  const hex = [], named = [], rgb = [], fallbacks = [];
  for (const d of decls) {
    const where = `public/css/app.css:${lineOf(src, d.at + d.text.search(/\S/))}`;
    const rest = d.text.replace(FALLBACK, (m, fb) => { if (COLOURISH.test(fb.trim())) { fallbacks.push({ where, what: m }); return "var(--x)"; } return m; });
    for (const m of rest.match(HEX) || []) hex.push({ where, what: m });
    for (const m of rest.match(NAMED) || []) named.push({ where, what: m });
    for (const m of rest.match(RGB) || []) rgb.push({ where, what: m });
  }
  const counts = {};
  ratchet("cssHex", hex, counts); ratchet("cssNamed", named, counts); ratchet("cssRgb", rgb, counts); ratchet("cssVarFallbacks", fallbacks, counts);
});

test("ratchets: font-size under 12px in app.css (px, rem, em, %, and every cqw size)", () => {
  const { src, decls } = cssOutsideTokens();
  const small = [], seen = [];
  for (const d of decls) {
    const m = /^\s*font(?:-size)?\s*:\s*(.+)$/s.exec(d.text); if (!m) continue;
    const size = /(?:^|\s)(\d*\.?\d+)(px|rem|em|%|cqw|cqi|vw|vh|vmin)(?=[\s/]|$)/.exec(m[1]); if (!size) continue;   // inherit, keywords, clamp(): not a literal size
    const where = `public/css/app.css:${lineOf(src, d.at + d.text.search(/\S/))}`, n = Number(size[1]), unit = size[2], px = sizePx(n, unit);
    seen.push(where);
    if (!(unit === "px" || unit === "rem" || unit === "em" || unit === "%")) small.push({ where, what: `${d.text.trim()} (container/viewport-relative: computes under 12px on narrow screens)` });
    else if (px < 12) small.push({ where, what: `${d.text.trim()} (= ${px}px at the 16px root)` });
  }
  assert.ok(seen.length > 100, `the scanner saw the font sizes (${seen.length})`);
  ratchet("cssSmallFontSizes", small, {});
});

test("ratchets: physical left/right properties in app.css", () => {
  const { src, decls } = cssOutsideTokens();
  const found = [];
  for (const d of decls) {
    const t = d.text.trim(), where = `public/css/app.css:${lineOf(src, d.at + d.text.search(/\S/))}`;
    if (/^(?:margin-left|margin-right|padding-left|padding-right|left|right|float|border-left(?:-[a-z]+)?|border-right(?:-[a-z]+)?|border-(?:top|bottom)-(?:left|right)-radius)\s*:/.test(t) || /^text-align\s*:\s*(?:left|right)\b/.test(t)) found.push({ where, what: t });
  }
  ratchet("cssPhysicalProps", found, {});
});

/* JavaScript string literals (double, single and template quotes, a template's ${} text included so a nested
   literal is seen once) and the source with its comments blanked, offsets preserved. Regex literals are not parsed:
   a quote inside one mis-pairs for the rest of that line, which a rising count shows by file:line. */
function tokens(src) {
  const lits = []; let code = src, i = 0;
  const blank = (a, b) => { code = code.slice(0, a) + code.slice(a, b).replace(/[^\n]/g, " ") + code.slice(b); };
  const template = j => { let depth = 0; for (j++; j < src.length; j++) { const x = src[j]; if (x === "\\") { j++; continue; } if (depth === 0 && x === "`") return j; if (x === "$" && src[j + 1] === "{") { depth++; j++; continue; } if (depth > 0) { if (x === "{") depth++; else if (x === "}") depth--; else if (x === "`") j = template(j); } } return j; };
  while (i < src.length) {
    const c = src[i], d = src[i + 1];
    if (c === "/" && d === "/") { let e = src.indexOf("\n", i); if (e < 0) e = src.length; blank(i, e); i = e; continue; }
    if (c === "/" && d === "*") { let e = src.indexOf("*/", i + 2); e = e < 0 ? src.length : e + 2; blank(i, e); i = e; continue; }
    if (c === '"' || c === "'") { let j = i + 1; while (j < src.length && src[j] !== c && src[j] !== "\n") j += src[j] === "\\" ? 2 : 1; lits.push({ at: i, text: src.slice(i, j + 1) }); i = j + 1; continue; }
    if (c === "`") { const j = template(i); lits.push({ at: i, text: src.slice(i, j + 1) }); i = j + 1; continue; }
    i++;
  }
  return { lits, code };
}
/* Hex colours in the code, each at its own line. A literal that starts with "#" and is a function argument is a
   selector ($("#caPhone")), not a colour, and a fragment reference like href="#check" is not hex at all. */
function hexInCode(src, where) {
  const { code } = tokens(src), out = []; let m;
  while ((m = HEX.exec(code))) {
    const q = code[m.index - 1], before = /["'`]/.test(q || "") ? code.slice(0, m.index - 1).trimEnd().slice(-1) : "";
    if (before !== "(") out.push({ where: `${where}:${lineOf(code, m.index)}`, what: m[0] });
  }
  return out;
}

test("ratchets: colour literals in the client scripts (public/js/app*.js) and in Lite's inline HTML and CSS", () => {
  const js = [];
  for (const f of readdirSync(new URL("public/js/", ROOT)).filter(f => /^app(?:-[a-z]+)?\.js$/.test(f)).sort()) js.push(...hexInCode(read(`public/js/${f}`), `public/js/${f}`));
  const lite = hexInCode(read("server/lite.js"), "server/lite.js");
  const raw = read("server/lite-assets.js"), assets = raw.replace(/:root\{[^}]*\}/g, s => " ".repeat(s.length));   // Lite's own token blocks, blanked
  assert.ok(raw.includes(":root{--a:") && !assets.includes("--a:"), "lite-assets.js has the Lite CSS with its :root token block, and the scan skips it");
  const liteAssets = []; let m;
  while ((m = HEX.exec(assets))) liteAssets.push({ where: `server/lite-assets.js:${lineOf(assets, m.index)}`, what: m[0] });
  const counts = {};
  ratchet("jsHex", js, counts); ratchet("liteHex", lite, counts); ratchet("liteAssetsHex", liteAssets, counts);
});

test("ratchets: emoji or text-symbol glyphs used as icons in string literals of public/js/*.js", () => {
  const found = [];
  for (const f of readdirSync(new URL("public/js/", ROOT)).filter(f => f.endsWith(".js")).sort()) {
    const src = read(`public/js/${f}`);
    for (const l of tokens(src).lits) if (GLYPH.test(l.text)) found.push({ where: `public/js/${f}:${lineOf(src, l.at + l.text.search(GLYPH))}`, what: l.text.slice(0, 60) });
  }
  ratchet("jsGlyphIcons", found, {});
});
