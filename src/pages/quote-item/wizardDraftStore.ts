import { isQuotaError } from '../../lib/quotePersist'
import type { DrawStroke, MarkerPosition } from '../../lib/sheetDraw'
import type { ItemDraft } from './itemDraft'
import type { Step } from './wizardSteps'

/**
 * Persists the *in-progress item wizard* -- separate from the whole-quote draft in
 * quotePersist.ts/quoteContext.tsx. That layer already survives navigation/refresh for
 * saved items, customer info, etc. This layer exists because ItemWizard's own working
 * state (draft, step, visited tabs, diagram markup) is plain local useState with no
 * persistence at all, so it is destroyed the instant the route unmounts the component --
 * e.g. navigating to /quotes and back. Keeping the two stores independent means a bug or
 * quota issue in one can never corrupt the other.
 */

const STORAGE_KEY = 'smartquote-pro:wizard-drafts'
export const WIZARD_DRAFT_PERSIST_MS = 300
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000

export type WizardDraftKind = 'new' | 'edit' | 'duplicate' | 'reuse'

export interface WizardDraftKey {
  quoteNo: string
  kind: WizardDraftKind
  /** itemId for 'edit'; basedOnId for 'duplicate'/'reuse'; null for 'new'. */
  refId: string | null
}

export interface WizardDraftSnapshot {
  step: Step
  visited: Step[]
  draft: ItemDraft
  markers: Record<string, MarkerPosition>
  strokes: DrawStroke[]
  updatedAt: number
}

type StoredMap = Record<string, WizardDraftSnapshot>

function keyString(key: WizardDraftKey): string {
  return `${key.quoteNo}::${key.kind}::${key.refId ?? ''}`
}

function readAll(storage: Storage): StoredMap {
  try {
    const raw = storage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as StoredMap
    const cutoff = Date.now() - MAX_AGE_MS
    const pruned: StoredMap = {}
    for (const [k, snapshot] of Object.entries(parsed)) {
      if (snapshot && typeof snapshot.updatedAt === 'number' && snapshot.updatedAt >= cutoff) pruned[k] = snapshot
    }
    return pruned
  } catch {
    return {}
  }
}

function writeAll(storage: Storage, all: StoredMap): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(all))
}

/** Item photo data URLs can be large; drop them (keeping everything else) if a full write hits quota. */
function stripPhotoData(snapshot: WizardDraftSnapshot): WizardDraftSnapshot {
  if (!snapshot.draft.photos || snapshot.draft.photos.length === 0) return snapshot
  return {
    ...snapshot,
    draft: {
      ...snapshot.draft,
      photos: snapshot.draft.photos.map((photo) => ({ ...photo, dataUrl: '', annotatedDataUrl: null })),
    },
  }
}

export function loadWizardDraft(key: WizardDraftKey, storage: Storage = localStorage): WizardDraftSnapshot | null {
  try {
    return readAll(storage)[keyString(key)] ?? null
  } catch {
    return null
  }
}

export function saveWizardDraft(key: WizardDraftKey, snapshot: WizardDraftSnapshot, storage: Storage = localStorage): void {
  try {
    const all = readAll(storage)
    all[keyString(key)] = snapshot
    try {
      writeAll(storage, all)
    } catch (error) {
      if (!isQuotaError(error)) throw error
      all[keyString(key)] = stripPhotoData(snapshot)
      writeAll(storage, all)
    }
  } catch {
    // Storage unavailable (quota exhausted even after stripping photos, or private mode) --
    // the wizard keeps working in memory, it just won't survive navigating away this time.
  }
}

export function clearWizardDraft(key: WizardDraftKey, storage: Storage = localStorage): void {
  try {
    const all = readAll(storage)
    delete all[keyString(key)]
    writeAll(storage, all)
  } catch {
    // ignore
  }
}

/** In-progress wizard sessions for a quote, most-recently-touched first -- backs a "resume" prompt on the quote workspace. */
export function listWizardDrafts(
  quoteNo: string,
  storage: Storage = localStorage,
): Array<{ key: WizardDraftKey; snapshot: WizardDraftSnapshot }> {
  try {
    const all = readAll(storage)
    const prefix = `${quoteNo}::`
    return Object.entries(all)
      .filter(([k]) => k.startsWith(prefix))
      .map(([k, snapshot]) => {
        const [, kind, refId] = k.split('::')
        return { key: { quoteNo, kind: kind as WizardDraftKind, refId: refId || null }, snapshot }
      })
      .sort((a, b) => b.snapshot.updatedAt - a.snapshot.updatedAt)
  } catch {
    return []
  }
}

/**
 * Router state flagging a navigation that deliberately left the wizard -- Back to quote, save, or
 * discard. The workspace auto-resumes an unfinished session on every other kind of arrival (the
 * Quotes list, the Current Quote nav link, a pasted URL), so this is what tells the two apart.
 */
export const FROM_WIZARD_NAV_STATE = { fromWizard: true } as const

export function isFromWizardNav(state: unknown): boolean {
  return Boolean((state as { fromWizard?: boolean } | null)?.fromWizard)
}

export function wizardDraftPath(key: WizardDraftKey): string {
  const base = `/quotes/${key.quoteNo}/items`
  if (key.kind === 'edit' && key.refId) return `${base}/${key.refId}/edit`
  if (key.kind === 'duplicate' && key.refId) return `${base}/new?basedOn=${key.refId}&mode=duplicate`
  if (key.kind === 'reuse' && key.refId) return `${base}/new?basedOn=${key.refId}&mode=reuse`
  return `${base}/new`
}

export const WIZARD_DRAFT_KIND_LABELS: Record<WizardDraftKind, string> = {
  new: 'New opening',
  edit: 'Edit opening',
  duplicate: 'Duplicate opening',
  reuse: 'Reused opening',
}
