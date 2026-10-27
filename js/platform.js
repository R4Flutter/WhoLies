/*
  WHO'S LYING? — platform layer
  The game talks only to WLPlat. It works out where it's running:

  "crazygames"  The CrazyGames build (tools/build-crazygames.mjs adds the SDK).
                Ads, saves (Data module), username, mute setting, invite links
                and gameplay/loading events all go through the CrazyGames SDK v3.
  "web"         Your own site (GitHub Pages). Ads use js/ads.js (AdSense or none),
                saves use localStorage, sharing uses WhatsApp / X / copy.
*/
(function () {
  "use strict";
  var CFG = window.WL_CONFIG || {};
  var KEY = "whoslying:v1";
  var name = window.WL_PLATFORM === "crazygames" ? "crazygames" : "web";
  var sdk = null;          // window.CrazyGames.SDK once ready
  var sdkEnv = "";         // "crazygames" | "local" | "disabled"
  var inGameplay = false;
  var adActive = false;
  var muteForced = false;
  var lastAdError = "";
  var listeners = { mute: [], adStart: [], adEnd: [], auth: [] };

  function emit(type, v) { listeners[type].forEach(function (fn) { try { fn(v); } catch (e) { console.error(e); } }); }
  function on(type, fn) { listeners[type].push(fn); }
  function cg() { return sdk && (sdkEnv === "crazygames" || sdkEnv === "local"); }
  function safe(fn, fallback) { try { return fn(); } catch (e) { return fallback; } }

  /* ---------- start-up ---------- */
  function init() {
    if (name !== "crazygames") {
      var A = window.WLAds;
      if (A) A.init({ onPause: adStarted, onResume: adEnded });
      return Promise.resolve(name);
    }
    var S = window.CrazyGames && window.CrazyGames.SDK;
    if (!S) { console.warn("[platform] CrazyGames SDK not found. Running without it."); return Promise.resolve(name); }
    var timeout = new Promise(function (res) { setTimeout(res, 6000, "timeout"); });
    return Promise.race([Promise.resolve().then(function () { return S.init(); }), timeout]).then(function (r) {
      if (r === "timeout") console.warn("[platform] SDK init is slow. Continuing.");
      sdk = S;
      sdkEnv = safe(function () { return S.environment; }, "disabled");
      if (!cg()) return name;
      readSettings();
      safe(function () { S.game.addSettingsChangeListener(readSettings); });
      safe(function () { S.user.addAuthListener(function (u) { emit("auth", u); }); });
      return name;
    }).catch(function (e) {
      console.warn("[platform] SDK init failed:", e);
      return name;
    });
  }
  function readSettings() {
    var s = safe(function () { return sdk.game.settings; }, null) || {};
    var m = !!s.muteAudio;
    if (m !== muteForced) { muteForced = m; emit("mute", m); }
  }

  /* ---------- saves ----------
     CrazyGames: the Data module (same calls as localStorage; it syncs to the
     player's account when they're signed in). Web: localStorage. */
  function storage() {
    if (cg() && safe(function () { return sdk.data; }, null)) return sdk.data;
    try { return window.localStorage; } catch (e) { return null; }
  }
  function load() {
    var st = storage(), raw = null;
    try { raw = st ? st.getItem(KEY) : null; } catch (e) { raw = null; }
    // First run on CrazyGames after an older local save: carry it over.
    if (!raw && cg()) { try { raw = window.localStorage.getItem(KEY); } catch (e) { /* ignore */ } }
    try { var s = JSON.parse(raw); return s && typeof s === "object" ? s : {}; } catch (e) { return {}; }
  }
  var saveTimer = 0, pending = null;
  function save(state, now) {
    pending = state;
    clearTimeout(saveTimer);
    var write = function () {
      var st = storage();
      if (!st || !pending) return;
      try { st.setItem(KEY, JSON.stringify(pending)); } catch (e) { console.warn("[platform] save failed", e); }
      pending = null;
    };
    if (now) write(); else saveTimer = setTimeout(write, 250);
  }
  function flush() { if (pending) save(pending, true); }

  /* ---------- gameplay + loading events ---------- */
  function gameplayStart() {
    if (inGameplay) return;
    inGameplay = true;
    if (cg()) safe(function () { sdk.game.gameplayStart(); });
  }
  function gameplayStop() {
    if (!inGameplay) return;
    inGameplay = false;
    if (cg()) safe(function () { sdk.game.gameplayStop(); });
  }
  function loadingStart() { if (cg()) safe(function () { sdk.game.loadingStart(); }); }
  function loadingStop() { if (cg()) safe(function () { sdk.game.loadingStop(); }); }
  function happytime() { if (cg()) safe(function () { sdk.game.happytime(); }); }

  /* ---------- ads ----------
     midgame(): a break between levels. Resolves when it's done (or skipped).
     rewarded(): resolves true only if the player watched to the end. */
  function adStarted() { adActive = true; emit("adStart"); }
  function adEnded() { if (adActive) { adActive = false; emit("adEnd"); } }

  function cgAd(kind) {
    return new Promise(function (resolve) {
      var done = false;
      function finish(ok) { if (done) return; done = true; adEnded(); resolve(ok); }
      lastAdError = "";
      try {
        sdk.ad.requestAd(kind, {
          adStarted: adStarted,
          adFinished: function () { finish(true); },
          adError: function (err) {
            lastAdError = (err && err.code) || "other";
            if (lastAdError !== "adCooldown") console.info("[platform] ad not shown:", lastAdError);
            finish(false);
          }
        });
      } catch (e) { finish(false); }
    });
  }
  function webAds() { return window.WLAds; }

  function hasAds() {
    if (name === "crazygames") return cg();
    var A = webAds();
    return !!(A && A.hasAds());
  }
  function midgame(placement) {
    if (name === "crazygames") return cg() ? cgAd("midgame").then(function () {}) : Promise.resolve();
    var A = webAds();
    return A ? A.interstitial("next", placement) : Promise.resolve();
  }
  function rewarded(placement) {
    if (name === "crazygames") return cg() ? cgAd("rewarded") : Promise.resolve(false);
    var A = webAds();
    return A && A.hasAds() ? A.rewarded(placement) : Promise.resolve(false);
  }
  function hasAdblock() {
    if (!cg()) return Promise.resolve(false);
    return Promise.resolve().then(function () { return sdk.ad.hasAdblock(); }).then(function (r) { return !!r; }, function () { return false; });
  }

  /* ---------- player ---------- */
  function getUser() {
    if (!cg()) return Promise.resolve(null);
    return Promise.resolve().then(function () {
      if (!sdk.user.isUserAccountAvailable) return null;
      return sdk.user.getUser();
    }).then(function (u) { return u || null; }, function () { return null; });
  }
  function locale() {
    var info = cg() ? safe(function () { return sdk.user.systemInfo; }, null) : null;
    return (info && info.locale) || navigator.language || "en";
  }

  /* ---------- sharing ---------- */
  // A link back to the game. On CrazyGames this is an invite link to the game page.
  function shareLink(params) {
    if (name === "crazygames") {
      if (!cg()) return "";
      return safe(function () { return sdk.game.inviteLink(params || {}); }, "") || "";
    }
    var u = CFG.siteUrl || "";
    if (!u || /example/.test(u)) u = location.origin && location.origin !== "null" ? location.origin + location.pathname.replace(/[^/]*$/, "") : "";
    u = u.replace(/\/$/, "") + "/";
    if (params && params.day) return u + "#day-" + params.day;
    if (params && params.mode === "rush") return u + "#endless";
    return u;
  }
  function inviteParam(key) {
    if (name === "crazygames") return cg() ? safe(function () { return sdk.game.getInviteParam(key); }, null) : null;
    return null;
  }

  /* ---------- CrazyGames leaderboard (invite-only feature, off by default) ---------- */
  function encryptScore(score, keyB64) {
    var iv = window.crypto.getRandomValues(new Uint8Array(12));
    var raw = Uint8Array.from(atob(keyB64), function (c) { return c.charCodeAt(0); });
    return window.crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt"]).then(function (key) {
      return window.crypto.subtle.encrypt({ name: "AES-GCM", iv: iv }, key, new TextEncoder().encode(String(score)));
    }).then(function (buf) {
      var out = new Uint8Array(iv.length + buf.byteLength);
      out.set(iv, 0); out.set(new Uint8Array(buf), iv.length);
      var s = ""; out.forEach(function (b) { s += String.fromCharCode(b); });
      return btoa(s);
    });
  }
  function submitScore(score) {
    var key = CFG.crazygames && CFG.crazygames.leaderboardKey;
    if (!cg() || !key || !window.crypto || !window.crypto.subtle) return Promise.resolve(false);
    return encryptScore(score, key).then(function (enc) {
      sdk.user.submitScore({ encryptedScore: enc, score: score });
      return true;
    }).catch(function (e) { console.warn("[platform] submitScore failed", e); return false; });
  }

  window.addEventListener("pagehide", flush);
  document.addEventListener("visibilitychange", function () { if (document.hidden) flush(); });

  window.WLPlat = {
    name: name,
    isCrazy: function () { return name === "crazygames"; },
    init: init, on: on,
    load: load, save: save, flush: flush,
    gameplayStart: gameplayStart, gameplayStop: gameplayStop, loadingStart: loadingStart, loadingStop: loadingStop, happytime: happytime,
    hasAds: hasAds, midgame: midgame, rewarded: rewarded, hasAdblock: hasAdblock, adActive: function () { return adActive; },
    lastAdError: function () { return lastAdError; },
    muteForced: function () { return muteForced; },
    getUser: getUser, locale: locale,
    shareLink: shareLink, inviteParam: inviteParam, submitScore: submitScore,
    // Web-only extras (external share buttons, Firebase leaderboard, links to other pages)
    allowExternal: function () { return name !== "crazygames"; }
  };
})();
