# The card-payment adapter contract (for the QNB Syria functions)

Everything in card payments is built and tested except the two functions that talk to the bank: `createSession()` and `verify()` in `qnbProvider()`, `server/payments.js:33-47`. This page is the contract those two functions must satisfy, derived line by line from `server/payments.js` as it stands, so they can be dropped in later without touching anything else. The test adapter (`testProvider()`, `server/payments.js:26-32`) implements the same contract and is the reference. Nothing here describes QNB's side of the wire: that comes from QNB Syria's developer documents and sandbox credentials, which the owner has not yet supplied (decision D4 in `docs/agent/QUESTIONS.md`; backlog item P2-4). Never guess the protocol.

## The flow, and who calls what

| Step | Code | What happens |
|---|---|---|
| 1 | `POST /api/employer/plan/checkout` → `checkout()` `server/payments.js:67-79` (route: `server/routes/employer.js:222-225`, owner of a verified company only) | Validates plan and months, computes the amount on the server, inserts a `payments` row with `status = 'created'`, then calls **`provider.createSession(pay, urls)`** (awaited, line 74). Stores the returned `ref` as `provider_ref` (line 76), writes audit `plan.checkout` (line 77) and returns `{ payment, redirectUrl }` to the client. |
| 2 | the client | Sends the employer to `redirectUrl` (the bank's hosted page). |
| 3 | `POST /pay/callback/<provider>` → `handle()` lines 104-107 → `settle()` lines 81-93 | The bank's server-to-server result. The body is read raw (at most 64 KB, lines 20-22) and passed to **`provider.verify(raw, headers)`** (line 83). Only this path can mark a payment paid and switch a plan on. Answers `{ "ok": true|false }` with 200, 400 or 404 (line 106). |
| 4 | `GET /pay/return?p=<payment id>` lines 100-103 | Display only: a 303 to `/#/company/plan/paid/<id>`, whatever the id; it reads and writes nothing. The page then asks `GET /api/employer/payments/:id`, which is scoped to the caller's company (line 124). |

`/pay/*` is outside `/api` on purpose (`server/app.js:108-109`): no `x-shaghilni` header, no session, no API rate limit (DEFECTS U-120). Each request is checked on its own, inside `settle()`.

## `createSession(pay, urls)` → `{ ref, redirectUrl }`

May be `async` (it is awaited: `server/payments.js:74`). An exception propagates out of `checkout()` and the request fails with a 500 (the `payments` row stays `created` with no `provider_ref`). Called only when `on()` is true (line 68), so only when `ready` is true and both monthly prices are set.

Input (built at lines 74-75):

| Field | Value | Notes |
|---|---|---|
| `pay.id` | the `payments.id` just inserted | our side's identifier; put it in the bank's order reference if their API has one, but **`ref` is what `settle()` matches on, not `pay.id`** |
| `pay.amount` | integer, `monthly price × months` (line 71) | **whole currency units** as configured (for example `4000` for 4,000 SYP), not minor units. If QNB expects minor units, `createSession()` converts and `verify()` converts back: `settle()` compares `Number(r.amount) !== pay.amount` in whole units (line 88) |
| `pay.currency` | `cfg.payCurrency`, upper-case (`server/config.js:54`, default `SYP`) | |
| `pay.description` | `Shaghilni <plan> plan, <n> month(s)` | free text for the bank's page, if it takes one |
| `urls.returnUrl` | `<BASE_URL>/pay/return?p=<id>` | where the customer comes back to; carries only our payment id |
| `urls.callbackUrl` | `<BASE_URL>/pay/callback/qnb` | where the bank's server posts the result; `BASE_URL` must be the public `https://` address in production (`server/config.js:75`) |

Output:

| Field | Contract |
|---|---|
| `ref` | A string that **the bank will echo in its result**, so that `verify()` can return it and `settle()` can find the row with `SELECT … WHERE provider = ? AND provider_ref = ?` (line 85). Unique per provider: `CREATE UNIQUE INDEX payments_ref ON payments(provider, provider_ref)` (`server/db.js:208`); a second session with the same `ref` fails the UPDATE at line 76. The test adapter uses 16 random bytes in hex (line 30). |
| `redirectUrl` | Where the client sends the employer. Absolute `https://` for a real bank; the test adapter returns the relative `/pay/test/<ref>` (line 30), which is its own page (lines 108-120). |

## `verify(raw, headers)` → `{ ref, status, amount, currency }` or `null`

**Synchronous.** `settle()` calls it without `await` and uses the return value at once:

```
server/payments.js:83   let r; try { r = provider.verify(raw, headers); } catch (e) { r = null; }
server/payments.js:84   if (!r || !r.ref) return { code: 400 };
```

An `async verify()` would return a Promise, which has no `.ref`, so **every** callback would be answered 400 and no payment could ever be marked paid (DEFECTS U-129). Both callers of `settle()` are synchronous as well: the callback route (line 105) and the test page's own call (line 114). If QNB offers only a pull-style confirmation (ask their API whether the order is paid) rather than a signed push, `settle()` and its two callers must first be made asynchronous in a separate change by the lead; `verify()` cannot do that on its own.

Input: `raw` is the request body as a UTF-8 string (lines 20-22; bodies over 64 KB are rejected before `verify()` runs), `headers` is Node's request-headers object (header names lower-cased). Throwing is safe: it is treated as `null` (line 83).

Output, when the result can be trusted:

| Field | Contract | Checked at |
|---|---|---|
| `ref` | the `ref` `createSession()` returned for this payment | line 84 (missing → 400), line 85 (unknown → 404) |
| `status` | exactly `"paid"`, `"failed"` or `"cancelled"` (map QNB's vocabulary onto these). Anything else is accepted with 200 and changes nothing (lines 87-92) | lines 87, 91 |
| `amount` | the amount the bank actually took, in the same units as `pay.amount` | line 88: `Number(r.amount) !== pay.amount` → 400 and the payment is marked `failed` |
| `currency` | the currency the bank took; compared upper-cased, so `syp` and `SYP` both pass | line 88: `String(r.currency).toUpperCase() !== pay.currency` → 400 and `failed` |

Return `null` whenever the message cannot be trusted: a missing or wrong signature, an unknown format, a replay the bank marks as such. `null` → 400 and nothing changes (line 84).

### The signature

`settle()` does not check any signature itself: **the signature check is the adapter's whole job**, inside `verify()`. The test adapter shows the shape: an HMAC-SHA256 of the raw body under a per-deployment secret (lines 27-28), carried in a header (`x-test-signature`), compared in constant time with `same()` (line 24: `timingSafeEqual` on equal-length buffers). Use `cfg.qnbWebhookSecret` for QNB (`server/config.js:56`); which header or field carries QNB's signature, how it is computed and over what bytes is unknown until their documents arrive.

### Amount, currency and the once-only rule, as `settle()` applies them

| Rule | Where | Effect |
|---|---|---|
| Provider name in the URL must be the configured provider's `name` | line 82 | otherwise 404; the URL pattern is `[a-z]+` (line 99), so `/pay/callback/TEST` never reaches `settle()` |
| The result must verify and carry a `ref` | lines 83-84 | otherwise 400 |
| The `ref` must belong to a payment of this provider | line 85 | otherwise 404, nothing is written |
| A payment already `paid` is done | line 86 | 200, nothing is written: the once-only rule for repeats and for a later `cancelled`/`failed` |
| `paid` with the wrong amount or currency | line 88 | 400, `status = 'failed'`, one log line carrying only the payment id (never the body); no audit row |
| `paid` with the right amount and currency | lines 89-90 | `status = 'paid'`, `paid_at` set (guarded by `AND status != 'paid'`), then `activate()` |
| `failed` or `cancelled` | line 91 | `status` set **only if it is still `created`** (`AND status = 'created'`): a `failed` after a `cancelled` changes nothing; no audit row |
| Any other `status` value | lines 87-92 | 200, nothing written |

Note what the once-only rule does *not* cover: a payment in `failed` or `cancelled` that later receives a trusted, matching `paid` result is marked paid and activated (line 89 only excludes `paid`). The bank's signed word is the source of truth; `verify()` must therefore never return `status: "paid"` for a message it has not authenticated.

### What a confirmed payment writes (`activate()`, lines 57-66)

1. `companies.plan` and `plan_until`: the same plan still running is extended from its end; otherwise the plan starts now, `months × 30 days` (lines 59-60; DEFECTS U-125, U-127 record the edge cases).
2. Open `plan_requests` for the company are closed (line 61).
3. A `charges` row, `kind = 'plan'`, `status = 'paid'`, in `amount_usd` when the currency is `USD` and `amount_syp` otherwise (lines 63-64; U-024 records that USD amounts are not shown to the employer), with a note naming the provider and `provider_ref`.
4. Audit `plan.card_paid`: actor `payments.created_by`, entity `company`, data `{ plan, months, amount, currency, payment }` (line 65). No phone number or card data anywhere.

### Audit rows, in full

| Row | Written by | When |
|---|---|---|
| `plan.checkout` | `checkout()`, line 77, actor = the signed-in owner, entity `company`, data `{ plan, months, amount, payment }` | every checkout, before the employer leaves for the bank |
| `plan.card_paid` | `activate()`, line 65 | once per payment, on the first trusted matching `paid` result |
| none | lines 88 and 91 | a mismatch, a `failed` or a `cancelled` result: only `payments.status` changes (plus one log line for a mismatch). `SECURITY.md` ("Card payments") promises the audit log for checkouts and card payments made; a failed attempt is visible only in the `payments` table (Insights counts paid payments only: `server/routes/insights.js:79`) |

`test/payments.test.js` asserts each of these rows and non-rows.

## What `ready` gates

`const ready = false` at `server/payments.js:34`; set to `true` only when both functions follow QNB's documents and have passed their sandbox.

| Gated by `ready` (through `on()`, line 53) | Not gated by `ready` |
|---|---|
| the `card` object in `GET /api/config` (`cardInfo()`, line 54 → `server/routes/public.js:36`), so the client never shows the card option | the provider's existence and name: with `PAY_PROVIDER=qnb`, `POST /pay/callback/qnb` reaches `verify()` (line 82 passes); the unfinished `verify()` returns `null`, so the answer is 400 (line 45 → 84) |
| `checkout()`: 409 `card_unavailable` before any row is written (line 68) | `/pay/return`: always a 303 (lines 100-103) |
| | the start-up log line `[payments] PAY_PROVIDER=qnb is set, but its adapter isn't completed: card payments are switched off.` (line 51) |

`on()` also needs both monthly prices above zero (line 53); in production the server refuses to start with a provider set and either price missing (`server/config.js:77`), and with `PAY_PROVIDER=test` at all (`server/config.js:76`). The test provider is also built only when `!cfg.prod` (line 50). An unrecognised `PAY_PROVIDER` value gives no provider at all: the card option is silently off (DEFECTS U-116).

## The test adapter, as the reference implementation (`server/payments.js:26-32`)

- `name: "test"`, `ready: true`.
- `createSession(pay)`: ignores `urls`, returns `{ ref: <32 hex chars>, redirectUrl: "/pay/test/<ref>" }`.
- `verify(raw, headers)`: constant-time check of `headers["x-test-signature"]` against HMAC-SHA256(secret, raw); on a match, parses the JSON body `{ session, status, amount, currency }` and returns `{ ref: session, status, amount: Number(amount), currency }`; otherwise `null`. A body that is not JSON throws, which `settle()` treats as `null`.
- `sign(raw)`: exposed so that the test page (line 114) and the tests can produce what the bank's server would send. The secret derives from `OTP_PEPPER` (line 27), so it differs per deployment.
- Its page (`/pay/test/<ref>`, lines 108-120) exists only for the test provider and is refused in production by `server/config.js:76`.

The tests that pin the contract: `test/payments.test.js` (forged, altered, repeated, wrong-currency, unknown-reference and wrong-provider results; the return page; `qnb` with `ready=false`; the production refusal) and `test/policy-idor.test.js` (another company cannot read the payment).

## What the operator configures

From `.env.example:73-81` and `server/config.js:53-57`:

| Setting | Meaning |
|---|---|
| `PAY_PROVIDER=qnb` | selects `qnbProvider()`; the card option appears only once `ready` is `true` in code |
| `PAY_CURRENCY` | the currency of the prices and of every payment, upper-cased (default `SYP`) |
| `PLAN_PRO_MONTHLY`, `PLAN_ENTERPRISE_MONTHLY` | integer monthly prices in `PAY_CURRENCY`; both required with any provider |
| `QNB_GATEWAY_URL`, `QNB_MERCHANT_ID`, `QNB_API_SECRET` | for `createSession()` (`cfg.qnbGatewayUrl`, `cfg.qnbMerchantId`, `cfg.qnbApiSecret`) |
| `QNB_WEBHOOK_SECRET` | for `verify()` (`cfg.qnbWebhookSecret`) |
| `BASE_URL` | the public `https://` address used in `returnUrl` and `callbackUrl` |

The real values come from QNB Syria's merchant agreement; none are known or assumed here. Keep them out of the repository (`SECURITY.md`, sections 9 and 10).

## What cannot be written without QNB Syria's documents (D4)

- How a hosted payment session is created: endpoint, authentication (`QNB_API_SECRET` is a placeholder name), request and response fields, whether the amount goes in whole or minor units, the currency code format (`SYP` or a numeric code), and where `returnUrl` and `callbackUrl` go.
- The result message: whether QNB pushes a server-to-server result at all (the contract assumes a push to `callbackUrl`), its format, which field carries our `ref`, their status vocabulary, and the signature scheme (algorithm, key, which bytes are signed, which header or field carries it).
- Whether QNB retries a result that is not acknowledged, and what acknowledgement it expects: today the callback answers `{"ok":true}` with 200 and `{"ok":false}` with 400 or 404 (line 106).
- Whether a pull-style confirmation is required instead of or in addition to the push (then `settle()` must change first, see above).
- Sandbox credentials and test cards for the gateway's test environment.

Until these arrive, `ready` stays `false`, the card option stays off, and plans are sold by manual billing (`test/plans.test.js`).
