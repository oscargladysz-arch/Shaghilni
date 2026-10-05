/* ROUTE_POLICY: who may call which JSON route. One row per registered route (test/policy-completeness.test.js fails
   when a route has no row or a row has no route). "Allowed" means the role gets past the sign-in and role checks:
   the answer may still be 404, 409 or 422 for a resource that isn't theirs or input that isn't right. Every other role
   must get 401 (not signed in), 403 (wrong role or team level) or 404 (never a hint that the thing exists).
   Roles: guest · seeker · owner, cadmin (company admin), recruiter, hiring (hiring manager: the four team roles of one
   verified company) · admin (the Shaghilni team) · office (a university career office).
   Seeded from docs/agent/ROUTES.md "Guard" and server/plans.js LEVELS; the rows marked "policy" state what the
   product rules require where today's code is wider (each is a Stage 2 stop-the-line item until fixed). */
export const ROLES = ["guest", "seeker", "owner", "cadmin", "recruiter", "hiring", "admin", "office"];
const ANY = ["seeker", "owner", "cadmin", "recruiter", "hiring", "admin", "office"];
const PUBLIC = ["guest", ...ANY];
const EMPLOYER = ["owner", "cadmin", "recruiter", "hiring"];   // any team role (plans.js "view")
const HIRE = ["owner", "cadmin", "recruiter"];                 // plans.js "hire"
const MANAGE = ["owner", "cadmin"];                            // plans.js "manage"
const BILLING = ["owner"];                                     // plans.js "billing"
const SEEKER = ["seeker"], ADMIN = ["admin"], OFFICE = ["office"], ORGANISER = ["admin", "office"];
const row = (method, pattern, roles, note = "") => ({ method, pattern, roles, note });

export const POLICY = [
  // sign-in and public (server/routes/public.js)
  row("GET", "/api/auth/challenge", PUBLIC), row("POST", "/api/auth/code", PUBLIC), row("POST", "/api/auth/verify", PUBLIC), row("POST", "/api/auth/logout", PUBLIC),
  row("GET", "/api/jobs", PUBLIC), row("GET", "/api/jobs/:id", PUBLIC, "published listings of verified companies only"), row("GET", "/api/health", PUBLIC), row("GET", "/api/config", PUBLIC),
  row("POST", "/api/auth/demo", PUBLIC, "development only: registered only when demoOn(cfg); never in production or tests"),
  // job seeker account (server/routes/me.js)
  row("GET", "/api/me", PUBLIC, "guests get { user: null }"), row("PUT", "/api/me/lang", ANY), row("PUT", "/api/me/profile", SEEKER),
  row("POST", "/api/me/saved/:jobId", SEEKER), row("DELETE", "/api/me/saved/:jobId", SEEKER), row("POST", "/api/jobs/:id/apply", SEEKER),
  row("GET", "/api/me/applications", SEEKER), row("POST", "/api/me/applications/:id/withdraw", SEEKER, "own application only"),
  row("GET", "/api/me/export", ANY), row("DELETE", "/api/me", ANY, "admins get 409 admin_cannot_delete"),
  // resume AI (server/routes/resume.js)
  row("POST", "/api/resume/suggest", SEEKER), row("POST", "/api/resume/translate", SEEKER),
  // job alerts (server/alerts.js)
  row("GET", "/api/me/alerts", SEEKER), row("POST", "/api/me/alerts", SEEKER), row("PUT", "/api/me/alerts/:id", SEEKER, "own alert only"), row("DELETE", "/api/me/alerts/:id", SEEKER, "own alert only"), row("POST", "/api/me/alerts/seen", SEEKER),
  // recruiters and invitations (server/routes/recruit.js)
  row("GET", "/api/employer/students", HIRE, "verified company; cards of opted-in people only"), row("POST", "/api/employer/students/:id/invite", HIRE),
  row("GET", "/api/employer/invitations", HIRE, "policy: the sent list carries full names and phone numbers after an event yes; hiring managers must not read it (D-03)"),
  row("POST", "/api/employer/invitations/:id/withdraw", HIRE, "policy: same as the sent list (D-03); own company's invitation only"),
  row("PUT", "/api/me/recruit", SEEKER), row("GET", "/api/me/invitations", SEEKER), row("POST", "/api/me/invitations/:id/respond", SEEKER, "own invitation only"), row("POST", "/api/me/invitations/:id/block", SEEKER, "own invitation only"),
  // employer: company, listings, pipeline (server/routes/employer.js)
  row("GET", "/api/employer", EMPLOYER), row("PUT", "/api/employer/company", MANAGE, "an employer with no company yet may create one"), row("POST", "/api/employer/company/submit", MANAGE),
  row("POST", "/api/employer/jobs", HIRE), row("PUT", "/api/employer/jobs/:id", HIRE, "own company's job only"), row("POST", "/api/employer/jobs/:id/submit", HIRE), row("POST", "/api/employer/jobs/:id/close", HIRE), row("POST", "/api/employer/jobs/:id/reopen", HIRE),
  row("GET", "/api/employer/jobs/:id/applications", EMPLOYER, "own company's job only"), row("PUT", "/api/employer/applications/:id", EMPLOYER, "a note needs view, a stage move needs hire; own company's applicant only"),
  // employer: plans, sponsoring, analytics, payments
  row("GET", "/api/employer/plan", EMPLOYER), row("POST", "/api/employer/plan/request", BILLING), row("POST", "/api/employer/jobs/:id/sponsor", MANAGE), row("GET", "/api/employer/analytics", EMPLOYER),
  row("GET", "/api/employer/reports/:kind", MANAGE, "Enterprise plan feature"), row("POST", "/api/employer/plan/checkout", BILLING),
  row("GET", "/api/employer/payments/:id", EMPLOYER, "scoped to the company; no team-level check today (flag: billing data readable at view level)"),
  // teams (server/routes/team.js)
  row("GET", "/api/employer/team", EMPLOYER, "requests shown to manage only"), row("POST", "/api/employer/team", MANAGE), row("POST", "/api/employer/team/requests/:phone", MANAGE), row("PUT", "/api/employer/team/:phone", MANAGE), row("DELETE", "/api/employer/team/:phone", MANAGE),
  row("POST", "/api/employer/team/leave", EMPLOYER, "the owner is refused"), row("POST", "/api/employer/team/transfer", BILLING), row("POST", "/api/employer/membership/:answer", EMPLOYER, "only for an employer account with a pending invitation and no company"),
  row("GET", "/api/employer/companies/search", EMPLOYER), row("POST", "/api/employer/companies/:id/join", EMPLOYER, "only without a company"), row("GET", "/api/employer/activity", MANAGE),
  // universities and student verification (server/routes/campus.js)
  row("POST", "/api/me/verify-student", SEEKER), row("POST", "/api/me/verify-student/confirm", SEEKER), row("DELETE", "/api/me/verify-student", SEEKER),
  row("GET", "/api/campus", OFFICE), row("POST", "/api/campus/domains", OFFICE), row("DELETE", "/api/campus/domains/:domain", OFFICE, "own university only"),
  row("POST", "/api/admin/campus/domains", ADMIN), row("DELETE", "/api/admin/campus/domains/:uni/:domain", ADMIN), row("POST", "/api/campus/partners/:companyId", OFFICE, "requests to the office's own university only"),
  row("POST", "/api/employer/partners", MANAGE), row("GET", "/api/admin/campus", ADMIN), row("POST", "/api/admin/campus", ADMIN), row("DELETE", "/api/admin/campus/:userId", ADMIN),
  // events (server/routes/events.js)
  row("GET", "/api/events", PUBLIC), row("GET", "/api/events/:id", PUBLIC, "published, or manageable by the caller"), row("POST", "/api/events/:id/rsvp", SEEKER), row("DELETE", "/api/events/:id/rsvp", SEEKER), row("GET", "/api/me/events", SEEKER),
  row("GET", "/api/organize/events", ORGANISER, "an office sees its own university's events"), row("POST", "/api/organize/events", ORGANISER),
  row("PUT", "/api/organize/events/:id", ORGANISER, "an office manages its own university's events only"), row("GET", "/api/organize/events/:id", ORGANISER, "same"),
  row("POST", "/api/organize/events/:id/companies", ORGANISER, "same"), row("POST", "/api/organize/events/:id/checkin", ORGANISER, "same"), row("GET", "/api/organize/events/:id/report", ORGANISER, "same"),
  row("GET", "/api/employer/events", EMPLOYER, "verified company"), row("POST", "/api/employer/events/:id/attend", HIRE),
  // admin (server/routes/admin.js, insights.js, traffic.js)
  row("GET", "/api/admin/overview", ADMIN), row("GET", "/api/admin/companies", ADMIN), row("POST", "/api/admin/companies/:id/verify", ADMIN), row("POST", "/api/admin/companies/:id/reject", ADMIN), row("POST", "/api/admin/companies/:id/suspend", ADMIN),
  row("GET", "/api/admin/jobs", ADMIN), row("POST", "/api/admin/jobs/:id/approve", ADMIN), row("POST", "/api/admin/jobs/:id/reject", ADMIN), row("GET", "/api/admin/hires", ADMIN), row("POST", "/api/admin/applications/:id/confirm-hire", ADMIN),
  row("GET", "/api/admin/audit", ADMIN), row("GET", "/api/admin/billing", ADMIN), row("POST", "/api/admin/companies/:id/plan", ADMIN), row("POST", "/api/admin/charges/:id/:what", ADMIN), row("POST", "/api/admin/programmes", ADMIN),
  row("GET", "/api/admin/insights", ADMIN), row("GET", "/api/admin/traffic", ADMIN), row("GET", "/api/admin/system", ADMIN),
  // traffic beacons (server/traffic.js)
  row("POST", "/api/t", PUBLIC, "needs the app header like every write; no personal data"), row("POST", "/api/t/error", PUBLIC),
];

export const key = (method, pattern) => `${method} ${pattern}`;
export const byKey = new Map(POLICY.map(r => [key(r.method, r.pattern), r]));
