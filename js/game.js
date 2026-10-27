/*
  WHO'S LYING? — the game screens
  Modes:
    Career  endless chapters of 10 cases, stars, combo streak, chapter rewards
    Daily   5 cases a day, the same for everyone, one try each, share grid
    Rush    unlimited cases against the clock, 3 lives, one continue per run
  Also: headquarters (HQ), chapter map, shop, achievements, missions, login
  rewards, level-ups, tutorial, and (web only) the Firebase leaderboard.
*/
(function () {
  "use strict";
  var WL = window.WL, P = window.WLP, Plat = window.WLPlat, Snd = window.WLAudio, FX = window.WLFX;
  var LB = window.WLLB || { enabled: function () { return false; } };
  var CFG = WL.cfg, esc = WL.esc;
  function $(id) { return document.getElementById(id); }
  var TODAY = WL.dayNumber();
  var mq = function (q) { return window.matchMedia ? window.matchMedia(q) : { matches: false, addEventListener: function () {} }; };
  var reduceMotion = mq("(prefers-reduced-motion: reduce)").matches;
  var coarse = mq("(pointer: coarse)").matches;
  var GRID = { g: "🟩", y: "🟨", r: "🟥" };
  var LEVEL = { easy: "Easy case", medium: "Medium case", hard: "Hard case", twist: "Twist case" };
  var DAILY_TITLES = ["Every liar walked free.", "Rough day at the office.", "The liars won this round.", "Not bad, detective.", "Sharp eyes.", "Perfect. Nobody fooled you."];
  var CAUGHT = ["Caught!", "Got them!", "Case closed!", "Nailed it!", "Busted!"];
  var COIN_SVG = '<svg class="coin-ico" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v10M9.5 9.5c0-1.2 1.1-2 2.5-2s2.5.8 2.5 1.8c0 2.4-5 1.6-5 4.2 0 1.1 1.1 2 2.5 2s2.5-.8 2.5-2"/></svg>';
  var AD_SVG = '<svg class="ad-ico" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="2.5" y="5" width="19" height="14" rx="2"/><path d="M10 9.2v5.6l4.8-2.8z" fill="currentColor"/></svg>';
  var FLAME_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2c1 4-3 5.5-3 9.5A3 3 0 0 0 12 15a3 3 0 0 0 3-3.2c0-1.6-1-2.6-1-4.3 2.7 1.4 5 4.6 5 8A7 7 0 0 1 5 15.5C5 9.6 10.5 7.4 12 2z"/></svg>';

  var S = null;            // saved state (see progress.js)
  var user = null;         // CrazyGames user, when signed in
  var run = null;          // the case or run being played
  var screen = "";
  var adblocked = false;
  var bootTime = Date.now();
  var paused = { ad: false, hidden: false };
  var queue = [];          // celebrations to show after a verdict (level-ups etc.)

  function persist() { Plat.save(S); }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function scoreOf(results) { return results.filter(function (r) { return r !== "r"; }).length; }
  function cells(results, total) {
    var out = "";
    for (var i = 0; i < (total || results.length); i++) out += '<span class="cell-' + (results[i] || "n") + '"></span>';
    return out;
  }
  function stars(n, of) {
    var out = '<span class="stars">';
    for (var i = 0; i < (of || 3); i++) out += '<span class="st' + (i < n ? " on" : "") + '"></span>';
    return out + "</span>";
  }
  function dailyStreak() { return S.stats.lastDay >= TODAY - 1 ? S.stats.streak : 0; }

  /* ---------- polygraph trace (canvas) ---------- */
  function Trace(canvas, opts) {
    this.c = canvas; this.ctx = canvas.getContext("2d"); this.o = opts || {};
    this.t = 100; this.scroll = 0; this.acc = 0; this.buf = []; this.agit = 0.2;
    this.spikeT = -1; this.spikeBig = false; this.active = false; this.raf = 0; this.w = 0; this.h = 0;
    this.readColors();
    var self = this;
    if (window.ResizeObserver) new ResizeObserver(function () { self.resize(); self.draw(); }).observe(canvas);
  }
  Trace.prototype.readColors = function () {
    var cs = getComputedStyle(document.documentElement);
    var g = function (n) { return cs.getPropertyValue(n).trim(); };
    this.col = { ink: g("--ink"), needle: g("--needle"), grid: g("--grid"), gridS: g("--grid-strong") };
  };
  Trace.prototype.resize = function () {
    var r = this.c.getBoundingClientRect();
    if (r.width < 2) return;
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    this.w = Math.round(r.width); this.h = Math.round(r.height);
    this.c.width = this.w * dpr; this.c.height = this.h * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var speed = this.o.speed || 50;
    while (this.buf.length < this.w) { this.buf.unshift(this.sample(this.t - this.buf.length / speed)); }
    if (this.buf.length > this.w) this.buf = this.buf.slice(-this.w);
  };
  Trace.prototype.sample = function (t) {
    var g = this.agit;
    var breath = Math.sin(t * 1.7) * 0.55 + Math.sin(t * 0.63 + 1.3) * 0.3 + (Math.random() - 0.5) * 0.06 * (1 + g * 3);
    var rate = 1.05 + g * 1.7, ph = (((t * rate) % 1) + 1) % 1;
    var beat = ph < 0.05 ? -Math.sin((ph / 0.05) * Math.PI) : ph < 0.11 ? Math.sin(((ph - 0.05) / 0.06) * Math.PI) * 0.45 : 0;
    var pulse = beat * (0.5 + g * 0.5) + (Math.random() - 0.5) * 0.08 * (1 + g * 4);
    if (this.spikeT >= 0) {
      var st = t - this.spikeT;
      if (st >= 0 && st < 0.6) {
        var env = Math.sin((st / 0.6) * Math.PI);
        pulse = Math.sin(st * 72) * env * (this.spikeBig ? 1.25 : 0.9);
        breath += Math.sin(st * 40) * env * 0.55;
      } else if (st >= 0.6) this.spikeT = -1;
    }
    return [Math.max(-1.6, Math.min(1.6, breath)), Math.max(-1.6, Math.min(1.6, pulse))];
  };
  Trace.prototype.advance = function (dt) {
    var speed = this.o.speed || 50;
    this.acc += (speed * dt) / 1000;
    while (this.acc >= 1) {
      this.acc -= 1; this.t += 1 / speed; this.scroll += 1;
      this.buf.push(this.sample(this.t));
      if (this.buf.length > this.w) this.buf.shift();
    }
  };
  Trace.prototype.draw = function () {
    if (!this.w) return;
    var ctx = this.ctx, w = this.w, h = this.h, col = this.col, gs = 12, off = this.scroll % gs, x, y;
    ctx.clearRect(0, 0, w, h);
    ctx.lineWidth = 1;
    for (x = -off; x < w; x += gs) {
      var major = Math.round((x + this.scroll) / gs) % 5 === 0;
      ctx.strokeStyle = major ? col.gridS : col.grid;
      ctx.beginPath(); ctx.moveTo(Math.round(x) + 0.5, 0); ctx.lineTo(Math.round(x) + 0.5, h); ctx.stroke();
    }
    ctx.strokeStyle = col.grid;
    for (y = gs; y < h; y += gs) { ctx.beginPath(); ctx.moveTo(0, y + 0.5); ctx.lineTo(w, y + 0.5); ctx.stroke(); }
    var b = this.buf, n = b.length, i;
    var A = { y: h * (this.o.aY || 0.36), amp: h * 0.13 }, B = { y: h * (this.o.bY || 0.7), amp: h * 0.2 };
    ctx.lineJoin = "round"; ctx.lineCap = "round";
    ctx.strokeStyle = col.ink; ctx.lineWidth = 1.4; ctx.beginPath();
    for (i = 0; i < n; i++) { x = w - n + i; y = A.y + b[i][0] * A.amp; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
    ctx.stroke();
    ctx.strokeStyle = col.needle; ctx.lineWidth = 1.9; ctx.beginPath();
    for (i = 0; i < n; i++) { x = w - n + i; y = B.y + b[i][1] * B.amp; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
    ctx.stroke();
    if (n) {
      ctx.fillStyle = col.needle; ctx.beginPath(); ctx.arc(w - 2.5, B.y + b[n - 1][1] * B.amp, 2.8, 0, 7); ctx.fill();
      ctx.fillStyle = col.ink; ctx.beginPath(); ctx.arc(w - 2.5, A.y + b[n - 1][0] * A.amp, 2.2, 0, 7); ctx.fill();
    }
  };
  Trace.prototype.start = function () {
    if (this.active) return;
    this.active = true; this.resize();
    var self = this, last = performance.now();
    if (reduceMotion) { this.draw(); return; }
    var loop = function (now) {
      if (!self.active) return;
      self.advance(Math.min(64, now - last)); last = now;
      self.draw();
      self.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  };
  Trace.prototype.stop = function () { this.active = false; cancelAnimationFrame(this.raf); };
  Trace.prototype.spike = function (big) {
    this.spikeT = this.t; this.spikeBig = !!big;
    if (reduceMotion || !this.active) {
      for (var i = 0; i < 32; i++) { this.t += 1 / 50; this.buf.push(this.sample(this.t)); if (this.buf.length > this.w) this.buf.shift(); }
      this.draw();
    }
  };
  var hqTrace = new Trace($("hq-trace"), { speed: 38, aY: 0.36, bY: 0.68 });
  var gameTrace = new Trace($("trace"), { speed: 52, aY: 0.5, bY: 0.76 });
  var traces = [hqTrace, gameTrace];
  function refreshTraceColors() { traces.forEach(function (t) { t.readColors(); t.draw(); }); }
  mq("(prefers-color-scheme: dark)").addEventListener("change", refreshTraceColors);

  /* ---------- small UI helpers ---------- */
  function toast(msg, cls, ms) {
    var box = $("toasts");
    while (box.children.length > 1) box.firstChild.remove();
    var t = document.createElement("div");
    t.className = "toast " + (cls || "");
    t.innerHTML = msg;
    box.appendChild(t);
    setTimeout(function () { t.classList.add("out"); setTimeout(function () { t.remove(); }, 320); }, ms || 2600);
  }
  function openDialog(id) {
    var d = $(id);
    if (!d) return;
    if (typeof d.showModal === "function") { if (!d.open) d.showModal(); } else d.setAttribute("open", "");
  }
  function closeDialog(id) {
    var d = $(id);
    if (!d) return;
    if (typeof d.close === "function") { if (d.open) d.close(); } else d.removeAttribute("open");
  }
  [].forEach.call(document.querySelectorAll("dialog"), function (d) {
    d.addEventListener("click", function (e) {
      if (e.target === d || (e.target.closest && e.target.closest("[data-close]"))) { Snd.play("click"); closeDialog(d.id); }
    });
  });
  function rw(coins, xp, mult) {
    var h = "";
    if (coins) h += '<span class="rw coin">' + COIN_SVG + "+" + coins + "</span>";
    if (xp) h += '<span class="rw xp">+' + xp + " XP</span>";
    if (mult && mult > 1.001) h += '<span class="rw mult">Streak ×' + mult.toFixed(1) + "</span>";
    return h;
  }
  var shownCoins = 0;
  function renderCoins(animate) {
    var to = S.coins;
    if (animate && to !== shownCoins) { FX.countTo($("coin-n"), shownCoins, to, 700); FX.pop($("coins")); }
    else $("coin-n").textContent = FX.fmt(to);
    shownCoins = to;
  }
  function applyTheme() {
    var id = S.themes.current;
    if (!id || id === "auto") document.documentElement.removeAttribute("data-skin");
    else document.documentElement.setAttribute("data-skin", id);
    refreshTraceColors();
  }
  function canRewarded() { return Plat.hasAds() && !adblocked; }
  function adFailed() {
    var code = Plat.lastAdError();
    if (code === "adblock") { adblocked = true; toast("Ads are blocked in this browser, so ad rewards are off."); }
    else toast("No ad is available right now. Try again in a bit.");
  }
  // Midgame ads block the screen until they finish (CrazyGames rule).
  function midgame(placement) {
    var allowed = S.tot.solved >= 3 && Date.now() - bootTime > 60000;
    if (!allowed || !Plat.hasAds()) return Promise.resolve();
    var shield = document.createElement("div");
    shield.className = "ad-demo"; shield.setAttribute("aria-hidden", "true"); shield.style.background = "transparent";
    document.body.appendChild(shield);
    return Plat.midgame(placement).then(function () { shield.remove(); }, function () { shield.remove(); });
  }

  /* ---------- screens + HUD ---------- */
  var SCREENS = ["hq", "case", "results", "map", "shop", "ach"];
  function show(name) {
    screen = name;
    SCREENS.forEach(function (n) { $("scr-" + n).hidden = n !== name; });
    var onHQ = name === "hq";
    $("btn-home").hidden = onHQ;
    $("brand").hidden = !onHQ;
    $("hud-title").hidden = onHQ;
    if (name !== "case") { Plat.gameplayStop(); hideCoach(); }
    if (onHQ) { gameTrace.stop(); hqTrace.start(); } else if (name === "case") { hqTrace.stop(); gameTrace.start(); } else { hqTrace.stop(); gameTrace.stop(); }
    var el = $("scr-" + name);
    el.scrollTop = 0;
    if (name !== "case") $("verdict").hidden = true;
  }
  function setHud(main, sub) { $("hud-main").textContent = main || ""; $("hud-sub").textContent = sub || ""; }

  /* ---------- HQ ---------- */
  function playerName() {
    if (user && user.username) return user.username;
    if (S.settings.playerName) return S.settings.playerName;
    return "Detective";
  }
  function renderHQ() {
    var li = P.levelInfo(S.xp);
    $("player-badge").innerHTML = FX.badge(li.level, li.tier, 64);
    $("player-name").textContent = playerName();
    var av = $("player-avatar");
    if (user && user.profilePictureUrl) { av.src = user.profilePictureUrl; av.hidden = false; } else av.hidden = true;
    var nt = P.nextTitle(li.level);
    $("player-title").textContent = "Level " + li.level + " · " + li.title;
    $("xpfill").style.width = Math.round((li.into / li.need) * 100) + "%";
    $("xpbar").setAttribute("aria-valuemax", li.need); $("xpbar").setAttribute("aria-valuenow", li.into);
    $("xpbar").setAttribute("aria-label", "Experience: " + li.into + " of " + li.need);
    $("xp-text").textContent = (li.need - li.into) + " XP to level " + (li.level + 1) + (nt ? " · " + nt[1] + " at level " + nt[0] : "");

    var lvl = S.career.level, ch = WL.chapterOf(lvl);
    $("career-chapter").textContent = "Career · Chapter " + ch;
    $("career-name").textContent = WL.chapterName(ch);
    $("career-nodes").innerHTML = chapterNodes(ch, false);
    var spec = WL.careerSpec(lvl);
    $("btn-play").textContent = (lvl === 1 ? "Start case 1" : "Play case " + lvl) + (spec.mode !== "liar" ? " · Twist" : "");

    var d = S.daily && S.daily.day === TODAY ? S.daily : null;
    var sub;
    if (d && d.done) sub = "Done: " + scoreOf(d.results) + "/5. New cases in " + WL.fmtCountdown(WL.msToNextDay());
    else if (d && d.results.length) sub = "Case " + (d.results.length + 1) + " of 5 waiting";
    else sub = "5 new cases today" + (dailyStreak() > 0 ? " · streak " + dailyStreak() : "");
    $("daily-sub").textContent = sub;
    $("daily-flag").hidden = !!(d && d.results.length);
    $("rush-sub").textContent = S.endless.best > 0 ? "Your best: " + S.endless.best + " liars" : "Catch liars against the clock";

    renderMissions();
    $("btn-board").hidden = !(LB.enabled() && Plat.allowExternal());
    renderCoins(false);
  }
  function chapterNodes(ch, clickable) {
    var h = "", cur = S.career.level;
    for (var k = 1; k <= 10; k++) {
      var n = (ch - 1) * 10 + k, st = S.career.stars[n] || 0, sp = WL.careerSpec(n);
      var cls = "node" + (n < cur ? " done" : n === cur ? " now" : " locked") + (sp.mode !== "liar" ? " is-twist" : "");
      var label = "Case " + n + (sp.mode !== "liar" ? ", twist" : "") + (n < cur ? ", " + st + " stars" : n === cur ? ", next" : ", locked");
      if (clickable) h += '<button type="button" class="' + cls + '" data-level="' + n + '"' + (n > cur ? " disabled" : "") + ' aria-label="' + label + '">';
      else h += '<span class="' + cls + '" aria-label="' + label + '">';
      h += n + (n < cur ? stars(st) : '<span class="stars"><span class="st" style="visibility:hidden"></span></span>');
      h += clickable ? "</button>" : "</span>";
    }
    return h;
  }
  function renderMissions() {
    var ms = P.ensureMissions();
    $("mission-list").innerHTML = ms.list.map(function (m, i) {
      var done = m.progress >= m.target;
      var side = m.claimed ? '<span class="muted">Claimed</span>'
        : done ? '<button class="btn small primary" type="button" data-claim="' + i + '">Claim ' + m.reward + "</button>"
        : '<span>' + COIN_SVG + m.reward + "</span>";
      return '<li class="mission' + (done ? " done" : "") + (m.claimed ? " claimed" : "") + '"><span class="m-check"></span>' +
        '<span class="m-body"><span class="m-text">' + esc(P.missionText(m)) + '</span><span class="m-bar"><span style="width:' +
        Math.round((m.progress / m.target) * 100) + '%"></span></span></span><span class="m-side">' +
        (done ? "" : '<span class="muted">' + m.progress + "/" + m.target + "</span>&nbsp;") + side + "</span></li>";
    }).join("");
    var chest = $("chest");
    if (ms.chest) chest.innerHTML = '<span>All missions done for today. New ones tomorrow.</span>';
    else if (P.chestReady()) chest.innerHTML = '<span><b>Mission chest</b> ' + P.CHEST.coins + ' coins + a Magnifier</span><button class="btn small danger" type="button" id="btn-chest">Open</button>';
    else chest.innerHTML = '<span>Finish all 3 for the <b>mission chest</b>: ' + P.CHEST.coins + " coins + a Magnifier</span>";
    var now = new Date(), next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1), left = next - now;
    $("missions-reset").textContent = "New in " + Math.floor(left / 3600000) + "h " + Math.floor((left % 3600000) / 60000) + "m";
  }
  $("mission-list").addEventListener("click", function (e) {
    var b = e.target.closest("[data-claim]");
    if (!b) return;
    var r = P.claimMission(+b.dataset.claim);
    if (r) { Snd.play("coin"); FX.float("+" + r.coins, b, "coin"); persist(); renderMissions(); renderCoins(true); }
  });
  $("chest").addEventListener("click", function (e) {
    if (!e.target.closest("#btn-chest")) return;
    var r = P.claimChest();
    if (r) {
      Snd.play("achieve"); FX.confetti({ y: e.target.getBoundingClientRect().top });
      toast("Chest opened: " + r.coins + " coins and a Magnifier", "gold");
      persist(); renderMissions(); renderCoins(true);
    }
  });
  function goHQ() {
    stopClock(); hideConfirm();
    if (run && run.prog) { run.prog.elapsed = run.elapsed; persist(); }
    if (run && run.kind === "rush" && !run.over) { run.over = true; P.rushEnd(run.score); persist(); }
    run = null;
    try { if (location.hash) history.replaceState(null, "", location.pathname + location.search); } catch (e) { /* ignore */ }
    renderHQ();
    show("hq");
    setTimeout(maybeLogin, 350);
  }

  /* ---------- login calendar ---------- */
  function maybeLogin() {
    if (screen !== "hq" || S.tot.solved < 2 || document.querySelector("dialog[open]")) return;
    var r = P.checkLogin();
    persist();
    if (!r) return;
    var day = ((r.day - 1) % 7) + 1;
    $("login-text").textContent = r.day > 1 ? "Day " + r.day + " in a row. Keep it going!" : "Come back every day. Rewards grow for 7 days.";
    $("calendar").innerHTML = P.LOGIN.map(function (rew, i) {
      var parts = [COIN_SVG + rew.coins];
      if (rew.magnifier) parts.push(rew.magnifier + " 🔍");
      if (rew.freeze) parts.push(rew.freeze + " ❄");
      return '<li class="' + (i + 1 < day ? "past" : i + 1 === day ? "today" : "") + '"><b>' + (i + 1) + "</b>" + parts.join("<br>") + "</li>";
    }).join("");
    var dbl = $("btn-login-double");
    dbl.hidden = !canRewarded();
    dbl.innerHTML = AD_SVG + "Watch an ad to double the coins";
    openDialog("dlg-login");
  }
  function claimLogin(double) {
    var r = P.claimLogin(double);
    closeDialog("dlg-login");
    if (!r) return;
    persist();
    Snd.play("coin");
    toast("Daily reward: " + r.coins + " coins" + (r.magnifier ? " + " + r.magnifier + " Magnifier" + (r.magnifier > 1 ? "s" : "") : "") + (r.freeze ? " + a Time Freeze" : ""), "gold");
    renderCoins(true); renderHQ();
  }
  $("btn-login-claim").addEventListener("click", function () { claimLogin(false); });
  $("btn-login-double").addEventListener("click", function () {
    if (P.coolLeft("loginAd", 30) > 0) return;
    P.coolStart("loginAd");
    Plat.rewarded("login_double").then(function (ok) {
      if (ok) { claimLogin(true); FX.confetti(); }
      else { adFailed(); claimLogin(false); }
    });
  });
  $("dlg-login").addEventListener("cancel", function (e) { e.preventDefault(); claimLogin(false); });

  /* ---------- clock ---------- */
  var clock = { running: false, raf: 0, last: 0, lastTickSec: -1, sinceSave: 0 };
  function startClock() {
    clock.running = true; clock.last = performance.now(); clock.lastTickSec = -1;
    if (!clock.raf) clock.raf = requestAnimationFrame(tick);
  }
  function stopClock() { clock.running = false; }
  function tick(now) {
    clock.raf = 0;
    var dt = Math.min(250, now - clock.last); clock.last = now;
    if (clock.running && run && !paused.ad && !paused.hidden && !run.revealed && !run.coachHold) {
      run.caseElapsed += dt;
      if (run.kind === "rush") {
        var left = run.limit - run.caseElapsed, sec = Math.ceil(Math.max(0, left) / 1000);
        $("rec-time").textContent = WL.fmtTime(sec * 1000);
        $("rec-time").classList.toggle("urgent", left < 10000);
        gameTrace.agit = 0.2 + 0.85 * Math.min(1, run.caseElapsed / run.limit);
        if (left < 5500 && sec !== clock.lastTickSec && sec > 0) { clock.lastTickSec = sec; Snd.play("tick"); }
        if (left <= 0) accuse(true);
      } else if (run.kind === "career") {
        $("rec-time").textContent = WL.fmtTime(run.caseElapsed);
        renderStarsLive();
      } else {
        run.elapsed += dt; clock.sinceSave += dt;
        $("rec-time").textContent = WL.fmtTime(run.elapsed);
        if (clock.sinceSave > 4000) { clock.sinceSave = 0; run.prog.elapsed = run.elapsed; persist(); }
      }
    }
    if (clock.running) clock.raf = requestAnimationFrame(tick);
  }
  document.addEventListener("visibilitychange", function () {
    paused.hidden = document.hidden;
    if (document.hidden) {
      if (run && run.prog) { run.prog.elapsed = run.elapsed; persist(); }
      traces.forEach(function (t) { if (t.active) { t.stop(); t.wasActive = true; } });
      Plat.flush();
    } else {
      clock.last = performance.now();
      traces.forEach(function (t) { if (t.wasActive) { t.wasActive = false; t.start(); } });
    }
  });

  /* ---------- starting a case ---------- */
  function startCareer(n) {
    n = Math.min(n || S.career.level, S.career.level);
    run = { kind: "career", n: n, c: WL.buildCareerLevel(n), wrong: 0, hint: false };
    WL.track("career_start", { level: n });
    show("case");
    loadCase();
  }
  function progressFor(day) {
    var key = day === TODAY ? "daily" : "replay";
    var p = S[key];
    if (!p || p.day !== day) { p = S[key] = { day: day, results: [], hints: [], elapsed: 0, done: false }; persist(); }
    return p;
  }
  function startDaily(day) {
    day = day || TODAY;
    var replay = day !== TODAY;
    var prog = progressFor(day);
    if (prog.done) { showDailyResults(day, prog, replay); return; }
    run = { kind: replay ? "replay" : "daily", day: day, cases: WL.buildDay(day), prog: prog, idx: prog.results.length, elapsed: prog.elapsed || 0 };
    run.c = run.cases[run.idx];
    WL.track(replay ? "replay_start" : "daily_start", { day: day, case: run.idx + 1 });
    show("case");
    loadCase();
  }
  function startRush() {
    run = {
      kind: "rush", n: 0, score: 0, lives: 3, combo: 0, bestCombo: 0, secondUsed: false, over: false,
      recentPremises: [], lastNames: {}, lastFacts: {}, rng: WL.rngFrom("rush:" + Date.now() + ":" + Math.random())
    };
    S.endless.runs++; persist();
    WL.track("rush_start", {});
    show("case");
    nextRush();
  }
  function nextRush() {
    run.n++;
    var spec = WL.endlessSpec(run.n);
    var avoid = { names: Object.assign({}, run.lastNames), premises: {}, facts: Object.assign({}, run.lastFacts) };
    run.recentPremises.forEach(function (p) { avoid.premises[p] = 1; });
    var before = Object.keys(avoid.facts);
    run.c = WL.generateCase(run.rng, { mode: spec.mode, clueCount: spec.clueCount, level: spec.level, maxTier: spec.maxTier, avoid: avoid });
    run.lastNames = {}; run.c.suspects.forEach(function (s) { run.lastNames[s.name] = 1; });
    run.lastFacts = {}; Object.keys(avoid.facts).forEach(function (f) { if (before.indexOf(f) < 0) run.lastFacts[f] = 1; });
    run.recentPremises.push(run.c.title); if (run.recentPremises.length > 12) run.recentPremises.shift();
    run.limit = WL.endlessSeconds(run.n) * 1000;
    loadCase();
  }

  /* ---------- rendering a case ---------- */
  function loadCase() {
    var c = run.c;
    run.pick = null; run.revealed = false; run.caseElapsed = 0; run.hint = false; run.froze = false;
    if (run.kind === "career") run.wrong = 0;
    renderCase(c);
    renderMeta();
    hideConfirm();
    $("verdict").hidden = true;
    gameTrace.agit = run.kind === "rush" ? 0.2 : 0.28;
    $("rec-time").classList.remove("urgent", "frozen");
    $("rec-time").textContent = run.kind === "rush" ? WL.fmtTime(run.limit) : run.kind === "career" ? "0:00" : WL.fmtTime(run.elapsed);
    $("case-grid").scrollTop = 0;
    [].forEach.call(document.querySelectorAll(".pane"), function (p) { p.scrollTop = 0; });
    if (c.mode !== "liar") Snd.play("twist");
    else if (run.kind === "rush" ? run.n > 1 : run.kind === "career" ? true : run.idx > 0) Snd.play("whoosh");
    Plat.gameplayStart();
    startClock();
    if (run.kind === "career" && run.n === 1 && !S.settings.tutorialDone) startCoach();
  }
  function renderCase(c) {
    var planted = c.mode === "planted";
    if (run.kind === "career") {
      setHud("Case " + run.n, "Chapter " + c.spec.chapter + " · " + WL.chapterName(c.spec.chapter));
      $("case-kicker").textContent = (LEVEL[c.level] || "Case") + " · 3 stars under " + WL.fmtTime(c.spec.par * 1000);
    } else if (run.kind === "rush") {
      setHud("Rush", "Case " + run.n);
      $("case-kicker").textContent = LEVEL[c.level] || "Case";
    } else {
      setHud("Daily #" + run.day + (run.kind === "replay" ? " replay" : ""), "Case " + (run.idx + 1) + " of 5");
      $("case-kicker").textContent = LEVEL[c.level] || "Case";
    }
    $("case-title").textContent = c.title;
    $("case-setup").textContent = c.setup;
    var tw = $("twist");
    if (c.mode === "honest") { tw.innerHTML = "<strong>Twist!</strong><span>Two of them are lying. Find the only one telling the truth.</span>"; tw.hidden = false; }
    else if (planted) { tw.innerHTML = "<strong>Twist!</strong><span>All three are telling the truth. One of the facts was planted. Find the fake fact.</span>"; tw.hidden = false; }
    else tw.hidden = true;

    var ul = $("clues"); ul.innerHTML = "";
    c.clues.forEach(function (txt, i) {
      var li = document.createElement("li");
      if (planted) {
        var b = document.createElement("button");
        b.type = "button"; b.className = "clue"; b.textContent = txt;
        b.setAttribute("aria-pressed", "false");
        b.addEventListener("click", function () { select(i); });
        li.appendChild(b);
      } else { li.className = "clue"; li.textContent = txt; }
      ul.appendChild(li);
    });

    $("task").textContent = c.mode === "liar" ? "One of them is lying. Tap the liar."
      : c.mode === "honest" ? "Tap the one person telling the truth."
      : "Every story is true. Tap the fact that can't be right.";

    var box = $("suspects"); box.innerHTML = "";
    c.suspects.forEach(function (s, i) {
      var el = document.createElement(planted ? "div" : "button");
      el.className = "suspect" + (planted ? " static" : "");
      if (!planted) {
        el.type = "button";
        el.setAttribute("aria-pressed", "false");
        el.addEventListener("click", function () { select(i); });
      }
      el.innerHTML = '<span class="mug">' + WL.avatar(s.name) + '</span><span class="who"><span class="who-top"><span class="who-name">' + esc(s.name) +
        '</span><span class="who-role">' + esc(s.role) + "</span>" + (planted ? "" : '<span class="who-key" aria-hidden="true">' + (i + 1) + "</span>") +
        '</span><span class="says">' + esc(s.says) + "</span></span>";
      box.appendChild(el);
    });
    renderTools();
  }
  function renderMeta() {
    var k = run.kind;
    $("pips").hidden = !(k === "daily" || k === "replay");
    $("stars-live").hidden = k !== "career";
    $("lives").hidden = k !== "rush";
    $("replay-tag").hidden = !(k === "replay" || (k === "career" && run.n < S.career.level && !run.revealed));
    var combo = k === "career" ? S.career.combo : k === "rush" ? run.combo : 0;
    $("combo").hidden = combo < 2;
    $("combo").innerHTML = FLAME_SVG + "×" + combo;
    $("combo").setAttribute("aria-label", "Streak: " + combo + " in a row");
    if (k === "rush") {
      $("lives").innerHTML = [0, 1, 2].map(function (i) { return '<span class="' + (i < run.lives ? "on" : "") + '"></span>'; }).join("");
      $("lives").setAttribute("aria-label", run.lives + " of 3 lives left");
      $("rec-left").textContent = "Score " + run.score;
    } else if (k === "career") {
      $("rec-left").textContent = "Case " + run.n;
      renderStarsLive(true);
    } else {
      var res = run.prog.results;
      $("pips").innerHTML = run.cases.map(function (_, i) {
        return '<span class="' + (res[i] ? "cell-" + res[i] : i === run.idx ? "now" : "") + '"></span>';
      }).join("");
      $("pips").setAttribute("aria-label", "Case " + (Math.min(run.idx, 4) + 1) + " of 5. " + scoreOf(res) + " caught so far.");
      $("rec-left").textContent = "Case " + (Math.min(run.idx, 4) + 1) + " of 5";
    }
  }
  function potentialStars() {
    if (!run || run.kind !== "career") return 0;
    if (run.wrong > 0) return 1;
    return run.hint || run.caseElapsed / 1000 > run.c.spec.par ? 2 : 3;
  }
  var lastLive = -1;
  function renderStarsLive(force) {
    var n = potentialStars();
    if (n === lastLive && !force) return;
    if (lastLive > n && !force) FX.pop($("stars-live"));
    lastLive = n;
    $("stars-live").innerHTML = stars(n);
    $("stars-live").setAttribute("aria-label", "Stars you can still earn: " + n);
  }
  function optionEls() {
    return run.c.mode === "planted"
      ? [].slice.call($("clues").querySelectorAll("button.clue"))
      : [].slice.call($("suspects").querySelectorAll(".suspect"));
  }

  /* ---------- power-ups ---------- */
  function hintMode() {
    if (!run || run.revealed || run.hint) return "used";
    if ((S.inv.magnifier || 0) > 0) return "item";
    if (run.kind !== "rush" && canRewarded() && P.coolLeft("hintAd", 90) === 0) return "ad";
    return "none";
  }
  function renderTools() {
    var m = hintMode(), hb = $("btn-hint"), n = $("hint-n");
    hb.disabled = m === "used" || m === "none";
    n.classList.toggle("ad", m === "ad");
    if (m === "ad") { $("hint-label").textContent = "Hint"; n.textContent = "AD"; hb.setAttribute("aria-label", "Watch an ad for a hint"); }
    else { $("hint-label").textContent = "Magnifier"; n.textContent = S.inv.magnifier || 0; hb.setAttribute("aria-label", "Magnifier: rule out one wrong answer. " + (S.inv.magnifier || 0) + " left"); }
    var fb = $("btn-freeze");
    fb.hidden = run.kind !== "rush";
    fb.disabled = run.froze || (S.inv.freeze || 0) <= 0 || run.revealed;
    $("freeze-n").textContent = S.inv.freeze || 0;
    var note = "";
    if (m === "used") note = run.hint ? "One option ruled out." : "";
    else if (m === "none") note = "Out of magnifiers. Get more in the Shop.";
    else if (run.kind === "daily" || run.kind === "replay") note = "A hint turns this case yellow.";
    else if (run.kind === "career" && run.wrong === 0) note = "A hint costs the 3rd star.";
    $("tool-note").textContent = note;
  }
  function useHint() {
    var m = hintMode();
    if (m !== "item" && m !== "ad") return;
    var give = function () {
      if (!run || run.revealed) return;
      var c = run.c, els = optionEls();
      var cands = els.map(function (_, i) { return i; }).filter(function (i) { return i !== c.answer && !els[i].classList.contains("is-out") && !els[i].classList.contains("is-wrong"); });
      if (!cands.length) return;
      var k = cands[Math.floor(Math.random() * cands.length)];
      els[k].classList.add("is-out");
      if (els[k].tagName === "BUTTON") els[k].disabled = true;
      els[k].setAttribute("aria-label", (c.mode === "planted" ? c.clues[k] : c.suspects[k].name) + ", ruled out by a hint");
      if (run.pick === k) cancelPick();
      run.hint = true;
      Snd.play("whoosh");
      renderTools(); renderStarsLive();
      persist();
      WL.track("hint_used", { kind: run.kind, type: m });
    };
    if (m === "item") { P.useItem("magnifier"); give(); }
    else {
      P.coolStart("hintAd"); persist();
      Plat.rewarded("hint").then(function (ok) {
        if (ok) { toast("Hint unlocked"); give(); } else { adFailed(); renderTools(); }
      });
    }
  }
  function useFreeze() {
    if (!run || run.kind !== "rush" || run.froze || run.revealed || !P.useItem("freeze")) return;
    run.froze = true;
    run.limit += 10000;
    $("rec-time").classList.add("frozen");
    setTimeout(function () { $("rec-time").classList.remove("frozen"); }, 1200);
    Snd.play("combo");
    FX.float("+10s", $("rec-time"));
    renderTools(); persist();
  }

  /* ---------- picking + accusing ---------- */
  function select(i) {
    if (!run || run.revealed) return;
    var c = run.c, els = optionEls(), el = els[i];
    if (!el || el.classList.contains("is-out") || el.classList.contains("is-wrong")) return;
    run.pick = i;
    els.forEach(function (e, k) { e.classList.toggle("is-picked", k === i); e.setAttribute("aria-pressed", k === i ? "true" : "false"); });
    Snd.play("tap");
    var name = c.mode === "planted" ? "" : c.suspects[i].name;
    $("accuse-q").textContent = c.mode === "liar" ? "Is " + name + " the liar?" : c.mode === "honest" ? "Is " + name + " the only honest one?" : "Is this fact fake?";
    $("btn-accuse").textContent = c.mode === "liar" ? "Accuse " + name : c.mode === "honest" ? name + " is honest" : "It's fake";
    $("tools").hidden = true; $("confirm").hidden = false;
    if (run.coachStep === 2) hideCoach();
  }
  function cancelPick() {
    if (!run || run.revealed) return;
    run.pick = null;
    optionEls().forEach(function (e) { e.classList.remove("is-picked"); e.setAttribute("aria-pressed", "false"); });
    hideConfirm();
  }
  function hideConfirm() { $("confirm").hidden = true; $("tools").hidden = false; }
  function stamp(el, text, cls) {
    var old = el.querySelector(".stamp"); if (old) old.remove();
    var s = document.createElement("span");
    s.className = "stamp " + (cls || "");
    s.textContent = text;
    el.classList.add("has-stamp");
    el.appendChild(s);
  }
  function accuse(timeout) {
    if (!run || run.revealed) return;
    var c = run.c, pick = timeout ? -1 : run.pick;
    if (!timeout && pick == null) return;
    var correct = pick === c.answer;
    var els = optionEls();
    hideConfirm();
    hideCoach();

    // Career: a wrong pick isn't the end. Mark it and keep looking.
    if (run.kind === "career" && !correct) {
      run.wrong++; run.pick = null;
      P.careerWrong(); persist();
      var el = els[pick];
      el.classList.remove("is-picked"); el.classList.add("is-wrong");
      if (el.tagName === "BUTTON") el.disabled = true;
      var msg;
      if (c.mode === "liar") { stamp(el, "Cleared", "cleared"); msg = esc(c.suspects[pick].name) + "'s story checks out. Keep looking."; }
      else if (c.mode === "honest") { stamp(el, "Liar"); msg = esc(c.suspects[pick].name) + " is lying, but you need the honest one."; }
      else { stamp(el, "True", "cleared"); msg = "That fact is true. Look again."; }
      Snd.play("wrong"); FX.shake(el); gameTrace.spike(true);
      toast(msg);
      renderMeta(); renderTools();
      return;
    }

    run.revealed = true;
    stopClock();
    Plat.gameplayStop();
    els.forEach(function (e) { e.classList.remove("is-picked"); if (e.tagName === "BUTTON") e.disabled = true; });
    var ansEl = els[c.answer];
    stamp(ansEl, c.mode === "honest" ? "Honest" : c.mode === "planted" ? "Fake" : "Liar", c.mode === "honest" ? "ok" : "");
    if (c.mode !== "planted") ansEl.classList.add("is-answer");
    if (c.mode === "honest") ansEl.classList.add("ok-answer");
    if (!correct && pick >= 0) {
      els[pick].classList.add("is-wrong");
      if (c.mode !== "planted") { var tag = document.createElement("span"); tag.className = "your-pick"; tag.textContent = "Your pick"; els[pick].appendChild(tag); }
    }
    gameTrace.spike(!correct);
    Snd.play("stamp");
    setTimeout(function () { Snd.play(timeout ? "timeout" : correct ? "correct" : "wrong"); }, 170);
    if (!correct) { FX.shake($("case-grid")); if (navigator.vibrate) { try { navigator.vibrate(120); } catch (e) { /* ignore */ } } }

    if (run.kind === "career") verdictCareer(ansEl);
    else if (run.kind === "rush") verdictRush(correct, timeout);
    else verdictDaily(correct);
  }

  function setVerdict(o) {
    var v = $("verdict");
    $("verdict-head").textContent = o.head;
    $("verdict-head").className = "verdict-head " + (o.good ? "good" : "bad");
    var vs = $("verdict-stars");
    vs.hidden = o.stars == null;
    if (o.stars != null) vs.innerHTML = [0, 1, 2].map(function (i) { return '<span class="st' + (i < o.stars ? " on" : "") + '"></span>'; }).join("");
    vs.setAttribute("aria-label", (o.stars || 0) + " of 3 stars");
    $("verdict-banner").hidden = !o.banner; $("verdict-banner").textContent = o.banner || "";
    $("verdict-rewards").innerHTML = o.rewards || "";
    $("why").innerHTML = "<strong>" + esc(o.sub) + "</strong> " + esc(run.c.why);
    var tr = $("twist-reveal");
    if (run.c.twist) { tr.textContent = run.c.twist; tr.hidden = false; } else tr.hidden = true;
    $("btn-next").textContent = o.next;
    v.classList.toggle("over-suspects", run.c.mode === "planted");
    v.hidden = false;
    v.scrollTop = 0;
    try { $("btn-next").focus({ preventScroll: true }); } catch (e) { $("btn-next").focus(); }
    if (o.stars) {
      for (var i = 0; i < o.stars; i++) Snd.play("star", { delay: 0.35 + i * 0.18, rate: 1 + i * 0.12 });
    }
    setTimeout(flushQueue, o.stars === 3 ? 1100 : 700);
  }
  function answerLine() {
    var c = run.c;
    if (c.mode === "planted") return "You found the planted fact.";
    var n = c.suspects[c.answer].name;
    return c.mode === "honest" ? n + " was the only honest one." : n + " was the liar.";
  }

  function verdictCareer(ansEl) {
    var r = P.careerSolved({ level: run.n, wrong: run.wrong, hint: run.hint, seconds: run.caseElapsed / 1000 });
    persist();
    setVerdict({
      head: run.wrong ? "Case closed." : pick(CAUGHT), good: true, stars: r.stars,
      banner: r.chapterDone ? "Chapter " + r.chapter + " complete!" : r.replay && r.stars > r.prevStars ? "New best: " + r.stars + " stars" : "",
      rewards: rw(r.coins, r.xp, r.mult) + (r.replay ? '<span class="rw">Replay: no coins</span>' : ""),
      sub: answerLine(),
      next: r.chapterDone ? "Next chapter" : r.replay ? "Continue career" : "Next case"
    });
    if (r.coins) FX.float("+" + r.coins, $("coins"), "coin");
    renderCoins(true);
    renderMeta();
    if (r.combo >= 2) { FX.float("Streak ×" + r.combo, $("combo"), "combo"); Snd.play("combo", { delay: 0.2 }); }
    if (r.stars === 3) FX.confetti({ count: 60, y: ansEl.getBoundingClientRect().top });
    if (r.chapterDone) {
      FX.confetti({ count: 140 });
      Snd.play("fanfare", { delay: 0.6 });
      Plat.happytime();
      WL.track("chapter_done", { chapter: r.chapter });
    }
    WL.track("career_solved", { level: run.n, stars: r.stars, wrong: run.wrong, hint: run.hint });
  }
  function verdictDaily(correct) {
    var c = run.c, code = correct ? (run.hint ? "y" : "g") : "r";
    run.prog.results.push(code); run.prog.hints.push(run.hint); run.prog.elapsed = run.elapsed;
    var r = P.dailyCase({ correct: correct, hint: run.hint, twist: c.mode !== "liar", replay: run.kind === "replay" });
    persist();
    var last = run.prog.results.length >= run.cases.length;
    setVerdict({
      head: correct ? pick(CAUGHT) : "Not quite.", good: correct,
      rewards: rw(r.coins, r.xp),
      sub: answerLine(), next: last ? "See your result" : "Next case"
    });
    if (r.coins) { FX.float("+" + r.coins, $("coins"), "coin"); renderCoins(true); }
    renderMeta();
    WL.track("daily_answer", { correct: correct, level: c.level, hint: run.hint });
  }
  function verdictRush(correct, timeout) {
    var r = null;
    if (correct) {
      run.score++; run.combo++; run.bestCombo = Math.max(run.bestCombo, run.combo);
      r = P.rushCatch({ combo: run.combo, hint: run.hint, twist: run.c.mode !== "liar" });
    } else { run.combo = 0; run.lives--; }
    persist();
    var dead = run.lives <= 0;
    setVerdict({
      head: timeout ? "Time's up." : correct ? pick(CAUGHT) : "Not quite.", good: correct,
      rewards: r ? rw(r.coins, r.xp, r.mult) : "",
      sub: answerLine(), next: dead ? "Continue" : "Next case"
    });
    if (r) {
      FX.float("+" + r.coins, $("coins"), "coin"); renderCoins(true);
      if (run.combo >= 2) { FX.float("Combo ×" + run.combo, $("combo"), "combo"); Snd.play("combo", { delay: 0.2, rate: 1 + Math.min(run.combo, 10) * 0.04 }); }
    } else FX.float(timeout ? "Time!" : "-1 life", $("lives"), "bad");
    renderMeta();
  }

  function next() {
    if (!run) return;
    Snd.play("click");
    $("verdict").hidden = true;
    if (run.kind === "career") {
      if (run.n === 1 && !S.settings.tutorialDone) { S.settings.tutorialDone = true; persist(); }
      var target = S.career.level;
      midgame("career_next").then(function () { startCareer(target); });
      return;
    }
    if (run.kind === "rush") {
      if (run.lives <= 0) { outOfLives(); return; }
      nextRush();
      return;
    }
    run.idx = run.prog.results.length;
    if (run.idx >= run.cases.length) { finishDaily(); return; }
    run.c = run.cases[run.idx];
    persist();
    loadCase();
  }

  /* ---------- celebrations queued during play ---------- */
  function flushQueue() {
    if (!queue.length || document.querySelector("dialog[open]")) return;
    var item = queue.shift();
    if (item.type === "levelup") {
      if (item.newTitle) {
        $("rank-badge").innerHTML = FX.badge(item.level, P.tierFor(item.level), 112);
        $("rank-eyebrow").textContent = "Promoted to level " + item.level;
        $("rank-h").textContent = item.title;
        $("rank-text").textContent = "The precinct noticed your work. New title, new badge.";
        $("rank-rewards").innerHTML = "<li>" + item.reward.coins + " coins</li>" + (item.reward.magnifier ? "<li>A free Magnifier</li>" : "");
        Snd.play("levelup");
        FX.confetti({ count: 120 });
        Plat.happytime();
        openDialog("dlg-rank");
      } else {
        Snd.play("levelup", { volume: 0.7 });
        toast("Level " + item.level + "! +" + item.reward.coins + " coins", "gold");
        setTimeout(flushQueue, 2700);
      }
      renderCoins(true);
    } else if (item.type === "achievement") {
      Snd.play("achieve");
      toast("Achievement: " + esc(item.a.name) + " · +" + item.a.coins + " coins", "gold", 2800);
      renderCoins(true);
      setTimeout(flushQueue, 2900);
    } else if (item.type === "mission") {
      var more = 0;
      while (queue.length && queue[0].type === "mission") { queue.shift(); more++; }
      toast(more ? (more + 1) + " missions done. Claim your coins at HQ." : "Mission done: " + esc(item.m.text) + ". Claim it at HQ.", "", 2800);
      setTimeout(flushQueue, 2900);
    }
  }
  $("dlg-rank").addEventListener("close", function () { setTimeout(flushQueue, 200); });

  /* ---------- daily end ---------- */
  function finishDaily() {
    var p = run.prog, day = run.day, replay = run.kind === "replay";
    p.done = true; p.elapsed = run.elapsed;
    var score = scoreOf(p.results);
    if (!replay) {
      var st = S.stats;
      if (st.lastDay !== day) {
        st.played++;
        st.streak = st.lastDay === day - 1 ? st.streak + 1 : 1;
        st.maxStreak = Math.max(st.maxStreak, st.streak);
        st.lastDay = day;
        if (score === 5) st.perfect++;
        st.dist[score] = (st.dist[score] || 0) + 1;
      }
      S.history[day] = { score: score, grid: p.results.join(""), time: p.elapsed };
    } else if (!S.history[day]) {
      S.history[day] = { score: score, grid: p.results.join(""), time: p.elapsed, replay: true };
    }
    var r = P.dailyDone(score, replay);
    persist();
    WL.track("daily_complete", { day: day, score: score, replay: replay, seconds: Math.round(p.elapsed / 1000) });
    midgame("daily_done").then(function () {
      showDailyResults(day, p, replay, r);
      Snd.play(score >= 3 ? "fanfare" : "fail");
      if (score === 5 && !replay) { FX.confetti({ count: 140 }); Plat.happytime(); }
    });
  }

  /* ---------- rush end ---------- */
  function outOfLives() {
    if (run.secondUsed) { endRush(false); return; }
    run.secondUsed = true;
    var ads = canRewarded();
    $("chance-text").textContent = ads
      ? "Watch a short ad to get one more life and keep your run of " + run.score + " going."
      : "You get one free second chance per run. Keep your run of " + run.score + " going?";
    $("btn-chance-yes").innerHTML = ads ? AD_SVG + "Watch an ad for 1 life" : "Use my second chance";
    run.continueOffered = ads;
    openDialog("dlg-chance");
  }
  $("btn-chance-yes").addEventListener("click", function () {
    closeDialog("dlg-chance");
    var go = function () { run.lives = 1; WL.track("rush_continue", { score: run.score }); toast("One more life!"); nextRush(); };
    if (run.continueOffered) {
      Plat.rewarded("rush_continue").then(function (ok) { if (ok) go(); else { adFailed(); endRush(true); } });
    } else go();
  });
  $("btn-chance-no").addEventListener("click", function () { closeDialog("dlg-chance"); endRush(true); });
  $("dlg-chance").addEventListener("cancel", function (e) { e.preventDefault(); closeDialog("dlg-chance"); endRush(true); });
  function endRush(offeredNow) {
    stopClock();
    run.over = true;
    var prevBest = S.endless.best, isBest = run.score > prevBest;
    if (isBest) S.endless.best = run.score;
    var r = P.rushEnd(run.score);
    run.endBonus = r.bonus;
    persist();
    WL.track("rush_over", { score: run.score, cases: run.n });
    Plat.submitScore(S.endless.best);
    var keep = run;
    // A rewarded continue was just offered: no midgame ad on this same break.
    (offeredNow && keep.continueOffered ? Promise.resolve() : midgame("rush_over")).then(function () {
      showRushResults(keep, isBest, prevBest);
      Snd.play(isBest && keep.score > 0 ? "fanfare" : "fail");
      if (isBest && keep.score >= 10) { FX.confetti({ count: 120 }); Plat.happytime(); }
    });
  }

  /* ---------- results screens ---------- */
  function statsRow(pairs) { return pairs.map(function (p) { return "<div><dt>" + p[0] + "</dt><dd>" + p[1] + "</dd></div>"; }).join(""); }
  function actionBtn(label, cls, onClick, href) {
    var el = document.createElement(href ? "a" : "button");
    el.className = "btn wide " + cls; el.textContent = label;
    if (href) el.href = href; else { el.type = "button"; el.addEventListener("click", function () { Snd.play("click"); onClick(); }); }
    return el;
  }
  /* What's next: level bar + the closest mission, so every results screen points at one more goal. */
  function resProgress() {
    var el = $("res-progress");
    if (!el) return;
    var li = P.levelInfo(S.xp), nt = P.nextTitle(li.level), ms = P.ensureMissions();
    var ready = ms.list.filter(function (m) { return m.progress >= m.target && !m.claimed; }).length;
    var open = ms.list.filter(function (m) { return m.progress < m.target; })
      .sort(function (x, y) { return (y.progress / y.target) - (x.progress / x.target); })[0];
    var h = '<div class="rp-level">' + FX.badge(li.level, li.tier, 40) + '<div class="rp-body"><div class="rp-top"><b>Level ' + li.level + "</b> · " + esc(li.title) +
      '<span class="muted">' + (li.need - li.into) + " XP to go</span></div>" +
      '<span class="m-bar"><span style="width:' + Math.round((li.into / li.need) * 100) + '%"></span></span>' +
      (nt ? '<span class="muted small">' + esc(nt[1]) + " at level " + nt[0] + "</span>" : "") + "</div></div>";
    if (ready) h += '<button class="rp-mission ready" type="button" id="rp-claim">' + COIN_SVG + ready + " mission reward" + (ready > 1 ? "s" : "") + " ready. Claim at HQ</button>";
    else if (open) h += '<div class="rp-mission"><span>Next mission: ' + esc(P.missionText(open)) + '</span><span class="muted">' + open.progress + "/" + open.target + "</span></div>";
    el.innerHTML = h;
    var c = $("rp-claim");
    if (c) c.addEventListener("click", function () { Snd.play("click"); goHQ(); });
  }
  function focusTitle() { try { $("res-title").focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
  function showDailyResults(day, p, replay, bonus) {
    stopClock();
    show("results");
    setHud("Daily #" + day, replay ? "Replay" : "Results");
    var score = scoreOf(p.results), hints = p.results.filter(function (r) { return r === "y"; }).length;
    $("res-kicker").textContent = "Daily #" + day + (replay ? " replay" : "") + " complete";
    $("res-title").textContent = DAILY_TITLES[score];
    $("res-body").innerHTML = '<div class="res-grid" role="img" aria-label="' + score + ' of 5 caught">' + cells(p.results, 5) + "</div>" +
      '<p class="res-line">You caught <strong>' + score + " of 5</strong> liars in <strong>" + WL.fmtTime(p.elapsed) + "</strong>" +
      (hints ? ", with " + hints + " hint" + (hints > 1 ? "s" : "") : "") + ".</p>";
    $("res-rewards").innerHTML = (bonus && bonus.bonus ? '<span class="rw coin">' + COIN_SVG + "Daily done +" + bonus.bonus + "</span>" : "") +
      (bonus && bonus.perfect ? '<span class="rw coin">' + COIN_SVG + "Perfect day +" + bonus.perfect + "</span>" : "");
    var known = !replay && day === TODAY ? S.lb.ranks[day] : 0;
    setShare(dailyShareText(day, p, replay, known));
    rankCard("");
    if (!replay && day === TODAY && LB.enabled() && Plat.allowExternal()) {
      var onRank = function (rank) { setShare(dailyShareText(day, p, false, rank)); };
      if (S.settings.playerName) postDaily(day, p, onRank);
      else joinCard("See where you rank against other detectives today.", function () { postDaily(day, p, onRank); postEndless(); });
    }
    var st = S.stats;
    $("res-stats").innerHTML = statsRow([["Days played", st.played], ["Streak", dailyStreak()], ["Best streak", st.maxStreak], ["Perfect days", st.perfect]]);
    resProgress();
    $("res-next").innerHTML = 'New cases in <strong data-countdown="1">' + WL.fmtCountdown(WL.msToNextDay()) + "</strong>";
    var acts = $("res-actions"); acts.innerHTML = "";
    acts.appendChild(actionBtn("Continue career: case " + S.career.level, "primary", function () { startCareer(); }));
    acts.appendChild(actionBtn("Play Rush", "ghost", startRush));
    if (replay) {
      acts.appendChild(actionBtn("Play this day again", "ghost", function () { S.replay = null; persist(); startDaily(day); }));
      if (Plat.allowExternal()) acts.appendChild(actionBtn("Back to past cases", "ghost", null, "archive.html#day-" + day));
    }
    var cases = WL.buildDay(day);
    $("review").hidden = false; $("review").open = false;
    $("review-list").innerHTML = cases.map(function (c, i) {
      var r = p.results[i] || "n";
      var ans = c.mode === "planted" ? "Planted fact: " + c.clues[c.answer]
        : (c.mode === "honest" ? "The honest one: " : "The liar: ") + c.suspects[c.answer].name + " (" + c.suspects[c.answer].role + ")";
      return '<div class="review-item"><h4><span class="cell-' + r + '"></span>' + esc(c.title) + '</h4><p class="ans">' + esc(ans) + "</p><p>" + esc(c.why) + "</p></div>";
    }).join("");
    if (window.WLAds && Plat.allowExternal()) window.WLAds.display($("ad-results"));
    run = null;
    renderCoins(false);
    focusTitle();
  }
  function showRushResults(r, isBest, prevBest) {
    show("results");
    setHud("Rush", "Results");
    var score = r.score;
    $("res-kicker").textContent = "Rush · " + r.n + " cases";
    $("res-title").textContent = score === 0 ? "The liars won." : isBest && prevBest > 0 ? "New personal best!" : "Run over.";
    $("res-body").innerHTML = '<p class="res-big">' + score + "</p>" +
      '<p class="res-line">liar' + (score === 1 ? "" : "s") + " caught." + (r.bestCombo > 1 ? " Best combo ×" + r.bestCombo + "." : "") +
      (score === 0 ? " Tip: read every statement before the clock gets loud." : " Your best: <strong>" + S.endless.best + "</strong>") + "</p>" +
      (isBest && score > 0 ? '<span class="new-best">New best</span>' : "");
    $("res-rewards").innerHTML = r.endBonus ? '<span class="rw coin">' + COIN_SVG + "Run bonus +" + r.endBonus + "</span>" : "";
    setShare(rushShareText(score));
    rankCard("");
    if (LB.enabled() && Plat.allowExternal() && S.endless.best > 0) {
      var boardCard = function () {
        rankCard('<p class="rank-head">Your best run of <strong>' + S.endless.best + "</strong> is on the Rush leaderboard.</p>" +
          '<button class="btn ghost wide" type="button" id="rank-view">View Rush leaderboard</button>');
        $("rank-view").addEventListener("click", function () { openBoard("endless"); });
      };
      if (S.settings.playerName) postEndless(boardCard);
      else joinCard("Put your best run of " + S.endless.best + " on the Rush leaderboard.", function () { postEndless(boardCard); afterJoin(); });
    }
    $("res-stats").innerHTML = statsRow([["Cases", r.n], ["Caught", score], ["Best", S.endless.best], ["Runs", S.endless.runs]]);
    resProgress();
    var dailyDone = S.daily && S.daily.day === TODAY && S.daily.done;
    $("res-next").innerHTML = dailyDone ? 'New daily cases in <strong data-countdown="1">' + WL.fmtCountdown(WL.msToNextDay()) + "</strong>" : "Today's Daily Case is still waiting for you.";
    var acts = $("res-actions"); acts.innerHTML = "";
    acts.appendChild(actionBtn("Play Rush again", "primary", startRush));
    acts.appendChild(actionBtn("Continue career: case " + S.career.level, "ghost", function () { startCareer(); }));
    if (!dailyDone) acts.appendChild(actionBtn("Play today's Daily Case", "ghost", function () { startDaily(TODAY); }));
    $("review").hidden = true;
    if (window.WLAds && Plat.allowExternal()) window.WLAds.display($("ad-results"));
    run = null;
    renderCoins(false);
    focusTitle();
  }

  /* ---------- sharing ---------- */
  var shareTextNow = "";
  function dailyShareText(day, p, replay, rank) {
    var grid = p.results.map(function (r) { return GRID[r]; }).join("");
    var lines = [(CFG.siteName || "Who's Lying?") + " #" + day + (replay ? " (replay)" : ""), grid + " " + scoreOf(p.results) + "/5  ⏱️ " + WL.fmtTime(p.elapsed)];
    var st = dailyStreak();
    if (!replay && st > 1) lines.push("🔥 " + st + "-day streak");
    if (!replay && rank) lines.push("🏆 #" + rank + " on today's leaderboard");
    var u = Plat.shareLink({ day: day }); if (u) lines.push(u);
    return lines.join("\n");
  }
  function rushShareText(score) {
    var lines = [(CFG.siteName || "Who's Lying?") + " Rush 🕵️", "I caught " + score + " liar" + (score === 1 ? "" : "s") + " in a row. Can you beat that?"];
    var u = Plat.shareLink({ mode: "rush" }); if (u) lines.push(u);
    return lines.join("\n");
  }
  function setShare(text) {
    shareTextNow = text;
    if ($("share-wa")) {
      $("share-wa").href = "https://api.whatsapp.com/send?text=" + encodeURIComponent(text);
      $("share-x").href = "https://twitter.com/intent/tweet?text=" + encodeURIComponent(text);
    }
    $("share-text").hidden = true;
    $("btn-share").textContent = Plat.allowExternal() ? "Share your result" : "Copy your result";
  }
  function share() {
    WL.track("share", { method: "button" });
    if (Plat.allowExternal() && coarse && navigator.share) {
      navigator.share({ text: shareTextNow }).catch(function (e) { if (!e || e.name !== "AbortError") copy(); });
      return;
    }
    copy();
  }
  function copy() {
    var text = shareTextNow;
    var ok = function () { toast("Copied. Paste it to a friend."); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(ok, function () { fallbackCopy(text); });
    else fallbackCopy(text);
  }
  function fallbackCopy(text) {
    var ta = document.createElement("textarea");
    ta.value = text; ta.setAttribute("readonly", "");
    ta.style.position = "fixed"; ta.style.top = "0"; ta.style.left = "-9999px";
    document.body.appendChild(ta); ta.select();
    var ok = false;
    try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
    ta.remove();
    if (ok) { toast("Copied. Paste it to a friend."); return; }
    var box = $("share-text");
    box.value = text; box.hidden = false; box.focus(); box.select();
    toast("Select the text in the box and copy it.");
  }

  /* ---------- chapter map ---------- */
  function openMap() {
    show("map");
    setHud("Case files", "Career");
    var cur = WL.chapterOf(S.career.level), html = "";
    for (var ch = 1; ch <= cur + 1; ch++) {
      var locked = ch > cur, got = 0;
      for (var k = 1; k <= 10; k++) got += S.career.stars[(ch - 1) * 10 + k] || 0;
      html += '<section class="chapter' + (locked ? " locked" : "") + '"><div class="chapter-head"><h3>' + ch + ". " + esc(WL.chapterName(ch)) + "</h3>" +
        '<span class="muted">' + (locked ? "Finish chapter " + (ch - 1) + " to open" : '<span class="st on"></span>' + got + " / 30") + "</span></div>" +
        '<div class="nodes">' + chapterNodes(ch, true) + "</div></section>";
    }
    $("chapters").innerHTML = html;
    var nowEl = $("chapters").querySelector(".node.now");
    if (nowEl) setTimeout(function () { nowEl.scrollIntoView({ block: "center" }); }, 30);
  }
  $("chapters").addEventListener("click", function (e) {
    var b = e.target.closest("[data-level]");
    if (!b || b.disabled) return;
    Snd.play("click");
    startCareer(+b.dataset.level);
  });

  /* ---------- shop ---------- */
  function openShop(focusThemes) {
    show("shop");
    setHud("Shop", "Spend your coins");
    renderShop();
    if (focusThemes) setTimeout(function () { $("shop-themes").scrollIntoView({ block: "start" }); }, 30);
  }
  function renderShop() {
    var fc = $("free-coins");
    fc.hidden = !canRewarded();
    if (!fc.hidden) {
      var left = P.coolLeft("coinsAd", 240);
      fc.innerHTML = '<span><b>Free coins</b><br><span class="muted small">Watch a short ad for 40 coins.</span></span>' +
        '<button class="btn small primary" type="button" id="btn-free-coins"' + (left ? " disabled" : "") + ">" + AD_SVG +
        (left ? "Ready in " + Math.ceil(left / 60000) + " min" : "Get 40 coins") + "</button>";
    }
    $("shop-items").innerHTML = Object.keys(P.ITEMS).map(function (id) {
      var it = P.ITEMS[id], can = S.coins >= it.price;
      return '<div class="shop-card"><h4>' + esc(it.name) + "</h4><p>" + esc(it.desc) + '</p><p class="own">You have ' + (S.inv[it.item] || 0) + "</p>" +
        '<button class="btn small ' + (can ? "primary" : "ghost") + '" type="button" data-buy="' + id + '">' + COIN_SVG + it.price + "</button></div>";
    }).join("");
    $("shop-themes").innerHTML = P.THEMES.map(function (t) {
      var owned = S.themes.owned.indexOf(t.id) >= 0, cur = S.themes.current === t.id;
      var label = cur ? "In use" : owned ? "Use" : COIN_SVG + t.price;
      return '<div class="shop-card' + (cur ? " current" : "") + '"><div class="swatch">' + t.swatch.map(function (c) { return '<span style="background:' + c + '"></span>'; }).join("") +
        "</div><h4>" + esc(t.name) + "</h4>" + (t.id === "auto" ? "<p>Light or dark, like your device.</p>" : "") +
        '<button class="btn small ' + (cur ? "ghost" : owned || S.coins >= t.price ? "primary" : "ghost") + '" type="button" data-buy="' + t.id + '"' + (cur ? " disabled" : "") + ">" + label + "</button></div>";
    }).join("");
  }
  $("scr-shop").addEventListener("click", function (e) {
    var b = e.target.closest("[data-buy]");
    if (b) {
      var r = P.buy(b.dataset.buy);
      if (r.ok) {
        Snd.play(r.theme && !r.bought ? "click" : "buy");
        if (r.theme) applyTheme();
        if (r.bought) FX.confetti({ count: 70, y: b.getBoundingClientRect().top });
        toast(esc(r.msg), r.bought ? "gold" : "");
        persist(); renderCoins(true); renderShop();
      } else { Snd.play("wrong"); toast(esc(r.msg)); }
      return;
    }
    if (e.target.closest("#btn-free-coins")) {
      if (P.coolLeft("coinsAd", 240) > 0) return;
      P.coolStart("coinsAd"); persist(); renderShop();
      Plat.rewarded("shop_coins").then(function (ok) {
        if (ok) { P.addCoins(40); persist(); Snd.play("coin"); toast("+40 coins", "gold"); renderCoins(true); }
        else { S.cool.coinsAd = 0; persist(); adFailed(); }
        renderShop();
      });
    }
  });

  /* ---------- achievements ---------- */
  function openAch() {
    show("ach");
    setHud("Achievements", "Rewards for big moments");
    var list = P.achList(), done = list.filter(function (a) { return a.done; }).length;
    $("ach-sum").textContent = done + " of " + list.length + " unlocked. Each one pays coins.";
    $("ach-list").innerHTML = list.map(function (a) {
      return '<li class="ach' + (a.done ? " done" : "") + '"><span class="ach-ico"><span class="st"></span></span><span><h4>' + esc(a.name) + "</h4><p>" + esc(a.desc) +
        " · " + a.coins + ' coins</p><span class="m-bar"><span style="width:' + Math.round((a.value / a.goal) * 100) + '%"></span></span></span></li>';
    }).join("");
  }

  /* ---------- stats ---------- */
  function renderStats() {
    var li = P.levelInfo(S.xp), t = S.tot, st = S.stats;
    $("stats-row").innerHTML = statsRow([["Level", li.level], ["Cases solved", t.solved], ["3-star cases", t.stars3], ["Best streak", t.bestCombo]]);
    var max = Math.max.apply(null, [1].concat(st.dist));
    var todayScore = S.history[TODAY] && !S.history[TODAY].replay ? S.history[TODAY].score : -1, rows = "";
    for (var s = 5; s >= 0; s--) {
      var n = st.dist[s] || 0;
      rows += '<div class="dist-row"><b>' + s + '/5</b><div><div class="dist-bar' + (s === todayScore ? " today" : "") + '" style="width:' + Math.max(8, (n / max) * 100) + '%">' + n + "</div></div></div>";
    }
    $("stats-dist").innerHTML = rows;
    $("stats-row2").innerHTML = statsRow([["Daily played", st.played], ["Daily streak", dailyStreak()], ["Perfect days", st.perfect], ["Rush best", S.endless.best]]);
    var counts = {}, order = [];
    S.lb.badges.forEach(function (b) { if (!counts[b.icon]) { counts[b.icon] = 0; order.push(b); } counts[b.icon]++; });
    var showBadges = (LB.enabled() && Plat.allowExternal()) || S.lb.badges.length > 0;
    $("stats-badges-h").hidden = !showBadges; $("stats-badges").hidden = !showBadges;
    if (showBadges) {
      $("stats-badges").innerHTML = S.lb.badges.length
        ? order.map(function (b) { return '<span class="badge-chip">' + b.icon + " " + esc(b.name) + " ×" + counts[b.icon] + "</span>"; }).join("")
        : "No badges yet. Finish in a day's top 100 to win one.";
    }
  }

  /* ---------- settings ---------- */
  function syncSettings() {
    var forced = Plat.muteForced();
    $("set-music").checked = !!S.settings.music; $("set-sound").checked = !!S.settings.sound;
    $("set-music").disabled = forced; $("set-sound").disabled = forced;
    $("mute-note").hidden = !forced;
    $("reset-confirm").hidden = true;
  }
  $("btn-settings").addEventListener("click", function () { Snd.play("click"); syncSettings(); openDialog("dlg-settings"); });
  $("set-music").addEventListener("change", function () { S.settings.music = this.checked; Snd.setMusic(this.checked); persist(); });
  $("set-sound").addEventListener("change", function () { S.settings.sound = this.checked; Snd.setSound(this.checked); if (this.checked) Snd.play("click"); persist(); });
  $("btn-themes").addEventListener("click", function () { closeDialog("dlg-settings"); if (screen === "case") return toast("Finish this case first, then open the Shop."); openShop(true); });
  $("btn-help").addEventListener("click", function () { closeDialog("dlg-settings"); openDialog("dlg-help"); });
  $("btn-reset").addEventListener("click", function () { $("reset-confirm").hidden = false; });
  $("btn-reset-no").addEventListener("click", function () { $("reset-confirm").hidden = true; });
  $("btn-reset-yes").addEventListener("click", function () {
    S = {}; Plat.save(S, true);
    try { window.localStorage.removeItem("whoslying:v1"); } catch (e) { /* ignore */ }
    location.reload();
  });

  /* ---------- tutorial coach ---------- */
  var coachTarget = null;
  function startCoach() {
    run.coachStep = 1;
    run.coachHold = true;
    coach(document.querySelector(".pane-facts .clues"), "These facts are true. The police checked them.", "Got it");
  }
  function coach(el, text, btn) {
    coachTarget = el;
    $("coach-text").textContent = text;
    $("coach-next").textContent = btn;
    $("coach-next").hidden = !btn;
    $("coach").hidden = false;
    $("coach").classList.toggle("passthrough", !btn);
    placeCoach();
  }
  function placeCoach() {
    if (!coachTarget || $("coach").hidden) return;
    var r = coachTarget.getBoundingClientRect(), pad = 6, ring = $("coach-ring"), b = $("coach-bubble");
    ring.style.left = (r.left - pad) + "px"; ring.style.top = (r.top - pad) + "px";
    ring.style.width = (r.width + pad * 2) + "px"; ring.style.height = (r.height + pad * 2) + "px";
    var bw = b.offsetWidth, bh = b.offsetHeight, vw = innerWidth, vh = innerHeight;
    var top = r.bottom + 14 + bh < vh ? r.bottom + 14 : Math.max(10, r.top - bh - 14);
    if (top + bh > vh - 10) top = Math.max(10, vh - bh - 10);
    var left = Math.min(Math.max(10, r.left + r.width / 2 - bw / 2), vw - bw - 10);
    b.style.top = top + "px"; b.style.left = left + "px";
  }
  function hideCoach() {
    $("coach").hidden = true; coachTarget = null;
    if (run) { run.coachHold = false; run.coachStep = 0; }
  }
  $("coach-next").addEventListener("click", function () {
    Snd.play("click");
    if (run && run.coachStep === 1) {
      run.coachStep = 2;
      coach($("suspects"), "One of these stories can't be true. Tap the liar, then press Accuse.", "");
      run.coachHold = false;
    } else hideCoach();
  });
  $("coach-skip").addEventListener("click", function () { S.settings.tutorialDone = true; persist(); hideCoach(); });
  window.addEventListener("resize", placeCoach);
  document.addEventListener("scroll", placeCoach, true);

  /* ---------- web leaderboard (Firebase) ---------- */
  var nameCb = null, boardTab = "today";
  function bestBadge() {
    var order = (LB.TIERS || []).map(function (t) { return t.icon; }), best = "", bi = 99;
    S.lb.badges.forEach(function (b) { var i = order.indexOf(b.icon); if (i >= 0 && i < bi) { bi = i; best = b.icon; } });
    return best;
  }
  function rankOf(rows) {
    var me = LB.myId && LB.myId();
    for (var i = 0; i < rows.length; i++) if (me && rows[i].uid === me) return i + 1;
    return 0;
  }
  function rankCard(html) { var el = $("res-rank"); el.innerHTML = html; el.hidden = !html; }
  function askName(cb) {
    nameCb = cb || null;
    $("name-input").value = S.settings.playerName || "";
    $("name-error").hidden = true;
    $("name-h").textContent = S.settings.playerName ? "Change your name" : "Join the leaderboard";
    $("name-save").textContent = S.settings.playerName ? "Save name" : "Join";
    openDialog("dlg-name");
    setTimeout(function () { try { $("name-input").focus(); } catch (e) { /* ignore */ } }, 50);
  }
  function postDaily(day, p, onRank) {
    if (!LB.enabled() || !S.settings.playerName) return;
    rankCard('<p class="rank-sub">Checking the leaderboard...</p>');
    var entry = { name: S.settings.playerName, badge: bestBadge(), day: day, score: scoreOf(p.results), timeMs: p.elapsed, grid: p.results.join("") };
    var step = S.lb.posted[day] ? Promise.resolve(true) : LB.submitDaily(entry);
    step.then(function () { S.lb.posted[day] = 1; persist(); return LB.topDaily(day); }).then(function (rows) {
      var rank = rankOf(rows);
      S.lb.ranks[day] = rank; persist();
      showRankCard(rank);
      if (onRank) onRank(rank);
    }).catch(function (e) {
      rankCard('<p class="rank-sub">' + esc(LB.friendlyError(e)) + '</p><button class="btn ghost wide" type="button" id="rank-retry">Try again</button>');
      $("rank-retry").addEventListener("click", function () { postDaily(day, p, onRank); });
    });
  }
  function showRankCard(rank) {
    var tier = rank ? LB.tierFor(rank) : null;
    var head = rank ? "You're <strong>#" + rank + "</strong> on today's leaderboard so far." : "You're not in today's top 100 yet.";
    var sub = rank ? "Ranks lock in once the day ends everywhere. Hold your spot to win " + (tier ? tier.icon + " " + tier.name : "a badge") + " and a free Magnifier."
      : "Catch more liars, or catch them faster, to climb. The top 100 each day win a badge and a free Magnifier.";
    rankCard('<p class="rank-head">' + head + '</p><p class="rank-sub">' + sub + '</p><button class="btn ghost wide" type="button" id="rank-view">View leaderboard</button>');
    $("rank-view").addEventListener("click", function () { openBoard("today"); });
  }
  function joinCard(text, onJoined) {
    rankCard('<p class="rank-head">' + text + '</p><p class="rank-sub">The top 100 each day win a badge and a free Magnifier.</p><button class="btn primary wide" type="button" id="rank-join">Join the leaderboard</button>');
    $("rank-join").addEventListener("click", function () { askName(onJoined); });
  }
  function postEndless(onDone) {
    if (!LB.enabled() || !S.settings.playerName || S.endless.best < 1 || (S.lb.endlessPosted || 0) >= S.endless.best) { if (onDone) onDone(); return; }
    LB.submitEndless({ name: S.settings.playerName, badge: bestBadge(), best: S.endless.best }).then(function () {
      S.lb.endlessPosted = S.endless.best; persist(); if (onDone) onDone();
    }).catch(function () { if (onDone) onDone(); });
  }
  function afterJoin() {
    var p = S.daily && S.daily.day === TODAY && S.daily.done ? S.daily : null;
    if (p && !S.lb.posted[TODAY]) postDaily(TODAY, p, function (rank) { setShare(dailyShareText(TODAY, p, false, rank)); if ($("dlg-board") && $("dlg-board").open) loadBoard(); });
    postEndless(function () { if ($("dlg-board") && $("dlg-board").open) loadBoard(); });
  }
  function openBoard(tab) {
    if (!LB.enabled() || !$("dlg-board")) return;
    boardTab = tab || "today";
    $("board-demo").hidden = !(LB.isDemo && LB.isDemo());
    openDialog("dlg-board");
    loadBoard();
    postEndless(function () { if (boardTab === "endless" && $("dlg-board").open) loadBoard(); });
  }
  function loadBoard() {
    [].forEach.call(document.querySelectorAll("#dlg-board .tab"), function (t) { t.setAttribute("aria-selected", t.dataset.tab === boardTab ? "true" : "false"); });
    var list = $("board-list"), tab = boardTab, day = tab === "yesterday" ? TODAY - 1 : TODAY;
    $("board-note").textContent = tab === "endless" ? "The longest Rush runs of all time."
      : tab === "today" ? "Daily #" + TODAY + ". Ranks lock in once the day ends everywhere. The top 100 win a badge."
      : "Daily #" + day + ". Final ranks. The top 100 won a badge and a free Magnifier.";
    if (tab === "yesterday" && day < 1) { list.innerHTML = '<li class="board-empty">No yesterday yet. Daily #1 is today.</li>'; renderBoardMe(null); return; }
    list.innerHTML = '<li class="board-empty">Loading...</li>';
    (tab === "endless" ? LB.topEndless() : LB.topDaily(day)).then(function (rows) {
      if (tab !== boardTab) return;
      var me = LB.myId();
      list.innerHTML = rows.length ? rows.map(function (r, i) {
        var mine = r.uid === me;
        return '<li class="board-row' + (mine ? " me" : "") + '"><span class="b-rank">' + (i + 1) + '</span><span class="b-name">' +
          (r.badge ? '<span class="b-badge" aria-hidden="true">' + esc(r.badge) + "</span>" : "") + esc(r.name) + (mine ? " <em>(you)</em>" : "") + "</span>" +
          (tab === "endless" ? '<span class="b-score">' + r.best + "</span>" : '<span class="b-score">' + r.score + '/5</span><span class="b-time">' + WL.fmtTime(r.timeMs) + "</span>") + "</li>";
      }).join("") : '<li class="board-empty">No scores yet. Be the first!</li>';
      renderBoardMe(rows);
    }).catch(function (e) { if (tab === boardTab) list.innerHTML = '<li class="board-empty">' + esc(LB.friendlyError(e)) + "</li>"; });
  }
  function renderBoardMe(rows) {
    var box = $("board-me");
    if (!S.settings.playerName) {
      box.innerHTML = '<p>Want your name up here? Finish today\'s Daily Case, then join.</p><button class="btn primary wide" type="button" id="board-join">Join the leaderboard</button>';
      $("board-join").addEventListener("click", function () { askName(afterJoin); });
      return;
    }
    var rank = rows ? rankOf(rows) : 0;
    box.innerHTML = "<p>Playing as <strong>" + esc(S.settings.playerName) + "</strong>" + (rank ? ", ranked <strong>#" + rank + "</strong>" : "") +
      '. <button class="link-btn" type="button" id="board-rename">Change name</button></p>';
    $("board-rename").addEventListener("click", function () { askName(function () { loadBoard(); }); });
  }
  function checkRewards() {
    if (!LB.enabled() || !S.settings.playerName) return;
    var days = Object.keys(S.lb.posted).map(Number).filter(function (d) { return !(d in S.lb.claimed) && d < TODAY && d >= TODAY - 10; });
    if (!days.length) return;
    LB.rewardsFor(days).then(function (res) {
      var won = [];
      res.forEach(function (r) {
        S.lb.claimed[r.day] = r.rank;
        var t = LB.tierFor(r.rank);
        if (t) { S.lb.badges.push({ day: r.day, rank: r.rank, icon: t.icon, name: t.name }); S.inv.magnifier = (S.inv.magnifier || 0) + 1; won.push({ day: r.day, rank: r.rank, tier: t }); }
      });
      persist();
      if (won.length) showReward(won);
    }).catch(function () { /* try again next visit */ });
  }
  function showReward(won) {
    won.sort(function (a, b) { return a.rank - b.rank; });
    var top = won[0];
    $("reward-badge").textContent = top.tier.icon;
    $("reward-h").textContent = top.rank === 1 ? "Number one detective!" : "You made the top 100!";
    $("reward-text").textContent = "You finished #" + top.rank + " on Daily #" + top.day + (won.length > 1 ? ", and made the top 100 on " + (won.length - 1) + " more day" + (won.length > 2 ? "s" : "") : "") + ".";
    $("reward-list").innerHTML = won.map(function (w) { return "<li>" + w.tier.icon + " " + esc(w.tier.name) + " badge for Daily #" + w.day + "</li>"; }).join("") +
      "<li>" + won.length + " free Magnifier" + (won.length > 1 ? "s" : "") + "</li><li>Your best badge now shows next to your name</li>";
    WL.track("reward_won", { rank: top.rank });
    Snd.play("fanfare");
    openDialog("dlg-reward");
  }
  if ($("dlg-board")) {
    [].forEach.call(document.querySelectorAll("#dlg-board .tab"), function (t) { t.addEventListener("click", function () { boardTab = t.dataset.tab; loadBoard(); }); });
    $("name-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var r = LB.cleanName($("name-input").value);
      if (!r.ok) { $("name-error").textContent = r.msg; $("name-error").hidden = false; return; }
      var first = !S.settings.playerName;
      S.settings.playerName = r.name; persist();
      closeDialog("dlg-name");
      toast(first ? "Welcome, " + esc(r.name) + "!" : "Name saved. It shows on your next score.");
      WL.track(first ? "leaderboard_join" : "leaderboard_rename", {});
      var cb = nameCb; nameCb = null;
      if (cb) cb();
      renderHQ();
    });
  }

  /* ---------- wiring ---------- */
  $("brand").addEventListener("click", function () { Snd.play("click"); goHQ(); });
  $("btn-home").addEventListener("click", function () { Snd.play("click"); goHQ(); });
  $("coins").addEventListener("click", function () { Snd.play("click"); if (screen === "case") return toast("Finish this case first, then open the Shop."); openShop(false); });
  $("btn-play").addEventListener("click", function () { Snd.play("click"); startCareer(); });
  $("btn-map").addEventListener("click", function () { Snd.play("click"); openMap(); });
  $("tile-daily").addEventListener("click", function () { Snd.play("click"); startDaily(TODAY); });
  $("tile-rush").addEventListener("click", function () { Snd.play("click"); startRush(); });
  $("btn-shop").addEventListener("click", function () { Snd.play("click"); openShop(false); });
  $("btn-ach").addEventListener("click", function () { Snd.play("click"); openAch(); });
  $("btn-stats").addEventListener("click", function () { Snd.play("click"); renderStats(); openDialog("dlg-stats"); });
  $("btn-board").addEventListener("click", function () { Snd.play("click"); openBoard("today"); });
  $("btn-accuse").addEventListener("click", function () { accuse(false); });
  $("btn-cancel").addEventListener("click", function () { Snd.play("click"); cancelPick(); });
  $("btn-next").addEventListener("click", next);
  $("btn-verdict-hq").addEventListener("click", function () {
    Snd.play("click");
    if (run && run.kind === "career" && run.n === 1) { S.settings.tutorialDone = true; persist(); }
    if (run && run.kind === "rush" && run.lives <= 0) { $("verdict").hidden = true; endRush(false); return; }
    if (run && (run.kind === "daily" || run.kind === "replay") && run.prog.results.length >= run.cases.length) { $("verdict").hidden = true; finishDaily(); return; }
    goHQ();
  });
  $("btn-hint").addEventListener("click", useHint);
  $("btn-freeze").addEventListener("click", useFreeze);
  $("btn-share").addEventListener("click", share);
  if ($("share-wa")) {
    $("btn-copy").addEventListener("click", copy);
    $("share-wa").addEventListener("click", function () { WL.track("share", { method: "whatsapp" }); });
    $("share-x").addEventListener("click", function () { WL.track("share", { method: "x" }); });
  }

  document.addEventListener("keydown", function (e) {
    if (document.querySelector("dialog[open]")) return;
    var tag = (e.target && e.target.tagName) || "";
    if (tag === "TEXTAREA" || tag === "INPUT") return;
    if (screen !== "case" || !run) {
      if (e.key === "Escape" && screen !== "hq" && screen !== "case") goHQ();
      return;
    }
    if (!$("verdict").hidden) {
      if ((e.key === "Enter" || e.key === " ") && e.target.tagName !== "BUTTON") { next(); e.preventDefault(); }
      return;
    }
    if (/^[1-5]$/.test(e.key)) { select(parseInt(e.key, 10) - 1); e.preventDefault(); }
    else if (e.key === "Enter" && !$("confirm").hidden && e.target.tagName !== "BUTTON") { accuse(false); e.preventDefault(); }
    else if (e.key === "Escape") cancelPick();
  });

  setInterval(function () {
    var left = WL.msToNextDay();
    [].forEach.call(document.querySelectorAll("[data-countdown]"), function (el) { el.textContent = WL.fmtCountdown(left); });
    if (screen === "hq" && !run) {
      if (WL.dayNumber() !== TODAY) location.reload();
      else if (new Date().getSeconds() === 0) renderHQ();
    }
    if (screen === "shop" && P.coolLeft("coinsAd", 240) === 0 && $("btn-free-coins") && $("btn-free-coins").disabled) renderShop();
  }, 1000);

  /* ---------- progress events ---------- */
  var hooks = {
    levelup: function (d) { queue.push({ type: "levelup", level: d.level, title: d.title, newTitle: d.newTitle, reward: d.reward }); if (screen !== "case") flushQueue(); },
    achievement: function (a) { queue.push({ type: "achievement", a: a }); if (screen !== "case") flushQueue(); },
    mission: function (m) { queue.push({ type: "mission", m: m }); }
  };

  /* ---------- start-up ---------- */
  function loadState() {
    S = Plat.load();
    S.stats = Object.assign({ played: 0, streak: 0, maxStreak: 0, lastDay: 0, perfect: 0, dist: [0, 0, 0, 0, 0, 0] }, S.stats || {});
    S.history = S.history || {};
    S.endless = Object.assign({ best: 0, runs: 0 }, S.endless || {});
    S.settings = Object.assign({ sound: true, music: true, tutorialDone: false, playerName: "" }, S.settings || {});
    S.lb = Object.assign({ posted: {}, claimed: {}, badges: [], ranks: {} }, S.lb || {});
    P.init(S, hooks);
    // Old saves (before career mode) skip the tutorial.
    if ((S.stats.played > 0 || S.endless.runs > 0) && !S.settings.tutorialDone) S.settings.tutorialDone = true;
    applyTheme();
    Snd.init({ sound: S.settings.sound, music: S.settings.music });
    shownCoins = S.coins;
  }
  function route() {
    var invDay = parseInt(Plat.inviteParam("day"), 10), invMode = Plat.inviteParam("mode");
    if (invDay >= 1 && invDay <= TODAY) { startDaily(invDay); return; }
    if (invMode === "rush") { startRush(); return; }
    var m = location.hash.match(/^#day-(\d+)$/) || location.search.match(/[?&]day=(\d+)/);
    if (m) { var d = parseInt(m[1], 10); if (d >= 1 && d < TODAY) { startDaily(d); return; } }
    if (location.hash === "#endless") { startRush(); return; }
    // New players go straight into their first case.
    if (!S.settings.tutorialDone && S.tot.solved === 0) { startCareer(1); return; }
    goHQ();
  }
  function boot() {
    if (Plat.isCrazy()) document.documentElement.classList.add("cg");
    var fontsReady = document.fonts && document.fonts.ready ? Promise.race([document.fonts.ready, new Promise(function (r) { setTimeout(r, 1500); })]) : Promise.resolve();
    Plat.init().then(function () {
      Plat.loadingStart(); // the SDK only accepts calls once init has finished
      loadState();
      Snd.setForced(Plat.muteForced());
      Plat.on("mute", function (m) { Snd.setForced(m); syncSettings(); });
      Plat.on("adStart", function () { paused.ad = true; Snd.adPause(); });
      Plat.on("adEnd", function () { paused.ad = false; clock.last = performance.now(); Snd.adResume(); });
      Plat.on("auth", function () {
        loadState();
        Plat.getUser().then(function (u) { user = u; if (screen === "hq") renderHQ(); });
      });
      if (Plat.isCrazy()) Plat.hasAdblock().then(function (b) { adblocked = b; });
      return Promise.all([Plat.getUser().then(function (u) { user = u; }), fontsReady]);
    }).then(function () {
      Plat.loadingStop();
      document.body.classList.remove("booting");
      route();
      if (LB.enabled() && Plat.allowExternal()) setTimeout(checkRewards, 1500);
      persist();
    }).catch(function (e) {
      console.error(e);
      document.body.classList.remove("booting");
    });
  }
  // Test hook for automated checks (only with ?test=1 in the address).
  if (/[?&]test=1/.test(location.search)) window.__WLtest = {
    run: function () { return run; }, state: function () { return S; }, persist: persist,
    hq: goHQ, career: startCareer, rush: startRush, daily: startDaily
  };
  boot();
})();
