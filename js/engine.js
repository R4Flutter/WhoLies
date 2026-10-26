/*
  WHO'S LYING? — engine
  Shared by the game (index.html) and the past-cases page (archive.html).
  - seeded random numbers (everyone gets the same daily cases)
  - day numbers and dates
  - the case generator (endless mode + backup when the hand-written list runs out)
  - suspect portraits (small SVG sketches)
  - saved progress (localStorage)
*/
(function () {
  "use strict";
  var CFG = window.WL_CONFIG || {};
  var CASES = window.WL_CASES || { medium: [], hard: [], twist: [] };

  /* ---------- seeded random ---------- */
  function hashString(str) {
    var h1 = 1779033703 ^ str.length;
    for (var i = 0; i < str.length; i++) {
      h1 = Math.imul(h1 ^ str.charCodeAt(i), 3432918353);
      h1 = (h1 << 13) | (h1 >>> 19);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
    h1 = Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (h1 ^= h1 >>> 16) >>> 0;
  }
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function rngFrom(seed) { return mulberry32(hashString(String(seed))); }
  function pick(arr, rng) { return arr[Math.floor(rng() * arr.length)]; }
  function shuffle(arr, rng) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /* ---------- days ---------- */
  var DAY_MS = 86400000;
  function launchUTC() {
    var p = String(CFG.launchDate || "2026-10-26").split("-").map(Number);
    return Date.UTC(p[0], p[1] - 1, p[2]);
  }
  function dayNumber(date) {
    var d = date || new Date();
    var today = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
    return Math.max(1, Math.floor((today - launchUTC()) / DAY_MS) + 1);
  }
  function dateForDay(n) {
    var u = new Date(launchUTC() + (n - 1) * DAY_MS);
    return new Date(u.getUTCFullYear(), u.getUTCMonth(), u.getUTCDate());
  }
  function formatDate(date, style) {
    try {
      return new Intl.DateTimeFormat("en", style === "short"
        ? { day: "numeric", month: "short", year: "numeric" }
        : { weekday: "long", day: "numeric", month: "long" }).format(date);
    } catch (e) { return date.toDateString(); }
  }
  function msToNextDay() {
    var n = new Date();
    var next = new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1);
    return next - n;
  }

  /* ---------- generator data ----------
     Each fact belongs to a group. A case never uses two facts from the same
     group, because facts in one group can contradict each other's stories
     (for example: a blackout would also stop the elevator). */
  var FACTS = [
    { id: "rain", group: "sky", clue: "It rained hard all evening, from 6 PM to midnight.",
      truths: ["I got soaked walking home. I forgot my umbrella.", "I shared an umbrella with a stranger on the way home.", "My shoes are still wet from last night."],
      lies: [
        { say: "I walked home at nine under a clear, starry sky.", why: "It rained hard all evening, so there was no starry sky at nine." },
        { say: "I sat on a park bench until ten with no umbrella and stayed perfectly dry.", why: "It rained hard until midnight. Nobody sits outside with no umbrella and stays dry." }
      ] },
    { id: "snow", group: "sky", clue: "Thick snow covered every street from 7 PM onward.",
      truths: ["I had to clear the snow off my car before I could leave.", "I walked home slowly. The pavement was so slippery.", "My boots were full of snow when I got in."],
      lies: [
        { say: "I cycled home at nine. The roads were completely dry.", why: "Thick snow covered every street from 7 PM, so the roads were not dry at nine." },
        { say: "At ten I walked across the park on the green grass in my sandals.", why: "Snow covered everything from 7 PM. There was no green grass to walk on at ten." }
      ] },
    { id: "fog", group: "sky", clue: "Fog was so thick last night that you could not see five meters ahead.",
      truths: ["I drove at walking speed with my hazard lights on.", "I nearly walked into a lamppost in the fog.", "I couldn't even see the house across the street."],
      lies: [
        { say: "From my balcony I clearly saw a man running at the far end of the street.", why: "You could not see five meters in that fog, so nobody clearly saw the far end of a street." },
        { say: "I watched the full moon rise over the rooftops. Such a clear night!", why: "The fog was so thick you could not see five meters. It was not a clear night." }
      ] },
    { id: "heat", group: "sky", clue: "It was the hottest night of the year: still 36°C at midnight.",
      truths: ["I couldn't sleep, so I sat by the open window.", "I bought three ice lollies on the way home.", "I was sweating even in a T-shirt and shorts."],
      lies: [
        { say: "I wore my thick winter coat on the walk home. I was freezing!", why: "It was still 36°C at midnight. Nobody was freezing that night." },
        { say: "It was so cold that my breath made little clouds in the air.", why: "At 36°C your breath doesn't make clouds. It was the hottest night of the year." }
      ] },
    { id: "streetlights", group: "sky", clue: "Every street light on Lake Road was broken last night.",
      truths: ["Lake Road was pitch black, so I used my phone torch.", "I tripped on a curb on Lake Road. I couldn't see a thing."],
      lies: [
        { say: "I sat on a bench on Lake Road and read my book under the street lights.", why: "Every street light on Lake Road was broken, so they gave no light to read by." },
        { say: "The street lights on Lake Road were so bright that I could read every number plate.", why: "Every street light on Lake Road was broken last night." }
      ] },
    { id: "blackout", group: "power", clue: "A blackout cut all power in the building from 8 PM to 11 PM.",
      truths: ["When the lights went out, I lit some candles and waited.", "I found my way down the stairs with my phone torch.", "My fridge stopped humming at eight. It was so quiet."],
      lies: [
        { say: "I watched the football on TV in my flat from nine to ten.", why: "There was no power in the building from 8 to 11 PM, so the TV could not work." },
        { say: "At nine I heated up leftovers in my microwave.", why: "The power was out from 8 to 11 PM, so the microwave could not work." },
        { say: "I vacuumed my whole flat at half past eight.", why: "The power went out at 8 PM. A vacuum cleaner can't run without power." }
      ] },
    { id: "elevator", group: "power", clue: "The building's elevator has been out of order all week.",
      truths: ["I had to carry my shopping up nine floors of stairs.", "My legs still hurt from all those stairs."],
      lies: [
        { say: "I took the elevator down to the lobby last night to collect a parcel.", why: "The elevator has been out of order all week, so nobody rode it last night." },
        { say: "I got stuck chatting with a neighbor in the elevator on my way up.", why: "The elevator has been out of order all week." }
      ] },
    { id: "internet", group: "power", clue: "The internet was down in the whole neighborhood all evening.",
      truths: ["With the internet down, I played board games with my roommates.", "I couldn't do any work online, so I read a paper book."],
      lies: [
        { say: "I watched three episodes of my favorite show on our home Wi-Fi last evening.", why: "The internet was down in the whole neighborhood all evening, so the home Wi-Fi had no internet." },
        { say: "I spent the evening uploading holiday photos from my laptop at home.", why: "The internet was down in the neighborhood all evening, so nothing could be uploaded from home." }
      ] },
    { id: "signal", group: "signal", clue: "There is no phone signal or Wi-Fi in the building's basement.",
      truths: ["I had to go up to the street to make a call.", "I left my phone upstairs. It's useless in the basement anyway."],
      lies: [
        { say: "I sat in the basement laundry room, texting my brother the whole time.", why: "There is no signal or Wi-Fi in the basement, so no texts could be sent from there." },
        { say: "I took a work call while I was fixing my bike in the basement.", why: "There is no phone signal in the basement." }
      ] },
    { id: "train", group: "train", clue: "The 9:15 PM train was cancelled, and no trains ran after it.",
      truths: ["I missed the last train, so I shared a taxi with a stranger.", "I waited on the platform until they said the 9:15 was cancelled."],
      lies: [
        { say: "I came home on the 10 PM train, like always.", why: "No trains ran after 9:15 PM, so there was no 10 PM train." },
        { say: "I caught the 9:15 train, and it was right on time.", why: "The 9:15 train was cancelled." }
      ] },
    { id: "bus", group: "bus", clue: "There were no buses all day yesterday because of a strike.",
      truths: ["With the bus strike, I walked all the way to work.", "With the bus strike, I had to ask my neighbor for a lift to work."],
      lies: [
        { say: "I took the number 12 bus home yesterday evening.", why: "There were no buses all day because of the strike." },
        { say: "The bus last night was so crowded that I had to stand.", why: "There were no buses at all yesterday because of the strike." }
      ] },
    { id: "bridge", group: "bridge", clue: "The Old Bridge was closed all night for repairs.",
      truths: ["I drove the long way round because the Old Bridge was shut.", "I saw the barriers on the Old Bridge and turned back."],
      lies: [
        { say: "I drove over the Old Bridge at about ten.", why: "The Old Bridge was closed all night for repairs." },
        { say: "I walked across the Old Bridge at midnight to look at the river.", why: "The Old Bridge was closed all night." }
      ] },
    { id: "parking", group: "parking", clue: "The parking garage was closed all day for repairs.",
      truths: ["I had to park three streets away.", "I drove around for twenty minutes looking for a space on the street."],
      lies: [
        { say: "I parked in the parking garage at six, in my usual spot.", why: "The parking garage was closed all day for repairs." }
      ] },
    { id: "cafe", group: "weekday", clue: "Café Luna is closed every Monday. Yesterday was Monday.",
      truths: ["I wanted a coffee at Café Luna, but it was shut.", "Café Luna was closed yesterday, so I had my coffee somewhere else."],
      lies: [
        { say: "I had a slice of cake at Café Luna yesterday afternoon.", why: "Café Luna is closed on Mondays, and yesterday was Monday." }
      ] },
    { id: "library", group: "library", clue: "The city library closed early yesterday, at 4 PM, for a staff party.",
      truths: ["I got to the library at five and it was already closed.", "I studied at home because the library shut early."],
      lies: [
        { say: "I studied in the library until seven yesterday, then went home.", why: "The library closed at 4 PM, so nobody was studying there at seven." }
      ] },
    { id: "cinema", group: "cinema", clue: "The cinema's last film started at 7 PM and ended at 9 PM.",
      truths: ["I watched the 7 PM film and left when it finished.", "I got to the cinema at 9:30, but the last film had already ended."],
      lies: [
        { say: "I watched the 10 PM horror film at the cinema.", why: "The last film started at 7 PM. There was no 10 PM showing." }
      ] },
    { id: "bakery", group: "bakery", clue: "The bakery sold out of everything by noon yesterday.",
      truths: ["I went to the bakery at two and the shelves were empty.", "I wanted bread in the afternoon, but the bakery was sold out."],
      lies: [
        { say: "I bought a warm loaf at the bakery at 5 PM yesterday.", why: "The bakery sold out of everything by noon." }
      ] },
    { id: "paint", group: "paint", clue: "The hallway walls were painted yesterday afternoon. The wet paint has no marks at all.",
      truths: ["I kept away from the walls. The smell of paint was awful.", "I saw the wet paint signs and walked down the middle of the hall."],
      lies: [
        { say: "I leaned on the hallway wall for ten minutes while I waited.", why: "The wet paint has no marks at all. Leaning on it for ten minutes would leave a big smudge." }
      ] },
    { id: "card", group: "card", clue: "The bar's card machine was broken all night. It was cash only.",
      truths: ["I had to run to a cash machine before I could order.", "I paid for my drink with coins."],
      lies: [
        { say: "I paid for everyone's drinks at the bar with my card.", why: "The card machine was broken all night, so nobody could pay by card." }
      ] },
    { id: "pool", group: "pool", clue: "The swimming pool has been empty for cleaning all week.",
      truths: ["I went for a run instead, because the pool was empty.", "I saw the cleaners scrubbing the empty pool."],
      lies: [
        { say: "I swam twenty laps in the pool yesterday evening.", why: "The pool has been empty all week, so nobody could swim in it." }
      ] },
    { id: "dog", group: "dog", clue: "Bruno, the guard dog, barks at every stranger. He didn't bark once all night.",
      truths: ["Bruno knows me. He just wagged his tail when I came in.", "It was very quiet. I didn't hear Bruno at all."],
      lies: [
        { say: "At midnight Bruno was barking like crazy at someone by the gate.", why: "Bruno didn't bark once all night." }
      ] },
    { id: "clock", group: "clock", clue: "The town hall clock has been stuck at 6:00 for a week.",
      truths: ["The town hall clock still says six, so I checked my phone.", "That town hall clock has said six o'clock all week. Someone should fix it."],
      lies: [
        { say: "I looked up at the town hall clock and it said 9:40 exactly.", why: "The town hall clock has been stuck at 6:00 for a week." }
      ] },
    { id: "water", group: "water", clue: "The water was shut off in the whole building from 6 PM to 6 AM.",
      truths: ["I couldn't even brush my teeth last night. The taps were dry.", "I bought bottled water so I could at least brush my teeth."],
      lies: [
        { say: "I took a long, hot shower at ten last night.", why: "The water in the building was off from 6 PM to 6 AM." },
        { say: "I washed all the dishes in my sink after dinner, around eight.", why: "The water was off from 6 PM to 6 AM." }
      ] },
    { id: "gas", group: "gas", clue: "The gas was shut off in the building all day for repairs.",
      truths: ["I couldn't cook, so I ordered food.", "I ate a cold sandwich for dinner. No gas."],
      lies: [
        { say: "I cooked a big pot of soup on my gas stove for dinner.", why: "The gas in the building was shut off all day." }
      ] },
    { id: "camera", group: "camera", clue: "The building's only security camera records in black and white.",
      truths: ["I checked the camera footage. The picture was grainy and grey.", "On the camera footage, you can't tell what color anything is."],
      lies: [
        { say: "I watched the camera footage. The thief's jacket was bright yellow.", why: "The camera only records in black and white, so nobody could see a yellow jacket on it." }
      ] },
    { id: "roof", group: "roof", clue: "The roof door is always locked. The only key is in the caretaker's safe.",
      truths: ["I wanted some fresh air, but the roof door was locked.", "I've never been up on the roof. It's always locked."],
      lies: [
        { say: "I went up to the roof last night to get some fresh air.", why: "The roof door is always locked, and the only key is in the caretaker's safe." }
      ] },
    { id: "coffee", group: "coffee", clue: "The office coffee machine has been broken all week.",
      truths: ["I brought tea from home because the coffee machine is broken.", "I stood in front of the broken coffee machine and sighed."],
      lies: [
        { say: "I made myself two coffees from the office machine yesterday.", why: "The office coffee machine has been broken all week." }
      ] }
  ];

  var PREMISES = [
    { title: "The Vanishing Ring", setup: "A diamond ring vanished from Flat 4B last night." },
    { title: "After Closing Time", setup: "Someone broke into the Hartley bakery after closing." },
    { title: "The Comic Collector", setup: "A rare comic book was stolen from a collector's shop." },
    { title: "The Secret Laptop", setup: "A laptop full of secrets disappeared from a locked office." },
    { title: "Flat Tires", setup: "Someone let the air out of all four tires on the mayor's car." },
    { title: "The Gold Watch", setup: "A gold watch went missing from a hotel room." },
    { title: "The Ruined Cake", setup: "The prize-winning cake at the town fair was ruined overnight." },
    { title: "The Fake Painting", setup: "A painting at a small gallery was swapped for a fake." },
    { title: "The Tip Jar", setup: "Someone stole the tip jar from a busy café." },
    { title: "The Lost Guitar", setup: "A vintage guitar vanished from a music school." },
    { title: "The Rare Stamp", setup: "A valuable stamp disappeared from the post office museum." },
    { title: "The Broken Window", setup: "Someone smashed the front window of a sports shop." },
    { title: "The School Trophy", setup: "The champions' trophy disappeared from the school hall." },
    { title: "The Box Office", setup: "A bag of money vanished from the cinema box office." },
    { title: "The Rare Orchid", setup: "A rare orchid was stolen from the city greenhouse." },
    { title: "The Wiped Drive", setup: "Someone wiped the hard drive of a game studio's main computer." },
    { title: "The Copied Recipe", setup: "A secret recipe was copied from a restaurant's safe." },
    { title: "The Missing Headphones", setup: "Expensive headphones went missing from a radio station." },
    { title: "The Torn Dress", setup: "A wedding dress was cut to pieces in a tailor's shop." },
    { title: "The Stolen Bike", setup: "A brand-new racing bike was stolen from a locked bike shed." },
    { title: "The Empty Safe", setup: "The safe in a jewelry workshop was found open and empty." },
    { title: "The Kidnapped Cat", setup: "Mrs. Lin's prize-winning cat was taken from her flat. (Don't worry, he's fine.)" },
    { title: "The Graffiti Wall", setup: "Someone sprayed paint all over the new town hall mural." },
    { title: "The Missing Keys", setup: "The master keys to the whole building disappeared from the caretaker's desk." }
  ];

  var NAMES = ["Aarav", "Priya", "Kenji", "Mei", "Omar", "Layla", "Diego", "Sofia", "Kwame", "Amara",
    "Lars", "Freya", "Mateo", "Valentina", "Arjun", "Ananya", "Yusuf", "Fatima", "Hiro", "Yuna",
    "Noah", "Emma", "Liam", "Olivia", "Neha", "Lin", "Tomás", "Lucía", "Zara", "Ivan",
    "Ahmed", "Nadia", "Jonas", "Ingrid", "Camila", "Sanjay", "Divya", "Kai", "Leilani", "Felix",
    "Clara", "Hamza", "Aisha", "Malik", "Imani", "Rafael", "Dev", "Isha", "Sven", "Astrid",
    "Marco", "Giulia", "Femi", "Ada", "Jae", "Nikolai", "Vera", "Ruby", "Sami", "Leila",
    "Bilal", "Maya", "Óscar", "Elena", "Tariq", "Nora", "Ravi", "Hana", "Emeka", "Anouk"];
  var ROLES = ["Neighbor", "Cleaner", "Delivery driver", "Night guard", "Cook", "Student", "Shop owner",
    "Taxi driver", "Nurse", "Tourist", "Gardener", "Waiter", "Mechanic", "Teacher", "Plumber", "Artist",
    "Accountant", "Photographer", "Florist", "Baker", "DJ", "Receptionist", "Builder", "Librarian",
    "Pharmacist", "Programmer", "Musician", "Caretaker", "Dog walker", "Electrician"];

  var TWIST_LINES = {
    honest: ["Two liars, one goal: getting away with it.", "The two liars were covering for each other.", "Two stories, both made up. They planned this together."],
    planted: ["Someone planted that fact to send the police the wrong way.", "The fake fact was meant to frame an innocent person.", "A planted clue is the oldest trick in the book."]
  };

  /* Pick facts from different groups. Facts used recently are avoided when possible. */
  function pickFacts(count, rng, avoidIds) {
    var avoid = avoidIds || {};
    var pool = shuffle(FACTS, rng);
    var fresh = pool.filter(function (f) { return !avoid[f.id]; });
    var stale = pool.filter(function (f) { return avoid[f.id]; });
    var ordered = fresh.concat(stale), used = {}, out = [];
    for (var i = 0; i < ordered.length && out.length < count; i++) {
      if (!used[ordered[i].group]) { used[ordered[i].group] = 1; out.push(ordered[i]); }
    }
    return out;
  }

  /*
    opts.mode: "liar" | "honest" | "planted"
    opts.clueCount: 3 or 4 (extra clues are harmless distractions)
    opts.avoid: { names: {}, premises: {}, facts: {} } — keeps a day or a run varied
  */
  function generateCase(rng, opts) {
    opts = opts || {};
    var mode = opts.mode || "liar";
    var avoid = opts.avoid || { names: {}, premises: {}, facts: {} };
    var clueCount = Math.max(3, opts.clueCount || 3);

    var premises = PREMISES.filter(function (p) { return !avoid.premises[p.title]; });
    var premise = pick(premises.length ? premises : PREMISES, rng);
    avoid.premises[premise.title] = 1;

    var facts = pickFacts(clueCount, rng, avoid.facts);
    facts.forEach(function (f) { avoid.facts[f.id] = 1; });
    var spoken = facts.slice(0, 3); // suspect i talks about spoken[i]

    var names = shuffle(NAMES.filter(function (n) { return !avoid.names[n]; }), rng).slice(0, 3);
    var roles = shuffle(ROLES, rng).slice(0, 3);
    names.forEach(function (n) { avoid.names[n] = 1; });

    var target = Math.floor(rng() * 3);
    var suspects = [], whyParts = [];
    for (var i = 0; i < 3; i++) {
      var f = spoken[i], lie = pick(f.lies, rng);
      var liar = (mode === "liar" && i === target) || (mode === "honest" && i !== target);
      var says;
      if (mode === "planted" && i === target) says = lie.say;      // true story that exposes the fake fact
      else if (liar) { says = lie.say; whyParts.push({ name: names[i], why: lie.why }); }
      else says = pick(f.truths, rng);
      suspects.push({ name: names[i], role: roles[i], says: says });
    }

    var clueOrder = shuffle(facts.map(function (_, k) { return k; }), rng);
    var clues = clueOrder.map(function (k) { return facts[k].clue; });

    var answer, why;
    if (mode === "planted") {
      answer = clueOrder.indexOf(target);
      why = "Everyone told the truth, so the fact \u201c" + facts[target].clue + "\u201d must be fake. " + names[target] + "'s story proves it.";
    } else if (mode === "honest") {
      answer = target;
      why = names[target] + " told the truth. " + whyParts.map(function (w) { return w.name + " lied: " + w.why; }).join(" ");
    } else {
      answer = target;
      why = whyParts[0].why;
    }

    return {
      title: premise.title,
      setup: premise.setup,
      clues: clues,
      suspects: suspects,
      mode: mode,
      answer: answer,
      why: why,
      twist: mode === "liar" ? null : pick(TWIST_LINES[mode], rng),
      level: opts.level || (mode === "liar" ? "easy" : "twist"),
      source: "generated"
    };
  }

  /* Hand-written case -> game case, with suspects and clues shuffled the same way for everyone. */
  function prepHand(c, level, rng) {
    var mode = c.mode || "liar";
    var sOrder = shuffle([0, 1, 2], rng);
    var cOrder = shuffle(c.clues.map(function (_, i) { return i; }), rng);
    return {
      title: c.title,
      setup: c.setup,
      clues: cOrder.map(function (i) { return c.clues[i]; }),
      suspects: sOrder.map(function (i) { return c.suspects[i]; }),
      mode: mode,
      answer: mode === "planted" ? cOrder.indexOf(c.answer) : sOrder.indexOf(c.answer),
      why: c.why,
      twist: c.twist || null,
      level: level,
      source: "hand"
    };
  }

  var dayCache = {};
  function buildDay(day) {
    if (dayCache[day]) return dayCache[day];
    var i = day - 1;
    var seed = function (slot) { return rngFrom("wl-day-" + day + "-slot-" + slot); };
    var avoid = { names: {}, premises: {}, facts: {} };
    var hand = {
      2: CASES.medium[i] ? prepHand(CASES.medium[i], "medium", seed(2)) : null,
      4: CASES.hard[i] ? prepHand(CASES.hard[i], "hard", seed(4)) : null,
      5: CASES.twist[i] ? prepHand(CASES.twist[i], "twist", seed(5)) : null
    };
    Object.keys(hand).forEach(function (k) {
      if (hand[k]) hand[k].suspects.forEach(function (s) { avoid.names[s.name] = 1; });
    });
    var twistMode = day % 2 ? "honest" : "planted";
    var list = [
      generateCase(seed(1), { mode: "liar", clueCount: 3, level: "easy", avoid: avoid }),
      hand[2] || generateCase(seed(2), { mode: "liar", clueCount: 3, level: "medium", avoid: avoid }),
      generateCase(seed(3), { mode: "liar", clueCount: 4, level: "medium", avoid: avoid }),
      hand[4] || generateCase(seed(4), { mode: "liar", clueCount: 4, level: "hard", avoid: avoid }),
      hand[5] || generateCase(seed(5), { mode: twistMode, clueCount: 3, level: "twist", avoid: avoid })
    ];
    dayCache[day] = list;
    return list;
  }

  /* Endless mode: case n (1, 2, 3...). Every 5th case is a twist. */
  function endlessSpec(n) {
    if (n % 5 === 0) return { mode: (n / 5) % 2 ? "honest" : "planted", clueCount: 3, level: "twist" };
    return { mode: "liar", clueCount: n <= 3 ? 3 : 4, level: n <= 3 ? "easy" : "medium" };
  }
  function endlessSeconds(n) {
    var base = Math.max(25, 50 - Math.floor((n - 1) / 5) * 4);
    return endlessSpec(n).mode === "liar" ? base : base + 10;
  }

  /* ---------- suspect portraits ----------
     Small police-sketch style faces, drawn from the name so a person always
     looks the same. Colors come from CSS tokens. */
  function avatar(name) {
    var r = rngFrom("face:" + name);
    var hair = Math.floor(r() * 7);
    var eyes = Math.floor(r() * 3);
    var mouth = Math.floor(r() * 4);
    var tL = (r() * 4 - 1).toFixed(1), tR = (r() * 4 - 1).toFixed(1);
    var glasses = r() < 0.26, mustache = r() < 0.2, beard = !mustache && r() < 0.14, earrings = r() < 0.16;
    var p = [];
    p.push('<path class="cloth" d="M7 64 C8 52 19 47.5 32 47.5 C45 47.5 56 52 57 64 Z"/>');
    p.push('<path class="ln" d="M7 64 C8 52 19 47.5 32 47.5 C45 47.5 56 52 57 64"/>');
    p.push('<path class="ln" d="M27 43 L27 48.5 M37 43 L37 48.5 M27 48.5 L32 53 L37 48.5"/>');
    p.push('<ellipse class="skin" cx="19.5" cy="32" rx="2.6" ry="4"/><ellipse class="skin" cx="44.5" cy="32" rx="2.6" ry="4"/>');
    p.push('<ellipse class="skin" cx="32" cy="31" rx="13" ry="16"/>');
    if (hair === 1) p.push('<path class="hair" d="M18 31 C16 13 48 13 46 31 L47.5 47 C43 45 44 37 44 32 C42 23 22 23 20 32 C20 37 21 45 16.5 47 Z"/>');
    if (beard) p.push('<path class="hair" d="M19.5 32 C20 45 26 47.5 32 47.5 C38 47.5 44 45 44.5 32 C42.5 40 38.5 43.5 32 43.5 C25.5 43.5 21.5 40 19.5 32 Z"/>');
    switch (hair) {
      case 0: p.push('<path class="hair" d="M19 29 C18 14 46 14 45 29 C43 22 38 19.5 32 19.5 C26 19.5 21 22 19 29 Z"/>'); break;
      case 1: p.push('<path class="hair" d="M19 30 C19 15 45 15 45 30 C41 22 35 21 31 21 C26 21 21 24 19 30 Z"/>'); break;
      case 2: p.push('<path class="ln thin" d="M23 19.5 Q32 15 41 19.5"/><path class="hair" d="M19.2 28 C19 24 20 22 21.5 21 L21.5 29 Z M44.8 28 C45 24 44 22 42.5 21 L42.5 29 Z"/>'); break;
      case 3:
        [19.5, 24.5, 29.5, 34.5, 39.5, 44.5].forEach(function (x, k) { p.push('<circle class="hair" cx="' + x + '" cy="' + (k % 2 ? 17 : 19.5) + '" r="5"/>'); });
        p.push('<path class="hair" d="M18 26 C18 20 46 20 46 26 C42 23 22 23 18 26 Z"/>'); break;
      case 4: p.push('<circle class="hair" cx="32" cy="11.5" r="5.5"/><path class="hair" d="M19 29 C18 14 46 14 45 29 C43 22 38 19.5 32 19.5 C26 19.5 21 22 19 29 Z"/>'); break;
      case 5: p.push('<path class="hair" d="M19 30 C17 16 30 13 40 15.5 C46 17 47.5 23 45 30 C42 22 33 21.5 26 21 C23 23 21 26 19 30 Z"/>'); break;
      case 6: p.push('<path class="hair" d="M21.5 19 C21 8 43 8 42.5 19 Z"/><rect class="band" x="21.6" y="15" width="20.8" height="2.2"/><ellipse class="hair" cx="32" cy="19.5" rx="20" ry="3.4"/>'); break;
    }
    var ey = 31;
    p.push('<path class="ln" d="M22.5 ' + (26 + +tL) + ' L29 25.2 M35 25.2 L41.5 ' + (26 + +tR) + '"/>');
    if (eyes === 0) p.push('<circle class="ink" cx="26.2" cy="' + ey + '" r="1.7"/><circle class="ink" cx="37.8" cy="' + ey + '" r="1.7"/>');
    else if (eyes === 1) p.push('<path class="ln" d="M23.6 ' + ey + ' L28.8 ' + ey + ' M35.2 ' + ey + ' L40.4 ' + ey + '"/>');
    else p.push('<path class="ln" d="M23.8 ' + (ey + 0.6) + ' Q26.2 ' + (ey - 1.6) + ' 28.6 ' + (ey + 0.6) + ' M35.4 ' + (ey + 0.6) + ' Q37.8 ' + (ey - 1.6) + ' 40.2 ' + (ey + 0.6) + '"/>');
    if (glasses) p.push('<circle class="ln" cx="26.2" cy="' + ey + '" r="4.3"/><circle class="ln" cx="37.8" cy="' + ey + '" r="4.3"/><path class="ln" d="M30.5 ' + ey + ' L33.5 ' + ey + '"/>');
    p.push('<path class="ln" d="M32 32 L30 37.5 L33.4 37.5"/>');
    if (mustache) p.push('<path class="hair" d="M26.5 39.6 Q32 36.8 37.5 39.6 Q32 41.2 26.5 39.6 Z"/>');
    var mClass = beard ? "ln paper" : "ln";
    var mouths = ["M28 42 L36 42", "M28 42 Q32.5 44 36.4 40.4", "M28 43 Q32 40.4 36 43", "M28.5 41.6 Q32 43.4 35.5 41.6"];
    p.push('<path class="' + mClass + '" d="' + mouths[mouth] + '"/>');
    if (earrings) p.push('<circle class="ln" cx="19.2" cy="37.6" r="1.6"/><circle class="ln" cx="44.8" cy="37.6" r="1.6"/>');
    return '<svg class="face" viewBox="0 0 64 64" aria-hidden="true" focusable="false">' + p.join("") + "</svg>";
  }

  /* ---------- saved progress ---------- */
  var KEY = "whoslying:v1";
  function load() {
    try { var s = JSON.parse(localStorage.getItem(KEY)); return s && typeof s === "object" ? s : {}; }
    catch (e) { return {}; }
  }
  function save(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* storage blocked: game still works */ } }

  /* ---------- small helpers ---------- */
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function fmtTime(ms) {
    var s = Math.max(0, Math.round(ms / 1000));
    return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
  }
  function fmtCountdown(ms) {
    var s = Math.max(0, Math.floor(ms / 1000));
    var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    return String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0") + ":" + String(sec).padStart(2, "0");
  }
  /* Analytics hook: forwards to Google Analytics (gtag) or Plausible if you add one. */
  function track(name, data) {
    try {
      if (typeof window.gtag === "function") window.gtag("event", name, data || {});
      if (typeof window.plausible === "function") window.plausible(name, { props: data || {} });
    } catch (e) { /* ignore */ }
  }
  function siteUrl() {
    var u = CFG.siteUrl || "";
    if (!u || /example/.test(u)) u = location.origin && location.origin !== "null" ? location.origin : "";
    return u.replace(/\/$/, "");
  }

  window.WL = {
    cfg: CFG, rngFrom: rngFrom, shuffle: shuffle, pick: pick,
    dayNumber: dayNumber, dateForDay: dateForDay, formatDate: formatDate, msToNextDay: msToNextDay,
    buildDay: buildDay, generateCase: generateCase, endlessSpec: endlessSpec, endlessSeconds: endlessSeconds,
    avatar: avatar, load: load, save: save, esc: esc, fmtTime: fmtTime, fmtCountdown: fmtCountdown,
    track: track, siteUrl: siteUrl, FACTS: FACTS, PREMISES: PREMISES, CASES: CASES
  };
})();
