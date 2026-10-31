/*
  WHO'S LYING? — ads
  One small layer so the game never talks to an ad network directly.
    WLAds.interstitial(type, name)  full-screen ad at a natural break   -> Promise<void>
    WLAds.rewarded(name)            player chooses to watch for a reward -> Promise<boolean> (true = reward earned)
    WLAds.display(element)          optional banner in a page slot
  Provider is set in js/config.js (ads.provider). Add ?ads=demo or ?ads=none
  to the address to try another provider without editing the file.
  AdSense code follows Google's H5 Games Ad Placement API (adBreak / adConfig).
*/
(function () {
  "use strict";
  var cfg = (window.WL_CONFIG && window.WL_CONFIG.ads) || {};
  var provider = cfg.provider || "none";
  try {
    var q = new URLSearchParams(location.search).get("ads");
    if (q === "demo" || q === "none" || q === "adsense") provider = q;
  } catch (e) { /* ignore */ }

  var hooks = { onPause: function () {}, onResume: function () {} };
  var soundOn = true;

  /* ---------- AdSense (H5 Games Ads) ---------- */
  function loadAdsense() {
    if (!document.querySelector('script[src*="adsbygoogle.js"]')) {
      var s = document.createElement("script");
      s.async = true;
      s.crossOrigin = "anonymous";
      s.src = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=" + encodeURIComponent(cfg.adsenseClient || "");
      s.setAttribute("data-ad-client", cfg.adsenseClient || "");
      s.setAttribute("data-ad-frequency-hint", cfg.frequencyHint || "45s");
      if (cfg.adsenseTestMode) s.setAttribute("data-adbreak-test", "on");
      document.head.appendChild(s);
    }
    window.adsbygoogle = window.adsbygoogle || [];
    window.adBreak = window.adConfig = function (o) { window.adsbygoogle.push(o); };
    window.adConfig({ preloadAdBreaks: "on", sound: soundOn ? "on" : "off" });
  }

  function adsenseBreak(type, name, rewarded) {
    return new Promise(function (resolve) {
      var finished = false, started = false, earned = false;
      function finish() {
        if (finished) return;
        finished = true;
        if (started) hooks.onResume();
        resolve(rewarded ? earned : undefined);
      }
      var o = {
        type: rewarded ? "reward" : type,
        name: name,
        beforeAd: function () { started = true; hooks.onPause(); },
        afterAd: function () {},
        adBreakDone: function () { finish(); }
      };
      if (rewarded) {
        o.beforeReward = function (showAdFn) { started = true; showAdFn(); };
        o.adDismissed = function () { earned = false; };
        o.adViewed = function () { earned = true; };
      }
      try { window.adBreak(o); } catch (e) { finish(); }
      // If Google never starts an ad (blocked, not ready), carry on after a moment.
      setTimeout(function () { if (!started) finish(); }, 4000);
    });
  }

  /* ---------- Demo placeholders ---------- */
  function demoBreak(name, rewarded) {
    return new Promise(function (resolve) {
      hooks.onPause();
      var wrap = document.createElement("div");
      wrap.className = "ad-demo";
      wrap.setAttribute("role", "dialog");
      wrap.setAttribute("aria-modal", "true");
      wrap.setAttribute("aria-label", "Ad placeholder");
      wrap.innerHTML =
        '<div class="ad-demo-box">' +
        '<p class="ad-demo-kind">' + (rewarded ? "Rewarded ad" : "Full-screen ad") + "</p>" +
        '<p class="ad-demo-name">Placement: ' + name + "</p>" +
        '<p class="ad-demo-note">This grey box is a placeholder. With AdSense switched on, a real ad shows here.</p>' +
        '<div class="ad-demo-row">' +
        (rewarded ? '<button type="button" class="btn ghost" data-act="skip">Close (no reward)</button>' : "") +
        '<button type="button" class="btn primary" data-act="done" disabled>Wait 3</button>' +
        "</div></div>";
      document.body.appendChild(wrap);
      var done = wrap.querySelector('[data-act="done"]');
      var left = 3;
      var t = setInterval(function () {
        left--;
        if (left > 0) { done.textContent = "Wait " + left; return; }
        clearInterval(t);
        done.disabled = false;
        done.textContent = rewarded ? "Claim reward" : "Continue";
        done.focus();
      }, 1000);
      function close(earned) {
        clearInterval(t);
        wrap.remove();
        hooks.onResume();
        resolve(rewarded ? earned : undefined);
      }
      done.addEventListener("click", function () { close(true); });
      var skip = wrap.querySelector('[data-act="skip"]');
      if (skip) skip.addEventListener("click", function () { close(false); });
    });
  }

  /* ---------- side ads: one tall ad left and right of the game on wide screens ---------- */
  // ponytail: sized once at start-up; a window made wider later gets side ads after a reload.
  function fillRails() {
    var rails = document.querySelectorAll(".ad-rail");
    var on = provider === "demo" || (provider === "adsense" && (cfg.railSlot || cfg.displaySlot));
    if (!rails.length || !on || !matchMedia("(min-width: 1100px) and (min-height: 660px)").matches) return;
    var w = innerWidth >= 1600 ? 300 : 160; // 300x600 on big screens, 160x600 on laptops
    document.documentElement.style.setProperty("--rail", w + "px");
    document.documentElement.classList.add("rails");
    for (var i = 0; i < rails.length; i++) window.WLAds.display(rails[i], [w, 600]);
  }

  window.WLAds = {
    provider: provider,
    hasAds: function () { return provider !== "none"; },
    init: function (h) {
      if (h) { hooks.onPause = h.onPause || hooks.onPause; hooks.onResume = h.onResume || hooks.onResume; }
      if (provider === "adsense") loadAdsense();
      fillRails();
    },
    setSound: function (on) {
      soundOn = !!on;
      if (provider === "adsense" && window.adConfig) window.adConfig({ sound: soundOn ? "on" : "off" });
    },
    interstitial: function (type, name) {
      if (provider === "adsense") return adsenseBreak(type || "next", name, false);
      if (provider === "demo") return demoBreak(name, false);
      return Promise.resolve();
    },
    rewarded: function (name) {
      if (provider === "adsense") return adsenseBreak("reward", name, true);
      if (provider === "demo") return demoBreak(name, true);
      return Promise.resolve(true); // no ads: rewards are free
    },
    // size: [width, height] for a fixed-size ad (the side ads); leave it out for a responsive banner.
    display: function (el, size) {
      if (!el) return;
      var slot = size ? cfg.railSlot || cfg.displaySlot : cfg.displaySlot;
      var box = size ? "display:inline-block;width:" + size[0] + "px;height:" + size[1] + "px" : "display:block";
      if (provider === "adsense" && slot) {
        el.innerHTML = '<ins class="adsbygoogle" style="' + box + '" data-ad-client="' + cfg.adsenseClient +
          '" data-ad-slot="' + slot + '"' + (size ? "" : ' data-ad-format="auto" data-full-width-responsive="true"') + "></ins>";
        try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (e) { /* ignore */ }
        el.hidden = false;
      } else if (provider === "demo") {
        el.innerHTML = size
          ? '<div class="ad-demo-rail" style="height:' + size[1] + 'px">Ad space<br>' + size[0] + " × " + size[1] + "</div>"
          : '<div class="ad-demo-banner">Banner ad space (placeholder)</div>';
        el.hidden = false;
      } else {
        el.hidden = true;
      }
    }
  };
})();
