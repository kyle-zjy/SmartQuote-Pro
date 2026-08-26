const A4_WIDTH_MM = 210
const A4_HEIGHT_MM = 297
const MARGIN_MM = 8

export function quotePdfFilename(quoteNo: string, customerName: string): string {
  const safeName = customerName
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]+/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
  return `Quote-${quoteNo}-${safeName || 'customer'}.pdf`
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

export async function exportElementToPdf(element: HTMLElement, filename: string): Promise<PdfExportTimings> {
  const totalStartedAt = performance.now()

  const importStartedAt = performance.now()
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')])
  const importMs = roundMs(importStartedAt)

  const captureStartedAt = performance.now()
  const canvas = await html2canvas(element, {
    scale: 2,
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
  const captureMs = roundMs(captureStartedAt)

  const encodeStartedAt = performance.now()
  const imgData = canvas.toDataURL('image/png')
  const encodeMs = roundMs(encodeStartedAt)

  const pdfStartedAt = performance.now()
  const contentWidth = A4_WIDTH_MM - MARGIN_MM * 2
  const contentHeight = A4_HEIGHT_MM - MARGIN_MM * 2
  const imgHeight = (canvas.height * contentWidth) / canvas.width
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })

  let heightLeft = imgHeight
  let position = MARGIN_MM

  pdf.addImage(imgData, 'PNG', MARGIN_MM, position, contentWidth, imgHeight)
  heightLeft -= contentHeight

  while (heightLeft > 0) {
    position = MARGIN_MM - (imgHeight - heightLeft)
    pdf.addPage()
    pdf.addImage(imgData, 'PNG', MARGIN_MM, position, contentWidth, imgHeight)
    heightLeft -= contentHeight
  }

  const pageCount = pdf.getNumberOfPages()
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  for (let page = 1; page <= pageCount; page += 1) {
    pdf.setPage(page)
    pdf.setFontSize(9)
    pdf.setTextColor(0, 0, 0)
    pdf.text(`Page ${page} of ${pageCount}`, pageWidth - 12, pageHeight - 8, { align: 'right' })
  }

  pdf.save(filename)
  const pdfMs = roundMs(pdfStartedAt)
  const totalMs = roundMs(totalStartedAt)

  const timings: PdfExportTimings = { importMs, captureMs, encodeMs, pdfMs, totalMs }
  console.info('[pdf-export]', timings)
  return timings
}
