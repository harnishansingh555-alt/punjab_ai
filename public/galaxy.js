/* Punjab AI galaxy: a real 3D spiral galaxy drawn on a canvas (own perspective maths, no libraries),
   mouse parallax, shooting stars, a floating planet and 3D tilt cards. Visual only. */
(function () {
  var d = document, root = d.documentElement;
  var RM = false, OFF = false, COARSE = false;
  try { RM = matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}
  try { OFF = localStorage.getItem("paiAnim") === "off"; } catch (e) {}
  try { COARSE = matchMedia("(pointer: coarse)").matches; } catch (e) {}
  var still = RM || OFF;

  function ready() {
    var cv = d.createElement("canvas");
    cv.id = "galaxy"; cv.setAttribute("aria-hidden", "true");
    d.body.insertBefore(cv, d.body.firstChild);
    var ctx = cv.getContext("2d");
    if (!ctx) return;

    // floating planet with ring and moon
    var planet = d.createElement("div");
    planet.className = "planet"; planet.setAttribute("aria-hidden", "true");
    planet.innerHTML = '<i class="ring back"></i><div class="orb3d"></div><i class="ring front"></i><div class="sys"><i class="moon"></i></div>';
    d.body.insertBefore(planet, d.body.firstChild);

    var W = 0, H = 0, dpr = 1, bg = null;
    var small = innerWidth < 700;
    var NG = small ? 1000 : 2400, NS = small ? 90 : 230;
    var gal = [], stars = [], shoot = null, nextShoot = 3;

    function rnd() { return Math.random(); }
    function gauss() { return (rnd() + rnd() + rnd() + rnd() - 2) / 2; }

    // spiral galaxy: 3 arms, warm gold core, violet/pink middle, blue edge
    for (var i = 0; i < NG; i++) {
      var r = Math.pow(rnd(), 1.6);
      var arm = (i % 3) * (Math.PI * 2 / 3);
      var th = arm + r * 5.4 + gauss() * (0.42 - r * 0.16);
      var h, s, l;
      if (r < 0.16) { h = 38 + rnd() * 14; s = 95; l = 78; }
      else if (r < 0.5) { h = 285 + rnd() * 50; s = 90; l = 70; }
      else { h = 195 + rnd() * 50; s = 90; l = 72; }
      gal.push({
        x: Math.cos(th) * r, z: Math.sin(th) * r, y: gauss() * 0.1 * (1 - r * 0.6),
        s: 1 + rnd() * 2.2, glow: rnd() < 0.09 ? (r < 0.16 ? 0 : (r < 0.5 ? 1 : 2)) : -1,
        c: "hsla(" + Math.round(h) + "," + s + "%," + l + "%," + (0.45 + rnd() * 0.5).toFixed(2) + ")"
      });
    }
    for (var k = 0; k < NS; k++) {
      stars.push({ x: rnd(), y: rnd(), z: 0.15 + rnd() * 0.85, p: rnd() * 6.28, f: 0.6 + rnd() * 1.8, b: rnd() < 0.08 });
    }

    var sprites = [["255,200,130", "255,214,160"], ["190,90,255", "255,120,220"], ["70,160,255", "120,220,255"]].map(function (c) {
      var o = d.createElement("canvas"); o.width = o.height = 64;
      var x = o.getContext("2d"), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0, "rgba(" + c[1] + ",.9)"); g.addColorStop(0.35, "rgba(" + c[0] + ",.28)"); g.addColorStop(1, "rgba(" + c[0] + ",0)");
      x.fillStyle = g; x.fillRect(0, 0, 64, 64); return o;
    });

    function size() {
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      W = innerWidth; H = innerHeight;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      bg = ctx.createRadialGradient(W * 0.6 * dpr, H * 0.4 * dpr, 0, W * 0.6 * dpr, H * 0.4 * dpr, Math.max(W, H) * dpr);
      bg.addColorStop(0, "#150A33"); bg.addColorStop(0.45, "#0A0522"); bg.addColorStop(1, "#04020C");
      small = W < 700;
    }

    var mx = 0, my = 0, tx = 0, ty = 0, ang = 0, last = 0, t = 0;
    var hero = d.querySelector(".hero h1");
    var lastHX = 0, lastHY = 0;

    function frame(now) {
      var dt = last ? Math.min((now - last) / 1000, 0.05) : 0.016; last = now; t += dt;
      if (COARSE) { tx = Math.sin(t * 0.25) * 0.6; ty = Math.cos(t * 0.2) * 0.4; }
      mx += (tx - mx) * 0.05; my += (ty - my) * 0.05;
      if (!still) ang += dt * 0.07;
      draw();
      if (!still) requestAnimationFrame(frame);
    }

    function draw() {
      var w = W * dpr, h = H * dpr;
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = "lighter";

      var sy = (window.pageYOffset || 0);
      var cx = (small ? 0.5 : 0.62) * w + mx * 18 * dpr;
      var cy = (small ? 0.34 : 0.42) * h + my * 12 * dpr - sy * 0.1 * dpr;
      var S = Math.max(w, h) * (small ? 0.6 : 0.44);

      // glowing core
      var g = ctx.createRadialGradient(cx, cy, 0, cx, cy, S * 0.38);
      g.addColorStop(0, "rgba(255,214,160,.42)"); g.addColorStop(0.3, "rgba(180,110,255,.2)"); g.addColorStop(1, "rgba(80,40,200,0)");
      ctx.fillStyle = g; ctx.fillRect(cx - S * 0.4, cy - S * 0.4, S * 0.8, S * 0.8);

      // 3D rotation + perspective
      var yaw = ang + mx * 0.35, tilt = 1.02 + my * 0.22 + sy * 0.0004;
      var cyw = Math.cos(yaw), syw = Math.sin(yaw), ct = Math.cos(tilt), st = Math.sin(tilt), f = 2.4;
      for (var i = 0; i < gal.length; i++) {
        var p = gal[i];
        var x1 = p.x * cyw + p.z * syw, z1 = -p.x * syw + p.z * cyw;
        var y2 = p.y * ct - z1 * st, z2 = p.y * st + z1 * ct;
        var k = f / (f + z2);
        var sx = cx + x1 * S * k, sy2 = cy + y2 * S * k;
        if (sx < -6 || sx > w + 6 || sy2 < -6 || sy2 > h + 6) continue;
        var r = p.s * k * dpr;
        if (p.glow >= 0) {
          var gs = r * 9; ctx.globalAlpha = 0.5;
          ctx.drawImage(sprites[p.glow], sx - gs / 2, sy2 - gs / 2, gs, gs); ctx.globalAlpha = 1;
        }
        ctx.fillStyle = p.c;
        ctx.beginPath(); ctx.arc(sx, sy2, r * 0.6, 0, 6.2832); ctx.fill();
      }

      // far stars with parallax and twinkle
      for (var j = 0; j < stars.length; j++) {
        var q = stars[j];
        var px = ((q.x * w + mx * 30 * q.z * dpr) % w + w) % w;
        var py = ((q.y * h + my * 20 * q.z * dpr - sy * 0.04 * q.z * dpr) % h + h) % h;
        var a = 0.35 + 0.65 * Math.abs(Math.sin(t * q.f + q.p));
        var sz = (q.b ? 2.4 : 1.2) * q.z * dpr + 0.4;
        ctx.fillStyle = "rgba(235,228,255," + (a * (0.4 + q.z * 0.6)).toFixed(2) + ")";
        ctx.fillRect(px, py, sz, sz);
        if (q.b) {
          ctx.fillStyle = "rgba(200,180,255," + (a * 0.25).toFixed(2) + ")";
          ctx.fillRect(px - sz * 2, py + sz * 0.3, sz * 5, sz * 0.4);
          ctx.fillRect(px + sz * 0.3, py - sz * 2, sz * 0.4, sz * 5);
        }
      }

      // shooting star
      if (!still) {
        nextShoot -= 0.016;
        if (!shoot && nextShoot <= 0) {
          shoot = { x: rnd() * w * 0.8, y: rnd() * h * 0.4, vx: (0.9 + rnd() * 0.6) * w * 0.9, vy: (0.35 + rnd() * 0.3) * w * 0.5, life: 0 };
          nextShoot = 4 + rnd() * 6;
        }
        if (shoot) {
          shoot.life += 0.016; shoot.x += shoot.vx * 0.016; shoot.y += shoot.vy * 0.016;
          var fa = Math.max(0, 1 - shoot.life / 1.1);
          var gl = ctx.createLinearGradient(shoot.x, shoot.y, shoot.x - shoot.vx * 0.12, shoot.y - shoot.vy * 0.12);
          gl.addColorStop(0, "rgba(255,255,255," + fa.toFixed(2) + ")"); gl.addColorStop(1, "rgba(150,110,255,0)");
          ctx.strokeStyle = gl; ctx.lineWidth = 1.6 * dpr; ctx.beginPath();
          ctx.moveTo(shoot.x, shoot.y); ctx.lineTo(shoot.x - shoot.vx * 0.12, shoot.y - shoot.vy * 0.12); ctx.stroke();
          if (shoot.life > 1.1) shoot = null;
        }
      }

      // planet and hero title follow the pointer a little
      var pxm = (mx * -16).toFixed(1), pym = (my * -12).toFixed(1);
      planet.style.transform = "translate3d(" + pxm + "px," + pym + "px,0)";
      if (hero) {
        var hx = Math.round(-my * 5 * 10) / 10, hy = Math.round(mx * 7 * 10) / 10;
        if (Math.abs(hx - lastHX) > 0.1 || Math.abs(hy - lastHY) > 0.1) {
          lastHX = hx; lastHY = hy;
          hero.style.transform = "perspective(900px) rotateX(" + hx + "deg) rotateY(" + hy + "deg)";
        }
      }
    }

    size();
    addEventListener("resize", function () { size(); if (still) draw(); });
    if (!COARSE) {
      addEventListener("pointermove", function (e) {
        if (e.pointerType === "touch") return;
        tx = (e.clientX / W - 0.5) * 2; ty = (e.clientY / H - 0.5) * 2;
      }, { passive: true });
    }
    if (still) { draw(); } else { requestAnimationFrame(frame); }

    // 3D tilt: the card under the pointer leans toward it
    var tiltSel = ".card,.demo,.closing,.cta-band,.gate .box,.chips button,.keybox,.examples li";
    var cur = null;
    function clear() {
      if (!cur) return;
      cur.classList.remove("tilting");
      cur.style.removeProperty("--rx"); cur.style.removeProperty("--ry");
      cur.style.removeProperty("--mx"); cur.style.removeProperty("--my");
      cur = null;
    }
    if (!still && !COARSE) {
      d.addEventListener("pointermove", function (e) {
        if (e.pointerType === "touch") return;
        var el = e.target.closest ? e.target.closest(tiltSel) : null;
        if (el !== cur) { clear(); if (el) { cur = el; el.classList.add("tilting"); } }
        if (!cur) return;
        var b = cur.getBoundingClientRect();
        var px = (e.clientX - b.left) / b.width, py = (e.clientY - b.top) / b.height;
        cur.style.setProperty("--ry", ((px - 0.5) * 12).toFixed(2) + "deg");
        cur.style.setProperty("--rx", ((0.5 - py) * 10).toFixed(2) + "deg");
        cur.style.setProperty("--mx", (px * 100).toFixed(1) + "%");
        cur.style.setProperty("--my", (py * 100).toFixed(1) + "%");
      }, { passive: true });
      d.addEventListener("pointerleave", clear);
      addEventListener("blur", clear);
    }
  }
  if (d.readyState === "loading") d.addEventListener("DOMContentLoaded", ready); else ready();
})();
