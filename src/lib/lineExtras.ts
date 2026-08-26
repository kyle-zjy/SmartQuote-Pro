export const LINE_FIT_EXTRAS = [
  { addonName: 'TOP TRACKS', phrase: 'top track' },
  { addonName: 'LOCK POSTS', phrase: 'lock post' },
  { addonName: 'BOTTOM TRACK', phrase: 'bottom track' },
  { addonName: 'TRIPLE LOCKS', phrase: 'triple lock' },
] as const

export function fitExtraPhrase(addonName: string): string {
  return LINE_FIT_EXTRAS.find((item) => item.addonName === addonName)?.phrase ?? addonName.toLowerCase()
}
