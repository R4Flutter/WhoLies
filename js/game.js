/*
  WHO'S LYING? — the game screens
  Modes:
    Career  endless chapters of 10 cases, stars, combo streak, chapter rewards
    Daily   5 cases a day, the same for everyone, one try each, share grid
    Rush    unlimited cases against the clock, 3 lives, one continue per run
    Night   one hard bonus case each evening from 8 PM
    Week    the Case of the Week: a clue from each Daily, the mastermind on Sunday
  Also: headquarters (HQ), case files (catch up with Case Keys), chapter map, shop,
  achievements, missions, login rewards, streak shields, comeback gifts, friend
  challenges, level-ups, tutorial, and (web only) the Firebase leaderboard,
  weekly leagues, friend groups, reminders and app install.
*/
(function () {
  "use strict";
  var WL = window.WL, P = window.WLP, Plat = window.WLPlat, Snd = window.WLAudio, FX = window.WLFX;
  var LB = window.WLLB || { enabled: function () { return false; } };
  var CFG = WL.cfg, esc = WL.esc;
  function $(id) { return document.getElementById(id); }
  var TODAY = WL.dayNumber();
  var WEEK = WL.weekOf(TODAY), WDAY = WL.weekday(TODAY);
  var DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  var CLUE_COST = 80;
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
  var notices = [];        // messages to show at HQ, one at a time (comeback gift, shield saves...)
  var cloud = { timer: 0, last: 0, busy: false, behind: false, gone: false }; // online backup (web)
  var bootSearch = location.search;

  function persist() { if (cloud.gone) return; Plat.save(S); cloudDirty(); }
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
  function web() { return Plat.allowExternal(); }
  function lbOn() { return LB.enabled() && web(); }
  function dayName(d) { return DAY_NAMES[WL.weekday(d)]; }
  function weekDay(i) { return (WEEK - 1) * 7 + 1 + i; }
  // A day's weekly clue is yours once you finish that day's Daily (on the day or as a catch-up) or buy it.
  function clueOpen(i) { var h = S.history[weekDay(i)]; return !!(h && !h.replay) || !!S.arc.bought[i]; }
  function cluesOpen() { var n = 0; for (var i = 0; i < 6; i++) if (clueOpen(i)) n++; return n; }
  function myName() { return (user && user.username) || S.settings.playerName || ""; }

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
    if (screen === "hq") setTimeout(pumpNotices, 300); // messages that arrived while this dialog was open
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
  var SCREENS = ["hq", "case", "results", "map", "shop", "ach", "files", "week"];
  function show(name) {
    screen = name;
    SCREENS.forEach(function (n) { $("scr-" + n).hidden = n !== name; });
    var onHQ = name === "hq";
    $("btn-home").hidden = onHQ;
    $("brand").hidden = !onHQ;
    $("hud-title").hidden = onHQ;
    if (name !== "case") { Plat.gameplayStop(); hideCoach(); }
    if (onHQ) { gameTrace.stop(); hqTrace.start(); } else if (name === "case") { hqTrace.stop(); gameTrace.start(); } else { hqTrace.stop(); gameTrace.stop(); }
    if (name === "hq" || name === "results") setTimeout(cloudFlush, 0);
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
    var streak = dailyStreak(), sh = S.inv.shield || 0;
    $("streak-n").textContent = streak;
    $("streak-shields").innerHTML = new Array(sh + 1).join('<span class="sp"></span>');
    $("streak-chip").classList.toggle("lit", streak > 0);
    $("streak-chip").setAttribute("aria-label", "Daily streak: " + streak + " days. Streak Shields: " + sh);

    renderToday();
    renderWeekCard();
    renderNightTile();
    $("rush-sub").textContent = S.endless.best > 0 ? "Your best: " + S.endless.best + " liars" : "Catch liars against the clock";

    var lvl = S.career.level, ch = WL.chapterOf(lvl);
    $("career-chapter").textContent = "Career · Chapter " + ch;
    $("career-name").textContent = WL.chapterName(ch);
    $("career-nodes").innerHTML = chapterNodes(ch, false);
    var spec = WL.careerSpec(lvl);
    $("btn-play").textContent = (lvl === 1 ? "Start case 1" : "Play case " + lvl) + (spec.mode !== "liar" ? " · Twist" : "");

    renderMissions();
    $("btn-board").hidden = !lbOn();
    $("btn-friends").hidden = !lbOn();
    renderLeagueCard();
    renderBanner();
    renderCoins(false);
  }
  function renderToday() {
    var d = S.daily && S.daily.day === TODAY ? S.daily : null, streak = dailyStreak();
    var res = d ? d.results : [], done = !!(d && d.done);
    $("today-eyebrow").textContent = "Daily Case #" + TODAY + " · " + dayName(TODAY);
    $("today-cells").hidden = !res.length;
    $("today-cells").innerHTML = res.length ? cells(res, 5) : "";
    var title, sub, btn;
    if (done) {
      title = scoreOf(res) + " of 5 caught";
      sub = 'New cases in <strong data-countdown="1">' + WL.fmtCountdown(WL.msToNextDay()) + "</strong>";
      btn = "See your result";
    } else if (res.length) {
      title = "Case " + (res.length + 1) + " of 5";
      sub = "You're part way through today's cases.";
      btn = "Continue";
    } else {
      title = "5 new cases";
      sub = streak > 0 ? "Play today to keep your <strong>" + streak + "-day streak</strong> alive." : "The same 5 cases for every detective today.";
      btn = "Play today's cases";
    }
    $("today-title").textContent = title;
    $("today-sub").innerHTML = sub;
    $("btn-daily").textContent = btn;
    $("btn-daily").className = "btn big wide " + (done ? "ghost" : "danger");
    var meta = [], st = S.lb.stand && S.lb.stand.day === TODAY ? S.lb.stand : null;
    if (done && st) meta.push("🏆 #" + st.rank + " of " + st.total + " today");
    var c = S.challenge;
    if (c && c.day === TODAY && !done) meta.push("⚔️ " + esc(c.name) + " challenged you: " + scoreOf(c.grid.split("")) + "/5 in " + WL.fmtTime(c.time * 1000));
    $("today-meta").hidden = !meta.length;
    $("today-meta").innerHTML = meta.join("<br>");
  }
  function renderWeekCard() {
    var k = WL.buildWeek(WEEK), a = S.arc;
    $("week-title").textContent = k.title;
    var slots = "";
    for (var i = 0; i < 7; i++) {
      var d = weekDay(i), cls, label;
      if (i === 6) {
        cls = a.done ? (a.correct ? "got" : "miss") : WDAY === 6 ? "now star" : "star";
        label = "Sunday: the mastermind" + (a.done ? (a.correct ? ", caught" : ", escaped") : WDAY === 6 ? ", open now" : "");
        slots += '<li class="' + cls + '" aria-label="' + label + '"><span>★</span><b>Sun</b></li>';
        continue;
      }
      var open = clueOpen(i);
      cls = open ? "got" : d < TODAY ? "miss" : d === TODAY ? "now" : "";
      label = DAY_NAMES[i] + ": " + (open ? "clue found" : d < TODAY ? "clue missed" : d === TODAY ? "today" : "coming");
      slots += '<li class="' + cls + '" aria-label="' + label + '"><span>' + (open ? "✓" : d < TODAY ? "✕" : "") + "</span><b>" + DAY_NAMES[i].slice(0, 3) + "</b></li>";
    }
    $("week-slots").innerHTML = slots;
    var n = cluesOpen(), sub;
    if (a.done) sub = a.correct ? "You caught the mastermind. A new case starts Monday." : "The mastermind got away this time. A new case starts Monday.";
    else if (WDAY === 6) sub = "<strong>Name the mastermind today!</strong> You have " + n + " of 6 clues.";
    else sub = n + " of 6 clues. Each Daily you finish adds one. Name the mastermind on Sunday.";
    $("week-sub").innerHTML = sub;
    $("week-left").textContent = WDAY === 6 ? "Last day" : (7 - WDAY) + " days left";
    $("btn-week").className = "btn wide " + (WDAY === 6 && !a.done ? "danger" : "ghost");
    $("btn-week").textContent = WDAY === 6 && !a.done ? "Name the mastermind" : "Open the case board";
  }
  function msToNight() { var n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate(), WL.NIGHT_HOUR) - n; }
  function nightState() {
    if (S.night.day === TODAY && S.night.done) return S.night.correct ? "solved" : "missed";
    return msToNight() <= 0 ? "open" : "wait";
  }
  function renderNightTile() {
    var st = nightState(), left = msToNight(), sub;
    if (st === "solved") sub = "Solved! Next one tomorrow at 8 PM";
    else if (st === "missed") sub = "Not this time. Next one tomorrow at 8 PM";
    else if (st === "open") sub = "Open now. A hard bonus case";
    else sub = "Opens at 8 PM · in " + Math.floor(left / 3600000) + "h " + Math.floor((left % 3600000) / 60000) + "m";
    $("night-sub").textContent = sub;
    $("night-flag").hidden = st !== "open";
    $("tile-night").classList.toggle("is-open", st === "open");
  }
  // One banner at a time: install the app, then the daily reminder.
  function renderBanner() {
    var b = $("hq-banner"), html = "";
    if (cloudOn() && S.tot.solved <= 2 && !S.stats.played && !S.pwa.noRestore) {
      html = '<span class="hb-ico" aria-hidden="true">☁️</span><span class="hb-txt"><b>Played before?</b><span>Bring back your progress with your save code.</span></span>' +
        '<button class="btn small primary" type="button" data-banner="restore">Restore</button><button class="icon-btn" type="button" data-banner="x-restore" aria-label="Not now"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button>';
    } else if (web() && S.tot.dailyDone >= 1 && !S.pwa.noInstall && canInstall()) {
      html = '<span class="hb-ico" aria-hidden="true">📲</span><span class="hb-txt"><b>Play from your home screen</b><span>One tap to open, works offline.</span></span>' +
        '<button class="btn small primary" type="button" data-banner="install">Install</button><button class="icon-btn" type="button" data-banner="x-install" aria-label="Not now"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button>';
    } else if (web() && S.tot.dailyDone >= 2 && !S.pwa.reminder && !S.pwa.noReminder) {
      html = '<span class="hb-ico" aria-hidden="true">⏰</span><span class="hb-txt"><b>Never miss a case</b><span>Add a daily reminder to your calendar.</span></span>' +
        '<button class="btn small primary" type="button" data-banner="reminder">Remind me</button><button class="icon-btn" type="button" data-banner="x-reminder" aria-label="Not now"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button>';
    }
    b.innerHTML = html; b.hidden = !html;
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
    try {
      var q = location.search.replace(/([?&])(c|g|day|restore)=[^&]*&?/g, "$1").replace(/[?&]$/, "");
      if (location.hash || q !== location.search) history.replaceState(null, "", location.pathname + q);
    } catch (e) { /* ignore */ }
    applyTheme();
    renderHQ();
    show("hq");
    if (cloud.behind) { cloud.behind = false; cloudPull(S.sync.code, "sync"); }
    if (cloudOn() && S.sync.code && !S.sync.told && (S.stats.played >= 2 || S.tot.solved >= 12)) { S.sync.told = true; persist(); notice(saveTip()); }
    setTimeout(pumpNotices, 350);
  }

  /* ---------- notices: one message at a time on HQ ----------
     n = { icon, eyebrow, title, text, html, yes: "label", onYes, no: "label", onNo } */
  var noticeNow = null;
  function notice(n) { notices.push(n); if (screen === "hq") setTimeout(pumpNotices, 50); }
  function pumpNotices() {
    if (screen !== "hq" || document.querySelector("dialog[open]")) return;
    var n = notices.shift();
    if (!n) { maybeLogin(); return; }
    showNotice(n);
  }
  function showNotice(n) {
    noticeNow = n;
    $("notice-icon").textContent = n.icon || "";
    $("notice-eyebrow").hidden = !n.eyebrow; $("notice-eyebrow").textContent = n.eyebrow || "";
    $("notice-h").textContent = n.title;
    $("notice-text").innerHTML = n.text || "";
    $("notice-body").innerHTML = n.html || "";
    $("notice-yes").textContent = n.yes || "OK";
    $("notice-no").hidden = !n.no; $("notice-no").textContent = n.no || "";
    if (n.sound) Snd.play(n.sound);
    openDialog("dlg-notice");
  }
  function closeNotice(yes) {
    var n = noticeNow; noticeNow = null;
    closeDialog("dlg-notice");
    if (n && yes && n.onYes) n.onYes();
    if (n && !yes && n.onNo) n.onNo();
    setTimeout(pumpNotices, 250); // don't wait for the "close" event: hidden tabs may not fire it
  }
  $("notice-yes").addEventListener("click", function () { Snd.play("click"); closeNotice(true); });
  $("notice-no").addEventListener("click", function () { Snd.play("click"); closeNotice(false); });
  // Esc or a tap outside just dismisses the notice.
  $("dlg-notice").addEventListener("close", function () { noticeNow = null; setTimeout(pumpNotices, 250); });
  function rewardList(r) {
    var li = [];
    if (r.coins) li.push("<li>" + COIN_SVG + " " + r.coins + " coins</li>");
    if (r.magnifier) li.push("<li>🔍 " + r.magnifier + " Magnifier" + (r.magnifier > 1 ? "s" : "") + "</li>");
    if (r.key) li.push("<li>🔑 " + r.key + " Case Key" + (r.key > 1 ? "s" : "") + "</li>");
    if (r.shield) li.push("<li>🛡️ " + r.shield + " Streak Shield" + (r.shield > 1 ? "s" : "") + "</li>");
    if (r.freeze) li.push("<li>❄ " + r.freeze + " Time Freeze</li>");
    return '<ul class="reward-list">' + li.join("") + "</ul>";
  }
  function streakInfo() {
    var st = dailyStreak(), sh = S.inv.shield || 0;
    notice({
      icon: "🔥", title: st ? st + "-day streak" : "Start a streak",
      text: (st ? "You've played the Daily Case " + st + " day" + (st > 1 ? "s" : "") + " in a row. " : "Play the Daily Case every day to build a streak. ") +
        "Every 7 days in a row you get a Case Key and a Streak Shield.",
      html: '<p class="shield-line"><b>🛡️ Streak Shields: ' + sh + " of " + P.MAX_SHIELDS + "</b><br>If you miss a day, a shield saves your streak automatically.</p>",
      yes: "Got it", no: sh < P.MAX_SHIELDS ? "Get a shield in the Shop" : "", onNo: function () { openShop(false); }
    });
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
      if (rew.key) parts.push(rew.key + " 🔑");
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
    toast("Daily reward: " + r.coins + " coins" + (r.magnifier ? " + " + r.magnifier + " Magnifier" + (r.magnifier > 1 ? "s" : "") : "") + (r.freeze ? " + a Time Freeze" : "") + (r.key ? " + a Case Key" : ""), "gold");
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
      } else if (run.kind === "night") {
        $("rec-time").textContent = WL.fmtTime(run.caseElapsed);
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
      cloudFlush();
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
  function newProg(day) { return { day: day, results: [], hints: [], elapsed: 0, done: false }; }
  function progressFor(day, catchup) {
    if (catchup) { if (!S.catchups[day]) { S.catchups[day] = newProg(day); persist(); } return S.catchups[day]; }
    var key = day === TODAY ? "daily" : "replay";
    var p = S[key];
    if (!p || p.day !== day) { p = S[key] = newProg(day); persist(); }
    return p;
  }
  // mode: "practice" plays a past day for fun (no rewards), even if it was unlocked with a key.
  function startDaily(day, mode) {
    day = day || TODAY;
    var replay = day !== TODAY;
    var catchup = replay && mode !== "practice" && !!S.unlocked[day];
    var prog = progressFor(day, catchup);
    if (prog.done) { showDailyResults(day, prog, replay, null, catchup); return; }
    run = { kind: replay ? "replay" : "daily", catchup: catchup, day: day, cases: WL.buildDay(day), prog: prog, idx: prog.results.length, elapsed: prog.elapsed || 0 };
    run.c = run.cases[run.idx];
    WL.track(replay ? "replay_start" : "daily_start", { day: day, case: run.idx + 1 });
    show("case");
    loadCase();
  }
  function startNight() {
    var st = nightState();
    if (st === "wait") { toast("The Night Shift opens at 8 PM. Come back tonight!"); return; }
    if (st !== "open") { toast("You've done tonight's Night Shift. Next one tomorrow at 8 PM."); return; }
    run = { kind: "night", day: TODAY, c: WL.buildNight(TODAY), elapsed: 0 };
    S.night = { day: TODAY, done: false }; persist();
    document.documentElement.setAttribute("data-skin", "night"); refreshTraceColors();
    WL.track("night_start", { day: TODAY });
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
    } else if (run.kind === "night") {
      setHud("Night Shift", "Tonight's bonus case");
      $("case-kicker").textContent = (LEVEL[c.level] || "Case") + " · One try";
    } else {
      setHud("Daily #" + run.day + (run.catchup ? " catch-up" : run.kind === "replay" ? " practice" : ""), "Case " + (run.idx + 1) + " of 5");
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
    $("replay-tag").hidden = !(k === "replay" || k === "night" || (k === "career" && run.n < S.career.level && !run.revealed));
    $("replay-tag").textContent = k === "night" ? "Night Shift" : run.catchup ? "Catch-up" : k === "replay" ? "Practice" : "Replay";
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
    } else if (k === "night") {
      $("rec-left").textContent = "Night Shift";
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
    else if (run.kind === "night") note = "One try. Take your time.";
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
    else if (run.kind === "night") verdictNight(correct);
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
    var r = P.dailyCase({ correct: correct, hint: run.hint, twist: c.mode !== "liar", replay: run.kind === "replay", catchup: run.catchup });
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
  function verdictNight(correct) {
    S.night = { day: TODAY, done: true, correct: correct };
    var r = P.nightDone({ correct: correct, hint: run.hint, twist: run.c.mode !== "liar" });
    persist();
    setVerdict({
      head: correct ? "Night Shift: solved!" : "The liar slipped away.", good: correct,
      banner: correct ? "Bonus case cracked" : "", rewards: rw(r.coins, r.xp),
      sub: answerLine(), next: "Back to HQ"
    });
    if (r.coins) { FX.float("+" + r.coins, $("coins"), "coin"); renderCoins(true); }
    if (correct) { FX.confetti({ count: 80 }); Plat.happytime(); }
    WL.track("night_done", { correct: correct });
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
    if (run.kind === "night") { goHQ(); return; }
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
    var p = run.prog, day = run.day, replay = run.kind === "replay", catchup = !!run.catchup;
    p.done = true; p.elapsed = run.elapsed;
    var score = scoreOf(p.results), st = S.stats, extra = {};
    if (!replay) {
      if (st.lastDay !== day) {
        st.played++;
        st.streak = st.lastDay === day - 1 ? st.streak + 1 : 1;
        st.maxStreak = Math.max(st.maxStreak, st.streak);
        st.lastDay = day;
        if (score === 5) st.perfect++;
        st.dist[score] = (st.dist[score] || 0) + 1;
        extra.streak = P.streakDay(st.streak);
      }
      S.history[day] = { score: score, grid: p.results.join(""), time: p.elapsed };
    } else if (catchup) {
      // A catch-up counts as playing that day, but not for the streak or the leaderboard.
      st.played++;
      if (score === 5) st.perfect++;
      st.dist[score] = (st.dist[score] || 0) + 1;
      S.history[day] = { score: score, grid: p.results.join(""), time: p.elapsed, catchup: true };
    } else if (!S.history[day]) {
      S.history[day] = { score: score, grid: p.results.join(""), time: p.elapsed, replay: true };
    }
    if ((!replay || catchup) && WL.weekOf(day) === WEEK && WL.weekday(day) < 6) extra.clue = WL.weekday(day);
    var r = P.dailyDone(score, replay, catchup);
    persist();
    WL.track("daily_complete", { day: day, score: score, replay: replay, catchup: catchup, seconds: Math.round(p.elapsed / 1000) });
    midgame("daily_done").then(function () {
      showDailyResults(day, p, replay, r, catchup, extra);
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
  function showDailyResults(day, p, replay, bonus, catchup, extra) {
    stopClock();
    show("results");
    var label = catchup ? " catch-up" : replay ? " practice" : "";
    setHud("Daily #" + day, catchup ? "Catch-up" : replay ? "Practice" : "Results");
    var score = scoreOf(p.results), hints = p.results.filter(function (r) { return r === "y"; }).length;
    $("res-kicker").textContent = "Daily #" + day + label + " complete";
    $("res-title").textContent = DAILY_TITLES[score];
    $("res-body").innerHTML = '<div class="res-grid" role="img" aria-label="' + score + ' of 5 caught">' + cells(p.results, 5) + "</div>" +
      '<p class="res-line">You caught <strong>' + score + " of 5</strong> liars in <strong>" + WL.fmtTime(p.elapsed) + "</strong>" +
      (hints ? ", with " + hints + " hint" + (hints > 1 ? "s" : "") : "") + ".</p>";
    $("res-rewards").innerHTML = (bonus && bonus.bonus ? '<span class="rw coin">' + COIN_SVG + "Daily done +" + bonus.bonus + "</span>" : "") +
      (bonus && bonus.perfect ? '<span class="rw coin">' + COIN_SVG + "Perfect day +" + bonus.perfect + "</span>" : "");
    var known = !replay && day === TODAY ? S.lb.ranks[day] : 0;
    setShare(dailyShareText(day, p, replay, known));
    rankCard("");
    renderVersus(day, p);
    renderExtras(day, replay, catchup, extra || {});
    if (!replay && day === TODAY && lbOn()) {
      var onRank = function (rank) { setShare(dailyShareText(day, p, false, rank)); };
      if (S.settings.playerName) postDaily(day, p, onRank);
      else {
        joinCard("See where you rank against other detectives today.", function () { postDaily(day, p, onRank); postEndless(); });
        LB.dailyStanding(day, score, p.elapsed).then(function (st) {
          S.lb.stand = { day: day, rank: st.rank, total: st.total }; persist();
          var h = $("res-rank").querySelector(".rank-head");
          if (h) h.innerHTML = "You'd be <strong>#" + st.rank + "</strong> of " + st.total + " today: " + pctText(st) + ". Join to put your name up.";
          setShare(dailyShareText(day, p, false, 0));
        }).catch(function () { /* the join card still works */ });
      }
    }
    var st = S.stats;
    $("res-stats").innerHTML = statsRow([["Days played", st.played], ["Streak", dailyStreak()], ["Best streak", st.maxStreak], ["Perfect days", st.perfect]]);
    resProgress();
    $("res-next").innerHTML = 'New cases in <strong data-countdown="1">' + WL.fmtCountdown(WL.msToNextDay()) + "</strong>";
    var acts = $("res-actions"); acts.innerHTML = "";
    acts.appendChild(actionBtn("Continue career: case " + S.career.level, "primary", function () { startCareer(); }));
    acts.appendChild(actionBtn("Play Rush", "ghost", startRush));
    if (replay) {
      acts.appendChild(actionBtn("Practice this day again", "ghost", function () { S.replay = null; persist(); startDaily(day, "practice"); }));
      acts.appendChild(actionBtn("Back to case files", "ghost", openFiles));
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
  function pctText(st) {
    if (st.total <= 1) return "you're the first to finish";
    return "better than " + Math.round(100 * (st.total - st.rank) / (st.total - 1)) + "% of players";
  }
  // Every shared Daily result is also a challenge: the link carries your score.
  function challengeCode(day, p) { return day + "." + p.results.join("") + "." + Math.round(p.elapsed / 1000) + "." + (myName() || "A friend"); }
  function dailyShareText(day, p, replay, rank) {
    var grid = p.results.map(function (r) { return GRID[r]; }).join("");
    var lines = [(CFG.siteName || "Who's Lying?") + " #" + day + (replay ? " (replay)" : ""), grid + " " + scoreOf(p.results) + "/5  ⏱️ " + WL.fmtTime(p.elapsed)];
    var st = dailyStreak(), stand = !replay && S.lb.stand && S.lb.stand.day === day ? S.lb.stand : null;
    if (!replay && st > 1) lines.push("🔥 " + st + "-day streak");
    if (stand && stand.total >= 10) lines.push("🕵️ Top " + Math.max(1, Math.ceil((100 * stand.rank) / stand.total)) + "% today");
    else if (!replay && rank) lines.push("🏆 #" + rank + " on today's leaderboard");
    lines.push("Can you beat me? ⚔️");
    var u = Plat.shareLink({ day: day, c: challengeCode(day, p) }); if (u) lines.push(u);
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
  function share() { WL.track("share", { method: "button" }); shareOut(shareTextNow); }
  function shareOut(text, copiedMsg) {
    if (web() && coarse && navigator.share) {
      navigator.share({ text: text }).catch(function (e) { if (!e || e.name !== "AbortError") copyText(text, copiedMsg); });
      return;
    }
    copyText(text, copiedMsg);
  }
  function copy() { copyText(shareTextNow); }
  function copyText(text, msg) {
    var ok = function () { toast(msg || "Copied. Paste it to a friend."); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(ok, function () { fallbackCopy(text, msg); });
    else fallbackCopy(text, msg);
  }
  function fallbackCopy(text, msg) {
    var ta = document.createElement("textarea");
    ta.value = text; ta.setAttribute("readonly", "");
    ta.style.position = "fixed"; ta.style.top = "0"; ta.style.left = "-9999px";
    document.body.appendChild(ta); ta.select();
    var ok = false;
    try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
    ta.remove();
    if (ok) { toast(msg || "Copied. Paste it to a friend."); return; }
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
    if ($("cloud-box")) {
      $("cloud-box").hidden = !cloudOn();
      $("cloud-text").innerHTML = S.sync.code ? 'Your progress is saved online. Your save code: <b class="save-code">' + fmtCode(S.sync.code) + "</b>"
        : "Your progress will be saved online after your first case.";
      $("cloud-acts").hidden = !S.sync.code;
    }
  }
  $("btn-settings").addEventListener("click", function () { Snd.play("click"); syncSettings(); openDialog("dlg-settings"); });
  $("set-music").addEventListener("change", function () { S.settings.music = this.checked; Snd.setMusic(this.checked); persist(); });
  $("set-sound").addEventListener("change", function () { S.settings.sound = this.checked; Snd.setSound(this.checked); if (this.checked) Snd.play("click"); persist(); });
  $("btn-themes").addEventListener("click", function () { closeDialog("dlg-settings"); if (screen === "case") return toast("Finish this case first, then open the Shop."); openShop(true); });
  $("btn-help").addEventListener("click", function () { closeDialog("dlg-settings"); openDialog("dlg-help"); });
  $("btn-reset").addEventListener("click", function () { $("reset-confirm").hidden = false; });
  $("btn-reset-no").addEventListener("click", function () { $("reset-confirm").hidden = true; });
  $("btn-reset-yes").addEventListener("click", function () {
    cloud.gone = true;
    try { window.localStorage.removeItem("whoslying:v1"); } catch (e) { /* ignore */ }
    S = { noAutoRestore: true }; Plat.save(S, true);
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
  var nameCb = null, boardTab = "today", boardDay = "today", boardTok = 0;
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
    step.then(function () {
      S.lb.posted[day] = 1; persist();
      syncLeague();
      return Promise.all([LB.topDaily(day), LB.dailyStanding(day, entry.score, entry.timeMs).catch(function () { return null; })]);
    }).then(function (res) {
      var rank = rankOf(res[0]), stand = res[1];
      if (stand) S.lb.stand = { day: day, rank: stand.rank, total: stand.total };
      S.lb.ranks[day] = rank; persist();
      showRankCard(rank, stand);
      if (onRank) onRank(rank);
    }).catch(function (e) {
      rankCard('<p class="rank-sub">' + esc(LB.friendlyError(e)) + '</p><button class="btn ghost wide" type="button" id="rank-retry">Try again</button>');
      $("rank-retry").addEventListener("click", function () { postDaily(day, p, onRank); });
    });
  }
  function showRankCard(rank, stand) {
    var tier = rank ? LB.tierFor(rank) : null;
    var head = stand ? "You're <strong>#" + stand.rank + "</strong> of " + stand.total + " detectives today: " + pctText(stand) + "."
      : rank ? "You're <strong>#" + rank + "</strong> on today's leaderboard so far." : "You're not in today's top 100 yet.";
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
    [].forEach.call(document.querySelectorAll("#board-seg button"), function (b) { b.setAttribute("aria-pressed", b.dataset.day === boardDay ? "true" : "false"); });
    $("board-seg").hidden = boardTab !== "today";
    $("board-head").hidden = true;
    var tok = ++boardTok;
    if (boardTab === "league") { loadLeague(tok); return; }
    if (boardTab === "friends") { loadFriends(tok); return; }
    var list = $("board-list"), tab = boardTab === "today" ? boardDay : boardTab, day = tab === "yesterday" ? TODAY - 1 : TODAY;
    $("board-note").textContent = tab === "endless" ? "The longest Rush runs of all time."
      : tab === "today" ? "Daily #" + TODAY + ". Ranks lock in once the day ends everywhere. The top 100 win a badge."
      : "Daily #" + day + ". Final ranks. The top 100 won a badge and a free Magnifier.";
    if (tab === "yesterday" && day < 1) { list.innerHTML = '<li class="board-empty">No yesterday yet. Daily #1 is today.</li>'; renderBoardMe(null); return; }
    list.innerHTML = '<li class="board-empty">Loading...</li>';
    (tab === "endless" ? LB.topEndless() : LB.topDaily(day)).then(function (rows) {
      if (tok !== boardTok) return;
      var me = LB.myId();
      list.innerHTML = rows.length ? rows.map(function (r, i) {
        var mine = r.uid === me;
        return '<li class="board-row' + (mine ? " me" : "") + '"><span class="b-rank">' + (i + 1) + '</span><span class="b-name">' +
          (r.badge ? '<span class="b-badge" aria-hidden="true">' + esc(r.badge) + "</span>" : "") + esc(r.name) + (mine ? " <em>(you)</em>" : "") + "</span>" +
          (tab === "endless" ? '<span class="b-score">' + r.best + "</span>" : '<span class="b-score">' + r.score + '/5</span><span class="b-time">' + WL.fmtTime(r.timeMs) + "</span>") + "</li>";
      }).join("") : '<li class="board-empty">No scores yet. Be the first!</li>';
      renderBoardMe(rows);
    }).catch(function (e) { if (tok === boardTok) list.innerHTML = '<li class="board-empty">' + esc(LB.friendlyError(e)) + "</li>"; });
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
    [].forEach.call(document.querySelectorAll("#dlg-board .tab"), function (t) { t.addEventListener("click", function () { Snd.play("click"); boardTab = t.dataset.tab; loadBoard(); }); });
    $("board-seg").addEventListener("click", function (e) { var b = e.target.closest("[data-day]"); if (b) { boardDay = b.dataset.day; loadBoard(); } });
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

  /* ---------- friend challenges (head to head) ---------- */
  // Link format: day.grid.seconds.name  e.g. 6.ggyrg.92.Raj
  function parseChallenge(raw) {
    if (!raw) return null;
    var p = String(raw).split(".");
    if (p.length < 4) return null;
    var day = parseInt(p[0], 10), grid = p[1], time = parseInt(p[2], 10);
    var name = p.slice(3).join(".").replace(/\s+/g, " ").trim().slice(0, 16);
    if (!(day >= 1 && day <= TODAY + 1) || !/^[gyr]{5}$/.test(grid) || !(time >= 0 && time < 86400) || !name) return null;
    return { day: day, grid: grid, time: time, name: name };
  }
  function versus(mine, c) {
    var me = { s: scoreOf(mine.grid.split("")), t: mine.time }, them = { s: scoreOf(c.grid.split("")), t: c.time };
    var tie = me.s === them.s && me.t === them.t, win = !tie && (me.s > them.s || (me.s === them.s && me.t < them.t));
    var side = function (who, grid, o, won) {
      return '<span class="vs-side' + (won ? " win" : "") + '"><b>' + esc(who) + '</b><span class="res-grid small">' + cells(grid.split(""), 5) +
        "</span><span>" + o.s + "/5 · " + WL.fmtTime(o.t * 1000) + "</span></span>";
    };
    return {
      win: win, tie: tie,
      head: tie ? "It's a tie!" : win ? "You beat " + c.name + "!" : c.name + " wins this one.",
      html: '<div class="vs-row">' + side("You", mine.grid, me, win) + '<span class="vs-x">vs</span>' + side(c.name, c.grid, them, !win && !tie) + "</div>"
    };
  }
  function countWin(v, c) { if (v.win && !c.counted) { c.counted = true; P.count("challengesWon"); persist(); } }
  function renderVersus(day, p) {
    var c = S.challenge, box = $("res-versus");
    if (!c || c.day !== day) { box.hidden = true; return; }
    var v = versus({ grid: p.results.join(""), time: Math.round(p.elapsed / 1000) }, c);
    box.innerHTML = '<p class="vs-head">' + esc(v.head) + "</p>" + v.html +
      '<button class="btn primary wide" type="button" id="vs-rematch">' + (v.win ? "Rub it in: send your result" : "Send a rematch") + "</button>";
    box.classList.toggle("won", v.win);
    box.hidden = false;
    $("vs-rematch").addEventListener("click", function () { Snd.play("click"); share(); });
    countWin(v, c);
    if (v.win) Snd.play("achieve", { delay: 0.8 });
  }
  function handleChallenge(c) {
    var mineToday = S.daily && S.daily.day === TODAY && S.daily.done ? S.daily : null;
    var h = c.day === TODAY ? (mineToday ? { grid: mineToday.results.join(""), time: Math.round(mineToday.elapsed / 1000) } : null)
      : S.history[c.day] ? { grid: S.history[c.day].grid, time: Math.round(S.history[c.day].time / 1000) } : null;
    if (h && h.grid === c.grid && h.time === c.time) return; // your own link
    if (c.day > TODAY) {
      notice({ icon: "⚔️", title: c.name + " challenged you!", text: "Their Daily #" + c.day + " starts tomorrow where you live. Come back then to take them on.", yes: "OK" });
      return;
    }
    S.challenge = c; persist();
    if (h) {
      var v = versus(h, c);
      countWin(v, c);
      notice({ icon: v.win ? "🏆" : "⚔️", eyebrow: "Daily #" + c.day + " challenge", title: v.head, html: v.html, yes: "Send a rematch", no: "Close",
        onYes: function () { shareOut(dailyShareText(c.day, { results: h.grid.split(""), elapsed: h.time * 1000 }, false, 0)); } });
      return;
    }
    notice({
      icon: "⚔️", eyebrow: "Daily #" + c.day + " challenge", title: c.name + " challenged you!",
      text: "They caught <b>" + scoreOf(c.grid.split("")) + " of 5</b> liars in <b>" + WL.fmtTime(c.time * 1000) + "</b>. Same cases, one try each. Can you beat that?",
      html: '<div class="res-grid small">' + cells(c.grid.split(""), 5) + "</div>",
      yes: "Accept the challenge", no: "Later",
      onYes: function () { startDaily(c.day, c.day === TODAY ? undefined : "practice"); }
    });
  }

  /* ---------- what's next after a Daily ---------- */
  function nextCard(icon, title, text, btn) {
    return '<div class="next-card"><span class="nc-ico" aria-hidden="true">' + icon + '</span><span class="nc-txt"><b>' + title + "</b><span>" + text + "</span></span>" +
      (btn ? '<button class="btn small primary" type="button" data-next="' + btn[0] + '">' + btn[1] + "</button>" : "") + "</div>";
  }
  function renderExtras(day, replay, catchup, extra) {
    var h = [];
    if (extra.streak) h.push(nextCard("🔥", dailyStreak() + " days in a row!", "You earned a Case Key and a Streak Shield.", null));
    if (extra.clue != null) {
      h.push(nextCard("🧩", "New clue for " + esc(WL.buildWeek(WEEK).title), esc(WL.buildWeek(WEEK).clues[extra.clue].text), ["week", "Case board"]));
    }
    if (!replay && day === TODAY && WDAY === 6 && !S.arc.done) {
      h.push(nextCard("★", "Name the mastermind today", "You have " + cluesOpen() + " of 6 clues for " + esc(WL.buildWeek(WEEK).title) + ".", ["week", "Solve it"]));
    }
    if (!replay && day === TODAY) {
      var ns = nightState();
      if (ns === "open") h.push(nextCard("🌙", "The Night Shift is open", "One hard bonus case, 40 coins if you crack it.", ["night", "Play"]));
      else if (ns === "wait") h.push(nextCard("🌙", "Night Shift at 8 PM", "Come back tonight for a hard bonus case.", null));
    }
    if (!replay && day === TODAY && web() && !S.pwa.reminder && !S.pwa.noReminder) h.push(nextCard("⏰", "Never miss a case", "Add a daily reminder to your calendar.", ["reminder", "Remind me"]));
    $("res-extra").innerHTML = h.join("");
  }
  $("res-extra").addEventListener("click", function (e) {
    var b = e.target.closest("[data-next]");
    if (!b) return;
    Snd.play("click");
    var k = b.dataset.next;
    if (k === "week") openWeek(); else if (k === "night") startNight(); else if (k === "reminder") openReminder();
  });

  /* ---------- weekly league (web) ---------- */
  var leagueP = null;
  function weekLeft() { return WDAY === 6 ? "ends tonight" : (7 - WDAY) + " days left"; }
  // Works out this week's tier from last week's final standing (once a week), cached per session.
  function resolveLeague() {
    if (!lbOn() || !S.settings.playerName) return Promise.resolve(null);
    if (leagueP) return leagueP;
    var L = S.league;
    leagueP = Promise.all([LB.leagueMine(WEEK), WEEK > 1 ? LB.leagueMine(WEEK - 1) : Promise.resolve(null)]).then(function (r) {
      var mine = r[0], prev = r[1];
      var lastP = !prev ? Promise.resolve(null)
        : L.last && L.last.week === WEEK - 1 ? Promise.resolve(L.last)
        : LB.leagueStanding(WEEK - 1, prev.tier, prev.pts, prev.timeMs).then(function (st) {
          return { week: WEEK - 1, tier: prev.tier, rank: st.rank, total: st.total, pts: prev.pts, move: LB.leagueMove(prev.tier, st.rank, st.total, prev.pts) };
        });
      return lastP.then(function (last) {
        var tier = mine ? mine.tier : last ? Math.max(0, Math.min(LB.LEAGUES.length - 1, last.tier + last.move)) : 0;
        S.league = { week: WEEK, tier: tier, entered: !!mine, pts: mine ? mine.pts : 0, timeMs: mine ? mine.timeMs : 0, days: mine ? mine.days : 0,
          rank: L.week === WEEK ? L.rank : 0, total: L.week === WEEK ? L.total : 0, last: last, told: L.told || 0 };
        if (last && S.league.told !== last.week) {
          S.league.told = last.week;
          if (last.move > 0) P.count("promotions");
          leagueNotice(last);
        }
        persist();
        return S.league;
      });
    });
    leagueP.catch(function () { leagueP = null; });
    return leagueP;
  }
  function leagueNotice(last) {
    var from = LB.LEAGUES[last.tier], to = LB.LEAGUES[Math.max(0, Math.min(LB.LEAGUES.length - 1, last.tier + last.move))];
    var place = "You finished <b>#" + last.rank + " of " + last.total + "</b> in the " + from.name + " League last week.";
    notice(last.move > 0 ? { icon: to.icon, eyebrow: "Weekly league", title: "Promoted to " + to.name + "!", text: place + " Welcome to the big leagues.", yes: "Let's go", sound: "levelup" }
      : last.move < 0 ? { icon: to.icon, eyebrow: "Weekly league", title: "Down to " + to.name, text: place + " Play every Daily this week to climb back up.", yes: "Challenge accepted" }
      : { icon: to.icon, eyebrow: "Weekly league", title: "You stay in " + to.name, text: place + " Finish in the top 20% to move up.", yes: "OK" });
  }
  function syncLeague() {
    if (!lbOn() || !S.settings.playerName) return;
    resolveLeague().then(function (L) {
      if (!L) return null;
      return LB.syncLeague({ name: S.settings.playerName, badge: bestBadge(), week: WEEK, tier: L.tier });
    }).then(function (doc) {
      if (!doc) return;
      Object.assign(S.league, { entered: true, pts: doc.pts, timeMs: doc.timeMs, days: doc.days });
      persist();
      return refreshLeague(true);
    }).catch(function (e) { console.warn("[league]", e && e.message); });
  }
  function refreshLeague(force) {
    var L = S.league;
    if (!lbOn() || !L.entered || L.week !== WEEK || (!force && Date.now() - (L.at || 0) < 300000)) { renderLeagueCard(); return Promise.resolve(); }
    return LB.leagueStanding(WEEK, L.tier, L.pts, L.timeMs).then(function (st) {
      L.rank = st.rank; L.total = st.total; L.at = Date.now(); persist(); renderLeagueCard();
    }).catch(function () { /* keep the old numbers */ });
  }
  function renderLeagueCard() {
    var el = $("league-card");
    if (!el) return;
    el.hidden = !lbOn();
    if (el.hidden) return;
    var L = S.league, t = L.week === WEEK ? L.tier : 0, lg = LB.LEAGUES[t], sub;
    $("league-emblem").className = "league-emblem t" + t;
    $("league-emblem").textContent = lg.icon;
    $("league-name").textContent = lg.name + " League";
    if (!S.settings.playerName) sub = "Join the leaderboard to compete every week";
    else if (L.week !== WEEK || !L.entered) sub = "Finish today's Daily to enter this week · " + weekLeft();
    else sub = (L.rank ? "#" + L.rank + " of " + L.total + " · " : "") + L.pts + " caught · " + weekLeft();
    $("league-sub").textContent = sub;
  }
  function loadLeague(tok) {
    var list = $("board-list"), L = S.league, tier = L.week === WEEK ? L.tier : 0, lg = LB.LEAGUES[tier];
    $("board-head").hidden = false;
    $("board-head").innerHTML = '<span class="league-emblem t' + tier + '" aria-hidden="true">' + lg.icon + "</span><span><b>" + lg.name + " League</b>" +
      '<span class="muted small">Week ' + WEEK + " · " + weekLeft() + "</span></span>";
    $("board-note").textContent = "Points are liars caught in this week's Daily Cases. On Monday the top 20% move up a league and the bottom 20% move down.";
    if (!S.settings.playerName) { list.innerHTML = '<li class="board-empty">Join the leaderboard to enter the weekly league.</li>'; renderBoardMe(null); return; }
    list.innerHTML = '<li class="board-empty">Loading...</li>';
    resolveLeague().then(function (R) {
      tier = R ? R.tier : 0;
      return LB.leagueTop(WEEK, tier);
    }).then(function (rows) {
      if (tok !== boardTok) return;
      var me = LB.myId(), tot = Math.max(rows.length, S.league.total || 0);
      var up = tier < LB.LEAGUES.length - 1 ? Math.max(1, Math.round(tot * 0.2)) : 0, down = tier > 0 && tot >= 5 ? Math.floor(tot * 0.2) : 0;
      list.innerHTML = (rows.length ? rows.map(function (r, i) {
        var zone = i < up && r.pts > 0 ? " up" : down && i >= tot - down ? " down" : "";
        return '<li class="board-row' + zone + (r.uid === me ? " me" : "") + '"><span class="b-rank">' + (i + 1) + '</span><span class="b-name">' +
          (r.badge ? '<span class="b-badge" aria-hidden="true">' + esc(r.badge) + "</span>" : "") + esc(r.name) + (r.uid === me ? " <em>(you)</em>" : "") +
          '</span><span class="b-score">' + r.pts + '</span><span class="b-time">' + r.days + "/7 days</span></li>";
      }).join("") : '<li class="board-empty">Nobody in this league has played this week yet. Finish today\'s Daily to take the lead!</li>') +
        (!S.league.entered && rows.length ? '<li class="board-empty">You\'re not in this week\'s league yet. Finish today\'s Daily to enter.</li>' : "");
      renderBoardMe(rows);
    }).catch(function (e) { if (tok === boardTok) list.innerHTML = '<li class="board-empty">' + esc(LB.friendlyError(e)) + "</li>"; });
  }

  /* ---------- friend groups (web) ---------- */
  function loadFriends(tok) {
    var list = $("board-list"), head = $("board-head"), me = $("board-me");
    head.hidden = false;
    $("board-note").textContent = "";
    if (!S.settings.playerName) {
      head.innerHTML = "<span><b>Friend groups</b><span class=\"muted small\">Compare today's results with friends</span></span>";
      list.innerHTML = '<li class="board-empty">Pick a detective name first, then make a group or join one with a code.</li>';
      me.innerHTML = '<button class="btn primary wide" type="button" id="grp-name">Pick a name</button>';
      $("grp-name").addEventListener("click", function () { askName(function () { loadBoard(); }); });
      return;
    }
    if (!S.groups.length) {
      head.innerHTML = "<span><b>Friend groups</b><span class=\"muted small\">Compare today's results with friends</span></span>";
      list.innerHTML = '<li class="board-empty">Make a group for your friends, family or office and share the code. Everyone sees each other\'s Daily results.</li>';
      me.innerHTML = '<button class="btn primary wide" type="button" id="grp-new">Create or join a group</button>';
      $("grp-new").addEventListener("click", openGroupDlg);
      return;
    }
    S.groupSel = Math.min(S.groupSel || 0, S.groups.length - 1);
    var g = S.groups[S.groupSel];
    head.innerHTML = '<div class="grp-chips">' + S.groups.map(function (x, i) {
      return '<button type="button" class="chip-btn' + (i === S.groupSel ? " on" : "") + '" data-grp="' + i + '">' + esc(x.name) + "</button>";
    }).join("") + '<button type="button" class="chip-btn" data-grp="new" aria-label="Create or join another group">+</button></div>';
    $("board-note").textContent = "Daily #" + TODAY + " · group code " + g.code;
    list.innerHTML = '<li class="board-empty">Loading...</li>';
    me.innerHTML = '<div class="row2"><button class="btn primary" type="button" id="grp-invite">Invite friends</button><button class="btn ghost" type="button" id="grp-leave">Leave group</button></div>';
    $("grp-invite").addEventListener("click", function () { Snd.play("click"); inviteGroup(g); });
    $("grp-leave").addEventListener("click", function () { leaveGroup(g); });
    LB.getGroup(g.code).then(function (grp) {
      g.name = grp.name;
      return LB.groupScores(grp.members, TODAY).then(function (sc) { return { grp: grp, sc: sc }; });
    }).then(function (o) {
      if (tok !== boardTok) return;
      var my = LB.myId(), ids = Object.keys(o.grp.members);
      var done = ids.filter(function (u) { return o.sc[u]; }).map(function (u) { return o.sc[u]; })
        .sort(function (a, b) { return b.score - a.score || a.timeMs - b.timeMs; });
      var waiting = ids.filter(function (u) { return !o.sc[u]; });
      list.innerHTML = done.map(function (r, i) {
        return '<li class="board-row' + (r.uid === my ? " me" : "") + '"><span class="b-rank">' + (i + 1) + '</span><span class="b-name">' + esc(r.name) +
          (r.uid === my ? " <em>(you)</em>" : "") + '</span><span class="b-score">' + r.score + '/5</span><span class="b-time">' + WL.fmtTime(r.timeMs) + "</span></li>";
      }).join("") + waiting.map(function (u) {
        return '<li class="board-row waiting"><span class="b-rank">·</span><span class="b-name">' + esc(o.grp.members[u]) + (u === my ? " <em>(you)</em>" : "") +
          '</span><span class="b-score">–</span><span class="b-time">not yet</span></li>';
      }).join("");
      if (ids.length < 2) list.innerHTML += '<li class="board-empty">It\'s just you so far. Tap "Invite friends" and send them the link.</li>';
    }).catch(function (e) {
      if (tok !== boardTok) return;
      if (e && e.code === "not-found") { S.groups.splice(S.groupSel, 1); persist(); loadBoard(); return; }
      list.innerHTML = '<li class="board-empty">' + esc(LB.friendlyError(e)) + "</li>";
    });
  }
  function openGroupDlg() {
    if (!S.settings.playerName) { askName(openGroupDlg); return; }
    $("group-name").value = ""; $("group-code").value = ""; $("group-error").hidden = true;
    openDialog("dlg-group");
  }
  function groupError(msg) { $("group-error").textContent = msg; $("group-error").hidden = false; }
  function addGroup(g) {
    var i = -1;
    S.groups.forEach(function (x, k) { if (x.code === g.code) i = k; });
    if (i < 0) { S.groups.push({ code: g.code, name: g.name }); i = S.groups.length - 1; }
    S.groupSel = i; persist();
  }
  function groupBusy(on) { $("group-create").disabled = on; $("group-join").disabled = on; }
  function inviteGroup(g) {
    WL.track("group_invite", {});
    shareOut("Join my Who's Lying? group “" + g.name + "” and let's compare our daily detective results! 🕵️\n" + Plat.shareLink({ g: g.code }) + "\nGroup code: " + g.code);
  }
  function leaveGroup(g) {
    showNotice({ icon: "👋", title: "Leave " + g.name + "?", text: "You can join again later with the code " + g.code + ".", yes: "Leave", no: "Stay",
      onYes: function () {
        LB.leaveGroup(g.code).then(function () {
          S.groups = S.groups.filter(function (x) { return x.code !== g.code; }); S.groupSel = 0; persist();
          toast("You left " + esc(g.name) + "."); openBoard("friends");
        }).catch(function (e) { toast(esc(LB.friendlyError(e))); openBoard("friends"); });
      },
      onNo: function () { openBoard("friends"); } });
  }
  function joinGroupFlow(code) {
    if (!S.settings.playerName) { askName(function () { joinGroupFlow(code); }); return; }
    if (S.groups.length >= 5 && !S.groups.some(function (x) { return x.code === code; })) { toast("You can be in 5 groups. Leave one first."); return; }
    return LB.joinGroup(code, S.settings.playerName).then(function (g) {
      addGroup({ code: code, name: g.name });
      WL.track("group_join", {});
      toast("You joined " + esc(g.name) + "!", "gold");
      closeDialog("dlg-group");
      openBoard("friends");
    });
  }
  if ($("dlg-group")) {
    $("group-create").addEventListener("click", function () {
      var r = LB.cleanGroupName($("group-name").value);
      if (!r.ok) return groupError(r.msg);
      if (S.groups.length >= 5) return groupError("You can be in 5 groups. Leave one first.");
      groupBusy(true);
      LB.createGroup(r.name, S.settings.playerName).then(function (g) {
        addGroup(g);
        WL.track("group_create", {});
        closeDialog("dlg-group");
        toast("Group created! Code: " + g.code, "gold");
        openBoard("friends");
        inviteGroup(g);
      }).catch(function (e) { groupError(LB.friendlyError(e)); }).then(function () { groupBusy(false); });
    });
    $("group-join").addEventListener("click", function () {
      var code = LB.cleanCode($("group-code").value);
      if (!code) return groupError("Group codes have 6 letters and numbers, like ABC234.");
      groupBusy(true);
      (joinGroupFlow(code) || Promise.resolve()).catch(function (e) { groupError(LB.friendlyError(e)); }).then(function () { groupBusy(false); });
    });
    $("board-head").addEventListener("click", function (e) {
      var b = e.target.closest("[data-grp]");
      if (!b) return;
      Snd.play("click");
      if (b.dataset.grp === "new") { closeDialog("dlg-board"); openGroupDlg(); return; }
      S.groupSel = +b.dataset.grp; persist(); loadBoard();
    });
  }
  function handleGroupInvite(code) {
    LB.getGroup(code).then(function (g) {
      if (S.groups.some(function (x) { return x.code === code; })) { openBoard("friends"); return; }
      var n = Object.keys(g.members).length;
      notice({ icon: "👥", eyebrow: "Friend group", title: "Join “" + g.name + "”?", yes: "Join the group", no: "Not now",
        text: n + " detective" + (n > 1 ? "s" : "") + " already compare their Daily results here. Join to see how you stack up every day.",
        onYes: function () { var p = joinGroupFlow(code); if (p) p.catch(function (e) { toast(esc(LB.friendlyError(e))); }); } });
    }).catch(function () { toast("That group link doesn't work any more."); });
  }

  /* ---------- case files: past Dailies, catch up with Case Keys ---------- */
  var filesUntil = 1;
  function openFiles() {
    show("files");
    setHud("Case files", "Every Daily so far");
    filesUntil = Math.max(1, TODAY - 13);
    renderFiles();
  }
  function renderFiles() {
    var keys = S.inv.key || 0;
    $("files-keys").innerHTML = '<span class="key-ico" aria-hidden="true">🔑</span><span>You have <b>' + keys + " Case Key" + (keys === 1 ? "" : "s") +
      "</b>. A key opens a missed day with full rewards" + (WDAY < 6 ? " and its clue for the Case of the Week" : "") + ". Earn one every 7 days in a row, or buy them in the Shop.</span>";
    var h = "";
    for (var d = TODAY; d >= filesUntil; d--) {
      var hist = S.history[d], played = hist && !hist.replay, today = d === TODAY, prog = today && S.daily && S.daily.day === TODAY ? S.daily : null;
      var date = dayName(d) + ", " + WL.formatDate(WL.dateForDay(d), "short"), status, acts;
      if (played) {
        status = '<span class="res-grid small">' + cells(hist.grid.split(""), 5) + "</span><span>" + hist.score + "/5" + (hist.catchup ? " · catch-up" : "") + "</span>";
        acts = today ? '<button class="btn small ghost" type="button" data-play="' + d + '">Result</button>'
          : '<button class="btn small ghost" type="button" data-practice="' + d + '">Practice</button>';
      } else if (today) {
        status = prog && prog.results.length ? "Case " + (prog.results.length + 1) + " of 5" : "New today";
        acts = '<button class="btn small danger" type="button" data-play="' + d + '">' + (prog && prog.results.length ? "Continue" : "Play") + "</button>";
      } else if (S.unlocked[d]) {
        status = "Unlocked";
        acts = '<button class="btn small primary" type="button" data-play="' + d + '">Continue</button>';
      } else {
        status = '<span class="muted">Missed</span>';
        acts = '<button class="btn small primary" type="button" data-unlock="' + d + '">Catch up · 🔑</button>' +
          '<button class="link-btn" type="button" data-practice="' + d + '">Practice</button>';
      }
      h += '<li class="file' + (played ? " played" : today ? " today" : S.unlocked[d] ? " open" : " missed") + '"><div class="file-head"><b>Daily #' + d + "</b>" +
        '<span class="muted small">' + date + '</span></div><div class="file-status">' + status + '</div><div class="file-acts">' + acts + "</div></li>";
    }
    $("files-list").innerHTML = h;
    $("files-more").hidden = filesUntil <= 1;
  }
  function unlockDay(d) {
    if ((S.inv.key || 0) < 1) {
      showNotice({ icon: "🔑", title: "No Case Keys left", text: "You get a key every 7 days in a row, on day 7 of the login calendar, or in the Shop.", yes: "Go to the Shop", no: "Close", onYes: function () { openShop(false); } });
      return;
    }
    P.useItem("key");
    S.unlocked[d] = true; persist();
    Snd.play("buy");
    WL.track("catchup_unlock", { day: d, ago: TODAY - d });
    startDaily(d);
  }
  $("files-list").addEventListener("click", function (e) {
    var b = e.target.closest("[data-play],[data-practice],[data-unlock]");
    if (!b) return;
    Snd.play("click");
    if (b.dataset.unlock) unlockDay(+b.dataset.unlock);
    else if (b.dataset.practice) { S.replay = null; persist(); startDaily(+b.dataset.practice, "practice"); }
    else startDaily(+b.dataset.play);
  });
  $("files-more").addEventListener("click", function () { filesUntil = Math.max(1, filesUntil - 14); renderFiles(); });

  /* ---------- Case of the Week board ---------- */
  var accusing = false;
  function openWeek() {
    show("week");
    setHud("Case of the Week", "Week " + WEEK + " · " + weekLeftText());
    accusing = false;
    renderWeek();
  }
  function weekLeftText() { return WDAY === 6 ? "last day" : (7 - WDAY) + " days left"; }
  function renderWeek() {
    var k = WL.buildWeek(WEEK), a = S.arc, n = cluesOpen();
    $("wk-eyebrow").textContent = "Case of the Week · " + (a.done ? "closed" : WDAY === 6 ? "name the mastermind today" : "solve it on Sunday");
    $("wk-title").textContent = k.title;
    $("wk-setup").textContent = k.setup;
    $("wk-count").textContent = n + " of 6 found";
    $("wk-clues").innerHTML = k.clues.map(function (c, i) {
      var d = weekDay(i), day = DAY_NAMES[i].slice(0, 3);
      if (clueOpen(i) || a.done) return '<li class="wk-clue open"><span class="wk-day">' + day + "</span><span>" + esc(c.text) + "</span></li>";
      var why, acts = "";
      if (d < TODAY) {
        why = "You missed " + DAY_NAMES[i] + "'s Daily.";
        acts = '<button class="btn small primary" type="button" data-wk-key="' + d + '">Catch up · 🔑</button>' +
          '<button class="btn small ghost" type="button" data-wk-buy="' + i + '">Buy ' + COIN_SVG + CLUE_COST + "</button>";
      } else if (d === TODAY) {
        why = "Finish today's Daily to get this clue.";
        acts = '<button class="btn small danger" type="button" data-wk-today="1">Play today</button>';
      } else why = "Comes with " + DAY_NAMES[i] + "'s Daily.";
      return '<li class="wk-clue locked"><span class="wk-day">' + day + '</span><span class="wk-why">' + why + "</span>" + (acts ? '<span class="wk-acts">' + acts + "</span>" : "") + "</li>";
    }).join("");
    $("wk-suspects").innerHTML = k.suspects.map(function (s, i) {
      var cls = "wk-sus" + (a.crossed[i] ? " crossed" : "") + (a.done && i === k.answer ? " culprit" : "") + (a.done && a.pick === i && !a.correct ? " wrong" : "");
      return '<button type="button" class="' + cls + '" data-sus="' + i + '" aria-pressed="' + (a.crossed[i] ? "true" : "false") + '"' + (a.done ? " disabled" : "") + ">" +
        '<span class="mug">' + WL.avatar(s.name) + '</span><span class="wk-who"><b>' + esc(s.name) + '</b><span class="muted small">' + esc(s.role) + "</span>" +
        '<span class="wk-traits">' + s.traits.map(function (t) { return "<span>" + esc(t) + "</span>"; }).join("") + "</span></span>" +
        (a.done && i === k.answer ? '<span class="stamp">' + (a.correct ? "Caught" : "Escaped") + "</span>" : "") + "</button>";
    }).join("");
    var st;
    if (a.done) st = '<div class="wk-verdict ' + (a.correct ? "good" : "bad") + '"><b>' + (a.correct ? "Mastermind caught!" : "The mastermind got away.") + "</b><p>" + esc(k.why) + "</p><p class=\"muted small\">A new Case of the Week starts on Monday.</p></div>";
    else if (WDAY === 6 && accusing) st = '<p><b>Tap the mastermind.</b> You get one try.</p><button class="btn ghost small" type="button" data-wk-cancel="1">Cancel</button>';
    else if (WDAY === 6) st = "<p>" + (n < 6 ? "You have <b>" + n + " of 6 clues</b>. With clues missing it's a guess, so catch up or buy them first." : "You have <b>every clue</b>. Only one suspect fits them all.") +
      '</p><button class="btn danger wide" type="button" data-wk-accuse="1">Name the mastermind</button>';
    else st = "<p>Every Daily you finish from Monday to Saturday adds a clue. On <b>Sunday</b>, name the mastermind (one try). Tap suspects to cross them out as the clues rule them out.</p>";
    $("wk-status").innerHTML = st;
    $("wk-tip").textContent = a.done ? "" : accusing ? "Tap the mastermind" : "Tap a suspect to cross them out";
    $("scr-week").classList.toggle("accusing", accusing);
  }
  function accuseMastermind(i) {
    var k = WL.buildWeek(WEEK), correct = i === k.answer;
    S.arc.done = true; S.arc.correct = correct; S.arc.pick = i;
    var r = P.mastermindDone(correct);
    persist();
    accusing = false;
    renderWeek();
    Snd.play("stamp");
    setTimeout(function () { Snd.play(correct ? "fanfare" : "fail"); }, 200);
    if (correct) { FX.confetti({ count: 150 }); Plat.happytime(); }
    FX.float("+" + r.coins, $("coins"), "coin");
    renderCoins(true);
    toast((correct ? "Mastermind caught! " : "Wrong suspect. ") + "+" + r.coins + " coins, +" + r.xp + " XP", correct ? "gold" : "");
    WL.track("mastermind", { correct: correct, clues: cluesOpen() });
    setTimeout(flushQueue, 1500);
  }
  $("scr-week").addEventListener("click", function (e) {
    var b = e.target.closest("[data-sus],[data-wk-key],[data-wk-buy],[data-wk-today],[data-wk-accuse],[data-wk-cancel]");
    if (!b || b.disabled) return;
    var a = S.arc;
    if (b.dataset.sus != null) {
      var i = +b.dataset.sus, s = WL.buildWeek(WEEK).suspects[i];
      if (accusing) {
        showNotice({ icon: "★", title: "Accuse " + s.name + "?", text: "You get one try. If you're wrong, the mastermind gets away.", yes: "Accuse " + s.name, no: "Not yet",
          onYes: function () { accuseMastermind(i); } });
        return;
      }
      a.crossed[i] = !a.crossed[i]; persist();
      Snd.play("tap");
      renderWeek();
      return;
    }
    Snd.play("click");
    if (b.dataset.wkKey) unlockDay(+b.dataset.wkKey);
    else if (b.dataset.wkBuy) {
      if (S.coins < CLUE_COST) { toast("You need " + (CLUE_COST - S.coins) + " more coins."); return; }
      P.addCoins(-CLUE_COST); a.bought[+b.dataset.wkBuy] = true; persist();
      Snd.play("buy"); renderCoins(true); renderWeek();
    } else if (b.dataset.wkToday) startDaily(TODAY);
    else if (b.dataset.wkAccuse) { accusing = true; renderWeek(); }
    else if (b.dataset.wkCancel) { accusing = false; renderWeek(); }
  });

  /* ---------- daily reminder (calendar event, web) ---------- */
  function pad2(n) { return String(n).padStart(2, "0"); }
  function calDate(d) { return d.getFullYear() + pad2(d.getMonth() + 1) + pad2(d.getDate()) + "T" + pad2(d.getHours()) + pad2(d.getMinutes()) + "00"; }
  function remStart() {
    var t = ($("rem-time").value || "09:00").split(":"), d = new Date();
    d.setDate(d.getDate() + 1); d.setHours(+t[0] || 0, +t[1] || 0, 0, 0);
    return d;
  }
  function remUrl() { return cloudOn() && S.sync.code ? restoreLink() : Plat.shareLink({}); }
  function openReminder() {
    if (!$("dlg-reminder")) return;
    updateRemLink();
    openDialog("dlg-reminder");
  }
  function updateRemLink() {
    var d = remStart(), end = new Date(d.getTime() + 5 * 60000), url = remUrl(), tz = "";
    try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch (e) { /* ignore */ }
    $("rem-google").href = "https://calendar.google.com/calendar/render?action=TEMPLATE&text=" + encodeURIComponent("🕵️ New Who's Lying? cases") +
      "&details=" + encodeURIComponent("5 new cases are waiting. Keep your streak alive: " + url) +
      "&dates=" + calDate(d) + "/" + calDate(end) + "&recur=" + encodeURIComponent("RRULE:FREQ=DAILY") + (tz ? "&ctz=" + encodeURIComponent(tz) : "");
  }
  function downloadIcs() {
    var d = remStart(), url = remUrl(), now = new Date();
    var ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Who's Lying//Daily reminder//EN", "CALSCALE:GREGORIAN", "BEGIN:VEVENT",
      "UID:whoslying-" + now.getTime() + "@whoslying", "DTSTAMP:" + now.toISOString().replace(/[-:]/g, "").replace(/\.\d+/, ""),
      "DTSTART:" + calDate(d), "DURATION:PT5M", "RRULE:FREQ=DAILY", "SUMMARY:🕵️ New Who's Lying? cases",
      "DESCRIPTION:5 new cases are waiting. Keep your streak alive: " + url, "URL:" + url,
      "BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:New Who's Lying? cases", "TRIGGER:PT0M", "END:VALARM", "END:VEVENT", "END:VCALENDAR"].join("\r\n");
    var a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
    a.download = "whos-lying-reminder.ics";
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
    reminderSet("ics");
  }
  function reminderSet(how) {
    S.pwa.reminder = true; persist();
    WL.track("reminder_set", { how: how });
    closeDialog("dlg-reminder");
    toast("Reminder added. See you tomorrow, detective!", "gold");
    if (screen === "hq") renderBanner();
  }
  if ($("dlg-reminder")) {
    $("rem-time").addEventListener("change", updateRemLink);
    $("rem-google").addEventListener("click", function () { updateRemLink(); reminderSet("google"); });
    $("rem-ics").addEventListener("click", downloadIcs);
    $("btn-reminder").addEventListener("click", function () { closeDialog("dlg-settings"); openReminder(); });
    $("btn-install").addEventListener("click", function () { closeDialog("dlg-settings"); install(); });
  }

  /* ---------- install as an app + offline (web) ---------- */
  var installEvt = null;
  function standalone() { return (window.matchMedia && matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true; }
  function isIOS() { return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1); }
  function canInstall() { return web() && !standalone() && (!!installEvt || isIOS()); }
  function install() {
    if (installEvt) {
      installEvt.prompt();
      installEvt.userChoice.then(function (c) { WL.track("install_prompt", { outcome: c && c.outcome }); installEvt = null; if (screen === "hq") renderBanner(); });
      return;
    }
    if (isIOS()) {
      var code = cloudOn() && S.sync.code;
      showNotice({ icon: "📲", title: "Add it to your Home Screen",
        text: "In Safari, tap the <b>Share</b> button at the bottom of the screen, then <b>Add to Home Screen</b>." +
          (code ? "<br><br>On iPhone the app starts empty, so copy your save code now, then tap <b>Restore</b> in the app: <b>" + fmtCode(S.sync.code) + "</b>" : ""),
        yes: code ? "Copy my save code" : "Got it", onYes: function () { if (code) copyText(fmtCode(S.sync.code), "Save code copied. Paste it into Restore in the app."); } });
    }
  }
  if ($("btn-install") && isIOS() && !standalone()) $("btn-install").hidden = false;
  if (web()) {
    window.addEventListener("beforeinstallprompt", function (e) { e.preventDefault(); installEvt = e; if ($("btn-install")) $("btn-install").hidden = false; if (screen === "hq") renderBanner(); });
    window.addEventListener("appinstalled", function () { installEvt = null; WL.track("app_installed", {}); if (screen === "hq") renderBanner(); });
    if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
      window.addEventListener("load", function () { navigator.serviceWorker.register("sw.js").catch(function () { /* offline play is a bonus */ }); });
    }
  }
  $("hq-banner").addEventListener("click", function (e) {
    var b = e.target.closest("[data-banner]");
    if (!b) return;
    Snd.play("click");
    var k = b.dataset.banner;
    if (k === "install") install();
    else if (k === "reminder") openReminder();
    else if (k === "restore") openRestore();
    else if (k === "x-restore") { S.pwa.noRestore = true; persist(); renderBanner(); }
    else if (k === "x-install") { S.pwa.noInstall = true; persist(); renderBanner(); }
    else if (k === "x-reminder") { S.pwa.noReminder = true; persist(); renderBanner(); }
  });

  /* ---------- cloud save (web) ----------
     Progress is backed up online under a private 12-letter save code. The code (or a restore
     link) brings it to a new phone, browser, iPhone home-screen app or web address. A device
     with the same code takes the newest progress when it starts. XP can't go down in the cloud,
     so the copy with the most progress always wins. CrazyGames saves through its own SDK. */
  function cloudOn() { return lbOn() && LB.provider === "firebase"; }
  function fmtCode(c) { return c ? c.slice(0, 4) + "-" + c.slice(4, 8) + "-" + c.slice(8) : ""; }
  function restoreLink() { return Plat.shareLink({ restore: S.sync.code }); }
  function cloudDirty() {
    if (!S || !S.sync) return;
    S.sync.dirty = true;
    if (!cloudOn() || S.tot.solved < 1 || cloud.timer) return;
    // ponytail: at most one background backup every 2 minutes; HQ, results and leaving the app back up at once
    cloud.timer = setTimeout(function () { cloud.timer = 0; cloudPush(); }, Math.max(5000, 120000 - (Date.now() - cloud.last)));
  }
  function cloudFlush() {
    if (!S || !S.sync || !S.sync.dirty) return;
    clearTimeout(cloud.timer); cloud.timer = 0;
    cloudPush();
  }
  function cloudPush() {
    if (!cloudOn() || !S.sync.dirty || cloud.busy || cloud.gone || S.tot.solved < 1) return Promise.resolve(false);
    if (!S.sync.code) S.sync.code = LB.newSaveCode();
    cloud.busy = true;
    S.sync.dirty = false; S.sync.stamp = Date.now();
    return LB.pushSave(S.sync.code, JSON.stringify(S), S.xp || 0, S.sync.stamp).then(function () {
      cloud.last = Date.now(); Plat.save(S); return true;
    }, function (e) {
      S.sync.dirty = true;
      if (e && e.code === "permission-denied") cloud.behind = true; // another device has more progress
      return false;
    }).then(function (ok) {
      cloud.busy = false;
      if (cloud.behind && screen === "hq" && !run) { cloud.behind = false; cloudPull(S.sync.code, "sync"); }
      return ok;
    });
  }
  function summaryOf(x) {
    var li = P.levelInfo(x.xp || 0), st = x.stats || {}, streak = st.lastDay >= TODAY - 1 ? st.streak || 0 : 0;
    return "Level " + li.level + (streak ? " · " + streak + "-day streak" : "") + " · " + FX.fmt(x.coins || 0) + " coins";
  }
  // mode "sync": our own code; take the cloud copy if another device got further.
  // mode "restore": a typed code or a restore link; ask first unless this device is new.
  function cloudPull(code, mode) {
    return LB.pullSave(code).then(function (doc) {
      if (!doc) { if (mode === "restore") restoreFailed("We couldn't find saved progress for that code. Check it and try again."); return; }
      var data;
      try { data = JSON.parse(doc.data); } catch (e) { return; }
      if (mode === "sync") {
        if (doc.xp > (S.xp || 0) || (doc.xp === (S.xp || 0) && doc.stamp > (S.sync.stamp || 0) + 1000)) useSave(data, code, "Your progress from your other device is here.");
        return;
      }
      closeDialog("dlg-restore");
      if (S.tot.solved <= 2 && !S.stats.played && !S.noAutoRestore) { useSave(data, code, "Progress restored. Welcome back, detective!"); return; }
      showNotice({ icon: "☁️", title: "Restore your saved progress?",
        text: "<b>Saved progress:</b> " + esc(summaryOf(data)) + "<br><b>This device:</b> " + esc(summaryOf(S)) + "<br>Restoring replaces what's on this device.",
        yes: "Restore", no: "Keep this device", onYes: function () { useSave(data, code, "Progress restored."); } });
    }).catch(function (e) { if (mode === "restore") restoreFailed(LB.friendlyError(e)); });
  }
  // Swap in a saved copy and restart the game with it.
  function useSave(data, code, note) {
    cloud.gone = true; clearTimeout(cloud.timer);
    data.sync = Object.assign({}, data.sync || {}, { code: code, dirty: false, note: note });
    Plat.save(data, true);
    WL.track("progress_restored", {});
    var q = bootSearch.replace(/([?&])restore=[^&]*&?/, "$1").replace(/[?&]$/, "");
    location.replace(location.pathname + q + location.hash);
  }
  function openRestore() {
    if (!$("dlg-restore")) return;
    $("restore-code").value = ""; $("restore-error").hidden = true; $("restore-go").disabled = false;
    openDialog("dlg-restore");
  }
  function restoreFailed(msg) {
    if ($("dlg-restore") && $("dlg-restore").open) { $("restore-error").textContent = msg; $("restore-error").hidden = false; $("restore-go").disabled = false; }
    else toast(esc(msg));
  }
  function sendSaveLink() {
    WL.track("save_link_shared", {});
    shareOut("My Who's Lying? save link. Open it on any phone or browser to continue my progress (keep it private):\n" + restoreLink() +
      "\nSave code: " + fmtCode(S.sync.code), "Copied. Keep it somewhere safe, like a note or a message to yourself.");
  }
  function saveTip() {
    return { icon: "☁️", eyebrow: "Your progress is safe", title: "Keep your save code",
      text: "Your progress is backed up online. New phone, new browser or cleared data? This code brings everything back:",
      html: '<p class="save-code big">' + fmtCode(S.sync.code) + "</p>", yes: "Send it to myself", no: "Later", onYes: sendSaveLink };
  }
  if ($("cloud-box")) {
    $("btn-save-send").addEventListener("click", function () { Snd.play("click"); sendSaveLink(); });
    $("btn-save-copy").addEventListener("click", function () { Snd.play("click"); copyText(fmtCode(S.sync.code), "Save code copied. Keep it somewhere safe."); });
    $("btn-restore").addEventListener("click", function () { Snd.play("click"); closeDialog("dlg-settings"); openRestore(); });
    $("restore-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var code = LB.cleanSaveCode($("restore-code").value);
      if (!code) return restoreFailed("Save codes have 12 letters and numbers, like ABCD-EFGH-JKMN.");
      if (code === S.sync.code) return restoreFailed("That's this device's own save code. Enter the code from your other device.");
      $("restore-go").disabled = true;
      cloudPull(code, "restore");
    });
  }
  // Moving to a new web address (config movedTo): back up this browser's progress first,
  // then open the new address with the restore code, so nobody starts again from zero.
  function moveAway() {
    var to = CFG.movedTo;
    if (!to || !web()) return false;
    try { if (new URL(to, location.href).origin === location.origin) return false; } catch (e) { return false; }
    var note = document.createElement("p");
    note.className = "boot-note"; note.textContent = "We've moved! Bringing your progress along...";
    $("boot").appendChild(note);
    var go = function () {
      var q = bootSearch.replace(/^\?/, "").split("&").filter(function (x) { return x && !/^restore=/.test(x); });
      if (S.sync.code && S.tot.solved > 0) q.unshift("restore=" + S.sync.code);
      location.replace(to.replace(/\/$/, "") + "/" + (q.length ? "?" + q.join("&") : "") + location.hash);
    };
    if (!cloudOn() || S.tot.solved < 1) { go(); return true; }
    S.sync.dirty = true;
    var tries = 0;
    (function attempt() { cloudPush().then(function (ok) { if (ok || ++tries >= 3) go(); else setTimeout(attempt, 1500); }); })();
    return true;
  }

  /* ---------- start-up checks: streak shields and comeback gift ---------- */
  function startupChecks() {
    var away = S.lastSeen ? TODAY - S.lastSeen : 0;
    if (away >= 3 && S.tot.solved > 0) {
      var g = P.comeback();
      notice({ icon: "🕵️", eyebrow: "Welcome back", title: "We missed you, detective!", sound: "fanfare",
        text: "You've been away for " + away + " days. Here's a care package to get you back on the case:", html: rewardList(g),
        yes: "Play today's cases", no: "Later", onYes: function () { startDaily(TODAY); } });
      WL.track("comeback", { days: away });
    }
    var saved = P.coverStreak(TODAY);
    if (saved) {
      notice({ icon: "🛡️", title: "Streak saved!", sound: "achieve",
        text: "You missed " + (saved.used > 1 ? saved.used + " days" : "a day") + ", so " + (saved.used > 1 ? saved.used + " Streak Shields" : "a Streak Shield") +
          " kept your <b>" + saved.streak + "-day streak</b> alive. Play today to keep it going!",
        yes: "Play today's cases", no: "Later", onYes: function () { startDaily(TODAY); } });
      WL.track("shield_used", { days: saved.used });
    }
    S.lastSeen = TODAY;
  }

  /* ---------- wiring ---------- */
  $("brand").addEventListener("click", function () { Snd.play("click"); goHQ(); });
  $("btn-home").addEventListener("click", function () { Snd.play("click"); goHQ(); });
  $("coins").addEventListener("click", function () { Snd.play("click"); if (screen === "case") return toast("Finish this case first, then open the Shop."); openShop(false); });
  $("btn-play").addEventListener("click", function () { Snd.play("click"); startCareer(); });
  $("btn-map").addEventListener("click", function () { Snd.play("click"); openMap(); });
  $("btn-daily").addEventListener("click", function () { Snd.play("click"); startDaily(TODAY); });
  $("btn-week").addEventListener("click", function () { Snd.play("click"); openWeek(); });
  $("tile-night").addEventListener("click", function () { Snd.play("click"); startNight(); });
  $("streak-chip").addEventListener("click", function () { Snd.play("click"); streakInfo(); });
  $("btn-files").addEventListener("click", function () { Snd.play("click"); openFiles(); });
  $("btn-friends").addEventListener("click", function () { Snd.play("click"); openBoard("friends"); });
  if ($("league-card")) $("league-card").addEventListener("click", function () { Snd.play("click"); openBoard("league"); });
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
      else if (new Date().getSeconds() === 0) { renderHQ(); refreshLeague(false); }
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
    S.unlocked = S.unlocked || {};   // past days opened with a Case Key
    S.catchups = S.catchups || {};   // progress on those days
    S.night = S.night || {};
    if (!S.arc || S.arc.week !== WEEK) S.arc = { week: WEEK, bought: {}, crossed: {}, done: false, correct: false, pick: -1 };
    S.league = Object.assign({ week: 0, tier: 0, entered: false }, S.league || {});
    S.groups = S.groups || [];
    S.pwa = S.pwa || {};
    S.sync = Object.assign({ code: "", dirty: false, stamp: 0 }, S.sync || {});
    if (S.challenge && S.challenge.day < TODAY - 7) S.challenge = null;
    P.init(S, hooks);
    // Old saves (before career mode) skip the tutorial.
    if ((S.stats.played > 0 || S.endless.runs > 0) && !S.settings.tutorialDone) S.settings.tutorialDone = true;
    applyTheme();
    Snd.init({ sound: S.settings.sound, music: S.settings.music });
    shownCoins = S.coins;
  }
  function route() {
    var rc = cloudOn() ? LB.cleanSaveCode(Plat.inviteParam("restore")) : "";
    if (rc && rc !== S.sync.code) { goHQ(); toast("Looking for your saved progress..."); cloudPull(rc, "restore"); return; }
    var ch = parseChallenge(Plat.inviteParam("c"));
    if (ch) { handleChallenge(ch); goHQ(); return; }
    var grp = lbOn() ? LB.cleanCode(Plat.inviteParam("g")) : "";
    if (grp) { goHQ(); handleGroupInvite(grp); return; }
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
      if (moveAway()) return;
      Plat.loadingStop();
      document.body.classList.remove("booting");
      startupChecks();
      route();
      if (S.sync.note) { var note = S.sync.note; delete S.sync.note; setTimeout(function () { toast(esc(note), "gold", 3800); }, 700); }
      // Another device with the same save code may be further ahead: take its progress first, then back up.
      if (cloudOn() && S.sync.code) { cloud.busy = true; cloudPull(S.sync.code, "sync").then(function () { cloud.busy = false; cloudFlush(); }); }
      if (lbOn()) {
        setTimeout(checkRewards, 1500);
        if (S.settings.playerName) resolveLeague().then(function () { return refreshLeague(true); }).catch(function () { /* offline */ });
      }
      persist();
    }).catch(function (e) {
      console.error(e);
      document.body.classList.remove("booting");
    });
  }
  // Test hook for automated checks (only with ?test=1 in the address).
  if (/[?&]test=1/.test(location.search)) window.__WLtest = {
    run: function () { return run; }, state: function () { return S; }, persist: persist,
    hq: goHQ, career: startCareer, rush: startRush, daily: startDaily, night: startNight, week: openWeek, files: openFiles,
    cloud: function () { return cloud; }, push: function () { S.sync.dirty = true; return cloudPush(); }
  };
  boot();
})();
