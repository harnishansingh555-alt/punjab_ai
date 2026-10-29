// Language switch and mobile menu for the content pages.
(function () {
  var root = document.documentElement;
  function setLang(l, save) {
    root.lang = l === "pa" ? "pa" : "en";
    document.querySelectorAll(".lang button").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.lang === root.lang)); });
    if (save) { try { localStorage.setItem("lang", root.lang); } catch (e) {} }
  }
  document.querySelectorAll(".lang button").forEach(function (b) { b.addEventListener("click", function () { setLang(b.dataset.lang, true); }); });
  setLang(root.lang, false);
  var mb = document.querySelector(".menubtn"), menu = document.getElementById("menu");
  if (mb && menu) mb.addEventListener("click", function () {
    var open = menu.classList.toggle("open");
    mb.setAttribute("aria-expanded", String(open));
  });
})();
