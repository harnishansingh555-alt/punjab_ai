/* Punjab AI animated theme. Never changes sign in, links or data; it only adds the look and motion. */
(function () {
  var d = document, root = d.documentElement;
  root.dataset.theme = "dark"; // dark galaxy theme only
  root.classList.add("js");
  var RM = false, OFF = false;
  try { RM = matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}
  try { OFF = localStorage.getItem("paiAnim") === "off"; } catch (e) {}
  if (OFF) root.classList.add("noanim");
  var still = RM || OFF;

  function ready() {
    // moving background
    var a = d.createElement("div");
    a.className = "aurora"; a.setAttribute("aria-hidden", "true"); a.innerHTML = "<i></i><i></i><i></i>";
    d.body.insertBefore(a, d.body.firstChild);

    // cards and sections slide in while scrolling
    if (!still && "IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
      }, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
      var seen = new Map();
      d.querySelectorAll(".card,details,.steps li,.block h2,.block .lead,.closing,main > h1,main > .lead,.hero-grid > div:first-child > *").forEach(function (el) {
        var p = el.parentElement, n = seen.get(p) || 0; seen.set(p, n + 1);
        el.style.setProperty("--d", Math.min(n, 6) * 70 + "ms");
        el.classList.add("reveal"); io.observe(el);
      });
    }

    // home page chat preview types by itself
    var body = d.querySelector(".demo .dbody");
    if (body) {
      var ps = [].slice.call(body.querySelectorAll("p")), txt = ps.map(function (p) { return Array.from(p.textContent); });
      var show = function (p) { p.style.animation = "none"; p.style.opacity = 1; };
      if (still) { ps.forEach(show); }
      else {
        var run = function () {
          ps.forEach(function (p) { p.textContent = ""; p.style.animation = "none"; p.style.opacity = 0; });
          var i = 0;
          (function next() {
            if (i >= ps.length) { return setTimeout(run, 4500); }
            var p = ps[i], t = txt[i], n = 0, fast = p.classList.contains("u");
            show(p); p.classList.add("typing");
            (function tick() {
              n += fast ? 2 : 3; p.textContent = t.slice(0, n).join("");
              if (n < t.length) { setTimeout(tick, fast ? 40 : 30); }
              else { p.classList.remove("typing"); i++; setTimeout(next, 650); }
            })();
          })();
        };
        setTimeout(run, 500);
      }
    }

    // smooth fade when moving between pages
    d.addEventListener("click", function (e) {
      if (still || e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      var l = e.target.closest && e.target.closest("a[href]");
      if (!l || l.target || l.hasAttribute("download")) return;
      var h = l.getAttribute("href");
      if (!h || h.charAt(0) === "#" || /^(mailto:|tel:|javascript:)/i.test(h) || l.origin !== location.origin) return;
      if (l.pathname === location.pathname && l.search === location.search) return;
      e.preventDefault(); d.body.classList.add("leaving");
      setTimeout(function () { location.href = l.href; }, 220);
    });
    addEventListener("pageshow", function () { d.body.classList.remove("leaving"); });
  }
  if (d.readyState === "loading") d.addEventListener("DOMContentLoaded", ready); else ready();
})();
