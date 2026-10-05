/* ---------- admin: the audit log, read-only: filters, older pages by cursor, and a spreadsheet export of what is on screen ---------- */
const AUD = { rows: [], filters: { action: "", entity: "", entityId: "", actor: "", from: "", to: "" }, before: null, done: false };
const AUD_ENTITIES = ["", "user", "company", "job", "application", "invitation", "event", "programme", "payment"];
function audQuery(more) { const f = AUD.filters, q = new URLSearchParams(); for (const k of Object.keys(f)) if (f[k]) q.set(k, f[k]); q.set("limit", "50"); if (more && AUD.before) q.set("before", AUD.before); return "/api/admin/audit?" + q; }
async function drawAudit(more) {
  const b = $("#admBody"); if (!b) return;
  if (!more) { AUD.rows = []; AUD.before = null; AUD.done = false; }
  const { entries } = await api.get(audQuery(more));
  AUD.rows = more ? AUD.rows.concat(entries) : entries; if (entries.length) AUD.before = entries[entries.length - 1].id; AUD.done = entries.length < 50;
  const f = AUD.filters, when = ts => new Date(ts).toLocaleString(S.lang === "ar" ? "ar-SY-u-nu-latn" : "en-GB", { dateStyle: "short", timeStyle: "short" });
  put(b, html`<section class="card" id="audForm"><div class="grid2">
<span class="field"><label class="lbl" for="audAction">${t("audAction")}</label><input class="inp" id="audAction" value="${f.action}" placeholder="${t("audActionPh")}" dir="ltr" autocomplete="off"></span>
<span class="field"><label class="lbl" for="audEntity">${t("audEntity")}</label><select class="inp" id="audEntity">${AUD_ENTITIES.map(k => html`<option value="${k}"${f.entity === k ? raw(" selected") : ""}>${k || t("audEntityAny")}</option>`)}</select></span>
<span class="field"><label class="lbl" for="audEntityId">${t("audEntityId")}</label><input class="inp" id="audEntityId" inputmode="numeric" value="${f.entityId}" dir="ltr"></span>
<span class="field"><label class="lbl" for="audActor">${t("audActor")}</label><input class="inp" id="audActor" inputmode="numeric" value="${f.actor}" placeholder="${t("audActorPh")}" dir="ltr"></span>
<span class="field"><label class="lbl" for="audFrom">${t("audFrom")}</label><input class="inp" id="audFrom" type="date" value="${f.from}" dir="ltr"></span>
<span class="field"><label class="lbl" for="audTo">${t("audTo")}</label><input class="inp" id="audTo" type="date" value="${f.to}" dir="ltr"></span></div>
<div class="card-act"><button class="btn btn--primary" type="button" data-act="aud-apply">${icon("search", 15)}${t("audApply")}</button><button class="btn" type="button" data-act="aud-clear">${t("audClear")}</button><button class="btn btn--soft" type="button" data-act="aud-csv"${AUD.rows.length ? "" : raw(" disabled")}>${icon("doc", 15)}${t("audCsv")}</button></div></section>
${AUD.rows.length ? html`<div class="tscroll"><table class="tbl"><thead><tr><th>${t("audWhen")}</th><th>${t("audWho")}</th><th>${t("audAction")}</th><th>${t("audEntity")}</th><th>${t("audDetails")}</th></tr></thead>
<tbody>${AUD.rows.map(e => html`<tr><td dir="ltr" class="num">${when(e.created_at)}</td><td dir="ltr">${e.actor === "deleted" ? t("audDeleted") : e.actor || "—"}${e.actor_id ? html` <button class="link link--muted" type="button" data-act="aud-actor" data-id2="${e.actor_id}" aria-label="${t("audOnlyActor", { id: e.actor_id })}">#${e.actor_id}</button>` : ""}</td><td dir="ltr">${e.action}</td><td dir="ltr">${e.entity ? `${e.entity} ${e.entity_id == null ? "" : e.entity_id}` : "—"}</td><td dir="ltr" class="aud-data">${e.data ? JSON.stringify(e.data) : ""}</td></tr>`)}</tbody></table></div>
${AUD.done ? "" : html`<div class="card-act"><button class="btn" type="button" data-act="aud-more">${t("audOlder")}</button></div>`}` : stateHTML("check", t("audEmpty"))}`);
}
async function auditAct(act, el) {
  try {
    if (act === "aud-apply") { for (const k of Object.keys(AUD.filters)) AUD.filters[k] = String(($("#aud" + k[0].toUpperCase() + k.slice(1)) || {}).value || "").trim(); await drawAudit(false); }
    else if (act === "aud-clear") { for (const k of Object.keys(AUD.filters)) AUD.filters[k] = ""; await drawAudit(false); }
    else if (act === "aud-more") await drawAudit(true);
    else if (act === "aud-actor") { AUD.filters.actor = el.dataset.id2; await drawAudit(false); }
    else if (act === "aud-csv") downloadCSV("shaghilni-audit.csv", AUD.rows.map(e => ({ id: e.id, at: new Date(e.created_at).toISOString(), actor: e.actor || "", actorId: e.actor_id || "", action: e.action, entity: e.entity || "", entityId: e.entity_id == null ? "" : e.entity_id, details: e.data ? JSON.stringify(e.data) : "" })));
  } catch (err) { toast({ title: errText(err), ic: "alert" }); }
}
