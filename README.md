# CleanTube Ad Hider

A lightweight Chrome Manifest V3 extension that:

- hides common YouTube banner, feed, text-card, image, and overlay ads;
- removes known ad placements from YouTube player responses before playback;
- blocks requests to common Google advertising hosts;
- clicks visible “Skip ad” buttons automatically;
- continuously monitors pre-roll and mid-roll ads, then mutes and fast-forwards
  them when possible;
- provides a simple on/off switch.

See [the ad-format coverage matrix](docs/AD_COVERAGE.md) for the handling
strategy used for each official YouTube ad type.

## Project structure

```text
block-yt-ads/
├── manifest.json
├── README.md
├── assets/
│   └── icons/
│       ├── icon-16.png
│       ├── icon-32.png
│       ├── icon-48.png
│       └── icon-128.png
├── rules/
│   └── ad-servers.json
└── src/
    ├── content/
    │   ├── content.css
    │   └── content.js
    ├── injected/
    │   └── player-interceptor.js
    └── popup/
        ├── popup.css
        ├── popup.html
        └── popup.js
```

- `manifest.json` contains Chrome extension configuration and permissions.
- `src/content/` contains the scripts and styles injected into YouTube.
- `src/popup/` contains the extension popup interface and preference control.

## Install in Chrome

1. Open `chrome://extensions`.
2. Turn on **Developer mode** in the top-right corner.
3. Click **Load unpacked**.
4. Select this project folder.
5. Open or refresh YouTube.

After editing the source, click the extension's **Reload** button on
`chrome://extensions`, then refresh the YouTube tab.

## Privacy

This extension runs only on `youtube.com` and `m.youtube.com`. It stores only the
on/off preference locally and does not collect or transmit user data.

## Limitation

YouTube frequently changes its player and page markup. Selectors may therefore
need maintenance. Ads that are inserted directly into the same video stream
cannot always be skipped by a browser extension.
