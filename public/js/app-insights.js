/* The Shaghilni team's dashboard: how the platform is doing, in totals only.
   Sample listings and demo accounts are left out unless the team asks to include them. */
const INS = { days: 30, sample: false, data: null };
async function drawInsights() {
  const b = $("#admBody"); INS.data = await api.get(`/api/admin/insights?days=${INS.days}${INS.sample ? "&sample=1" : ""}`); put(b, insightsHTML());
}
function insightsHTML() {
  const D = INS.data, H = D.headline, A = D.attention, num = n => fmt(n || 0);
  const change = d => (d.change == null ? "" : `${d.change > 0 ? "+" : ""}${d.change}% ${t("insVsBefore")}`);   // nothing to compare with yet: say nothing
  const metric = (k, n, sub, big) => html`<div class="metric${big ? " metric--big" : ""}"><span class="metric-n num">${n}</span><span class="metric-k">${t(k)}</span>${sub ? html`<span class="metric-sub">${sub}</span>` : ""}</div>`;
  const rows = list => html`<dl class="kv">${list.filter(Boolean).map(([k, v]) => html`<div class="kv-row"><dt>${k}</dt><dd class="num">${v}</dd></div>`)}</dl>`;
  const pct = (part, whole) => whole ? ` (${Math.round(part / whole * 100)}%)` : "";
  const label = (k, map) => (k && map && map[k] ? L(map[k]) : k || t("evUnknown"));
  const att = [["companies", "#/admin/companies", "insAttCompanies"], ["jobs", "#/admin/jobs", "insAttJobs"], ["hires", "#/admin/hires", "insAttHires"], ["planRequests", "#/admin/billing", "insAttPlans"], ["chargesDue", "#/admin/billing", "insAttCharges"]].filter(([k]) => A[k]);
  const spark = (k, key) => { const vals = D.weeks.map(w => w[key]), max = Math.max(1, ...vals), total = vals.reduce((s, v) => s + v, 0);
    return html`<div class="ins-spark"><span class="ins-spark-k">${t(k)}</span><span class="ins-bars" role="img" aria-label="${t(k)}: ${vals.join(", ")}">${vals.map((v, i) => html`<span class="ins-bar${i === vals.length - 1 ? " is-now" : ""}" style="--h:${Math.max(4, Math.round(v / max * 100))}%" title="${dayLabel(D.weeks[i].from)}: ${v}"></span>`)}</span><span class="ins-spark-n num">${num(total)}</span></div>`; };
  const F = D.hiring.funnel, sent = Object.entries(F).filter(([k]) => k !== "withdrawn").reduce((s, [, v]) => s + v, 0);
  return html`<div class="ins">
<div class="ins-bar-top"><div class="chips" role="group" aria-label="${t("insPeriod")}">${[7, 30, 90, 365].map(d => html`<button class="chip" type="button" data-act="ins-days" data-d="${d}" aria-pressed="${INS.days === d}">${t("insDays", { n: d })}</button>`)}</div>
<label class="tick"><input type="checkbox" data-act="ins-sample"${INS.sample ? raw(" checked") : ""}><span>${t("insSample")}</span></label><button class="btn btn--ghost btn--sm" type="button" data-act="ins-csv">${icon("doc", 15)}${t("insCsv")}</button></div>
<div class="metrics">${metric("insHires", num(H.confirmedHiresAllTime), t("insHiresSub", { n: num(H.confirmedHires.now) }), true)}${metric("insUsers", num(H.users), t("insNewN", { n: num(H.newUsers.now) }) + (change(H.newUsers) ? " · " + change(H.newUsers) : ""))}
${metric("insActive", num(H.activeWeek), t("insActiveMonth", { n: num(H.activeMonth) }))}${metric("insLiveJobs", num(H.liveJobs), t("insNewN", { n: num(H.newJobs.now) }))}
${metric("insApps", num(H.applications.now), change(H.applications))}${metric("insCompanies", num(H.verifiedCompanies), "")}${metric("insPaid", `${num(H.paidSyp)} ${t("syp")}`, H.paidUsd ? `$${num(H.paidUsd)}` : "")}</div>
${att.length || A.failedTexts || A.sampleCompanies || A.sampleJobs ? html`<section class="card"><h2 class="card-h">${icon("alert", 18)}<span>${t("insAttention")}</span></h2><div class="card-act">${att.map(([k, to, label]) => html`<button class="btn" type="button" data-act="go" data-to="${to}">${t(label, { n: A[k] })}</button>`)}</div>
${A.failedTexts ? html`<p class="note">${t("insFailedTexts", { n: A.failedTexts })}</p>` : ""}${A.sampleCompanies || A.sampleJobs ? html`<p class="note">${t("insSampleRows", { c: A.sampleCompanies || 0, j: A.sampleJobs || 0 })}</p>` : ""}</section>` : ""}
<section class="card"><h2 class="card-h">${t("insGrowth")}</h2><p class="card-p">${t("insGrowthP")}</p>${spark("insNewUsers", "users")}${spark("insNewJobs", "jobs")}${spark("insApps", "applications")}${spark("insHiresW", "hires")}</section>
<div class="ins-grid">
<section class="card"><h2 class="card-h">${t("insUsersH")}</h2>${rows([[t("insSeekers"), num(D.users.seekers)], [t("insStudents"), num(D.users.students) + pct(D.users.students, D.users.withProfile)], [t("insWorkers"), num(D.users.graduatesAndWorkers) + pct(D.users.graduatesAndWorkers, D.users.withProfile)],
  [t("insAbroad"), num(D.users.abroad)], [t("insOpen"), num(D.users.openToRecruiters)], [t("insVerifiedStudents"), num(D.users.verifiedStudents)], [t("insEmployers"), num(D.users.employers)], [t("insOffices"), num(D.users.careerOffices)], [t("insDeleted"), num(D.users.deletedInPeriod)]])}
${D.users.byGovernorate.length ? html`<h3 class="ck-h">${t("insWhere")}</h3>${rows(D.users.byGovernorate.map(x => [x.key === "abroad" ? t("insAbroadShort") : label(x.key, GOV), num(x.n)]))}` : ""}</section>
<section class="card"><h2 class="card-h">${t("insHiringH")}</h2>${rows([[t("st_new"), num(F.new)], [t("st_shortlisted"), num(F.shortlisted)], [t("st_interview"), num(F.interview)], [t("st_hired"), num(F.hired)], [t("st_rejected"), num(F.rejected)], [t("st_withdrawn"), num(F.withdrawn)]])}
${rows([[t("insAnswered"), D.hiring.answeredRate == null ? "—" : D.hiring.answeredRate + "%"], [t("insByWa"), num(D.hiring.byChannel.whatsapp) + pct(D.hiring.byChannel.whatsapp || 0, sent)], [t("insInterns"), num(D.hiring.confirmedInternships)]])}</section>
<section class="card"><h2 class="card-h">${t("insJobsH")}</h2>${rows([[t("insLiveJobs"), num(D.jobs.byStatus.published)], [t("insPending"), num(D.jobs.byStatus.pending)], [t("insDrafts"), num(D.jobs.byStatus.draft)], [t("insClosed"), num(D.jobs.byStatus.closed)],
  [t("insNoApplicants"), num(D.jobs.withoutApplicants)], [t("insPerJob"), D.jobs.applicantsPerJob], [t("insInternships"), num(D.jobs.internships)], [t("insSponsored"), num(D.jobs.sponsored)]])}
${D.jobs.byGovernorate.length ? html`<h3 class="ck-h">${t("insWhere")}</h3>${rows(D.jobs.byGovernorate.map(x => [label(x.key, GOV), num(x.n)]))}` : ""}</section>
<section class="card"><h2 class="card-h">${t("insCompaniesH")}</h2>${rows([[t("insVerified"), num(D.companies.byStatus.verified)], [t("insAwaiting"), num(D.companies.byStatus.pending)], [t("insDrafts"), num(D.companies.byStatus.draft)],
  ["Free", num(D.companies.byPlan.free)], ["Pro", num(D.companies.byPlan.pro)], ["Enterprise", num(D.companies.byPlan.enterprise)], ...D.companies.byKind.map(x => [label(x.key, CAT), num(x.n)]), [t("insTeams"), t("insTeamsV", { c: num(D.companies.withTeams), m: num(D.companies.teamMembers) })]])}</section>
<section class="card"><h2 class="card-h">${t("insCampusH")}</h2>${rows([[t("insOffices"), num(D.campus.careerOffices)], [t("insUniEmail"), num(D.campus.universitiesWithEmail)], [t("insVerifiedStudents"), num(D.campus.verifiedStudents)], [t("insPartners"), num(D.campus.partners)],
  [t("insEventsUp"), num(D.campus.eventsUpcoming)], [t("insEventsPast"), num(D.campus.eventsPast)], [t("insSignUps"), num(D.campus.signUps)], [t("insCheckIns"), num(D.campus.checkIns) + pct(D.campus.checkIns, D.campus.signUps)]])}</section>
<section class="card"><h2 class="card-h">${t("insMoneyH")}</h2>${rows([[t("insPaidPeriod"), `${num(D.money.paidSyp)} ${t("syp")}${D.money.paidUsd ? " · $" + num(D.money.paidUsd) : ""}`], [t("insDue"), `${num(D.money.dueSyp)} ${t("syp")}${D.money.dueUsd ? " · $" + num(D.money.dueUsd) : ""}`],
  ...D.money.byKind.map(k => [t("chK_" + k.kind), `${num(k.paidSyp)} ${t("syp")}${k.paidUsd ? " · $" + num(k.paidUsd) : ""}`]), [t("insCard"), num(D.money.cardPayments)]])}</section>
<section class="card"><h2 class="card-h">${t("insMessagesH")}</h2>${rows([[t("insTexts"), num(D.messages.textsSent)], [t("insTextsFailed"), num(D.messages.textsFailed)], [t("insEmails"), num(D.messages.verificationEmails)], [t("insInvites"), num(D.messages.invitations)], [t("insAlerts"), num(D.messages.jobAlerts)]])}</section>
</div><p class="note">${t(INS.sample ? "insNoteSample" : "insNote")}</p></div>`;
}
function insightsCSV() {
  const D = INS.data, out = [], add = (section, key, v) => out.push({ section, metric: key, value: v });
  for (const [sec, obj] of Object.entries({ headline: D.headline, attention: D.attention, users: D.users, jobs: D.jobs, hiring: D.hiring, companies: D.companies, campus: D.campus, money: D.money, messages: D.messages }))
    for (const [k, v] of Object.entries(obj)) {
      if (v && typeof v === "object" && !Array.isArray(v) && "now" in v) { add(sec, k, v.now); add(sec, k + " (previous period)", v.before); }
      else if (Array.isArray(v)) v.forEach(x => add(sec, `${k}: ${x.key || x.kind}`, x.n != null ? x.n : JSON.stringify(x)));
      else if (v && typeof v === "object") for (const [k2, v2] of Object.entries(v)) add(sec, `${k}: ${k2}`, v2);
      else add(sec, k, v);
    }
  D.weeks.forEach(w => add("weeks", new Date(w.from).toISOString().slice(0, 10), `users ${w.users}, jobs ${w.jobs}, applications ${w.applications}, confirmed hires ${w.hires}`));
  downloadCSV(`shaghilni-insights-${D.period.days}d${D.period.sample ? "-with-sample" : ""}.csv`, out);
}
async function insightsAct(act, el) {
  try {
    if (act === "ins-days") { INS.days = Number(el.dataset.d); await drawInsights(); }
    else if (act === "ins-sample") { INS.sample = !!el.checked; await drawInsights(); }
    else if (act === "ins-csv") insightsCSV();
  } catch (err) { toast({ title: errText(err), ic: "alert" }); }
}
