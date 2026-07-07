import { Suspense, useEffect } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { useGameStore, clockFraction } from '../state/gameStore'
import { DEMO_DAY_SECONDS, DEMO_DAY_START } from '../design/tokens'
import { World } from './world/World'
import { Props } from './props/Props'
import { Critters } from './critters/Critters'
import { CameraRig } from './camera/CameraRig'
import { CelebrationDirector, AmbientFX } from './fx/CelebrationDirector'
import { PostFX } from './fx/PostFX'

/**
 * Keeps store.timeOfDay in sync. Signed-in: wall clock (once a minute).
 * Demo: a full day loops every 6 minutes starting at mid-morning, so visitors
 * see dusk lamps and fireflies without waiting for real nightfall.
 */
function ClockSync() {
  const setTimeOfDay = useGameStore((s) => s.setTimeOfDay)
  const mode = useGameStore((s) => s.mode)
  useEffect(() => {
    if (mode === 'demo') {
      const start = Date.now()
      const id = setInterval(() => {
        const elapsed = (Date.now() - start) / 1000
        setTimeOfDay(DEMO_DAY_START + elapsed / DEMO_DAY_SECONDS)
      }, 1000)
      return () => clearInterval(id)
    }
    setTimeOfDay(clockFraction())
    const id = setInterval(() => setTimeOfDay(clockFraction()), 60_000)
    return () => clearInterval(id)
  }, [setTimeOfDay, mode])
  return null
}

// Same recipes as ui.css .game-root[data-filter] — the WebGL buffer doesn't
// carry CSS filters, so the postcard re-applies them via ctx.filter.
const FILM_FILTERS: Record<string, string> = {
  peach: 'sepia(.18) saturate(1.15) hue-rotate(-8deg) brightness(1.04)',
  mint: 'saturate(1.1) hue-rotate(12deg) brightness(1.03)',
  dusk: 'saturate(1.25) hue-rotate(-18deg) contrast(1.06) brightness(.97)',
  mono: 'saturate(.3) sepia(.14) contrast(1.05) brightness(1.05)',
}

/** Listens for 'aisleland-snapshot' and downloads the canvas as a postcard PNG. */
function SnapshotListener() {
  const gl = useThree((s) => s.gl)
  useEffect(() => {
    const onSnap = () => {
      try {
        const src = gl.domElement
        const filterKey = document.querySelector('.game-root')?.getAttribute('data-filter')
        let url: string
        if (filterKey && FILM_FILTERS[filterKey]) {
          const out = document.createElement('canvas')
          out.width = src.width
          out.height = src.height
          const ctx = out.getContext('2d')!
          ctx.filter = FILM_FILTERS[filterKey]
          ctx.drawImage(src, 0, 0)
          url = out.toDataURL('image/png')
        } else {
          url = src.toDataURL('image/png')
        }
        const a = document.createElement('a')
        a.href = url
        a.download = `aisleland-postcard-${new Date().toISOString().slice(0, 10)}.png`
        a.click()
        window.dispatchEvent(new CustomEvent('aisleland-sfx', { detail: { name: 'ui_tap' } }))
      } catch (e) {
        console.warn('snapshot failed', e)
      }
    }
    window.addEventListener('aisleland-snapshot', onSnap)
    return () => window.removeEventListener('aisleland-snapshot', onSnap)
  }, [gl])
  return null
}

export function IslandScene() {
  const quality = useGameStore((s) => s.quality)
  return (
    <Canvas
      shadows={quality === 'high'}
      dpr={quality === 'high' ? [1, 2] : 1}
      gl={{ antialias: true, preserveDrawingBuffer: true }}
      camera={{ position: [-28.4, 24.6, 40.4], fov: 38, near: 0.5, far: 260 }}
      style={{ position: 'absolute', inset: 0 }}
    >
      <ClockSync />
      <SnapshotListener />
      <Suspense fallback={null}>
        <World />
        <Props />
        <Critters />
        <AmbientFX />
      </Suspense>
      <CameraRig />
      <CelebrationDirector />
      <PostFX />
    </Canvas>
  )
}
