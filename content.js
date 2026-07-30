(() => {
  "use strict";

  const DEFAULTS = {
    enabled: true,
    hidePromotedContent: true,
    autoSkip: true,
    fastForwardVideoAds: true
  };

  const AD_SELECTORS = [
    // In-feed and search-result ads.
    "ytd-display-ad-renderer",
    "ytd-promoted-sparkles-web-renderer",
    "ytd-promoted-video-renderer",
    "ytd-ad-slot-renderer",
    "ytd-in-feed-ad-layout-renderer",
    "ytd-search-pyv-renderer",
    "ytd-promoted-sparkles-text-search-renderer",
    // Home-page masthead and promotional banners.
    "ytd-masthead-ad-v3-renderer",
    "ytd-video-masthead-ad-v3-renderer",
    "ytd-primetime-promo-renderer",
    "yt-mealbar-promo-renderer",
    "ytd-banner-promo-renderer",
    ".ytd-in-feed-ad-layout-renderer",
    // Watch-page overlays.
    ".ytp-ad-overlay-container"
  ];

  const SKIP_SELECTORS = [
    ".ytp-skip-ad-button",
    ".ytp-ad-skip-button",
    ".ytp-ad-skip-button-modern",
    "button.ytp-ad-skip-button-modern",
    "[id^='skip-button'] button"
  ];

  let settings = { ...DEFAULTS };
  let scheduled = false;

  function isVisible(element) {
    if (!(element instanceof HTMLElement)) return false;
    const style = getComputedStyle(element);
    return style.display !== "none" && style.visibility !== "hidden";
  }

  function removePromotedContent() {
    if (!settings.enabled || !settings.hidePromotedContent) return;

    for (const selector of AD_SELECTORS) {
      document.querySelectorAll(selector).forEach((element) => element.remove());
    }
  }

  function clickSkipButton() {
    if (!settings.enabled || !settings.autoSkip) return;

    for (const selector of SKIP_SELECTORS) {
      const button = document.querySelector(selector);
      if (button && isVisible(button)) {
        button.click();
        return;
      }
    }

    document
      .querySelectorAll(".ytp-ad-overlay-close-button")
      .forEach((button) => button.click());
  }

  function finishInStreamAd() {
    if (!settings.enabled || !settings.fastForwardVideoAds) return;

    const player = document.querySelector("#movie_player");
    if (
      !player ||
      (!player.classList.contains("ad-showing") &&
        !player.classList.contains("ad-interrupting"))
    ) {
      return;
    }

    const video = player.querySelector("video");
    if (!video) return;

    // Covers non-skippable and bumper ads. The guard above ensures that this
    // never changes playback while the user's selected video is playing.
    video.muted = true;
    video.playbackRate = 16;
    if (Number.isFinite(video.duration) && video.duration > 0) {
      try {
        video.currentTime = Math.max(video.currentTime, video.duration - 0.05);
      } catch {
        // Some ad streams do not allow seeking; the playback-rate fallback
        // still shortens them where YouTube permits it.
      }
    }
  }

  function removeShortsAds() {
    if (!settings.enabled || !settings.hidePromotedContent) return;

    document
      .querySelectorAll(
        "ytd-reel-video-renderer, ytd-shorts, ytd-shorts-video-renderer"
      )
      .forEach((short) => {
        const adMarker = short.querySelector(
          "ytd-ad-slot-renderer, [is-ad], [aria-label*='Sponsored'], [aria-label*='Ad']"
        );
        if (adMarker) short.remove();
      });
  }

  function handleAds() {
    scheduled = false;
    removePromotedContent();
    removeShortsAds();
    clickSkipButton();
    finishInStreamAd();
  }

  function scheduleAdCheck() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(handleAds);
  }

  function applySettings() {
    document.documentElement.classList.toggle(
      "cleantube-enabled",
      settings.enabled && settings.hidePromotedContent
    );
    scheduleAdCheck();
  }

  chrome.storage.sync.get(DEFAULTS, (savedSettings) => {
    settings = { ...DEFAULTS, ...savedSettings };
    applySettings();
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync") return;

    for (const [key, change] of Object.entries(changes)) {
      if (key in DEFAULTS) settings[key] = change.newValue;
    }
    applySettings();
  });

  const observer = new MutationObserver(scheduleAdCheck);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });

  // Some player controls update without adding a new DOM node.
  setInterval(handleAds, 750);
  document.addEventListener("yt-navigate-finish", handleAds);
})();
