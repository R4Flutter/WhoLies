/*
  WHO'S LYING? — visual effects
  Confetti, floating "+20" numbers, screen shake, counting numbers and the
  detective badge drawing. Everything respects "reduce motion".
*/
(function () {
  "use strict";
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function css(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }

  /* ---------- confetti ---------- */
  var canvas = null, ctx = null, parts = [], raf = 0;
  function ensureCanvas() {
    if (canvas) return;
    canvas = document.createElement("canvas");
    canvas.className = "fx-canvas";
    canvas.setAttribute("aria-hidden", "true");
    document.body.appendChild(canvas);
    ctx = canvas.getContext("2d");
  }
  function resize() {
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = innerWidth * dpr; canvas.height = innerHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function confetti(opts) {
    if (reduce) return;
    opts = opts || {};
    ensureCanvas(); resize();
    var colors = [css("--needle"), css("--tag"), css("--ok"), css("--hint"), css("--ink")];
    var x = opts.x != null ? opts.x : innerWidth / 2, y = opts.y != null ? opts.y : innerHeight * 0.35;
    var n = opts.count || 90;
    for (var i = 0; i < n; i++) {
      var a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.1, sp = 5 + Math.random() * 9;
      parts.push({
        x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.4,
        w: 6 + Math.random() * 6, h: 3 + Math.random() * 5, c: colors[i % colors.length], life: 0, max: 70 + Math.random() * 50,
        shape: Math.random() < 0.25 ? "star" : "rect"
      });
    }
    if (!raf) raf = requestAnimationFrame(step);
  }
  function drawStar(c, s) {
    c.beginPath();
    for (var i = 0; i < 10; i++) {
      var r = i % 2 ? s * 0.45 : s, a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      c[i ? "lineTo" : "moveTo"](Math.cos(a) * r, Math.sin(a) * r);
    }
    c.closePath(); c.fill();
  }
  function step() {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    parts = parts.filter(function (p) { return p.life < p.max && p.y < innerHeight + 40; });
    parts.forEach(function (p) {
      p.life++; p.vy += 0.28; p.vx *= 0.985; p.x += p.vx; p.y += p.vy; p.r += p.vr;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r);
      ctx.globalAlpha = Math.max(0, 1 - p.life / p.max);
      ctx.fillStyle = p.c;
      if (p.shape === "star") drawStar(ctx, p.w * 0.8); else ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    });
    if (parts.length) raf = requestAnimationFrame(step);
    else { raf = 0; ctx.clearRect(0, 0, innerWidth, innerHeight); }
  }

  /* ---------- floating text ("+20 XP") ---------- */
  function float(text, el, cls) {
    var r = el && el.getBoundingClientRect ? el.getBoundingClientRect() : { left: innerWidth / 2, top: innerHeight / 2, width: 0, height: 0 };
    var f = document.createElement("div");
    f.className = "fx-float " + (cls || "");
    f.textContent = text;
    f.setAttribute("aria-hidden", "true");
    f.style.top = (r.top + r.height / 2) + "px";
    document.body.appendChild(f);
    var half = f.offsetWidth / 2 + 8;
    f.style.left = Math.min(Math.max(r.left + r.width / 2, half), innerWidth - half) + "px";
    setTimeout(function () { f.remove(); }, reduce ? 900 : 1300);
  }

  /* ---------- shake ---------- */
  function shake(el) {
    if (reduce || !el) return;
    el.classList.remove("fx-shake"); void el.offsetWidth; el.classList.add("fx-shake");
    setTimeout(function () { el.classList.remove("fx-shake"); }, 450);
  }
  function pop(el) {
    if (!el) return;
    el.classList.remove("fx-pop"); void el.offsetWidth; el.classList.add("fx-pop");
  }

  /* ---------- counting numbers ---------- */
  function countTo(el, from, to, ms) {
    if (!el) return;
    if (reduce || from === to) { el.textContent = fmt(to); return; }
    var t0 = performance.now();
    (function tick(now) {
      var k = Math.min(1, (now - t0) / (ms || 600)), e = 1 - Math.pow(1 - k, 3);
      el.textContent = fmt(Math.round(from + (to - from) * e));
      if (k < 1) requestAnimationFrame(tick);
    })(t0);
  }
  function fmt(n) { return Number(n).toLocaleString("en-US"); }

  /* ---------- detective badge (SVG) ---------- */
  // tier 0-10 picks the badge style; level number goes in the middle.
  function badge(level, tier, size) {
    var metal = tier >= 8 ? "gold" : tier >= 4 ? "silver" : "bronze";
    var pts = [];
    for (var i = 0; i < 14; i++) {
      var r = i % 2 ? 23 : 31, a = (i / 14) * Math.PI * 2 - Math.PI / 2;
      pts.push((32 + Math.cos(a) * r).toFixed(1) + "," + (32 + Math.sin(a) * r).toFixed(1));
    }
    var fs = String(level).length > 2 ? 14 : 17;
    return '<svg class="badge-svg badge-' + metal + '" viewBox="0 0 64 64" width="' + (size || 56) + '" height="' + (size || 56) + '" aria-hidden="true" focusable="false">' +
      '<polygon class="b-outer" points="' + pts.join(" ") + '"/>' +
      '<circle class="b-ring" cx="32" cy="32" r="17"/>' +
      '<circle class="b-inner" cx="32" cy="32" r="13.5"/>' +
      '<text class="b-num" x="32" y="' + (32 + fs * 0.36).toFixed(1) + '" text-anchor="middle" font-size="' + fs + '">' + level + "</text></svg>";
  }

  window.addEventListener("resize", function () { if (canvas && parts.length) resize(); });
  window.WLFX = { confetti: confetti, float: float, shake: shake, pop: pop, countTo: countTo, fmt: fmt, badge: badge, reduce: reduce };
})();
