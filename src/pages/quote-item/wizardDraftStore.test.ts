import { describe, expect, it } from 'vitest'
import { emptyItemDraft } from './itemDraft'
import {
  clearWizardDraft,
  listWizardDrafts,
  loadWizardDraft,
  saveWizardDraft,
  wizardDraftPath,
  type WizardDraftKey,
  type WizardDraftSnapshot,
} from './wizardDraftStore'

class MemoryStorage implements Storage {
  private data = new Map<string, string>()

  get length() {
    return this.data.size
  }

  clear() {
    this.data.clear()
  }

  getItem(key: string) {
    return this.data.get(key) ?? null
  }

  key(index: number) {
    return [...this.data.keys()][index] ?? null
  }

  removeItem(key: string) {
    this.data.delete(key)
  }

  setItem(key: string, value: string) {
    this.data.set(key, value)
  }
}

function sampleSnapshot(overrides: Partial<WizardDraftSnapshot> = {}): WizardDraftSnapshot {
  return {
    step: 'measurements',
    visited: ['location', 'configuration', 'measurements'],
    draft: { ...emptyItemDraft(), location: 'Lounge room', widthMm: '900' },
    markers: { a: { x: 0.2, y: 0.4 } },
    strokes: [],
    updatedAt: Date.now(),
    ...overrides,
  }
}

describe('wizardDraftStore', () => {
  it('round-trips a saved draft for the exact session it was saved under', () => {
    const storage = new MemoryStorage()
    const key: WizardDraftKey = { quoteNo: '33098', kind: 'new', refId: null }
    saveWizardDraft(key, sampleSnapshot(), storage)

    const loaded = loadWizardDraft(key, storage)
    expect(loaded?.step).toBe('measurements')
    expect(loaded?.draft.location).toBe('Lounge room')
    expect(loaded?.draft.widthMm).toBe('900')
    expect(loaded?.markers).toEqual({ a: { x: 0.2, y: 0.4 } })
  })

  it('keeps drafts for different sessions of the same quote independent', () => {
    const storage = new MemoryStorage()
    const newKey: WizardDraftKey = { quoteNo: '33098', kind: 'new', refId: null }
    const editKey: WizardDraftKey = { quoteNo: '33098', kind: 'edit', refId: 'item-1' }

    saveWizardDraft(newKey, sampleSnapshot({ draft: { ...emptyItemDraft(), location: 'New opening' } }), storage)
    saveWizardDraft(editKey, sampleSnapshot({ draft: { ...emptyItemDraft(), location: 'Existing opening' } }), storage)

    expect(loadWizardDraft(newKey, storage)?.draft.location).toBe('New opening')
    expect(loadWizardDraft(editKey, storage)?.draft.location).toBe('Existing opening')

    clearWizardDraft(editKey, storage)
    expect(loadWizardDraft(editKey, storage)).toBeNull()
    expect(loadWizardDraft(newKey, storage)?.draft.location).toBe('New opening')
  })

  it('does not resume a draft under a different quote or session key', () => {
    const storage = new MemoryStorage()
    saveWizardDraft({ quoteNo: '33098', kind: 'new', refId: null }, sampleSnapshot(), storage)

    expect(loadWizardDraft({ quoteNo: '99999', kind: 'new', refId: null }, storage)).toBeNull()
    expect(loadWizardDraft({ quoteNo: '33098', kind: 'edit', refId: 'item-1' }, storage)).toBeNull()
  })

  it('lists only the drafts belonging to the requested quote, most recent first', () => {
    const storage = new MemoryStorage()
    saveWizardDraft(
      { quoteNo: '33098', kind: 'new', refId: null },
      sampleSnapshot({ updatedAt: Date.now() - 2_000 }),
      storage,
    )
    saveWizardDraft(
      { quoteNo: '33098', kind: 'edit', refId: 'item-1' },
      sampleSnapshot({ updatedAt: Date.now() - 1_000 }),
      storage,
    )
    saveWizardDraft({ quoteNo: 'other-quote', kind: 'new', refId: null }, sampleSnapshot(), storage)

    const drafts = listWizardDrafts('33098', storage)
    expect(drafts).toHaveLength(2)
    expect(drafts[0].key.kind).toBe('edit')
    expect(drafts[1].key.kind).toBe('new')
  })

  it('strips photo data but keeps everything else if a full write hits the storage quota', () => {
    const storage = new MemoryStorage()
    const bigDataUrl = `data:image/png;base64,${'A'.repeat(50_000)}`
    const original = storage.setItem.bind(storage)
    let attempts = 0
    storage.setItem = (key: string, value: string) => {
      attempts += 1
      if (attempts === 1) throw new DOMException('quota', 'QuotaExceededError')
      original(key, value)
    }

    const key: WizardDraftKey = { quoteNo: '33098', kind: 'new', refId: null }
    const snapshot = sampleSnapshot({
      draft: {
        ...emptyItemDraft(),
        location: 'Lounge room',
        photos: [{ id: 'p1', dataUrl: bigDataUrl, strokes: [], annotatedDataUrl: null }],
      },
    })

    saveWizardDraft(key, snapshot, storage)
    const loaded = loadWizardDraft(key, storage)
    expect(loaded?.draft.location).toBe('Lounge room')
    expect(loaded?.draft.photos[0].dataUrl).toBe('')
  })

  it('builds a navigable route back into the correct wizard session', () => {
    expect(wizardDraftPath({ quoteNo: '33098', kind: 'new', refId: null })).toBe('/quotes/33098/items/new')
    expect(wizardDraftPath({ quoteNo: '33098', kind: 'edit', refId: 'item-1' })).toBe(
      '/quotes/33098/items/item-1/edit',
    )
    expect(wizardDraftPath({ quoteNo: '33098', kind: 'duplicate', refId: 'item-1' })).toBe(
      '/quotes/33098/items/new?basedOn=item-1&mode=duplicate',
    )
    expect(wizardDraftPath({ quoteNo: '33098', kind: 'reuse', refId: 'item-1' })).toBe(
      '/quotes/33098/items/new?basedOn=item-1&mode=reuse',
    )
  })
})
