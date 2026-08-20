import * as XLSX from 'xlsx'
import type { AddonItem, Extras, ExtraOption, PriceCategory, PricingData, Product } from '../types/pricing'

/**
 * Client-side counterpart of scripts/generate-pricing-data.py -- same title-substring /
 * contiguous-numeric-run extraction algorithm, reimplemented so a same-template workbook can be
 * parsed in the browser when the user drags in an updated price list. Keep the two in sync if the
 * spreadsheet template changes.
 */

type Row = (string | number | null | Date)[]
type Sheet = Row[]

const MAX_COL = 30

function readRow(sheet: Sheet, rowIdx: number, maxCol = MAX_COL): Row {
  const row = sheet[rowIdx] ?? []
  const out: Row = []
  for (let c = 0; c < maxCol; c++) out.push(row[c] ?? null)
  return out
}

function isNumber(v: unknown): v is number {
  return typeof v === 'number' && !Number.isNaN(v)
}

function findTitleRow(sheet: Sheet, substring: string, startRow = 0, colRange: [number, number] = [0, MAX_COL]): number {
  const needle = substring.toLowerCase()
  for (let r = startRow; r < sheet.length; r++) {
    const row = sheet[r] ?? []
    for (let c = colRange[0]; c < colRange[1]; c++) {
      const v = row[c]
      if (typeof v === 'string' && v.toLowerCase().includes(needle)) return r
    }
  }
  throw new Error(`could not find "${substring}"`)
}

function numericRun(rowValues: Row): { start: number | null; values: number[] } {
  let start: number | null = null
  const values: number[] = []
  for (let i = 0; i < rowValues.length; i++) {
    const v = rowValues[i]
    if (isNumber(v)) {
      if (start === null) start = i
      values.push(v)
    } else if (start !== null) {
      break
    }
  }
  return { start, values }
}

function extractMatrix(sheet: Sheet, titleSubstring: string): Pick<PriceCategory, 'widths' | 'heights' | 'prices'> {
  const titleRow = findTitleRow(sheet, titleSubstring)
  const headerRow = titleRow + 1
  const { start: widthColIdx, values: widths } = numericRun(readRow(sheet, headerRow))
  if (widthColIdx === null) {
    throw new Error(`no width header found under "${titleSubstring}"`)
  }
  const heightColIdx = widthColIdx - 1

  const heights: number[] = []
  const prices: (number | null)[][] = []
  let r = headerRow + 1
  for (;;) {
    const rowVals = readRow(sheet, r)
    const height = heightColIdx >= 0 ? rowVals[heightColIdx] : null
    if (!isNumber(height)) break
    const rowPrices = rowVals.slice(widthColIdx, widthColIdx + widths.length)
    prices.push(rowPrices.map((p) => (isNumber(p) ? Math.round(p) : null)))
    heights.push(height)
    r += 1
  }

  return { widths, heights, prices }
}

function extractExtras(sheet: Sheet, titleSubstring: string): Extras {
  const titleRow = findTitleRow(sheet, titleSubstring)
  const rowVals = readRow(sheet, titleRow)
  const needle = titleSubstring.toLowerCase()
  const labelColIdx = rowVals.findIndex((v) => typeof v === 'string' && v.toLowerCase().includes(needle))

  let underColIdx: number | null = null
  let underThreshold: number | null = null
  let overColIdx: number | null = null
  let overThreshold: number | null = null
  rowVals.forEach((v, i) => {
    if (typeof v !== 'string') return
    const under = v.match(/UNDER\s+(\d+)\s+HIGH/i)
    if (under) {
      underColIdx = i
      underThreshold = Number(under[1])
    }
    const over = v.match(/OVER\s+(\d+)\s+HIGH/i)
    if (over) {
      overColIdx = i
      overThreshold = Number(over[1])
    }
  })

  const options: ExtraOption[] = []
  let r = titleRow + 1
  for (;;) {
    const vals = readRow(sheet, r)
    const name = vals[labelColIdx]
    if (typeof name !== 'string' || !name.trim()) break
    options.push({
      name: name.trim(),
      under: underColIdx !== null && isNumber(vals[underColIdx]) ? Math.round(vals[underColIdx] as number) : null,
      over: overColIdx !== null && isNumber(vals[overColIdx]) ? Math.round(vals[overColIdx] as number) : null,
    })
    r += 1
  }

  return { thresholdMm: underThreshold ?? overThreshold ?? null, options }
}

function extractPricingAsAt(sheet: Sheet): string | null {
  for (let r = 0; r < Math.min(5, sheet.length); r++) {
    const row = sheet[r] ?? []
    for (let c = 0; c < row.length; c++) {
      const v = row[c]
      if (typeof v === 'string' && v.toLowerCase().includes('pricing as at')) {
        const dateVal = row[c + 1]
        if (dateVal instanceof Date) {
          // SheetJS builds these Date objects from local-time components, so read them back the
          // same way -- toISOString() (UTC) can shift the calendar date by a day either side of
          // midnight depending on the machine's timezone offset.
          const y = dateVal.getFullYear()
          const m = String(dateVal.getMonth() + 1).padStart(2, '0')
          const d = String(dateVal.getDate()).padStart(2, '0')
          return `${y}-${m}-${d}`
        }
        return typeof dateVal === 'string' ? dateVal : null
      }
    }
  }
  return null
}

function getSheetRows(wb: XLSX.WorkBook, name: string): Sheet {
  const sheetName = wb.SheetNames.find((n) => n === name) ?? wb.SheetNames.find((n) => n.trim() === name.trim())
  if (!sheetName) throw new Error(`sheet "${name}" not found`)
  return XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, raw: true, defval: null }) as Sheet
}

function buildProducts(wb: XLSX.WorkBook): { products: Product[]; warnings: string[] } {
  const products: Product[] = []
  const warnings: string[] = []

  try {
    const rows = getSheetRows(wb, 'Supascreen')
    products.push({
      key: 'supascreen',
      name: 'Supascreen',
      pricingAsAt: extractPricingAsAt(rows),
      categories: [
        { key: 'windows', label: 'Windows', ...extractMatrix(rows, 'Supascreen  Windows'), extras: null },
        { key: 'doors', label: 'Doors', ...extractMatrix(rows, 'Supascreen  Doors'), extras: null },
      ],
    })
  } catch (e) {
    warnings.push(`Supascreen: ${(e as Error).message}`)
  }

  try {
    const rows = getSheetRows(wb, ' IntrudaGuard')
    products.push({
      key: 'intrudaguard',
      name: 'IntrudaGuard',
      pricingAsAt: extractPricingAsAt(rows),
      categories: [
        { key: 'windows', label: 'Windows', ...extractMatrix(rows, 'IntrudaGuard Windows'), extras: null },
        { key: 'doors', label: 'Doors', ...extractMatrix(rows, 'IntrudaGuard Doors'), extras: null },
      ],
    })
  } catch (e) {
    warnings.push(`IntrudaGuard: ${(e as Error).message}`)
  }

  try {
    const rows = getSheetRows(wb, '7mm Diamond')
    products.push({
      key: '7mm-diamond',
      name: '7mm Diamond',
      pricingAsAt: extractPricingAsAt(rows),
      categories: [
        {
          key: 'windows',
          label: 'Windows',
          ...extractMatrix(rows, '7mm Diamond  Windows'),
          extras: extractExtras(rows, 'WINDOWS EXTRAS'),
        },
        {
          key: 'doors',
          label: 'Doors',
          ...extractMatrix(rows, '7mm Diamond Doors'),
          extras: extractExtras(rows, 'DOOR EXTRAS'),
        },
      ],
    })
  } catch (e) {
    warnings.push(`7mm Diamond: ${(e as Error).message}`)
  }

  try {
    const rows = getSheetRows(wb, 'Fly Screens')
    products.push({
      key: 'flyscreens',
      name: 'Fly Screens',
      pricingAsAt: extractPricingAsAt(rows),
      note: 'Additional charge of $15+GST for double hung windows',
      categories: [
        {
          key: 'windows',
          label: 'Windows (Standard Mesh)',
          ...extractMatrix(rows, 'Flyscreens - Standard Mesh'),
          extras: extractExtras(rows, 'WINDOWS EXTRAS'),
        },
        {
          key: 'sliding-doors',
          label: 'Sliding Doors (Standard Mesh)',
          ...extractMatrix(rows, 'Flyscreen Sliding Doors'),
          extras: null,
        },
        {
          key: 'hinged-doors',
          label: 'Hinged Doors (Standard Mesh)',
          ...extractMatrix(rows, 'Flyscreen Hinged Doors'),
          extras: extractExtras(rows, 'DOOR EXTRAS'),
        },
      ],
    })
  } catch (e) {
    warnings.push(`Fly Screens: ${(e as Error).message}`)
  }

  return { products, warnings }
}

function buildAddons(wb: XLSX.WorkBook): { addons: AddonItem[]; warning: string | null } {
  try {
    const rows = getSheetRows(wb, 'Retail Supply Extras')
    const addons: AddonItem[] = []
    let section: string | null = null
    for (const row of rows) {
      const label = row?.[1]
      if (typeof label !== 'string' || !label.trim()) continue
      const upper = label.trim().toUpperCase()
      if (upper === 'ADDONS' || upper === 'EXTRAS') {
        section = upper === 'ADDONS' ? 'Addons' : 'Extras'
        continue
      }
      if (
        upper.startsWith('PRODUCT LIST') ||
        upper.startsWith('ALL PRICES') ||
        upper.startsWith('EFFECTIVE DATE') ||
        upper.startsWith('RETAIL')
      ) {
        continue
      }
      if (section === null) continue // skip anything before the first ADDONS/EXTRAS section header
      const price = row?.[2] ?? null
      const unit = row?.[3] ?? null
      addons.push({
        section,
        name: label.trim(),
        price: isNumber(price) ? Math.round(price) : null,
        priceOnRequest: typeof price === 'string' && price.toLowerCase().includes('request'),
        unit: typeof unit === 'string' ? unit : null,
      })
    }
    return { addons, warning: null }
  } catch (e) {
    return { addons: [], warning: `Retail Supply Extras: ${(e as Error).message}` }
  }
}

export interface ImportResult {
  data: PricingData
  addons: AddonItem[]
  warnings: string[]
}

export function parseWorkbook(wb: XLSX.WorkBook): ImportResult {
  const { products, warnings } = buildProducts(wb)
  if (products.length === 0) {
    throw new Error(
      'No recognizable product price sheets were found. Make sure this file uses the same template as the current price list.',
    )
  }

  const { addons, warning: addonsWarning } = buildAddons(wb)
  if (addonsWarning) warnings.push(addonsWarning)

  return { data: { products, note: 'All prices exclude GST' }, addons, warnings }
}

export async function parseExcelFile(file: File): Promise<ImportResult> {
  const buffer = await file.arrayBuffer()
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true })
  return parseWorkbook(wb)
}
