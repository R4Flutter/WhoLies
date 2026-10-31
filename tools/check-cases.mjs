// Checks the case library and the generator for mistakes.
// Run from the game folder:  node tools/check-cases.mjs
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import vm from "node:vm";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const ctx = { window: {}, console, Intl, Date, Math, location: { origin: "null" }, localStorage: undefined };
ctx.window = ctx;
vm.createContext(ctx);
for (const f of ["js/config.js", "js/cases.js", "js/engine.js"]) {
  vm.runInContext(readFileSync(join(root, f), "utf8"), ctx, { filename: f });
}
const { WL_CASES: C, WL } = ctx;
let problems = 0;
const fail = (where, msg) => { problems++; console.log(`✗ ${where}: ${msg}`); };

function checkCase(c, where, generated) {
  const mode = c.mode || "liar";
  if (!["liar", "honest", "planted"].includes(mode)) fail(where, `unknown mode "${mode}"`);
  for (const k of ["title", "setup", "why"]) if (!c[k] || typeof c[k] !== "string") fail(where, `missing "${k}"`);
  if (!Array.isArray(c.clues) || c.clues.length < 2 || c.clues.length > 5) fail(where, "needs 2 to 5 clues");
  if (!Array.isArray(c.suspects) || c.suspects.length !== 3) fail(where, "needs exactly 3 suspects");
  (c.suspects || []).forEach((s, i) => {
    if (!s.name || !s.role || !s.says) fail(where, `suspect ${i} needs name, role and says`);
  });
  const names = new Set((c.suspects || []).map((s) => s.name));
  if (names.size !== 3) fail(where, "suspect names must be different");
  const max = mode === "planted" ? c.clues.length : 3;
  if (!Number.isInteger(c.answer) || c.answer < 0 || c.answer >= max) fail(where, `answer must be 0-${max - 1}`);
  if (!generated && mode !== "planted" && !c.why.includes(c.suspects[c.answer]?.name ?? "§")) {
    fail(where, `"why" doesn't mention the answer (${c.suspects[c.answer]?.name})`);
  }
}

C.medium.forEach((c, i) => checkCase(c, `medium #${i + 1} "${c.title}"`));
C.hard.forEach((c, i) => checkCase(c, `hard #${i + 1} "${c.title}"`));
C.twist.forEach((c, i) => {
  if (!c.mode) fail(`twist #${i + 1}`, 'twist cases need mode "honest" or "planted"');
  checkCase(c, `twist #${i + 1} "${c.title}"`);
});

// Generator + daily builder: 400 days and 600 endless cases.
const seen = new Set();
for (let d = 1; d <= 400; d++) {
  const day = WL.buildDay(d);
  if (day.length !== 5) fail(`day ${d}`, "should have 5 cases");
  day.forEach((c, i) => checkCase(c, `day ${d} case ${i + 1}`, true));
  seen.add(JSON.stringify(day[0]));
}
for (let n = 1; n <= 600; n++) {
  const spec = WL.endlessSpec(n);
  const c = WL.generateCase(WL.rngFrom("t" + n), { ...spec, avoid: { names: {}, premises: {}, facts: {} } });
  checkCase(c, `endless ${n}`, true);
}
// Career: 500 levels. Rush: 300 cases with growing difficulty.
const repeats = [];
for (let n = 1; n <= 500; n++) {
  const c = WL.buildCareerLevel(n);
  checkCase(c, `career ${n}`, n > 1);
  if (n > 1 && WL.buildCareerLevel(n - 1).title === c.title) repeats.push(n);
  const spec = WL.careerSpec(n);
  if (spec.mode !== c.mode) fail(`career ${n}`, "mode doesn't match its spec");
}
if (repeats.length) fail("career", `same story opener twice in a row at levels ${repeats.slice(0, 5).join(", ")}`);
for (let n = 1; n <= 300; n++) {
  const spec = WL.endlessSpec(n);
  const c = WL.generateCase(WL.rngFrom("rush" + n), { ...spec, avoid: { names: {}, premises: {}, facts: {} } });
  checkCase(c, `rush ${n}`, true);
}
// Parametric facts: times must stay inside one day and prices must make sense.
for (let n = 1; n <= 2000; n++) {
  const c = WL.generateCase(WL.rngFrom("p" + n), { mode: "liar", clueCount: 5, maxTier: 3, needTier: 3, avoid: { names: {}, premises: {}, facts: {} } });
  const text = JSON.stringify(c);
  if (/NaN|undefined|\$-|\$0\b/.test(text)) fail(`number puzzle ${n}`, "bad number in: " + text.slice(0, 160));
}
// Night Shift: 400 days.
for (let d = 1; d <= 400; d++) checkCase(WL.buildNight(d), `night ${d}`, true);
// Case of the Week: 400 weeks. The mastermind fits every clue, everyone else is ruled out,
// and every clue rules out someone that no other clue does (so no clue is wasted).
for (let w = 1; w <= 400; w++) {
  const k = WL.buildWeek(w), where = `week ${w}`;
  if (k.suspects.length !== 8 || k.clues.length !== 6) { fail(where, "needs 8 suspects and 6 clues"); continue; }
  if (new Set(k.suspects.map((s) => s.name)).size !== 8) fail(where, "suspect names must be different");
  const hits = {};
  k.clues.forEach((c) => {
    if (c.out.includes(k.answer)) fail(where, `a clue rules out the mastermind: ${c.text}`);
    c.out.forEach((s) => { hits[s] = (hits[s] || 0) + 1; });
  });
  if (Object.keys(hits).length !== 7) fail(where, "the clues don't rule out everyone else");
  k.clues.forEach((c, i) => { if (!c.out.some((s) => hits[s] === 1)) fail(where, `clue ${i + 1} isn't needed`); });
}
const careerA = JSON.stringify(WL.buildCareerLevel(77));
// Same day must build the same cases every time (everyone plays the same puzzle).
const a = JSON.stringify(WL.buildDay(7)), b = JSON.stringify(WL.generateCase && WL.buildDay(7));
if (a !== b) fail("determinism", "day 7 changed between builds");

console.log(`\nHand-written: ${C.medium.length} medium, ${C.hard.length} hard, ${C.twist.length} twist`);
console.log(`Hand-written dailies last ${Math.min(C.medium.length, C.hard.length, C.twist.length)} days; after that the generator takes over.`);
console.log(`Generator: ${WL.FACTS.length} facts (${WL.FACTS.filter(f => f.make).length} with random times/prices), ${WL.PREMISES.length} story openers, ${seen.size} different opening cases in 400 days.`);
console.log(`Career: checked 500 levels (${Math.ceil(500 / 10)} chapters). Rush: checked 300 cases.`);
console.log(problems ? `\n${problems} problem(s) found.` : "\nAll good. No problems found.");
process.exit(problems ? 1 : 0);
