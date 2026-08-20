import { useRef, useState } from 'react'
import { usePricing } from '../lib/pricingContext'

export default function ExcelDropZone() {
  const { data, source, fileName, importFromFile, resetToDefault } = usePricing()
  const [isDragging, setIsDragging] = useState(false)
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File | undefined) {
    if (!file) return
    setStatus('loading')
    setError(null)
    setWarnings([])
    try {
      const result = await importFromFile(file)
      setStatus('idle')
      setWarnings(result.warnings)
    } catch (e) {
      setStatus('error')
      setError((e as Error).message)
    }
  }

  function handleReset() {
    resetToDefault()
    setStatus('idle')
    setError(null)
    setWarnings([])
  }

  return (
    <div className="dropzone-wrap">
      <div
        className={isDragging ? 'dropzone dropzone--active' : 'dropzone'}
        onDragOver={(e) => {
          e.preventDefault()
          setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setIsDragging(false)
          handleFile(e.dataTransfer.files[0])
        }}
      >
        <p className="small">
          Drag an updated price list (.xlsx) here, or{' '}
          <button type="button" className="link-button" onClick={() => inputRef.current?.click()}>
            choose a file
          </button>
          .
        </p>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx"
          style={{ display: 'none' }}
          onChange={(e) => {
            handleFile(e.target.files?.[0])
            e.target.value = ''
          }}
        />
        {status === 'loading' && <p className="muted small">Reading workbook…</p>}
        {status === 'error' && error && <p className="price-result--error small">{error}</p>}
      </div>

      <p className="muted small">
        {source === 'imported'
          ? `Using imported price list "${fileName}" (${data.products.length} product line${
              data.products.length === 1 ? '' : 's'
            }).`
          : 'Using the built-in default price list.'}
        {source === 'imported' && (
          <>
            {' '}
            <button type="button" className="link-button" onClick={handleReset}>
              Restore default price list
            </button>
          </>
        )}
      </p>
      {warnings.length > 0 && <p className="muted small">Not recognized: {warnings.join('; ')}</p>}
    </div>
  )
}
