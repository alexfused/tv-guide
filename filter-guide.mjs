// Keeps only the channels (and their listings) whose id matches a pattern, and drops <icon> tags.
// Usage: node filter-guide.mjs <input.xml> <output.xml> <id-regex>
// Used on the provider's own guide, which covers every country; icons are dropped because
// provider icon links can carry account details. Safe to rerun: it only overwrites the output.
import { readFileSync, writeFileSync } from 'node:fs'

const [inFile, outFile, pattern] = process.argv.slice(2)
if (!inFile || !outFile || !pattern) {
  console.error('Usage: node filter-guide.mjs <input.xml> <output.xml> <id-regex>')
  process.exit(1)
}

const keep = new RegExp(pattern, 'i')
const xml = readFileSync(inFile, 'utf8')
const channels = [...xml.matchAll(/<channel\s+id="([^"]+)"[\s\S]*?<\/channel>/g)]
  .filter(m => keep.test(m[1]))
  .map(m => m[0].replace(/\s*<icon\b[^>]*\/?>(\s*<\/icon>)?/g, ''))
const ids = new Set(channels.map(c => c.match(/id="([^"]+)"/)[1]))
const programmes = [...xml.matchAll(/<programme\b[^>]*\bchannel="([^"]+)"[\s\S]*?<\/programme>/g)]
  .filter(m => ids.has(m[1]))
  .map(m => m[0].replace(/\s*<icon\b[^>]*\/?>(\s*<\/icon>)?/g, ''))

writeFileSync(outFile, `<?xml version="1.0" encoding="UTF-8"?>\n<tv>\n${channels.join('\n')}\n${programmes.join('\n')}\n</tv>\n`)
console.log(`Kept ${channels.length} channels, ${programmes.length} programmes`)
