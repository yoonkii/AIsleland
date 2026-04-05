// Minimal Web Audio API engine for quest completion chimes
// Defaults to muted — user must explicitly enable

let audioCtx: AudioContext | null = null
let muted = true

export function initAudio(): void {
  if (!audioCtx) {
    audioCtx = new AudioContext()
  }
}

export function setMuted(m: boolean): void {
  muted = m
  if (!m) initAudio()
}

export function isMuted(): boolean {
  return muted
}

/**
 * Play a pleasant chime for quest completion.
 * Uses a simple sine wave with a quick decay envelope.
 */
export function playChime(type: 'flower' | 'tree' | 'building' | 'levelup' = 'flower'): void {
  if (muted || !audioCtx) return

  const frequencies: Record<string, number[]> = {
    flower: [523, 659, 784],       // C5, E5, G5 — gentle major chord
    tree: [440, 554, 659],         // A4, C#5, E5 — warm
    building: [392, 494, 587],     // G4, B4, D5 — triumphant
    levelup: [523, 659, 784, 1047], // C5, E5, G5, C6 — fanfare
  }

  const notes = frequencies[type] || frequencies.flower
  const now = audioCtx.currentTime

  notes.forEach((freq, i) => {
    const osc = audioCtx!.createOscillator()
    const gain = audioCtx!.createGain()

    osc.type = 'sine'
    osc.frequency.value = freq

    // Stagger notes slightly for arpeggio effect
    const startTime = now + i * 0.08
    gain.gain.setValueAtTime(0.15, startTime)
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.6)

    osc.connect(gain)
    gain.connect(audioCtx!.destination)

    osc.start(startTime)
    osc.stop(startTime + 0.7)
  })
}
