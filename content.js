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
    "ytd-video-masthead-ad-advertiser-info-renderer",
    "ytd-primetime-promo-renderer",
    "ytm-promoted-video-renderer",
    "[data-ad-slot-id]",
    "[is-ad='true']",
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
    const bounds = element.getBoundingClientRect();
    return (
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      bounds.width > 0 &&
      bounds.height > 0
    );
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

    // YouTube also ships an experiment where the skip control has generated
    // class names. Match its accessible label/text instead of those classes.
    const controls = document.querySelectorAll(
      "button, [role='button'], tp-yt-paper-button"
    );
    for (const control of controls) {
      const label = [
        control.getAttribute("aria-label"),
        control.getAttribute("title"),
        control.textContent
      ]
        .filter(Boolean)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();

      if (
        isVisible(control) &&
        /^(skip|skip ad|skip ads|skip video)\b/.test(label)
      ) {
        control.click();
        return;
      }
    }

    document
      .querySelectorAll(".ytp-ad-overlay-close-button")
      .forEach((button) => button.click());
  }

  function removeSponsoredCards() {
    if (!settings.enabled || !settings.hidePromotedContent) return;

    const markers = document.querySelectorAll(
      "span, yt-formatted-string, .yt-core-attributed-string"
    );
    for (const marker of markers) {
      const text = marker.textContent?.replace(/\s+/g, " ").trim().toLowerCase();
      if (text !== "sponsored" && text !== "ad") continue;

      const container = marker.closest(
        [
          "ytd-ad-slot-renderer",
          "ytd-display-ad-renderer",
          "ytd-video-masthead-ad-v3-renderer",
          "ytd-rich-item-renderer",
          "ytm-promoted-video-renderer",
          "[data-ad-slot-id]",
          "[is-ad='true']"
        ].join(",")
      );

      // Never remove the watch-page player. In-stream ads are handled through
      // their skip control or the guarded fast-forward path.
      if (container && !container.matches("#movie_player, #player")) {
        container.remove();
      }
    }
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
    removeSponsoredCards();
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
    document.documentElement.dataset.cleantubeEnabled = String(settings.enabled);
    document.documentElement.dataset.cleantubeAutoSkip = String(
      settings.autoSkip
    );
    document.documentElement.dataset.cleantubeFastForward = String(
      settings.fastForwardVideoAds
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
