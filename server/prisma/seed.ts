import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FRONTEND_DATA_DIR = path.join(__dirname, '..', '..', 'src', 'data')

interface ExtraOption {
  name: string
  under: number | null
  over: number | null
}

interface Extras {
  thresholdMm: number | null
  options: ExtraOption[]
}

interface PriceCategoryJson {
  key: string
  label: string
  widths: number[]
  heights: number[]
  prices: (number | null)[][]
  extras: Extras | null
}

interface ProductJson {
  key: string
  name: string
  pricingAsAt: string | null
  note?: string
  categories: PriceCategoryJson[]
}

interface PricingJson {
  products: ProductJson[]
  note: string
}

interface AddonJson {
  section: string | null
  name: string
  price: number | null
  priceOnRequest: boolean
  unit: string | null
}

interface ColourJson {
  name: string
  additionalCharge: boolean
  products: string[]
}

// Kept in sync manually with src/data/company.ts, same as this repo's existing
// convention of manually mirroring the browser-side xlsx importer.
const COMPANY_SETTINGS = {
  name: 'Goldco Security Group Pty Ltd',
  abn: '16 617 027 068',
  qbcc: '15042108',
  address: '51 Paradise Ave Miami QLD 4220',
  phone: '(07) 55 722 628',
  bankName: 'Westpac Bank',
  bankBsb: '034 239',
  bankAccount: '405216',
  cardFeePercent: 1.65,
  gstRate: 0.1,
  depositRate: 0.5,
  nonStandardColourPrice: 220,
  validityDays: 30,
  warrantyUrl: 'https://www.goldcoastsecurityscreens.net.au/warranty-terms-conditions/',
  careUrl: 'https://www.goldcoastsecurityscreens.net.au/care-maintenance-guide/',
  termsNote: 'Goldco Terms & Conditions 6.0',
  termsContract:
    'Placing an order as a result of this quotation represents a binding contract between Goldco Security Group P/L and the client, according to Goldco Security Group\'s Terms & Conditions. Please refer to the attached document "Goldco Terms & Conditions 6.0"',
  sizeDisclaimer:
    'Please note, the sizes on this quote are for quoted purposes ONLY and are not the manufacturing sizes',
  licensing:
    'Goldco Security Group is QBCC licensed as per the requirements of the QLD Government, a licensed Amplimesh dealer and a member of the National Security Screen Association (NSSA).',
}

function readJson<T>(fileName: string): T {
  const raw = readFileSync(path.join(FRONTEND_DATA_DIR, fileName), 'utf-8')
  return JSON.parse(raw) as T
}

async function clearExisting() {
  await prisma.quoteLine.deleteMany()
  await prisma.quote.deleteMany()
  await prisma.customer.deleteMany()
  await prisma.colourProduct.deleteMany()
  await prisma.meshExtra.deleteMany()
  await prisma.priceCell.deleteMany()
  await prisma.productCategory.deleteMany()
  await prisma.product.deleteMany()
  await prisma.colour.deleteMany()
  await prisma.addon.deleteMany()
  await prisma.companySettings.deleteMany()
}

async function seedCompanySettings() {
  await prisma.companySettings.create({ data: COMPANY_SETTINGS })
}

async function seedPricing() {
  const pricing = readJson<PricingJson>('pricing.json')

  for (const product of pricing.products) {
    const createdProduct = await prisma.product.create({
      data: {
        key: product.key,
        name: product.name,
        pricingAsAt: product.pricingAsAt ? new Date(product.pricingAsAt) : null,
        note: product.note ?? null,
      },
    })

    for (const category of product.categories) {
      const createdCategory = await prisma.productCategory.create({
        data: {
          productId: createdProduct.id,
          key: category.key,
          label: category.label,
          extraThresholdMm: category.extras?.thresholdMm ?? null,
        },
      })

      const priceCells = category.heights.flatMap((heightMm, heightIndex) =>
        category.widths.map((widthMm, widthIndex) => ({
          categoryId: createdCategory.id,
          widthMm,
          heightMm,
          price: category.prices[heightIndex]?.[widthIndex] ?? null,
        })),
      )
      if (priceCells.length > 0) {
        await prisma.priceCell.createMany({ data: priceCells })
      }

      if (category.extras) {
        const meshExtras = category.extras.options.map((option) => ({
          categoryId: createdCategory.id,
          name: option.name,
          underPrice: option.under,
          overPrice: option.over,
        }))
        if (meshExtras.length > 0) {
          await prisma.meshExtra.createMany({ data: meshExtras })
        }
      }
    }
  }
}

async function seedAddons() {
  const addons = readJson<AddonJson[]>('addons.json')
  await prisma.addon.createMany({
    data: addons.map((addon) => ({
      section: addon.section,
      name: addon.name,
      price: addon.price,
      priceOnRequest: addon.priceOnRequest,
      unit: addon.unit,
    })),
  })
}

async function seedColours() {
  const colours = readJson<ColourJson[]>('colours.json')
  const products = await prisma.product.findMany({ select: { id: true, key: true } })
  const productIdByKey = new Map(products.map((p) => [p.key, p.id]))

  for (const colour of colours) {
    const createdColour = await prisma.colour.create({
      data: { name: colour.name, additionalCharge: colour.additionalCharge },
    })

    const colourProducts = colour.products
      .map((key) => productIdByKey.get(key))
      .filter((id): id is string => Boolean(id))
      .map((productId) => ({ colourId: createdColour.id, productId }))

    if (colourProducts.length > 0) {
      await prisma.colourProduct.createMany({ data: colourProducts })
    }
  }
}

async function main() {
  await clearExisting()
  await seedCompanySettings()
  await seedPricing()
  await seedAddons()
  await seedColours()

  const [productCount, priceCellCount, meshExtraCount, addonCount, colourCount] = await Promise.all([
    prisma.product.count(),
    prisma.priceCell.count(),
    prisma.meshExtra.count(),
    prisma.addon.count(),
    prisma.colour.count(),
  ])
  console.log('[seed] done', { productCount, priceCellCount, meshExtraCount, addonCount, colourCount })
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
