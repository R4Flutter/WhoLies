/*
  WHO'S LYING? — game screen logic
  Daily mode: 5 cases, same for everyone, one try each, streaks and share grid.
  Endless mode: unlimited generated cases, a timer, 3 lives, one second chance.
*/
(function () {
  "use strict";
  var WL = window.WL, Ads = window.WLAds, CFG = WL.cfg;
  var esc = WL.esc;
  function $(id) { return document.getElementById(id); }
  var TODAY = WL.dayNumber();
  var mq = function (q) { return window.matchMedia ? window.matchMedia(q) : { matches: false, addEventListener: function () {} }; };
  var reduceMotion = mq("(prefers-reduced-motion: reduce)").matches;
  var coarse = mq("(pointer: coarse)").matches;
  var GRID = { g: "🟩", y: "🟨", r: "🟥" };
  var LEVEL = { easy: "Easy case", medium: "Medium case", hard: "Hard case", twist: "Twist case" };
  var TITLES = ["Every liar walked free.", "Rough day at the office.", "The liars won this round.", "Not bad, detective.", "Sharp eyes.", "Perfect. Nobody fooled you."];

  /* ---------- saved state ---------- */
  var S = WL.load();
  S.stats = Object.assign({ played: 0, streak: 0, maxStreak: 0, lastDay: 0, perfect: 0, dist: [0, 0, 0, 0, 0, 0] }, S.stats || {});
  S.history = S.history || {};
  S.endless = Object.assign({ best: 0, runs: 0 }, S.endless || {});
  S.settings = Object.assign({ sound: true, music: true, seenTip: false, playerName: "" }, S.settings || {});
  S.lb = Object.assign({ posted: {}, claimed: {}, badges: [], freeHints: 0, ranks: {} }, S.lb || {});
  function persist() { WL.save(S); }
  function currentStreak() { return S.stats.lastDay >= TODAY - 1 ? S.stats.streak : 0; }
  function scoreOf(results) { return results.filter(function (r) { return r !== "r"; }).length; }
  function cells(results, total) {
    var out = "";
    for (var i = 0; i < (total || results.length); i++) out += '<span class="cell-' + (results[i] || "n") + '"></span>';
    return out;
  }

  /* ---------- sound: effects + background music ----------
     Files live in assets/audio/. If a file is missing or can't load, a small
     built-in synth sound plays instead, so the game never goes silent. */
  var ACFG = CFG.audio || {};
  var SFX = { tap: 0.5, stamp: 0.85, correct: 0.42, wrong: 0.45, tick: 0.55, timeout: 0.42, twist: 0.6, fanfare: 0.6, fail: 0.55, whoosh: 0.6 };
  var Sound = {
    ctx: null, on: S.settings.sound, musicOn: S.settings.music, buffers: {}, loaded: false,
    sfxGain: null, musicGain: null,
    music: { buf: null, offset: 0, sources: [], timer: 0, next: 0, loading: false, playing: false },
    ensure: function () {
      if (!this.ctx) {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        try { this.ctx = new AC(); } catch (e) { return null; }
        this.sfxGain = this.ctx.createGain(); this.sfxGain.gain.value = ACFG.sfxVolume == null ? 0.9 : ACFG.sfxVolume;
        this.musicGain = this.ctx.createGain(); this.musicGain.gain.value = ACFG.musicVolume == null ? 0.32 : ACFG.musicVolume;
        this.sfxGain.connect(this.ctx.destination); this.musicGain.connect(this.ctx.destination);
      }
      if (this.ctx.state === "suspended" && !paused.ad && !document.hidden) this.ctx.resume();
      if (!this.loaded) this.loadAll();
      return this.ctx;
    },
    decode: function (ab) {
      var c = this.ctx;
      return new Promise(function (res, rej) {
        var p = c.decodeAudioData(ab, res, rej);
        if (p && p.then) p.then(res, rej);
      });
    },
    fetchBuf: function (name) {
      var self = this;
      return fetch("assets/audio/" + name + ".mp3").then(function (r) {
        if (!r.ok) throw new Error(r.status);
        return r.arrayBuffer();
      }).then(function (ab) { return self.decode(ab); });
    },
    loadAll: function () {
      this.loaded = true;
      var self = this;
      Object.keys(SFX).forEach(function (n) {
        self.fetchBuf(n).then(function (b) { self.buffers[n] = b; }, function () { /* keep synth fallback */ });
      });
    },
    play: function (name) {
      if (!this.on || !this.ensure()) return;
      var b = this.buffers[name];
      try {
        if (b) {
          var s = this.ctx.createBufferSource(), g = this.ctx.createGain();
          s.buffer = b; g.gain.value = SFX[name] || 0.6;
          s.connect(g); g.connect(this.sfxGain); s.start();
          if (name === "fanfare" || name === "fail" || name === "twist") this.duck(b.duration);
        } else this.synth(name);
      } catch (e) { /* audio not available */ }
    },
    tone: function (f, dur, type, vol, delay, slide) {
      var c = this.ctx, t = c.currentTime + (delay || 0);
      var o = c.createOscillator(), g = c.createGain();
      o.type = type || "sine"; o.frequency.setValueAtTime(f, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(this.sfxGain); o.start(t); o.stop(t + dur + 0.02);
    },
    thud: function () {
      var c = this.ctx, len = Math.floor(c.sampleRate * 0.12), buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
      for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
      var s = c.createBufferSource(), g = c.createGain(), f = c.createBiquadFilter();
      f.type = "lowpass"; f.frequency.value = 900; g.gain.value = 0.5;
      s.buffer = buf; s.connect(f); f.connect(g); g.connect(this.sfxGain); s.start();
      this.tone(95, 0.16, "sine", 0.35);
    },
    synth: function (name) {
      if (name === "tap") this.tone(620, 0.05, "triangle", 0.05);
      else if (name === "stamp" || name === "twist") this.thud();
      else if (name === "correct" || name === "fanfare") { this.tone(523, 0.12, "triangle", 0.12); this.tone(784, 0.2, "triangle", 0.12, 0.1); }
      else if (name === "wrong" || name === "fail" || name === "timeout") this.tone(190, 0.32, "sawtooth", 0.07, 0, 110);
      else if (name === "tick") this.tone(1150, 0.03, "square", 0.025);
    },
    duck: function (sec) {
      if (!this.musicGain) return;
      var g = this.musicGain.gain, t = this.ctx.currentTime, v = ACFG.musicVolume == null ? 0.32 : ACFG.musicVolume;
      g.cancelScheduledValues(t); g.setValueAtTime(g.value, t);
      g.linearRampToValueAtTime(v * 0.35, t + 0.15);
      g.setValueAtTime(v * 0.35, t + Math.max(0.3, sec - 0.4));
      g.linearRampToValueAtTime(v, t + sec + 0.4);
    },
    startMusic: function () {
      var m = this.music, self = this;
      if (!this.musicOn || m.playing || !this.ensure()) return;
      m.playing = true;
      if (m.buf) { this.scheduleMusic(true); return; }
      if (m.loading) return;
      m.loading = true;
      this.fetchBuf("music").then(function (b) {
        m.loading = false; m.buf = b;
        var d = b.getChannelData(0), lim = Math.min(d.length, Math.floor(b.sampleRate * 0.08)), i = 0;
        while (i < lim && Math.abs(d[i]) < 0.001) i++;
        m.offset = i < lim ? i / b.sampleRate : 0; // skip MP3 encoder silence
        if (m.playing) self.scheduleMusic(true);
      }, function () { m.loading = false; m.playing = false; });
    },
    scheduleMusic: function (first) {
      var m = this.music, c = this.ctx, self = this;
      if (!m.playing || !m.buf) return;
      var len = m.buf.duration - m.offset, XF = Math.min(1.5, len / 4), period = len - XF;
      var now = c.currentTime, t = m.next > now + 0.02 ? m.next : now + 0.05;
      var s = c.createBufferSource(), g = c.createGain();
      s.buffer = m.buf; s.connect(g); g.connect(this.musicGain);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(1, t + (first ? 1.2 : XF));
      g.gain.setValueAtTime(1, t + period);
      g.gain.linearRampToValueAtTime(0, t + len);
      s.start(t, m.offset); s.stop(t + len + 0.05);
      var rec = { s: s, g: g };
      m.sources.push(rec);
      s.onended = function () { var i = m.sources.indexOf(rec); if (i >= 0) m.sources.splice(i, 1); };
      m.next = t + period;
      clearTimeout(m.timer);
      m.timer = setTimeout(function () { self.scheduleMusic(false); }, Math.max(250, (m.next - c.currentTime - 1.2) * 1000));
    },
    stopMusic: function () {
      var m = this.music;
      m.playing = false; m.next = 0; clearTimeout(m.timer);
      if (!this.ctx) return;
      var t = this.ctx.currentTime;
      m.sources.forEach(function (o) {
        try { o.g.gain.cancelScheduledValues(t); o.g.gain.setValueAtTime(o.g.gain.value, t); o.g.gain.linearRampToValueAtTime(0, t + 0.5); o.s.stop(t + 0.55); } catch (e) { /* ignore */ }
      });
      m.sources = [];
    },
    suspend: function () {
      clearTimeout(this.music.timer);
      if (this.ctx && this.ctx.state === "running") this.ctx.suspend();
    },
    resume: function () {
      if (!this.ctx || (!this.on && !this.musicOn)) return;
      var self = this;
      var p = this.ctx.resume();
      var go = function () { if (self.music.playing) self.scheduleMusic(false); };
      if (p && p.then) p.then(go); else go();
    }
  };
  // Browsers only allow sound after the player touches the page, so start then.
  function unlockAudio() {
    if (!Sound.on && !Sound.musicOn) return;
    if (Sound.ensure()) {
      Sound.startMusic();
      ["pointerdown", "touchend", "keydown", "click"].forEach(function (ev) { document.removeEventListener(ev, unlockAudio, true); });
    }
  }
  ["pointerdown", "touchend", "keydown", "click"].forEach(function (ev) { document.addEventListener(ev, unlockAudio, true); });

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

  var heroTrace = new Trace($("hero-trace"), { speed: 42, aY: 0.36, bY: 0.68 });
  var gameTrace = new Trace($("trace"), { speed: 52, aY: 0.5, bY: 0.76 });
  var traces = [heroTrace, gameTrace];
  function refreshTraceColors() { traces.forEach(function (t) { t.readColors(); t.draw(); }); }
  mq("(prefers-color-scheme: dark)").addEventListener("change", refreshTraceColors);
  if (window.MutationObserver) new MutationObserver(refreshTraceColors).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

  /* ---------- screens, toast, dialogs ---------- */
  function show(name) {
    ["home", "game", "results"].forEach(function (n) { $("screen-" + n).hidden = n !== name; });
    window.scrollTo(0, 0);
    if (name === "home") { gameTrace.stop(); heroTrace.start(); }
    else if (name === "game") { heroTrace.stop(); gameTrace.start(); }
    else { heroTrace.stop(); gameTrace.stop(); }
  }
  var toastTimer;
  function toast(msg) {
    var t = $("toast");
    t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, 2800);
  }
  function openDialog(id) {
    var d = $(id);
    if (typeof d.showModal === "function") { if (!d.open) d.showModal(); } else d.setAttribute("open", "");
  }
  function closeDialog(id) {
    var d = $(id);
    if (typeof d.close === "function") { if (d.open) d.close(); } else d.removeAttribute("open");
  }
  [].forEach.call(document.querySelectorAll("dialog"), function (d) {
    d.addEventListener("click", function (e) {
      if (e.target === d || (e.target.closest && e.target.closest("[data-close]"))) closeDialog(d.id);
    });
  });

  /* ---------- the bottom sheet ---------- */
  var sheet = $("sheet");
  function showSheet(which) {
    $("sheet-accuse").hidden = which !== "accuse";
    $("sheet-verdict").hidden = which !== "verdict";
    sheet.hidden = false;
    document.body.classList.add("sheet-open");
    document.body.style.setProperty("--sheet-h", sheet.offsetHeight + "px");
  }
  function hideSheet() {
    sheet.hidden = true;
    document.body.classList.remove("sheet-open");
    document.body.style.removeProperty("--sheet-h");
  }
  function keepVisible(el) {
    if (!el) return;
    var r = el.getBoundingClientRect(), bottomLimit = window.innerHeight - (sheet.hidden ? 0 : sheet.offsetHeight) - 12;
    var dy = 0;
    if (r.bottom > bottomLimit) dy = r.bottom - bottomLimit;
    if (r.top - dy < 12) dy = r.top - 12;
    if (dy) window.scrollBy({ top: dy, behavior: reduceMotion ? "auto" : "smooth" });
  }

  /* ---------- clock ---------- */
  var run = null;
  var paused = { ad: false, hidden: false };
  var clock = { running: false, raf: 0, last: 0, lastTickSec: -1, sinceSave: 0 };
  function startClock() {
    clock.running = true; clock.last = performance.now(); clock.lastTickSec = -1;
    if (!clock.raf) clock.raf = requestAnimationFrame(tick);
  }
  function stopClock() { clock.running = false; }
  function tick(now) {
    clock.raf = 0;
    var dt = Math.min(250, now - clock.last); clock.last = now;
    if (clock.running && run && !paused.ad && !paused.hidden) {
      if (run.kind === "endless") {
        run.caseElapsed += dt;
        var left = run.limit - run.caseElapsed;
        var sec = Math.ceil(Math.max(0, left) / 1000);
        $("rec-time").textContent = WL.fmtTime(sec * 1000);
        $("rec-time").classList.toggle("urgent", left < 10000);
        gameTrace.agit = 0.2 + 0.85 * Math.min(1, run.caseElapsed / run.limit);
        if (left < 5500 && sec !== clock.lastTickSec && sec > 0) { clock.lastTickSec = sec; Sound.play("tick"); }
        if (left <= 0) { accuse(true); }
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
      Sound.suspend();
    } else {
      clock.last = performance.now();
      traces.forEach(function (t) { if (t.wasActive) { t.wasActive = false; t.start(); } });
      if (!paused.ad) Sound.resume();
    }
  });
  window.addEventListener("pagehide", function () { if (run && run.prog) { run.prog.elapsed = run.elapsed; persist(); } });

  /* ---------- starting a play ---------- */
  function progressFor(day) {
    var key = day === TODAY ? "daily" : "replay";
    var p = S[key];
    if (!p || p.day !== day) { p = S[key] = { day: day, results: [], hints: [], elapsed: 0, done: false }; persist(); }
    return p;
  }
  function startDaily(day) {
    var replay = day !== TODAY;
    var prog = progressFor(day);
    if (prog.done) { showDailyResults(day, prog, replay); return; }
    run = { kind: replay ? "replay" : "daily", day: day, cases: WL.buildDay(day), prog: prog, idx: prog.results.length, elapsed: prog.elapsed || 0 };
    WL.track(replay ? "replay_start" : "daily_start", { day: day, case: run.idx + 1 });
    show("game");
    loadCase();
  }
  function startEndless() {
    run = {
      kind: "endless", n: 0, score: 0, lives: 3, secondUsed: false,
      hintsLeft: Ads.hasAds() ? Infinity : 3, recentPremises: [], lastNames: {}, lastFacts: {},
      rng: WL.rngFrom("endless:" + Date.now() + ":" + Math.random())
    };
    S.endless.runs++; persist();
    WL.track("endless_start", {});
    Ads.interstitial("start", "endless_start").then(function () { show("game"); nextEndless(); });
  }
  function nextEndless() {
    run.n++;
    var spec = WL.endlessSpec(run.n);
    var avoid = { names: Object.assign({}, run.lastNames), premises: {}, facts: Object.assign({}, run.lastFacts) };
    run.recentPremises.forEach(function (p) { avoid.premises[p] = 1; });
    var before = Object.keys(avoid.facts);
    run.c = WL.generateCase(run.rng, { mode: spec.mode, clueCount: spec.clueCount, level: spec.level, avoid: avoid });
    run.lastNames = {}; run.c.suspects.forEach(function (s) { run.lastNames[s.name] = 1; });
    run.lastFacts = {}; Object.keys(avoid.facts).forEach(function (f) { if (before.indexOf(f) < 0) run.lastFacts[f] = 1; });
    run.recentPremises.push(run.c.title); if (run.recentPremises.length > 10) run.recentPremises.shift();
    run.limit = WL.endlessSeconds(run.n) * 1000;
    loadCase();
  }
  function currentCase() { return run.kind === "endless" ? run.c : run.cases[run.idx]; }

  /* ---------- rendering a case ---------- */
  function loadCase() {
    var c = currentCase();
    run.c = c; run.pick = null; run.revealed = false; run.hintUsed = false; run.caseElapsed = 0;
    renderCase(c);
    renderMeta();
    hideSheet();
    gameTrace.agit = run.kind === "endless" ? 0.2 : 0.28;
    $("rec-time").classList.remove("urgent");
    $("rec-time").textContent = run.kind === "endless" ? WL.fmtTime(run.limit) : WL.fmtTime(run.elapsed);
    window.scrollTo(0, 0);
    if (c.mode !== "liar") Sound.play("twist");
    else if (run.kind === "endless" ? run.n > 1 : run.idx > 0) Sound.play("whoosh");
    startClock();
  }
  function renderCase(c) {
    var planted = c.mode === "planted";
    $("case-kicker").textContent = LEVEL[c.level] || "Case";
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
      : "Every story is true. Tap the fact above that can't be right.";
    $("tip").hidden = !(c.mode === "liar" && !S.settings.seenTip && run.kind !== "endless" && run.idx === 0);

    var box = $("suspects"); box.innerHTML = "";
    c.suspects.forEach(function (s, i) {
      var el = document.createElement(planted ? "div" : "button");
      el.className = "suspect" + (planted ? " static" : "");
      if (!planted) {
        el.type = "button";
        el.setAttribute("aria-pressed", "false");
        el.addEventListener("click", function () { select(i); });
      }
      el.innerHTML = '<span class="mug">' + WL.avatar(s.name) + '</span><span class="who"><span class="who-name">' + esc(s.name) +
        '</span><span class="who-role">' + esc(s.role) + '</span><span class="says">' + esc(s.says) + "</span></span>";
      box.appendChild(el);
    });

    var hb = $("btn-hint");
    hb.textContent = hintLabel();
    hb.disabled = hintMode() === "none";
    $("hint-note").textContent = run.kind === "endless" ? "" : "A hint turns this case yellow in your result.";
  }
  function renderMeta() {
    var pips = $("pips"), lives = $("lives"), score = $("score-line");
    if (run.kind === "endless") {
      pips.hidden = true; lives.hidden = false; score.hidden = false;
      score.textContent = "Caught: " + run.score;
      lives.innerHTML = [0, 1, 2].map(function (i) { return '<span class="' + (i < run.lives ? "on" : "") + '"></span>'; }).join("");
      lives.setAttribute("aria-label", run.lives + " of 3 lives left");
      $("rec-left").textContent = "Case " + run.n;
      $("replay-tag").hidden = true;
    } else {
      pips.hidden = false; lives.hidden = true; score.hidden = true;
      var res = run.prog.results;
      pips.innerHTML = run.cases.map(function (_, i) {
        return '<span class="' + (res[i] ? "cell-" + res[i] : i === run.idx ? "now" : "") + '"></span>';
      }).join("");
      pips.setAttribute("aria-label", "Case " + (Math.min(run.idx, 4) + 1) + " of 5. " + scoreOf(res) + " caught so far.");
      $("rec-left").textContent = "Case " + (Math.min(run.idx, 4) + 1) + " of 5";
      $("replay-tag").hidden = run.kind !== "replay";
    }
  }
  function optionEls() {
    return run.c.mode === "planted"
      ? [].slice.call($("clues").querySelectorAll("button.clue"))
      : [].slice.call($("suspects").querySelectorAll(".suspect"));
  }

  /* ---------- playing ---------- */
  function select(i) {
    if (!run || run.revealed) return;
    var c = run.c, els = optionEls(), el = els[i];
    if (!el || el.classList.contains("is-out")) return;
    run.pick = i;
    els.forEach(function (e, k) { e.classList.toggle("is-picked", k === i); e.setAttribute("aria-pressed", k === i ? "true" : "false"); });
    Sound.play("tap");
    var name = c.mode === "planted" ? "" : c.suspects[i].name;
    $("accuse-q").textContent = c.mode === "liar" ? "Is " + name + " the liar?" : c.mode === "honest" ? "Is " + name + " the only honest one?" : "Is this the fake fact?";
    $("btn-accuse").textContent = c.mode === "liar" ? "Accuse " + name : c.mode === "honest" ? name + " is honest" : "It's fake";
    showSheet("accuse");
    keepVisible(el);
    if (!S.settings.seenTip) { S.settings.seenTip = true; persist(); }
  }
  function cancelPick() {
    if (!run || run.revealed) return;
    run.pick = null;
    optionEls().forEach(function (e) { e.classList.remove("is-picked"); e.setAttribute("aria-pressed", "false"); });
    hideSheet();
  }
  function stamp(el, text, ok) {
    var s = document.createElement("span");
    s.className = "stamp" + (ok ? " ok" : "");
    s.textContent = text;
    el.classList.add("has-stamp");
    el.appendChild(s);
  }
  function accuse(timeout) {
    if (!run || run.revealed) return;
    var c = run.c, pick = timeout ? -1 : run.pick;
    if (!timeout && pick == null) return;
    run.revealed = true; stopClock();
    var correct = pick === c.answer;
    var code = correct ? (run.hintUsed ? "y" : "g") : "r";

    var els = optionEls();
    els.forEach(function (e) { e.classList.remove("is-picked"); if (e.tagName === "BUTTON") e.disabled = true; });
    var ansEl = els[c.answer];
    stamp(ansEl, c.mode === "honest" ? "Honest" : c.mode === "planted" ? "Fake" : "Liar", c.mode === "honest");
    if (!correct && pick >= 0) {
      els[pick].classList.add("is-wrong");
      var tag = document.createElement("span"); tag.className = "your-pick"; tag.textContent = "Your pick";
      if (c.mode !== "planted") els[pick].appendChild(tag);
    }
    gameTrace.spike(!correct);
    Sound.play("stamp");
    setTimeout(function () { Sound.play(timeout ? "timeout" : correct ? "correct" : "wrong"); }, 170);
    if (!correct && navigator.vibrate) { try { navigator.vibrate(120); } catch (e) { /* ignore */ } }

    var name = c.mode === "planted" ? "" : c.suspects[c.answer].name;
    var head = timeout ? "Time's up." : correct ? (c.mode === "liar" ? "Caught!" : "Right!") : "Not quite.";
    var sub = c.mode === "liar" ? name + " was the liar." : c.mode === "honest" ? name + " was the only honest one."
      : correct ? "You found the planted fact." : "The stamped fact was the planted one.";
    var v = $("verdict");
    v.textContent = head; v.className = "verdict " + (correct ? "good" : "bad");
    $("why").innerHTML = "<strong>" + esc(sub) + "</strong> " + esc(c.why);
    var tr = $("twist-reveal");
    if (c.twist) { tr.textContent = c.twist; tr.hidden = false; } else tr.hidden = true;

    if (run.kind === "endless") {
      if (correct) run.score++; else run.lives--;
    } else {
      run.prog.results.push(code); run.prog.hints.push(run.hintUsed); run.prog.elapsed = run.elapsed;
      persist();
    }
    WL.track("case_answer", { kind: run.kind, correct: correct, level: c.level, mode: c.mode, hint: run.hintUsed, timeout: !!timeout });
    renderMeta();

    var last = run.kind !== "endless" && run.prog.results.length >= run.cases.length;
    var dead = run.kind === "endless" && run.lives <= 0;
    $("btn-next").textContent = last ? "See your result" : dead ? "Continue" : "Next case";
    showSheet("verdict");
    keepVisible(ansEl);
    try { $("btn-next").focus({ preventScroll: true }); } catch (e) { $("btn-next").focus(); }
  }
  function next() {
    if (!run) return;
    hideSheet();
    if (run.kind === "endless") {
      if (run.lives <= 0) { outOfLives(); return; }
      var adNow = run.n % 4 === 0;
      (adNow ? Ads.interstitial("next", "endless_between_cases") : Promise.resolve()).then(nextEndless);
      return;
    }
    run.idx = run.prog.results.length;
    if (run.idx >= run.cases.length) { finishDaily(); return; }
    persist();
    loadCase();
  }
  function hintMode() {
    // which hint the button gives right now: "free" (no ad needed), "reward" (a top-100 prize hint), "ad", or "none"
    var hasAds = Ads.hasAds(), prize = S.lb.freeHints > 0;
    if (run.kind === "endless" && !hasAds) return run.hintsLeft > 0 ? "free" : prize ? "reward" : "none";
    if (hasAds) return prize ? "reward" : "ad";
    return "free";
  }
  function hintLabel() {
    var m = hintMode();
    if (m === "none") return "No hints left";
    if (m === "reward") return "Use a prize hint (" + S.lb.freeHints + " left)";
    if (m === "ad") return "Watch an ad for a hint";
    return run.kind === "endless" ? "Use a hint (" + run.hintsLeft + " left)" : "Use a hint";
  }
  function useHint() {
    if (!run || run.revealed || run.hintUsed) return;
    var mode = hintMode();
    if (mode === "none") return;
    var give = function () {
      if (!run || run.revealed) return;
      var c = run.c, els = optionEls();
      var cands = els.map(function (_, i) { return i; }).filter(function (i) { return i !== c.answer && !els[i].classList.contains("is-out"); });
      if (!cands.length) return;
      var k = cands[Math.floor(Math.random() * cands.length)];
      els[k].classList.add("is-out");
      if (els[k].tagName === "BUTTON") els[k].disabled = true;
      els[k].setAttribute("aria-label", (c.mode === "planted" ? c.clues[k] : c.suspects[k].name) + ", ruled out by a hint");
      if (run.pick === k) cancelPick();
      run.hintUsed = true;
      if (mode === "reward") { S.lb.freeHints--; persist(); }
      else if (run.kind === "endless" && !Ads.hasAds()) run.hintsLeft--;
      Sound.play("whoosh");
      $("btn-hint").disabled = true; $("btn-hint").textContent = "Hint used: one option ruled out";
      WL.track("hint_used", { kind: run.kind, type: mode });
    };
    if (mode === "ad") Ads.rewarded("hint").then(function (ok) { if (ok) give(); else toast("No ad was available. Try again in a moment."); });
    else give();
  }

  /* ---------- endings ---------- */
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
    persist();
    WL.track("daily_complete", { day: day, score: score, replay: replay, seconds: Math.round(p.elapsed / 1000) });
    showDailyResults(day, p, replay);
    Sound.play(score >= 3 ? "fanfare" : "fail");
  }
  function outOfLives() {
    if (run.secondUsed) { endEndless(); return; }
    var hasAds = Ads.hasAds();
    $("chance-text").textContent = hasAds
      ? "Watch a short ad to get one more life and keep your run of " + run.score + " going."
      : "You get one free second chance per run. Use it to keep your run of " + run.score + " going?";
    $("btn-chance-yes").textContent = hasAds ? "Watch an ad for 1 life" : "Use my second chance";
    openDialog("dlg-chance");
  }
  function endEndless() {
    stopClock();
    var isBest = run.score > S.endless.best;
    var prevBest = S.endless.best;
    if (isBest) S.endless.best = run.score;
    persist();
    WL.track("endless_over", { score: run.score, cases: run.n });
    Sound.play(isBest && run.score > 0 ? "fanfare" : "fail");
    showEndlessResults(isBest, prevBest);
  }

  /* ---------- leaderboard + top-100 rewards ---------- */
  var LB = window.WLLB || { enabled: function () { return false; } };
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
  function rankCard(html) {
    var el = $("res-rank");
    el.innerHTML = html; el.hidden = !html;
  }
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
      return LB.topDaily(day);
    }).then(function (rows) {
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
    var sub = rank
      ? "Ranks lock in once the day ends everywhere. Hold your spot to win " + (tier ? tier.icon + " " + tier.name : "a badge") + " and a prize hint."
      : "Catch more liars, or catch them faster, to climb. The top 100 each day win a badge and a prize hint.";
    rankCard('<p class="rank-head">' + head + '</p><p class="rank-sub">' + sub + '</p><button class="btn ghost wide" type="button" id="rank-view">View leaderboard</button>');
    $("rank-view").addEventListener("click", function () { openBoard("today"); });
  }
  function joinCard(text, onJoined) {
    rankCard('<p class="rank-head">' + text + '</p><p class="rank-sub">The top 100 each day win a badge and a prize hint.</p><button class="btn primary wide" type="button" id="rank-join">Join the leaderboard</button>');
    $("rank-join").addEventListener("click", function () { askName(onJoined); });
  }
  function postEndless(onDone) {
    if (!LB.enabled() || !S.settings.playerName || S.endless.best < 1 || (S.lb.endlessPosted || 0) >= S.endless.best) { if (onDone) onDone(); return; }
    LB.submitEndless({ name: S.settings.playerName, badge: bestBadge(), best: S.endless.best }).then(function () {
      S.lb.endlessPosted = S.endless.best; persist();
      if (onDone) onDone();
    }).catch(function () { if (onDone) onDone(); });
  }
  function afterJoin() {
    var p = S.daily && S.daily.day === TODAY && S.daily.done ? S.daily : null;
    if (p && !S.lb.posted[TODAY]) postDaily(TODAY, p, function (rank) { setShare(dailyShareText(TODAY, p, false, rank)); if (!$("dlg-board").open) return; loadBoard(); });
    postEndless(function () { if ($("dlg-board").open) loadBoard(); });
  }
  function openBoard(tab) {
    if (!LB.enabled()) return;
    boardTab = tab || "today";
    $("board-demo").hidden = !(LB.isDemo && LB.isDemo());
    openDialog("dlg-board");
    loadBoard();
    postEndless(function () { if (boardTab === "endless" && $("dlg-board").open) loadBoard(); });
  }
  function loadBoard() {
    [].forEach.call(document.querySelectorAll("#dlg-board .tab"), function (t) { t.setAttribute("aria-selected", t.dataset.tab === boardTab ? "true" : "false"); });
    var list = $("board-list"), tab = boardTab, day = tab === "yesterday" ? TODAY - 1 : TODAY;
    $("board-note").textContent = tab === "endless" ? "The longest endless runs of all time."
      : tab === "today" ? "Daily #" + TODAY + ". Ranks lock in once the day ends everywhere. The top 100 win a badge."
      : "Daily #" + day + ". Final ranks. The top 100 won a badge and a prize hint.";
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
    }).catch(function (e) {
      if (tab !== boardTab) return;
      list.innerHTML = '<li class="board-empty">' + esc(LB.friendlyError(e)) + "</li>";
    });
  }
  function renderBoardMe(rows) {
    var box = $("board-me");
    if (!S.settings.playerName) {
      box.innerHTML = '<p>Want your name up here? Finish today\'s cases, then join.</p><button class="btn primary wide" type="button" id="board-join">Join the leaderboard</button>';
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
        if (t) { S.lb.badges.push({ day: r.day, rank: r.rank, icon: t.icon, name: t.name }); S.lb.freeHints++; won.push({ day: r.day, rank: r.rank, tier: t }); }
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
    $("reward-text").textContent = "You finished #" + top.rank + " on Daily #" + top.day +
      (won.length > 1 ? ", and made the top 100 on " + (won.length - 1) + " more day" + (won.length > 2 ? "s" : "") : "") + ".";
    $("reward-list").innerHTML = won.map(function (w) { return "<li>" + w.tier.icon + " " + esc(w.tier.name) + " badge for Daily #" + w.day + "</li>"; }).join("") +
      "<li>" + won.length + " prize hint" + (won.length > 1 ? "s" : "") + (Ads.hasAds() ? ", no ad needed" : " for endless mode") + "</li>" +
      "<li>Your best badge now shows next to your name</li>";
    WL.track("reward_won", { rank: top.rank });
    Sound.play("fanfare");
    openDialog("dlg-reward");
  }

  /* ---------- sharing ---------- */
  var shareTextNow = "";
  function dailyShareText(day, p, replay, rank) {
    var grid = p.results.map(function (r) { return GRID[r]; }).join("");
    var lines = [(CFG.siteName || "Who's Lying?") + " #" + day + (replay ? " (replay)" : ""), grid + " " + scoreOf(p.results) + "/5  ⏱️ " + WL.fmtTime(p.elapsed)];
    var st = currentStreak();
    if (!replay && st > 1) lines.push("🔥 " + st + "-day streak");
    if (!replay && rank) lines.push("🏆 #" + rank + " on today's leaderboard");
    var u = WL.siteUrl(); if (u) lines.push(u + "/");
    return lines.join("\n");
  }
  function endlessShareText(score) {
    var lines = [(CFG.siteName || "Who's Lying?") + " Endless 🕵️", "I caught " + score + " liar" + (score === 1 ? "" : "s") + " in a row. Can you beat that?"];
    var u = WL.siteUrl(); if (u) lines.push(u + "/#endless");
    return lines.join("\n");
  }
  function setShare(text) {
    shareTextNow = text;
    $("share-wa").href = "https://api.whatsapp.com/send?text=" + encodeURIComponent(text);
    $("share-x").href = "https://twitter.com/intent/tweet?text=" + encodeURIComponent(text);
    $("share-text").hidden = true;
  }
  function share(text) {
    text = text || shareTextNow;
    WL.track("share", { method: "button" });
    if (coarse && navigator.share) {
      navigator.share({ text: text }).catch(function (e) { if (!e || e.name !== "AbortError") copy(text); });
      return;
    }
    copy(text);
  }
  function copy(text) {
    text = text || shareTextNow;
    var ok = function () { toast("Copied. Paste it anywhere."); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(ok, function () { fallbackCopy(text); });
    else fallbackCopy(text);
  }
  function fallbackCopy(text) {
    // Old browsers and some in-app browsers: copy through a temporary text box.
    var ta = document.createElement("textarea");
    ta.value = text; ta.setAttribute("readonly", "");
    ta.style.position = "fixed"; ta.style.top = "0"; ta.style.left = "-9999px";
    document.body.appendChild(ta); ta.select();
    var ok = false;
    try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
    ta.remove();
    if (ok) { toast("Copied. Paste it anywhere."); return; }
    var box = $("share-text");
    if (!$("screen-results").hidden) { box.value = text; box.hidden = false; box.focus(); box.select(); toast("Select the text in the box and copy it."); }
    else toast("Couldn't copy. Open your result and try again.");
  }

  /* ---------- results screens ---------- */
  function statsRow(pairs) {
    return pairs.map(function (p) { return "<div><dt>" + p[0] + "</dt><dd>" + p[1] + "</dd></div>"; }).join("");
  }
  function actionBtn(label, cls, onClick, href) {
    var el = document.createElement(href ? "a" : "button");
    el.className = "btn wide " + cls; el.textContent = label;
    if (href) el.href = href; else { el.type = "button"; el.addEventListener("click", onClick); }
    return el;
  }
  function showDailyResults(day, p, replay) {
    stopClock(); hideSheet();
    show("results");
    var score = scoreOf(p.results), hints = p.results.filter(function (r) { return r === "y"; }).length;
    $("res-kicker").textContent = "Daily #" + day + (replay ? " replay" : "") + " complete";
    $("res-title").textContent = TITLES[score];
    $("res-body").innerHTML = '<div class="res-grid" role="img" aria-label="' + score + ' of 5 caught">' + cells(p.results, 5) + "</div>" +
      '<p class="res-line">You caught <strong>' + score + " of 5</strong> liars in <strong>" + WL.fmtTime(p.elapsed) + "</strong>" +
      (hints ? ", with " + hints + " hint" + (hints > 1 ? "s" : "") : "") + ".</p>";
    var known = !replay && day === TODAY ? S.lb.ranks[day] : 0;
    setShare(dailyShareText(day, p, replay, known));
    rankCard("");
    if (!replay && day === TODAY && LB.enabled()) {
      var onRank = function (rank) { setShare(dailyShareText(day, p, false, rank)); };
      if (S.settings.playerName) postDaily(day, p, onRank);
      else joinCard("See where you rank against other detectives today.", function () { postDaily(day, p, onRank); postEndless(); });
    }
    var st = S.stats;
    $("res-stats").innerHTML = statsRow([["Days played", st.played], ["Streak", currentStreak()], ["Best streak", st.maxStreak], ["Perfect days", st.perfect]]);
    $("res-stats").hidden = false;
    $("res-next").innerHTML = 'Next cases in <strong data-countdown="1">' + WL.fmtCountdown(WL.msToNextDay()) + "</strong>";
    var acts = $("res-actions"); acts.innerHTML = "";
    acts.appendChild(actionBtn("Play endless mode", "ghost", startEndless));
    if (replay) {
      acts.appendChild(actionBtn("Play this day again", "ghost", function () { S.replay = null; persist(); startDaily(day); }));
      acts.appendChild(actionBtn("Back to past cases", "ghost", null, "archive.html#day-" + day));
      var t = S.daily && S.daily.day === TODAY && S.daily.done;
      if (!t) acts.appendChild(actionBtn("Play today's cases", "ghost", function () { startDaily(TODAY); }));
    }
    var cases = WL.buildDay(day);
    $("review").hidden = false; $("review").open = false;
    $("review-list").innerHTML = cases.map(function (c, i) {
      var r = p.results[i] || "n";
      var ans = c.mode === "planted" ? "Planted fact: " + c.clues[c.answer]
        : (c.mode === "honest" ? "The honest one: " : "The liar: ") + c.suspects[c.answer].name + " (" + c.suspects[c.answer].role + ")";
      return '<div class="review-item"><h4><span class="cell-' + r + '"></span>' + esc(c.title) + '</h4><p class="ans">' + esc(ans) + "</p><p>" + esc(c.why) + "</p></div>";
    }).join("");
    Ads.display($("ad-results"));
    run = null;
    focusTitle();
  }
  function showEndlessResults(isBest, prevBest) {
    show("results");
    var score = run.score;
    $("res-kicker").textContent = "Endless mode";
    $("res-title").textContent = score === 0 ? "The liars won." : isBest && prevBest > 0 ? "New personal best!" : "Run over.";
    $("res-body").innerHTML = '<p class="res-big">' + score + "</p>" +
      '<p class="res-line">liar' + (score === 1 ? "" : "s") + " caught in a row. Your best: <strong>" + S.endless.best + "</strong>" + "</p>" +
      (isBest && score > 0 ? '<span class="new-best">New best</span>' : "");
    setShare(endlessShareText(score));
    rankCard("");
    if (LB.enabled() && S.endless.best > 0) {
      var boardCard = function () {
        rankCard('<p class="rank-head">Your best run of <strong>' + S.endless.best + "</strong> is on the endless leaderboard.</p>" +
          '<button class="btn ghost wide" type="button" id="rank-view">View endless leaderboard</button>');
        $("rank-view").addEventListener("click", function () { openBoard("endless"); });
      };
      if (S.settings.playerName) postEndless(boardCard);
      else joinCard("Put your best run of " + S.endless.best + " on the endless leaderboard.", function () { postEndless(boardCard); afterJoin(); });
    }
    $("res-stats").innerHTML = statsRow([["Cases", run.n], ["Caught", score], ["Best", S.endless.best], ["Runs", S.endless.runs]]);
    var dailyDone = S.daily && S.daily.day === TODAY && S.daily.done;
    $("res-next").innerHTML = dailyDone
      ? 'Next daily cases in <strong data-countdown="1">' + WL.fmtCountdown(WL.msToNextDay()) + "</strong>"
      : "Today's daily cases are still waiting for you.";
    var acts = $("res-actions"); acts.innerHTML = "";
    acts.appendChild(actionBtn("Play again", "ghost", startEndless));
    if (!dailyDone) acts.appendChild(actionBtn("Play today's cases", "ghost", function () { startDaily(TODAY); }));
    $("review").hidden = true;
    Ads.display($("ad-results"));
    run = null;
    focusTitle();
  }
  function focusTitle() { try { $("res-title").focus({ preventScroll: true }); } catch (e) { /* ignore */ } }

  /* ---------- home ---------- */
  function goHome() {
    stopClock(); hideSheet(); closeDialog("dlg-chance");
    if (run && run.prog) { run.prog.elapsed = run.elapsed; persist(); }
    run = null;
    try { if (location.hash) history.replaceState(null, "", location.pathname + location.search); } catch (e) { /* ignore */ }
    renderHome();
    show("home");
  }
  function renderHome() {
    $("home-num").textContent = "Daily #" + TODAY;
    $("home-date").textContent = WL.formatDate(WL.dateForDay(TODAY));
    var p = S.daily && S.daily.day === TODAY ? S.daily : null;
    var box = $("home-state"), streak = currentStreak();
    var streakLine = streak > 0 ? "<p>Your streak: <strong>" + streak + " day" + (streak > 1 ? "s" : "") + "</strong>. Play today to keep it going.</p>" : "";
    if (p && p.done) {
      var score = scoreOf(p.results);
      box.innerHTML = '<div class="home-done"><div class="mini-grid" role="img" aria-label="' + score + ' of 5 caught">' + cells(p.results, 5) + "</div>" +
        "<p>You caught <strong>" + score + " of 5</strong> liars today in " + WL.fmtTime(p.elapsed) + ".</p>" +
        '<button class="btn primary wide" type="button" id="home-share">Share your result</button>' +
        '<button class="btn ghost wide" type="button" id="home-view">See today\'s answers</button>' +
        '<p class="countdown-line">Next cases in <strong data-countdown="1">' + WL.fmtCountdown(WL.msToNextDay()) + "</strong></p></div>";
      $("home-share").addEventListener("click", function () { share(dailyShareText(TODAY, p, false, S.lb.ranks[TODAY])); });
      $("home-view").addEventListener("click", function () { showDailyResults(TODAY, p, false); });
    } else if (p && p.results.length) {
      box.innerHTML = '<div class="home-done"><div class="mini-grid">' + cells(p.results, 5) + "</div><p>You're on case " + (p.results.length + 1) + " of 5.</p>" +
        '<button class="btn primary wide" type="button" id="home-play">Continue case ' + (p.results.length + 1) + "</button></div>";
      $("home-play").addEventListener("click", function () { startDaily(TODAY); });
    } else {
      box.innerHTML = "<p>Five new cases are waiting. The last one has a twist.</p>" + streakLine +
        '<button class="btn primary wide" type="button" id="home-play">Start today\'s cases</button>';
      $("home-play").addEventListener("click", function () { startDaily(TODAY); });
    }
    $("endless-note").textContent = S.endless.best > 0
      ? "Your best: " + S.endless.best + " liar" + (S.endless.best === 1 ? "" : "s") + " in a row."
      : "Unlimited cases against the clock. Three lives.";
  }

  /* ---------- stats dialog ---------- */
  function renderStats() {
    var st = S.stats;
    $("stats-row").innerHTML = statsRow([["Days played", st.played], ["Streak", currentStreak()], ["Best streak", st.maxStreak], ["Perfect days", st.perfect]]);
    var max = Math.max.apply(null, [1].concat(st.dist));
    var todayScore = S.history[TODAY] && !S.history[TODAY].replay ? S.history[TODAY].score : -1;
    var rows = "";
    for (var s = 5; s >= 0; s--) {
      var n = st.dist[s] || 0;
      rows += '<div class="dist-row"><b>' + s + '/5</b><div><div class="dist-bar' + (s === todayScore ? " today" : "") + '" style="width:' + Math.max(8, (n / max) * 100) + '%">' + n + "</div></div></div>";
    }
    $("stats-dist").innerHTML = rows;
    $("stats-endless").textContent = S.endless.best > 0
      ? "Endless mode best: " + S.endless.best + " liar" + (S.endless.best === 1 ? "" : "s") + " in a row."
      : "You haven't played endless mode yet.";
    var counts = {}, order = [];
    S.lb.badges.forEach(function (b) { if (!counts[b.icon]) { counts[b.icon] = 0; order.push(b); } counts[b.icon]++; });
    var showBadges = LB.enabled() || S.lb.badges.length > 0;
    $("stats-badges-h").hidden = !showBadges; $("stats-badges").hidden = !showBadges;
    if (showBadges) {
      $("stats-badges").innerHTML = S.lb.badges.length
        ? order.map(function (b) { return '<span class="badge-chip">' + b.icon + " " + esc(b.name) + " \u00D7" + counts[b.icon] + "</span>"; }).join("") +
          (S.lb.freeHints ? '<span class="badge-chip">' + S.lb.freeHints + " prize hint" + (S.lb.freeHints > 1 ? "s" : "") + "</span>" : "")
        : "No badges yet. Finish in a day's top 100 to win one.";
    }
  }

  /* ---------- wiring ---------- */
  function setSoundButton() {
    var b = $("btn-sound");
    b.setAttribute("aria-pressed", Sound.on ? "true" : "false");
    b.setAttribute("aria-label", Sound.on ? "Sound on" : "Sound off");
  }
  $("brand").addEventListener("click", goHome);
  $("btn-help").addEventListener("click", function () { openDialog("dlg-help"); });
  $("btn-stats").addEventListener("click", function () { renderStats(); openDialog("dlg-stats"); });
  $("btn-sound").addEventListener("click", function () {
    Sound.on = !Sound.on; S.settings.sound = Sound.on; persist(); setSoundButton();
    Ads.setSound(Sound.on);
    if (Sound.on) Sound.play("tap");
  });
  function setMusicButton() {
    var b = $("btn-music");
    b.setAttribute("aria-pressed", Sound.musicOn ? "true" : "false");
    b.setAttribute("aria-label", Sound.musicOn ? "Music on" : "Music off");
  }
  $("btn-music").addEventListener("click", function () {
    Sound.musicOn = !Sound.musicOn; S.settings.music = Sound.musicOn; persist(); setMusicButton();
    if (Sound.musicOn) { if (Sound.ensure()) Sound.startMusic(); } else Sound.stopMusic();
  });
  $("btn-board").addEventListener("click", function () { openBoard("today"); });
  [].forEach.call(document.querySelectorAll("#dlg-board .tab"), function (t) {
    t.addEventListener("click", function () { boardTab = t.dataset.tab; loadBoard(); });
  });
  $("name-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var r = LB.cleanName($("name-input").value);
    if (!r.ok) { $("name-error").textContent = r.msg; $("name-error").hidden = false; return; }
    var first = !S.settings.playerName;
    S.settings.playerName = r.name; persist();
    closeDialog("dlg-name");
    toast(first ? "Welcome, " + r.name + "!" : "Name saved. It shows on your next score.");
    WL.track(first ? "leaderboard_join" : "leaderboard_rename", {});
    var cb = nameCb; nameCb = null;
    if (cb) cb();
  });
  $("btn-endless").addEventListener("click", startEndless);
  $("btn-accuse").addEventListener("click", function () { accuse(false); });
  $("btn-cancel").addEventListener("click", cancelPick);
  $("btn-next").addEventListener("click", next);
  $("btn-hint").addEventListener("click", useHint);
  $("btn-share").addEventListener("click", function () { share(); });
  $("btn-copy").addEventListener("click", function () { copy(); });
  $("share-wa").addEventListener("click", function () { WL.track("share", { method: "whatsapp" }); });
  $("share-x").addEventListener("click", function () { WL.track("share", { method: "x" }); });
  $("btn-chance-yes").addEventListener("click", function () {
    closeDialog("dlg-chance");
    run.secondUsed = true;
    Ads.rewarded("second_chance").then(function (ok) {
      if (ok) { run.lives = 1; WL.track("second_chance", { score: run.score }); nextEndless(); }
      else { toast("No ad was available right now."); endEndless(); }
    });
  });
  $("btn-chance-no").addEventListener("click", function () { closeDialog("dlg-chance"); endEndless(); });
  $("dlg-chance").addEventListener("cancel", function (e) { e.preventDefault(); closeDialog("dlg-chance"); endEndless(); });

  document.addEventListener("keydown", function (e) {
    if ($("screen-game").hidden || !run || document.querySelector("dialog[open]")) return;
    var tag = (e.target && e.target.tagName) || "";
    if (tag === "TEXTAREA" || tag === "INPUT") return;
    if (/^[1-5]$/.test(e.key) && !run.revealed) { select(parseInt(e.key, 10) - 1); e.preventDefault(); }
    else if (e.key === "Enter" && !sheet.hidden && e.target.tagName !== "BUTTON") {
      if (!$("sheet-accuse").hidden) accuse(false); else if (!$("sheet-verdict").hidden) next();
      e.preventDefault();
    } else if (e.key === "Escape" && !run.revealed) cancelPick();
  });

  setInterval(function () {
    var left = WL.msToNextDay();
    [].forEach.call(document.querySelectorAll("[data-countdown]"), function (el) { el.textContent = WL.fmtCountdown(left); });
    if (WL.dayNumber() !== TODAY && !run) location.reload();
  }, 1000);

  Ads.init({
    onPause: function () { paused.ad = true; Sound.suspend(); },
    onResume: function () { paused.ad = false; clock.last = performance.now(); Sound.resume(); }
  });
  Ads.setSound(Sound.on);
  setSoundButton();
  setMusicButton();
  if (LB.enabled()) {
    $("btn-board").hidden = false;
    setTimeout(checkRewards, 1200);
  }

  /* ---------- start ---------- */
  function route() {
    var m = location.hash.match(/^#day-(\d+)$/) || location.search.match(/[?&]day=(\d+)/);
    if (m) {
      var d = parseInt(m[1], 10);
      if (d >= 1 && d < TODAY) { startDaily(d); return; }
    }
    if (location.hash === "#endless") { startEndless(); return; }
    goHome();
  }
  route();
  window.addEventListener("hashchange", route);
})();
