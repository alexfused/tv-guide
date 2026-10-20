// Builds channels.xml for the iptv-org grabber: one listings source per UK/US channel.
// Usage: node build-channels.mjs <path-to-iptv-org-epg> <output.xml>
// Safe to rerun: it only reads the iptv-org site files and overwrites the output.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const [epgDir, outFile] = process.argv.slice(2)
if (!epgDir || !outFile) {
  console.error('Usage: node build-channels.mjs <epg-dir> <output.xml>')
  process.exit(1)
}

// Sources in order of preference per country. Earlier sources win when two cover the same channel.
const SOURCES = {
  uk: ['sky.com', 'freeview.co.uk', 'mytelly.co.uk', 'player.ee.co.uk'],
  us: ['tvpassport.com', 'tvguide.com', 'ontvtonight.com']
}
// Within one source, prefer these feeds (the part after "@" in iptv-org ids).
// Unlisted feeds (regional variants like "WalesHD") rank after these.
const FEED_RANK = ['HD', 'LondonHD', 'UKHD', 'SD', 'London', 'UK', 'East', '']
// Never use these feeds: +1 would show listings an hour late, the others are another country's schedule.
const SKIP_FEED = /Plus1|Germany|Ireland/i

const channelRe = /<channel\s+([^>]*)>([^<]*)<\/channel>/g
const attrRe = /(\w+)="([^"]*)"/g

function readSite(site) {
  const dir = join(epgDir, 'sites', site)
  const files = readdirSync(dir).filter(f => f.endsWith('.channels.xml'))
  const out = []
  for (const f of files) {
    const xml = readFileSync(join(dir, f), 'utf8')
    for (const [, attrs, name] of xml.matchAll(channelRe)) {
      const a = Object.fromEntries([...attrs.matchAll(attrRe)].map(m => [m[1], m[2]]))
      if (!a.xmltv_id) continue
      const [baseId, feed = ''] = a.xmltv_id.split('@')
      if (SKIP_FEED.test(feed)) continue
      // sky.com's file covers several countries; only take the UK listings.
      if (site === 'sky.com' && !a.site_id.startsWith('GB#')) continue
      out.push({ ...a, baseId, feed, name })
    }
  }
  return out
}

const feedRank = feed => {
  const i = FEED_RANK.indexOf(feed)
  return i === -1 ? FEED_RANK.length : i
}

const chosen = new Map()
for (const [country, sites] of Object.entries(SOURCES)) {
  for (const site of sites) {
    const candidates = readSite(site)
      .filter(c => c.baseId.endsWith(`.${country}`))
      .sort((a, b) => feedRank(a.feed) - feedRank(b.feed))
    for (const c of candidates) {
      if (!chosen.has(c.baseId)) chosen.set(c.baseId, c)
    }
  }
}

const esc = s => s.replace(/&(?!amp;|lt;|gt;|quot;|apos;)/g, '&amp;')
const lines = [...chosen.values()]
  .sort((a, b) => a.baseId.localeCompare(b.baseId))
  // xmltv_id is written without the "@feed" part so it matches the provider's tvg-id exactly.
  .map(c => `  <channel site="${c.site}" site_id="${esc(c.site_id)}" lang="${c.lang}" xmltv_id="${c.baseId}">${esc(c.name)}</channel>`)

writeFileSync(outFile, `<?xml version="1.0" encoding="UTF-8"?>\n<channels>\n${lines.join('\n')}\n</channels>\n`)
const bySite = {}
for (const c of chosen.values()) bySite[c.site] = (bySite[c.site] || 0) + 1
console.log(`Wrote ${chosen.size} channels to ${outFile}`, bySite)
