const sheetCodeImages = import.meta.glob('../assets/sheet-codes/*.png', {
  eager: true,
  import: 'default',
}) as Record<string, string>

export function sheetCodeImage(code: string): string | undefined {
  const file = `${code.toLowerCase()}.png`
  const match = Object.entries(sheetCodeImages).find(([path]) => path.replace(/\\/g, '/').endsWith(`/${file}`))
  return match?.[1]
}
