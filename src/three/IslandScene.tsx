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

/**
 * Listens for 'aisleland-snapshot' and downloads a framed 1080x1350 postcard
 * (Instagram 4:5): cover-cropped scene, cream border, caption + level stamp.
 */
function SnapshotListener() {
  const gl = useThree((s) => s.gl)
  useEffect(() => {
    const onSnap = () => {
      try {
        const src = gl.domElement
        const filterKey = document.querySelector('.game-root')?.getAttribute('data-filter')
        const W = 1080, H = 1350, BORDER = 36
        const out = document.createElement('canvas')
        out.width = W
        out.height = H
        const ctx = out.getContext('2d')!

        // cream card + soft inner frame
        ctx.fillStyle = '#FFF9EF'
        ctx.fillRect(0, 0, W, H)

        // cover-crop the scene into the frame
        const iw = W - BORDER * 2
        const ih = H - BORDER * 2 - 96 // caption strip at the bottom
        const scale = Math.max(iw / src.width, ih / src.height)
        const sw = iw / scale, sh = ih / scale
        const sx = (src.width - sw) / 2, sy = (src.height - sh) / 2
        if (filterKey && FILM_FILTERS[filterKey]) ctx.filter = FILM_FILTERS[filterKey]
        ctx.drawImage(src, sx, sy, sw, sh, BORDER, BORDER, iw, ih)
        ctx.filter = 'none'
        ctx.strokeStyle = '#E8D5C4'
        ctx.lineWidth = 3
        ctx.strokeRect(BORDER - 1.5, BORDER - 1.5, iw + 3, ih + 3)

        // caption
        const s = useGameStore.getState()
        const name = s.islandName || 'My Isle'
        ctx.fillStyle = '#5C5248'
        ctx.font = '600 34px Fredoka, Nunito, sans-serif'
        ctx.textBaseline = 'middle'
        ctx.fillText(`Day ${Math.max(1, s.island.streakCount)} on ${name}`, BORDER + 6, H - 66)
        ctx.fillStyle = '#8A7E72'
        ctx.font = '600 24px Nunito, sans-serif'
        ctx.textAlign = 'right'
        ctx.fillText('AIsleland · your work grows an island', W - BORDER - 6, H - 66)
        ctx.textAlign = 'left'

        // level stamp
        const cxs = W - BORDER - 52, cys = BORDER + 52
        ctx.beginPath()
        ctx.arc(cxs, cys, 42, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(255,249,239,0.92)'
        ctx.fill()
        ctx.strokeStyle = '#E07A6E'
        ctx.lineWidth = 3
        ctx.stroke()
        ctx.fillStyle = '#E07A6E'
        ctx.font = '700 15px Nunito, sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText('LEVEL', cxs, cys - 12)
        ctx.font = '700 34px Fredoka, Nunito, sans-serif'
        ctx.fillText(String(s.island.level), cxs, cys + 12)
        ctx.textAlign = 'left'

        const a = document.createElement('a')
        a.href = out.toDataURL('image/png')
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
