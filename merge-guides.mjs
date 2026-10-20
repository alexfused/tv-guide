// Merges several XMLTV files into one, so channels match whichever ID style the provider uses.
// Usage: node merge-guides.mjs <output.xml> <input1.xml> [input2.xml ...]
// The first file wins when two files use the same channel id. Safe to rerun: it only overwrites the output.
import { readFileSync, writeFileSync } from 'node:fs'

const [outFile, ...inputs] = process.argv.slice(2)
if (!outFile || inputs.length === 0) {
  console.error('Usage: node merge-guides.mjs <output.xml> <input.xml>...')
  process.exit(1)
}

const channelRe = /<channel\s+id="([^"]+)"[\s\S]*?<\/channel>/g
const programmeRe = /<programme\b[^>]*\bchannel="([^"]+)"[\s\S]*?<\/programme>/g

const channels = new Map()
const programmes = []
for (const file of inputs) {
  const xml = readFileSync(file, 'utf8')
  const fresh = new Set()
  for (const m of xml.matchAll(channelRe)) {
    if (channels.has(m[1])) continue
    channels.set(m[1], m[0])
    fresh.add(m[1])
  }
  let kept = 0
  for (const m of xml.matchAll(programmeRe)) {
    // Skip listings for an id an earlier file already supplied, so a channel never gets two schedules.
    if (!fresh.has(m[1])) continue
    programmes.push(m[0])
    kept++
  }
  console.log(`${file}: ${fresh.size} new channels, ${kept} programmes`)
}

writeFileSync(
  outFile,
  `<?xml version="1.0" encoding="UTF-8"?>\n<tv>\n${[...channels.values()].join('\n')}\n${programmes.join('\n')}\n</tv>\n`
)
console.log(`Wrote ${channels.size} channels, ${programmes.length} programmes to ${outFile}`)
