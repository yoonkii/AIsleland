// Wandering island critters (docs/GAME_DESIGN.md §5): 7 procedural species
// with a tiny FSM — idle → hop-wander → sit → groom — plus blinking, cursor
// curiosity, click reactions with heart emotes, and night sleep.

import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { useGameStore } from '../../state/gameStore'
import type { CritterInstance, CritterSpecies } from '../../state/types'
import { gridToWorld, terrainHeight } from '../coords'
import { islandBob } from '../islandMotion'
import { makeMeringue } from '../materials'
import { daylight } from '../world/skyColors'
import { PALETTE } from '../../design/tokens'

// ---------- species look ----------

interface SpeciesSpec {
  body: string
  belly: string
  ear: 'cone' | 'long' | 'round'
  earColor?: string
  scale: number
  hopHeight: number
  sfx: string
  patch?: string // calico / spot color
}

const SPECIES: Record<CritterSpecies, SpeciesSpec> = {
  'cat': { body: '#F5D9A8', belly: '#FFF6EC', ear: 'cone', scale: 0.9, hopHeight: 0.5, sfx: 'critter_cat' },
  'cat-1': { body: '#F8EFE4', belly: '#FFF9F2', ear: 'cone', scale: 0.9, hopHeight: 0.5, sfx: 'critter_cat', patch: '#E8A45E' },
  'rabbit': { body: '#EDE3D6', belly: '#FFF9F0', ear: 'long', scale: 0.85, hopHeight: 0.75, sfx: 'critter_rabbit' },
  'rabbit-1': { body: '#FFF1DC', belly: '#FFFAF0', ear: 'long', scale: 0.85, hopHeight: 0.75, sfx: 'critter_rabbit', patch: '#D8B48A' },
  'small-dog-1': { body: '#D9B48A', belly: '#F5E8D5', ear: 'round', earColor: '#B98F63', scale: 1.0, hopHeight: 0.45, sfx: 'critter_dog' },
  'hamster-1': { body: '#F2C894', belly: '#FFF3DE', ear: 'round', scale: 0.55, hopHeight: 0.3, sfx: 'critter_hamster' },
  'hamster-2': { body: '#E8E0D5', belly: '#FFFAF2', ear: 'round', scale: 0.55, hopHeight: 0.3, sfx: 'critter_hamster' },
}

// shared material cache — one meringue per unique hue
const matCache = new Map<string, THREE.MeshToonMaterial>()
function critterMat(color: string): THREE.MeshToonMaterial {
  let m = matCache.get(color)
  if (!m) {
    m = makeMeringue({ color })
    matCache.set(color, m)
  }
  return m
}
const eyeMat = new THREE.MeshBasicMaterial({ color: '#3A2E28' })
const shadowMat = new THREE.MeshBasicMaterial({
  color: '#3a2e5c', transparent: true, opacity: 0.28, depthWrite: false,
})

// heart emote sprite (canvas — no asset files)
let heartTexture: THREE.CanvasTexture | null = null
function heartTex(): THREE.CanvasTexture {
  if (!heartTexture) {
    const c = document.createElement('canvas')
    c.width = c.height = 64
    const ctx = c.getContext('2d')!
    ctx.fillStyle = PALETTE.heart
    ctx.beginPath()
    ctx.moveTo(32, 56)
    ctx.bezierCurveTo(2, 34, 8, 8, 32, 22)
    ctx.bezierCurveTo(56, 8, 62, 34, 32, 56)
    ctx.fill()
    heartTexture = new THREE.CanvasTexture(c)
  }
  return heartTexture
}

// ---------- FSM ----------

type Mode = 'idle' | 'wander' | 'sit' | 'groom' | 'sleep' | 'jump'

interface Brain {
  mode: Mode
  until: number       // clock time to leave current mode
  from: THREE.Vector3
  to: THREE.Vector3
  hopStart: number    // start time of current hop
  hopCount: number
  hopsTotal: number
  heading: number
  blinkAt: number
  emoteUntil: number
  jumpStart: number
}

const HOP_S = 0.35
const scratch = new THREE.Vector3()
const scratch2 = new THREE.Vector3()
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
const cursorWorld = new THREE.Vector3()

function newBrain(x: number, z: number): Brain {
  return {
    mode: 'idle', until: 2 + Math.random() * 4,
    from: new THREE.Vector3(x, 0, z), to: new THREE.Vector3(x, 0, z),
    hopStart: 0, hopCount: 0, hopsTotal: 0,
    heading: Math.random() * Math.PI * 2,
    blinkAt: 3 + Math.random() * 4,
    emoteUntil: 0, jumpStart: 0,
  }
}

function pickWanderTarget(brain: Brain, homeX: number, homeZ: number) {
  const a = Math.random() * Math.PI * 2
  const r = 1 + Math.random() * 2.5
  scratch.set(homeX + Math.cos(a) * r, 0, homeZ + Math.sin(a) * r)
  // keep on the island clearing
  const len = Math.hypot(scratch.x, scratch.z)
  if (len > 7.5) scratch.multiplyScalar(7.5 / len)
  brain.from.copy(brain.to)
  brain.to.copy(scratch)
}

function CritterMesh({ critter }: { critter: CritterInstance }) {
  const spec = SPECIES[critter.species] ?? SPECIES['cat']
  const [homeX, homeZ] = gridToWorld(critter.home.x, critter.home.y)
  const root = useRef<THREE.Group>(null)
  const body = useRef<THREE.Group>(null)
  const eyeL = useRef<THREE.Mesh>(null)
  const eyeR = useRef<THREE.Mesh>(null)
  const heart = useRef<THREE.Sprite>(null)
  const brain = useRef<Brain>(newBrain(homeX, homeZ))
  const camera = useThree((s) => s.camera)
  const raycaster = useMemo(() => new THREE.Raycaster(), [])

  useFrame(({ clock, pointer }) => {
    const g = root.current
    const b = brain.current
    if (!g) return
    const el = clock.elapsedTime
    const s = useGameStore.getState()
    const t = s.timeOverride ?? s.timeOfDay
    const day = daylight(t)
    const isNight = day < 0.12

    // --- mode transitions ---
    if (isNight && b.mode !== 'sleep' && b.mode !== 'jump') {
      b.mode = 'sleep'
    } else if (!isNight && b.mode === 'sleep') {
      b.mode = 'idle'
      b.until = el + 2
    }
    if (b.mode !== 'sleep' && b.mode !== 'jump' && el > b.until) {
      if (b.mode === 'wander' && b.hopCount < b.hopsTotal) {
        // keep hopping
      } else if (b.mode === 'idle') {
        b.mode = 'wander'
        b.hopsTotal = 3 + Math.floor(Math.random() * 3)
        b.hopCount = 0
        b.hopStart = el
        pickWanderTarget(b, homeX, homeZ)
      } else if (b.mode === 'wander') {
        b.mode = Math.random() < 0.5 ? 'sit' : 'idle'
        b.until = el + 4 + Math.random() * 6
      } else {
        b.mode = Math.random() < 0.3 ? 'groom' : 'idle'
        b.until = el + 2 + Math.random() * 4
      }
    }

    // --- movement ---
    let y = 0
    let squash = 1
    if (b.mode === 'wander') {
      const hopT = Math.min(1, (el - b.hopStart) / HOP_S)
      scratch.lerpVectors(b.from, b.to, (b.hopCount + hopT) / b.hopsTotal)
      g.position.x = scratch.x
      g.position.z = scratch.z
      y = Math.sin(hopT * Math.PI) * spec.hopHeight
      if (hopT >= 1) {
        b.hopCount++
        b.hopStart = el
        squash = 0.8
        if (b.hopCount >= b.hopsTotal) {
          b.mode = Math.random() < 0.4 ? 'sit' : 'idle'
          b.until = el + 3 + Math.random() * 5
        }
      }
      const dx = b.to.x - b.from.x
      const dz = b.to.z - b.from.z
      if (dx * dx + dz * dz > 0.001) b.heading = Math.atan2(dx, dz)
    } else if (b.mode === 'jump') {
      const jt = Math.min(1, (el - b.jumpStart) / 0.5)
      y = Math.sin(jt * Math.PI) * spec.hopHeight * 1.6
      if (jt >= 1) { b.mode = 'idle'; b.until = el + 2 }
    }

    // --- cursor curiosity: look toward pointer when close ---
    raycaster.setFromCamera(pointer, camera)
    if (raycaster.ray.intersectPlane(groundPlane, cursorWorld)) {
      scratch2.set(cursorWorld.x - g.position.x, 0, cursorWorld.z - g.position.z)
      const dist = scratch2.length()
      if (dist < 2.5 && b.mode !== 'sleep' && b.mode !== 'wander') {
        const want = Math.atan2(scratch2.x, scratch2.z)
        let diff = want - b.heading
        while (diff > Math.PI) diff -= Math.PI * 2
        while (diff < -Math.PI) diff += Math.PI * 2
        b.heading += diff * 0.06
      }
    }

    const groundY = terrainHeight(g.position.x, g.position.z)
    g.position.y = groundY + y + islandBob(el)
    g.rotation.y = b.heading

    // --- body posture / breathing ---
    const bd = body.current
    if (bd) {
      if (b.mode === 'sleep') {
        const breathe = 1 + Math.sin(el * Math.PI * 0.5) * 0.04
        bd.scale.set(1.05, 0.72 * breathe, 1.05)
        bd.rotation.x = 0.35
      } else {
        const breathe = 1 + Math.sin(el * 2.2) * 0.02
        const sitDip = b.mode === 'sit' || b.mode === 'groom' ? 0.88 : 1
        bd.scale.set(squash < 1 ? 1.15 : 1, breathe * sitDip * (squash < 1 ? 0.8 : 1), squash < 1 ? 1.15 : 1)
        bd.rotation.x = b.mode === 'groom' ? Math.sin(el * 6) * 0.15 + 0.2 : 0
      }
    }

    // --- blink ---
    if (el > b.blinkAt) {
      b.blinkAt = el + 3 + Math.random() * 4
    }
    const blinkPhase = b.blinkAt - el
    const eyeScaleY = b.mode === 'sleep' ? 0.08 : (blinkPhase > 0 && blinkPhase < 0.12 ? 0.1 : 1)
    if (eyeL.current) eyeL.current.scale.y = eyeScaleY
    if (eyeR.current) eyeR.current.scale.y = eyeScaleY

    // --- heart emote ---
    if (heart.current) {
      const show = el < b.emoteUntil
      heart.current.visible = show
      if (show) {
        const k = 1 - (b.emoteUntil - el) / 1.4
        heart.current.position.y = 1.3 * spec.scale + k * 0.5
        heart.current.scale.setScalar(0.4 + Math.min(0.15, k * 0.6))
        ;(heart.current.material as THREE.SpriteMaterial).opacity = k > 0.75 ? (1 - k) * 4 : 1
      }
    }
  })

  const onClick = (e: { stopPropagation: () => void }) => {
    e.stopPropagation()
    const b = brain.current
    b.mode = 'jump'
    b.jumpStart = -1 // set next frame relative to clock; use emote timing below
    b.emoteUntil = 0
    // set times on next frame using performance clock offset
    jumpQueue.push(b)
    window.dispatchEvent(new CustomEvent('aisleland-sfx', { detail: { name: spec.sfx } }))
  }

  const s = spec.scale
  return (
    <group
      ref={root}
      onClick={onClick}
      onPointerOver={() => { document.body.style.cursor = 'pointer' }}
      onPointerOut={() => { document.body.style.cursor = 'auto' }}
    >
      {/* blob shadow */}
      <mesh rotation-x={-Math.PI / 2} position-y={0.02}>
        <circleGeometry args={[0.42 * s, 20]} />
        <primitive object={shadowMat} attach="material" />
      </mesh>
      <group ref={body} position-y={0.34 * s}>
        {/* body */}
        <mesh material={critterMat(spec.body)} castShadow>
          <sphereGeometry args={[0.34 * s, 20, 16]} />
        </mesh>
        {/* belly */}
        <mesh material={critterMat(spec.belly)} position={[0, -0.05 * s, 0.16 * s]} scale={[0.72, 0.6, 0.5]}>
          <sphereGeometry args={[0.3 * s, 16, 12]} />
        </mesh>
        {/* head */}
        <group position={[0, 0.42 * s, 0.06 * s]}>
          <mesh material={critterMat(spec.body)} castShadow>
            <sphereGeometry args={[0.28 * s, 20, 16]} />
          </mesh>
          {spec.patch && (
            <mesh material={critterMat(spec.patch)} position={[0.12 * s, 0.14 * s, 0.1 * s]} scale={[0.5, 0.35, 0.5]}>
              <sphereGeometry args={[0.28 * s, 12, 8]} />
            </mesh>
          )}
          {/* eyes */}
          <mesh ref={eyeL} material={eyeMat} position={[-0.1 * s, 0.03 * s, 0.24 * s]}>
            <sphereGeometry args={[0.035 * s, 8, 8]} />
          </mesh>
          <mesh ref={eyeR} material={eyeMat} position={[0.1 * s, 0.03 * s, 0.24 * s]}>
            <sphereGeometry args={[0.035 * s, 8, 8]} />
          </mesh>
          {/* nose */}
          <mesh material={critterMat('#C98A80')} position={[0, -0.05 * s, 0.27 * s]}>
            <sphereGeometry args={[0.028 * s, 8, 8]} />
          </mesh>
          {/* ears */}
          {spec.ear === 'cone' && (
            <>
              <mesh material={critterMat(spec.body)} position={[-0.15 * s, 0.24 * s, 0]} rotation-z={0.25}>
                <coneGeometry args={[0.09 * s, 0.18 * s, 8]} />
              </mesh>
              <mesh material={critterMat(spec.patch ?? spec.body)} position={[0.15 * s, 0.24 * s, 0]} rotation-z={-0.25}>
                <coneGeometry args={[0.09 * s, 0.18 * s, 8]} />
              </mesh>
            </>
          )}
          {spec.ear === 'long' && (
            <>
              <mesh material={critterMat(spec.body)} position={[-0.11 * s, 0.34 * s, -0.02 * s]} rotation-z={0.15} scale={[0.5, 1.6, 0.7]}>
                <sphereGeometry args={[0.11 * s, 10, 10]} />
              </mesh>
              <mesh material={critterMat(spec.patch ?? spec.body)} position={[0.11 * s, 0.34 * s, -0.02 * s]} rotation-z={-0.15} scale={[0.5, 1.6, 0.7]}>
                <sphereGeometry args={[0.11 * s, 10, 10]} />
              </mesh>
            </>
          )}
          {spec.ear === 'round' && (
            <>
              <mesh material={critterMat(spec.earColor ?? spec.body)} position={[-0.16 * s, 0.2 * s, 0]} scale={[1, 1, 0.5]}>
                <sphereGeometry args={[0.1 * s, 10, 10]} />
              </mesh>
              <mesh material={critterMat(spec.earColor ?? spec.body)} position={[0.16 * s, 0.2 * s, 0]} scale={[1, 1, 0.5]}>
                <sphereGeometry args={[0.1 * s, 10, 10]} />
              </mesh>
            </>
          )}
        </group>
        {/* tail */}
        <mesh material={critterMat(spec.belly)} position={[0, 0.05 * s, -0.32 * s]}>
          <sphereGeometry args={[0.1 * s, 10, 10]} />
        </mesh>
      </group>
      <sprite ref={heart} visible={false} position-y={1.3 * s}>
        <spriteMaterial map={heartTex()} transparent depthWrite={false} />
      </sprite>
    </group>
  )
}

// Click handlers can't read the r3f clock, so jumps are armed here and
// stamped with clock time on the next frame by <Critters>.
const jumpQueue: Brain[] = []

export function Critters() {
  const critters = useGameStore((s) => s.critters)

  useFrame(({ clock }) => {
    while (jumpQueue.length > 0) {
      const b = jumpQueue.pop()!
      b.jumpStart = clock.elapsedTime
      b.emoteUntil = clock.elapsedTime + 1.4
    }
  })

  return (
    <group>
      {critters.map((c) => <CritterMesh key={c.id} critter={c} />)}
    </group>
  )
}
