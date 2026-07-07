import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { CAMERA } from '../../design/tokens'
import { useGameStore } from '../../state/gameStore'

const DEG = Math.PI / 180

/** cubic-bezier(0.16, 1, 0.3, 1) feel — strong ease-out with soft settle. */
function easeFly(t: number): number {
  return 1 - Math.pow(1 - t, 3.2)
}

interface Flight {
  fromPos: THREE.Vector3
  fromTarget: THREE.Vector3
  toPos: THREE.Vector3
  toTarget: THREE.Vector3
  start: number
  durMs: number
}

const PHOTO_ORBITS = [
  // Hero: 3/4 view, 35° elevation
  { radius: 48, polar: 55 * DEG, azimuth: -35 * DEG, target: [0, 1.2, 0] as const },
  // Cozy: low through-the-flowers angle
  { radius: 26, polar: 78 * DEG, azimuth: 20 * DEG, target: [0, 1.0, 0] as const },
  // Aerial: top-down postcard
  { radius: 58, polar: 24 * DEG, azimuth: -60 * DEG, target: [0, 0, 0] as const },
]

const scratchPos = new THREE.Vector3()
const scratchTarget = new THREE.Vector3()
const sph = new THREE.Spherical()

function sphericalPos(radius: number, polar: number, azimuth: number, target: THREE.Vector3, out: THREE.Vector3) {
  sph.set(radius, polar, azimuth)
  return out.setFromSpherical(sph).add(target)
}

export function CameraRig() {
  const controlsRef = useRef<OrbitControlsImpl | null>(null)
  const camera = useThree((s) => s.camera)
  const flight = useRef<Flight | null>(null)
  const lastInput = useRef(Date.now())
  const driftBlend = useRef(0)
  const savedView = useRef<{ pos: THREE.Vector3; target: THREE.Vector3 } | null>(null)
  const photoOrbitIndex = useRef(0)
  const prevFocusToken = useRef(useGameStore.getState().focusToken)
  const prevPhotoMode = useRef(false)

  // Camera FOV per design (diorama compression)
  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera
    cam.fov = CAMERA.fov
    cam.updateProjectionMatrix()
  }, [camera])

  // Track user input for idle drift
  useEffect(() => {
    const bump = () => { lastInput.current = Date.now() }
    window.addEventListener('pointerdown', bump)
    window.addEventListener('wheel', bump)
    window.addEventListener('touchstart', bump)
    return () => {
      window.removeEventListener('pointerdown', bump)
      window.removeEventListener('wheel', bump)
      window.removeEventListener('touchstart', bump)
    }
  }, [])

  const startFlight = (toPos: THREE.Vector3, toTarget: THREE.Vector3, durMs: number) => {
    const controls = controlsRef.current
    if (!controls) return
    flight.current = {
      fromPos: camera.position.clone(),
      fromTarget: controls.target.clone(),
      toPos: toPos.clone(),
      toTarget: toTarget.clone(),
      start: performance.now(),
      durMs,
    }
    window.dispatchEvent(new CustomEvent('aisleland-sfx', { detail: { name: 'whoosh_camera' } }))
  }

  useFrame(() => {
    const controls = controlsRef.current
    if (!controls) return
    const s = useGameStore.getState()

    // --- focus requests (celebrations, double-clicks) ---
    if (s.focusToken !== prevFocusToken.current) {
      prevFocusToken.current = s.focusToken
      if (s.focusTarget) {
        if (!savedView.current) {
          savedView.current = { pos: camera.position.clone(), target: controls.target.clone() }
        }
        scratchTarget.set(s.focusTarget[0], s.focusTarget[1] + 0.6, s.focusTarget[2])
        // keep current azimuth, come in closer and slightly lower
        const azimuth = controls.getAzimuthalAngle()
        sphericalPos(20, 58 * DEG, azimuth, scratchTarget, scratchPos)
        startFlight(scratchPos, scratchTarget, 900)
      } else if (savedView.current) {
        startFlight(savedView.current.pos, savedView.current.target, 800)
        savedView.current = null
      }
    }

    // --- photo mode orbit presets ---
    if (s.photoMode !== prevPhotoMode.current) {
      prevPhotoMode.current = s.photoMode
      if (s.photoMode) {
        const orbit = PHOTO_ORBITS[photoOrbitIndex.current % PHOTO_ORBITS.length]
        photoOrbitIndex.current++
        scratchTarget.set(orbit.target[0], orbit.target[1], orbit.target[2])
        sphericalPos(orbit.radius, orbit.polar, orbit.azimuth, scratchTarget, scratchPos)
        startFlight(scratchPos, scratchTarget, 1200)
      }
    }

    // --- active flight ---
    const f = flight.current
    if (f) {
      const t = Math.min(1, (performance.now() - f.start) / f.durMs)
      const k = easeFly(t)
      camera.position.lerpVectors(f.fromPos, f.toPos, k)
      controls.target.lerpVectors(f.fromTarget, f.toTarget, k)
      controls.update()
      if (t >= 1) flight.current = null
      return
    }

    // --- idle drift (eased in over 2s, off in photo mode / celebrations) ---
    const idleFor = (Date.now() - lastInput.current) / 1000
    const wantDrift = idleFor > CAMERA.idleDriftDelayS && !s.photoMode && !s.celebration
    driftBlend.current = THREE.MathUtils.lerp(driftBlend.current, wantDrift ? 1 : 0, 0.02)
    controls.autoRotate = driftBlend.current > 0.01
    // autoRotateSpeed 2.0 == 30s/orbit; convert rad/s to that scale
    controls.autoRotateSpeed = (CAMERA.idleDriftRadPerS / (Math.PI * 2 / 30) / 2) * 2 * driftBlend.current
    controls.update()
  })

  const photoMode = useGameStore((s) => s.photoMode)

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enablePan={false}
      enableDamping
      dampingFactor={CAMERA.damping}
      minDistance={photoMode ? 10 : CAMERA.minDistance}
      maxDistance={photoMode ? 44 : CAMERA.maxDistance}
      minPolarAngle={photoMode ? 10 * DEG : CAMERA.minPolarDeg * DEG}
      maxPolarAngle={photoMode ? 85 * DEG : CAMERA.maxPolarDeg * DEG}
      target={CAMERA.target}
    />
  )
}
