# YouTube ad-format coverage

This matrix follows the formats listed in Google's official
[About video ad formats](https://support.google.com/youtube/answer/2375464?hl=en)
documentation.

| Official format | YouTube placement | CleanTube strategy |
| --- | --- | --- |
| Skippable in-stream | Before, during, or after a video | Remove player ad placements, click Skip in the page context, then seek as fallback |
| Non-skippable in-stream | Before, during, or after a video | Remove player ad placements; mute and seek active ad media as fallback |
| Bumper | Six-second pre-, mid-, or post-roll | Same prevention and active-media fallback as in-stream ads |
| In-feed video | Home, Search, Watch Next, Subscriptions | Remove promoted and ad-slot renderers from feeds |
| Masthead | Top of the YouTube Home feed | Hide and remove desktop/mobile masthead renderers |
| YouTube Shorts | Between videos in the Shorts feed | Remove known ad cards or advance to the next Short |

Static buttoned interstitials use a separate path: CleanTube clicks the native
Skip control, removes the static layout if it remains, clears the ad-only player
state, and resumes the underlying content without seeking it.

## Additional surfaces

CleanTube also removes companion panels, banner promotions, legacy overlays,
text/image interstitials, and requests to common Google advertising hosts.

## Technical boundary

YouTube can deliver advertising and normal content from the same first-party
player and media hosts. A rule broad enough to block every such request would
also block normal videos. CleanTube therefore combines targeted response
sanitizing, network rules, UI removal, auto-skip, and media seeking instead of
blocking all YouTube media traffic.
