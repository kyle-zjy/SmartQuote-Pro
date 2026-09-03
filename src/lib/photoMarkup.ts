import type { DrawStroke } from './sheetDraw'

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Could not load image'))
    img.src = src
  })
}

/** Paints percentage-coordinate strokes onto a canvas already sized to the target resolution. */
export function paintStrokesOnCanvas(canvas: HTMLCanvasElement, strokes: DrawStroke[]) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  for (const stroke of strokes) {
    if (stroke.points.length === 0) continue
    ctx.globalCompositeOperation = stroke.erase ? 'destination-out' : 'source-over'
    ctx.strokeStyle = stroke.color
    ctx.fillStyle = stroke.color
    ctx.lineWidth = Math.max(1, (stroke.size / 100) * canvas.width)
    const [first, ...rest] = stroke.points
    const startX = (first.x / 100) * canvas.width
    const startY = (first.y / 100) * canvas.height
    if (rest.length === 0) {
      ctx.beginPath()
      ctx.arc(startX, startY, ctx.lineWidth / 2, 0, Math.PI * 2)
      ctx.fill()
      continue
    }
    ctx.beginPath()
    ctx.moveTo(startX, startY)
    for (const point of rest) {
      ctx.lineTo((point.x / 100) * canvas.width, (point.y / 100) * canvas.height)
    }
    ctx.stroke()
  }
  ctx.globalCompositeOperation = 'source-over'
}

/** Flattens a photo and its annotation strokes into a single JPEG data URL at the photo's natural resolution. */
export async function flattenPhoto(dataUrl: string, strokes: DrawStroke[]): Promise<string> {
  const img = await loadImage(dataUrl)
  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) return dataUrl
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  paintStrokesOnCanvas(canvas, strokes)
  return canvas.toDataURL('image/jpeg', 0.9)
}
