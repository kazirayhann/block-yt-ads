(() => {
  "use strict";

  const AD_RESPONSE_KEYS = ["adPlacements", "playerAds", "adSlots"];

  function protectionEnabled() {
    return document.documentElement?.dataset.cleantubeEnabled !== "false";
  }

  function sanitizePlayerResponse(response) {
    if (!protectionEnabled() || !response || typeof response !== "object") {
      return response;
    }

    for (const key of AD_RESPONSE_KEYS) {
      if (key in response) response[key] = [];
    }

    // Some navigation responses wrap the actual player response.
    if (response.playerResponse && typeof response.playerResponse === "object") {
      sanitizePlayerResponse(response.playerResponse);
    }

    return response;
  }

  /*
   * YouTube's first watch-page response is assigned directly to this global.
   * Intercepting the assignment prevents the ad player—including static
   * countdown interstitials—from being created in the first place.
   */
  function interceptInitialPlayerResponse() {
    const property = "ytInitialPlayerResponse";
    const descriptor = Object.getOwnPropertyDescriptor(window, property);
    if (descriptor && !descriptor.configurable) {
      sanitizePlayerResponse(window[property]);
      return;
    }

    let currentValue = sanitizePlayerResponse(window[property]);
    Object.defineProperty(window, property, {
      configurable: true,
      enumerable: true,
      get() {
        return currentValue;
      },
      set(value) {
        currentValue = sanitizePlayerResponse(value);
      }
    });
  }

  /*
   * SPA navigations request /youtubei/v1/player and consume it with
   * Response.json(). Keep the native response intact and sanitize only parsed
   * player-shaped objects returned to YouTube.
   */
  function interceptPlayerFetchResponses() {
    const nativeJson = Response.prototype.json;
    if (nativeJson.__cleantubeWrapped) return;

    async function cleanTubeJson() {
      const data = await nativeJson.call(this);
      return sanitizePlayerResponse(data);
    }

    Object.defineProperty(cleanTubeJson, "__cleantubeWrapped", {
      value: true
    });
    Response.prototype.json = cleanTubeJson;
  }

  function interceptSerializedPlayerResponses() {
    const nativeParse = JSON.parse;
    if (nativeParse.__cleantubeWrapped) return;

    function cleanTubeParse(text, reviver) {
      return sanitizePlayerResponse(nativeParse.call(JSON, text, reviver));
    }

    Object.defineProperty(cleanTubeParse, "__cleantubeWrapped", {
      value: true
    });
    JSON.parse = cleanTubeParse;
  }

  interceptInitialPlayerResponse();
  interceptPlayerFetchResponses();
  interceptSerializedPlayerResponses();

  const SKIP_SELECTORS = [
    ".ytp-skip-ad-button",
    ".ytp-ad-skip-button",
    ".ytp-ad-skip-button-modern",
    "[id^='skip-button']",
    "[class*='skip-ad-button']"
  ];

  let lastClickAt = 0;

  function settingEnabled(name) {
    return document.documentElement?.dataset[name] === "true";
  }

  function isAdPlaying(player) {
    return (
      player?.classList.contains("ad-showing") ||
      player?.classList.contains("ad-interrupting") ||
      Boolean(player?.querySelector(".ytp-video-interstitial-buttoned-centered-layout"))
    );
  }

  function activate(control) {
    const now = Date.now();
    if (now - lastClickAt < 150) return;
    lastClickAt = now;

    control.click();
    for (const type of ["pointerdown", "mousedown", "pointerup", "mouseup", "click"]) {
      control.dispatchEvent(
        new MouseEvent(type, {
          bubbles: true,
          cancelable: true,
          composed: true,
          view: window
        })
      );
    }
  }

  function clickSkip(player) {
    if (!settingEnabled("cleantubeAutoSkip")) return false;

    // This internal method is present in some YouTube player builds and can
    // dismiss static interstitials before their visual countdown completes.
    if (typeof player.skipAd === "function") {
      try {
        player.skipAd();
        if (!isAdPlaying(player)) return true;
      } catch {
        // Fall through to the DOM control used by other player experiments.
      }
    }

    for (const selector of SKIP_SELECTORS) {
      const control = player.querySelector(selector);
      if (control instanceof HTMLElement && control.getClientRects().length) {
        activate(control);
        return true;
      }
    }

    for (const control of player.querySelectorAll("button, [role='button']")) {
      const label = `${control.getAttribute("aria-label") || ""} ${
        control.textContent || ""
      }`
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();

      if (/^skip(?: ad| ads| video)?(?:\s|$)/.test(label)) {
        activate(control);
        return true;
      }
    }

    return false;
  }

  function finishAd(player) {
    if (!settingEnabled("cleantubeFastForward")) return;

    const videos = player.querySelectorAll("video");
    for (const video of videos) {
      if (!(video instanceof HTMLVideoElement)) continue;

      video.muted = true;
      try {
        video.playbackRate = 16;
      } catch {
        // YouTube may temporarily lock the playback rate.
      }

      if (Number.isFinite(video.duration) && video.duration > 0) {
        try {
          video.currentTime = Math.max(video.currentTime, video.duration - 0.01);
        } catch {
          // Some streams are not seekable; the rate fallback remains active.
        }
      }
    }
  }

  function handlePlayerAd() {
    if (!settingEnabled("cleantubeEnabled")) return;

    const player = document.getElementById("movie_player");
    if (!isAdPlaying(player)) return;

    const isStaticInterstitial = Boolean(
      player.querySelector(".ytp-video-interstitial-buttoned-centered-layout")
    );
    const skipped = clickSkip(player);

    // A static interstitial displays over the user's actual video element.
    // Seeking that element would incorrectly skip their content, so only use
    // the video fallback for genuine video ads.
    if (!skipped && !isStaticInterstitial && isAdPlaying(player)) {
      finishAd(player);
    }
  }

  function sanitizeLivePlayerConfig() {
    if (!protectionEnabled()) return;

    sanitizePlayerResponse(window.ytInitialPlayerResponse);

    const args = window.ytplayer?.config?.args;
    if (!args) return;

    for (const key of ["raw_player_response", "player_response"]) {
      if (typeof args[key] === "string") {
        try {
          args[key] = JSON.stringify(sanitizePlayerResponse(JSON.parse(args[key])));
        } catch {
          // Ignore a partially populated config while YouTube is updating it.
        }
      } else {
        sanitizePlayerResponse(args[key]);
      }
    }
  }

  const observer = new MutationObserver(handlePlayerAd);

  function start() {
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: [
        "class",
        "data-cleantube-enabled",
        "data-cleantube-auto-skip",
        "data-cleantube-fast-forward"
      ],
      childList: true,
      subtree: true
    });
    sanitizeLivePlayerConfig();
    handlePlayerAd();
  }

  if (document.documentElement) start();
  else document.addEventListener("DOMContentLoaded", start, { once: true });

  // The interstitial countdown changes without predictable DOM mutations.
  setInterval(() => {
    sanitizeLivePlayerConfig();
    handlePlayerAd();
  }, 200);
})();
