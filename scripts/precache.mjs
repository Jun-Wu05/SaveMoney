import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { createHash } from 'node:crypto'

const root = 'dist'
const swPath = join(root, 'sw.js')

function assetsIn(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const full = join(directory, entry.name)
    if (entry.isDirectory()) return assetsIn(full)
    if (!/\.(js|css|woff2?|png|svg)$/.test(entry.name)) return []
    return ['/SaveMoney/' + relative(root, full).split(sep).join('/')]
  })
}

const contents = readFileSync(swPath, 'utf8')
const marker = "'__PRECACHE_ASSETS__'"
if (!contents.includes(marker)) throw new Error('Missing precache marker')
const assets = assetsIn(root)
const cacheName = 'savemoney-shell-' + createHash('sha256').update(JSON.stringify(assets)).digest('hex').slice(0, 12)
if (!contents.includes("'__BUILD_CACHE_NAME__'")) throw new Error('Missing build cache marker')
writeFileSync(swPath, contents.replace(marker, JSON.stringify(assets)).replace("'__BUILD_CACHE_NAME__'", JSON.stringify(cacheName)), 'utf8')
console.log('Offline assets embedded in service worker')
