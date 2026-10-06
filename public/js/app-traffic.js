/* Traffic: each screen of the app tells our own server which page was viewed (never anything typed), and the
   team's Traffic and System tabs show the results. No third-party trackers, no tracking cookies, no IP addresses.
   Browsers that ask not to be tracked aren't counted. */
const TR = { first: true, lastPath: "", lastAt: 0, errs: 0, days: 30, data: null, sys: null };
const trOptOut = () => navigator.doNotTrack === "1" || window.doNotTrack === "1" || navigator.globalPrivacyControl === true;
function trPath() {
  const h = (location.hash || "#/").slice(1).split("?")[0] || "/";
  return (h === "/" ? "/jobs" : h).toLowerCase().replace(/\/\d+(?=\/|$)/g, "/:id");
}
// A plain request: pages are open when they report, so "keepalive" (meant for pages that are closing) isn't needed.
function trSend(url, body) { try { fetch(url, { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json", "x-shaghilni": "1" }, body: JSON.stringify(body) }).then(r => r.text()).catch(() => {}); } catch (e) { /* never in the way */ } }   // read the reply, so the request closes
function trackView() {
  if (trOptOut()) return;
  const p = trPath(), t = Date.now(); if (p === TR.lastPath && t - TR.lastAt < 3000) return; TR.lastPath = p; TR.lastAt = t;
  const body = { path: p, lang: S.lang, role: S.user ? role() : "guest" };
  if (TR.first) {   // only the first page of a visit carries where it came from and how fast it loaded
    TR.first = false; const q = new URLSearchParams(location.search), nav = (performance.getEntriesByType && performance.getEntriesByType("navigation")[0]) || null, c = navigator.connection;
    Object.assign(body, { first: true, ref: document.referrer || "", utmSource: q.get("utm_source") || "", utmMedium: q.get("utm_medium") || "", utmCampaign: q.get("utm_campaign") || "",
      loadMs: nav ? Math.round(nav.domContentLoadedEventEnd || nav.responseEnd || 0) : null, conn: c && c.effectiveType ? c.effectiveType : "" });
  }
  trSend("/api/t", body);
}
window.addEventListener("error", e => { if (TR.errs++ < 5) trSend("/api/t/error", { message: String(e.message || "").slice(0, 300), source: `${e.filename || ""}:${e.lineno || 0}`, path: trPath(), variant: "app" }); });
window.addEventListener("unhandledrejection", e => { if (TR.errs++ < 5) trSend("/api/t/error", { message: String((e.reason && (e.reason.message || e.reason)) || "Unhandled rejection").slice(0, 300), path: trPath(), variant: "app" }); });

/* ---------- the team's Traffic tab ---------- */
const TR_PAGES = { "/": "trp_home", "/jobs": "trp_jobs", "/job/:id": "trp_job", "/applications": "trp_apps", "/recruiters": "trp_rc", "/resume": "trp_cv", "/profile": "trp_profile", "/alerts": "trp_alerts", "/events": "trp_events",
  "/events/:id": "trp_event", "/company": "trp_company", "/campus": "trp_campus", "/admin": "trp_admin", "/lite": "trp_lite", "/lite/job/:id": "trp_litejob", "/lite/hire": "trp_litehire", "/lite/signin": "trp_litesignin" };
const TR_SOURCES = { direct: "trs_direct", whatsapp: "WhatsApp", facebook: "Facebook", instagram: "Instagram", telegram: "Telegram", google: "Google", linkedin: "LinkedIn", x: "X (Twitter)", youtube: "YouTube", bing: "Bing" };
const trLabel = (k, map) => { const v = map[k]; return v ? (/^tr[ps]_/.test(v) ? t(v) : v) : k; };
async function drawTraffic() { const b = $("#admBody"); TR.data = await api.get(`/api/admin/traffic?days=${TR.days}`); put(b, trafficHTML()); }
function trList(rows, label, total) {
  if (!rows.length) return html`<p class="empty-p">${t("trNone")}</p>`;
  const sum = total || rows.reduce((s, r) => s + r.n, 0) || 1;
  return html`<ul class="tr-list">${rows.map(r => html`<li><span class="tr-k" dir="auto">${label(r.key)}</span><span class="tr-n num">${fmt(r.n)}</span><span class="tr-bar" aria-hidden="true"><i style="width:${Math.max(2, Math.round(r.n / sum * 100))}%"></i></span></li>`)}</ul>`;
}
function trafficHTML() {
  const D = TR.data, T = D.totals, num = n => fmt(n || 0), ms = v => (v == null ? "—" : v >= 1000 ? `${(v / 1000).toFixed(1)} ${t("trSec")}` : `${v} ${t("trMs")}`);
  const metric = (k, n, sub, big) => html`<div class="metric${big ? " metric--big" : ""}"><span class="metric-n num">${n}</span><span class="metric-k">${t(k)}</span>${sub ? html`<span class="metric-sub">${sub}</span>` : ""}</div>`;
  const maxV = Math.max(1, ...D.series.map(s => s.views)), F = D.funnel;
  const step = (k, n, prev) => html`<li><span class="tr-k">${t(k)}</span><span class="tr-n num">${num(n)}</span><span class="tr-pct">${prev ? Math.round(n / prev * 100) + "%" : ""}</span></li>`;
  return html`<div class="ins tr">
<div class="ins-bar-top"><div class="chips" role="group" aria-label="${t("insPeriod")}">${[[1, "trToday"], [7, ""], [30, ""], [90, ""], [365, ""]].map(([d, k]) => html`<button class="chip" type="button" data-act="tr-days" data-d="${d}" aria-pressed="${TR.days === d}">${k ? t(k) : t("insDays", { n: d })}</button>`)}</div>
<button class="btn btn--ghost btn--sm" type="button" data-act="tr-csv">${icon("doc", 15)}${t("insCsv")}</button></div>
<div class="metrics">${metric("trNow", num(D.now), t("trNowSub"), true)}${metric("trVisitors", num(T.visitors), t("trVisitorsSub"))}${metric("trViews", num(T.views), "")}${metric("trVisits", num(T.visits), t("trPerVisit", { n: T.viewsPerVisit }))}
${metric("trBounce", T.leftAfterOne == null ? "—" : T.leftAfterOne + "%", t("trBounceSub"))}${metric("trShares", num(D.shares.total), t("trSharesSub"))}${metric("trSpeed", ms(D.speed.median), t("trSlowQ", { v: ms(D.speed.slowQuarter) }))}</div>
<section class="card"><h2 class="card-h">${t(D.period.byWeek ? "trSeriesW" : "trSeries")}</h2><p class="card-p">${t("trSeriesP")}</p>
<div class="tr-chart" role="img" aria-label="${t("trViews")}" style="--n:${D.series.length}">${D.series.map(s => html`<span class="tr-col" title="${s.day}: ${s.visitors} ${t("trVisitors")}, ${s.views} ${t("trViews")}"><i class="tr-v" style="--h:${Math.round(s.views / maxV * 100)}%"></i><i class="tr-u" style="--h:${Math.round(s.visitors / maxV * 100)}%"></i></span>`)}</div>
<p class="legend"><span class="key key--a"></span>${t("trViews")}<span class="key key--h"></span>${t("trVisitors")}</p></section>
<div class="ins-grid">
<section class="card"><h2 class="card-h">${t("trSourcesH")}</h2>${trList(D.sources, k => trLabel(k, TR_SOURCES))}<p class="note">${t("trUtmHint")}</p></section>
<section class="card"><h2 class="card-h">${t("trSharesH")}</h2>${trList(D.shares.byApp, k => trLabel(k, TR_SOURCES))}${D.shares.pages.length ? html`<h3 class="ck-h">${t("trSharedPages")}</h3>${trList(D.shares.pages, k => trLabel(k, TR_PAGES))}` : ""}</section>
<section class="card"><h2 class="card-h">${t("trPagesH")}</h2>${trList(D.pages, k => trLabel(k, TR_PAGES))}</section>
<section class="card"><h2 class="card-h">${t("trFunnelH")}</h2><ul class="tr-list tr-funnel">${step("trFVisitors", F.visitors)}${step("trFSignups", F.signups, F.visitors)}${step("trFProfiles", F.profiles, F.signups)}${step("trFApplied", F.applied, F.profiles)}${step("trFHired", F.hired, F.applied)}</ul><p class="note">${t("trFunnelP")}</p></section>
${D.campaigns.length ? html`<section class="card"><h2 class="card-h">${t("trCampaignsH")}</h2>${trList(D.campaigns, k => k)}</section>` : ""}
<section class="card"><h2 class="card-h">${t("trDevicesH")}</h2>${trList(D.devices, k => t("trd_" + k))}<h3 class="ck-h">${t("trBrowsersH")}</h3>${trList(D.browsers, k => k)}<h3 class="ck-h">${t("trSystemsH")}</h3>${trList(D.systems, k => k)}</section>
<section class="card"><h2 class="card-h">${t("trConnH")}</h2>${trList(D.connections, k => k.toUpperCase().replace("SLOW-2G", "Slow 2G"))}
${Object.keys(D.speed.byConn).length ? html`<h3 class="ck-h">${t("trSpeedByConn")}</h3><ul class="tr-list">${Object.entries(D.speed.byConn).map(([k, v]) => html`<li><span class="tr-k">${k.toUpperCase().replace("SLOW-2G", "Slow 2G")}</span><span class="tr-n num">${ms(v.median)}</span></li>`)}</ul>` : ""}<p class="note">${t("trConnP")}</p></section>
<section class="card"><h2 class="card-h">${t("trWhoH")}</h2>${trList(D.variants, k => t("trv_" + k))}<h3 class="ck-h">${t("trLangH")}</h3>${trList(D.languages, k => (k === "ar" ? "العربية" : k === "en" ? "English" : "?"))}<h3 class="ck-h">${t("trRolesH")}</h3>${trList(D.roles, k => t("trr_" + k))}
${D.countries.length ? html`<h3 class="ck-h">${t("trCountriesH")}</h3>${trList(D.countries, k => k)}` : ""}</section>
<section class="card"><h2 class="card-h">${t("trErrorsH")}</h2>${D.errors.length ? html`<ul class="tr-list">${D.errors.map(e => html`<li><span class="tr-k" dir="ltr">${e.key}</span><span class="tr-n num">${fmt(e.n)}</span></li>`)}</ul>` : html`<p class="empty-p">${t("trNoErrors")}</p>`}</section>
</div><p class="note">${t("trNote")}</p></div>`;
}
/* ---------- the team's System tab ---------- */
async function drawSystem() { const b = $("#admBody"); TR.sys = await api.get("/api/admin/system"); put(b, systemHTML()); }
function systemHTML() {
  const Y = TR.sys, num = n => fmt(n || 0), up = s => { const d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60); return d ? t("trUpD", { d, h }) : h ? t("trUpH", { h, m }) : t("trUpM", { m }); };
  const metric = (k, n, sub, big) => html`<div class="metric${big ? " metric--big" : ""}"><span class="metric-n num">${n}</span><span class="metric-k">${t(k)}</span>${sub ? html`<span class="metric-sub">${sub}</span>` : ""}</div>`;
  const R = Y.requests, rows = (list) => html`<dl class="kv">${list.map(([k, v]) => html`<div class="kv-row"><dt>${k}</dt><dd class="num">${v}</dd></div>`)}</dl>`;
  const health = R.lastHour.failed ? "syFailing" : R.lastHour.n ? "syHealthy" : "syQuiet";
  return html`<div class="ins tr">
<div class="ins-bar-top"><p class="lh-sub">${t("sySub")}</p><button class="btn btn--ghost btn--sm" type="button" data-act="sy-refresh">${icon("refresh", 15)}${t("syRefresh")}</button></div>
<div class="metrics">${metric(health, t(health + "V"), t("syHealthSub", { n: num(R.lastHour.failed) }), true)}${metric("syUptime", up(Y.uptimeSeconds), t("sySince", { when: new Date(Y.startedAt).toLocaleString(S.lang === "ar" ? "ar-SY" : "en-GB") }))}
${metric("syMemory", `${Y.memoryMb} MB`, "")}${metric("syDb", `${Y.dbMb} MB`, "")}${metric("syBackup", Y.lastBackup ? dayLabel(Y.lastBackup) : t("syNoBackup"), Y.lastBackup ? "" : t("syNoBackupP"))}</div>
<div class="ins-grid">
<section class="card"><h2 class="card-h">${t("syReqH")}</h2>${rows([[t("syLastHour"), t("syReqV", { n: num(R.lastHour.n), ok: num(R.lastHour.ok), refused: num(R.lastHour.refused), failed: num(R.lastHour.failed) })],
  [t("syLastDay"), t("syReqV", { n: num(R.lastDay.n), ok: num(R.lastDay.ok), refused: num(R.lastDay.refused), failed: num(R.lastDay.failed) })], [t("syAvg"), `${R.lastDay.avgMs} ${t("trMs")}`]])}<p class="note">${t("syReqP")}</p></section>
<section class="card"><h2 class="card-h">${t("sySlowH")}</h2>${Y.slowest.length ? html`<ul class="tr-list">${Y.slowest.map(r => html`<li><span class="tr-k" dir="ltr">${r.route}</span><span class="tr-n num">${r.avgMs} ${t("trMs")}</span></li>`)}</ul>` : html`<p class="empty-p">${t("trNone")}</p>`}</section>
<section class="card"><h2 class="card-h">${t("syFailH")}</h2>${Y.recentFailures.length ? html`<ul class="tr-list">${Y.recentFailures.map(f => html`<li><span class="tr-k" dir="ltr">${f.route}</span><span class="tr-n num">${f.status} · ${dayLabel(f.at)}</span></li>`)}</ul>` : html`<p class="empty-p">${t("syNoFail")}</p>`}</section>
<section class="card"><h2 class="card-h">${t("syDataH")}</h2>${rows([[t("insUsers"), num(Y.rows.users)], [t("insJobsH"), num(Y.rows.jobs)], [t("insApps"), num(Y.rows.applications)], [t("trViews"), num(Y.rows.pageviews)], [t("syTexts"), t("syTextsV", { ok: num(Y.messages.textsSentDay), bad: num(Y.messages.textsFailedDay) })], [t("syNode"), Y.node], [t("syMode"), t(Y.production ? "syProd" : "syDev")]])}</section>
</div></div>`;
}
async function trafficAct(act, el) {
  try {
    if (act === "tr-days") { TR.days = Number(el.dataset.d); await drawTraffic(); }
    else if (act === "sy-refresh") await drawSystem();
    else if (act === "tr-csv") { const D = TR.data, out = [];
      out.push({ section: "totals", metric: "on the site now", value: D.now }); for (const [k, v] of Object.entries(D.totals)) out.push({ section: "totals", metric: k, value: v });
      D.series.forEach(s => out.push({ section: "by day", metric: s.day, value: `${s.visitors} visitors, ${s.views} page views` }));
      for (const sec of ["pages", "sources", "campaigns", "devices", "browsers", "systems", "connections", "languages", "variants", "roles", "countries", "errors"]) (D[sec] || []).forEach(r => out.push({ section: sec, metric: r.key, value: r.n }));
      D.shares.byApp.forEach(r => out.push({ section: "shares", metric: r.key, value: r.n })); for (const [k, v] of Object.entries(D.funnel)) out.push({ section: "visit to hire", metric: k, value: v });
      downloadCSV(`shaghilni-traffic-${D.period.days}d.csv`, out); }
  } catch (err) { toast({ title: errText(err), ic: "alert" }); }
}
