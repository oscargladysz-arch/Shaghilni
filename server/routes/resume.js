/* Claude for the resume helper: wording suggestions for one job, and translation between Arabic and English.
   Only the seeker's own saved text is sent (never their name or phone number), every call counts against the
   daily AI caps, and every answer passes a fact check before it is returned. */
import { fail } from "../http.js";
import { J } from "../db.js";
import { getPublished } from "./public.js";

const TR_MAX_ITEMS = 60, TR_MAX_CHARS = 8000;
const LANG_NAME = { en: "English", ar: "Arabic" };

export function registerResume(r, { db, core, auth, cfg, limit, log, guard }) {
  function gate(ctx) {   // every AI call: switched on, rate-limited, and within today's caps
    if (!cfg.anthropicKey) fail(503, "ai_unavailable");
    if (!limit(`ai:${ctx.user.id}`, 10, 3600e3)) fail(429, "rate_limited");
    if (guard.usage("ai") >= cfg.aiDailyCap || guard.usage(`ai:${ctx.user.id}`) >= cfg.aiUserDailyCap) fail(429, "ai_capped");
  }
  function myProfile(ctx) {
    const p = db.get("SELECT data FROM profiles WHERE user_id = ?", ctx.user.id);
    const me = p && J(p.data);
    if (!me) fail(409, "profile_required");
    return me;
  }
  async function ask(ctx, prompt) {   // counted before the call, so failures count towards the caps too
    guard.bump("ai"); guard.bump(`ai:${ctx.user.id}`);
    let text;
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": cfg.anthropicKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({ model: cfg.claudeModel, max_tokens: 4000, messages: [{ role: "user", content: prompt }] }),
        signal: AbortSignal.timeout(90000)
      });
      if (res.status === 429) fail(429, "rate_limited");
      if (!res.ok) { log(`[ai] ${res.status} ${(await res.text()).slice(0, 300)}`); fail(502, "ai_error"); }
      const data = await res.json();
      text = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("");
    } catch (err) {
      if (err.status) throw err;
      log(`[ai] ${err.message}`); fail(502, "ai_error");
    }
    try { return JSON.parse(text.slice(text.indexOf("["), text.lastIndexOf("]") + 1)); } catch { fail(502, "ai_bad_json"); }
  }

  r.post("/api/resume/suggest", auth.need("seeker"), async ctx => {
    gate(ctx);
    const job = getPublished(db, Number(ctx.body.jobId));
    if (!job) fail(404, "not_found");
    const me = myProfile(ctx);
    const own = new Set([...me.exp, ...me.acts].flatMap(e => e.bullets || []));
    const items = (Array.isArray(ctx.body.items) ? ctx.body.items : []).slice(0, 30).map((x, i) => ({
      id: `b${i + 1}`, role: String((x && x.role) || "").slice(0, 120), current: !!(x && x.current), orig: String((x && x.text) || "")
    }));
    if (!items.length || items.some(x => !own.has(x.orig))) fail(422, "unknown_bullets");
    const filled = { ...job, title: fill2(job.title), co: fill2(job.co), duties: fillL(job.duties), needs: fillL(job.needs), summary: fill2(job.summary) };
    const arr = await ask(ctx, core.aiPrompt(filled, items));
    const facts = core.factsText(me), jt = core.jobPlain(filled);
    return { items: items.map(it => {
      const got = (Array.isArray(arr) ? arr : []).find(x => x && String(x.id) === it.id) || {};
      const sug = String(got.text || "").trim().slice(0, 400), q = String(got.question || "").trim().slice(0, 300);
      const check = !sug || core.norm(sug) === core.norm(it.orig) ? { ok: false, why: "gSame" } : core.factGuard(it.orig, sug, facts, jt);
      return { id: it.id, orig: it.orig, sug, q, ...check };
    }) };
  });

  /* Translates the saved resume text that isn't in the target language and has no translation yet.
     A translation is dropped if it changes, loses or invents a number, or if an English one contains Arabic. */
  r.post("/api/resume/translate", auth.need("seeker"), async ctx => {
    const to = ctx.body.to;
    if (to !== "en" && to !== "ar") fail(422, "bad_lang");
    gate(ctx);
    const me = myProfile(ctx);
    const done = new Set(((me.tr && me.tr[to]) || []).map(x => x[0]));
    const waiting = core.trSources(me).filter(s => core.scriptOf(s) !== to && !done.has(s));
    const todo = [];
    let chars = 0;
    for (const s of waiting) { if (todo.length >= TR_MAX_ITEMS || chars + s.length > TR_MAX_CHARS) break; todo.push(s); chars += s.length; }
    if (!todo.length) return { pairs: [], skipped: 0, left: 0 };
    const arr = await ask(ctx, trPrompt(todo, to));
    const pairs = [];
    let skipped = 0;
    todo.forEach((src, i) => {
      const got = (Array.isArray(arr) ? arr : []).find(x => x && Number(x.i) === i + 1);
      const t = String((got && got.t) || "").replace(/\s+/g, " ").trim().slice(0, 400);
      if (t && !(to === "en" && core.scriptOf(t) === "ar") && core.sameNumbers(src, t)) pairs.push([src, t]); else skipped++;
    });
    return { pairs, skipped, left: waiting.length - todo.length };
  });
}

function trPrompt(items, to) {
  const from = to === "en" ? "Arabic" : "English", target = LANG_NAME[to];
  return `You translate resume text for a job seeker in Syria from ${from} into ${target}.

Rules:
1. Translate each item on its own. Keep its exact meaning: add nothing, drop nothing, and don't make anything sound more senior or impressive than the original.
2. Keep every number exactly as written, in Western digits (0-9). Don't turn numbers into words or words into numbers.
3. ${to === "en" ? "Write natural resume English. Bullet points start with an action verb, in the same tense as the original." : "Write clear, formal Modern Standard Arabic suited to a resume, and keep it concise."}
4. Job titles: use the usual equivalent title. Company, organisation and university names: use the official ${target} name if there is a well-known one, otherwise transliterate. Keep software and product names such as Excel or AutoCAD in Latin letters.
5. If an item is already in ${target}, return it unchanged.

Items:
${JSON.stringify(items.map((text, i) => ({ i: i + 1, text })))}

Reply with only a JSON array, one object per item, in the same order:
[{"i": 1, "t": "the translation"}]`;
}
const fill2 = o => ({ en: (o && o.en) || (o && o.ar) || "", ar: (o && o.ar) || (o && o.en) || "" });
const fillL = o => ({ en: (o && o.en && o.en.length ? o.en : (o && o.ar) || []), ar: (o && o.ar && o.ar.length ? o.ar : (o && o.en) || []) });
