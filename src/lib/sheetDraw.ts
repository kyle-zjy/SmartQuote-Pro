export interface DrawPoint {
  x: number
  y: number
}

export interface DrawStroke {
  color: string
  size: number
  erase: boolean
  points: DrawPoint[]
}

export function appendDrawPoint(points: DrawPoint[], next: DrawPoint, minGap = 0.35): DrawPoint[] {
  const last = points[points.length - 1]
  if (!last) return [next]
  const dx = next.x - last.x
  const dy = next.y - last.y
  if (dx * dx + dy * dy < minGap * minGap) return points
  return [...points, next]
}
