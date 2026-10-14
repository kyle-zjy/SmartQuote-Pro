// Decode the original segment once: router params can conflate literal %2F with /.
export function quoteIdFromPath(pathname: string): string {
  const segment = pathname.split('/')[2] ?? ''
  try {
    return decodeURIComponent(segment)
  } catch {
    return segment
  }
}
