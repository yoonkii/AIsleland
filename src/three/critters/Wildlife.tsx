// Ambient wildlife — always present, independent of level or unlocks, so the
// island feels alive from the first second: ducks paddling the creek,
// songbirds that fly in and peck around, gulls circling offshore, fish
// jumping from the sea, and bees working the flowers.

import { useMemo, useRef } from 'react'
import type { JSX } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { useGameStore } from '../../state/gameStore'
import { gridToWorld, SURFACE_Y, terrainHeight, VOXEL, WATERFALL_AZIMUTHS } from '../coords'
import { islandBob } from '../islandMotion'
import { makeMeringue } from '../materials'
import { daylight } from '../world/skyColors'

const bodyMat = makeMeringue({ color: '#FBF3DC' })
const headMat = makeMeringue({ color: '#8FBF6B' }) // mallard-green duck head
const billMat = makeMeringue({ color: '#E8A45E' })
const songbirdMats = [
  makeMeringue({ color: '#E8935A' }),
  makeMeringue({ color: '#7EAED4' }),
  makeMeringue({ color: '#D9B4C8' }),
]
const gullMat = makeMeringue({ color: '#F4F1E8' })
const fishMat = makeMeringue({ color: '#7EAED4' })
const beeMat = makeMeringue({ color: '#FFD966' })
const beeStripeMat = makeMeringue({ color: '#3A2E28' })
const wingMat = new THREE.MeshBasicMaterial({ color: '#FFFFFF', transparent: true, opacity: 0.85, side: THREE.DoubleSide })

const v1 = new THREE.Vector3()

// ---------- ducks on the creek ----------

function Duck({ azimuth, phase, speed }: { azimuth: number; phase: number; speed: number }): JSX.Element {
  const ref = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    const g = ref.current
    if (!g) return
    const el = clock.elapsedTime
    // ping-pong along the stream between the pond mouth and the cliff lip
    const t = (Math.sin(el * speed + phase) + 1) / 2 // 0..1
    const r = 6.6 + t * 4.6
    const dirX = Math.sin(azimuth), dirZ = Math.cos(azimuth)
    // little side-to-side paddle wiggle
    const sway = Math.sin(el * 1.7 + phase * 3) * 0.22
    const px = dirX * r + Math.cos(azimuth) * sway
    const pz = dirZ * r - Math.sin(azimuth) * sway
    g.position.set(px, SURFACE_Y - VOXEL + 0.1 + Math.sin(el * 2.1 + phase) * 0.03 + islandBob(el), pz)
    const forward = Math.cos(el * speed + phase) >= 0 ? 1 : -1
    g.rotation.y = Math.atan2(dirX * forward, dirZ * forward)
    // dabble: tail up every now and then
    const dab = Math.max(0, Math.sin(el * 0.31 + phase * 5)) > 0.965
    g.rotation.x = THREE.MathUtils.lerp(g.rotation.x, dab ? 0.8 : 0, 0.08)
  })
  return (
    <group ref={ref} scale={0.62}>
      <mesh material={bodyMat} castShadow>
        <sphereGeometry args={[0.3, 12, 10]} />
      </mesh>
      <mesh material={bodyMat} position={[0, 0.08, -0.26]} rotation-x={-0.5} scale={[0.7, 0.5, 0.8]}>
        <sphereGeometry args={[0.22, 10, 8]} />
      </mesh>
      <mesh material={headMat} position={[0, 0.3, 0.18]}>
        <sphereGeometry args={[0.17, 12, 10]} />
      </mesh>
      <mesh material={billMat} position={[0, 0.27, 0.34]} rotation-x={Math.PI / 2}>
        <coneGeometry args={[0.06, 0.14, 8]} />
      </mesh>
      <mesh position={[-0.07, 0.34, 0.3]}>
        <sphereGeometry args={[0.025, 6, 6]} />
        <meshBasicMaterial color="#3A2E28" />
      </mesh>
      <mesh position={[0.07, 0.34, 0.3]}>
        <sphereGeometry args={[0.025, 6, 6]} />
        <meshBasicMaterial color="#3A2E28" />
      </mesh>
    </group>
  )
}

// ---------- songbirds: fly in, peck, fly on ----------

interface BirdBrain {
  mode: 'fly' | 'ground'
  from: THREE.Vector3
  to: THREE.Vector3
  start: number
  dur: number
  until: number
  heading: number
}

function randomPerchTarget(out: THREE.Vector3): THREE.Vector3 {
  // meadow ring or near the bridge — always on solid ground
  const a = Math.random() * Math.PI * 2
  const r = 4 + Math.random() * 7.5
  const x = Math.cos(a) * r
  const z = Math.sin(a) * r
  return out.set(x, terrainHeight(x, z), z)
}

function Songbird({ tint, seed }: { tint: number; seed: number }): JSX.Element {
  const ref = useRef<THREE.Group>(null)
  const wingL = useRef<THREE.Mesh>(null)
  const wingR = useRef<THREE.Mesh>(null)
  const brain = useRef<BirdBrain>({
    mode: 'ground',
    from: new THREE.Vector3(),
    to: randomPerchTarget(new THREE.Vector3()),
    start: 0,
    dur: 1,
    until: seed * 3 + 4,
    heading: seed * 2,
  })

  useFrame(({ clock }) => {
    const g = ref.current
    const b = brain.current
    if (!g) return
    const el = clock.elapsedTime
    const bob = islandBob(el)

    if (b.mode === 'ground') {
      // peck-hop in place
      const peck = Math.max(0, Math.sin(el * 5 + seed * 7))
      g.position.set(b.to.x, b.to.y + bob + peck * 0.06, b.to.z)
      g.rotation.y = b.heading + Math.sin(el * 0.6 + seed) * 0.5
      g.rotation.x = peck > 0.7 ? 0.5 : 0
      if (wingL.current) wingL.current.rotation.z = 0.2
      if (wingR.current) wingR.current.rotation.z = -0.2
      if (el > b.until) {
        b.mode = 'fly'
        b.from.copy(b.to)
        randomPerchTarget(b.to)
        b.start = el
        b.dur = 2 + Math.random() * 1.5
      }
    } else {
      const k = Math.min(1, (el - b.start) / b.dur)
      const e = k * k * (3 - 2 * k)
      v1.lerpVectors(b.from, b.to, e)
      const arc = Math.sin(k * Math.PI) * (2.2 + seed)
      g.position.set(v1.x, v1.y + arc + bob, v1.z)
      b.heading = Math.atan2(b.to.x - b.from.x, b.to.z - b.from.z)
      g.rotation.y = b.heading
      g.rotation.x = 0
      const flap = Math.sin(el * 26) * 0.9
      if (wingL.current) wingL.current.rotation.z = 0.5 + flap
      if (wingR.current) wingR.current.rotation.z = -0.5 - flap
      if (k >= 1) {
        b.mode = 'ground'
        b.until = el + 4 + Math.random() * 6
      }
    }
  })

  const mat = songbirdMats[tint % songbirdMats.length]
  return (
    <group ref={ref} scale={0.34}>
      <mesh material={mat} castShadow>
        <sphereGeometry args={[0.3, 10, 8]} />
      </mesh>
      <mesh material={mat} position={[0, 0.24, 0.14]}>
        <sphereGeometry args={[0.2, 10, 8]} />
      </mesh>
      <mesh material={billMat} position={[0, 0.22, 0.32]} rotation-x={Math.PI / 2}>
        <coneGeometry args={[0.05, 0.12, 6]} />
      </mesh>
      <mesh position={[-0.08, 0.28, 0.26]}>
        <sphereGeometry args={[0.03, 6, 6]} />
        <meshBasicMaterial color="#3A2E28" />
      </mesh>
      <mesh position={[0.08, 0.28, 0.26]}>
        <sphereGeometry args={[0.03, 6, 6]} />
        <meshBasicMaterial color="#3A2E28" />
      </mesh>
      <mesh ref={wingL} material={mat} position={[-0.24, 0.05, -0.02]}>
        <boxGeometry args={[0.3, 0.05, 0.22]} />
      </mesh>
      <mesh ref={wingR} material={mat} position={[0.24, 0.05, -0.02]}>
        <boxGeometry args={[0.3, 0.05, 0.22]} />
      </mesh>
      <mesh material={mat} position={[0, 0.05, -0.3]} rotation-x={0.4} scale={[0.5, 0.2, 1]}>
        <sphereGeometry args={[0.18, 8, 6]} />
      </mesh>
    </group>
  )
}

// ---------- gulls circling offshore + jumping fish ----------

function GullsAndFish(): JSX.Element {
  const gull1 = useRef<THREE.Group>(null)
  const gull2 = useRef<THREE.Group>(null)
  const gullWings = useRef<Array<THREE.Mesh | null>>([])
  const fish = useRef<THREE.Group>(null)

  useFrame(({ clock }) => {
    const el = clock.elapsedTime
    const day = daylight(useGameStore.getState().timeOverride ?? useGameStore.getState().timeOfDay)

    for (const [g, phase, rr, yy, spd] of [
      [gull1.current, 0, 21, 7.5, 0.09],
      [gull2.current, 2.6, 25, 9.5, -0.07],
    ] as const) {
      if (!g) continue
      g.visible = day > 0.25
      if (!g.visible) continue
      const a = el * spd + phase
      g.position.set(Math.cos(a) * rr, yy + Math.sin(el * 0.7 + phase) * 0.6, Math.sin(a) * rr)
      g.rotation.y = -a - Math.PI / 2 * Math.sign(spd)
      g.rotation.z = 0.25 * Math.sign(spd)
    }
    const soar = Math.sin(el * 5)
    for (let i = 0; i < gullWings.current.length; i++) {
      const w = gullWings.current[i]
      if (w) w.rotation.z = (i % 2 === 0 ? 1 : -1) * (0.15 + Math.max(0, soar) * 0.35)
    }

    // a fish arcs out of the sea every ~9 seconds
    if (fish.current) {
      const CYCLE = 9
      const ft = el % CYCLE
      const active = ft < 1.1
      fish.current.visible = active
      if (active) {
        const k = ft / 1.1
        const which = Math.floor(el / CYCLE)
        const ang = (which * 2.399) % (Math.PI * 2) // golden-angle scatter
        const rr = 17 + (which % 3) * 1.6
        const cx = Math.cos(ang) * rr
        const cz = Math.sin(ang) * rr
        const dir = ang + Math.PI / 2
        const travel = (k - 0.5) * 3
        fish.current.position.set(
          cx + Math.cos(dir) * travel,
          -13.4 + Math.sin(k * Math.PI) * 3.2,
          cz + Math.sin(dir) * travel,
        )
        fish.current.rotation.z = (k - 0.5) * -2.4
        fish.current.rotation.y = -dir
      }
    }
  })

  const gullBody = (
    <>
      <mesh material={gullMat}>
        <sphereGeometry args={[0.26, 10, 8]} />
      </mesh>
      <mesh ref={(m) => { gullWings.current.push(m) }} material={gullMat} position={[-0.4, 0.05, 0]}>
        <boxGeometry args={[0.7, 0.04, 0.2]} />
      </mesh>
      <mesh ref={(m) => { gullWings.current.push(m) }} material={gullMat} position={[0.4, 0.05, 0]}>
        <boxGeometry args={[0.7, 0.04, 0.2]} />
      </mesh>
    </>
  )

  return (
    <group>
      <group ref={gull1} visible={false}>{gullBody}</group>
      <group ref={gull2} visible={false}>{gullBody}</group>
      <group ref={fish} visible={false} scale={0.8}>
        <mesh material={fishMat}>
          <sphereGeometry args={[0.28, 10, 8]} />
        </mesh>
        <mesh material={fishMat} position={[0, 0, -0.32]} rotation-x={Math.PI / 2} scale={[1, 1, 0.4]}>
          <coneGeometry args={[0.18, 0.3, 6]} />
        </mesh>
      </group>
    </group>
  )
}

// ---------- bees around the flowers ----------

function Bees(): JSX.Element {
  const bee1 = useRef<THREE.Group>(null)
  const bee2 = useRef<THREE.Group>(null)

  useFrame(({ clock }) => {
    const el = clock.elapsedTime
    const s = useGameStore.getState()
    const day = daylight(s.timeOverride ?? s.timeOfDay)
    const flowers = s.assets.filter((a) => a.type.startsWith('flower'))
    const bob = islandBob(el)

    for (const [bee, phase, speed] of [[bee1.current, 0, 1.6], [bee2.current, Math.PI, 1.25]] as const) {
      if (!bee) continue
      const show = day > 0.3 && flowers.length > 0
      bee.visible = show
      if (!show) continue
      // each bee works its own flower, switching every ~20s
      const idx = (Math.floor(el / 20) + (phase > 0 ? 1 : 0)) % flowers.length
      const f = flowers[idx]
      const [fx, fz] = gridToWorld(f.gridX, f.gridY)
      const y = terrainHeight(fx, fz)
      const a = el * speed + phase
      bee.position.set(
        fx + Math.cos(a) * 0.4,
        y + 0.55 + Math.sin(el * 7 + phase) * 0.07 + bob,
        fz + Math.sin(a) * 0.4,
      )
      bee.rotation.y = -a + Math.PI / 2
    }
  })

  const beeBody = (
    <>
      <mesh material={beeMat}>
        <sphereGeometry args={[0.07, 8, 6]} />
      </mesh>
      <mesh material={beeStripeMat} position={[0, 0, -0.03]} scale={[1.05, 1.05, 0.4]}>
        <sphereGeometry args={[0.07, 8, 6]} />
      </mesh>
      <mesh material={wingMat} position={[0, 0.07, 0]} rotation-x={-0.3}>
        <planeGeometry args={[0.16, 0.08]} />
      </mesh>
    </>
  )

  return (
    <group>
      <group ref={bee1} visible={false}>{beeBody}</group>
      <group ref={bee2} visible={false}>{beeBody}</group>
    </group>
  )
}

export function Wildlife(): JSX.Element {
  const ducks = useMemo(() => [
    { azimuth: WATERFALL_AZIMUTHS[0], phase: 0.4, speed: 0.16 },
    { azimuth: WATERFALL_AZIMUTHS[1], phase: 2.1, speed: 0.12 },
  ], [])

  return (
    <group>
      {ducks.map((d, i) => <Duck key={i} {...d} />)}
      <Songbird tint={0} seed={0.5} />
      <Songbird tint={1} seed={1.4} />
      <Songbird tint={2} seed={2.3} />
      <GullsAndFish />
      <Bees />
    </group>
  )
}
