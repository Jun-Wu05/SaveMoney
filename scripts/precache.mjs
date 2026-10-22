import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

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
writeFileSync(swPath, contents.replace(marker, JSON.stringify(assetsIn(root))), 'utf8')
console.log('Offline assets embedded in service worker')
