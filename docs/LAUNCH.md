# Launch checklist

One list for everything that has to be true before Shaghilni takes real users, merged from the README's and SECURITY.md's "Before you go live" lists, the human-only items in the launch brief, and what the Stage 0 ground-truth review found. Owner means who must act: **agent** (done in the repository, with a test), **owner** (the Shaghilni team), **lawyer**, **provider** (a hosting, SMS, email, payment or bank service). Status as of the Stage 1 gate: **Done** (verified in the repository), **Open** (not yet done), **UNVERIFIED** (cannot be checked from this repository), **Blocked on Dn** (waits on an owner decision in `docs/agent/QUESTIONS.md`).

No item marked owner, lawyer or provider is ever ticked by an agent.

## A · Configuration and deployment

| # | Item | Owner | How to verify | Status |
|---|---|---|---|---|
| A1 | `NODE_ENV=production`, `OTP_PEPPER` (32+ random characters), `BASE_URL` (your exact `https://` address), `TRUST_PROXY=true` behind a proxy, `ADMIN_PHONES` set. | owner | `npm run security:check -- --env <your .env>` prints `0 failed`. It fails on a non-production `NODE_ENV`, a weak pepper, a non-https address, no admin, `console` texts and no contact email. | Open |
| A2 | Sample listings never reach production. | agent | `test/security.test.js` tests 14 and 16; a production start against an empty database prints no `[seed]` line and `GET /api/jobs` is empty (checked at the Stage 1 gate). | Done |
| A3 | A database first used in development holds no sample rows. | owner | The start-up log has no `[seed] This production database still holds…` line and Admin → Overview shows no sample-data note. Otherwise `npm run demo:remove` (after `npm run demo-accounts:purge` if the demo accounts are in it). | Open |
| A4 | Domain, DNS, hosting (Render, Railway or a VPS) and HTTPS in front of the server. | owner, provider | `curl -I https://your-domain` shows `strict-transport-security`; `/api/health` answers 200. | Open |
| A5 | The Docker image builds and its healthcheck works (`wget` must exist in `node:22-alpine`). | owner | `docker build -t shaghilni .`, run it, then `docker inspect --format '{{.State.Health.Status}}' shaghilni` says `healthy`. | UNVERIFIED (no Docker in the agent environment) |
| A6 | The `.env` passed with `--env-file` says `NODE_ENV=production` (it overrides the image's own setting). | owner | The scanner against that file prints `0 failed`. | Open |
| A7 | The first CI run is watched and `main` is protected (owner decision D5). | owner | The *CI* workflow is green on Node 22.13.0, 22 and 24; branch rules require it. | Open |
| A8 | CI actions pinned to commit SHAs, if wanted. `actions/checkout@v4`, `actions/setup-node@v4` and `actions/upload-artifact@v4` are pinned by major tag because no SHA could be verified from the official repositories in the agent environment. | owner | Look up each tag's commit on github.com and replace the tag in `.github/workflows/ci.yml`. | Open |

## B · Security

| # | Item | Owner | How to verify | Status |
|---|---|---|---|---|
| B1 | `npm test` green. | agent | 65 of 65 at the Stage 1 gate (`docs/agent/BASELINE.md` has the earlier 60). | Done |
| B2 | The browser flow passes (`npm run test:e2e`, 80 checks, four browsers plus a Lite page without JavaScript). | agent, owner | Run the *Browser end-to-end* job by hand from the CI workflow, or locally after `npm install --no-save puppeteer`. | UNVERIFIED |
| B3 | `npm run security:check -- --url https://your-domain` shows no FAIL once deployed. | owner | Paste the output into the launch record. | Open |
| B4 | External scans: MDN HTTP Observatory (aim A+), SSL Labs (aim A), the OWASP ZAP baseline scan, GitHub secret scanning. | owner | Reports saved. | Open |
| B5 | The four review prompts in SECURITY.md items 6–9 re-run against the current code. | agent | Stage 4 of the launch work updates SECURITY.md with the results and the date. | Open |
| B6 | Every API route covered by the cross-role and junk-input tests. | agent | Stage 2 adds a generated policy test that fails when a route is missing; today 68 of 109 routes are in neither (`docs/agent/ROUTES.md`). | Open |
| B7 | Admin phone numbers protected against SIM swap (carrier PIN); `ADMIN_PHONES` kept short. | owner | | Open |

## C · Legal and people

| # | Item | Owner | How to verify | Status |
|---|---|---|---|---|
| C1 | A lawyer reviews the privacy notice and terms (`public/js/legal.js`, shown at `/#/privacy` and `/#/terms`) under Syrian Law No. 12 of 2024, including a governing-law clause. Any change bumps `TERMS_VERSION` and moves `server/retention.js` and SECURITY.md with it. | lawyer, owner | Signed-off wording; `docs/agent/LEGAL_PROPOSALS.md` is the agenda of known gaps. | Open |
| C2 | `LEGAL_NAME` and `CONTACT_EMAIL` set to the real operating entity and a monitored mailbox. | owner | The scanner's `Legal name:` and `Privacy contact:` lines. | Blocked on D4 and D6 |
| C3 | A named person responsible for personal data, and a breach plan. | owner | Written down and named in the privacy notice if the lawyer asks for it. | Open |
| C4 | The employment-office licence application is under way. | owner | | Open |
| C5 | Native Arabic review of every new or changed string. | owner, reviewer | Every row of `docs/agent/ARABIC_REVIEW.md` ticked. | Open (one string so far) |
| C6 | Lite users can read the terms they consent to without JavaScript. | agent | Stage 3 (P1-2) adds `/lite/privacy` and `/lite/terms`; a test checks both languages. | Open |

## D · Providers and money

| # | Item | Owner | How to verify | Status |
|---|---|---|---|---|
| D1 | SMS provider chosen (`textbee` or `twilio`, decision D3) and tested on Syrian networks with your own number, plus one diaspora number. | owner, provider | Sign in from both; note delivery times. | Open |
| D2 | Provider spend caps: an Anthropic monthly limit; Twilio geographic permissions limited to the countries in `SMS_ALLOWED_PREFIXES` plus a usage alert; a textbee plan that fits the volume. | owner, provider | Screenshots of each setting. | Open |
| D3 | Plan prices (`PLAN_PRO_PRICE`, `PLAN_ENTERPRISE_PRICE`; monthly card prices only with a card provider), decision D2. | owner | The Plans page shows them. | Blocked on D2 |
| D4 | The Syrian entity or local partner that receives Syrian pounds, and the entity that invoices in US dollars, decision D4. | owner | | Blocked on D4 |
| D5 | QNB Syria developer documents and sandbox credentials for card payments. | owner, provider | `GO P2-4` once in hand; until then the card option stays off (`server/payments.js`). | Blocked on D4 |

## E · Data and operations

| # | Item | Owner | How to verify | Status |
|---|---|---|---|---|
| E1 | Daily backups scheduled and copied off the server. With `DB_PATH=/data/shaghilni.db`, run `npm run backup -- /backups` so the System tab finds them. | owner | Admin → System shows the newest backup; a copy exists off the server. | Open |
| E2 | One restore tested. | owner | Restore a backup on a scratch machine; row counts match the System tab. | Open |
| E3 | Upgrade check on real data: open a copy of the production database with the new code, confirm `PRAGMA user_version` is 15 and every count is unchanged. | owner, agent | There is no automated upgrade test; this is a manual step before each deploy that adds a migration. | Open |
| E4 | Retention matches the privacy notice. | agent | SECURITY.md item 1 lists the periods; the email-code sweep and the "within 24 hours" wording are open (`docs/agent/LEGAL_PROPOSALS.md`, `docs/agent/DEFECTS.md`). | Partial |

## F · Product content

| # | Item | Owner | How to verify | Status |
|---|---|---|---|---|
| F1 | What happens to the sample data (remove, or replace the real organisations' names; staging), decision D1. | owner | `docs/agent/QUESTIONS.md`. | Blocked on D1 |
| F2 | The two real names in the demo accounts (a relief society, an event venue) replaced with fictional ones. | agent | `grep -n "Red Crescent\|Four Seasons" server/demo.js` finds nothing. | Open (after D1) |
| F3 | Which universities issue student email, and their domains. | owner | Admin → Universities → Student email lists them. | Open |
| F4 | Who screens companies against the OFAC list; every company screened before verification. | owner | The compliance report's sanctions column (filled in once D-07 is fixed in Stage 3) and the audit log. | Open |
| F5 | The "invoiced by our US company" copy removed from the app and the README (no entity exists). | agent | README done in Stage 1; the app strings follow in Stage 3. | Partial |

## G · Quality and reach

| # | Item | Owner | How to verify | Status |
|---|---|---|---|---|
| G1 | TalkBack testing on real Android phones. | owner | Notes per screen. | Open |
| G2 | Accessibility pass against WCAG AA, the 12 px floor and keyboard use. | agent | Stage 4 static pass; findings fixed or recorded. | Open |
| G3 | Telegram alerts, public resume links and Lite event pages: wanted or not, decision D7. | owner | | Blocked on D7 |

## Owner decisions

D1 to D7 are set out with options, facts and a recommendation in `docs/agent/QUESTIONS.md`. Nothing above a "Blocked on" row is blocked by them.
