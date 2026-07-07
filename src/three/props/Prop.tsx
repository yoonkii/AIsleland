// Module B (props) — a single placed prop: shared geometry + shared material,
// pop-in squash/stretch, hover wobble, click boop, double-click arrange mode,
// idle sway for plants, spinning windmill blades. Zero allocations in useFrame.

import { useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import type { ThreeEvent } from '@react-three/fiber'
import { useCursor } from '@react-three/drei'
import { useGameStore } from '../../state/gameStore'
import { terrainHeight } from '../coords'
import { PALETTE } from '../../design/tokens'
import { easeOutBack } from './geometry'
import { getPropBuild, jitterFor } from './recipes'
import { lampGlowMaterial, propSolidMaterial, windowGlowMaterial } from './propMaterials'

const POP_DURATION_MS = 620
const MAX_BLADE_SPEED = 2.2

function sfx(name: string): void {
  window.dispatchEvent(new CustomEvent('aisleland-sfx', { detail: { name } }))
}

function canInteract(): boolean {
  const s = useGameStore.getState()
  return !s.photoMode && s.arrangingAssetId === null
}

export interface PropProps {
  type: string
  position: [number, number, number]
  plantedAt: number
  id: string
}

export function Prop({ type, position, plantedAt, id }: PropProps) {
  const season = useGameStore((s) => s.island.season)
  const build = useMemo(() => getPropBuild(type, season), [type, season])
  const jitter = useMemo(() => jitterFor(id, type), [id, type])
  const clock = useThree((s) => s.clock)

  const [hovered, setHovered] = useState(false)
  useCursor(hovered)

  const animRef = useRef<THREE.Group>(null)
  const swayRef = useRef<THREE.Group>(null)
  const spinRef = useRef<THREE.Group>(null)
  const hoverStartT = useRef(-1)
  const hoverAmt = useRef(0)
  const boopT = useRef(-1)

  // Deterministic freeform jitter on top of the grid anchor; re-sample the
  // terrain at the jittered spot so the base never floats or sinks.
  const px = position[0] + jitter.dx
  const pz = position[2] + jitter.dz
  const py = position[1] + terrainHeight(px, pz) - terrainHeight(position[0], position[2])


  useFrame((state, delta) => {
    const g = animRef.current
    if (!g) return
    const t = state.clock.elapsedTime

    // --- pop-in: 0 -> ~1.15 overshoot -> 1 with squash & stretch ---
    let s = 1
    let sy = 1
    const age = Date.now() - plantedAt
    if (age < POP_DURATION_MS) {
      const k = Math.max(0, age / POP_DURATION_MS)
      const e = Math.max(0.0001, easeOutBack(k, 2.4))
      const squash = Math.sin(Math.PI * k)
      s = e * (1 - 0.12 * squash)
      sy = e * (1 + 0.24 * squash)
    }

    // --- hover: springy 6% lift + wobble impulse ---
    hoverAmt.current += ((hovered ? 1 : 0) - hoverAmt.current) * Math.min(1, delta * 12)
    const lift = 1 + hoverAmt.current * 0.06
    let wobble = 0
    if (hoverStartT.current >= 0) {
      const ht = t - hoverStartT.current
      if (ht < 1.2) wobble = Math.sin(ht * 16) * Math.exp(-ht * 5) * 0.07
    }

    // --- click boop: squash down, spring back ---
    if (boopT.current >= 0) {
      const bt = t - boopT.current
      if (bt < 0.65) {
        const d = Math.sin(bt * 21) * Math.exp(-bt * 6.5)
        sy *= 1 - 0.22 * d
        s *= 1 + 0.11 * d
      }
    }

    g.scale.set(s * lift, sy * lift, s * lift)
    g.rotation.z = wobble

    // --- idle sway for plants (cheap group rotation) ---
    const sw = swayRef.current
    if (sw && build.swayAmp > 0) {
      const a = build.swayAmp * (1 + hoverAmt.current * 1.6)
      sw.rotation.z = Math.sin(t * build.swayFreq + jitter.phase) * a
      sw.rotation.x = Math.sin(t * build.swayFreq * 0.73 + jitter.phase * 1.7) * a * 0.6
    }

    // --- windmill blades: the island works harder when quests are pending ---
    const spin = spinRef.current
    if (spin && build.spin) {
      const quests = useGameStore.getState().quests
      let active = 0
      for (let i = 0; i < quests.length; i++) if (quests[i].status === 'active') active++
      spin.rotation.z -= delta * Math.min(MAX_BLADE_SPEED, 0.5 + 0.4 * active)
    }
  })

  const onPointerOver = (e: ThreeEvent<PointerEvent>) => {
    if (!canInteract()) return
    e.stopPropagation()
    setHovered(true)
    hoverStartT.current = clock.elapsedTime
  }
  const onPointerOut = () => setHovered(false)
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (!canInteract()) return
    e.stopPropagation()
    boopT.current = clock.elapsedTime
    sfx('boop_squish')
  }
  const onDoubleClick = (e: ThreeEvent<MouseEvent>) => {
    if (!canInteract()) return
    e.stopPropagation()
    setHovered(false)
    useGameStore.getState().setArrangingAssetId(id)
    sfx('ui_tap')
  }

  return (
    <group
      position={[px, py, pz]}
      rotation-y={jitter.rot}
      onPointerOver={onPointerOver}
      onPointerOut={onPointerOut}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
    >
      {/* starts invisible; the first useFrame tick sets the real scale */}
      <group ref={animRef} scale={0.0001}>
        <group ref={swayRef}>
          <mesh geometry={build.solid} material={propSolidMaterial} castShadow />
          {build.glow && (
            <mesh
              geometry={build.glow}
              material={build.glowKind === 'lamp' ? lampGlowMaterial : windowGlowMaterial}
            />
          )}
          {build.spin && (
            <group ref={spinRef} position={build.spinPos}>
              <mesh geometry={build.spin} material={propSolidMaterial} castShadow />
            </group>
          )}
        </group>
      </group>
      <DustPuff bornAt={plantedAt} />
    </group>
  )
}

// ---------------------------------------------------------------------------
// Pop-in dust puff — 8 instanced blob quads radiating out and fading.
// ---------------------------------------------------------------------------

const dustGeo = new THREE.IcosahedronGeometry(0.075, 0)
const _dummy = new THREE.Object3D()
// Shared: simultaneous puffs come from the same planting beat, so a shared
// fade is imperceptible and saves a material per puff.
const dustMaterial = new THREE.MeshBasicMaterial({
  color: PALETTE.dustPuff,
  transparent: true,
  opacity: 0.85,
  depthWrite: false,
})

interface DustSeed { x: number; z: number; spd: number; ph: number }

function DustPuff({ bornAt }: { bornAt: number }) {
  const ref = useRef<THREE.InstancedMesh>(null)

  const seeds = useMemo<DustSeed[]>(() => {
    const arr: DustSeed[] = []
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + 0.4
      arr.push({ x: Math.cos(a), z: Math.sin(a), spd: 0.85 + 0.6 * (((i * 5) % 8) / 8), ph: i * 1.3 })
    }
    return arr
  }, [])

  useFrame(() => {
    const mesh = ref.current
    if (!mesh) return
    // Self-hides once the puff has played (or immediately for old props),
    // so the component can stay mounted without render-time clock reads.
    const k = Math.min(1, Math.max(0, (Date.now() - bornAt) / 750))
    if (k >= 1) {
      if (mesh.visible) mesh.visible = false
      return
    }
    mesh.visible = true
    const fade = 1 - k
    dustMaterial.opacity = 0.85 * fade * fade
    for (let i = 0; i < 8; i++) {
      const sd = seeds[i]
      const r = 0.22 + sd.spd * 0.9 * k
      _dummy.position.set(sd.x * r, 0.08 + k * fade * 1.1, sd.z * r)
      _dummy.scale.setScalar((0.6 + 0.9 * k) * (1 - k * 0.35))
      _dummy.rotation.set(sd.ph, sd.ph * 1.7, k * 3)
      _dummy.updateMatrix()
      mesh.setMatrixAt(i, _dummy.matrix)
    }
    mesh.instanceMatrix.needsUpdate = true
  })

  return <instancedMesh ref={ref} args={[dustGeo, dustMaterial, 8]} frustumCulled={false} />
}
