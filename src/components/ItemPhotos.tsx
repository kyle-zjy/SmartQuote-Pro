import { useRef, useState } from 'react'
import { readImageResized } from '../lib/imageResize'
import type { ItemPhoto } from '../lib/quoteContext'
import PhotoMarkupEditor from './PhotoMarkupEditor'

export default function ItemPhotos({
  photos,
  onChange,
  disabled,
}: {
  photos: ItemPhoto[]
  onChange: (photos: ItemPhoto[]) => void
  disabled: boolean
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [markupId, setMarkupId] = useState<string | null>(null)

  const activePhoto = photos.find((photo) => photo.id === activeId) ?? null
  const markupPhoto = photos.find((photo) => photo.id === markupId) ?? null

  async function handleFiles(files: FileList | null) {
    if (disabled || !files || files.length === 0) return
    const additions: ItemPhoto[] = []
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue
      const dataUrl = await readImageResized(file)
      additions.push({ id: crypto.randomUUID(), dataUrl, strokes: [], annotatedDataUrl: null })
    }
    if (additions.length > 0) onChange([...photos, ...additions])
  }

  function removePhoto(id: string) {
    onChange(photos.filter((photo) => photo.id !== id))
  }

  function saveAnnotation(id: string, patch: { strokes: ItemPhoto['strokes']; annotatedDataUrl: string }) {
    onChange(photos.map((photo) => (photo.id === id ? { ...photo, ...patch } : photo)))
    setMarkupId(null)
  }

  return (
    <div className="item-photos">
      <div className="room-photos__grid">
        {photos.map((photo) => (
          <button key={photo.id} type="button" className="room-photo-thumb" onClick={() => setActiveId(photo.id)}>
            <img src={photo.annotatedDataUrl ?? photo.dataUrl} alt="Item reference" />
          </button>
        ))}
        {!disabled && (
          <button type="button" className="room-photo-add" onClick={() => fileInputRef.current?.click()}>
            + Add photo
          </button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            void handleFiles(e.target.files)
            e.target.value = ''
          }}
        />
      </div>

      {activePhoto && !markupPhoto && (
        <div className="photo-modal-overlay" onClick={() => setActiveId(null)}>
          <div className="photo-modal" onClick={(e) => e.stopPropagation()}>
            <img src={activePhoto.annotatedDataUrl ?? activePhoto.dataUrl} alt="Item reference" />
            <div className="photo-modal__actions">
              {!disabled && (
                <>
                  <button
                    type="button"
                    className="link-button"
                    onClick={() => {
                      removePhoto(activePhoto.id)
                      setActiveId(null)
                    }}
                  >
                    Delete photo
                  </button>
                  <button type="button" className="link-button" onClick={() => setMarkupId(activePhoto.id)}>
                    Annotate
                  </button>
                </>
              )}
              <button type="button" className="primary-button" onClick={() => setActiveId(null)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {markupPhoto && (
        <PhotoMarkupEditor
          photo={markupPhoto}
          onSave={(patch) => saveAnnotation(markupPhoto.id, patch)}
          onCancel={() => setMarkupId(null)}
        />
      )}
    </div>
  )
}
