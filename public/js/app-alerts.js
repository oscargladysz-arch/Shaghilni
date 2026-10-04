/* Job alerts: save the search you're looking at, choose how to hear about new jobs, and manage your alerts. */
const AL = { list: null, emailOn: false, textOk: false, busy: false, how: "" };
const alertCrit = () => ({ q: String(S.q || "").trim().slice(0, 60), gov: S.gov && S.gov !== "all" ? S.gov : "", tab: S.tab && S.tab !== "all" && S.tab !== "saved" ? S.tab : "" });
async function loadAlerts() {
  try { const r = await api.get("/api/me/alerts"); AL.list = r.alerts; AL.emailOn = r.emailOn; AL.textOk = r.textOk; S.alertsNew = r.alerts.reduce((n, a) => n + (a.newCount || 0), 0); }
  catch (e) { AL.list = AL.list || []; }
  if (S.view === "alerts") put($("#view"), page(alertsHTML()));
}
function renderAlerts() {
  if (!isSeeker()) { go("#/"); return; }
  if (!AL.list) { put($("#view"), page(html`<div class="al-wrap"><h1 class="h-page">${t("alertsTitle")}</h1><p class="note">${t("loading")}</p></div>`)); loadAlerts(); return; }
  put($("#view"), page(alertsHTML()));
}
function alertsHTML() {
  const c = alertCrit(), me = S.me || {}, emailOk = AL.emailOn && !!me.email;
  const how = AL.how || (emailOk ? "email" : AL.textOk ? "sms" : "app");
  const opt = (v, k, ok, why) => html`<label class="al-how${ok ? "" : " is-off"}"><input type="radio" name="alHow" value="${v}" data-act="al-how"${how === v ? raw(" checked") : ""}${ok ? "" : raw(" disabled")}><span><b>${t(k)}</b>${why ? html`<small>${why}</small>` : ""}</span></label>`;
  const dup = (AL.list || []).some(a => a.q === c.q && a.gov === c.gov && (a.tab || "") === c.tab && !a.type);
  const rows = (AL.list || []).map(a => html`<li class="al-row"><div class="al-row-t"><b>${alertLabel(a, S.lang)}</b><span class="al-row-s">${t("alHow_" + a.channel)}${a.newCount ? html` · <span class="pill pill--good">${t("alNew", { n: a.newCount })}</span>` : ""}</span></div>
<div class="al-row-a"><button class="btn btn--soft btn--sm" type="button" data-act="al-open" data-id="${a.id}">${t("alSee")}</button><button class="ibtn" type="button" data-act="al-del" data-id="${a.id}" aria-label="${t("alDelete")}" title="${t("alDelete")}">${icon("trash", 16)}</button></div></li>`);
  return html`<div class="al-wrap"><h1 class="h-page">${t("alertsTitle")}</h1><p class="p-page">${t("alertsP")}</p>
<section class="card al-new"><h2 class="h-card">${t("alSaveH")}</h2><p class="al-crit">${icon("search", 15)}<span>${alertLabel(c, S.lang)}</span></p>
<fieldset class="fset"><legend class="lbl">${t("alHowL")}</legend>${opt("email", "alEmail", emailOk, emailOk ? me.email : AL.emailOn ? t("alEmailNeed") : t("alEmailOff"))}${opt("sms", "alSms", AL.textOk, AL.textOk ? "" : t("alSmsNo"))}${opt("app", "alApp", true, "")}</fieldset>
${dup ? html`<p class="note">${t("err_alert_exists")}</p>` : html`<button class="btn btn--primary" type="button" data-act="al-save"${AL.busy ? raw(" disabled") : ""}>${icon("bell", 15)}${t("alSaveBtn")}</button>`}
<p class="note al-tip">${t("alTip")}</p></section>
<h2 class="h-sec">${t("alYours")}</h2>${rows.length ? html`<ul class="al-list">${rows}</ul>` : html`<p class="empty-p">${t("alNone")}</p>`}</div>`;
}
async function alertAct(act, el) {
  const id = Number(el.dataset.id), redraw = () => { if (S.view === "alerts") put($("#view"), page(alertsHTML())); };
  const oops = e => { const m = t("err_" + ((e && e.code) || "server_error")); toast({ title: m.startsWith("err_") ? t("err_server_error") : m, ic: "alert" }); };
  switch (act) {
    case "al-how": AL.how = el.value; break;
    case "al-save": {
      const how = AL.how || ($('input[name="alHow"]:checked') || {}).value || "app";
      AL.busy = true; redraw();
      try { const r = await api.post("/api/me/alerts", { alert: alertCrit(), channel: how }); AL.list = [...(AL.list || []), r.alert]; toast({ title: t("alSaved", { how: t("alHow_" + r.alert.channel) }), ic: "check" }); }
      catch (e) { oops(e); }
      AL.busy = false; redraw(); break;
    }
    case "al-del": {
      try { await api.del(`/api/me/alerts/${id}`); AL.list = AL.list.filter(a => a.id !== id); toast({ title: t("tAlDeleted"), ic: "check" }); } catch (e) { oops(e); }
      S.alertsNew = (AL.list || []).reduce((n, a) => n + (a.newCount || 0), 0); redraw(); break;
    }
    case "al-open": {
      const a = (AL.list || []).find(x => x.id === id); if (!a) return;
      S.q = a.q || ""; S.qTerms = norm(S.q).split(" ").filter(Boolean); S.gov = a.gov || "all"; S.tab = a.tab || "all";
      try { await api.post("/api/me/alerts/seen"); } catch (e) {}
      AL.list.forEach(x => { x.newCount = 0; }); S.alertsNew = 0; go("#/");
      const q = $("#q"); if (q) q.value = S.q; break;
    }
  }
}
