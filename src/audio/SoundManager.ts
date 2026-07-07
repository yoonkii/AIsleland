// AIsleland audio (docs/GAME_DESIGN.md §9).
// Dual-source: pre-generated ElevenLabs files in /audio/*.mp3 when present,
// otherwise a hand-tuned Web Audio synth. Ambience follows time of day and a
// generative pentatonic music box plays underneath. Celebrations duck the bed.

import { useGameStore } from '../state/gameStore'

export const SFX_NAMES = [
  'quest_complete', 'levelup', 'pop_spawn', 'xp_tick', 'ui_tap', 'boop_squish',
  'plant_flower', 'tree_grow', 'build_house', 'critter_cat', 'critter_rabbit',
  'critter_dog', 'critter_hamster', 'streak_fire', 'whoosh_camera',
  'owl_delivery', 'calendar_bells',
] as const

let ctx: AudioContext | null = null
let master: GainNode | null = null
let sfxBus: GainNode | null = null
let bedBus: GainNode | null = null // ambience + music (ducked by celebrations)
let started = false

const buffers = new Map<string, AudioBuffer>()
const missing = new Set<string>()

// pentatonic C major across two octaves
const PENTA = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25, 783.99, 880.0]

export function initAudio(): void {
  if (started) return
  started = true
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
  if (!Ctx) return
  ctx = new Ctx()
  master = ctx.createGain()
  master.gain.value = useGameStore.getState().muted ? 0 : 1
  master.connect(ctx.destination)
  sfxBus = ctx.createGain()
  sfxBus.gain.value = 0.9
  sfxBus.connect(master)
  bedBus = ctx.createGain()
  bedBus.gain.value = 0.5
  bedBus.connect(master)

  useGameStore.subscribe((s, prev) => {
    if (s.muted !== prev.muted && master && ctx) {
      master.gain.linearRampToValueAtTime(s.muted ? 0 : 1, ctx.currentTime + 0.15)
    }
  })

  window.addEventListener('aisleland-sfx', ((e: CustomEvent<{ name: string }>) => {
    play(e.detail?.name)
  }) as EventListener)

  void preloadFiles()
  startAmbience()
  startMusic()
}

async function preloadFiles(): Promise<void> {
  if (!ctx) return
  const names = [...SFX_NAMES, 'ambient_day', 'ambient_night', 'ambient_water']
  await Promise.all(names.map(async (name) => {
    try {
      const res = await fetch(`/audio/${name}.mp3`)
      const type = res.headers.get('content-type') ?? ''
      if (!res.ok || type.includes('text/html')) throw new Error('missing')
      const data = await res.arrayBuffer()
      buffers.set(name, await ctx!.decodeAudioData(data))
    } catch {
      missing.add(name)
    }
  }))
}

function play(name: string | undefined): void {
  if (!ctx || !sfxBus || !name) return
  if (ctx.state === 'suspended') void ctx.resume()
  if (name === 'quest_complete' || name === 'levelup') duck()
  if (name === 'quest_complete') musicRootPluck()

  const buf = buffers.get(name)
  if (buf) {
    const src = ctx.createBufferSource()
    src.buffer = buf
    const g = ctx.createGain()
    g.gain.value = 0.8
    src.connect(g).connect(sfxBus)
    src.start()
    return
  }
  synth(name)
}

// ---------- synth voices ----------

function pluck(freq: number, at: number, opts: { dur?: number; gain?: number; type?: OscillatorType; lp?: number; bend?: number } = {}) {
  if (!ctx || !sfxBus) return
  const { dur = 0.6, gain = 0.22, type = 'triangle', lp = 2400, bend = 0 } = opts
  const t = ctx.currentTime + at
  const osc = ctx.createOscillator()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t)
  if (bend !== 0) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq * bend), t + dur * 0.8)
  const f = ctx.createBiquadFilter()
  f.type = 'lowpass'
  f.frequency.value = lp
  const g = ctx.createGain()
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(gain, t + 0.008)
  g.gain.exponentialRampToValueAtTime(0.001, t + dur)
  osc.connect(f).connect(g).connect(sfxBus)
  osc.start(t)
  osc.stop(t + dur + 0.05)
}

let noiseBuf: AudioBuffer | null = null
function noise(): AudioBuffer {
  if (!noiseBuf && ctx) {
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
    const d = noiseBuf.getChannelData(0)
    let last = 0
    for (let i = 0; i < d.length; i++) {
      // pinkish: lowpassed white
      last = last * 0.94 + (Math.random() * 2 - 1) * 0.06
      d[i] = last * 6
    }
  }
  return noiseBuf!
}

function whoosh(at: number, opts: { dur?: number; gain?: number; from?: number; to?: number; q?: number } = {}) {
  if (!ctx || !sfxBus) return
  const { dur = 0.5, gain = 0.15, from = 300, to = 1400, q = 1.2 } = opts
  const t = ctx.currentTime + at
  const src = ctx.createBufferSource()
  src.buffer = noise()
  src.loop = true
  const f = ctx.createBiquadFilter()
  f.type = 'bandpass'
  f.Q.value = q
  f.frequency.setValueAtTime(from, t)
  f.frequency.exponentialRampToValueAtTime(to, t + dur)
  const g = ctx.createGain()
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(gain, t + dur * 0.35)
  g.gain.exponentialRampToValueAtTime(0.001, t + dur)
  src.connect(f).connect(g).connect(sfxBus)
  src.start(t)
  src.stop(t + dur + 0.1)
}

let xpTickCount = 0
let xpTickReset: ReturnType<typeof setTimeout> | null = null

function synth(name: string): void {
  switch (name) {
    case 'quest_complete': // marimba ascending triad + sparkle tail
      pluck(523.25, 0, { gain: 0.26, lp: 3200 })
      pluck(659.25, 0.09, { gain: 0.24, lp: 3200 })
      pluck(783.99, 0.18, { gain: 0.26, lp: 3600, dur: 0.9 })
      pluck(1567.98, 0.3, { gain: 0.1, type: 'sine', dur: 1.1 })
      break
    case 'levelup': { // harp gliss into bell arp + warm chord
      for (let i = 0; i < 8; i++) pluck(PENTA[i], i * 0.055, { gain: 0.14, dur: 0.8 })
      pluck(523.25, 0.5, { gain: 0.22, type: 'sine', dur: 1.6 })
      pluck(659.25, 0.62, { gain: 0.2, type: 'sine', dur: 1.6 })
      pluck(783.99, 0.74, { gain: 0.2, type: 'sine', dur: 1.8 })
      pluck(1046.5, 0.86, { gain: 0.18, type: 'sine', dur: 2.2 })
      break
    }
    case 'pop_spawn':
      pluck(520, 0, { gain: 0.22, type: 'sine', dur: 0.18, bend: 1.6 })
      whoosh(0, { dur: 0.15, gain: 0.06, from: 900, to: 2400 })
      break
    case 'xp_tick': {
      xpTickCount = Math.min(xpTickCount + 1, 6)
      const semis = (xpTickCount - 1) * 2
      pluck(880 * Math.pow(2, semis / 12), 0, { gain: 0.16, dur: 0.35, lp: 4000 })
      if (xpTickReset) clearTimeout(xpTickReset)
      xpTickReset = setTimeout(() => { xpTickCount = 0 }, 1200)
      break
    }
    case 'ui_tap':
      pluck(210, 0, { gain: 0.12, type: 'sine', dur: 0.07 })
      break
    case 'boop_squish':
      pluck(300, 0, { gain: 0.2, type: 'sine', dur: 0.16, bend: 0.6 })
      break
    case 'plant_flower':
      whoosh(0, { dur: 0.2, gain: 0.08, from: 500, to: 200 })
      pluck(659.25, 0.12, { gain: 0.18, dur: 0.5 })
      break
    case 'tree_grow':
      whoosh(0, { dur: 0.6, gain: 0.1, from: 180, to: 700, q: 2 })
      pluck(523.25, 0.5, { gain: 0.16, dur: 0.7 })
      break
    case 'build_house':
      pluck(160, 0, { gain: 0.2, type: 'square', dur: 0.09, lp: 900 })
      pluck(170, 0.14, { gain: 0.2, type: 'square', dur: 0.09, lp: 900 })
      pluck(150, 0.28, { gain: 0.24, type: 'square', dur: 0.12, lp: 800 })
      pluck(783.99, 0.42, { gain: 0.16, dur: 0.6 })
      break
    case 'critter_cat':
      pluck(900, 0, { gain: 0.14, type: 'sine', dur: 0.22, bend: 1.5 })
      break
    case 'critter_rabbit':
      pluck(1200, 0, { gain: 0.12, type: 'sine', dur: 0.12, bend: 1.3 })
      pluck(1400, 0.1, { gain: 0.1, type: 'sine', dur: 0.1, bend: 1.2 })
      break
    case 'critter_dog':
      pluck(320, 0, { gain: 0.18, type: 'sawtooth', dur: 0.12, lp: 1200, bend: 0.8 })
      break
    case 'critter_hamster':
      pluck(1800, 0, { gain: 0.1, type: 'sine', dur: 0.08, bend: 1.4 })
      pluck(2100, 0.07, { gain: 0.08, type: 'sine', dur: 0.07, bend: 1.2 })
      break
    case 'streak_fire':
      whoosh(0, { dur: 0.7, gain: 0.16, from: 200, to: 1800, q: 0.8 })
      pluck(1046.5, 0.35, { gain: 0.12, dur: 0.6 })
      break
    case 'whoosh_camera':
      whoosh(0, { dur: 0.6, gain: 0.05, from: 250, to: 900, q: 0.7 })
      break
    case 'owl_delivery':
      whoosh(0, { dur: 0.18, gain: 0.08, from: 300, to: 150 })
      whoosh(0.22, { dur: 0.18, gain: 0.08, from: 300, to: 150 })
      pluck(1318.5, 0.5, { gain: 0.1, dur: 0.3 })
      break
    case 'calendar_bells':
      pluck(523.25, 0, { gain: 0.16, type: 'sine', dur: 1.0 })
      pluck(659.25, 0.18, { gain: 0.16, type: 'sine', dur: 1.0 })
      pluck(783.99, 0.36, { gain: 0.16, type: 'sine', dur: 1.4 })
      break
    default:
      pluck(440, 0, { gain: 0.1, dur: 0.2 })
  }
}

// ---------- ducking ----------

function duck(): void {
  if (!ctx || !bedBus) return
  const t = ctx.currentTime
  bedBus.gain.cancelScheduledValues(t)
  bedBus.gain.setValueAtTime(bedBus.gain.value, t)
  bedBus.gain.linearRampToValueAtTime(0.2, t + 0.15) // ~-8dB
  bedBus.gain.linearRampToValueAtTime(0.5, t + 4)
}

// ---------- ambience ----------

function startAmbience(): void {
  if (!ctx || !bedBus) return

  // constant soft waterfall + wind (filtered looping noise)
  const mkLoop = (freq: number, gainVal: number, type: BiquadFilterType) => {
    const src = ctx!.createBufferSource()
    src.buffer = noise()
    src.loop = true
    const f = ctx!.createBiquadFilter()
    f.type = type
    f.frequency.value = freq
    const g = ctx!.createGain()
    g.gain.value = gainVal
    src.connect(f).connect(g).connect(bedBus!)
    src.start()
    return g
  }

  const fileAmbience = (name: string, gainVal: number): GainNode | null => {
    const buf = buffers.get(name)
    if (!buf || !ctx || !bedBus) return null
    const src = ctx.createBufferSource()
    src.buffer = buf
    src.loop = true
    const g = ctx.createGain()
    g.gain.value = gainVal
    src.connect(g).connect(bedBus)
    src.start()
    return g
  }

  // start after preload settles so files win when available
  setTimeout(() => {
    if (!ctx || !bedBus) return
    const water = fileAmbience('ambient_water', 0.25) ?? mkLoop(420, 0.05, 'lowpass')
    const wind = mkLoop(240, 0.04, 'lowpass')
    const dayLoop = fileAmbience('ambient_day', 0)
    const nightLoop = fileAmbience('ambient_night', 0)
    void water

    // LFO wind swell
    const lfo = ctx.createOscillator()
    lfo.frequency.value = 0.07
    const lfoGain = ctx.createGain()
    lfoGain.gain.value = 0.02
    lfo.connect(lfoGain).connect(wind.gain)
    lfo.start()

    // day/night scheduler: synth birds & crickets when no files
    setInterval(() => {
      if (!ctx || document.hidden) return
      const s = useGameStore.getState()
      const t = s.timeOverride ?? s.timeOfDay
      const day = Math.max(0, Math.sin((t - 0.25) * Math.PI * 2 / 1) ) // rough daylight 0..1
      const dayAmt = t > 0.27 && t < 0.73 ? Math.min(1, day * 1.5) : 0
      const nightAmt = t < 0.22 || t > 0.78 ? 1 : 0
      if (dayLoop) dayLoop.gain.linearRampToValueAtTime(0.18 * dayAmt, ctx.currentTime + 2)
      if (nightLoop) nightLoop.gain.linearRampToValueAtTime(0.15 * nightAmt, ctx.currentTime + 2)
      if (!dayLoop && dayAmt > 0.3 && Math.random() < 0.4) birdChirp()
      if (!nightLoop && nightAmt > 0.5 && Math.random() < 0.6) cricket()
    }, 4000)
  }, 2500)
}

function birdChirp(): void {
  if (!ctx || !bedBus) return
  const base = 1800 + Math.random() * 1200
  const n = 2 + Math.floor(Math.random() * 3)
  for (let i = 0; i < n; i++) {
    const t = ctx.currentTime + i * (0.12 + Math.random() * 0.06)
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(base, t)
    osc.frequency.exponentialRampToValueAtTime(base * (1.2 + Math.random() * 0.3), t + 0.08)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(0.04, t + 0.015)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.12)
    osc.connect(g).connect(bedBus)
    osc.start(t)
    osc.stop(t + 0.15)
  }
}

function cricket(): void {
  if (!ctx || !bedBus) return
  const t0 = ctx.currentTime
  for (let i = 0; i < 6; i++) {
    const t = t0 + i * 0.07
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = 4200 + Math.random() * 300
    const g = ctx.createGain()
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(0.018, t + 0.01)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.05)
    osc.connect(g).connect(bedBus)
    osc.start(t)
    osc.stop(t + 0.06)
  }
}

// ---------- generative music box ----------

let musicStep = 0

function musicPluck(freq: number, gainVal = 0.05): void {
  if (!ctx || !bedBus) return
  const t = ctx.currentTime
  const osc = ctx.createOscillator()
  osc.type = 'triangle'
  osc.frequency.value = freq
  const partial = ctx.createOscillator()
  partial.type = 'sine'
  partial.frequency.value = freq * 4
  const f = ctx.createBiquadFilter()
  f.type = 'lowpass'
  f.frequency.value = 1600
  const g = ctx.createGain()
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(gainVal, t + 0.01)
  g.gain.exponentialRampToValueAtTime(0.001, t + 2.2)
  const pg = ctx.createGain()
  pg.gain.setValueAtTime(gainVal * 0.25, t)
  pg.gain.exponentialRampToValueAtTime(0.001, t + 0.7)
  osc.connect(f).connect(g).connect(bedBus)
  partial.connect(pg).connect(bedBus)
  osc.start(t); osc.stop(t + 2.4)
  partial.start(t); partial.stop(t + 0.9)
}

function musicRootPluck(): void {
  musicPluck(261.63, 0.07)
  musicPluck(392.0, 0.05)
}

function startMusic(): void {
  // sparse random-walk pentatonic melody, tempo ~64 feel
  setInterval(() => {
    if (!ctx || document.hidden || useGameStore.getState().muted) return
    if (Math.random() < 0.55) {
      musicStep += Math.floor(Math.random() * 5) - 2
      musicStep = Math.max(0, Math.min(PENTA.length - 1, musicStep))
      musicPluck(PENTA[musicStep])
      if (Math.random() < 0.25) {
        setTimeout(() => musicPluck(PENTA[Math.max(0, musicStep - 3)], 0.035), 460)
      }
    }
  }, 1875) // half-bar at 64bpm
}
