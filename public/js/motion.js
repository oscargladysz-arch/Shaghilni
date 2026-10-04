/* =====================================================================
   Shaghilni next — interaction primitives (recipes from Emil Kowalski's
   design-engineering skill, hand-built because Vaul/Sonner/Base UI ship
   no browser build usable in a single self-contained page).
   ===================================================================== */

/* Was the last thing the person did a key press? Keyboard-driven changes never animate. */
let lastInput = "pointer";
const byKeyboard = () => lastInput === "keyboard";

const NARROW_Q = "(max-width: 899px)";
const isNarrow = () => (window.matchMedia ? window.matchMedia(NARROW_Q).matches : (window.innerWidth || 1280) < 900);
const reduced = () => !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
const nextFrame = fn => requestAnimationFrame(() => requestAnimationFrame(fn));

/* ---------- layer: one surface, a sheet on phones and a modal on desktop ---------- */
const Layer = { ignorePop: false, ignoreHash: false, pushedFrom: "", pushedHash: "", open: false, kind: null, onClose: null, lastFocus: null, pushed: false, drag: null, suppressClick: false, timer: 0 };
function layerOpen(content, opts = {}) {
  const layer = $("#layer"), panel = $("#panel");
  if (Layer.open) layerClose(true);
  if (!opts.detail) for (const x of [...Toasts.items]) toastRemove(x.id, true);   // a task panel starts clean: no stale toast over its main button
  const kind = opts.kind || (isNarrow() ? "sheet" : "modal");
  Layer.open = true; Layer.kind = kind; Layer.onClose = opts.onClose || null; Layer.lastFocus = opts.returnFocus || document.activeElement;
  panel.className = "panel panel--" + kind + (opts.detail ? " panel--detail" : "");
  panel.setAttribute("aria-label", opts.label || "");
  put(panel, html`${kind === "sheet" ? html`<button class="grab" type="button" data-act="layer-close" aria-label="${t("sheetGrab")}"></button>` : ""}${content}`);
  clearTimeout(Layer.timer);
  layer.hidden = false;
  layer.dataset.state = "closed";
  void layer.offsetHeight;
  const show = () => {
    layer.dataset.state = "open";
    if (kind === "sheet" && isNarrow()) { const app = $("#app"); app.style.transform = "scale(0.94) translateY(10px)"; app.style.borderRadius = "14px"; app.style.overflow = "hidden"; }
  };
  if (byKeyboard()) { layer.dataset.state = "open"; } else nextFrame(show);
  if (byKeyboard() && kind === "sheet" && isNarrow()) show();
  $("#app").inert = true;
  if (opts.history && kind === "sheet") { try { Layer.pushedFrom = location.hash; Layer.pushedHash = opts.hash || location.hash; history.pushState({ layer: true }, "", Layer.pushedHash); Layer.pushed = true; } catch (e) { Layer.pushed = false; } }
  const f = panel.querySelector("[data-autofocus]") || panel;
  f.focus({ preventScroll: true });
}
function layerClose(instant, viaPop) {
  if (!Layer.open) return;
  if (Layer.pushed && !viaPop) {   // close now; let history catch up silently, and tell the router this hash change is ours
    Layer.ignorePop = true;
    if (Layer.pushedFrom !== Layer.pushedHash) { Layer.ignoreHash = true; setTimeout(() => { Layer.ignoreHash = false; }, 600); }
    try { history.back(); } catch (e) { Layer.ignorePop = false; Layer.ignoreHash = false; }
  }
  Layer.pushed = false;
  const layer = $("#layer"), app = $("#app");
  Layer.open = false;
  app.style.transform = ""; app.style.borderRadius = ""; app.style.overflow = "";
  const done = () => {
    layer.hidden = true; layer.dataset.state = "closed"; put($("#panel"), html``);
    app.inert = false;
    const f = Layer.lastFocus; Layer.lastFocus = null;
    if (f && document.contains(f) && f.focus) f.focus({ preventScroll: true });
    const cb = Layer.onClose; Layer.onClose = null; if (cb) cb();
  };
  if (instant || byKeyboard() || reduced()) { done(); return; }
  layer.dataset.state = "closing";
  Layer.timer = setTimeout(done, Layer.kind === "sheet" ? 330 : 160);
}
/* drag to dismiss: momentum, not just distance */
function sheetDragStart(e) {
  if (Layer.kind !== "sheet" || Layer.drag || (e.button && e.button > 0)) return;   // multi-touch protection
  const h = e.target.closest(".grab, .p-head");
  if (!h) return;
  const panel = $("#panel");
  Layer.drag = { y0: e.clientY, t0: Date.now(), dy: 0, id: e.pointerId, h };
  try { h.setPointerCapture(e.pointerId); } catch (x) { /* synthetic */ }
  panel.classList.add("panel--dragging");
}
function sheetDragMove(e) {
  const d = Layer.drag;
  if (!d || e.pointerId !== d.id) return;
  let dy = e.clientY - d.y0;
  if (dy < 0) dy = -Math.pow(-dy, 0.72);   // friction past the top instead of a wall
  d.dy = dy;
  const panel = $("#panel"), p = Math.max(0, Math.min(1, dy / (panel.offsetHeight || 1)));
  panel.style.transform = `translateY(${dy}px)`;
  $("#layer .scrim").style.opacity = String(1 - p);
  if (isNarrow()) $("#app").style.transform = `scale(${(0.94 + 0.06 * p).toFixed(4)}) translateY(${(10 * (1 - p)).toFixed(1)}px)`;
}
function sheetDragEnd(e) {
  const d = Layer.drag;
  if (!d || e.pointerId !== d.id) return;
  Layer.drag = null;
  const panel = $("#panel"), dt = Math.max(1, Date.now() - d.t0), v = Math.abs(d.dy) / dt;
  panel.classList.remove("panel--dragging");
  panel.style.transform = ""; $("#layer .scrim").style.opacity = "";
  if (Math.abs(d.dy) > 4) Layer.suppressClick = true;
  if (d.dy > 0 && (d.dy > (panel.offsetHeight || 1) * 0.25 || v > 0.11)) layerClose();
  else if (isNarrow() && Layer.open) $("#app").style.transform = "scale(0.94) translateY(10px)";
}

/* ---------- popover: grows out of its trigger ---------- */
const Pop = { open: false, trigger: null, timer: 0 };
function popOpen(trigger, content) {
  const pop = $("#pop");
  clearTimeout(Pop.timer);
  put(pop, content);
  pop.hidden = false; pop.dataset.state = "closed";
  const r = trigger.getBoundingClientRect(), rtl = document.documentElement.dir === "rtl";
  const w = pop.offsetWidth || 300, h = pop.offsetHeight || 260, vw = window.innerWidth || 1280, vh = window.innerHeight || 800;
  const up = r.bottom + 8 + h > vh && r.top - 8 - h > 0;
  const x = rtl ? Math.min(r.left, vw - w - 12) : Math.max(12, (r.right || 0) - w);
  const y = up ? r.top - 8 - h : r.bottom + 8;
  pop.style.left = Math.max(12, x) + "px"; pop.style.top = Math.max(12, y) + "px";
  pop.style.setProperty("--origin", `${up ? "bottom" : "top"} ${rtl ? "left" : "right"}`);
  Pop.open = true; Pop.trigger = trigger;
  trigger.setAttribute("aria-expanded", "true");
  if (byKeyboard()) pop.dataset.state = "open"; else nextFrame(() => { pop.dataset.state = "open"; });
  const f = pop.querySelector("button"); if (f && byKeyboard()) f.focus();
}
function popClose(refocus) {
  if (!Pop.open) return;
  const pop = $("#pop"), tr = Pop.trigger;
  Pop.open = false; Pop.trigger = null;
  if (tr) tr.setAttribute("aria-expanded", "false");
  const done = () => { pop.hidden = true; pop.dataset.state = "closed"; };
  if (byKeyboard() || reduced()) done(); else { pop.dataset.state = "closing"; Pop.timer = setTimeout(done, 130); }
  if (refocus && tr) tr.focus();
}

/* ---------- toaster ---------- */
const Toasts = { items: [], seq: 0, hover: false };
const TOAST_GAP = 10;
function toast({ title, sub = "", ic = "check", action = null, duration }) {
  const box = $("#toaster"), id = ++Toasts.seq, el = document.createElement("li");
  el.className = "toast"; el.dataset.id = String(id);
  el.setAttribute("role", "status");
  put(el, html`<span class="toast-ic" aria-hidden="true">${icon(ic, 13, 2.4)}</span><span class="toast-txt"><span class="toast-t">${title}</span>${sub ? html`<span class="toast-s">${sub}</span>` : ""}</span>${action ? html`<button class="toast-act" type="button" data-act="${action.act}" data-id="${action.id != null ? action.id : ""}" data-toast="${id}">${action.label}</button>` : ""}`);
  box.prepend(el);
  const item = { id, el, left: duration || (action ? 6500 : 4200), started: 0, timer: 0, gone: false };
  Toasts.items.unshift(item);
  while (Toasts.items.filter(x => !x.gone).length > 4) toastRemove(Toasts.items.filter(x => !x.gone).pop().id, true);
  nextFrame(layoutToasts);
  toastRun(item);
  return id;
}
function toastRun(item) {
  if (item.gone || Toasts.hover || document.hidden) return;
  item.started = Date.now();
  clearTimeout(item.timer);
  item.timer = setTimeout(() => toastRemove(item.id), item.left);
}
function toastPause(item) { if (!item.started) return; clearTimeout(item.timer); item.left = Math.max(800, item.left - (Date.now() - item.started)); item.started = 0; }
function layoutToasts() {
  const live = Toasts.items.filter(x => !x.gone);
  let offset = 0;
  const frontH = live[0] ? live[0].el.offsetHeight : 0;
  live.forEach((x, i) => {
    const el = x.el;
    el.style.zIndex = String(100 - i);
    if (Toasts.hover) { el.style.transform = `translateY(${-offset}px)`; el.style.opacity = "1"; offset += (el.offsetHeight || 60) + TOAST_GAP; el.style.height = ""; }
    else {
      el.style.transform = `translateY(${-i * 10}px) scale(${(1 - i * 0.05).toFixed(3)})`;
      el.style.opacity = i < 3 ? "1" : "0";
      el.style.height = i === 0 || !frontH ? "" : frontH + "px";
    }
    el.dataset.front = i === 0 ? "true" : "false";
  });
  const box = $("#toaster"); if (box) box.dataset.expanded = Toasts.hover ? "true" : "false";
}
function toastRemove(id, instant) {
  const x = Toasts.items.find(i => i.id === id);
  if (!x || x.gone) return;
  x.gone = true; clearTimeout(x.timer);
  const el = x.el;
  if (instant || reduced()) el.remove();
  else { el.style.transition = "transform 200ms var(--ease-out), opacity 200ms var(--ease-out)"; el.style.opacity = "0"; el.style.transform = "translateY(40%)"; setTimeout(() => el.remove(), 210); }
  Toasts.items = Toasts.items.filter(i => i.id !== id || !i.gone || document.contains(i.el));
  layoutToasts();
}
const TDrag = { item: null, y0: 0, t0: 0, dy: 0, id: null };
function toastDragStart(e) {
  const el = e.target.closest(".toast");
  if (!el || TDrag.item || e.target.closest("button")) return;
  const item = Toasts.items.find(x => x.el === el && !x.gone);
  if (!item) return;
  Object.assign(TDrag, { item, y0: e.clientY, t0: Date.now(), dy: 0, id: e.pointerId });
  try { el.setPointerCapture(e.pointerId); } catch (x) { /* synthetic */ }
  el.style.transition = "none";
}
function toastDragMove(e) {
  if (!TDrag.item || e.pointerId !== TDrag.id) return;
  let dy = e.clientY - TDrag.y0;
  if (dy < 0) dy = -Math.pow(-dy, 0.6);
  TDrag.dy = dy;
  TDrag.item.el.style.transform = `translateY(${dy}px)`;
}
function toastDragEnd(e) {
  const d = TDrag;
  if (!d.item || e.pointerId !== d.id) return;
  const v = Math.abs(d.dy) / Math.max(1, Date.now() - d.t0), item = d.item;
  d.item = null;
  item.el.style.transition = "";
  if (d.dy > 40 || (d.dy > 6 && v > 0.11)) toastRemove(item.id); else layoutToasts();
}
function bindToaster() {
  const box = $("#toaster");
  box.addEventListener("pointerenter", e => { if (e.pointerType !== "mouse") return; Toasts.hover = true; Toasts.items.forEach(toastPause); layoutToasts(); });
  box.addEventListener("pointerleave", e => { if (e.pointerType !== "mouse") return; Toasts.hover = false; layoutToasts(); Toasts.items.forEach(toastRun); });
  box.addEventListener("pointerdown", toastDragStart);
  box.addEventListener("pointermove", toastDragMove);
  box.addEventListener("pointerup", toastDragEnd);
  box.addEventListener("pointercancel", toastDragEnd);
  document.addEventListener("visibilitychange", () => { if (document.hidden) Toasts.items.forEach(toastPause); else Toasts.items.forEach(toastRun); });
}

/* ---------- segmented control: clip the active copy to the active button ---------- */
function segSync(root, instant) {
  for (const seg of $$(".seg", root || document)) {
    const inner = seg.querySelector(".seg-inner"), btn = inner && inner.querySelector(':scope > .seg-track [aria-pressed="true"]'), copy = inner && inner.querySelector(".seg-copy");
    if (!btn || !copy) continue;
    const left = btn.offsetLeft, right = (inner.offsetWidth || 0) - left - btn.offsetWidth;
    if (instant || byKeyboard()) seg.dataset.instant = "true";
    copy.style.clipPath = `inset(0 ${Math.max(0, right)}px 0 ${Math.max(0, left)}px round 8px)`;
    if (seg.dataset.instant === "true") nextFrame(() => { seg.dataset.instant = "false"; });
  }
}

/* ---------- hold to confirm: 2s linear to commit, 200ms ease-out to release ---------- */
const Hold = { el: null, timer: 0 };
function holdStart(el) {
  if (Hold.el) return;
  Hold.el = el; el.dataset.holding = "true";
  Hold.timer = setTimeout(() => { const e = Hold.el; holdCancel(); if (e) holdDone(e.dataset.hold); }, reduced() ? 1200 : 2000);
}
function holdCancel() { clearTimeout(Hold.timer); if (Hold.el) Hold.el.dataset.holding = "false"; Hold.el = null; }
