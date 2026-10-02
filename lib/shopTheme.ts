/**
 * Preferred Colour Theme = selected CARD COLOUR + WHITE.
 *
 * Defaults to HM Boutique's Electric Rani Pink (#F500A0).
 * Driven by CSS variables holding raw RGB channels so Tailwind opacity modifiers keep working.
 */

export const DEFAULT_CARD_COLOR = '#F500A0'

const THEME_CACHE_KEY = 'shop-card-color'

type Rgb = { r: number; g: number; b: number }

export const normalizeHex = (value: string): string => {
  const raw = (value || '').trim()
  const short = /^#?([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(raw)
  if (short) return `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`.toUpperCase()
  const full = /^#?([0-9a-f]{6})$/i.exec(raw)
  return full ? `#${full[1].toUpperCase()}` : ''
}

export const isValidHex = (value: string) => normalizeHex(value) !== ''

const toRgb = (hex: string): Rgb => {
  const safe = normalizeHex(hex) || DEFAULT_CARD_COLOR
  return {
    r: parseInt(safe.slice(1, 3), 16),
    g: parseInt(safe.slice(3, 5), 16),
    b: parseInt(safe.slice(5, 7), 16),
  }
}

const channels = ({ r, g, b }: Rgb) => `${r} ${g} ${b}`

/** Mix towards white — this is the "+ WHITE" half of the theme. */
const mixWhite = ({ r, g, b }: Rgb, amount: number): Rgb => ({
  r: Math.round(r + (255 - r) * amount),
  g: Math.round(g + (255 - g) * amount),
  b: Math.round(b + (255 - b) * amount),
})

/** Slightly lighter sibling used for highlight/active accents. */
const lighten = (rgb: Rgb) => mixWhite(rgb, 0.08)

/** Readable text colour on top of the card colour (white unless very light). */
export const contrastOn = (hex: string): '#FFFFFF' | '#111111' => {
  const { r, g, b } = toRgb(hex)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.68 ? '#111111' : '#FFFFFF'
}

/** Applies the card colour to the document as CSS variables. */
export const applyShopTheme = (hex?: string) => {
  if (typeof document === 'undefined') return
  const base = hex && isValidHex(hex) ? hex : DEFAULT_CARD_COLOR
  const rgb = toRgb(base)
  const root = document.documentElement
  root.style.setProperty('--shop-card-rgb', channels(rgb))
  root.style.setProperty('--shop-accent-rgb', channels(lighten(rgb)))
  root.style.setProperty('--shop-soft-rgb', '255 240 248')
  // Page background is ultra-light clean tint #FFF0F8
  root.style.setProperty('--shop-tint-rgb', '255 240 248')
  // Deep chrome uses Rani Pink #F500A0
  root.style.setProperty('--shop-deep-rgb', channels(rgb))
  root.style.setProperty('--shop-on-card', contrastOn(base))
  try {
    window.localStorage.setItem(THEME_CACHE_KEY, base)
  } catch {
    // Ignore storage failures
  }
}

export const readCachedCardColor = (): string => {
  if (typeof window === 'undefined') return DEFAULT_CARD_COLOR
  try {
    return window.localStorage.getItem(THEME_CACHE_KEY) || DEFAULT_CARD_COLOR
  } catch {
    return DEFAULT_CARD_COLOR
  }
}

export const resolveCardColorHex = (): string => readCachedCardColor()

const toHex = ({ r, g, b }: Rgb) =>
  `#${[r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')}`.toUpperCase()

export const resolveCardSoftHex = (): string => toHex(mixWhite(toRgb(readCachedCardColor()), 0.85))

export const CARD_COLOR_PRESETS = [
  '#F500A0', // Rani Pink (HM Boutique primary)
  '#111827', // Charcoal
  '#BE185D', // Magenta
]
