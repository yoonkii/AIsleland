// The floating island gently bobs. Every module (world terrain, props,
// critters, FX) applies the same deterministic offset so nothing drifts apart.

const BOB_PERIOD_S = 8
const BOB_AMPLITUDE = 0.12

/** Vertical bob offset for a given clock time (three's clock.elapsedTime). */
export function islandBob(elapsedTime: number): number {
  return Math.sin((elapsedTime * Math.PI * 2) / BOB_PERIOD_S) * BOB_AMPLITUDE
}

/** Tiny roll, applied as rotation.z on the island root for extra life. */
export function islandRoll(elapsedTime: number): number {
  return Math.sin((elapsedTime * Math.PI * 2) / (BOB_PERIOD_S * 1.7) + 1.1) * 0.004
}
