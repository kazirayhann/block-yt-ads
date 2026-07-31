# CleanTube Ad Hider

Current version: **1.4.0**

A lightweight Chrome Manifest V3 extension that:

- automatically clicks YouTube's available ad skip button;
- removes ad placements from initial and SPA player responses before YouTube
  constructs its ad player;
- fast-forwards in-stream ads only while YouTube marks the player as showing an
  ad;
- visually covers timer-based static/image interstitial ads until the player
  allows them to be dismissed;
- closes video ad overlays;
- hides promoted banners and feed ads;
- detects and removes sponsored Shorts containers;
- provides on/off controls from the extension popup.

## Format coverage

| YouTube ad format | Extension action |
| --- | --- |
| Skippable in-stream | Clicks the available skip button |
| Non-skippable in-stream | Attempts to seek to the end; falls back to 16x |
| In-feed video | Removes the promoted result/container |
| Bumper | Attempts to seek to the end; falls back to 16x |
| Masthead | Hides/removes known masthead renderers |
| YouTube Shorts | Removes a Short only when an ad/sponsored marker is present |

## Install in Chrome

1. Open `chrome://extensions`.
2. Turn on **Developer mode** in the top-right corner.
3. Click **Load unpacked**.
4. Select this `block-yt-ads` folder.
5. Open or refresh a YouTube tab.

After editing the code, click the extension's **Reload** button on
`chrome://extensions`, then refresh YouTube.

## Important limitation

This extension does not modify or intercept YouTube network requests. It works
against the page and player UI, so YouTube can prevent seeking or change its
markup at any time. In those cases an ad may still play, and selectors may need
updates. Chrome Web Store publication is also subject to Google's current
policies and review.
