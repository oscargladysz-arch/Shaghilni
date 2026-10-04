/* ---------- API client ---------- */
class ApiError extends Error {
  constructor(status, code, detail) { super(code); this.status = status; this.code = code; this.detail = detail; }
}
async function request(method, path, body) {
  let res;
  try {
    res = await fetch(path, { method, credentials: "same-origin",
      headers: { "content-type": "application/json", "x-shaghilni": "1" }, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch (e) { throw new ApiError(0, "offline"); }
  let data = null;
  try { data = await res.json(); } catch (e) { data = null; }
  if (!res.ok) throw new ApiError(res.status, (data && data.error) || "server_error", data && data.detail);
  return data || {};
}
const api = {
  get: p => request("GET", p), post: (p, b = {}) => request("POST", p, b), put: (p, b) => request("PUT", p, b), del: p => request("DELETE", p)
};
/* One readable sentence for every error the server can return. */
function errText(err) {
  const code = err && err.code ? err.code : "server_error";
  if (code === "incomplete" && Array.isArray(err.detail)) return t("err_incomplete", { x: listJoin(err.detail.map(f => (STR[S.lang]["field_" + f] ? t("field_" + f) : f))) });
  if (code === "fee_requested") return t("err_fee_requested", { x: err.detail || "" });
  const key = "err_" + code;
  return STR[S.lang][key] ? t(key) : t("err_server_error");
}
