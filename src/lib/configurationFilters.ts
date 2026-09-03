import { configFamily, configLabel, type SheetConfig } from './quoteSheet'

export type ConfigTypeFilter = 'door' | 'window'
export type ConfigOperationFilter = 'hinged' | 'sliding'
export type ConfigPanelsFilter = 1 | 2 | '3+'
export type ConfigDirectionFilter = 'LHS' | 'RHS'

export interface ConfigurationFilters {
  type?: ConfigTypeFilter
  operation?: ConfigOperationFilter
  panels?: ConfigPanelsFilter
  direction?: ConfigDirectionFilter
  search?: string
}

export function configType(code: string): ConfigTypeFilter {
  return configFamily(code) === 'window' ? 'window' : 'door'
}

export function configOperation(code: string): ConfigOperationFilter | undefined {
  const family = configFamily(code)
  return family === 'hinged' || family === 'sliding' ? family : undefined
}

export function configDirection(code: string): ConfigDirectionFilter | undefined {
  if (code.endsWith('-L')) return 'LHS'
  if (code.endsWith('-R')) return 'RHS'
  return undefined
}

export function configPanelsBucket(panels: number): ConfigPanelsFilter {
  if (panels <= 1) return 1
  if (panels === 2) return 2
  return '3+'
}

export function filterConfigs(configs: SheetConfig[], filters: ConfigurationFilters): SheetConfig[] {
  const search = filters.search?.trim().toLowerCase()
  return configs.filter((config) => {
    if (filters.type && configType(config.code) !== filters.type) return false
    if (filters.operation && configOperation(config.code) !== filters.operation) return false
    if (filters.panels && configPanelsBucket(config.panels) !== filters.panels) return false
    if (filters.direction && configDirection(config.code) !== filters.direction) return false
    if (search) {
      const haystack = `${config.code} ${configLabel(config.code)}`.toLowerCase()
      if (!haystack.includes(search)) return false
    }
    return true
  })
}
