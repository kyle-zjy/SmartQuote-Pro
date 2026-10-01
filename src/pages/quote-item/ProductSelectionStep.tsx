import { usePricing } from '../../lib/pricingContext'
import { compatibleCategories, type ItemDraft } from './itemDraft'

export default function ProductSelectionStep({
  draft,
  onChange,
  onNext,
  onBack,
}: {
  draft: ItemDraft
  onChange: (patch: Partial<ItemDraft>) => void
  onNext: () => void
  onBack: () => void
}) {
  const { data } = usePricing()
  const products = data.products.filter((product) => compatibleCategories(product, draft.configurationCode).length > 0)

  function selectProduct(key: string) {
    if (draft.productKey === key && !draft.serviceOnly) return
    const product = products.find((candidate) => candidate.key === key)
    if (!product) return
    onChange({
      serviceOnly: false,
      productKey: key,
      categoryKey: compatibleCategories(product, draft.configurationCode)[0]?.key ?? '',
      measurements: {},
      widthMm: '',
      heightMm: '',
      lockHeightMm: '',
      lockTopMm: '',
      lockCentreMm: '',
      lockBottomMm: '',
      centreTongue: false,
      midRailRequired: false,
      midRailHeightMm: '',
      interlockAdjustment: '',
      fitExtras: [],
      addons: [],
      serviceDescription: '',
      servicePrice: '',
    })
  }

  return (
    <div className="wizard-panel">
      <h2>Select a product</h2>
      <p className="muted small">Choose the product for this configuration before measuring.</p>
      <div className="tabs">
        {products.map((product) => (
          <button
            key={product.key}
            type="button"
            className={`tab${draft.productKey === product.key ? ' tab--active' : ''}`}
            onClick={() => selectProduct(product.key)}
          >
            {product.name}
          </button>
        ))}
      </div>
      <div className="wizard-actions">
        <button type="button" className="link-button" onClick={onBack}>&larr; Back</button>
        <button type="button" className="primary-button" onClick={onNext} disabled={!draft.productKey || !draft.categoryKey}>
          Continue
        </button>
      </div>
    </div>
  )
}
