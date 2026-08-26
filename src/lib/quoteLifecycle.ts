import type { QuoteAction, QuoteState } from './quoteContext'
import { calcQuoteTotals, money } from './quoteTotals'

export type QuoteStatus = 'draft' | 'issued'

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
  'HYDRATE_PHOTOS',
])

export function canIssueQuote(state: Pick<QuoteState, 'status' | 'items'>): boolean {
  return state.status === 'draft' && state.items.length > 0
}

export function isQuoteLocked(status: QuoteStatus): boolean {
  return status === 'issued'
}

export function isActionLocked(status: QuoteStatus, type: QuoteAction['type']): boolean {
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
