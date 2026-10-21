import { useEffect, useRef } from 'react'
import { paintStrokesOnCanvas } from '../lib/photoMarkup'
import type { DrawStroke } from '../lib/sheetDraw'

/** Read-only render of a measurement-diagram image with its saved annotation strokes painted on top. */
export default function MeasurementDrawingPreview({
  src,
  alt,
  strokes,
}: {
  src: string
  alt: string
  strokes: DrawStroke[]
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const wrap = wrapRef.current
    const canvas = canvasRef.current
    const img = wrap?.querySelector('img')
    if (!wrap || !canvas || !img) return

    function resize() {
      const next = canvasRef.current
      const picture = wrapRef.current?.querySelector('img')
      if (!next || !picture) return
      const width = picture.clientWidth
      const height = picture.clientHeight
      if (width < 2 || height < 2) return
      const dpr = window.devicePixelRatio || 1
      next.width = Math.round(width * dpr)
      next.height = Math.round(height * dpr)
      next.style.width = `${width}px`
      next.style.height = `${height}px`
      paintStrokesOnCanvas(next, strokes)
    }

    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(img)
    img.addEventListener('load', resize)
    return () => {
      observer.disconnect()
      img.removeEventListener('load', resize)
    }
  }, [src, strokes])

  return (
    <div ref={wrapRef} className="sheet-diagram">
      <img src={src} alt={alt} draggable={false} />
      <canvas ref={canvasRef} />
    </div>
  )
}
