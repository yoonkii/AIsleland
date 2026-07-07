// Single source of truth for every color/timing in the game.
// See docs/GAME_DESIGN.md §2 — every system samples ONLY from here.

export const PALETTE = {
  // Island
  dirtUnderTop: '#A9744F',
  dirtUnderBottom: '#7A4E33',
  clay: '#C98A5E',
  cliff: '#E3B08A',
  soilLip: '#D9A066',
  grass: '#93D18B',
  grassHi: '#BEEAA6',
  pathSand: '#F2E3C2',
  pathPebble: '#D8C7A8',

  // Water & sky
  seaDeep: '#4FA8C7',
  seaShallow: '#8FD8DE',
  foamWhite: '#FFFFFF',
  waterfallStripe: '#CFF0F5',
  skyDayTop: '#7EC8E8',
  skyDayMid: '#A8DCEF',
  skyDayHorizon: '#FDEBD2',
  skyDuskTop: '#5C6B9E',
  skyDuskMid: '#E8917C',
  skyDuskHorizon: '#FFD9A0',
  skyNightTop: '#101A38',
  skyNightMid: '#22335E',
  skyNightHorizon: '#3A5178',

  // Foliage
  canopySpring: '#B7E4A8',
  blossom: '#F7C8D8',
  canopySummer: '#7FC97F',
  canopySummerInner: '#5FAF6F',
  canopyAutumnA: '#E8A94F',
  canopyAutumnB: '#E07B54',
  canopyAutumnC: '#D9C36A',
  canopyWinter: '#EAF4F7',
  snow: '#FFFFFF',
  trunk: '#8A6248',

  // Buildings
  wallCream: '#FFF4E0',
  roofCoral: '#E07A6E',
  roofBlue: '#7EAED4',
  accentGreen: '#6BAF8D',
  lampGlow: '#FFD98A',

  // FX
  sparkle: '#FFF3E0',
  groundRing: '#FFE9A8',
  dustPuff: '#FFF6E5',
  xpMote: '#FFE8A3',
  rune: '#8FD8FF',
  firefly: '#D9F2A8',
  shockwave: '#FFF3B0',
  rain: '#BFE3F2',
  rainGold: '#FFE9B8',
  overcast: '#C9D4DC',

  // Rim
  rimDay: '#FFF3E0',
  rimNight: '#B8C7F0',

  // UI
  cardCream: '#FFF6EC',
  cardBorder: '#E8D5C4',
  textInk: '#5C5248',
  textSoft: '#8A7E72',
  pillPink: '#FFB6C1',
  heart: '#FF9EAA',
  validGreen: '#7FE3A0',
  invalidRed: '#FF6B6B',
  flameA: '#FFB347',
  flameB: '#FFE29A',
} as const

/** Confetti uses ONLY these five. */
export const CELEBRATION_COLORS = ['#FF9EAA', '#A8E6CF', '#FFD3B6', '#B5D8FF', '#FFF6A5'] as const

export const SOURCE_COLORS: Record<string, string> = {
  gmail: '#FF9EAA',
  docs: '#7EA8F8',
  sheets: '#A8E6CF',
  slides: '#FFD3B6',
  calendar: '#B5D8FF',
}

export const TIMING = {
  bloomBurstMs: 3200,
  levelUpMs: 4500,
  popInMs: 1200,
  cameraFocusMs: 900,
  cameraReturnMs: 800,
} as const

// Long-lens diorama framing: island (r=13) at ~60% of frame height with sky
// above — pulled far back with a narrow FOV (VISUAL_PLAYBOOK "miniature").
export const CAMERA = {
  fov: 38,
  defaultRadius: 55,
  defaultPolarDeg: 64,
  defaultAzimuthDeg: -35,
  target: [0, 0.5, 0] as [number, number, number],
  minDistance: 28,
  maxDistance: 76,
  minPolarDeg: 40,
  maxPolarDeg: 78,
  damping: 0.08,
  idleDriftDelayS: 8,
  idleDriftRadPerS: 0.03,
} as const

export const FONT_DISPLAY = "'Fredoka', 'Nunito', system-ui, sans-serif"
export const FONT_BODY = "'Nunito', system-ui, sans-serif"

/** Demo mode: full day loops in 6 minutes, starting mid-morning. */
export const DEMO_DAY_SECONDS = 360
export const DEMO_DAY_START = 0.38
