export interface ExtraOption {
  name: string
  under: number | null
  over: number | null
}

export interface Extras {
  thresholdMm: number | null
  options: ExtraOption[]
}

export interface PriceCategory {
  key: string
  label: string
  widths: number[]
  heights: number[]
  /** prices[heightIndex][widthIndex]; null means the size is unavailable ("N/A" in the price list) */
  prices: (number | null)[][]
  extras: Extras | null
}

export interface Product {
  key: string
  name: string
  pricingAsAt: string | null
  note?: string
  categories: PriceCategory[]
}

export interface PricingData {
  products: Product[]
  note: string
}

export interface AddonItem {
  section: string | null
  name: string
  price: number | null
  priceOnRequest: boolean
  unit: string | null
}
