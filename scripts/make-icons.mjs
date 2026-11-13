// Gera os ícones PNG a partir de public/icon.svg (executar: node scripts/make-icons.mjs)
import sharp from 'sharp'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const svg = readFileSync(new URL('../public/icon.svg', import.meta.url))
const out = (n) => fileURLToPath(new URL(`../public/${n}`, import.meta.url))

await sharp(svg).resize(192, 192).png().toFile(out('icon-192.png'))
await sharp(svg).resize(512, 512).png().toFile(out('icon-512.png'))
await sharp(svg).resize(180, 180).png().toFile(out('apple-touch-icon.png'))

// maskable: conteúdo dentro da zona segura (80%), fundo cheio
const inner = await sharp(svg).resize(400, 400).png().toBuffer()
await sharp({ create: { width: 512, height: 512, channels: 4, background: '#0a0a0b' } })
  .composite([{ input: inner, gravity: 'center' }])
  .png()
  .toFile(out('icon-maskable-512.png'))
console.log('Ícones gerados.')
