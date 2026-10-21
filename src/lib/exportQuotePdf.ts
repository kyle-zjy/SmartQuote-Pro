const A4_WIDTH_MM = 210
const A4_HEIGHT_MM = 297
const MARGIN_MM = 8
const JPEG_QUALITY = 0.85

type Html2CanvasFn = typeof import('html2canvas')['default']
type JsPdfCtor = typeof import('jspdf')['jsPDF']
export type QuotePdf = InstanceType<JsPdfCtor>

export function quotePdfFilename(quoteNo: string, customerName: string): string {
  const safeName = customerName
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]+/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
  const safeQuoteNo = quoteNo.replace(/[<>:"/\\|?*\u0000-\u001f]+/g, '-').slice(0, 100)
  return `Quote-${safeQuoteNo}-${safeName || 'customer'}.pdf`
}

export interface PdfExportTimings {
  importMs: number
  captureMs: number
  encodeMs: number
  pdfMs: number
  totalMs: number
}

function roundMs(startedAt: number, endedAt = performance.now()): number {
  return Math.round((endedAt - startedAt) * 10) / 10
}

/**
 * Creates the jsPDF document used for quote exports,
 * page geometry and compression settings shared by every export pipeline
 */
export function createQuotePdfDocument(JsPdf: JsPdfCtor): QuotePdf {
  return new JsPdf({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true })
}

/** Adds page numbers. [Page x of y] */
export function addPageNumbers(pdf: QuotePdf): void {
  const pageCount = pdf.getNumberOfPages()
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  for (let page = 1; page <= pageCount; page += 1) {
    pdf.setPage(page)
    pdf.setFontSize(9)
    pdf.setTextColor(0, 0, 0)
    pdf.text(`Page ${page} of ${pageCount}`, pageWidth - 12, pageHeight - 8, { align: 'right' })
  }
}

export interface CanvasRenderOptions {
  scale?: number
}

/** Rasterizes an element to a canvas. Raster-pipeline only. */
async function renderElementToCanvas(
  element: HTMLElement,
  html2canvas: Html2CanvasFn,
  { scale = 2 }: CanvasRenderOptions = {},
): Promise<HTMLCanvasElement> {
  return html2canvas(element, {
    scale,
    useCORS: true,
    backgroundColor: '#ffffff',
    logging: false,
    onclone: (_doc, cloned) => {
      cloned.style.width = '794px'
      cloned.style.maxWidth = '794px'
      cloned.querySelectorAll('.quote-doc__page').forEach((el) => {
        ;(el as HTMLElement).style.display = 'none'
      })
    },
  })
}

export interface RasterImage {
  dataUrl: string
  format: 'JPEG' | 'PNG'
  width: number
  height: number
}

export interface CanvasEncodeOptions {
  format?: 'JPEG' | 'PNG'
  quality?: number
}

/* Encodes a canvas as an image jsPDF can embed. JPEG is the default */
function encodeCanvasToImage(canvas: HTMLCanvasElement, { format = 'JPEG', quality = JPEG_QUALITY }: CanvasEncodeOptions = {}): RasterImage {
  const mimeType = format === 'JPEG' ? 'image/jpeg' : 'image/png'
  const dataUrl = format === 'JPEG' ? canvas.toDataURL(mimeType, quality) : canvas.toDataURL(mimeType)
  return { dataUrl, format, width: canvas.width, height: canvas.height }
}

/**
 * Slices one tall raster image across as many A4 pages as it needs. Raster-pipeline
 * only - a text-layer pipeline would lay out real content per page instead.
 */
export function addRasterImagePages(pdf: QuotePdf, image: RasterImage): void {
  const contentWidth = A4_WIDTH_MM - MARGIN_MM * 2
  const contentHeight = A4_HEIGHT_MM - MARGIN_MM * 2
  const imgHeight = (image.height * contentWidth) / image.width

  let heightLeft = imgHeight
  let position = MARGIN_MM

  pdf.addImage(image.dataUrl, image.format, MARGIN_MM, position, contentWidth, imgHeight)
  heightLeft -= contentHeight

  while (heightLeft > 0) {
    position = MARGIN_MM - (imgHeight - heightLeft)
    pdf.addPage()
    pdf.addImage(image.dataUrl, image.format, MARGIN_MM, position, contentWidth, imgHeight)
    heightLeft -= contentHeight
  }
}

export async function exportElementToPdf(element: HTMLElement, filename: string): Promise<PdfExportTimings> {
  const totalStartedAt = performance.now()

  const importStartedAt = performance.now()
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')])
  const importMs = roundMs(importStartedAt)

  const captureStartedAt = performance.now()
  const canvas = await renderElementToCanvas(element, html2canvas)
  const captureMs = roundMs(captureStartedAt)

  const encodeStartedAt = performance.now()
  const image = encodeCanvasToImage(canvas)
  const encodeMs = roundMs(encodeStartedAt)

  const pdfStartedAt = performance.now()
  const pdf = createQuotePdfDocument(jsPDF)
  addRasterImagePages(pdf, image)
  addPageNumbers(pdf)
  pdf.save(filename)
  const pdfMs = roundMs(pdfStartedAt)

  const totalMs = roundMs(totalStartedAt)

  const timings: PdfExportTimings = { importMs, captureMs, encodeMs, pdfMs, totalMs }
  console.info('[pdf-export]', timings)
  return timings
}
