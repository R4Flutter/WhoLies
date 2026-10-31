/*
  WHO'S LYING? — progression and rewards
  Pure game rules, no screens: levels and titles, coins, stars, combo,
  power-ups, the shop, daily missions, the 7-day login calendar and achievements.
  The game screens (game.js) call these and show the results.
*/
(function () {
  "use strict";
  var WL = window.WL;
  var S = null, hooks = {};

  /* ---------- levels and titles ---------- */
  var TITLES = [
    [1, "Rookie"], [5, "Patrol Officer"], [10, "Junior Detective"], [15, "Detective"], [20, "Senior Detective"],
    [25, "Sergeant"], [30, "Lieutenant"], [35, "Inspector"], [40, "Chief Inspector"], [45, "Commissioner"], [50, "Legend"]
  ];
  function xpNeed(level) { return 80 + 30 * (level - 1); }
  function levelInfo(xp) {
    var lvl = 1, left = xp;
    while (left >= xpNeed(lvl)) { left -= xpNeed(lvl); lvl++; }
    return { level: lvl, into: left, need: xpNeed(lvl), title: titleFor(lvl), tier: tierFor(lvl) };
  }
  function tierFor(level) { var t = 0; TITLES.forEach(function (x, i) { if (level >= x[0]) t = i; }); return t; }
  function titleFor(level) { return TITLES[tierFor(level)][1]; }
  function nextTitle(level) { var t = tierFor(level); return TITLES[t + 1] || null; }

  /* ---------- shop ---------- */
  var ITEMS = {
    magnifier1: { kind: "item", item: "magnifier", qty: 1, price: 60, name: "Magnifier", desc: "Rules out one wrong answer." },
    magnifier5: { kind: "item", item: "magnifier", qty: 5, price: 250, name: "5 Magnifiers", desc: "Save 50 coins." },
    freeze1: { kind: "item", item: "freeze", qty: 1, price: 50, name: "Time Freeze", desc: "Adds 10 seconds in Rush." },
    freeze3: { kind: "item", item: "freeze", qty: 3, price: 120, name: "3 Time Freezes", desc: "Save 30 coins." },
    shield1: { kind: "item", item: "shield", qty: 1, price: 200, name: "Streak Shield", desc: "Saves your Daily streak if you miss a day. Hold up to 2." },
    key1: { kind: "item", item: "key", qty: 1, price: 120, name: "Case Key", desc: "Catch up on a Daily Case you missed, with full rewards." },
    key3: { kind: "item", item: "key", qty: 3, price: 300, name: "3 Case Keys", desc: "Save 60 coins." }
  };
  var MAX_SHIELDS = 2;
  var THEMES = [
    { id: "auto", name: "Match my device", price: 0, swatch: ["#e7eee5", "#0e1612", "#c22438"] },
    { id: "precinct", name: "Precinct", price: 0, swatch: ["#e7eee5", "#142029", "#c22438"] },
    { id: "night", name: "Night Shift", price: 0, swatch: ["#0e1612", "#e2ebe1", "#ff5c6c"] },
    { id: "sepia", name: "Sepia Files", price: 500, swatch: ["#efe2c8", "#3b2a1a", "#a2361f"] },
    { id: "blueprint", name: "Blueprint", price: 900, swatch: ["#123a63", "#e8f1ff", "#ffd23f"] },
    { id: "neon", name: "Neon Noir", price: 1500, swatch: ["#140f24", "#f1e9ff", "#ff2e88"] },
    { id: "gold", name: "Gold Badge", price: 2500, swatch: ["#1b1a17", "#f4ead2", "#e0b23c"] }
  ];

  /* ---------- 7-day login calendar ---------- */
  var LOGIN = [
    { coins: 30 }, { coins: 40 }, { coins: 20, magnifier: 1 }, { coins: 60 },
    { coins: 40, freeze: 1 }, { coins: 80 }, { coins: 150, magnifier: 2, key: 1 }
  ];

  /* ---------- daily missions ---------- */
  var MISSION_TYPES = [
    { type: "career", targets: [3, 5, 8], reward: [40, 60, 80], text: function (n) { return "Solve " + n + " career cases"; } },
    { type: "stars3", targets: [2, 3, 5], reward: [50, 60, 80], text: function (n) { return "Earn 3 stars on " + n + " cases"; } },
    { type: "rushcatch", targets: [8, 12, 20], reward: [40, 60, 80], text: function (n) { return "Catch " + n + " liars in Rush"; } },
    { type: "combo", targets: [3, 5, 7], reward: [40, 60, 80], text: function (n) { return "Solve " + n + " in a row on the first try"; } },
    { type: "daily", targets: [1], reward: [60], text: function () { return "Finish today's Daily Case"; } },
    { type: "twist", targets: [1, 2], reward: [40, 60], text: function (n) { return "Solve " + n + " twist case" + (n > 1 ? "s" : ""); } },
    { type: "nohint", targets: [4, 6], reward: [40, 60], text: function (n) { return "Solve " + n + " cases without a hint"; } }
  ];
  var CHEST = { coins: 100, magnifier: 1 };

  /* ---------- achievements ---------- */
  var ACH = [
    { id: "first", name: "First Collar", desc: "Solve your first case", stat: "solved", goal: 1, coins: 25 },
    { id: "solved25", name: "On the Beat", desc: "Solve 25 cases", stat: "solved", goal: 25, coins: 75 },
    { id: "solved100", name: "Case Hardened", desc: "Solve 100 cases", stat: "solved", goal: 100, coins: 200 },
    { id: "solved500", name: "Living Legend", desc: "Solve 500 cases", stat: "solved", goal: 500, coins: 600 },
    { id: "stars10", name: "Sharp Eye", desc: "Get 3 stars on 10 cases", stat: "stars3", goal: 10, coins: 100 },
    { id: "stars50", name: "Perfectionist", desc: "Get 3 stars on 50 cases", stat: "stars3", goal: 50, coins: 300 },
    { id: "nohint25", name: "No Help Needed", desc: "Solve 25 cases without a hint", stat: "nohint", goal: 25, coins: 150 },
    { id: "twist10", name: "Twist Master", desc: "Solve 10 twist cases", stat: "twists", goal: 10, coins: 150 },
    { id: "combo10", name: "Hot Streak", desc: "Solve 10 cases in a row on the first try", stat: "bestCombo", goal: 10, coins: 150 },
    { id: "combo25", name: "Unstoppable", desc: "Solve 25 cases in a row on the first try", stat: "bestCombo", goal: 25, coins: 400 },
    { id: "rush15", name: "Quick Thinker", desc: "Catch 15 liars in one Rush run", stat: "rushBest", goal: 15, coins: 100 },
    { id: "rush30", name: "Lightning Mind", desc: "Catch 30 liars in one Rush run", stat: "rushBest", goal: 30, coins: 250 },
    { id: "rush50", name: "Polygraph Breaker", desc: "Catch 50 liars in one Rush run", stat: "rushBest", goal: 50, coins: 500 },
    { id: "daily7", name: "Regular", desc: "Finish 7 Daily Cases", stat: "dailyDone", goal: 7, coins: 150 },
    { id: "perfectday", name: "Perfect Day", desc: "Catch all 5 liars in a Daily Case", stat: "perfectDays", goal: 1, coins: 100 },
    { id: "chapter1", name: "Rookie No More", desc: "Finish chapter 1", stat: "chapters", goal: 1, coins: 50 },
    { id: "chapter3", name: "Harbor Master", desc: "Finish chapter 3", stat: "chapters", goal: 3, coins: 150 },
    { id: "chapter5", name: "Night Owl", desc: "Finish chapter 5", stat: "chapters", goal: 5, coins: 300 },
    { id: "chapter10", name: "Final Verdict", desc: "Finish chapter 10", stat: "chapters", goal: 10, coins: 800 },
    { id: "level10", name: "Promoted", desc: "Reach level 10", stat: "level", goal: 10, coins: 100 },
    { id: "level25", name: "Decorated", desc: "Reach level 25", stat: "level", goal: 25, coins: 250 },
    { id: "theme", name: "New Look", desc: "Buy a desk theme", stat: "themesBought", goal: 1, coins: 50 },
    { id: "streak7", name: "Week Warrior", desc: "Play the Daily Case 7 days in a row", stat: "bestStreak", goal: 7, coins: 100 },
    { id: "streak30", name: "Iron Habit", desc: "Play the Daily Case 30 days in a row", stat: "bestStreak", goal: 30, coins: 500 },
    { id: "shield", name: "Saved by the Shield", desc: "Let a Streak Shield save your streak", stat: "shieldSaves", goal: 1, coins: 50 },
    { id: "night5", name: "Graveyard Shift", desc: "Solve 5 Night Shift cases", stat: "nights", goal: 5, coins: 150 },
    { id: "master1", name: "Mastermind Hunter", desc: "Catch the mastermind in a Case of the Week", stat: "masterminds", goal: 1, coins: 150 },
    { id: "master4", name: "Most Wanted", desc: "Catch 4 weekly masterminds", stat: "masterminds", goal: 4, coins: 400 },
    { id: "rival3", name: "Top Dog", desc: "Beat 3 friends' challenges", stat: "challengesWon", goal: 3, coins: 150 },
    { id: "promoted", name: "Moving Up", desc: "Get promoted in the weekly league", stat: "promotions", goal: 1, coins: 100 }
  ];

  /* ---------- helpers ---------- */
  function todayKey(d) {
    d = d || new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function daysBetween(a, b) {
    var pa = a.split("-").map(Number), pb = b.split("-").map(Number);
    return Math.round((Date.UTC(pb[0], pb[1] - 1, pb[2]) - Date.UTC(pa[0], pa[1] - 1, pa[2])) / 86400000);
  }
  function emit(name, data) { if (hooks[name]) try { hooks[name](data); } catch (e) { console.error(e); } }

  function ensure(state) {
    S = state;
    S.xp = S.xp || 0;
    S.coins = S.coins || 0;
    S.inv = Object.assign({ magnifier: 3, freeze: 1, shield: 1, key: 2 }, S.inv || {});
    S.career = Object.assign({ level: 1, stars: {}, combo: 0 }, S.career || {});
    S.tot = Object.assign({ solved: 0, stars3: 0, nohint: 0, twists: 0, bestCombo: 0, rushBest: 0, dailyDone: 0, perfectDays: 0, chapters: 0, themesBought: 0, liars: 0,
      bestStreak: 0, shieldSaves: 0, nights: 0, masterminds: 0, challengesWon: 0, promotions: 0 }, S.tot || {});
    S.themes = Object.assign({ owned: ["auto", "precinct", "night"], current: "auto" }, S.themes || {});
    S.ach = S.ach || {};
    S.login = S.login || { last: "", streak: 0, pending: false };
    S.missions = S.missions || { date: "", list: [], chest: false };
    S.cool = S.cool || {};
    // old saves: carry over endless best and daily totals
    if (S.endless && S.endless.best > S.tot.rushBest) S.tot.rushBest = S.endless.best;
    if (S.stats && S.stats.played > S.tot.dailyDone) { S.tot.dailyDone = S.stats.played; S.tot.perfectDays = Math.max(S.tot.perfectDays, S.stats.perfect || 0); }
    return S;
  }

  /* ---------- coins, items, xp ---------- */
  function addCoins(n) { S.coins = Math.max(0, S.coins + n); emit("coins", { delta: n, total: S.coins }); }
  function addItem(item, n) { S.inv[item] = (S.inv[item] || 0) + n; }
  // Gives a reward. Shields over the limit turn into 100 coins each.
  function grant(reward) {
    if (!reward) return;
    if (reward.coins) addCoins(reward.coins);
    ["magnifier", "freeze", "key"].forEach(function (k) { if (reward[k]) addItem(k, reward[k]); });
    if (reward.shield) {
      var room = Math.max(0, MAX_SHIELDS - (S.inv.shield || 0)), add = Math.min(room, reward.shield);
      addItem("shield", add);
      if (reward.shield > add) addCoins(100 * (reward.shield - add));
    }
  }
  function addXp(n) {
    var before = levelInfo(S.xp);
    S.xp += Math.max(0, Math.round(n));
    var after = levelInfo(S.xp);
    for (var l = before.level + 1; l <= after.level; l++) {
      var reward = { coins: 20 + 5 * l };
      var newTitle = tierFor(l) > tierFor(l - 1);
      if (newTitle) reward.magnifier = 1;
      grant(reward);
      emit("levelup", { level: l, title: titleFor(l), newTitle: newTitle, reward: reward });
    }
    checkAch();
    return after;
  }

  /* ---------- recording play ---------- */
  function comboMult(c) { return 1 + 0.1 * Math.min(c, 10); }

  // A career case was solved. wrong = number of wrong picks before the right one.
  function careerSolved(o) {
    var n = o.level, spec = WL.careerSpec(n), replay = n < S.career.level;
    var stars = o.wrong > 0 ? 1 : (!o.hint && o.seconds <= spec.par ? 3 : 2);
    var firstTry = o.wrong === 0;
    S.career.combo = firstTry ? S.career.combo + 1 : 0;
    var prev = S.career.stars[n] || 0;
    if (stars > prev) S.career.stars[n] = stars;
    var ch = spec.chapter, mult = comboMult(S.career.combo);
    var coins = replay ? 0 : [0, 8, 12, 20][stars] + Math.floor(ch / 2) * 2;
    var xp = Math.round((20 + 3 * Math.min(ch, 10)) * (stars === 3 ? 1.5 : stars === 2 ? 1.2 : 1) * mult * (replay ? 0.25 : 1));
    var chapterDone = false;
    if (!replay) {
      S.career.level = n + 1;
      if (n % 10 === 0) { chapterDone = true; S.tot.chapters = Math.max(S.tot.chapters, ch); coins += 60 + 10 * ch; }
    }
    S.tot.solved++; S.tot.liars++;
    if (stars === 3 && prev < 3) S.tot.stars3++;
    if (!o.hint) S.tot.nohint++;
    if (spec.mode !== "liar") S.tot.twists++;
    S.tot.bestCombo = Math.max(S.tot.bestCombo, S.career.combo);
    missionProgress("career", 1);
    if (stars === 3) missionProgress("stars3", 1);
    if (!o.hint) missionProgress("nohint", 1);
    if (spec.mode !== "liar") missionProgress("twist", 1);
    missionMax("combo", S.career.combo);
    if (coins) addCoins(coins);
    var lvl = addXp(xp);
    checkAch();
    return { stars: stars, prevStars: prev, coins: coins, xp: xp, combo: S.career.combo, mult: mult, replay: replay, chapterDone: chapterDone, chapter: ch, levelInfo: lvl, par: spec.par };
  }
  function careerWrong() { S.career.combo = 0; }

  // Rush: one liar caught (combo = current run combo)
  function rushCatch(o) {
    var mult = comboMult(o.combo);
    var coins = 4 + Math.min(o.combo, 10);
    var xp = Math.round(12 * mult);
    S.tot.solved++; S.tot.liars++;
    if (!o.hint) S.tot.nohint++;
    if (o.twist) { S.tot.twists++; missionProgress("twist", 1); }
    if (!o.hint) missionProgress("nohint", 1);
    missionProgress("rushcatch", 1);
    missionMax("combo", o.combo);
    S.tot.bestCombo = Math.max(S.tot.bestCombo, o.combo);
    addCoins(coins);
    addXp(xp);
    return { coins: coins, xp: xp, mult: mult };
  }
  function rushEnd(score) {
    var bonus = Math.floor(score / 5) * 10;
    if (bonus) addCoins(bonus);
    S.tot.rushBest = Math.max(S.tot.rushBest, score);
    checkAch();
    return { bonus: bonus };
  }

  // Daily: one result per case, and the end of the day's set
  function dailyCase(o) {
    if (o.replay && !o.catchup) return { coins: 0, xp: o.correct ? 10 : 0 };
    var coins = o.correct ? 12 : 0, xp = o.correct ? 35 : 5;
    if (o.correct) {
      S.tot.solved++; S.tot.liars++;
      if (!o.hint) { S.tot.nohint++; missionProgress("nohint", 1); }
      if (o.twist) { S.tot.twists++; missionProgress("twist", 1); }
    }
    if (coins) addCoins(coins);
    addXp(xp);
    return { coins: coins, xp: xp };
  }
  function dailyDone(score, replay, catchup) {
    if (replay && !catchup) return { bonus: 0, perfect: 0 };
    S.tot.dailyDone++;
    var done = 25, perfect = score === 5 ? 50 : 0;
    if (score === 5) S.tot.perfectDays++;
    addCoins(done + perfect);
    if (!catchup) missionProgress("daily", 1);
    checkAch();
    return { bonus: done, perfect: perfect };
  }

  /* ---------- streaks, shields, keys, comeback ---------- */
  // After a Daily: every 7th day in a row pays a Case Key and a Streak Shield.
  function streakDay(streak) {
    S.tot.bestStreak = Math.max(S.tot.bestStreak, streak);
    var reward = streak > 0 && streak % 7 === 0 ? { key: 1, shield: 1 } : null;
    grant(reward);
    checkAch();
    return reward;
  }
  // On start-up: shields cover the days missed since the last Daily, if there are enough of them.
  function coverStreak(today) {
    var st = S.stats;
    if (!st || st.streak < 1 || !st.lastDay) return null;
    var missed = today - 1 - st.lastDay;
    if (missed < 1 || missed > (S.inv.shield || 0)) return null;
    S.inv.shield -= missed;
    st.lastDay = today - 1;
    S.tot.shieldSaves += missed;
    checkAch();
    return { used: missed, streak: st.streak };
  }
  var COMEBACK = { coins: 150, magnifier: 2, key: 1 };
  function comeback() { grant(COMEBACK); return COMEBACK; }

  /* ---------- Night Shift + Case of the Week ---------- */
  function nightDone(o) {
    var coins = o.correct ? 40 : 0, xp = o.correct ? 60 : 10;
    if (o.correct) {
      S.tot.solved++; S.tot.liars++; S.tot.nights++;
      if (!o.hint) { S.tot.nohint++; missionProgress("nohint", 1); }
      if (o.twist) { S.tot.twists++; missionProgress("twist", 1); }
    }
    if (coins) addCoins(coins);
    addXp(xp);
    return { coins: coins, xp: xp };
  }
  function mastermindDone(correct) {
    var coins = correct ? 250 : 40, xp = correct ? 200 : 30;
    if (correct) S.tot.masterminds++;
    addCoins(coins);
    addXp(xp);
    return { coins: coins, xp: xp };
  }
  function count(stat) { S.tot[stat] = (S.tot[stat] || 0) + 1; checkAch(); }

  /* ---------- missions ---------- */
  function ensureMissions() {
    var key = todayKey();
    if (S.missions.date === key && S.missions.list.length) return S.missions;
    var r = WL.rngFrom("missions-" + key), types = WL.shuffle(MISSION_TYPES, r);
    // the first mission always has the easiest target
    var list = types.slice(0, 3).map(function (t, i) {
      var k = i === 0 ? 0 : Math.floor(r() * t.targets.length);
      return { type: t.type, target: t.targets[k], reward: t.reward[k], progress: 0, claimed: false };
    });
    S.missions = { date: key, list: list, chest: false };
    return S.missions;
  }
  function missionText(m) {
    for (var i = 0; i < MISSION_TYPES.length; i++) if (MISSION_TYPES[i].type === m.type) return MISSION_TYPES[i].text(m.target);
    return "";
  }
  function missionProgress(type, n) {
    ensureMissions();
    S.missions.list.forEach(function (m) {
      if (m.type !== type || m.progress >= m.target) return;
      m.progress = Math.min(m.target, m.progress + n);
      if (m.progress >= m.target) emit("mission", { text: missionText(m), reward: m.reward });
    });
  }
  function missionMax(type, value) {
    ensureMissions();
    S.missions.list.forEach(function (m) {
      if (m.type !== type || m.progress >= m.target) return;
      if (value > m.progress) {
        m.progress = Math.min(m.target, value);
        if (m.progress >= m.target) emit("mission", { text: missionText(m), reward: m.reward });
      }
    });
  }
  function claimMission(i) {
    var m = ensureMissions().list[i];
    if (!m || m.claimed || m.progress < m.target) return null;
    m.claimed = true;
    addCoins(m.reward);
    return { coins: m.reward };
  }
  function chestReady() {
    var ms = ensureMissions();
    return !ms.chest && ms.list.every(function (m) { return m.claimed; });
  }
  function claimChest() {
    if (!chestReady()) return null;
    S.missions.chest = true;
    grant(CHEST);
    return CHEST;
  }
  function missionsToClaim() {
    var ms = ensureMissions();
    return ms.list.filter(function (m) { return !m.claimed && m.progress >= m.target; }).length + (chestReady() ? 1 : 0);
  }

  /* ---------- login calendar ---------- */
  // Call once per visit. Returns the reward waiting today (or null).
  function checkLogin() {
    var key = todayKey(), L = S.login;
    if (L.last === key) return L.pending ? { day: L.streak, reward: LOGIN[(L.streak - 1) % 7] } : null;
    var gap = L.last ? daysBetween(L.last, key) : 99;
    L.streak = gap === 1 ? L.streak + 1 : 1;
    L.last = key;
    L.pending = true;
    return { day: L.streak, reward: LOGIN[(L.streak - 1) % 7] };
  }
  function claimLogin(double) {
    var L = S.login;
    if (!L.pending) return null;
    L.pending = false;
    var r = Object.assign({}, LOGIN[(L.streak - 1) % 7]);
    if (double) r.coins *= 2;
    grant(r);
    return r;
  }

  /* ---------- achievements ---------- */
  function statValue(stat) {
    if (stat === "level") return levelInfo(S.xp).level;
    return S.tot[stat] || 0;
  }
  function checkAch() {
    ACH.forEach(function (a) {
      if (S.ach[a.id]) return;
      if (statValue(a.stat) >= a.goal) {
        S.ach[a.id] = 1;
        addCoins(a.coins);
        emit("achievement", a);
      }
    });
  }
  function achList() {
    return ACH.map(function (a) {
      return { id: a.id, name: a.name, desc: a.desc, coins: a.coins, done: !!S.ach[a.id], value: Math.min(a.goal, statValue(a.stat)), goal: a.goal };
    });
  }

  /* ---------- shop ---------- */
  function buy(id) {
    var it = ITEMS[id];
    if (it) {
      if (it.item === "shield" && (S.inv.shield || 0) >= MAX_SHIELDS) return { ok: false, msg: "You can hold " + MAX_SHIELDS + " shields at a time." };
      if (S.coins < it.price) return { ok: false, msg: "You need " + (it.price - S.coins) + " more coins." };
      addCoins(-it.price); addItem(it.item, it.qty);
      return { ok: true, msg: it.name + " added." };
    }
    var th = THEMES.filter(function (t) { return t.id === id; })[0];
    if (th) {
      if (S.themes.owned.indexOf(id) >= 0) { S.themes.current = id; return { ok: true, msg: th.name + " is on.", theme: id }; }
      if (S.coins < th.price) return { ok: false, msg: "You need " + (th.price - S.coins) + " more coins." };
      addCoins(-th.price);
      S.themes.owned.push(id); S.themes.current = id; S.tot.themesBought++;
      checkAch();
      return { ok: true, msg: th.name + " unlocked!", theme: id, bought: true };
    }
    return { ok: false, msg: "That item isn't available." };
  }
  function useItem(item) {
    if ((S.inv[item] || 0) <= 0) return false;
    S.inv[item]--;
    return true;
  }

  /* ---------- cooldowns for rewarded offers ---------- */
  function coolLeft(name, seconds) { var t = S.cool[name] || 0; return Math.max(0, t + seconds * 1000 - Date.now()); }
  function coolStart(name) { S.cool[name] = Date.now(); }

  window.WLP = {
    init: function (state, h) { hooks = h || {}; return ensure(state); },
    levelInfo: levelInfo, titleFor: titleFor, nextTitle: nextTitle, tierFor: tierFor, TITLES: TITLES,
    ITEMS: ITEMS, THEMES: THEMES, LOGIN: LOGIN, CHEST: CHEST, COMEBACK: COMEBACK, MAX_SHIELDS: MAX_SHIELDS,
    streakDay: streakDay, coverStreak: coverStreak, comeback: comeback, nightDone: nightDone, mastermindDone: mastermindDone, count: count,
    addCoins: addCoins, grant: grant, addXp: addXp,
    careerSolved: careerSolved, careerWrong: careerWrong,
    rushCatch: rushCatch, rushEnd: rushEnd, dailyCase: dailyCase, dailyDone: dailyDone, comboMult: comboMult,
    ensureMissions: ensureMissions, missionText: missionText, claimMission: claimMission, chestReady: chestReady,
    claimChest: claimChest, missionsToClaim: missionsToClaim,
    checkLogin: checkLogin, claimLogin: claimLogin,
    achList: achList, checkAch: checkAch,
    buy: buy, useItem: useItem, coolLeft: coolLeft, coolStart: coolStart, todayKey: todayKey
  };
})();
