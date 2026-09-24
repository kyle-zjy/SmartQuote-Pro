import type { QuoteAction, QuoteState } from './quoteContext'
import { calcQuoteTotals, money } from './quoteTotals'

export type QuoteStatus = 'draft' | 'office-review' | 'issued'
export type DealStatus = 'open' | 'abandoned' | 'closed'

export const DEAL_STATUSES: DealStatus[] = ['open', 'abandoned', 'closed']

export function parseDealStatus(value: unknown): DealStatus {
  return value === 'abandoned' || value === 'closed' ? value : 'open'
}

export interface IssuedSnapshot {
  colourExtra: number
  gstEnabled: boolean
  depositRate: number
  subtotal: number
  gstAmount: number
  total: number
  deposit: number
  issuedAt: string
}

export interface QuoteFinancials {
  colourExtra: number
  subtotal: number
  gstAmount: number
  total: number
  deposit: number
  paid: number
  balance: number
}

const ALLOWED_WHEN_ISSUED: ReadonlySet<QuoteAction['type']> = new Set([
  'SET_PAID',
  'NEW_QUOTE',
  'LOAD_QUOTE',
  'ISSUE',
  'REVISE',
  'HYDRATE_PHOTOS',
  'SET_DEAL_STATUS',
])

const ALLOWED_WHEN_DEAL_SETTLED: ReadonlySet<QuoteAction['type']> = new Set([
  'SET_PAID',
  'NEW_QUOTE',
  'LOAD_QUOTE',
  'HYDRATE_PHOTOS',
  'SET_DEAL_STATUS',
])

export function canSubmitForReview(
  state: Pick<QuoteState, 'status' | 'items' | 'dealStatus' | 'quoteNumber'>,
): boolean {
  return (
    state.status === 'draft' &&
    state.items.length > 0 &&
    (state.dealStatus ?? 'open') === 'open' &&
    Boolean(state.quoteNumber?.trim())
  )
}

export function canIssueQuote(state: Pick<QuoteState, 'status' | 'items' | 'dealStatus' | 'quoteNumber'>): boolean {
  return (
    (state.status === 'draft' || state.status === 'office-review') &&
    state.items.length > 0 &&
    (state.dealStatus ?? 'open') === 'open' &&
    Boolean(state.quoteNumber?.trim())
  )
}

export function canReviseQuote(state: Pick<QuoteState, 'status' | 'dealStatus'>): boolean {
  return state.status === 'issued' && (state.dealStatus ?? 'open') === 'open'
}

export function isQuoteLocked(status: QuoteStatus): boolean {
  return status === 'issued'
}

export function isActionLocked(
  status: QuoteStatus,
  type: QuoteAction['type'],
  dealStatus: DealStatus = 'open',
): boolean {
  if (dealStatus !== 'open' && !ALLOWED_WHEN_DEAL_SETTLED.has(type)) return true
  return status === 'issued' && !ALLOWED_WHEN_ISSUED.has(type)
}

export function createIssuedSnapshot(
  state: Pick<QuoteState, 'items' | 'gstEnabled' | 'paid'>,
  colourExtra: number,
  depositRate: number,
  issuedAt = new Date().toISOString(),
): IssuedSnapshot {
  const totals = calcQuoteTotals(state.items, state.gstEnabled, colourExtra, depositRate, state.paid)
  return {
    colourExtra,
    gstEnabled: state.gstEnabled,
    depositRate,
    subtotal: totals.subtotal,
    gstAmount: totals.gstAmount,
    total: totals.total,
    deposit: totals.deposit,
    issuedAt,
  }
}

export function quoteFinancials(
  state: Pick<QuoteState, 'status' | 'issuedSnapshot' | 'items' | 'gstEnabled' | 'paid'>,
  live: { colourExtra: number; depositRate: number },
): QuoteFinancials {
  if (state.status === 'issued' && state.issuedSnapshot) {
    const snapshot = state.issuedSnapshot
    const paid = money(Math.max(0, state.paid))
    return {
      colourExtra: snapshot.colourExtra,
      subtotal: snapshot.subtotal,
      gstAmount: snapshot.gstAmount,
      total: snapshot.total,
      deposit: snapshot.deposit,
      paid,
      balance: money(Math.max(0, snapshot.total - paid)),
    }
  }

  return {
    colourExtra: live.colourExtra,
    ...calcQuoteTotals(state.items, state.gstEnabled, live.colourExtra, live.depositRate, state.paid),
  }
}
