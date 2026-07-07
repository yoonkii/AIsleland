// The exactly-3-lights rig (docs/GAME_DESIGN.md §3.3): key directional (the
// only shadow caster, 1024 map fit to the island), hemisphere, and a fill
// directional opposite the key. Colors/intensities lerp with time of day.

import { useRef } from 'react'
import type { JSX } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { useGameStore, effectiveTimeOfDay } from '../../state/gameStore'
import { PALETTE } from '../../design/tokens'
import { colorTrack, scalarTrack, sunDirection, moonDirection, daylight } from './skyColors'

// Keyframed light script per VISUAL_PLAYBOOK: warm key over a VIOLET ground
// bounce (lavender daytime shadows, never grey), golden-hour peach, and a
// moonlit blue night key so nothing ever reads as dirty black.
const keyColorTrack = colorTrack([
  [0.0, '#9FB8E8'],
  [0.2, '#9FB8E8'],
  [0.27, '#FFC080'],
  [0.38, '#FFF4DC'],
  [0.62, '#FFF4DC'],
  [0.7, '#FFDEBB'],
  [0.76, '#F0BFB2'],
  [0.82, '#9FB8E8'],
])
const keyIntensityTrack = scalarTrack([
  [0.0, 0.5],
  [0.2, 0.5],
  [0.27, 1.2],
  [0.38, 1.55],
  [0.62, 1.55],
  [0.7, 1.5],
  [0.76, 1.05],
  [0.82, 0.5],
])

const hemiSkyTrack = colorTrack([
  [0.0, '#2E3560'],
  [0.2, '#2E3560'],
  [0.27, '#A8B8E8'],
  [0.38, '#BFE3FF'],
  [0.62, '#BFE3FF'],
  [0.7, '#A8B8E8'],
  [0.76, '#7B6FB8'],
  [0.82, '#2E3560'],
])
const hemiGroundTrack = colorTrack([
  [0.0, '#3A3160'],
  [0.2, '#3A3160'],
  [0.27, '#C97BA0'],
  [0.38, '#B9A6C9'],
  [0.62, '#B9A6C9'],
  [0.7, '#C97BA0'],
  [0.76, '#5A4E8A'],
  [0.82, '#3A3160'],
])
const hemiIntensityTrack = scalarTrack([
  [0.0, 0.38],
  [0.2, 0.38],
  [0.27, 0.52],
  [0.38, 0.55],
  [0.62, 0.55],
  [0.73, 0.62],
  [0.8, 0.42],
])

const fillColorTrack = colorTrack([
  [0.0, PALETTE.skyNightMid],
  [0.2, PALETTE.skyNightMid],
  [0.27, PALETTE.skyDuskTop],
  [0.38, PALETTE.skyDayMid],
  [0.62, PALETTE.skyDayMid],
  [0.73, PALETTE.skyDuskTop],
  [0.8, PALETTE.skyNightMid],
])
const fillIntensityTrack = scalarTrack([
  [0.0, 0.12],
  [0.2, 0.12],
  [0.27, 0.2],
  [0.38, 0.25],
  [0.62, 0.25],
  [0.73, 0.2],
  [0.8, 0.12],
])

const sunScratch = new THREE.Vector3()
const moonScratch = new THREE.Vector3()
const keyDirScratch = new THREE.Vector3()

export function Lights(): JSX.Element {
  const keyRef = useRef<THREE.DirectionalLight>(null)
  const fillRef = useRef<THREE.DirectionalLight>(null)
  const hemiRef = useRef<THREE.HemisphereLight>(null)

  useFrame(() => {
    const t = effectiveTimeOfDay(useGameStore.getState())
    const day = daylight(t)
    const night = 1 - day

    // key follows the sun by day and hands off to the moon at night;
    // blended + elevation-clamped so twilight never flips the shadows hard
    sunDirection(t, sunScratch)
    moonDirection(t, moonScratch)
    keyDirScratch.copy(sunScratch).multiplyScalar(day).addScaledVector(moonScratch, night)
    if (keyDirScratch.lengthSq() < 0.01) keyDirScratch.set(0.4, 0.6, -0.3)
    keyDirScratch.y = Math.max(keyDirScratch.y, 0.28)
    keyDirScratch.normalize()

    const key = keyRef.current
    if (key) {
      key.position.copy(keyDirScratch).multiplyScalar(30)
      keyColorTrack(t, key.color)
      key.intensity = keyIntensityTrack(t)
    }
    const fill = fillRef.current
    if (fill) {
      fill.position.set(-keyDirScratch.x * 26, 12, -keyDirScratch.z * 26)
      fillColorTrack(t, fill.color)
      fill.intensity = fillIntensityTrack(t)
    }
    const hemi = hemiRef.current
    if (hemi) {
      hemiSkyTrack(t, hemi.color)
      hemiGroundTrack(t, hemi.groundColor)
      hemi.intensity = hemiIntensityTrack(t)
    }
  })

  return (
    <>
      <directionalLight
        ref={keyRef}
        position={[14, 24, -10]}
        intensity={1.4}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-left={-15}
        shadow-camera-right={15}
        shadow-camera-top={15}
        shadow-camera-bottom={-15}
        shadow-camera-near={8}
        shadow-camera-far={62}
        shadow-radius={4}
        shadow-normalBias={0.05}
        shadow-intensity={0.6}
      />
      <hemisphereLight ref={hemiRef} args={['#BFE3FF', '#E8C9A0', 0.55]} />
      <directionalLight ref={fillRef} position={[-14, 12, 10]} intensity={0.25} />
    </>
  )
}
