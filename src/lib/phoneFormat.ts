export function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '')
  if (digits.length === 10 && digits.startsWith('04')) {
    return `${digits.slice(0, 4)}-${digits.slice(4, 7)}-${digits.slice(7)}`
  }
  return value
}
