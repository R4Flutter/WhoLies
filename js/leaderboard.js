/*
  WHO'S LYING? — leaderboard + top-100 rewards
  Backend: Firebase (Firestore + anonymous sign-in), free plan is plenty.
  Switched on by pasting your Firebase web config into js/config.js (see README).
  Add ?lb=demo to the address to try the leaderboard with demo players (nothing is uploaded).

  WLLB.enabled()                      is the leaderboard switched on?
  WLLB.submitDaily(entry)             post today's result      -> Promise
  WLLB.submitEndless(entry)           post an endless best     -> Promise
  WLLB.topDaily(day) / topEndless()   top 100 lists            -> Promise<rows>
  WLLB.myId()                         this player's id (after the first call)
  WLLB.rewardsFor(days, history)      finished days -> ranks   -> Promise<[{day, rank}]>
*/
(function () {
  "use strict";
  var CFG = (window.WL_CONFIG && window.WL_CONFIG.leaderboard) || {};
  var fb = CFG.firebase;
  var provider = fb && fb.apiKey && fb.projectId ? "firebase" : "none";
  try { if (new URLSearchParams(location.search).get("lb") === "demo") provider = "demo"; } catch (e) { /* ignore */ }

  var SDK = "https://www.gstatic.com/firebasejs/10.12.2/";
  var LIMIT = 100;
  var db = null, uid = null, readyP = null;

  var TIERS = [
    { max: 1, icon: "🥇", name: "Chief Inspector" },
    { max: 2, icon: "🥈", name: "Inspector" },
    { max: 3, icon: "🥉", name: "Sergeant" },
    { max: 10, icon: "🎖️", name: "Detective" },
    { max: 100, icon: "🏅", name: "Sharp Eye" }
  ];
  function tierFor(rank) {
    for (var i = 0; i < TIERS.length; i++) if (rank >= 1 && rank <= TIERS[i].max) return TIERS[i];
    return null;
  }

  /* Names: 2-16 letters, numbers, spaces, . _ - and a small block list. */
  var BLOCK = /(fuck|shit|bitch|cunt|nigg|fag|rape|nazi|hitler|porn|sex|dick|pussy|whore|slut|chutiya|madarchod|bhenchod|randi|gandu)/i;
  function cleanName(raw) {
    var n = String(raw || "").replace(/\s+/g, " ").trim();
    if (n.length < 2 || n.length > 16) return { ok: false, msg: "Use 2 to 16 characters." };
    if (!/^[\p{L}\p{N} ._-]+$/u.test(n)) return { ok: false, msg: "Use letters, numbers, spaces, dots, dashes or underscores." };
    if (BLOCK.test(n.replace(/[\s._-]/g, ""))) return { ok: false, msg: "Please pick a different name." };
    return { ok: true, name: n };
  }

  /* The leaderboard for a day closes 38 hours after that day starts in UTC,
     after every time zone has finished it. Rewards are given after that. */
  function dayStartUTC(d) {
    var p = String((window.WL_CONFIG || {}).launchDate || "2026-10-26").split("-").map(Number);
    return Date.UTC(p[0], p[1] - 1, p[2]) + (d - 1) * 86400000;
  }
  function isFinal(d) { return Date.now() >= dayStartUTC(d) + 38 * 3600000; }

  function loadScript(src) {
    return new Promise(function (res, rej) {
      var s = document.createElement("script");
      s.src = src; s.async = false;
      s.onload = res;
      s.onerror = function () { rej(new Error("Couldn't load " + src)); };
      document.head.appendChild(s);
    });
  }

  function ready() {
    if (readyP) return readyP;
    if (provider === "demo") { uid = demoId(); readyP = Promise.resolve(uid); return readyP; }
    if (provider !== "firebase") return Promise.reject(new Error("Leaderboard is off"));
    readyP = loadScript(SDK + "firebase-app-compat.js")
      .then(function () { return loadScript(SDK + "firebase-auth-compat.js"); })
      .then(function () { return loadScript(SDK + "firebase-firestore-compat.js"); })
      .then(function () {
        var firebase = window.firebase;
        if (!firebase.apps.length) firebase.initializeApp(fb);
        db = firebase.firestore();
        return firebase.auth().signInAnonymously();
      })
      .then(function (cred) { uid = cred.user.uid; return uid; });
    readyP.catch(function (e) { console.warn("[leaderboard]", e && e.message ? e.message : e); readyP = null; });
    return readyP;
  }

  function friendlyError(e) {
    var code = e && e.code ? e.code : "";
    if (code === "failed-precondition") {
      console.warn("[leaderboard] Firestore needs an index. Open the link in this message to create it:", e.message);
      return "The leaderboard is still being set up. Try again in a few minutes.";
    }
    if (code === "permission-denied") return "The leaderboard didn't accept that score.";
    if (code === "unavailable" || !navigator.onLine) return "You're offline. Check your connection and try again.";
    return "Couldn't reach the leaderboard. Try again in a moment.";
  }

  /* ---------- demo backend (local only, clearly labelled in the UI) ---------- */
  var DEMO_KEY = "whoslying:lbdemo";
  var DEMO_NAMES = ["Sherlock_K", "NoirNeha", "AgentOmar", "Miss Marple", "TruthSeeker", "Kenji.D", "LieDetector", "Amara77", "Inspector V",
    "Detective Li", "CaseClosed", "Priya_P", "Sam Spade", "ColdCase", "Zara Q", "Hiro", "Lucía", "Femi", "Astrid", "Rafael",
    "SharpEyes", "Watson2", "Nadia", "Poirot_fan", "Arjun", "Jonas", "Mei", "Diego", "Ingrid", "Kwame"];
  function demoId() {
    try { var id = localStorage.getItem(DEMO_KEY + ":id"); if (!id) { id = "demo-" + Math.random().toString(36).slice(2, 10); localStorage.setItem(DEMO_KEY + ":id", id); } return id; }
    catch (e) { return "demo-me"; }
  }
  function demoStore() { try { return JSON.parse(localStorage.getItem(DEMO_KEY)) || { scores: {}, endless: {} }; } catch (e) { return { scores: {}, endless: {} }; } }
  function demoSave(s) { try { localStorage.setItem(DEMO_KEY, JSON.stringify(s)); } catch (e) { /* ignore */ } }
  function demoRivals(day) {
    var r = window.WL.rngFrom("lbdemo-" + day), out = [];
    for (var i = 0; i < DEMO_NAMES.length; i++) {
      var score = 5 - Math.floor(Math.pow(r(), 1.7) * 4);
      out.push({ uid: "rival" + i, name: DEMO_NAMES[i], badge: i < 3 ? TIERS[i].icon : r() < 0.2 ? TIERS[4].icon : "", day: day, score: score, timeMs: Math.round(55000 + r() * 160000) });
    }
    return out;
  }
  function sortDaily(rows) { return rows.sort(function (a, b) { return b.score - a.score || a.timeMs - b.timeMs; }); }

  /* ---------- public API ---------- */
  window.WLLB = {
    provider: provider,
    TIERS: TIERS,
    enabled: function () { return provider !== "none"; },
    isDemo: function () { return provider === "demo"; },
    myId: function () { return uid; },
    cleanName: cleanName,
    tierFor: tierFor,
    isFinal: isFinal,
    friendlyError: friendlyError,

    submitDaily: function (e) {
      return ready().then(function () {
        var doc = { uid: uid, name: e.name, badge: e.badge || "", day: e.day, score: e.score, timeMs: Math.max(20000, Math.round(e.timeMs)), grid: e.grid };
        if (provider === "demo") {
          var s = demoStore(); s.scores[e.day + "_" + uid] = s.scores[e.day + "_" + uid] || doc; demoSave(s); return true;
        }
        doc.createdAt = window.firebase.firestore.FieldValue.serverTimestamp();
        return db.collection("scores").doc(e.day + "_" + uid).set(doc).then(function () { return true; }, function (err) {
          if (err && err.code === "permission-denied") return false; // already posted today, or outside the time window
          throw err;
        });
      });
    },

    submitEndless: function (e) {
      return ready().then(function () {
        var doc = { uid: uid, name: e.name, badge: e.badge || "", best: e.best };
        if (provider === "demo") {
          var s = demoStore(); var old = s.endless[uid];
          if (!old || old.best < e.best) { s.endless[uid] = doc; demoSave(s); }
          return true;
        }
        doc.updatedAt = window.firebase.firestore.FieldValue.serverTimestamp();
        return db.collection("endless").doc(uid).set(doc).then(function () { return true; }, function (err) {
          if (err && err.code === "permission-denied") return false; // not higher than the saved best
          throw err;
        });
      });
    },

    topDaily: function (day) {
      return ready().then(function () {
        if (provider === "demo") {
          var s = demoStore(), mine = [];
          Object.keys(s.scores).forEach(function (k) { if (s.scores[k].day === day) mine.push(s.scores[k]); });
          return sortDaily(demoRivals(day).concat(mine)).slice(0, LIMIT);
        }
        return db.collection("scores").where("day", "==", day).orderBy("score", "desc").orderBy("timeMs", "asc").limit(LIMIT).get()
          .then(function (snap) { return snap.docs.map(function (d) { return d.data(); }); });
      });
    },

    topEndless: function () {
      return ready().then(function () {
        if (provider === "demo") {
          var s = demoStore(), r = window.WL.rngFrom("lbdemo-endless");
          var rows = DEMO_NAMES.map(function (n, i) { return { uid: "rival" + i, name: n, badge: i < 2 ? TIERS[i].icon : "", best: Math.round(4 + r() * 40) }; });
          Object.keys(s.endless).forEach(function (k) { rows.push(s.endless[k]); });
          return rows.sort(function (a, b) { return b.best - a.best; }).slice(0, LIMIT);
        }
        return db.collection("endless").orderBy("best", "desc").limit(LIMIT).get()
          .then(function (snap) { return snap.docs.map(function (d) { return d.data(); }); });
      });
    },

    /* For each finished day the player posted a score on, find their final rank. */
    rewardsFor: function (days) {
      return ready().then(function () {
        var jobs = days.filter(isFinal).map(function (d) {
          return window.WLLB.topDaily(d).then(function (rows) {
            var rank = 0;
            for (var i = 0; i < rows.length; i++) if (rows[i].uid === uid) { rank = i + 1; break; }
            return { day: d, rank: rank };
          });
        });
        return Promise.all(jobs);
      });
    }
  };
})();
