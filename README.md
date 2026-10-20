# TV guide

A UK + US TV guide (XMLTV) for IPTVX, rebuilt every night at 03:30 UTC by GitHub Actions.

Guide address for IPTVX: `https://alexfused.github.io/tv-guide/guide.xml.gz`

- `build-channels.mjs` picks one listings source per channel from the [iptv-org/epg](https://github.com/iptv-org/epg) site files and writes channel IDs in the same form the IPTV provider uses (e.g. `SkySportsMainEvent.uk`), so IPTVX matches channels automatically.
- `.github/workflows/guide.yml` grabs 7 days of listings and publishes them to GitHub Pages. If a run returns fewer than 20,000 programmes it doesn't publish, so the previous guide stays live.
- To rebuild now: Actions tab → Build TV guide → Run workflow.
