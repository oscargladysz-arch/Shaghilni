/* Card payments for employer plans, through a bank's hosted payment page. Card details are entered on the
   bank's own secure page: Shaghilni never sees or stores a card number.

   How it works:
   1. The employer chooses a plan and a length. We create a payment and ask the provider for a payment session.
   2. The employer is sent to the provider's page to pay.
   3. The provider tells our server the result directly, in a signed message (/pay/callback/<provider>).
      Only that message switches a plan on, after the signature, amount and currency are checked. It's
      processed once: a repeated message changes nothing.
   4. The employer is sent back to /pay/return, which shows the result. The return itself changes nothing.

   Providers:
   - "test": a pretend payment page, for development and tests only (refused in production).
   - "qnb":  QNB Syria. Complete createSession() and verify() below from QNB Syria's developer documents. */
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { fail, send } from "./http.js";
import { J, now } from "./db.js";

const MONTHS = [1, 3, 12], DAY = 86400e3;
const readRaw = req => new Promise((resolve, reject) => { const parts = []; let n = 0;
  req.on("data", c => { n += c.length; if (n > 64 * 1024) { reject(new Error("too large")); req.destroy(); } else parts.push(c); });
  req.on("end", () => resolve(Buffer.concat(parts).toString("utf8"))); req.on("error", reject); });
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const same = (a, b) => { const x = Buffer.from(String(a || "")), y = Buffer.from(String(b || "")); return x.length === y.length && timingSafeEqual(x, y); };

function testProvider(cfg) {
  const secret = createHmac("sha256", cfg.otpPepper || "dev").update("pay-test").digest("hex");
  const sign = raw => createHmac("sha256", secret).update(raw).digest("hex");
  return { name: "test", ready: true, sign,
    async createSession(pay) { const session = randomBytes(16).toString("hex"); return { ref: session, redirectUrl: `/pay/test/${session}` }; },
    verify(raw, headers) { if (!same(headers["x-test-signature"], sign(raw))) return null; const b = JSON.parse(raw); return { ref: b.session, status: b.status, amount: Number(b.amount), currency: b.currency }; } };
}
function qnbProvider(cfg) {
  const ready = false;   // set to true once createSession() and verify() follow QNB Syria's documents
  return { name: "qnb", ready,
    async createSession(pay, urls) {
      // TODO from QNB Syria's developer documents: create a hosted payment session for pay.amount in pay.currency,
      // with urls.returnUrl for the customer and urls.callbackUrl for the server-to-server result. Use
      // cfg.qnbGatewayUrl, cfg.qnbMerchantId and cfg.qnbApiSecret. Return { ref: <their session or order id>, redirectUrl }.
      throw new Error("The QNB Syria adapter isn't completed yet: see server/payments.js");
    },
    verify(raw, headers) {
      // TODO: check QNB's signature on the result with cfg.qnbWebhookSecret (or confirm it by asking their API),
      // then return { ref, status: "paid" | "failed" | "cancelled", amount, currency }. Return null if it can't be trusted.
      return null;
    } };
}

export function makePayments({ db, cfg, plans, audit, log }) {
  const provider = cfg.payProvider === "test" && !cfg.prod ? testProvider(cfg) : cfg.payProvider === "qnb" ? qnbProvider(cfg) : null;
  if (cfg.payProvider && provider && !provider.ready) log(`[payments] PAY_PROVIDER=${cfg.payProvider} is set, but its adapter isn't completed: card payments are switched off.`);
  const monthly = plan => (plan === "pro" ? cfg.planProMonthly : plan === "enterprise" ? cfg.planEnterpriseMonthly : 0);
  const on = () => !!(provider && provider.ready && cfg.planProMonthly > 0 && cfg.planEnterpriseMonthly > 0);
  const cardInfo = () => (on() ? { currency: cfg.payCurrency, pro: cfg.planProMonthly, enterprise: cfg.planEnterpriseMonthly, months: MONTHS } : null);
  const base = () => cfg.baseUrl || "";
  // Switch a plan on after a confirmed payment, adding to the time left if it's the same plan.
  function activate(pay, t = now()) {
    const c = db.get("SELECT * FROM companies WHERE id = ?", pay.company_id); if (!c) return;
    const start = plans.planOf(c) === pay.plan && c.plan_until && c.plan_until > t ? c.plan_until : t;
    db.run("UPDATE companies SET plan = ?, plan_until = ? WHERE id = ?", pay.plan, start + pay.months * 30 * DAY, c.id);
    db.run("UPDATE plan_requests SET handled_at = ? WHERE company_id = ? AND handled_at IS NULL", t, c.id);
    const note = `${pay.plan} plan, ${pay.months} month${pay.months > 1 ? "s" : ""}, paid by card (${provider ? provider.name : "card"} ${pay.provider_ref || ""})`.trim();
    if (pay.currency === "USD") db.run("INSERT INTO charges (company_id, kind, amount_usd, status, note, created_at, paid_at) VALUES (?, 'plan', ?, 'paid', ?, ?, ?)", c.id, pay.amount, note, t, t);
    else db.run("INSERT INTO charges (company_id, kind, amount_syp, status, note, created_at, paid_at) VALUES (?, 'plan', ?, 'paid', ?, ?, ?)", c.id, pay.amount, note, t, t);
    audit(pay.created_by, "plan.card_paid", "company", c.id, { plan: pay.plan, months: pay.months, amount: pay.amount, currency: pay.currency, payment: pay.id });
  }
  async function checkout(ctx, c, plan, months) {
    if (!on()) fail(409, "card_unavailable");
    if (!["pro", "enterprise"].includes(plan)) fail(422, "bad_plan");
    if (!MONTHS.includes(months)) fail(422, "bad_months");
    const amount = monthly(plan) * months;
    const id = Number(db.run("INSERT INTO payments (company_id, plan, months, amount, currency, provider, status, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, 'created', ?, ?)",
      c.id, plan, months, amount, cfg.payCurrency, provider.name, ctx.user.id, now()).lastInsertRowid);
    const s = await provider.createSession({ id, amount, currency: cfg.payCurrency, description: `Shaghilni ${plan} plan, ${months} month(s)` },
      { returnUrl: `${base()}/pay/return?p=${id}`, callbackUrl: `${base()}/pay/callback/${provider.name}` });
    db.run("UPDATE payments SET provider_ref = ? WHERE id = ?", s.ref, id);
    audit(ctx.user.id, "plan.checkout", "company", c.id, { plan, months, amount, payment: id });
    return { payment: id, redirectUrl: s.redirectUrl };
  }
  // The provider's signed result. The only thing that can mark a payment paid.
  function settle(name, raw, headers) {
    if (!provider || provider.name !== name) return { code: 404 };
    let r; try { r = provider.verify(raw, headers); } catch (e) { r = null; }
    if (!r || !r.ref) return { code: 400 };
    const pay = db.get("SELECT * FROM payments WHERE provider = ? AND provider_ref = ?", name, r.ref); if (!pay) return { code: 404 };
    if (pay.status === "paid") return { code: 200, pay };   // already done: nothing more
    if (r.status === "paid") {
      if (Number(r.amount) !== pay.amount || String(r.currency).toUpperCase() !== pay.currency) { log(`[payments] payment ${pay.id}: amount or currency didn't match`); db.run("UPDATE payments SET status = 'failed' WHERE id = ?", pay.id); return { code: 400 }; }
      db.run("UPDATE payments SET status = 'paid', paid_at = ? WHERE id = ? AND status != 'paid'", now(), pay.id);
      activate({ ...pay, status: "paid" });
    } else if (["failed", "cancelled"].includes(r.status)) db.run("UPDATE payments SET status = ? WHERE id = ? AND status = 'created'", r.status, pay.id);
    return { code: 200, pay };
  }
  const page = (title, body) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>
<style>body{margin:0;font:16px/1.5 system-ui,sans-serif;background:#f3f5f4;color:#16231c;display:grid;place-items:center;min-height:100vh}main{background:#fff;border:1px solid #dde5e0;border-radius:16px;padding:24px;max-width:380px;width:calc(100% - 32px)}
.warn{background:#fff3d6;color:#7a5200;border-radius:10px;padding:8px 12px;font-size:14px;font-weight:600}.amt{font-size:28px;font-weight:700;margin:6px 0}button{display:block;width:100%;font:inherit;font-weight:600;border-radius:99px;padding:12px;margin:8px 0;cursor:pointer}
.pay{background:#0E6B46;color:#fff;border:0}.no{background:#fff;border:1px solid #cfd8d3;color:#16231c}.mu{color:#58645d;font-size:14px}</style></head><body><main>${body}</main></body></html>`;
  async function handle(req, res, url) {
    const m1 = /^\/pay\/test\/([0-9a-f]{32})$/.exec(url.pathname), m2 = /^\/pay\/callback\/([a-z]+)$/.exec(url.pathname);
    if (url.pathname === "/pay/return") {
      const id = Number(url.searchParams.get("p")) || 0;
      res.writeHead(303, { location: `/#/company/plan/paid/${id}` }); return res.end();
    }
    if (m2 && req.method === "POST") {
      const raw = await readRaw(req), r = settle(m2[1], raw, req.headers);
      return send(req, res, r.code, JSON.stringify({ ok: r.code === 200 }), { "content-type": "application/json" });
    }
    if (m1 && provider && provider.name === "test") {
      const pay = db.get("SELECT * FROM payments WHERE provider = 'test' AND provider_ref = ?", m1[1]);
      if (!pay) return send(req, res, 404, page("Not found", "<p>This payment doesn't exist.</p>"), { "content-type": "text/html; charset=utf-8" });
      if (req.method === "POST") {
        const form = new URLSearchParams(await readRaw(req)), status = form.get("result") === "paid" ? "paid" : "cancelled";
        const raw = JSON.stringify({ session: pay.provider_ref, status, amount: pay.amount, currency: pay.currency });
        settle("test", raw, { "x-test-signature": provider.sign(raw) });   // what the bank's server would send to /pay/callback/test
        res.writeHead(303, { location: `/pay/return?p=${pay.id}` }); return res.end();
      }
      const amt = `${pay.amount.toLocaleString("en-US")} ${esc(pay.currency)}`;
      return send(req, res, 200, page("Test payment", `<p class="warn">Test payment page. No real money is taken.</p><p class="mu">Pay Shaghilni</p><p class="amt">${amt}</p>
<p class="mu">${esc(pay.plan === "pro" ? "Pro" : "Enterprise")} plan, ${pay.months} month${pay.months > 1 ? "s" : ""}</p>
<form method="post"><button class="pay" name="result" value="paid">Pay ${amt}</button><button class="no" name="result" value="cancelled">Cancel</button></form>`), { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
    }
    return send(req, res, 404, "Not found", { "content-type": "text/plain; charset=utf-8" });
  }
  const status = (id, companyId) => { const p = db.get("SELECT id, plan, months, amount, currency, status, paid_at FROM payments WHERE id = ? AND company_id = ?", id, companyId); if (!p) fail(404, "not_found");
    return { id: p.id, plan: p.plan, months: p.months, amount: p.amount, currency: p.currency, status: p.status, paidAt: p.paid_at }; };
  return { cardInfo, checkout, settle, handle, status, provider };
}
