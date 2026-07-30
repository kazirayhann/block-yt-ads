(() => {
  "use strict";

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

    if (!clickSkip(player)) finishAd(player);
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
    handlePlayerAd();
  }

  if (document.documentElement) start();
  else document.addEventListener("DOMContentLoaded", start, { once: true });

  // The interstitial countdown changes without predictable DOM mutations.
  setInterval(handlePlayerAd, 200);
})();
