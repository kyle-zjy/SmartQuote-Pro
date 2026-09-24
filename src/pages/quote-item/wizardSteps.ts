export type Step = 'location' | 'configuration' | 'measurements' | 'product' | 'addons' | 'review'

export const STEP_LABELS: Record<Step, string> = {
  location: 'Location',
  configuration: 'Configuration',
  measurements: 'Measurements',
  product: 'Product',
  addons: 'Add-ons',
  review: 'Review',
}

export const STEP_ORDER: Step[] = ['location', 'configuration', 'measurements', 'product', 'addons', 'review']
