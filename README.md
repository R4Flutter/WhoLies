# Who's Lying?

**Play it: https://liarhunt.com**

A detective game for the browser. In every case the police checked a few facts and three suspects tell their story. One story can't be true. Tap the liar.

It is plain HTML, CSS and JavaScript with no build step. The web version is hosted free on GitHub Pages. A one-command build makes the CrazyGames version (section 3).

---

## What's in the game

**Five ways to play**

| Mode | What it is |
|---|---|
| Daily Case | 5 cases a day, the same for everyone, with a streak and a shareable result. The hero of the home screen. |
| Case of the Week | Each Daily from Monday to Saturday gives one clue to a bigger case (8 suspects). On Sunday, name the mastermind with one try. Missed a day? Catch up with a Case Key or buy the clue. |
| Night Shift | One hard bonus case every evening from 8 PM, one try. The screen switches to the night theme. |
| Career | Endless chapters of 10 cases (Rookie Beat, Downtown, The Harbor…). Cases get harder as you go. Cases 5 and 10 of each chapter are twists. Earn up to 3 stars per case by being fast and not using hints. New players land straight in case 1 with a short coach. |
| Rush | Catch as many liars as you can against the clock. 3 lives, a combo multiplier, a faster clock as you go, and one second chance per run. |

**Twist cases:** "two are lying, find the honest one" and "everyone is honest, find the fake fact".

**Why players come back**

| Hook | What it does |
|---|---|
| Progress backup (web) | Every player's progress is backed up online automatically under a private save code (like `ABCD-EFGH-JKMN`). The code, or a "send to myself" link, brings it back on a new phone, a new browser, an iPhone home-screen app or a new web address. Two devices with the same code stay in sync. |
| Streak Shields | Save your Daily streak if you miss a day (used automatically, hold up to 2). Earn one every 7 days in a row or buy one for 200 coins. |
| Case Keys + Case Files | Case Files lists every past Daily. A Case Key opens a missed day with full rewards and its weekly clue. Earn one every 7 days in a row, on day 7 of the login calendar, or buy them. |
| Comeback gift | Players who return after 3+ days get 150 coins, 2 Magnifiers and a Case Key. |
| Friend challenges | Every shared result is a challenge link. Your friend plays the same Daily and sees "You beat Raj by 12 seconds!" with a rematch button. Works on CrazyGames too (invite links). |
| Rank among everyone | After the Daily: "#37 of 230 today, better than 84% of players", also in the share text. |
| Weekly leagues (web) | Bronze → Silver → Gold → Platinum → Diamond. Points are liars caught in that week's Dailies. Top 20% move up on Monday, bottom 20% move down. |
| Friend groups (web) | Make a group, share the code or link, see each member's Daily result side by side. Up to 50 per group. |
| Install + reminder (web) | Installs as an app (works offline). A "Remind me" button adds a daily calendar alarm (Google Calendar or .ics). |
| Stars and chapters | 3 stars per case, a chapter map, replay any case to improve your stars. |
| Streak bonus | Solve cases in a row on the first try for up to ×2 coins. |
| Levels and titles | XP from every case. Rookie → Patrol Officer → … → Legend, with a badge that changes metal. Level-ups pay coins. |
| Coins and shop | Spend coins on Magnifiers (rule out a wrong answer), Time Freezes (+10 s in Rush) and 6 desk themes. |
| Daily missions | 3 new missions every day ("Earn 3 stars on 3 cases"…), plus a mission chest when all 3 are done. |
| 7-day login calendar | A bigger reward each day you come back, with an option to double it by watching an ad. |
| Achievements | 31 achievements with coin rewards. |
| What's next | Every results screen shows your level bar and the next mission, so there's always one more goal. |
| Sound and juice | Sound effects, a noir-jazz music loop, stamps, confetti, floating rewards, screen shake. |

**Works everywhere:** phones, tablets and desktop, 16:9 game frames down to 800×450, light and dark mode, keyboard (1–5, Enter, Esc), reduced motion.

**Never runs out:** 75 hand-written cases plus a generator with 55 fact types and 50 story openers. `node tools/check-cases.mjs` tests 500 career levels, 300 Rush cases and 400 days of daily cases.

---

## Folder map

```
index.html                 the game
archive.html               past daily cases + answers (web only)
privacy.html, 404.html     web pages
css/style.css              all the styles
js/config.js               ← YOUR SETTINGS (edit this)
js/cases.js                hand-written cases
js/engine.js               case generator, career and Rush difficulty, portraits
js/progress.js             levels, coins, stars, missions, login calendar, shop, achievements
js/game.js                 all the screens
js/platform.js             web vs CrazyGames: ads, saves, mute, username, invite links
js/audio.js, js/fx.js      sound and visual effects
js/leaderboard.js          web leaderboard, top-100 rewards, rank, weekly leagues, friend groups (Firebase)
js/ads.js                  web ads (none / demo / AdSense)
assets/                    sounds, music, fonts, icons
sw.js                      offline play + app install (web only)
firebase.json, firebase/   database settings, rules and indexes for the web leaderboard
tools/build-crazygames.mjs builds the CrazyGames zip
tools/check-cases.mjs      checks every case for mistakes
tools/elevenlabs-audio.mjs remakes all sounds with ElevenLabs
tools/synth-audio.py       rebuilds the built-in sounds
```

---

## 1. Try it on your computer

```
python -m http.server 8000
```

Then open http://localhost:8000.

Test addresses:
- `?ads=demo` shows grey boxes where ads will appear.
- `?lb=demo` turns on the leaderboard with made-up players.
- `#endless` jumps straight into Rush.
- `?c=6.ggyrg.92.Raj` opens a friend challenge (Daily #6, 4 of 5, 92 seconds, from Raj).
- `?g=ABC234` opens a friend group invite.
- `?restore=ABCDEFGHJKMN` restores progress from a save code (what the "Send to myself" link does).
- `?test=1` adds `window.__WLtest` for automated checks (start any mode, read the saved state).

Testing on `localhost` uses the real database, so delete test scores afterwards (Firestore console, or `firebase firestore:delete scores/<id>`).

To start over, clear the site's data in your browser (the save is in `localStorage` under `whoslying:v1`).

---

## 2. Web hosting (GitHub Pages)

The game is live at **https://liarhunt.com**. Every push to `main` updates it within a minute or two.

```
git add -A
git commit -m "Describe your change"
git push
```

### Move to your own domain (players keep their progress)

A player's progress lives in their browser, and browsers keep it separately for each web address. So when the game moves, the **old address forwards every player to the new one and brings their progress along** (using the online backup). For that, the old address has to stay online: the new domain goes in a **new repository**, and this repository stays behind as the old address. Example domain: `whoslying.com`.

1. At your domain seller, add these DNS records:
   - 4 × `A` records for `@`: `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
   - 1 × `CNAME` record for `www`: `r4flutter.github.io`
2. On GitHub, create a new empty repository, for example `whoslying-site`.
3. In this folder, keep the current repository as `old` and add the new one:
   ```
   git remote rename origin old
   git remote add origin https://github.com/R4Flutter/whoslying-site.git
   ```
4. In `js/config.js` set `siteUrl: "https://whoslying.com"` and `movedTo: "https://whoslying.com"` (`movedTo` does nothing on the new address itself). Replace `https://r4flutter.github.io/WhoLies` with `https://whoslying.com` in `index.html`, `archive.html`, `privacy.html`, `robots.txt` and `sitemap.xml`. Commit, then push to both:
   ```
   git push old main
   git push origin main
   ```
5. Make a file named `CNAME` (no extension) with one line: `whoslying.com`. Commit it and push **only to the new repository** (`git push origin main`). It has to be in `main` there, because the publish workflow copies `main` over `gh-pages` on every push. Never push it to `old`: then GitHub would send the old address straight to the new one without running the game, and players would lose their progress.
6. In the new repository: **Settings → Pages → Build and deployment → Deploy from a branch → `gh-pages`**. Check the custom domain shows `whoslying.com`, and tick **Enforce HTTPS** once it's allowed (can take up to an hour).
7. From now on push only to `origin`. Leave the old repository as it is: it keeps forwarding players, with their progress, for as long as it exists.

---

## 3. CrazyGames

### Build the upload file

Needs Node.js 18+:

```
node tools/build-crazygames.mjs
```

This makes `dist/whos-lying-crazygames.zip` (about 1.3 MB, 39 files). Upload that zip. The build:
- adds the CrazyGames SDK v3
- sends ads, saves, the mute setting, the username and invite links through the SDK
- removes everything CrazyGames doesn't allow: AdSense, the Firebase leaderboard, WhatsApp/X buttons, links to other pages

### How it follows the CrazyGames rules

- Players land straight in gameplay (case 1 with a short coach).
- `loadingStart`/`loadingStop` around loading, `gameplayStart`/`gameplayStop` around every case, `happytime` on big wins.
- **Midgame ads** only between cases (next career case, end of a Rush run, end of the Daily), never in a player's first minute or first 3 solved cases. The screen is blocked while an ad plays.
- **Rewarded ads** are always the player's choice: a hint when out of Magnifiers (not during Rush, 90-second cooldown), one extra Rush life, double login reward, +40 shop coins (4-minute cooldown). No reward if the ad fails. Never a midgame and a rewarded ad in the same break.
- Sound is muted only once an ad really starts, and comes back after. The CrazyGames mute setting overrides the game's own switches.
- Adblock players can still play. Rewarded buttons fall back to free versions or hide.
- Progress saves through the CrazyGames Data module, so it follows signed-in players across devices.
- Share buttons copy a CrazyGames invite link. Opening one starts that Daily or Rush.
- Relative paths only, no external links, no fullscreen button, readable at 800×450.

### Submit it

1. Sign up at https://developer.crazygames.com and click **Add game**.
2. Upload `dist/whos-lying-crazygames.zip`. Choose **HTML5**.
3. Turn on **Progress Save** (Data module) in the submission form.
4. Orientation: **Both** (it works in landscape and portrait). Mobile: **Yes**.
5. Upload the covers and preview videos from the store-assets pack.
6. Paste the title, description, controls and tags below.
7. Use the **Preview** tool and play a full case, a Rush run and the Daily.

**Title:** Who's Lying?

**Short description:**
Catch the liar! Read the facts, compare three stories and tap the suspect whose story can't be true.

**Description:**
Who's Lying? is a detective puzzle game for sharp eyes. In every case, the police checked a few facts and three suspects tell you where they were. One of them is lying. Find the story that can't be true and stamp it LIAR.

Climb through career chapters from Rookie Beat to Final Verdict, earn 3 stars by solving fast without hints, and watch out for twist cases where two people lie, or everyone tells the truth and a fact was planted. Race the clock in Rush mode, build combos for bonus coins, and come back for 5 new Daily Cases every day.

Level up from Rookie to Legend, finish daily missions, open the mission chest, collect your login reward, unlock 22 achievements and buy new desk themes in the shop.

**Controls:**
- Mouse or touch: tap a suspect (or a fact in twist cases), then tap Accuse
- Keyboard: 1–5 to pick, Enter to accuse, Esc to cancel

**Tags:** detective, logic, puzzle, mystery, brain, casual, deduction, 1 player, mobile, trivia

**Category:** Puzzle

### Leaderboard on CrazyGames

CrazyGames leaderboards are invite-only. If they invite the game, paste the **Encryption Key** from the developer portal into `crazygames.leaderboardKey` in `js/config.js` and rebuild. Rush best scores are then submitted automatically.

---

## 4. Web leaderboard (Firebase, free)

The leaderboard is **on**. It uses the free Firebase project `whoslying-daily` (console: https://console.firebase.google.com/project/whoslying-daily). Its web config is in `js/config.js` → `leaderboard.firebase`. That key is meant to be public; the rules protect the data.

It stores four collections:

| Collection | What's in it |
|---|---|
| `scores` | One Daily result per player per day (can't be changed later). |
| `endless` | Each player's best Rush run (can only go up). |
| `league` | One entry per player per week. The rules re-add the player's own Daily scores, so league points can't be faked. |
| `groups` | Friend groups: name and members. Members can only add, rename or remove themselves. |
| `saves` | Progress backups, one per save code. Saves can't be listed, only opened with their code, and their XP can never go down (so an old copy never overwrites newer progress). |

**Free plan limits.** Each player costs about 1 read and a few writes per visit (the backup runs when they reach HQ or a results screen, leave the app, or every 2 minutes during long sessions). The free Spark plan gives 50,000 reads and 20,000 writes a day, which is enough for a few thousand players a day. Past that, switch the project to the Blaze plan (pay as you go, a few dollars at that size).

Everything about the database is in this repo: `firebase.json` (location, anonymous sign-in), `firebase/firestore.rules` and `firebase/firestore.indexes.json`. After you change any of them, run:

```
firebase deploy --only firestore,auth
```

To see or delete scores (for example a cheater), open **Firestore Database → Data** in the console.

Daily top-100 players get a badge (🥇 🥈 🥉 🎖️ 🏅) and a prize hint once the day's ranks lock in (38 hours after it starts). If you change `launchDate`, change the `dayStart` line in `firebase/firestore.rules` too, and pick a **Monday**: weeks (Case of the Week, leagues) run from Daily #1, so #1 has to be a Monday.

**Push notifications** are the next step up from the calendar reminder. They need a Firebase Cloud Messaging key and a small scheduled job (a GitHub Actions cron works on the free plan) that sends "New cases are ready" each morning.

---

## 5. Sound and music

Built-in sounds live in `assets/audio/`. Music and sound switches are in Settings (gear icon).

| File | When it plays |
|---|---|
| `tap`, `click` | picking a suspect, buttons |
| `stamp` | the LIAR / HONEST / FAKE stamp |
| `correct`, `wrong` | after each answer |
| `twist` | a twist case appears |
| `whoosh` | next case, hints |
| `tick`, `timeout` | the last seconds in Rush, time running out |
| `fanfare`, `fail` | results screens |
| `coin`, `star`, `combo`, `levelup`, `buy`, `achieve` | rewards |
| `music` | background loop (crossfaded, so it loops smoothly) |

**Remake them with ElevenLabs** on your own computer (Node.js 18+):

Windows (PowerShell):
```
$env:ELEVENLABS_API_KEY="your_key_here"; node tools/elevenlabs-audio.mjs
```
macOS / Linux:
```
ELEVENLABS_API_KEY=your_key_here node tools/elevenlabs-audio.mjs
```

`--only stamp,coin` remakes just those. `--music-only` and `--no-music` also work. Never put your API key in a file in this repo: the repo is public.

---

## 6. Web ads (when you have traffic)

Launch with `provider: "none"`. Later:

1. Apply for Google AdSense, then for **H5 Games Ads**.
2. Paste the AdSense snippet in `index.html` where the comment says **GOOGLE ADSENSE**.
3. Turn on the **European regulations** consent message in AdSense → Privacy & messaging.
4. Edit `ads.txt` with your publisher ID (needs your own domain).
5. In `js/config.js`: `provider: "adsense"`, `adsenseClient: "ca-pub-…"`, `adsenseTestMode: true` until approved.

Ads use the same placements as on CrazyGames (section 3), plus **side ads**: on screens at least 1100 px wide and 660 px tall, a tall ad sits left and right of the game (160×600 on laptops, 300×600 from 1600 px wide). Make a **Display ad** unit in AdSense and paste its number in `railSlot` (or leave it empty to reuse `displaySlot`). Phones and small windows get no side ads. Preview them with `?ads=demo`.

---

## 7. Add your own cases

Open `js/cases.js`. The lists `medium`, `hard` and `twist` feed Daily cases 2, 4 and 5. Day 1 uses the first item of each list, and so on. The generator fills in when a list runs out. Career and Rush always use the generator.

```js
{
  title: "The Missing Violin",
  setup: "A rare violin vanished from the music shop last night.",
  clues: [
    "It rained hard from 6 PM until midnight.",
    "The shop's alarm was switched off at 9:10 PM."
  ],
  suspects: [
    { name: "Victor", role: "Delivery driver", says: "I walked home at eight under a sky full of stars." },
    { name: "Mira",   role: "Shop assistant",  says: "I caught the bus with my umbrella at seven." },
    { name: "Theo",   role: "Night cleaner",   says: "I start work at ten." }
  ],
  answer: 0,   // Victor is the liar (0 = first suspect)
  why: "It rained from 6 PM to midnight, so Victor couldn't have walked under a sky full of stars."
}
```

Twist cases add `mode: "honest"` (`answer` is the one honest suspect) or `mode: "planted"` (`answer` is the fake clue). Optional `twist: "..."` adds a reveal line.

Rules: exactly one statement contradicts the facts, simple English, name the liar in `why`. Then run:

```
node tools/check-cases.mjs
```

---

## Tech notes

- Daily cases come from a random number generator seeded with the day number, so everyone gets the same ones. Career level N is seeded with N, so it's the same for every player too. The Case of the Week is seeded with the week number, the Night Shift with the day.
- `node tools/check-cases.mjs` also checks 400 Night Shift cases and 400 weekly cases: the mastermind fits every clue, everyone else is ruled out, and every clue rules out someone no other clue does (so each missed day really matters).
- The game code, styles and fonts are about 420 KB. Sounds load after the first tap.
- Fonts: Big Shoulders Display and Atkinson Hyperlegible (SIL Open Font License, files in `assets/fonts`).
