(() => {
  "use strict";

  const AD_RESPONSE_KEYS = new Set([
    "ad3_module",
    "adBreakHeartbeatParams",
    "adPlacements",
    "adSlots",
    "adSurvey",
    "playerAds"
  ]);
  const PLAYER_ENDPOINT = /\/youtubei\/v1\/player(?:\?|$)/;
  const SKIP_SELECTORS = [
    ".ytp-skip-ad-button",
    ".ytp-ad-skip-button",
    ".ytp-ad-skip-button-modern",
    ".ytp-ad-skip-button-container",
    ".ytp-ad-skip-button-slot button",
    ".ytp-skip-ad-button__text"
  ];

  function stripAdData(value, seen = new WeakSet()) {
    if (!value || typeof value !== "object" || seen.has(value)) return value;
    seen.add(value);

    if (Array.isArray(value)) {
      for (const item of value) stripAdData(item, seen);
      return value;
    }

    for (const key of Object.keys(value)) {
      if (AD_RESPONSE_KEYS.has(key)) {
        delete value[key];
      } else {
        stripAdData(value[key], seen);
      }
    }

    return value;
  }

  function sanitizePlayerResponse(value) {
    if (typeof value === "string") {
      try {
        return JSON.stringify(stripAdData(JSON.parse(value)));
      } catch {
        return value;
      }
    }
    return stripAdData(value);
  }

  function installInitialResponseGuard() {
    let initialResponse = sanitizePlayerResponse(window.ytInitialPlayerResponse);

    try {
      Object.defineProperty(window, "ytInitialPlayerResponse", {
        configurable: true,
        enumerable: true,
        get() {
          return initialResponse;
        },
        set(value) {
          initialResponse = sanitizePlayerResponse(value);
        }
      });
    } catch {
      // YouTube may have already made the property non-configurable.
    }
  }

  function installFetchGuard() {
    const nativeFetch = window.fetch;
    if (typeof nativeFetch !== "function") return;

    window.fetch = async function cleanTubeFetch(input, init) {
      const response = await nativeFetch.call(this, input, init);
      const requestUrl =
        typeof input === "string" ? input : input?.url ? input.url : "";

      if (!PLAYER_ENDPOINT.test(requestUrl)) return response;

      const nativeJson = response.json.bind(response);
      const nativeText = response.text.bind(response);
      try {
        Object.defineProperty(response, "json", {
          configurable: true,
          value: async () => sanitizePlayerResponse(await nativeJson())
        });
        Object.defineProperty(response, "text", {
          configurable: true,
          value: async () => sanitizePlayerResponse(await nativeText())
        });
      } catch {
        // The cosmetic/skip layer remains available if this response is immutable.
      }

      return response;
    };
  }

  function sanitizeKnownGlobals() {
    if (window.ytInitialPlayerResponse) {
      stripAdData(window.ytInitialPlayerResponse);
    }

    const rawResponse = window.ytplayer?.config?.args?.raw_player_response;
    if (rawResponse) {
      window.ytplayer.config.args.raw_player_response =
        sanitizePlayerResponse(rawResponse);
    }
  }

  function clickInPageContext(element) {
    if (!(element instanceof HTMLElement)) return false;

    const clickable =
      element.closest("button, [role='button'], .ytp-button") ?? element;
    if (typeof PointerEvent === "function") {
      clickable.dispatchEvent(
        new PointerEvent("pointerdown", { bubbles: true, cancelable: true })
      );
    }
    clickable.dispatchEvent(
      new MouseEvent("mousedown", { bubbles: true, cancelable: true })
    );
    clickable.dispatchEvent(
      new MouseEvent("mouseup", { bubbles: true, cancelable: true })
    );
    clickable.click();
    return true;
  }

  function skipActiveAd() {
    const player = document.querySelector("#movie_player");
    const searchRoot = player ?? document;
    let skipClicked = false;

    for (const selector of SKIP_SELECTORS) {
      const skipControl = searchRoot.querySelector(selector);
      if (clickInPageContext(skipControl)) {
        skipClicked = true;
        break;
      }
    }

    if (!skipClicked) {
      for (const control of searchRoot.querySelectorAll("button, [role='button']")) {
        const label = `${control.getAttribute("aria-label") ?? ""} ${
          control.textContent ?? ""
        }`
          .replace(/\s+/g, " ")
          .trim();
        if (/^(skip|skip ad|skip ads)(\s|$)/i.test(label)) {
          if (clickInPageContext(control)) break;
        }
      }
    }

    if (!player) return;

    const adModule = player.querySelector(".video-ads:not(:empty)");
    const staticInterstitial = player.querySelector(
      ".ytp-video-interstitial-buttoned-centered-layout"
    );
    const centeredInterstitial = player.querySelector(
      ".ytp-video-interstitial-buttoned-centered-layout__content__lockup__headline"
    );
    const adActive =
      player.classList.contains("ad-showing") ||
      player.classList.contains("ad-interrupting") ||
      player.classList.contains("ad-created") ||
      (adModule instanceof HTMLElement && adModule.offsetParent !== null) ||
      (centeredInterstitial instanceof HTMLElement &&
        centeredInterstitial.offsetParent !== null);
    if (!adActive) return;

    for (const methodName of ["skipAd", "dismissAd"]) {
      const method = player[methodName];
      if (typeof method === "function") {
        try {
          method.call(player);
        } catch {
          // Continue to the direct media fallback.
        }
      }
    }

    if (
      staticInterstitial instanceof HTMLElement &&
      staticInterstitial.offsetParent !== null
    ) {
      staticInterstitial.remove();
      player.classList.remove(
        "ad-created",
        "ad-showing",
        "ad-interrupting",
        "ended-mode",
        "ytp-ad-display-override"
      );

      if (typeof player.playVideo === "function") {
        try {
          player.playVideo();
        } catch {
          // Fall through to the native video play call.
        }
      }

      const contentVideo = player.querySelector("video.html5-main-video");
      if (contentVideo instanceof HTMLVideoElement && contentVideo.paused) {
        contentVideo.play().catch(() => {});
      }
      return;
    }

    const video =
      player.querySelector(".video-ads video") ??
      player.querySelector("video.html5-main-video, video");
    if (video instanceof HTMLVideoElement) {
      video.muted = true;
      try {
        video.playbackRate = 16;
        video.currentTime =
          Number.isFinite(video.duration) && video.duration > 0
            ? video.duration
            : 1_000_000;
      } catch {
        // A later polling pass will retry while the ad remains active.
      }
    }
  }

  window.setInterval(() => {
    try {
      skipActiveAd();
    } catch {
      // One transient YouTube DOM state must not stop future polling passes.
    }
  }, 100);

  try {
    installInitialResponseGuard();
  } catch {
    // Active ad handling remains available.
  }

  try {
    installFetchGuard();
  } catch {
    // Active ad handling remains available.
  }

  try {
    sanitizeKnownGlobals();
  } catch {
    // Active ad handling remains available.
  }

  document.addEventListener("yt-navigate-start", () => {
    try {
      sanitizeKnownGlobals();
    } catch {
      // The next player response or active-ad poll will retry.
    }
  });
})();
