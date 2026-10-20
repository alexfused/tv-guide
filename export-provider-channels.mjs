// One-off: saves the provider's UK live channel names + guide codes to provider-channels.json.
// Asks for the Xtream server, username and password at the prompt; none of them are written to disk.
// Usage: node export-provider-channels.mjs
import { writeFileSync } from 'node:fs'
import { createInterface } from 'node:readline'

function ask(question, hidden = false) {
  return new Promise(resolve => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true })
    if (hidden) {
      rl._writeToOutput = s => {
        if (s.startsWith(question)) rl.output.write(question)
      }
    }
    rl.question(question, answer => {
      rl.close()
      if (hidden) process.stdout.write('\n')
      resolve(answer.trim())
    })
  })
}

// Accept "line.example.com", "ttp://line.example.com/" etc.: keep the host part and default to http://.
// Ask again until it looks like a host name (letters/digits/dots, optional :port), not pasted email text.
let server
while (!server) {
  const typed = await ask('Server address (e.g. line.example.com): ')
  const scheme = /^https:\/\//i.test(typed) ? 'https://' : 'http://'
  const host = typed.replace(/^[a-z]*:\/\//i, '').replace(/\/+$/, '')
  if (/^[a-z0-9.-]+\.[a-z]{2,}(:\d+)?$/i.test(host)) server = scheme + host
  else console.log(`"${typed}" doesn't look like a server address. Type just the address, e.g. line.trxdnscloud.ru`)
}
console.log(`Using ${server}`)
const username = await ask('Username: ')
const password = await ask('Password (hidden): ', true)

async function api(action) {
  const url = new URL(`${server}/player_api.php`)
  url.search = new URLSearchParams({ username, password, action }).toString()
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Provider returned HTTP ${res.status} for ${action}`)
  return res.json()
}

const categories = await api('get_live_categories')
const ukCategories = new Map(
  categories.filter(c => /^UK\s*\|/i.test(c.category_name)).map(c => [String(c.category_id), c.category_name])
)
const streams = await api('get_live_streams')
const uk = streams
  .filter(s => ukCategories.has(String(s.category_id)))
  .map(s => ({ name: s.name, epg_id: s.epg_channel_id || '', category: ukCategories.get(String(s.category_id)) }))

const out = new URL('./provider-channels.json', import.meta.url)
writeFileSync(out, JSON.stringify(uk, null, 1))
console.log(`Saved ${uk.length} UK channels from ${ukCategories.size} categories to ${out.pathname}`)
console.log('Only channel names, categories and guide codes were saved. No login details.')
