(() => {
  "use strict";

  const STORAGE_KEY = "enabled";
  const AD_SELECTORS = [
    "ytd-display-ad-renderer",
    "ytd-promoted-sparkles-web-renderer",
    "ytd-promoted-sparkles-text-search-renderer",
    "ytd-promoted-video-renderer",
    "ytd-compact-promoted-video-renderer",
    "ytd-search-pyv-renderer",
    "ytd-ad-slot-renderer",
    "ytd-in-feed-ad-layout-renderer",
    "ytd-video-masthead-ad-v3-renderer",
    "ytd-video-masthead-ad-renderer",
    "ytd-reel-video-renderer[is-ad]",
    "yt-mealbar-promo-renderer",
    ".ytd-banner-promo-renderer",
    ".ytp-ad-overlay-container",
    ".ytp-ad-overlay-slot",
    ".ytp-ad-text-overlay",
    ".ytp-ad-image-overlay",
    ".ytp-ad-action-interstitial",
    "#masthead-ad",
    "#player-ads"
  ];
  const CLOSE_AD_SELECTORS = [
    ".ytp-ad-overlay-close-button",
    ".ytp-ad-overlay-close-container button",
    "button[aria-label='Close ad']",
    "button[aria-label='Dismiss ad']"
  ];
  const SKIP_BUTTON_SELECTORS = [
    ".ytp-ad-skip-button",
    ".ytp-ad-skip-button-modern",
    ".ytp-skip-ad-button",
    ".ytp-ad-skip-button-slot button",
    ".ytp-ad-skip-button-container",
    "button[class*='ytp-ad-skip']",
    "button[class*='skip-ad']",
    "button[aria-label^='Skip']",
    "button[aria-label*='Skip ad']",
    "[role='button'][aria-label^='Skip']",
    "[role='button'][aria-label*='Skip ad']"
  ];
  const PLAYER_SCAN_INTERVAL_MS = 200;

  let enabled = true;
  let observer;
  let scanTimer;
  let playerMonitor;
  let videoState;

  function isVideoAdPlaying() {
    const player = document.querySelector("#movie_player");
    if (!player) return false;

    if (
      player.classList.contains("ad-showing") ||
      player.classList.contains("ad-interrupting") ||
      player.classList.contains("ad-created")
    ) {
      return true;
    }

    const adUi = player.querySelector(
      ".video-ads:not(:empty), .ytp-ad-player-overlay, " +
        ".ytp-ad-preview-container, .ytp-ad-text-overlay, " +
        ".ytp-video-interstitial-buttoned-centered-layout__content__lockup__headline"
    );
    return adUi instanceof HTMLElement && adUi.offsetParent !== null;
  }

  function clickSkipButton() {
    const player = document.querySelector("#movie_player") ?? document;

    for (const selector of SKIP_BUTTON_SELECTORS) {
      const button = player.querySelector(selector);
      if (
        button instanceof HTMLElement &&
        (!(button instanceof HTMLButtonElement) || !button.disabled) &&
        button.getAttribute("aria-disabled") !== "true"
      ) {
        button.click();
        return true;
      }
    }

    const possibleButtons = player.querySelectorAll("button, [role='button']");
    for (const button of possibleButtons) {
      const label = `${button.getAttribute("aria-label") ?? ""} ${
        button.textContent ?? ""
      }`
        .replace(/\s+/g, " ")
        .trim();

      if (
        button instanceof HTMLElement &&
        /^(skip|skip ad|skip ads)(\s|$)/i.test(label)
      ) {
        button.click();
        return true;
      }
    }

    return false;
  }

  function removeAds() {
    for (const selector of AD_SELECTORS) {
      document.querySelectorAll(selector).forEach((element) => element.remove());
    }
  }

  function closeOverlayAds() {
    const player = document.querySelector("#movie_player");
    if (!player) return;

    for (const selector of CLOSE_AD_SELECTORS) {
      const button = player.querySelector(selector);
      if (button instanceof HTMLElement) button.click();
    }
  }

  function skipShortsAd() {
    if (!location.pathname.startsWith("/shorts/")) return;

    const activeShort = document.querySelector(
      "ytd-reel-video-renderer[is-active], ytd-reel-video-renderer[active]"
    );
    if (!(activeShort instanceof HTMLElement)) return;

    const hasAdMarker =
      activeShort.hasAttribute("is-ad") ||
      Boolean(
        activeShort.querySelector(
          "ytd-ad-slot-renderer, ytd-in-feed-ad-layout-renderer, " +
            ".ytp-ad-player-overlay, .ytp-ad-text, [class*='ad-badge']"
        )
      );
    if (!hasAdMarker) return;

    const nextButton = document.querySelector(
      "#navigation-button-down button, " +
        "button[aria-label='Next video'], button[aria-label='Next']"
    );
    if (nextButton instanceof HTMLElement) {
      nextButton.click();
      return;
    }

    window.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "ArrowDown",
        code: "ArrowDown",
        bubbles: true
      })
    );
  }

  function finishVideoAd() {
    if (!isVideoAdPlaying()) {
      restoreVideo();
      return;
    }

    const staticInterstitial = document.querySelector(
      "#movie_player .ytp-video-interstitial-buttoned-centered-layout"
    );
    if (
      staticInterstitial instanceof HTMLElement &&
      staticInterstitial.offsetParent !== null
    ) {
      restoreVideo();
      return;
    }

    const video =
      document.querySelector("#movie_player .video-ads video") ??
      document.querySelector("#movie_player video.html5-main-video") ??
      document.querySelector("#movie_player video");
    if (!(video instanceof HTMLVideoElement)) return;

    if (!videoState || videoState.video !== video) {
      videoState = {
        video,
        muted: video.muted,
        playbackRate: video.playbackRate
      };
    }

    video.muted = true;
    try {
      video.playbackRate = 16;
    } catch {
      // The player may temporarily reject a playback-rate change.
    }

    if (
      Number.isFinite(video.duration) &&
      video.duration > 0 &&
      video.duration - video.currentTime > 0.25
    ) {
      try {
        video.currentTime = Math.max(video.currentTime, video.duration - 0.1);
      } catch {
        // Some YouTube streams do not allow seeking. Fast playback remains active.
      }
    }
  }

  function restoreVideo(video = videoState?.video) {
    if (!videoState || videoState.video !== video) return;
    video.muted = videoState.muted;
    video.playbackRate = videoState.playbackRate;
    videoState = undefined;
  }

  function scan() {
    if (!enabled) return;
    clickSkipButton();
    closeOverlayAds();
    skipShortsAd();
    removeAds();
    finishVideoAd();
  }

  function queueScan() {
    if (scanTimer || !enabled) return;
    scanTimer = window.setTimeout(() => {
      scanTimer = undefined;
      scan();
    }, 80);
  }

  function start() {
    const root = document.documentElement;
    if (!root) {
      document.addEventListener("DOMContentLoaded", start, { once: true });
      return;
    }

    root.classList.add("cleantube-enabled");
    root.dataset.cleantubeContent = "active";
    observer ??= new MutationObserver(queueScan);
    observer.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class"]
    });
    if (!playerMonitor) {
      playerMonitor = window.setInterval(scan, PLAYER_SCAN_INTERVAL_MS);
    }
    scan();
  }

  function stop() {
    document.documentElement?.classList.remove("cleantube-enabled");
    if (document.documentElement) {
      delete document.documentElement.dataset.cleantubeContent;
    }
    observer?.disconnect();
    restoreVideo();
    if (playerMonitor) window.clearInterval(playerMonitor);
    playerMonitor = undefined;
    if (scanTimer) window.clearTimeout(scanTimer);
    scanTimer = undefined;
  }

  function setEnabled(value) {
    enabled = value;
    if (enabled) start();
    else stop();
  }

  chrome.storage.local.get({ [STORAGE_KEY]: true }, (result) => {
    setEnabled(result[STORAGE_KEY]);
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "local" && changes[STORAGE_KEY]) {
      setEnabled(changes[STORAGE_KEY].newValue);
    }
  });

  document.addEventListener("yt-navigate-finish", queueScan);
  window.addEventListener("pageshow", queueScan);
})();
