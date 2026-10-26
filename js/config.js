/*
  WHO'S LYING? — settings
  This is the only file you need to edit before going live.
*/
window.WL_CONFIG = {
  // Your game's name, shown in share messages.
  siteName: "Who's Lying?",

  // Your real web address, with https:// and no slash at the end.
  // It goes into every shared result, so friends get a link they can tap.
  // Change this if you move the game to your own .com.
  siteUrl: "https://r4flutter.github.io/WhoLies",

  // The date of Daily #1 (YYYY-MM-DD). Every day after this gets the next number.
  // If you change it, change the same date in firebase/firestore.rules too.
  launchDate: "2026-10-26",

  // Contact email shown on the privacy page.
  contactEmail: "hello@whoslying.example",

  audio: {
    // Background music and sound effect volume, from 0 to 1.
    musicVolume: 0.32,
    sfxVolume: 0.9
  },

  leaderboard: {
    // Paste your Firebase web app config here to switch on the leaderboard and
    // top-100 rewards (README, step "Switch on the leaderboard"). It looks like:
    // firebase: { apiKey: "AIza...", authDomain: "your-app.firebaseapp.com", projectId: "your-app", appId: "1:123:web:abc" }
    // This key is safe to publish: the security rules in firebase/firestore.rules protect the data.
    // Until then the leaderboard stays hidden. Add ?lb=demo to the address to preview it with demo players.
    firebase: null
  },

  ads: {
    // "none"    = no ads (best while you grow; hints and second chances are free)
    // "adsense" = Google AdSense H5 Games Ads (after Google approves your site)
    // "demo"    = grey placeholder boxes that show where ads will appear
    // Tip: add ?ads=demo to the address to preview ad spots without changing this file.
    provider: "none",

    // Your AdSense publisher ID, like "ca-pub-1234567890123456".
    adsenseClient: "ca-pub-0000000000000000",

    // Keep true while testing. Set to false once Google approves you for H5 Games Ads.
    adsenseTestMode: true,

    // Minimum time between full-screen ads. Google decides the exact timing.
    frequencyHint: "45s",

    // Optional: an AdSense display ad unit ID (just the number) for a banner
    // under the results screen and on the past-cases page. Leave "" for none.
    displaySlot: ""
  }
};
