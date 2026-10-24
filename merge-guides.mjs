// Merges several XMLTV files into one, so channels match whichever ID style the provider uses.
// Usage: node merge-guides.mjs [--aliases aliases.json] <output.xml> <input1.xml> [input2.xml ...]
// The first file wins when two files use the same channel id. With --aliases, each
// { "<provider code>": "<guide id>" } pair also publishes that guide channel's listings under the
// provider's code, so IPTVX matches it. Safe to rerun: it only overwrites the output.
import { readFileSync, writeFileSync } from 'node:fs'

const args = process.argv.slice(2)
let aliases = {}
// --fill files are merged last, after aliases, so they only add channels nothing else covers.
const fillInputs = []
while (args[0] === '--aliases' || args[0] === '--fill') {
  if (args[0] === '--aliases') aliases = JSON.parse(readFileSync(args[1], 'utf8'))
  else fillInputs.push(args[1])
  args.splice(0, 2)
}
const [outFile, ...inputs] = args
if (!outFile || inputs.length === 0) {
  console.error('Usage: node merge-guides.mjs [--aliases aliases.json] <output.xml> <input.xml>...')
  process.exit(1)
}

const channelRe = /<channel\s+id="([^"]+)"[\s\S]*?<\/channel>/g
const programmeRe = /<programme\b[^>]*\bchannel="([^"]+)"[\s\S]*?<\/programme>/g
const escAttr = s => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')

const channels = new Map()
const programmesById = new Map()
function addFile(file) {
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
    if (!programmesById.has(m[1])) programmesById.set(m[1], [])
    programmesById.get(m[1]).push(m[0])
    kept++
  }
  console.log(`${file}: ${fresh.size} new channels, ${kept} programmes`)
}
for (const file of inputs) addFile(file)

let aliased = 0
for (const [code, target] of Object.entries(aliases)) {
  if (channels.has(code) || !channels.has(target) || !programmesById.has(target)) continue
  const id = escAttr(code)
  channels.set(code, channels.get(target).replace(/<channel\s+id="[^"]+"/, `<channel id="${id}"`))
  programmesById.set(code, programmesById.get(target).map(p => p.replace(/\bchannel="[^"]+"/, `channel="${id}"`)))
  aliased++
}
if (aliased) console.log(`Added listings under ${aliased} provider codes`)
for (const file of fillInputs) addFile(file)

const programmes = [...programmesById.values()].flat()
writeFileSync(
  outFile,
  `<?xml version="1.0" encoding="UTF-8"?>\n<tv>\n${[...channels.values()].join('\n')}\n${programmes.join('\n')}\n</tv>\n`
)
console.log(`Wrote ${channels.size} channels, ${programmes.length} programmes to ${outFile}`)
