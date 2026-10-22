import { Router } from 'express'
import { Prisma } from '@prisma/client'
import { prisma } from './db.js'
import { asyncHandler } from './http.js'
import { actor, requireAuth, publicStaff } from './auth.js'
import { check } from './apiError.js'
import { validatePricingCatalog, synchronizePricingCatalog } from './catalogSync.js'

// Dynamic JSON is validated by validateQuote/validateCompany before use.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Obj = Record<string, any>
const object = (value: unknown): value is Obj =>
  Boolean(value && typeof value === 'object' && !Array.isArray(value))
const finite = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value >= 0
export const canonical = (value: unknown): string =>
  JSON.stringify(value, (_key, item) =>
    object(item)
      ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b)))
      : item,
  )
export const quoteKey = (kind: string, no: string, version: number) =>
  `${kind}:${encodeURIComponent(no)}:v${version}`
export function reviewContent(quote: Obj, terms: Obj) {
  return canonical({
    quoteNo: quote.quoteNo,
    version: quote.version,
    quoteNumber: quote.quoteNumber,
    quoteDate: quote.quoteDate,
    customer: quote.customer,
    shipSameAsBill: quote.shipSameAsBill,
    shipTo: quote.shipSameAsBill ? null : quote.shipTo,
    frameColour: quote.frameColour,
    customFrameColour: quote.customFrameColour,
    gstEnabled: quote.gstEnabled,
    items: quote.items.map((item: Obj) => ({ ...item, photos: undefined })),
    ...terms,
  })
}
function photos(value: unknown) {
  check(object(value), 400, 'INVALID_PHOTOS', 'Invalid room photo data.')
  for (const list of Object.values(value)) {
    check(Array.isArray(list) && list.length <= 100, 400, 'INVALID_PHOTOS', 'Invalid photo list.')
    for (const photo of list) {
      check(
        object(photo) && typeof photo.id === 'string' && typeof photo.caption === 'string',
        400,
        'INVALID_PHOTOS',
        'Invalid photo.',
      )
      image(photo.dataUrl)
    }
  }
}
function image(value: unknown) {
  check(
    typeof value === 'string' &&
      value.length <= 6_000_000 &&
      (!value || /^data:image\/(png|jpeg|webp|gif);base64,[a-zA-Z0-9+/=\s]+$/.test(value)),
    400,
    'INVALID_IMAGE',
    'Use a PNG, JPEG, WebP or GIF image smaller than 4 MB.',
  )
}
export function validateQuote(q: unknown): asserts q is Obj {
  check(
    object(q) &&
      typeof q.quoteNo === 'string' &&
      q.quoteNo.trim() &&
      q.quoteNo.length <= 50 &&
      Number.isSafeInteger(q.version) &&
      q.version > 0 &&
      ['draft', 'office-review', 'issued'].includes(q.status) &&
      ['open', 'closed', 'abandoned'].includes(q.dealStatus) &&
      Array.isArray(q.items) &&
      q.items.length <= 500,
    400,
    'INVALID_QUOTE',
    'Invalid quote identity, status or items.',
  )
  check(
    object(q.customer) &&
      typeof q.customer.name === 'string' &&
      typeof q.customer.address === 'string' &&
      typeof q.customer.phone === 'string' &&
      object(q.shipTo) &&
      typeof q.shipSameAsBill === 'boolean' &&
      typeof q.quoteNumber === 'string' &&
      typeof q.quoteDate === 'string' &&
      /^\d{4}-\d{2}-\d{2}$/.test(q.quoteDate) &&
      typeof q.frameColour === 'string' &&
      typeof q.customFrameColour === 'string' &&
      typeof q.gstEnabled === 'boolean' &&
      finite(q.paid) &&
      (q.colourExtraOverride === null || finite(q.colourExtraOverride)),
    400,
    'INVALID_QUOTE',
    'Invalid customer, date, colour or payment details.',
  )
  for (const item of q.items) {
    check(
      object(item) &&
        typeof item.id === 'string' &&
        typeof item.description === 'string' &&
        typeof item.detail === 'string' &&
        typeof item.room === 'string' &&
        typeof item.note === 'string' &&
        Number.isSafeInteger(item.quantity) &&
        item.quantity > 0 &&
        item.quantity <= 10000 &&
        finite(item.unitPrice) &&
        item.unitPrice <= 1_000_000_000 &&
        (item.finalPrice === undefined ||
          (finite(item.finalPrice) && item.finalPrice === item.unitPrice)),
      400,
      'INVALID_ITEM',
      'Item prices must be non-negative and quantities must be positive whole numbers.',
    )
    for (const field of ['calculatedPrice', 'servicePrice'])
      check(
        item[field] === undefined || finite(item[field]),
        400,
        'INVALID_ITEM',
        'Invalid item price.',
      )
    for (const field of ['addons', 'fitExtraPrices'])
      if (item[field] !== undefined)
        check(
          Array.isArray(item[field]) &&
            item[field].every(
              (a: unknown) => object(a) && typeof a.name === 'string' && finite(a.price),
            ),
          400,
          'INVALID_ITEM',
          'Invalid add-on price.',
        )
    if (item.photos !== undefined) {
      check(Array.isArray(item.photos), 400, 'INVALID_PHOTOS', 'Invalid item photos.')
      for (const photo of item.photos) {
        check(
          object(photo) && typeof photo.id === 'string' && Array.isArray(photo.strokes),
          400,
          'INVALID_PHOTOS',
          'Invalid item photo.',
        )
        image(photo.dataUrl)
        if (photo.annotatedDataUrl !== null) image(photo.annotatedDataUrl)
      }
    }
  }
  photos(q.roomPhotos)
}
export function validateCompany(c: unknown): asserts c is Obj {
  check(
    object(c) &&
      typeof c.name === 'string' &&
      c.name.trim() &&
      object(c.bank) &&
      ['name', 'bsb', 'account'].every((k) => typeof c.bank[k] === 'string') &&
      finite(c.depositRate) &&
      c.depositRate <= 1 &&
      finite(c.nonStandardColourPrice) &&
      finite(c.cardFeePercent) &&
      c.cardFeePercent <= 100 &&
      Number.isSafeInteger(c.validityDays) &&
      c.validityDays > 0,
    400,
    'INVALID_COMPANY',
    'Invalid company defaults or bank details.',
  )
  for (const key of [
    'abn',
    'qbcc',
    'address',
    'phone',
    'warrantyUrl',
    'careUrl',
    'termsNote',
    'termsContract',
    'sizeDisclaimer',
    'licensing',
  ])
    check(typeof c[key] === 'string', 400, 'INVALID_COMPANY', 'Incomplete company details.')
}
const money = (n: number) => Math.round(n * 100) / 100
function totals(q: Obj, terms: Obj) {
  const subtotal = money(
    q.items.reduce(
      (sum: number, item: Obj) => sum + money((item.finalPrice ?? item.unitPrice) * item.quantity),
      0,
    ) + terms.colourExtra,
  )
  const gstAmount = q.gstEnabled ? money(subtotal * 0.1) : 0
  const total = money(subtotal + gstAmount)
  return { subtotal, gstAmount, total, deposit: money(total * terms.depositRate) }
}
export const workspaceRouter = Router()
workspaceRouter.use(requireAuth)
workspaceRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const result = await prisma.$transaction(async (tx) => {
      // The same lock is used by writes, so clock, documents and staff form one consistent snapshot.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(33021001)`
      const clock = await tx.workspaceClock.findUniqueOrThrow({ where: { id: 'main' } })
      if (String(clock.revision) === req.query.cursor)
        return { unchanged: true, cursor: clock.revision }
      const records = await tx.workspaceRecord.findMany({
        where: {
          NOT: { OR: [{ id: { startsWith: 'audit:' } }, { id: { startsWith: 'number:' } }] },
        },
      })
      const staff = await tx.staffUser.findMany({ orderBy: { createdAt: 'asc' } })
      return { cursor: clock.revision, records, staff: staff.map(publicStaff) }
    })
    res.json(result)
  }),
)
workspaceRouter.post(
  '/number',
  asyncHandler(async (req, res) => {
    const requested = req.body?.requested
    check(
      requested === undefined ||
        (typeof requested === 'string' &&
          requested.trim() &&
          requested.length <= 50 &&
          [...requested].every((c) => c.charCodeAt(0) >= 32)),
      400,
      'INVALID_NUMBER',
      'Enter a quote number of at most 50 characters.',
    )
    const no = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(33021001)`
      let clock = await tx.workspaceClock.findUniqueOrThrow({ where: { id: 'main' } })
      let candidate = requested?.trim()
      if (candidate)
        check(
          !(await tx.workspaceRecord.findFirst({
            where: {
              OR: [
                { id: `number:${encodeURIComponent(candidate)}` },
                { id: { startsWith: `quote:${encodeURIComponent(candidate)}:v` } },
              ],
            },
          })),
          409,
          'NUMBER_EXISTS',
          'This quote number already exists. Choose another.',
        )
      else {
        do {
          clock = await tx.workspaceClock.update({
            where: { id: 'main' },
            data: { quoteSequence: { increment: 1 } },
          })
          candidate = String(clock.quoteSequence)
        } while (
          await tx.workspaceRecord.findFirst({
            where: {
              OR: [{ id: `number:${candidate}` }, { id: { startsWith: `quote:${candidate}:v` } }],
            },
          })
        )
      }
      await tx.workspaceRecord.create({
        data: {
          id: `number:${encodeURIComponent(candidate!)}`,
          value: { allocatedBy: actor(res).user.id },
        },
      })
      if (
        /^\d+$/.test(candidate!) &&
        Number.isSafeInteger(Number(candidate)) &&
        Number(candidate) > clock.quoteSequence
      )
        await tx.workspaceClock.update({
          where: { id: 'main' },
          data: { quoteSequence: Number(candidate) },
        })
      return candidate
    })
    res.json({ quoteNo: no })
  }),
)

workspaceRouter.patch(
  '/',
  asyncHandler(async (req, res) => {
    const changes: Array<{ id: string; expected: number; value: unknown }> = req.body?.changes
    const importing = req.body?.importing === true
    const current = actor(res)
    check(
      !importing || current.role === 'admin',
      403,
      'FORBIDDEN',
      'Only an administrator can import historical browser data.',
    )
    check(
      Array.isArray(changes) &&
        changes.length > 0 &&
        changes.length <= 1000 &&
        new Set(changes.map((c) => c.id)).size === changes.length,
      400,
      'INVALID_BATCH',
      'Invalid workspace update.',
    )
    const result = await prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(33021001)`
        const records = await tx.workspaceRecord.findMany({
          where: {
            NOT: { OR: [{ id: { startsWith: 'audit:' } }, { id: { startsWith: 'number:' } }] },
          },
        })
        const old = new Map(records.map((r) => [r.id, r]))
        const values = new Map(records.filter((r) => !r.deleted).map((r) => [r.id, r.value as Obj]))
        const now = new Date().toISOString()
        for (const change of changes) {
          check(
            object(change) &&
              typeof change.id === 'string' &&
              change.id.length <= 300 &&
              Number.isSafeInteger(change.expected) &&
              change.expected >= 0 &&
              /^(quote:|draft:|review:|owner:|photo:|wizard:|company$|pricing$)/.test(change.id),
            400,
            'INVALID_RECORD',
            'Invalid workspace record.',
          )
          check(
            (old.get(change.id)?.revision ?? 0) === change.expected,
            409,
            'CONFLICT',
            'This record was changed in another browser. Your edits are still here. Reload the shared version before saving again.',
          )
          if (importing)
            check(
              !old.get(change.id) || old.get(change.id)?.deleted,
              409,
              'IMPORT_EXISTS',
              'Import only missing records; existing server data is preserved.',
            )
          if (change.value === null) values.delete(change.id)
          else {
            check(object(change.value), 400, 'INVALID_RECORD', 'Invalid record data.')
            values.set(change.id, change.value)
          }
        }
        const company = values.get('company')
        check(
          company,
          503,
          'SETUP_REQUIRED',
          'Run the server bootstrap command to initialize company settings.',
        )
        validateCompany(company)
        const colours = await tx.colour.findMany()
        const termsFor = (q: Obj) => ({
          colourExtra: colours.find((c) => c.name === q.frameColour)?.additionalCharge
            ? (q.colourExtraOverride ?? company.nonStandardColourPrice)
            : 0,
          depositRate: company.depositRate,
        })
        for (const change of changes) {
          const { id } = change
          const value = values.get(id)
          const previous = old.get(id)
          if (id === 'company' || id === 'pricing') {
            check(
              current.role === 'admin',
              403,
              'FORBIDDEN',
              'Only administrators can change company settings or prices.',
            )
            check(value, 400, 'INVALID_SETTINGS', 'Settings cannot be deleted.')
            if (id === 'pricing') validatePricingCatalog(value)
          } else if (id.startsWith('quote:') || id.startsWith('draft:')) {
            if (!value) {
              const prior = previous?.value as Obj | undefined
              const quote = id.startsWith('quote:') ? prior?.quote : prior
              check(
                quote?.status !== 'issued' || current.role === 'admin',
                403,
                'ISSUED_QUOTE',
                'An issued quote can only be removed by an administrator.',
              )
              continue
            }
            const q = id.startsWith('quote:') ? value.quote : value
            validateQuote(q)
            check(
              id === quoteKey(id.startsWith('quote:') ? 'quote' : 'draft', q.quoteNo, q.version),
              400,
              'IDENTITY_MISMATCH',
              'Quote identity does not match this record.',
            )
            const prior = (
              previous && !previous.deleted
                ? id.startsWith('quote:')
                  ? (previous.value as Obj).quote
                  : previous.value
                : undefined
            ) as Obj | undefined
            if (prior?.status === 'issued') {
              const stable = (quote: Obj) => ({
                ...quote,
                paid: 0,
                dealStatus: 'open',
                roomPhotos: undefined,
              })
              check(
                canonical(stable(prior)) === canonical(stable(q)),
                409,
                'ISSUED_IMMUTABLE',
                'Issued quote content cannot be changed. Create a revision instead.',
              )
            }
            const terms = termsFor(q)
            if (q.status !== 'draft')
              check(
                q.customer.name.trim() &&
                  q.customer.address.trim() &&
                  q.quoteNumber.trim() &&
                  q.items.length > 0,
                400,
                'INCOMPLETE_QUOTE',
                'Add a customer, address and at least one item.',
              )
            if (q.status === 'issued') {
              const review = values.get(quoteKey('review', q.quoteNo, q.version))
              check(
                prior?.status === 'issued' ||
                  current.role === 'admin' ||
                  (review?.status === 'approved' && review.contentKey === reviewContent(q, terms)),
                403,
                'APPROVAL_REQUIRED',
                'Office approval of this exact quote content is required before issuing.',
              )
              check(
                object(q.issuedSnapshot),
                400,
                'INVALID_SNAPSHOT',
                'An issued quote requires a document snapshot.',
              )
              check(
                ['colourExtra', 'subtotal', 'gstAmount', 'total', 'deposit', 'depositRate'].every(
                  (k) => finite(q.issuedSnapshot[k]),
                ) &&
                  q.issuedSnapshot.depositRate <= 1 &&
                  typeof q.issuedSnapshot.issuedAt === 'string' &&
                  Number.isFinite(Date.parse(q.issuedSnapshot.issuedAt)),
                400,
                'INVALID_SNAPSHOT',
                'Invalid issued amounts or issue date.',
              )
              if (prior?.status !== 'issued' && !importing) {
                const calculated = totals(q, terms)
                const warranty = values.get('warranty') ?? {}
                const used = new Set(q.items.map((item: Obj) => item.productKey))
                const notes = ['supascreen', 'intrudaguard', '7mm-diamond', 'flyscreens']
                  .filter((k) => used.has(k))
                  .map((k) => warranty[k])
                check(
                  Object.entries(calculated).every(([k, v]) => q.issuedSnapshot[k] === v) &&
                    q.issuedSnapshot.colourExtra === terms.colourExtra &&
                    q.issuedSnapshot.depositRate === terms.depositRate &&
                    q.issuedSnapshot.gstEnabled === q.gstEnabled &&
                    canonical(q.issuedSnapshot.document?.company) === canonical(company) &&
                    canonical(q.issuedSnapshot.document?.warrantyNotes) === canonical(notes),
                  400,
                  'INVALID_SNAPSHOT',
                  'Issued totals, warranty and company details must match the current quote.',
                )
              }
            }
            if (id.startsWith('quote:')) {
              check(
                value.quoteNo === q.quoteNo &&
                  value.version === q.version &&
                  Array.isArray(value.comments) &&
                  value.comments.every(
                    (c: unknown) =>
                      object(c) && typeof c.text === 'string' && c.text.length <= 10000,
                  ),
                400,
                'INVALID_ARCHIVE',
                'Invalid quote revision or comments.',
              )
              value.total = q.status === 'issued' ? q.issuedSnapshot.total : totals(q, terms).total
              value.itemCount = q.items.reduce((n: number, item: Obj) => n + item.quantity, 0)
              value.savedAt = now
              if (!values.has(`owner:${encodeURIComponent(q.quoteNo)}`))
                values.set(`owner:${encodeURIComponent(q.quoteNo)}`, { staffId: current.user.id })
            }
          } else if (id.startsWith('review:')) {
            check(value, 400, 'INVALID_REVIEW', 'Reviews cannot be deleted.')
            const q = values.get(quoteKey('quote', value.quoteNo, value.version))?.quote
            check(
              q &&
                id === quoteKey('review', q.quoteNo, q.version) &&
                ['pending', 'approved', 'returned'].includes(value.status),
              400,
              'INVALID_REVIEW',
              'A review needs a saved quote revision.',
            )
            const terms = termsFor(q)
            if (value.status === 'pending') {
              check(
                q.status === 'office-review' && q.dealStatus === 'open',
                409,
                'NOT_REVIEWABLE',
                'Only an open quote submitted for office review can be reviewed.',
              )
              value.submittedBy = current.user.id
              value.submittedAt = now
              value.contentKey = reviewContent(q, terms)
              delete value.reviewedBy
              delete value.reviewedAt
              delete value.reviewNote
            } else {
              check(
                current.role === 'admin',
                403,
                'FORBIDDEN',
                'Only administrators can approve or return quotes.',
              )
              const prior = previous?.value as Obj | undefined
              check(
                importing ||
                  (prior?.status === 'pending' &&
                    prior.contentKey === value.contentKey &&
                    prior.submittedAt === value.submittedAt),
                409,
                'STALE_REVIEW',
                'This submission has changed; review the latest version.',
              )
              if (!importing && value.status === 'approved')
                check(
                  q.status === 'office-review' &&
                    q.dealStatus === 'open' &&
                    value.contentKey === reviewContent(q, terms),
                  409,
                  'STALE_REVIEW',
                  'The quote changed after submission. Ask staff to resubmit.',
                )
              if (value.status === 'returned')
                check(
                  typeof value.reviewNote === 'string' && value.reviewNote.trim(),
                  400,
                  'NOTE_REQUIRED',
                  'A return note is required.',
                )
              value.reviewedBy = current.user.id
              value.reviewedAt = now
            }
          } else if (id.startsWith('owner:')) {
            check(
              value &&
                typeof value.staffId === 'string' &&
                (current.role === 'admin' || value.staffId === current.user.id) &&
                (!previous ||
                  canonical(previous.value) === canonical(value) ||
                  current.role === 'admin'),
              403,
              'INVALID_OWNER',
              'The quote owner cannot be reassigned by staff.',
            )
          } else if (id.startsWith('photo:')) {
            if (value) photos(value)
          } else if (id.startsWith('wizard:')) {
            check(
              !value ||
                (object(value.draft) && typeof value.step === 'string' && finite(value.updatedAt)),
              400,
              'INVALID_DRAFT',
              'Invalid unfinished item draft.',
            )
          }
        }
        if (changes.some((change) => change.id === 'pricing'))
          await synchronizePricingCatalog(tx, values.get('pricing'))
        const writes = new Set(changes.map((c) => c.id))
        for (const id of values.keys()) if (id.startsWith('owner:') && !old.has(id)) writes.add(id)
        for (const id of writes) {
          const value = values.get(id)
          await tx.workspaceRecord.upsert({
            where: { id },
            create: { id, value: (value ?? {}) as Prisma.InputJsonValue, deleted: !value },
            update: {
              value: (value ?? {}) as Prisma.InputJsonValue,
              deleted: !value,
              revision: { increment: 1 },
            },
          })
        }
        await tx.workspaceRecord.create({
          data: {
            id: `audit:${crypto.randomUUID()}`,
            value: {
              actor: current.user.id,
              role: current.role,
              at: now,
              importing,
              records: [...writes],
            },
          },
        })
        const clock = await tx.workspaceClock.update({
          where: { id: 'main' },
          data: { revision: { increment: 1 } },
        })
        return {
          cursor: clock.revision,
          records: await tx.workspaceRecord.findMany({ where: { id: { in: [...writes] } } }),
        }
      },
      { timeout: 30000 },
    )
    res.json(result)
  }),
)
