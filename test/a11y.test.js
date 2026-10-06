/* Static accessibility checks (Stage 4, S4-4) against the standard PRODUCT.md and DESIGN.md state (WCAG AA, the 12 px
   floor, keyboard and screen readers). They read the shipped files, so they prove the markup and the stylesheet, not
   what a screen reader says: TalkBack on real phones stays a human step (docs/LAUNCH.md G1). Checked: every dialog has
   an accessible name, statically in public/index.html or, for the account popover #pop, set at render time in
   public/js/app.js (U-184); the filter counts (.seg-n) are not dimmed below the Muted Ink token with an opacity (U-056:
   12 px text at 2.7:1); the event date tile carries the full date for screen readers instead of hiding the only date in
   the row (U-146); and the loading ring stops under prefers-reduced-motion, as the import spinner already does. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = p => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const stripComments = src => src.replace(/\/\*[\s\S]*?\*\//g, "");
/* Every balanced block that follows the given at-rule prelude, e.g. "@media (prefers-reduced-motion:reduce)". */
function atBlocks(css, prelude) {
  const out = []; let i = css.indexOf(prelude);
  while (i >= 0) {
    const open = css.indexOf("{", i); let depth = 0, j = open;
    for (; j < css.length; j++) { if (css[j] === "{") depth++; else if (css[j] === "}" && --depth === 0) break; }
    out.push(css.slice(open + 1, j)); i = css.indexOf(prelude, j);
  }
  return out;
}

test("a11y: every role=\"dialog\" in index.html has an accessible name, statically or set by app.js at render time (U-184)", () => {
  const html = read("public/index.html"), app = read("public/js/app.js");
  const dialogs = [...html.matchAll(/<\w+[^>]*\brole="dialog"[^>]*>/g)].map(m => m[0]);
  assert.ok(dialogs.length >= 3, "the panel, the account popover and the onboarding sheet are dialogs");
  for (const tag of dialogs) {
    const id = (tag.match(/\bid="([^"]+)"/) || [])[1];
    const named = /\baria-label(?:ledby)?="[^"]+"/.test(tag) || (id && app.includes(`$("#${id}").setAttribute("aria-label"`));
    assert.ok(named, `${tag} has no accessible name`);
  }
});

test("a11y: filter counts (.seg-n) keep the Muted Ink contrast: no opacity on 12 px text (U-056, DESIGN.md Ink Floor)", () => {
  const css = stripComments(read("public/css/app.css"));
  const rule = css.match(/\.seg-n\{([^}]*)\}/);
  assert.ok(rule, ".seg-n rule exists");
  assert.doesNotMatch(rule[1], /opacity/, ".seg-n dims the count below Muted Ink (2.7:1 at 70% opacity)");
});

test("a11y: the event date tile carries the full date for screen readers instead of hiding the only date in the row (U-146)", () => {
  const src = read("public/js/app-events.js");
  const tile = src.match(/class="ev-date"[^>]*>/);
  assert.ok(tile, "the ev-date tile exists");
  assert.doesNotMatch(tile[0], /aria-hidden="true"/, "the date tile is hidden from screen readers and no other date is in the row");
  assert.match(tile[0], /role="img" aria-label="\$\{w\.full\}"/, "the tile is announced once as the full date");
});

test("a11y: the loading ring (.spin) stops under prefers-reduced-motion, like the import spinner", () => {
  const css = stripComments(read("public/css/app.css"));
  const blocks = atBlocks(css, "@media (prefers-reduced-motion:reduce)");
  assert.ok(blocks.length >= 2, "reduced-motion blocks exist");
  const stops = sel => blocks.some(b => [...b.matchAll(/([^{}]+)\{([^}]*)\}/g)].some(([, s, d]) => s.split(",").map(x => x.trim()).includes(sel) && /animation:none/.test(d)));
  assert.ok(stops(".im-spin"), ".im-spin stops (the existing rule)");
  assert.ok(stops(".spin"), ".spin keeps rotating under prefers-reduced-motion");
});
