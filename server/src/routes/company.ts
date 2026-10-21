import { Router } from 'express'
import { prisma } from '../db.js'
import { asyncHandler } from '../http.js'

export const companyRouter = Router()

companyRouter.get('/', asyncHandler(async (_req, res) => {
  const shared=await prisma.workspaceRecord.findUnique({where:{id:'company'}})
  if(shared && !shared.deleted) {res.json(shared.value);return}
  const settings = await prisma.companySettings.findFirst()
  if (!settings) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'company_settings has no row; run the seed script.' } })
    return
  }
  res.json({
    name: settings.name,
    abn: settings.abn,
    qbcc: settings.qbcc,
    address: settings.address,
    phone: settings.phone,
    bank: {
      name: settings.bankName,
      bsb: settings.bankBsb,
      account: settings.bankAccount,
    },
    cardFeePercent: Number(settings.cardFeePercent),
    gstRate: Number(settings.gstRate),
    depositRate: Number(settings.depositRate),
    nonStandardColourPrice: Number(settings.nonStandardColourPrice),
    validityDays: settings.validityDays,
    warrantyUrl: settings.warrantyUrl,
    careUrl: settings.careUrl,
    termsNote: settings.termsNote,
    termsContract: settings.termsContract,
    sizeDisclaimer: settings.sizeDisclaimer,
    licensing: settings.licensing,
  })
}))
