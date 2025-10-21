import { Canvas, createCanvas } from '@napi-rs/canvas'
import { formatRgb, type Oklch } from 'culori'
import fs from 'node:fs/promises'
import path from 'node:path'
import toIco from 'to-ico'

const icons = [
  [256, 'favicon', 'any'], // favicon
  [180, 'png', 'any'], // apple touch icon
  [64, 'png', 'any'], // pwa
  [192, 'png', 'any'], // pwa
  [512, 'png', 'any'], // pwa
  [512, 'png', 'maskable'], // pwa
] as const

await main()
async function main() {
  const __dirname = path.dirname(new URL(import.meta.url).pathname)

  await fs.mkdir(path.resolve(__dirname, '../assets/icon'), { recursive: true })

  await Promise.all(
    icons.map(async ([size, type, purpose]) => {
      if (type === 'favicon') {
        const png = drawIcon(size, false).toBuffer('image/png')
        const ico = await toIco(png, { resize: true })
        await fs.writeFile(
          path.resolve(__dirname, '../assets', 'favicon.ico'),
          ico
        )

        return
      }

      const buffer = drawIcon(size, purpose === 'maskable').toBuffer(
        ('image/' + type) as any
      )

      const name =
        purpose === 'maskable' ? `${size}-maskable.${type}` : `${size}.${type}`

      await fs.writeFile(
        path.resolve(__dirname, '../assets/icon', name),
        buffer
      )
    })
  )
}

function drawIcon(size: number, maskable: boolean): Canvas {
  const canvas = createCanvas(size, size)
  const ctx = canvas.getContext('2d')

  // min safe area is 4/5 of the icon; total padding is 1/10 + 1/10 = 1/5
  const padding = maskable ? size / 10 : 0

  const radius = size / 2 - padding
  const thickness = size / 4
  const maskRadius = radius - thickness

  const centerX = size / 2
  const centerY = size / 2

  ctx.clearRect(0, 0, size, size)

  if (maskable) {
    // maskable icons must be opaque
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, size, size)
  }

  for (let absX = 0; absX < size; absX++) {
    for (let absY = 0; absY < size; absY++) {
      const circleX = absX - centerX
      const circleY = absY - centerY
      const rad = Math.sqrt(circleX * circleX + circleY * circleY)
      if (rad < maskRadius || rad > radius) {
        continue
      }

      const hue = Math.atan2(circleY, circleX) * (180 / Math.PI) + 90

      const color: Oklch = {
        mode: 'oklch',
        l: 0.8123,
        c: 0.1709,
        h: hue,
      }

      ctx.fillStyle = formatRgb(color)
      ctx.fillRect(absX, absY, 1, 1)
    }
  }

  return canvas
}
