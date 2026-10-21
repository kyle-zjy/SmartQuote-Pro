export class MemoryStorage implements Storage {
  data = new Map<string, string>()
  failWrites = false
  get length() { return this.data.size }
  clear() { this.data.clear() }
  key(index: number) { return [...this.data.keys()][index] ?? null }
  getItem(key: string) { return this.data.get(key) ?? null }
  removeItem(key: string) { this.data.delete(key) }
  setItem(key: string, value: string) {
    if (this.failWrites) throw new DOMException('Full', 'QuotaExceededError')
    this.data.set(key, value)
  }
}
