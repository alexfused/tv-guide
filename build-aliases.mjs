// Pairs each provider guide code that the guide doesn't already carry with a guide channel, by name.
// Usage: node build-aliases.mjs <provider-channels.json> <guide.xml> <aliases.json>
// Writes { "<provider code>": "<guide channel id>" } and prints what it couldn't match. Safe to rerun.
import { readFileSync, writeFileSync } from 'node:fs'

const [providerFile, guideFile, outFile] = process.argv.slice(2)
if (!providerFile || !guideFile || !outFile) {
  console.error('Usage: node build-aliases.mjs <provider-channels.json> <guide.xml> <aliases.json>')
  process.exit(1)
}

const WORD_NUMBERS = { one: '1', two: '2', three: '3', four: '4', five: '5' }
// Turns "UK| BBC ONE NORTH WEST HD", "BBCOneNorthWest.uk" or "uk.BBC1 London" into one comparable key.
function key(s) {
  return s
    .replace(/([a-z])([A-Z0-9])/g, '$1 $2') // split camelCase ids: BBCOneNorthWest -> BBC One North West
    .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2') // split acronym + word: ITVGranada -> ITV Granada
    .toLowerCase()
    .replace(/\+\s*1\b/g, ' plus1 ') // keep +1 channels distinct from the main channel
    .replace(/^(uk|gb)[|.\s-]+|[.\s](uk|ie|gb)$/g, ' ')
    .replace(/^\s*u\s*(&amp;|&|and)\s*/, ' ') // UKTV brands: "U&Yesterday" -> "Yesterday"
    .replace(/^\s*u\s+(?=[a-z])/, ' ') // and their codes split from "UYesterday.uk" -> "u yesterday"
    .replace(/^\s*\d{3}\s+/, ' ') // Sky EPG numbers some codes start with: "861 SkySp ActionHD"
    .replace(/\b(uhd|4k|fhd|hd|sd|hevc|raw|60fps|bk|vip)\b/g, ' ')
    .replace(/\b(one|two|three|four|five)\b/g, w => WORD_NUMBERS[w])
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '')
}

const guide = readFileSync(guideFile, 'utf8')
const guideIds = new Set()
const byKey = new Map()
// Prefer the first id seen for a key; the guide lists iptv-org ids before epgshare01 ones.
const remember = (k, id) => { if (k && !byKey.has(k)) byKey.set(k, id) }
for (const m of guide.matchAll(/<channel id="([^"]+)">([\s\S]*?)<\/channel>/g)) {
  const [, id, body] = m
  guideIds.add(id)
  remember(key(id.replace(/\./g, ' ')), id)
  for (const n of body.matchAll(/<display-name[^>]*>([^<]+)<\/display-name>/g)) remember(key(n[1]), id)
}
// Only channels that actually have listings are worth pointing at.
const withListings = new Set([...guide.matchAll(/<programme\b[^>]*\bchannel="([^"]+)"/g)].map(m => m[1]))

// Codes the name matcher can't work out. ITV regions carry the ITV1 network schedule apart from local news.
const MANUAL = {
  'ITVGranada.uk': 'ITV1.uk', 'uk.ITV Granada': 'ITV1.uk', 'ITVAnglia.uk': 'ITV1.uk', 'ITVCentral.uk': 'ITV1.uk',
  'ITVWales.uk': 'ITV1.uk', 'ITV1Wales.uk': 'ITV1.uk', 'LocalTVTyneAndWear.uk': 'ITV1.uk',
  'uk.ITV Central': 'ITV1+1.uk', 'uk.ITV London': 'ITV1+1.uk',
  'uk.BBC1 London': 'BBC.One.Lon.HD.uk', 'uk.BBC One HD (England)': 'BBCOne.uk',
  'ukBBC1 East Midlands': 'BBC.One.E.Mid.HD.uk', 'BBCOneNorthWest.uk': 'BBC.One.N.West.HD.uk',
  'BBCOneScotland.uk': 'BBC.One.ScotHD.uk', 'BBCOneSouthEast.uk': 'BBC.One.S.East.HD.uk',
  'BBCOneWales.uk': 'BBC.One.Wal.HD.uk', 'BBCOneNorthernIreland.uk': 'BBC.One.NI.HD.uk',
  'BBCTwoWales.uk': 'BBC.Two.Wal.HD.uk', 'uk.BBC2 N Ireland': 'BBC.Two.NI.HD.uk',
  'BBC3CBBC.uk': 'CBBC.uk', 'BBC4CBeebies.uk': 'CBeebies.uk',
  'SkySportsAction.uk': 'SkySportsNFL.uk', 'uk.861 SkySp ActionHD': 'SkySportsNFL.uk', 'uk.407 SkySp Action': 'SkySportsNFL.uk',
  'SkySportsPremiereLeague.uk': 'SkySportsPremierLeague.uk', 'uk.Sky Sports Premier League': 'SkySportsPremierLeague.uk',
  'uk.Sky Sports Premier League HD': 'SkySportsPremierLeague.uk',
  'uk.412 Premier 1 HD': 'Premier.Sports.1.HD.uk', 'uk.429 Premier 2 HD': 'Premier.Sports.2.HD.uk',
  'RacingUK.uk': 'RacingTV.uk', 'HistoryChannel.uk': 'SkyHistory.uk', 'History2.uk': 'SkyHistory2.uk',
  'CrimeAndInvestigationNetwork.uk': 'CrimePlusInvestigation.uk', 'CrimeInvestigation.uk': 'CrimePlusInvestigation.uk',
  'DiscoveryScience.uk': 'DiscoveryScienceEurope.uk', 'uk.Cartoon Network': 'CartoonNetwork.uk',
  'uk.Cartoon Network HD': 'CartoonNetwork.uk', 'uk.Sky Cinema Family': 'SkyCinemaFamily.uk',
  'uk.Sky Cinema Sci Fi & Horror': 'SkyCinemaSciFiHorror.uk', 'UK| SKY CINEMA THRILLER': 'SkyCinemaThriller.uk',
  'uk.ITV BE': 'ITVBe.uk', 'uk.Alibi HD': 'UAlibi.uk', 'uk.horror ch+1': 'HorrorXtra.uk',
  'BTSportUltimate.uk': 'TNT.Sports.Ultimate.HD.uk'
}

const provider = JSON.parse(readFileSync(providerFile, 'utf8'))
const aliases = {}
const unmatched = new Map()
for (const c of provider) {
  const code = c.epg_id
  if (!code || guideIds.has(code) || aliases[code]) continue
  // Hand-written table first, then the code itself, then the channel's display name.
  const target = [MANUAL[code], ...[key(code.replace(/\./g, ' ')), key(code), key(c.name)].map(k => byKey.get(k))]
    .find(id => id && withListings.has(id))
  if (target) {
    aliases[code] = target
    unmatched.delete(code)
  } else unmatched.set(code, c.name)
}

writeFileSync(outFile, JSON.stringify(aliases, null, 1) + '\n')
console.log(`Matched ${Object.keys(aliases).length} provider codes; ${unmatched.size} unmatched:`)
for (const [code, name] of unmatched) console.log(`  ${code}  (${name})`)
