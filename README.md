# Who's Lying?

**Play it: https://r4flutter.github.io/WhoLies/**

A daily detective game for the browser. Every day there are 5 short cases. In each one, the police checked some facts and 3 suspects tell their story. One story can't be true. Players tap the liar, then share a spoiler-free result like this:

```
Who's Lying? #12
🟩🟩🟥🟨🟩 4/5  ⏱️ 2:13
🔥 6-day streak
🏆 #23 on today's leaderboard
https://r4flutter.github.io/WhoLies/
```

It is plain HTML, CSS and JavaScript with no build step. It's hosted free on GitHub Pages, and the optional leaderboard runs on Firebase's free plan.

---

## What's included

| Feature | What it does |
|---|---|
| Daily cases | 5 cases a day, the same for everyone. Case 5 is always a twist. New set at local midnight. |
| Twist cases | "Two are lying, find the honest one" or "everyone is honest, find the fake fact". |
| Share grid | Wordle-style emoji result with a tappable link, plus native share (phones), copy, WhatsApp and X buttons. |
| Streaks and stats | Days played, current and best streak, perfect days, score chart. Saved in the browser, no login. |
| Endless mode | Unlimited cases, a timer that gets faster, 3 lives, one second chance. |
| Leaderboard | Today, yesterday and endless top 100. Players pick a detective name, no email or password. |
| Top-100 rewards | Finish in a day's top 100 to win a badge (🥇 🥈 🥉 🎖️ 🏅) shown next to your name, plus a prize hint. |
| Sound | Sound effects and a noir-jazz music loop, with separate music and sound buttons. |
| Hints | Rules out one wrong option. A hinted case shows 🟨 in the daily result. |
| Past cases page | Replay any past day and read every answer with the explanation (good for Google searches). |
| Ads ready | AdSense H5 Games Ads (full-screen and rewarded) plus an optional banner. Off until you switch it on. |
| Never runs out | 75 hand-written cases cover the first 25 days. After that, a generator writes new cases forever. |
| Works everywhere | Phones, tablets and desktop, light and dark mode, keyboard (keys 1-5, Enter, Esc), reduced motion. |

---

## Folder map

```
index.html            the game
archive.html          past cases + answers
privacy.html          privacy page (needed for AdSense)
404.html              "page not found" page
css/style.css         all the styles
js/config.js          ← YOUR SETTINGS (edit this)
js/cases.js           hand-written cases (add your own here)
js/engine.js          daily picker, case generator, portraits, saving
js/game.js            the game screens, sound, leaderboard screens
js/leaderboard.js     leaderboard + rewards (Firebase)
js/ads.js             ad layer (none / demo / AdSense)
js/archive.js         past cases page
assets/audio/         sound effects + music (mp3)
assets/               fonts, icons, share image (og-image.png)
firebase/             database rules + index for the leaderboard
tools/check-cases.mjs       checks your cases for mistakes
tools/elevenlabs-audio.mjs  remakes all sounds with ElevenLabs
tools/synth-audio.py        rebuilds the built-in sounds
```

---

## 1. Try it on your computer

Run a tiny local server in this folder:

```
python -m http.server 8000
```

Then open http://localhost:8000.

Useful test addresses:
- `?ads=demo` shows grey boxes where ads will appear.
- `?lb=demo` turns on the leaderboard with made-up players, so you can try it before Firebase is set up. Nothing is uploaded.
- `#endless` jumps straight into endless mode.

---

## 2. Hosting (GitHub Pages)

The game is live at **https://r4flutter.github.io/WhoLies/**. Every push to the `main` branch updates it within a minute or two.

To change something: edit the files, then

```
git add -A
git commit -m "Describe your change"
git push
```

### Move to your own .com later

1. Buy a domain (Cloudflare Registrar or Namecheap).
2. In the repo on GitHub: **Settings → Pages → Custom domain**, type your domain and follow the DNS steps. Tick **Enforce HTTPS**.
3. Change `siteUrl` in `js/config.js`, and the address in `index.html`, `archive.html`, `privacy.html`, `robots.txt` and `sitemap.xml`.
4. If the leaderboard is on, add the new domain in Firebase: **Authentication → Settings → Authorized domains**.

---

## 3. Switch on the leaderboard (Firebase, free, about 10 minutes)

The leaderboard stays hidden until you do this. Firebase's free plan covers thousands of players a day.

1. Go to https://console.firebase.google.com and click **Create a project**. Name it (for example `who-lies`). You can turn Google Analytics off.
2. **Build → Authentication → Get started → Sign-in method → Anonymous → Enable → Save.**
   Players get a random ID. No email or password.
3. **Build → Firestore Database → Create database.** Pick a location near your players, choose **production mode**, and click Create.
4. In Firestore, open the **Rules** tab. Delete what's there, paste everything from `firebase/firestore.rules` and click **Publish**.
5. In Firestore, open **Indexes → Composite → Create index**:
   - Collection ID: `scores`
   - Fields: `day` Ascending, `score` Descending, `timeMs` Ascending
   - Query scope: Collection
   Click Create. It takes a few minutes to build.
6. Click the gear icon → **Project settings → Your apps → Web (`</>`)**. Register an app (no hosting needed) and copy the `firebaseConfig` object.
7. Paste it into `js/config.js`:
   ```js
   leaderboard: {
     firebase: {
       apiKey: "AIza...",
       authDomain: "who-lies.firebaseapp.com",
       projectId: "who-lies",
       appId: "1:1234:web:abcd"
     }
   },
   ```
   This key is meant to be public. The rules from step 4 protect the data.
8. Commit and push. The 🏆 button appears in the game.

How it works:
- After finishing the daily cases, players can join with a detective name. Their score posts once per day and can't be changed.
- Ranking: more liars caught first, then the faster time.
- A day's ranks lock in 38 hours after it starts, once every time zone has finished it. The next time a top-100 player opens the game, they get their reward: 🥇 #1 Chief Inspector, 🥈 #2 Inspector, 🥉 #3 Sergeant, 🎖️ #4-10 Detective, 🏅 #11-100 Sharp Eye. They also get one prize hint, which skips the ad when ads are on.
- Endless mode keeps each player's best run.
- The rules block impossible scores (wrong format, faster than 20 seconds, duplicates, out-of-date days). A determined cheater can still fake a believable score, as with any browser game. If that becomes a problem, add Firebase App Check.

If you change `launchDate` in `js/config.js`, change the date on the `dayStart` line in `firebase/firestore.rules` too, then publish the rules again.

---

## 4. Sound and music

The game ships with built-in sound effects and a 47-second noir-jazz music loop in `assets/audio/`. Players can switch music and sound off separately (header buttons), and the choice is remembered.

| File | When it plays |
|---|---|
| `tap.mp3` | selecting a suspect |
| `stamp.mp3` | the LIAR / HONEST / FAKE stamp |
| `correct.mp3`, `wrong.mp3` | after each answer |
| `twist.mp3` | a twist case appears |
| `whoosh.mp3` | next case, hints |
| `tick.mp3`, `timeout.mp3` | the last seconds in endless mode, time running out |
| `fanfare.mp3`, `fail.mp3` | the results screen, rewards |
| `music.mp3` | background loop (crossfaded, so it loops smoothly) |

### Remake them with ElevenLabs

Run this on your own computer (Node.js 18+). It replaces the files above with AI-generated ones, using the same names.

Windows (PowerShell):
```
$env:ELEVENLABS_API_KEY="your_key_here"; node tools/elevenlabs-audio.mjs
```
macOS / Linux:
```
ELEVENLABS_API_KEY=your_key_here node tools/elevenlabs-audio.mjs
```

- `--only stamp,twist` remakes just those sounds. `--music-only` and `--no-music` also work.
- Edit the prompts at the top of the script to change how anything sounds.
- Listen in the game, then `git add assets/audio && git commit -m "New sounds" && git push`.

Never put your API key in a file in this repo. The repo is public, and anyone could use your credits.

You can change volumes in `js/config.js` → `audio`.

---

## 5. Switch on ads (when you have some traffic)

Ads slow down sharing at the start, so launch with `provider: "none"` and add ads once players are coming back.

1. Apply for Google AdSense at https://adsense.google.com with your site.
2. AdSense gives you a code snippet. Paste it in `index.html` where the comment says **GOOGLE ADSENSE**.
3. In AdSense, apply for **H5 Games Ads** (the game-ad program). Approval isn't guaranteed.
4. In AdSense, open **Privacy & messaging** and turn on the **European regulations** message. Google requires a certified consent message for users in the EU, UK and Switzerland, and this is Google's own.
5. Edit `ads.txt`: remove the `#` from the last line and put in your publisher ID. (ads.txt must sit at the root of a domain, so this works once you're on your own .com.)
6. In `js/config.js`, set:
   ```
   provider: "adsense",
   adsenseClient: "ca-pub-YOUR-NUMBER",
   adsenseTestMode: true    // switch to false when Google approves H5 Games Ads
   ```

Where ads appear:
- **Full-screen ad** when starting endless mode, and after every 4 endless cases (Google spaces them out using `frequencyHint`).
- **Rewarded ad** when a player asks for a hint, or for a second chance in endless mode. Top-100 prize hints skip the ad.
- **Banner** (optional) under the results screen and on the past cases page. Create a display ad unit in AdSense and put its number in `displaySlot`.
- The daily cases themselves are never interrupted, so sharing and streaks stay smooth.

Never click your own ads or buy cheap traffic. Google bans accounts for invalid traffic.

---

## 6. Add your own cases

Open `js/cases.js`. There are three lists:

- `medium`: one per day, case 2
- `hard`: one per day, case 4
- `twist`: one per day, case 5

Day 1 uses the first item of each list, day 2 the second, and so on. Add new cases to the end of each list. When a list runs out, the generator fills in automatically.

A normal case:

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

Twist cases add `mode`:
- `mode: "honest"`: two people lie. `answer` is the **one honest** suspect.
- `mode: "planted"`: everyone tells the truth. `answer` is the **fake clue** (0 = first clue).
- Optional `twist: "..."` adds a short reveal line after the answer.

Rules for good cases:
- Exactly one statement contradicts the facts. Read the honest ones twice and make sure they can't look like lies.
- Keep the English simple. Players come from everywhere.
- Name the liar in `why`.

Then check your work (needs Node.js):

```
node tools/check-cases.mjs
```

It checks every case and 400 days of generated ones, and tells you exactly what to fix.

Note: if you change cases for days that already happened, the past cases page shows the new version.

---

## 7. Launch checklist

- [ ] Opened the live site on your phone and played a full day
- [ ] Tested the share button and the WhatsApp button
- [ ] Leaderboard set up (section 3) and tested with a friend
- [ ] Added the site in Google Search Console and submitted `sitemap.xml`
- [ ] Wrote extra cases so you're ahead of the calendar
- [ ] Posted today's case as a short video (each case makes a great 20-second "Can you spot the liar?" clip)

---

## Tech notes

- Everyone gets the same daily cases because they come from a seeded random number generator keyed to the day number.
- Progress is saved in `localStorage` under the key `whoslying:v1`.
- The page loads under 300 KB before sound. Sound effects (about 200 KB) load in the background, and the music (about 650 KB) loads only after the first tap.
- Firebase loads only for players who open the leaderboard or have joined it, so everyone else gets the light page.
- Fonts: Big Shoulders Display and Atkinson Hyperlegible, both under the SIL Open Font License (license files are in `assets/fonts`).
