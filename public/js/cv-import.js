/* ---------- importing a resume the person already has ----------
   Reads a PDF, Word (.docx) or text file in the browser, turns it into text and hands the text to
   parseResumeText. The file never leaves the device: only the fields the person keeps are saved, exactly as
   if they had typed them. */
const IMP = { busy: false, err: "", res: null, merged: null, file: "", where: "", note: "" };
const IMP_ACCEPT = ".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain";
const IMP_MAX = 8 * 1024 * 1024;
class ImportError extends Error { constructor(code) { super(code); this.code = code; } }

/* ----- decompression: keeps whatever came out, even if the data has junk at the end ----- */
async function inflateLoose(bytes, fmt) {
  const ds = new DecompressionStream(fmt), w = ds.writable.getWriter(), r = ds.readable.getReader(), parts = [];
  w.write(bytes).catch(() => {}); w.close().catch(() => {});
  try { for (;;) { const { value, done } = await r.read(); if (done) break; parts.push(value); } } catch (e) { /* truncated or trailing bytes: keep what we have */ }
  let n = 0; for (const p of parts) n += p.length;
  const out = new Uint8Array(n); let o = 0; for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

/* ----- Word: a .docx is a zip of XML files ----- */
async function zipFiles(bytes, want) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), out = new Map(), dec = new TextDecoder("utf-8");
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new ImportError("im_bad");
  const count = dv.getUint16(eocd + 10, true); let p = dv.getUint32(eocd + 16, true);
  for (let n = 0; n < count && p + 46 <= bytes.length; n++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const method = dv.getUint16(p + 10, true), size = dv.getUint32(p + 20, true), nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), off = dv.getUint32(p + 42, true);
    const name = dec.decode(bytes.subarray(p + 46, p + 46 + nl));
    p += 46 + nl + xl + cl;
    if (!want(name) || off + 30 > bytes.length || dv.getUint32(off, true) !== 0x04034b50) continue;
    const start = off + 30 + dv.getUint16(off + 26, true) + dv.getUint16(off + 28, true), data = bytes.subarray(start, start + size);
    if (method === 0) out.set(name, data); else if (method === 8) out.set(name, await inflateLoose(data, "deflate-raw"));
  }
  return out;
}
const xmlText = s => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d))).replace(/&amp;/g, "&");
function docxLines(xml) {
  xml = xml.replace(/<mc:Fallback>[\s\S]*?<\/mc:Fallback>/g, "");   // text boxes are stored twice; keep one copy
  const out = [];
  for (const chunk of xml.split(/<w:p(?=[\s>])/).slice(1)) {
    const end = chunk.indexOf("</w:p>"), p = end >= 0 ? chunk.slice(0, end) : chunk;
    let t = "";
    for (const m of p.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>|<w:tab\/>|<w:br(?:\s[^>]*)?\/>|<w:cr\/>/g)) t += m[1] !== undefined ? xmlText(m[1]) : m[0].startsWith("<w:tab") ? "\t" : "\n";
    if (!t.trim()) continue;
    const list = /<w:numPr>/.test(p) || /<w:pStyle w:val="(?:List|ListParagraph)/.test(p);
    t.split("\n").forEach((x, i) => { if (x.trim()) out.push((list && i === 0 ? "• " : "") + x); });
  }
  return out;
}
async function docxText(bytes) {
  const files = await zipFiles(bytes, n => n === "word/document.xml" || /^word\/header\d*\.xml$/.test(n));
  if (!files.has("word/document.xml")) throw new ImportError("im_bad");
  const dec = b => new TextDecoder("utf-8").decode(b);
  const head = [...files].filter(([n]) => n !== "word/document.xml").flatMap(([, b]) => docxLines(dec(b)));
  return [...head, ...docxLines(dec(files.get("word/document.xml")))].join("\n");
}

/* ----- PDF: find the pages' text, map each font's codes to letters, rebuild lines ----- */
const PDF_AR = /[\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff\ufb50-\ufdff\ufe70-\ufeff]/;
let PDF_WIN = null;
const pdfRefs = t => [...String(t || "").matchAll(/(\d+)\s+\d+\s+R/g)].map(m => Number(m[1]));
function pdfDict(text, key) {   // the balanced << ... >> value of /key
  const i = text.search(new RegExp("/" + key + "\\s*<<")); if (i < 0) return null;
  const j = text.indexOf("<<", i); let depth = 0;
  for (let k = j; k < text.length - 1; k++) {
    if (text[k] === "<" && text[k + 1] === "<") { depth++; k++; }
    else if (text[k] === ">" && text[k + 1] === ">") { depth--; k++; if (!depth) return text.slice(j + 2, k - 1); }
  }
  return null;
}
function pdfHex(h) {
  if (h.length % 4) { let s = ""; for (let i = 0; i + 1 < h.length; i += 2) s += String.fromCharCode(parseInt(h.slice(i, i + 2), 16)); return s; }
  let s = ""; for (let i = 0; i < h.length; i += 4) s += String.fromCharCode(parseInt(h.slice(i, i + 4), 16)); return s;
}
function pdfCMap(txt) {
  const map = new Map(); let bytes = 0;
  const cs = /begincodespacerange([\s\S]*?)endcodespacerange/.exec(txt);
  if (cs) { const h = /<([0-9a-fA-F]+)>/.exec(cs[1]); if (h) bytes = h[1].length / 2; }
  for (const b of txt.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) for (const p of b[1].matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]*)>/g)) map.set(parseInt(p[1], 16), pdfHex(p[2]));
  for (const b of txt.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) for (const p of b[1].matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*(?:<([0-9a-fA-F]+)>|\[([^\]]*)\])/g)) {
    const lo = parseInt(p[1], 16), hi = parseInt(p[2], 16);
    if (hi < lo || hi - lo > 6000) continue;
    if (p[3]) { const base = p[3], head = base.slice(0, -4), v0 = parseInt(base.slice(-4), 16); for (let c = lo; c <= hi; c++) map.set(c, base.length < 4 ? String.fromCharCode(parseInt(base, 16) + c - lo) : pdfHex(head + (v0 + c - lo).toString(16).padStart(4, "0"))); }
    else { const arr = [...p[4].matchAll(/<([0-9a-fA-F]*)>/g)].map(x => x[1]); for (let c = lo; c <= hi && c - lo < arr.length; c++) map.set(c, pdfHex(arr[c - lo])); }
  }
  return { map, bytes };
}
function pdfRuns(s, fonts, out, page) {
  const mul = (a, b) => [a[0] * b[0] + a[1] * b[2], a[0] * b[1] + a[1] * b[3], a[2] * b[0] + a[3] * b[2], a[2] * b[1] + a[3] * b[3], a[4] * b[0] + a[5] * b[2] + b[4], a[4] * b[1] + a[5] * b[3] + b[5]];
  const I = [1, 0, 0, 1, 0, 0], st = [], saved = [];
  let font = null, size = 12, tm = I, tlm = I, ctm = I, lead = 0, th = 1, tc = 0, tw = 0, i = 0;
  const n = s.length, DELIM = /[\s/<>\[\]()%{}]/;
  const show = items => {
    const f = font || { map: null, bytes: 1, w: new Map(), dw: 500 }, trm = mul(tm, ctm), units = [];
    let tx = 0;   // how far the text moves, in text space
    for (const it of items) {
      if (typeof it === "number") { if (it < -180) units.push(" "); tx -= (it / 1000) * size; continue; }
      for (let k = 0; k + f.bytes <= it.length; k += f.bytes) {
        const code = f.bytes === 2 ? (it.charCodeAt(k) << 8) | it.charCodeAt(k + 1) : it.charCodeAt(k);
        const u = f.map ? f.map.get(code) : PDF_WIN[code];
        if (u) units.push(u.normalize("NFKC"));
        tx += ((f.w.has(code) ? f.w.get(code) : f.dw) / 1000) * size + tc + (f.bytes === 1 && code === 32 ? tw : 0);
      }
    }
    tx *= th;
    const scale = Math.hypot(trm[0], trm[1]) || 1;
    if (units.length) out.push({ page, x: trm[4], y: trm[5], w: tx * scale, size: (size * Math.hypot(trm[2], trm[3])) || size, units });
    tm = mul([1, 0, 0, 1, tx, 0], tm);
  };
  while (i < n) {
    const c = s[i];
    if (c <= " ") { i++; continue; }
    if (c === "%") { while (i < n && s[i] !== "\n" && s[i] !== "\r") i++; continue; }
    if (c === "(") {
      let depth = 1, v = ""; i++;
      while (i < n && depth) {
        const ch = s[i];
        if (ch === "\\") {
          const nx = s[i + 1];
          if (nx >= "0" && nx <= "7") { let o = "", j = i + 1; while (j < i + 4 && s[j] >= "0" && s[j] <= "7") o += s[j++]; v += String.fromCharCode(parseInt(o, 8) & 255); i = j; continue; }
          if (nx === "\r" || nx === "\n") { i += 2; if (nx === "\r" && s[i] === "\n") i++; continue; }
          v += { n: "\n", r: "\r", t: "\t", b: "\b", f: "\f" }[nx] ?? nx; i += 2; continue;
        }
        if (ch === "(") depth++; else if (ch === ")" && !--depth) { i++; break; }
        v += ch; i++;
      }
      st.push({ str: v }); continue;
    }
    if (c === "<") {
      if (s[i + 1] === "<") { i += 2; continue; }
      const j = s.indexOf(">", i), hex = s.slice(i + 1, j < 0 ? n : j).replace(/\s+/g, ""); let v = "";
      for (let k = 0; k < hex.length; k += 2) v += String.fromCharCode(parseInt(hex[k] + (hex[k + 1] || "0"), 16));
      st.push({ str: v }); i = j < 0 ? n : j + 1; continue;
    }
    if (c === ">") { i += s[i + 1] === ">" ? 2 : 1; continue; }
    if (c === "[") { st.push({ open: true }); i++; continue; }
    if (c === "]") { const arr = []; while (st.length) { const v = st.pop(); if (v && v.open) break; arr.unshift(v); } st.push({ list: arr }); i++; continue; }
    if (c === "/") { let j = i + 1; while (j < n && !DELIM.test(s[j])) j++; st.push({ name: s.slice(i + 1, j) }); i = j; continue; }
    if ((c >= "0" && c <= "9") || c === "-" || c === "+" || c === ".") { let j = i + 1; while (j < n && ((s[j] >= "0" && s[j] <= "9") || s[j] === ".")) j++; st.push(Number(s.slice(i, j)) || 0); i = j; continue; }
    let j = i; while (j < n && !DELIM.test(s[j])) j++;
    const op = s.slice(i, j > i ? j : i + 1); i = j > i ? j : i + 1;
    const num = k => (typeof st[st.length - k] === "number" ? st[st.length - k] : 0), top = st[st.length - 1];
    switch (op) {
      case "BT": tm = tlm = I; break;
      case "Tf": { const nm = st[st.length - 2]; size = num(1); font = nm && nm.name ? fonts.get(nm.name) || null : null; break; }
      case "Tm": tm = tlm = [num(6), num(5), num(4), num(3), num(2), num(1)]; break;
      case "Td": tm = tlm = mul([1, 0, 0, 1, num(2), num(1)], tlm); break;
      case "TD": lead = -num(1); tm = tlm = mul([1, 0, 0, 1, num(2), num(1)], tlm); break;
      case "TL": lead = num(1); break;
      case "Tz": th = num(1) / 100; break;
      case "Tc": tc = num(1); break;
      case "Tw": tw = num(1); break;
      case "T*": tm = tlm = mul([1, 0, 0, 1, 0, -lead], tlm); break;
      case "Tj": if (top && top.str != null) show([top.str]); break;
      case "'": tm = tlm = mul([1, 0, 0, 1, 0, -lead], tlm); if (top && top.str != null) show([top.str]); break;
      case "\"": tw = num(3); tc = num(2); tm = tlm = mul([1, 0, 0, 1, 0, -lead], tlm); if (top && top.str != null) show([top.str]); break;
      case "TJ": if (top && top.list) show(top.list.map(x => (typeof x === "number" ? x : x && x.str != null ? x.str : null)).filter(x => x != null)); break;
      case "cm": ctm = mul([num(6), num(5), num(4), num(3), num(2), num(1)], ctm); break;
      case "q": saved.push(ctm); break;
      case "Q": ctm = saved.pop() || I; break;
      case "BI": { const e = s.indexOf("EI", i); i = e < 0 ? n : e + 2; break; }
    }
    st.length = 0;
  }
}
function pdfOrderScore(text) {   // how much the Arabic words look like they're in reading order
  let v = 0;
  for (const w of text.split(/\s+/)) {
    if (!PDF_AR.test(w)) continue;
    if (/^ال/.test(w)) v++; if (/[ةى]$/.test(w)) v++;
    if (/لا$/.test(w) && w.length > 3) v--; if (/^[ةى]/.test(w)) v -= 2;
  }
  return v;
}
// Arabic letters read right to left; Latin letters and all digits left to right; punctuation (Arabic too) and spaces take their neighbours' direction.
const PDF_RL = /[\u0621-\u064a\u064b-\u065f\u066e-\u06d3\u06d5-\u06ed\u06fa-\u06ff\u0750-\u077f\u08a0-\u08ff\ufb50-\ufd3d\ufd50-\ufdff\ufe70-\ufefc]/;
const pdfClass = u => (PDF_RL.test(u) ? "R" : /[A-Za-z0-9\u00c0-\u024f\u0660-\u0669\u06f0-\u06f9]/.test(u) ? "L" : "N");
function pdfFlip(units, rtl) {   // visual (left to right) order back to reading order
  const cls = units.map(pdfClass), n = units.length;
  if (rtl) {
    const segs = [];
    for (let i = 0; i < n;) {
      if (cls[i] !== "L") { segs.push(units[i]); i++; continue; }
      let j = i, last = i; while (j < n && cls[j] !== "R") { if (cls[j] === "L") last = j; j++; }
      segs.push(units.slice(i, last + 1).join("")); i = last + 1;
    }
    return segs.reverse().join("");
  }
  let out = "";
  for (let i = 0; i < n;) {
    if (cls[i] !== "R") { out += units[i]; i++; continue; }
    let j = i, last = i; while (j < n && cls[j] !== "L") { if (cls[j] === "R") last = j; j++; }
    out += units.slice(i, last + 1).reverse().join(""); i = last + 1;
  }
  return out;
}
function pdfArr(text, key) {   // the balanced [ ... ] value of /key
  const i = text.search(new RegExp("/" + key + "\\s*\\[")); if (i < 0) return null;
  const j = text.indexOf("[", i); let depth = 0;
  for (let k = j; k < text.length; k++) { if (text[k] === "[") depth++; else if (text[k] === "]" && !--depth) return text.slice(j + 1, k); }
  return null;
}
async function pdfText(bytes) {
  const s = new TextDecoder("latin1").decode(bytes);
  if (/\/Encrypt\s+\d+\s+\d+\s+R|\/Encrypt\s*<</.test(s)) throw new ImportError("im_locked");
  if (!PDF_WIN) PDF_WIN = new TextDecoder("windows-1252").decode(Uint8Array.from({ length: 256 }, (_, k) => k));
  const objs = new Map(), re = /(\d+)\s+(\d+)\s+obj\b/g; let m;
  while ((m = re.exec(s))) {
    const start = m.index + m[0].length, end = s.indexOf("endobj", start);
    if (end < 0) break;
    const body = s.slice(start, end), si = body.search(/\bstream\r?\n/);
    let dict = body, data = null;
    if (si >= 0) {
      dict = body.slice(0, si);
      const ds = start + si + /^stream\r?\n/.exec(body.slice(si))[0].length;
      let de = start + body.lastIndexOf("endstream");
      while (de > ds && (bytes[de - 1] === 10 || bytes[de - 1] === 13)) de--;
      data = [ds, de];
    }
    objs.set(Number(m[1]), { dict, data });
    re.lastIndex = end + 6;
  }
  const cache = new Map();
  const stream = async num => {
    if (cache.has(num)) return cache.get(num);
    const o = objs.get(num); let out = null;
    if (o && o.data) {
      const raw = bytes.subarray(o.data[0], o.data[1]), fm = /\/Filter\s*(\[[^\]]*\]|\/\w+)/.exec(o.dict), names = fm ? fm[1].match(/\/\w+/g) || [] : [];
      out = !names.length ? raw : names.length === 1 && names[0] === "/FlateDecode" ? await inflateLoose(raw, "deflate") : null;
    }
    cache.set(num, out); return out;
  };
  for (const [num, o] of [...objs]) if (/\/Type\s*\/ObjStm/.test(o.dict)) {   // objects packed inside other streams
    const d = await stream(num); if (!d) continue;
    const txt = new TextDecoder("latin1").decode(d), cnt = Number((/\/N\s+(\d+)/.exec(o.dict) || [])[1] || 0), first = Number((/\/First\s+(\d+)/.exec(o.dict) || [])[1] || 0);
    const nums = txt.slice(0, first).trim().split(/\s+/).map(Number);
    for (let k = 0; k < cnt; k++) { const on = nums[2 * k], off = nums[2 * k + 1], next = k + 1 < cnt ? nums[2 * k + 3] : txt.length - first; if (!objs.has(on)) objs.set(on, { dict: txt.slice(first + off, first + next), data: null }); }
  }
  const deref = t => { const r = /^\s*(\d+)\s+\d+\s+R/.exec(t || ""); return r ? (objs.get(Number(r[1])) || {}).dict || "" : t || ""; };
  const pages = [], seen = new Set();
  const walk = num => {
    if (seen.has(num)) return; seen.add(num);
    const o = objs.get(num); if (!o) return;
    if (/\/Type\s*\/Pages\b/.test(o.dict)) { const k = /\/Kids\s*\[([^\]]*)\]/.exec(o.dict); for (const c of pdfRefs(k && k[1])) walk(c); }
    else if (/\/Type\s*\/Page\b/.test(o.dict)) pages.push(num);
  };
  const root = [...objs].find(([, o]) => /\/Type\s*\/Pages\b/.test(o.dict) && !/\/Parent\s+\d+\s+\d+\s+R/.test(o.dict));
  if (root) walk(root[0]);
  if (!pages.length) for (const [num, o] of objs) if (/\/Type\s*\/Page\b/.test(o.dict)) pages.push(num);
  const resOf = (num, hops = 0) => {
    const o = objs.get(num); if (!o || hops > 8) return "";
    const r = /\/Resources\s+(\d+)\s+\d+\s+R/.exec(o.dict); if (r) return (objs.get(Number(r[1])) || {}).dict || "";
    const inl = pdfDict(o.dict, "Resources"); if (inl != null) return inl;
    const par = /\/Parent\s+(\d+)\s+\d+\s+R/.exec(o.dict); return par ? resOf(Number(par[1]), hops + 1) : "";
  };
  const fontCache = new Map();
  const fontOf = async num => {
    if (fontCache.has(num)) return fontCache.get(num);
    const o = objs.get(num), f = { map: null, bytes: 1, w: new Map(), dw: 500 };
    if (o) {
      const d = o.dict;
      if (/\/Subtype\s*\/Type0/.test(d)) {
        f.bytes = 2; f.dw = 1000;
        const df = pdfArr(d, "DescendantFonts"), cid = deref(df != null ? df.trim() : (/\/DescendantFonts\s+(\d+\s+\d+\s+R)/.exec(d) || [])[1]);
        const cd = /^\s*\[/.test(cid) ? deref(cid.replace(/^\s*\[|\]\s*$/g, "").trim()) : cid;
        const dw = /\/DW\s+([\d.]+)/.exec(cd); if (dw) f.dw = Number(dw[1]);
        let w = pdfArr(cd, "W"); if (w == null) { const wr = /\/W\s+(\d+\s+\d+\s+R)/.exec(cd); if (wr) w = deref(wr[1]).replace(/^\s*\[|\]\s*$/g, ""); }
        if (w) {
          const tok = w.match(/\[|\]|[\d.]+/g) || [];
          for (let k = 0; k < tok.length;) {
            const c0 = Number(tok[k]);
            if (tok[k + 1] === "[") { let c = c0; k += 2; while (k < tok.length && tok[k] !== "]") f.w.set(c++, Number(tok[k++])); k++; }
            else { const c1 = Number(tok[k + 1]), wv = Number(tok[k + 2]); if (c1 - c0 < 70000) for (let c = c0; c <= c1; c++) f.w.set(c, wv); k += 3; }
          }
        }
      } else {
        const fc = Number((/\/FirstChar\s+(\d+)/.exec(d) || [])[1] || 0);
        let ws = pdfArr(d, "Widths"); if (ws == null) { const wr = /\/Widths\s+(\d+\s+\d+\s+R)/.exec(d); if (wr) ws = deref(wr[1]).replace(/^\s*\[|\]\s*$/g, ""); }
        if (ws) (ws.match(/[\d.]+/g) || []).forEach((v, k) => f.w.set(fc + k, Number(v)));
        const mw = /\/MissingWidth\s+([\d.]+)/.exec(d); if (mw) f.dw = Number(mw[1]);
      }
      const tu = /\/ToUnicode\s+(\d+)\s+\d+\s+R/.exec(d);
      if (tu) { const cm = await stream(Number(tu[1])); if (cm) { const r = pdfCMap(new TextDecoder("latin1").decode(cm)); f.map = r.map; if (r.bytes) f.bytes = r.bytes; } }
    }
    fontCache.set(num, f); return f;
  };
  const runs = [];
  for (let pi = 0; pi < pages.length && pi < 20; pi++) {
    const o = objs.get(pages[pi]), res = resOf(pages[pi]);
    const fr = /\/Font\s+(\d+)\s+\d+\s+R/.exec(res), fbody = fr ? (objs.get(Number(fr[1])) || {}).dict || "" : pdfDict(res, "Font") || "";
    const fonts = new Map();
    for (const x of fbody.matchAll(/\/([^\s/<>\[\]()]+)\s+(\d+)\s+\d+\s+R/g)) fonts.set(x[1], await fontOf(Number(x[2])));
    const cr = /\/Contents\s*\[([^\]]*)\]/.exec(o.dict) || /\/Contents\s+(\d+\s+\d+\s+R)/.exec(o.dict);
    let parts = pdfRefs(cr && cr[1]);
    if (parts.length === 1 && objs.get(parts[0]) && !objs.get(parts[0]).data) parts = pdfRefs(objs.get(parts[0]).dict);
    let content = "";
    for (const c of parts) { const d = await stream(c); if (d) content += new TextDecoder("latin1").decode(d) + "\n"; }
    pdfRuns(content, fonts, runs, pi);
  }
  // Group the pieces of text into lines, top to bottom, and join pieces with a space only where there's a real gap.
  runs.sort((a, b) => a.page - b.page || b.y - a.y || a.x - b.x);
  const lines = [];
  for (const r of runs) {
    const L = lines[lines.length - 1];
    if (L && L.page === r.page && Math.abs(L.y - r.y) <= Math.max(1.5, 0.45 * Math.min(L.size, r.size))) L.runs.push(r);
    else lines.push({ page: r.page, y: r.y, size: r.size, runs: [r] });
  }
  const bounds = {};
  for (const L of lines) {
    L.runs.sort((a, b) => a.x - b.x);
    const u = []; let endX = null;
    for (const r of L.runs) {
      if (endX != null && r.x - endX > 0.15 * r.size && u[u.length - 1] !== " " && r.units[0] !== " ") u.push(" ");
      u.push(...r.units); endX = Math.max(endX == null ? -1e9 : endX, r.x + r.w);
    }
    L.units = u; L.x0 = L.runs[0].x; L.x1 = endX;
    L.ar = u.some(x => PDF_RL.test(x)); L.lat = u.some(x => /[A-Za-z]/.test(x));
    const B = bounds[L.page] || (bounds[L.page] = { l: 1e9, r: -1e9 });
    B.l = Math.min(B.l, L.x0); B.r = Math.max(B.r, L.x1);
  }
  // Which way does each line read? A line hugging the right margin reads right to left; one hugging the left, left to
  // right. Full-width or centred lines follow the document's main language.
  const docRtl = lines.filter(L => L.ar).length > lines.filter(L => L.lat && !L.ar).length;
  for (const L of lines) {
    const B = bounds[L.page], slackL = L.x0 - B.l, slackR = B.r - L.x1, tol = 2 * L.size;
    L.rtl = !L.ar ? false : slackR + tol < slackL ? true : slackL + tol < slackR ? false : docRtl;
  }
  // Most PDF makers store Arabic in drawing order. Decide from the lines that show it clearly, then apply to all.
  let vote = 0;
  for (const L of lines) if (L.ar) vote += Math.sign(pdfOrderScore(pdfFlip(L.units, L.rtl)) - pdfOrderScore(L.units.join("")));
  return lines.map(L => {
    if (!L.ar) return L.units.join("");
    const asIs = L.units.join(""), flipped = pdfFlip(L.units, L.rtl), a = pdfOrderScore(asIs), b = pdfOrderScore(flipped);
    return b > a || (b === a && vote >= 0) ? flipped : asIs;
  }).join("\n").replace(/[ \t]+/g, " ");
}
async function extractResumeText(bytes, name = "", type = "") {
  const lo = String(name).toLowerCase(), sig = String.fromCharCode(...bytes.subarray(0, 5));
  if (sig === "%PDF-") return pdfText(bytes);
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) { if (/\.(xlsx|pptx|odt|zip)$/.test(lo)) throw new ImportError("im_type"); return docxText(bytes); }
  if (bytes[0] === 0xd0 && bytes[1] === 0xcf) throw new ImportError("im_old_doc");
  if (/^image\//.test(type) || /\.(jpe?g|png|heic|webp|gif)$/.test(lo)) throw new ImportError("im_image");
  if (/\.(txt|text|md)$/.test(lo) || /^text\//.test(type)) return new TextDecoder("utf-8").decode(bytes);
  throw new ImportError("im_type");
}

/* ----- the upload card, used in onboarding and on the resume page ----- */
function importCardHTML(where) {
  const mine = IMP.where === where, busy = IMP.busy && mine;
  const msgs = html`${mine && IMP.err ? html`<p class="err" role="alert">${t("err_" + IMP.err)}</p>` : ""}${mine && IMP.note ? html`<p class="note im-note" role="status">${icon("check", 15)}<span>${IMP.note}</span></p>` : ""}`;
  // In sign-up it's a quiet shortcut under the fields, so Continue stays the one main button.
  if (where === "onb") return html`<div class="im-quiet-wrap"><label class="im-quiet"${busy ? raw(' aria-busy="true"') : ""}><span class="im-quiet-ic">${busy ? html`<span class="im-spin" aria-hidden="true"></span>` : icon("doc", 18)}</span>
<span class="im-quiet-t"><small>${t("imCardH")}</small><b>${busy ? t("imBusy") : t("imQuietCta")}</b><small>${t("imQuietP")}</small></span><input class="sr-only" type="file" accept="${IMP_ACCEPT}" data-import="onb"${busy ? raw(" disabled") : ""}></label>${msgs}</div>`;
  return html`<div class="im-card"><div class="im-txt"><p class="im-h">${icon("doc", 16)}<span>${t("imCardH")}</span></p><p class="im-p">${t("imCardP")}</p></div>
<label class="btn${where === "onb" ? " btn--primary" : " btn--soft"} im-btn"${busy ? raw(' aria-busy="true"') : ""}>${busy ? html`<span class="im-spin" aria-hidden="true"></span>${t("imBusy")}` : html`${icon("plus", 15)}${t("imPick")}`}<input class="sr-only" type="file" accept="${IMP_ACCEPT}" data-import="${where}"${busy ? raw(" disabled") : ""}></label>
${mine && IMP.err ? html`<p class="err" role="alert">${t("err_" + IMP.err)}</p>` : ""}${mine && IMP.note ? html`<p class="note im-note" role="status">${icon("check", 15)}<span>${IMP.note}</span></p>` : ""}</div>`;
}
function redrawImport(where) {
  if (where === "onb") { if (OB.open) renderOnb(); }
  else if (S.view === "resume") renderCvFacts();
}
function importSummary(added, res) {
  const parts = [];
  if (added.name) parts.push(t("imL_name"));
  if (added.email) parts.push(t("imL_email"));
  if (added.edu) parts.push(t("imL_edu"));
  if (added.exp) parts.push(t("imL_exp", { n: added.exp }));
  if (added.acts) parts.push(t("imL_acts", { n: added.acts }));
  if (added.skills) parts.push(t("imL_skills", { n: added.skills }));
  if (added.langs) parts.push(t("imL_langs"));
  if (added.certs) parts.push(t("imL_certs", { n: added.certs }));
  if (!parts.length) return t("imNothing");
  return [t("imOnbDone", { list: listJoin(parts) }), res.notes.approx ? t("imApprox") : "", res.notes.skipped ? t("imSkipped", { n: res.notes.skipped }) : ""].filter(Boolean).join(" ");
}
async function importFile(input) {
  const where = input.dataset.import, f = input.files && input.files[0];
  if (!f || IMP.busy) return;
  Object.assign(IMP, { where, err: "", note: "", busy: true, file: f.name, res: null });
  redrawImport(where);
  let res = null;
  try {
    if (f.size > IMP_MAX) throw new ImportError("im_big");
    const text = await extractResumeText(new Uint8Array(await f.arrayBuffer()), f.name, f.type);
    if (!text || text.replace(/\s+/g, "").length < 20) throw new ImportError("im_empty");
    res = parseResumeText(text);
    if (!res.found) throw new ImportError("im_nothing");
  } catch (err) { IMP.err = err instanceof ImportError ? err.code : "im_bad"; res = null; }
  IMP.busy = false;
  if (!res) { redrawImport(where); const b = document.querySelector(`[data-import="${where}"]`); if (b) b.focus(); return; }
  if (where === "onb") {
    const r = mergeImported(OB.d, res);
    OB.d = r.me; IMP.note = importSummary(r.added, res);
    saveDraft(); renderOnb();
    const nm = document.querySelector("#obName"); if (nm) nm.focus();
    return;
  }
  IMP.res = res; redrawImport(where); openImportReview();
}
function openImportReview() {
  const res = IMP.res; if (!res || !S.me) return;
  const { me, added } = mergeImported(S.me, res), e = res.edu || {};
  IMP.merged = me;
  const kept = t("imKept");
  const row = (ok, label, detail) => html`<li class="im-row${ok ? "" : " im-row--kept"}"><span class="im-ic" aria-hidden="true">${icon(ok ? "check" : "minus", 14, 2.4)}</span><span class="im-rt"><b>${label}</b>${detail ? html`<span class="im-d" dir="auto">${detail}</span>` : ""}</span></li>`;
  const ents = list => list.map(x => [x.role, x.org].filter(Boolean).join(sep())).join(" · ");
  const rows = [];
  if (res.name) rows.push(row(!!added.name, t("imName"), added.name || kept));
  if (res.email) rows.push(row(added.email, t("imEmail"), added.email ? res.email : kept));
  const eduVal = k => (k === "uni" ? (e.uni === "other" ? e.uniName : UNI[e.uni] ? L(UNI[e.uni]) : "") : k === "fac" ? (FAC[e.fac] ? L(FAC[e.fac]) : "") : k === "year" ? t("rcYearN", { n: e.year }) : String(e[k] || ""));
  if (e.uni || e.fac || e.grad) rows.push(row(added.eduFields.length > 0, t("imEdu"), added.eduFields.length ? added.eduFields.map(eduVal).filter(Boolean).join(sep()) : kept));   // only what's actually added
  if (res.exp.length) rows.push(row(added.exp > 0, t("imExp", { n: added.exp }), added.exp ? ents(me.exp.slice(-added.exp)) : kept));
  if (res.acts.length) rows.push(row(added.acts > 0, t("imActs", { n: added.acts }), added.acts ? ents(me.acts.slice(-added.acts)) : kept));
  if (res.skills.length) rows.push(row(added.skills > 0, t("imSkills", { n: added.skills }), added.skills ? me.skills.slice(-added.skills).join(", ") : kept));
  if (res.langs.length) rows.push(row(added.langs > 0, t("imLangs"), res.langs.map(k => L(LANGS[k])).join(", ")));
  if (res.certs.length) rows.push(row(added.certs > 0, t("imCerts", { n: added.certs }), added.certs ? me.certs.slice(-added.certs).join(" · ") : kept));
  layerOpen(html`${panelHead("imTitle", IMP.file)}<div class="p-body scroll"><ul class="im-list">${rows}</ul>
${res.notes.approx ? html`<p class="note">${icon("info", 15)}<span>${t("imApprox")}</span></p>` : ""}${res.notes.skipped ? html`<p class="note">${icon("info", 15)}<span>${t("imSkipped", { n: res.notes.skipped })}</span></p>` : ""}
<p class="fine">${t(added.any ? "imKeep" : "imNothing")}</p></div>
<div class="p-foot">${added.any ? html`<button class="btn btn--primary im-apply" type="button" data-act="im-apply" data-autofocus>${icon("check", 15, 2.4)}${t("imAdd")}</button>` : html`<button class="btn btn--primary im-apply" type="button" data-act="layer-close" data-autofocus>${t("close")}</button>`}</div>`, { label: t("imTitle") });
}
function importAct(act) {
  if (act !== "im-apply" || !IMP.merged) return;
  S.me = IMP.merged; IMP.merged = null; IMP.res = null;
  setProfile(S.me); saveMe(true);
  layerClose();
  toast({ title: t("tImported"), ic: "check" });
  if (S.view === "resume") renderResume();
}
