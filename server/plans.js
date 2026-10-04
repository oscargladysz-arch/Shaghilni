/* Plans for employers. Everything an employer needs to hire is free: posting with published pay, managing
   applicants and recording hires. Plans add reach, speed and scale. Payments are invoiced by hand for now: the
   admin sets a company's plan and marks charges paid. Job seekers never pay for anything. */
import { fail } from "./http.js";
import { now } from "./db.js";

export const PLANS = {
  free:       { invites: 5,    sponsored: 0,  team: 3,  analytics: false, reports: false, sourcedFee: true },
  pro:        { invites: 50,   sponsored: 2,  team: 10, analytics: true,  reports: false, sourcedFee: false },
  enterprise: { invites: null, sponsored: 10, team: 50, analytics: true,  reports: true,  sourcedFee: false }
};
export const SPONSOR_DAYS = 30;
/* A company's people. The owner (one, transferable) handles billing; admins run the team and the company page;
   recruiters post jobs and hire; hiring managers see applicants and leave notes. Team size counts the owner,
   active members and open invitations. */
export const ROLES = ["admin", "recruiter", "hiring_manager"];
const LEVELS = { billing: ["owner"], manage: ["owner", "admin"], hire: ["owner", "admin", "recruiter"], view: ["owner", "admin", "recruiter", "hiring_manager"] };
/* How employers can pay. Payments are checked and confirmed by hand: Syrian businesses in Syrian pounds by mobile
   wallet, bank transfer or cash with a receipt; international organizations in US dollars by card or bank transfer. */
export const PAY_METHODS = ["wallet", "bank_syp", "cash", "usd"];
export function makePlans({ db, cfg }) {
  const planOf = c => (c && c.plan && c.plan !== "free" && PLANS[c.plan] && (!c.plan_until || c.plan_until > now()) ? c.plan : "free");
  const limits = c => PLANS[planOf(c)];
  const monthStart = (t = now()) => { const d = new Date(t); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1); };
  const invitesUsed = cid => db.get("SELECT COUNT(*) AS n FROM invitations WHERE company_id = ? AND created_at >= ?", cid, monthStart()).n;
  const sponsoredUsed = cid => db.get("SELECT COUNT(*) AS n FROM jobs WHERE company_id = ? AND sponsored_until > ?", cid, now()).n;
  const teamUsed = cid => 1 + db.get("SELECT COUNT(*) AS n FROM company_members WHERE company_id = ? AND status IN ('active', 'invited')", cid).n;
  // The owner's company, or the company they were added to as a teammate.
  const companyFor = user => db.get("SELECT * FROM companies WHERE owner_id = ? OR id IN (SELECT company_id FROM company_members WHERE phone = ? AND status = 'active') ORDER BY (owner_id = ?) DESC LIMIT 1", user.id, user.phone || "", user.id);
  const roleOf = (c, user) => { if (!c || !user) return null; if (c.owner_id === user.id) return "owner";
    const m = db.get("SELECT role FROM company_members WHERE company_id = ? AND phone = ? AND status = 'active'", c.id, user.phone || ""); return m ? m.role : null; };
  const allow = (ctx, c, level) => { const r = roleOf(c, ctx.user); if (!r || !LEVELS[level].includes(r)) fail(403, "role_forbidden", { need: level }); return r; };
  const can = (c, user, level) => LEVELS[level].includes(roleOf(c, user));
  // How a person shows up to their team: the name they were added with, or the company's contact for the owner.
  const memberName = (c, userId) => { if (!c || !userId) return null;
    if (c.owner_id === userId) { const d = JSON.parse(c.data || "{}"); return d.contactName || "Owner"; }
    const u = db.get("SELECT phone FROM users WHERE id = ?", userId); if (!u) return null;
    const m = db.get("SELECT name FROM company_members WHERE company_id = ? AND phone = ?", c.id, u.phone); return (m && m.name) || u.phone; };
  const summary = c => {
    const p = planOf(c), L = PLANS[p], due = db.get("SELECT COUNT(*) AS n, COALESCE(SUM(amount_syp), 0) AS syp FROM charges WHERE company_id = ? AND status = 'due'", c.id);
    return { plan: p, planUntil: p === "free" ? null : c.plan_until || null, limits: L, usage: { invites: invitesUsed(c.id), sponsored: sponsoredUsed(c.id), team: teamUsed(c.id) },
      prices: { pro: cfg.planProPrice || "", enterprise: cfg.planEnterprisePrice || "" }, feesDue: { n: due.n, syp: due.syp } };
  };
  const need = (c, feature) => { if (!limits(c)[feature]) fail(403, "plan_required"); };
  const payMid = d => { const p = Array.isArray(d && d.pay) ? d.pay : [], a = Number(p[0]) || 0, b = Number(p[1]) || a; return Math.round((a + b) / 2); };
  // A reference to quote when paying, so each payment can be matched to its request.
  const ref = (companyId, requestId) => `SHG-${companyId}-${requestId}`;
  return { PAY_METHODS, ref, roleOf, allow, can, memberName, planOf, limits, invitesUsed, sponsoredUsed, teamUsed, companyFor, summary, need, payMid, monthStart };
}
