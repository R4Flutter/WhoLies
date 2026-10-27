// Builds the CrazyGames version of the game into dist/crazygames/ and zips it.
// Run from the game folder:  node tools/build-crazygames.mjs
//
// What it changes compared with the web version:
//  - adds the CrazyGames SDK v3 and switches the game to the "crazygames" platform
//    (ads, saves, mute setting, username and invite links go through the SDK)
//  - removes web-only parts: AdSense, Firebase leaderboard, WhatsApp/X sharing,
//    links to other pages, social tags and the web manifest
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, readdirSync, statSync, existsSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "dist", "crazygames");
const zipPath = join(root, "dist", "whos-lying-crazygames.zip");
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

// 1. index.html
let html = readFileSync(join(root, "index.html"), "utf8");
html = html.replace(/<!-- WEB-ONLY:START -->[\s\S]*?<!-- WEB-ONLY:END -->\n?/g, "");
html = html.replace("<!-- PLATFORM-HEAD -->",
  '<script src="https://sdk.crazygames.com/crazygames-sdk-v3.js"></script>\n<script>window.WL_PLATFORM = "crazygames";</script>');
html = html.replace(/\s*<a class="chip-btn web-only"[^>]*>.*?<\/a>/g, "");
html = html.replace(/\s*<p class="muted small web-only">.*?<\/p>/g, "");
html = html.replace(/<html lang="en" class="game">/, '<html lang="en" class="game cg">');
if (/archive\.html|privacy\.html|whatsapp|twitter\.com|googlesyndication|firebase/i.test(html.replace(/<!--[\s\S]*?-->/g, ""))) {
  console.warn("Warning: index.html still mentions a web-only link or service. Check the WEB-ONLY markers.");
}
writeFileSync(join(out, "index.html"), html);

// 2. files the game needs
cpSync(join(root, "css"), join(out, "css"), { recursive: true });
mkdirSync(join(out, "js"));
for (const f of ["config.js", "cases.js", "engine.js", "platform.js", "progress.js", "audio.js", "fx.js", "game.js"]) {
  cpSync(join(root, "js", f), join(out, "js", f));
}
mkdirSync(join(out, "assets"));
cpSync(join(root, "assets", "fonts"), join(out, "assets", "fonts"), { recursive: true });
cpSync(join(root, "assets", "audio"), join(out, "assets", "audio"), { recursive: true });
for (const f of ["favicon.svg", "icon-192.png", "apple-touch-icon.png"]) cpSync(join(root, "assets", f), join(out, "assets", f));

// 3. report + zip
let files = 0, bytes = 0;
(function walk(d) {
  for (const n of readdirSync(d)) {
    const p = join(d, n), s = statSync(p);
    if (s.isDirectory()) walk(p); else { files++; bytes += s.size; }
  }
})(out);
console.log(`Built ${relative(root, out)}: ${files} files, ${(bytes / 1024 / 1024).toFixed(2)} MB (limits: 1500 files, 250 MB; first download under 20 MB).`);

rmSync(zipPath, { force: true });
const tries = [
  `zip -qr "${zipPath}" .`,
  `tar -a -c -f "${zipPath}" *`
];
let zipped = false;
for (const cmd of tries) {
  try { execSync(cmd, { cwd: out, stdio: "ignore", shell: true }); if (existsSync(zipPath)) { zipped = true; break; } } catch (e) { /* try next */ }
}
console.log(zipped
  ? `Zipped: ${relative(root, zipPath)}. Upload this file on the CrazyGames developer portal.`
  : "Couldn't make the zip automatically. Zip the CONTENTS of dist/crazygames (index.html must be at the top level).");
