import { useRef, useState } from 'react'
import { useQuote } from '../lib/quoteContext'

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

export default function RoomPhotos({ room }: { room: string }) {
  const { roomPhotos, addPhoto, removePhoto, setPhotoCaption, status } = useQuote()
  const photos = roomPhotos[room] ?? []
  const issued = status === 'issued'
  const [activeId, setActiveId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const activePhoto = photos.find((p) => p.id === activeId) ?? null

  async function handleFiles(files: FileList | null) {
    if (issued || !files) return
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue
      const dataUrl = await readAsDataUrl(file)
      addPhoto(room, dataUrl)
    }
  }

  return (
    <div className="room-photos">
      <div className="room-photos__grid">
        {photos.map((photo) => (
          <button key={photo.id} type="button" className="room-photo-thumb" onClick={() => setActiveId(photo.id)}>
            <img src={photo.dataUrl} alt={photo.caption || 'Room photo'} />
          </button>
        ))}
        {!issued && (
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

      {activePhoto && (
        <div className="photo-modal-overlay" onClick={() => setActiveId(null)}>
          <div className="photo-modal" onClick={(e) => e.stopPropagation()}>
            <img src={activePhoto.dataUrl} alt={activePhoto.caption || 'Room photo'} />
            <label className="field-row__single">
              Note
              <textarea
                value={activePhoto.caption}
                onChange={(e) => setPhotoCaption(room, activePhoto.id, e.target.value)}
                placeholder="Add a note about this photo"
                rows={3}
                disabled={issued}
              />
            </label>
            <div className="photo-modal__actions">
              {!issued && (
                <button
                  type="button"
                  className="link-button"
                  onClick={() => {
                    removePhoto(room, activePhoto.id)
                    setActiveId(null)
                  }}
                >
                  Delete photo
                </button>
              )}
              <button type="button" className="primary-button" onClick={() => setActiveId(null)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
