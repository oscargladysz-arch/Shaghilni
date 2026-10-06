# Shaghilni (شغّلني) · notes for agents working in this repo

Verified jobs and internships platform for Syria: Arabic-first, bilingual, built for cheap Android phones on slow data.
The MVP is built. The work is verifying it, closing verified gaps and keeping the docs true, not rebuilding it.
Before changing anything read `docs/agent/BRIEF.md` (the full brief: rules R1–R20, stages, backlog) and `docs/agent/STATE.md` (feature matrix, once Stage 0 writes it).

## Stack and commands
- Node ≥ 22.13, **zero npm dependencies**, built-in `node:sqlite`, server in ESM. Client = plain strict-mode scripts concatenated, fingerprinted and gzipped by `server/assets.js`. Strict CSP, no inline scripts, no third-party origins.
- `npm test` — the FULL suite (node:test, in-memory databases). Baseline 147 pass / 0 fail after Stage 3 (60 at Stage 0). Run the full suite, never a subset, before claiming anything passes.
- `npm run security:check` — scanner. With no environment it FAILs on `NODE_ENV` and `OTP_PEPPER` by design (it audits as production). With the fake production environment in `docs/agent/BASELINE.md` (use `LEGAL_NAME="Example Org (not a real entity)"`, R6) it exits 0 with one WARN ("live site not checked").
- Dev run: `OTP_DEV_ECHO=true SMS_PROVIDER=console DEMO_ACCOUNTS=true PORT=3000 DB_PATH=$(mktemp -d)/dev.db npm start`
- Browser e2e: `npm install --no-save puppeteer` then `npm run test:e2e`. Never commit package changes; delete any stray lockfile.
- Scripts that delete or rewrite data (`demo:remove`, `demo-accounts:purge`, `backup`, migrations) run only against `DB_PATH=$(mktemp -d)/t.db`.
- Never read, print or commit `.env`. Never point a run at `data/` or any real SMS, email, payment or Anthropic service.

## Rules most likely to be broken (all twenty are in the brief)
- **R1** No dependencies, no build step, no bundler, framework, TypeScript or transpiler. `package.json` stays untouched.
- **R3** Tests are the contract. The count only goes up. Never delete, skip, `.only`, loosen or special-case a test. A wrong test is fixed in its own `test:` commit with the reason. Paste failing output verbatim.
- **R9** Every user-visible string in BOTH `STR.en` and `STR.ar` (1,681 keys each, in sync, same `{placeholders}`). Logical CSS properties only (start/end). Log every new or changed Arabic string in `docs/agent/ARABIC_REVIEW.md`. Never edit the wording in `public/js/legal.js`: propose it in `docs/agent/LEGAL_PROPOSALS.md`.
- **R12** Every state-changing `/api` route needs the `x-shaghilni: 1` header plus the origin check. Every permission is checked on the server on every request. Privileged actions write the audit log. Logs never hold full phone numbers. SQL uses `?` placeholders; any built fragment carries `/* sql-safe: … */`.
- **R16** Smallest change that works. No refactors for taste, no renames of routes, columns or string keys, no file splits, no reformatting. The style is dense with long lines: match it.
- Also: R6 no invented facts (placeholders are obviously fake: `example.com`, `+963 9xx 000 xxx`); R7 product rules (seekers never pay, pay shown on every listing, consent gates who sees a person); R15 docs change in the same commit as behaviour; R18 never commit to `main`, never force-push, never push or open PRs unless told.

## Hot files (edit serially, never in parallel agents)
`public/js/i18n4.js` · `server/db.js` · `server/lite.js` · `server/app.js` · `server/assets.js` · `server/config.js` · `public/js/app.js` · `public/js/boot.js` · `public/css/app.css` · `public/js/engine.js` · `README.md` · `SECURITY.md`

## Gotchas
- `CLIENT_FILES` in `server/assets.js` fixes the client script order. A new client file must be inserted there, in the right place (`demo.js` is spliced in just before `boot.js`).
- `STR` values are not all strings: plural forms are objects. Any parity check must handle that. The Syrian-dialect overrides are the last block of `public/js/i18n4.js`.
- Route-policy rule (SECURITY.md, "Keeping this file true"): every new route needs a row in `test/policy/route-policy.js` (method, pattern, allowed roles). `test/policy-completeness.test.js` fails without it, and the row drives the generated cross-role, IDOR and junk-input tests (`test/policy-*.test.js`, harness in `test/policy/harness.js`). A new id-bearing route also needs a `fill()` rule and a `bodyFor()` body in the harness.
- `createRouter` in `server/http.js` keeps each route's pattern string and exposes `routes()`; `createApp` exposes it as `app.routes()` (read-only listing used by the policy tests).
- `public/js/engine.js` runs in the browser AND on the server (`server/core.js`, vm sandbox). A change there changes both sides: test both.
- Migrations (`MIGRATIONS` in `server/db.js`, 17 today) are append-only. A table rebuild copies migration 10 (foreign keys off → rebuild → `foreign_key_check` → on).
- Privacy is a four-file change: `public/js/legal.js`, `server/retention.js`, `TERMS_VERSION` in `server/config.js`, `SECURITY.md`.
- Scanner markers: `/* sql-safe: … */` on template SQL, `html-safe` on a raw HTML write. The scanner skips `test/`.
- `seedDemo` in `server/config.js` is `!prod && SEED_DEMO !== "false"`: sample listings (under real organisations' names, owner decision D1) are never seeded in production. Leftover rows are counted by `countDemo` in `server/seed.js`, logged at start and shown on the Insights screen (Stage 1, D-01).
- Lite (`/lite/*`, `server/lite.js`) is server-rendered and calls the same handlers in-process. First visit < 15 KB, about 2–3 KB a page after (a test checks). Its privacy notice and terms are at `/lite/privacy` and `/lite/terms` (the same `LEGAL` texts, loaded by `server/core.js`), outside the per-page budget.
- Demo hooks are marked `// demo-accounts`; `npm run demo-accounts:uninstall` must keep working.
- Route modules export `registerX(r, deps)`; handlers take `ctx`; errors are `fail(status, code, detail)`; role guards are middleware. Flexible fields live as JSON in `data` columns.

## Where things are
- Product: `PRODUCT.md` (keep the `<!-- impeccable:product-schema 1 -->` marker). Design: `DESIGN.md` (keep its front matter) and `.impeccable/design.json`.
- Security and privacy: `SECURITY.md`. Setup, deploy, API: `README.md`.
- Agent records: `docs/agent/BRIEF.md`, `STATE.md`, `BASELINE.md`, `ROUTES.md`, `DEFECTS.md`, `DOC_DRIFT.md`, `PLAN.md`, `ASSUMPTIONS.md`, `QUESTIONS.md`, `ARABIC_REVIEW.md`.
