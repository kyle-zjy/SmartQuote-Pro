export type CompanySettings = {
  name: string
  abn: string
  qbcc: string
  address: string
  phone: string
  bank: {
    name: string
    bsb: string
    account: string
  }
  cardFeePercent: number
  validityDays: number
  depositRate: number
  nonStandardColourPrice: number
  warrantyUrl: string
  careUrl: string
  termsNote: string
  termsContract: string
  sizeDisclaimer: string
  licensing: string
}

export const COMPANY: CompanySettings = {
  name: 'Goldco Security Group Pty Ltd',
  abn: '16 617 027 068',
  qbcc: '15042108',
  address: '51 Paradise Ave Miami QLD 4220',
  phone: '(07) 55 722 628',
  bank: {
    name: 'Westpac Bank',
    bsb: '034 239',
    account: '405216',
  },
  cardFeePercent: 1.65,
  validityDays: 30,
  depositRate: 0.5,
  nonStandardColourPrice: 220,
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

export function productWarrantyNotes(productKeys: string[]): string[] {
  const notes: string[] = []
  if (productKeys.includes('7mm-diamond')) {
    notes.push('All Goldco® Security Group 7mm Diamond Grille products are backed by 7-year warranty')
  }
  if (productKeys.includes('supascreen') || productKeys.includes('intrudaguard')) {
    notes.push(
      'Additionally, Amplimesh® SupaScreen® products are backed by 16-year warranty and all doors are fitted with a triple lock system as per the Australian Standard',
    )
  }
  if (notes.length === 0 && productKeys.length > 0) {
    notes.push(
      'Additionally, Amplimesh® SupaScreen® products are backed by 16-year warranty and all doors are fitted with a triple lock system as per the Australian Standard',
    )
  }
  return notes
}
