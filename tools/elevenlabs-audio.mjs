// Generates the game's sound effects and background music with ElevenLabs.
// It overwrites the files in assets/audio/ (same names), so the game uses them automatically.
//
// Needs Node.js 18 or newer. Your API key is read from an environment variable
// and is never written to any file. Keep it out of the repo.
//
//   Windows (PowerShell):  $env:ELEVENLABS_API_KEY="sk_..."; node tools/elevenlabs-audio.mjs
//   macOS / Linux:         ELEVENLABS_API_KEY=sk_... node tools/elevenlabs-audio.mjs
//
// Options:
//   --only tap,stamp    make only these sounds
//   --no-music          skip the background music
//   --music-only        make only the background music
//
// Each run uses ElevenLabs credits. The sound list below is easy to edit:
// change a prompt, then run with --only <name> to remake just that one.

import { writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const KEY = process.env.ELEVENLABS_API_KEY;
if (!KEY) {
  console.error("Set ELEVENLABS_API_KEY first. See the comment at the top of this file.");
  process.exit(1);
}
const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "assets", "audio");
const API = "https://api.elevenlabs.io/v1";
const args = process.argv.slice(2);
const only = (args.find((a, i) => args[i - 1] === "--only") || "").split(",").filter(Boolean);

const SOUNDS = [
  { name: "tap", seconds: 0.5, text: "single soft pencil tap on paper, short dry click, close mic, no reverb" },
  { name: "stamp", seconds: 0.8, text: "rubber stamp slammed hard onto paper on a wooden desk, one heavy thump" },
  { name: "correct", seconds: 1.5, text: "short bright jazz vibraphone two-note rising chime, success sound, case solved" },
  { name: "wrong", seconds: 1.2, text: "short low muted trombone sliding down two notes, mild failure sting, film noir" },
  { name: "tick", seconds: 0.5, text: "single crisp mechanical clock tick, dry, close" },
  { name: "timeout", seconds: 1.5, text: "old mechanical alarm bell ringing briefly then stopping" },
  { name: "twist", seconds: 2.5, text: "dramatic film noir suspense sting, low piano hit with rising tense strings, short" },
  { name: "fanfare", seconds: 3, text: "short jazzy film noir success jingle, upright bass, vibraphone arpeggio, brushed cymbal, case closed" },
  { name: "fail", seconds: 3, text: "short sad film noir jingle, slow falling vibraphone notes over upright bass" },
  { name: "whoosh", seconds: 0.6, text: "paper file folder sliding quickly across a desk, soft whoosh" },
  { name: "coin", seconds: 0.5, text: "single bright gold coin dropped onto a pile of coins, short sparkly clink, game reward" },
  { name: "star", seconds: 0.6, text: "short magical sparkle chime, one bright bell twinkle, game star earned" },
  { name: "levelup", seconds: 2, text: "short triumphant jazzy brass level up jingle, rising three notes, mobile game reward" },
  { name: "combo", seconds: 0.7, text: "quick rising synth whoosh with a bright ping at the end, combo streak sound" },
  { name: "click", seconds: 0.5, text: "soft clean user interface button click, short, dry" },
  { name: "buy", seconds: 1, text: "old cash register ka-ching with a small bell, short purchase sound" },
  { name: "achieve", seconds: 2, text: "short sparkling achievement unlocked chime, ascending bells with a soft cymbal swell" }
];
const MUSIC_PROMPT =
  "Slow, moody film noir detective jazz, instrumental, made to loop as background music for a puzzle game. " +
  "Walking upright bass, brushed snare, soft ride cymbal, mellow vibraphone chords and a sparse muted trumpet melody. " +
  "About 84 BPM, A minor, smoky late-night office mood. Calm and steady, no vocals, no big build-ups, no ending.";

async function post(path, body) {
  const res = await fetch(API + path, {
    method: "POST",
    headers: { "xi-api-key": KEY, "Content-Type": "application/json", Accept: "audio/mpeg" },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${msg.slice(0, 300)}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

async function save(name, buf) {
  await writeFile(join(OUT, name + ".mp3"), buf);
  console.log(`✓ ${name}.mp3  ${(buf.length / 1024).toFixed(0)} KB`);
}

await mkdir(OUT, { recursive: true });
let failed = 0;

if (!args.includes("--music-only")) {
  for (const s of SOUNDS) {
    if (only.length && !only.includes(s.name)) continue;
    try {
      const buf = await post("/sound-generation?output_format=mp3_44100_128", {
        text: s.text, duration_seconds: s.seconds, prompt_influence: 0.6, model_id: "eleven_text_to_sound_v2"
      });
      await save(s.name, buf);
    } catch (e) { failed++; console.error(`✗ ${s.name}: ${e.message}`); }
  }
}

if (!args.includes("--no-music") && (!only.length || only.includes("music"))) {
  try {
    const buf = await post("/music?output_format=mp3_44100_128", {
      prompt: MUSIC_PROMPT, music_length_ms: 60000, force_instrumental: true, model_id: "music_v1"
    });
    await save("music", buf);
  } catch (e) {
    console.error(`Music API didn't work (${e.message}). Trying a 30-second looping track instead...`);
    try {
      const buf = await post("/sound-generation?output_format=mp3_44100_128", {
        text: MUSIC_PROMPT, duration_seconds: 30, loop: true, prompt_influence: 0.5, model_id: "eleven_text_to_sound_v2"
      });
      await save("music", buf);
    } catch (e2) { failed++; console.error(`✗ music: ${e2.message}`); }
  }
}

console.log(failed ? `\n${failed} sound(s) failed. The old files were kept for those.` : "\nDone. Reload the game to hear the new sounds.");
process.exit(failed ? 1 : 0);
