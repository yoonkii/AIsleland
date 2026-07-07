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

/** Listens for 'aisleland-snapshot' and downloads the canvas as a postcard PNG. */
function SnapshotListener() {
  const gl = useThree((s) => s.gl)
  useEffect(() => {
    const onSnap = () => {
      try {
        const url = gl.domElement.toDataURL('image/png')
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
      camera={{ position: [16, 12, 20], fov: 42, near: 0.5, far: 220 }}
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
