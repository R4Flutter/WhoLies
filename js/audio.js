/*
  WHO'S LYING? — sound effects and background music
  Files live in assets/audio/. If one is missing, a small built-in synth sound
  plays instead, so the game never goes silent.
  Mute rules: the player's own switches, the platform's mute setting
  (CrazyGames muteAudio wins over everything), and ads (muted while one plays).
*/
(function () {
  "use strict";
  var ACFG = (window.WL_CONFIG && window.WL_CONFIG.audio) || {};
  var MUSIC_VOL = ACFG.musicVolume == null ? 0.32 : ACFG.musicVolume;
  var SFX_VOL = ACFG.sfxVolume == null ? 0.9 : ACFG.sfxVolume;
  var SFX = {
    tap: 0.5, stamp: 0.85, correct: 0.42, wrong: 0.45, tick: 0.55, timeout: 0.42, twist: 0.6,
    fanfare: 0.6, fail: 0.55, whoosh: 0.6, coin: 0.5, star: 0.55, levelup: 0.6, combo: 0.5, click: 0.45, buy: 0.55, achieve: 0.55
  };
  var BIG = { fanfare: 1, fail: 1, twist: 1, levelup: 1, achieve: 1 };

  var A = {
    ctx: null, master: null, sfxGain: null, musicGain: null, buffers: {}, loaded: false,
    soundOn: true, musicOn: true, forced: false, adMuted: false, hidden: false, touched: false,
    music: { buf: null, offset: 0, sources: [], timer: 0, next: 0, loading: false, playing: false, wanted: false }
  };

  function audible() { return !A.forced && !A.adMuted; }
  function applyMaster() {
    if (!A.master) return;
    var t = A.ctx.currentTime, v = audible() ? 1 : 0;
    A.master.gain.cancelScheduledValues(t);
    A.master.gain.setTargetAtTime(v, t, 0.03);
  }
  function ensure() {
    // No audio engine before the first touch or key press: browsers block it and log a warning.
    if (!A.touched) return null;
    if (!A.ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try { A.ctx = new AC(); } catch (e) { return null; }
      A.master = A.ctx.createGain(); A.master.gain.value = audible() ? 1 : 0; A.master.connect(A.ctx.destination);
      A.sfxGain = A.ctx.createGain(); A.sfxGain.gain.value = SFX_VOL; A.sfxGain.connect(A.master);
      A.musicGain = A.ctx.createGain(); A.musicGain.gain.value = MUSIC_VOL; A.musicGain.connect(A.master);
    }
    if (A.ctx.state !== "running" && !A.hidden) { try { A.ctx.resume(); } catch (e) { /* ignore */ } }
    if (!A.loaded) loadAll();
    return A.ctx;
  }
  function decode(ab) {
    return new Promise(function (res, rej) {
      var p = A.ctx.decodeAudioData(ab, res, rej);
      if (p && p.then) p.then(res, rej);
    });
  }
  function fetchBuf(name) {
    return fetch("assets/audio/" + name + ".mp3").then(function (r) {
      if (!r.ok) throw new Error(r.status);
      return r.arrayBuffer();
    }).then(decode);
  }
  function loadAll() {
    A.loaded = true;
    Object.keys(SFX).forEach(function (n) {
      fetchBuf(n).then(function (b) { A.buffers[n] = b; }, function () { /* keep synth fallback */ });
    });
  }

  /* ---------- synth fallbacks ---------- */
  function tone(f, dur, type, vol, delay, slide) {
    var c = A.ctx, t = c.currentTime + (delay || 0);
    var o = c.createOscillator(), g = c.createGain();
    o.type = type || "sine"; o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(A.sfxGain); o.start(t); o.stop(t + dur + 0.02);
  }
  function thud() {
    var c = A.ctx, len = Math.floor(c.sampleRate * 0.12), buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    var s = c.createBufferSource(), g = c.createGain(), f = c.createBiquadFilter();
    f.type = "lowpass"; f.frequency.value = 900; g.gain.value = 0.5;
    s.buffer = buf; s.connect(f); f.connect(g); g.connect(A.sfxGain); s.start();
    tone(95, 0.16, "sine", 0.35);
  }
  function synth(name) {
    if (name === "tap" || name === "click") tone(620, 0.05, "triangle", 0.05);
    else if (name === "stamp" || name === "twist") thud();
    else if (name === "correct" || name === "fanfare" || name === "levelup" || name === "achieve") { tone(523, 0.12, "triangle", 0.12); tone(784, 0.2, "triangle", 0.12, 0.1); }
    else if (name === "coin" || name === "buy" || name === "star" || name === "combo") { tone(988, 0.08, "square", 0.04); tone(1319, 0.14, "square", 0.04, 0.07); }
    else if (name === "wrong" || name === "fail" || name === "timeout") tone(190, 0.32, "sawtooth", 0.07, 0, 110);
    else if (name === "tick") tone(1150, 0.03, "square", 0.025);
  }

  /* ---------- effects ---------- */
  function play(name, opts) {
    if (!A.soundOn || !audible()) return;
    if (!ensure()) return;
    opts = opts || {};
    var b = A.buffers[name];
    try {
      if (b) {
        var s = A.ctx.createBufferSource(), g = A.ctx.createGain();
        s.buffer = b; g.gain.value = (SFX[name] || 0.6) * (opts.volume || 1);
        if (opts.rate) s.playbackRate.value = opts.rate;
        s.connect(g); g.connect(A.sfxGain); s.start(A.ctx.currentTime + (opts.delay || 0));
        if (BIG[name]) duck(b.duration);
      } else synth(name);
    } catch (e) { /* audio not available */ }
  }
  function duck(sec) {
    if (!A.musicGain) return;
    var g = A.musicGain.gain, t = A.ctx.currentTime;
    g.cancelScheduledValues(t); g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(MUSIC_VOL * 0.35, t + 0.15);
    g.setValueAtTime(MUSIC_VOL * 0.35, t + Math.max(0.3, sec - 0.4));
    g.linearRampToValueAtTime(MUSIC_VOL, t + sec + 0.4);
  }

  /* ---------- music: a crossfaded loop ---------- */
  function startMusic() {
    var m = A.music;
    m.wanted = true;
    if (!A.musicOn || m.playing || !A.touched || !ensure()) return;
    m.playing = true;
    if (m.buf) { schedule(true); return; }
    if (m.loading) return;
    m.loading = true;
    fetchBuf("music").then(function (b) {
      m.loading = false; m.buf = b;
      var d = b.getChannelData(0), lim = Math.min(d.length, Math.floor(b.sampleRate * 0.08)), i = 0;
      while (i < lim && Math.abs(d[i]) < 0.001) i++;
      m.offset = i < lim ? i / b.sampleRate : 0; // skip MP3 encoder silence
      if (m.playing) schedule(true);
    }, function () { m.loading = false; m.playing = false; });
  }
  function schedule(first) {
    var m = A.music, c = A.ctx;
    if (!m.playing || !m.buf || A.hidden) return;
    var len = m.buf.duration - m.offset, XF = Math.min(1.5, len / 4), period = len - XF;
    var now = c.currentTime, t = m.next > now + 0.02 ? m.next : now + 0.05;
    var s = c.createBufferSource(), g = c.createGain();
    s.buffer = m.buf; s.connect(g); g.connect(A.musicGain);
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
    m.timer = setTimeout(function () { schedule(false); }, Math.max(250, (m.next - c.currentTime - 1.2) * 1000));
  }
  function stopMusic(keepWanted) {
    var m = A.music;
    m.playing = false; m.next = 0; clearTimeout(m.timer);
    if (!keepWanted) m.wanted = false;
    if (!A.ctx) return;
    var t = A.ctx.currentTime;
    m.sources.forEach(function (o) {
      try { o.g.gain.cancelScheduledValues(t); o.g.gain.setValueAtTime(o.g.gain.value, t); o.g.gain.linearRampToValueAtTime(0, t + 0.5); o.s.stop(t + 0.55); } catch (e) { /* ignore */ }
    });
    m.sources = [];
  }

  /* ---------- switches ---------- */
  function setSound(on) { A.soundOn = !!on; }
  function setMusic(on) {
    A.musicOn = !!on;
    if (on) { if (A.ctx) startMusic(); else A.music.wanted = true; } else stopMusic();
  }
  function setForced(muted) { A.forced = !!muted; applyMaster(); }
  function adPause() { A.adMuted = true; applyMaster(); }
  function adResume() { A.adMuted = false; applyMaster(); }

  // Browsers only allow sound after the player touches the page.
  // iOS also stops audio when the app goes to the background, so every touch tries to resume it.
  function onGesture() {
    A.touched = true;
    if (!A.soundOn && !A.musicOn) return;
    if (!ensure()) return;
    if (A.musicOn && A.music.wanted && !A.music.playing) startMusic();
  }
  ["pointerdown", "touchend", "keydown", "click"].forEach(function (ev) { document.addEventListener(ev, onGesture, true); });
  document.addEventListener("visibilitychange", function () {
    A.hidden = document.hidden;
    if (!A.ctx) return;
    if (document.hidden) { clearTimeout(A.music.timer); try { A.ctx.suspend(); } catch (e) { /* ignore */ } }
    else {
      var p; try { p = A.ctx.resume(); } catch (e) { p = null; }
      var go = function () { if (A.music.playing) { A.music.next = 0; schedule(false); } };
      if (p && p.then) p.then(go, go); else go();
    }
  });

  window.WLAudio = {
    init: function (o) { A.soundOn = o.sound !== false; A.musicOn = o.music !== false; A.music.wanted = A.musicOn; },
    play: play, startMusic: startMusic, stopMusic: stopMusic,
    setSound: setSound, setMusic: setMusic, setForced: setForced, adPause: adPause, adResume: adResume,
    unlocked: function () { return !!A.ctx && A.ctx.state === "running"; }
  };
})();
