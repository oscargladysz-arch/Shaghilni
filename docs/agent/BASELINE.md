# Baseline · Stage 0.4 · measured 2026-10-04

**Superseded in part by Stage 1 (record kept as measured).** After Stage 1: `npm test` → 66 pass; the scanner with no environment prints two FAILs (`NODE_ENV` and `OTP_PEPPER`); the `SEED_DEMO` WARN no longer exists; the fake production environment uses `LEGAL_NAME="Example Org (not a real entity)"` and still exits 0 with one WARN. The Stage 1 gate report and `docs/agent/STATE.md` carry the current numbers.

Measured in this session, not copied from the brief. Commit `b8425b2` ("Initial commit: Shaghilni MVP"), branch `stage-0/ground-truth` (identical to `main` and `origin/main`). Node v22.22.0, npm 10.9.4. No `node_modules`, no lockfile.

## Commands run

| Command | Result (verbatim tail) |
|---|---|
| `npm test` | `# tests 60` · `# pass 60` · `# fail 0` · `# cancelled 0` · `# skipped 0` · `# duration_ms 10264` · exit 0 |
| `env -i … npm run security:check` (no environment) | `FAIL  OTP_PEPPER must be set in production to a random secret of at least 32 characters.` · `WARN  Live site not checked` · `1 failed, 1 warnings, 2 passed` · exit 1 |
| scanner, fake production env, `SEED_DEMO=false` | `0 failed, 1 warnings, 11 passed` · the one WARN is `Live site not checked: add --url https://your-site once it's deployed` · exit 0 |
| scanner, fake production env, `SEED_DEMO` unset | `0 failed, 2 warnings, 11 passed` · extra WARN: `Demo listings are on (SEED_DEMO): remove them before real employers arrive (npm run demo:remove)` · exit 0 |

Fake production environment used (obviously fake values, no secrets):

```
NODE_ENV=production OTP_PEPPER=pppppppppppppppppppppppppppppppppppppppp BASE_URL=https://shaghilni.test
ADMIN_PHONES=+963944000000 SMS_PROVIDER=textbee TEXTBEE_API_KEY=key CONTACT_EMAIL=privacy@example.com
LEGAL_NAME="Shaghilni LLC" TRUST_PROXY=true SEED_DEMO=false
```

Full scanner output (fake production env, `SEED_DEMO=false`):

```
Settings checked: environment variables (as production)
PASS  No API keys, tokens or private keys in the code
PASS  No unreviewed SQL building, raw HTML writes, eval or shell calls
PASS  OTP_PEPPER is long enough and BASE_URL uses https
PASS  ADMIN_PHONES has 1 number(s)
PASS  Texts go out through textbee
PASS  Sign-in texts only go to +963, +49, +90, +961, +962, +964, +20, +971, +966, +974, +965, +46, +31, +43, +45, +47, +33, +32, +44, +1
PASS  Daily text cap: 1000
PASS  Proof-of-work difficulty: 14 bits
PASS  Privacy contact: privacy@example.com
PASS  Legal name: Shaghilni LLC
PASS  TRUST_PROXY is on (right behind Render, Railway, Fly, nginx or Caddy)
WARN  Live site not checked: add --url https://your-site once it's deployed

0 failed, 1 warnings, 11 passed
```

## Tests per file (from the 60-test run)

| File | Tests |
|---|---|
| api | 11 |
| security | 12 |
| import | 6 |
| lite | 4 |
| payments | 4 |
| plans | 4 |
| campus | 3 |
| demo | 3 |
| diaspora | 3 |
| events | 3 |
| recruit | 2 |
| team | 2 |
| contact | 1 |
| insights | 1 |
| traffic | 1 |

## Re-verification of the brief's `<verified_facts>`

| # | Claim | Status | Evidence |
|---|---|---|---|
| 1 | 60 tests pass; README and SECURITY.md say "34 test groups" | CONFIRMED (duration differs: ~10 s here, not ~17 s) | run above; `README.md:230`, `SECURITY.md:8` |
| 2 | Scanner fails on `OTP_PEPPER` with no env; exits 0 with one WARN in the fake production env | CONFIRMED | runs above |
| 3 | `seedDemo` has no production gate; 17 companies / 19 listings; real organisations' names | CONFIRMED | `server/config.js:66` `seedDemo: e.SEED_DEMO !== "false"`; `server/index.js:10` `if (cfg.seedDemo) seedDemo(db)`; `seed/demo.json` → `companies` 17, `jobs` 19; names include Chevron, ConocoPhillips, Deloitte, Al Jazeera, Syrian Arab Red Crescent, Syriatel, UNDP Syria, Bank of Syria and Overseas, Latakia University. Also: `Dockerfile` sets `NODE_ENV=production` and copies `seed/`, so the container seeds by default. |
| 4 | Hard-coded list of ~35 routes in the security matrix vs 109 registered; router stores only a regex | CONFIRMED | `test/security.test.js:152-160` (35 entries); registrations: routes/* 99 + `server/traffic.js` 4 + `server/alerts.js` 5 + `server/demo.js` 1 = 109; `server/http.js:10-15` keeps `{ method, re, keys, handlers }` only |
| 5 | `STR.en` and `STR.ar` have 1,646 keys each, in sync | CONFIRMED (and: 0 placeholder mismatches, 0 empty Arabic; 21 Arabic values have no Arabic letters, mostly plural-form objects, brand names and placeholders) | vm evaluation of `lookups.js` + `i18n*.js` |
| 6 | No `.github/` directory | CONFIRMED | `ls -la .github` → none |
| 7 | Only TODOs are QNB in `server/payments.js` | CONFIRMED | `grep -rnE "TODO\|FIXME\|XXX"` over server, public/js, scripts, test → only `server/payments.js:37` and `:43`; `server/payments.js:34` `const ready = false` |
| 8 | Docs contradict themselves | CONFIRMED | `README.md:155` "The app has no pages for these yet"; `README.md:245-256` "Not built yet" lists the career-office portal, applying by phone call, resume file uploads, several people per employer account, email, paid plans; `SECURITY.md:3` "last reviewed on 28 September 2026" |
| 9 | Audit screen, listing editing, Telegram, public resume links, Lite events/campus/teams absent; Lite legal links point at `/#/…` | CONFIRMED for the parts checked: no client file references `admin/audit`; no `PUT/POST /api/admin/jobs/:id` edit route in `server/routes/admin.js`; Lite footer and consent box link to `/#/privacy` and `/#/terms` at `server/lite.js:144` and `:450`. Telegram, public resume links and Lite events/campus/teams: to be confirmed by the Stage 0 map (areas 11, 12). | greps listed |
| 10 | e2e and live scanner not run | CONFIRMED here too | puppeteer not installed; a Chromium exists at `/opt/pw-browsers` in this container, so the e2e may be runnable in Stage 4 (UNVERIFIED until tried) |
| 11 | Known-by-design limits | NOT RE-CHECKED (documentation claims) | `SECURITY.md`, `README.md:241-244` |

Other measured facts: `MIGRATIONS` in `server/db.js` has 15 entries (`PRAGMA user_version` = 15 on a fresh database). `TERMS_VERSION` is `"2026-10-04"`. `.env.example` and `README.md:50` use `https://shaghilni.sy` as the example `BASE_URL`; R6 says no domain exists, so this is a doc-drift candidate.

## Environment notes

- Working branch per the brief: `stage-0/ground-truth`. The session harness named a different branch (`claude/sharp-fermat-k8d0qs`, identical to `main`). Nothing is pushed until the owner says which name to push to.
- Outbound HTTPS goes through a proxy; `npm install --no-save puppeteer` has not been attempted.
