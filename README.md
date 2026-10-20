# TV guide

A UK TV guide (XMLTV) for IPTVX, rebuilt every night at 03:30 UTC by GitHub Actions.

Guide address for IPTVX: `https://alexfused.github.io/tv-guide/guide.xml.gz`

- `build-channels.mjs` picks one listings source per channel from the [iptv-org/epg](https://github.com/iptv-org/epg) site files and writes channel IDs in the same form the IPTV provider uses (e.g. `SkySportsMainEvent.uk`), so IPTVX matches channels automatically.
- `merge-guides.mjs` adds the [epgshare01](https://epgshare01.online/epgshare01/) UK guide under its own IDs (e.g. `TNT.Sports.1.HD.uk`), because the provider labels some channels that way instead.
- `.github/workflows/guide.yml` grabs 7 days of listings and publishes them to GitHub Pages. If a run returns fewer than 5,000 programmes it doesn't publish, so the previous guide stays live.
- To rebuild now: Actions tab → Build TV guide → Run workflow.
- `aliases.json` maps the provider's own guide codes (e.g. `BBC1.uk`) to guide channels, so those channels get listings too. To refresh it after the provider changes its line-up: run `node export-provider-channels.mjs` (asks for the login; saves only names and codes to the git-ignored `provider-channels.json`), then `node build-aliases.mjs provider-channels.json <a downloaded guide.xml> aliases.json`, and commit `aliases.json`.
