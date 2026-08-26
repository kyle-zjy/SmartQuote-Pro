export function addressLines(address: string): string[] {
  const normalized = address.replace(/\r\n/g, '\n').trim()
  if (!normalized) return []
  if (normalized.includes('\n')) {
    return normalized.split('\n').map((line) => line.trim()).filter(Boolean)
  }
  return normalized.split(',').map((line) => line.trim()).filter(Boolean)
}

export function partyLines(name: string, address: string, phone: string): string[] {
  const lines = [name.trim(), ...addressLines(address), phone.trim()].filter(Boolean)
  return lines.length > 0 ? lines : ['—']
}
