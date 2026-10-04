/* Runs before first paint: applies the saved theme and language so the page never flashes the wrong one. */
(function () {
  try {
    var s = localStorage, r = document.documentElement;
    var t = JSON.parse(s.getItem("shaghilni.app.theme") || "null"), l = JSON.parse(s.getItem("shaghilni.app.lang") || "null");
    if (t === "light" || t === "dark") r.setAttribute("data-theme", t);
    if (l === "en") { r.lang = "en"; r.dir = "ltr"; } else { r.lang = "ar"; r.dir = "rtl"; }
  } catch (e) { /* storage blocked: defaults apply */ }
})();
