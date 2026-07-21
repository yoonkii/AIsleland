// The island mailbox + owl post (docs/GAME_DESIGN.md §6.1, v1-lite):
// quests arrive physically — an owl swoops in, drops a letter, the flag pops
// up. The flag stays up while quests are waiting; clicking the mailbox opens
// the journal. Rides the island bob (rendered inside World's island group).

import { useEffect, useMemo, useRef, useState } from 'react'
import type { JSX } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { useCursor } from '@react-three/drei'
import { useGameStore } from '../../state/gameStore'
import { mergeParts, type PartSpec } from '../props/geometry'
import { makeMeringue } from '../materials'
import { terrainHeight } from '../coords'

const mat = makeMeringue({ vertexColors: true })
const owlMat = makeMeringue({ color: '#D9C4A8' })
const owlBellyMat = makeMeringue({ color: '#F2E8D5' })
const beakMat = makeMeringue({ color: '#E8A45E' })
const POS_X = -4.2
const POS_Z = 8.6

function box(w: number, h: number, d: number): THREE.BufferGeometry {
  return new THREE.BoxGeometry(w, h, d)
}

function bodyGeometry(): THREE.BufferGeometry {
  const parts: PartSpec[] = [
    // post
    { geo: box(0.14, 1.0, 0.14), color: '#A9744F', colorTop: '#C08A5E', position: [0, 0.5, 0] },
    // box body — coral with a cream face
    { geo: box(0.62, 0.42, 0.46), color: '#C9584E', colorTop: '#E07A6E', position: [0, 1.18, 0] },
    { geo: box(0.5, 0.3, 0.05), color: '#FFF4E0', colorTop: '#FFF9EF', position: [0, 1.17, 0.22] },
    // little roof cap
    { geo: box(0.68, 0.1, 0.52), color: '#8F3F38', colorTop: '#A9544C', position: [0, 1.43, 0] },
  ]
  return mergeParts(parts)
}

function flagGeometry(): THREE.BufferGeometry {
  return mergeParts([
    { geo: box(0.05, 0.34, 0.05), color: '#8F3F38', colorTop: '#A9544C', position: [0, 0.17, 0] },
    { geo: box(0.22, 0.16, 0.04), color: '#E8B33C', colorTop: '#FFD966', position: [0.12, 0.3, 0] },
  ])
}

// --- owl -----------------------------------------------------------------

interface OwlFlight {
  start: number
  phase: 'in' | 'out'
}

const v = new THREE.Vector3()

function bez(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, t: number, out: THREE.Vector3) {
  const u = 1 - t
  return out.set(
    u * u * a.x + 2 * u * t * b.x + t * t * c.x,
    u * u * a.y + 2 * u * t * b.y + t * t * c.y,
    u * u * a.z + 2 * u * t * b.z + t * t * c.z,
  )
}

export function Mailbox(): JSX.Element {
  const bodyGeo = useMemo(() => bodyGeometry(), [])
  const flagGeo = useMemo(() => flagGeometry(), [])
  const flagRef = useRef<THREE.Mesh>(null)
  const owlRef = useRef<THREE.Group>(null)
  const wingL = useRef<THREE.Mesh>(null)
  const wingR = useRef<THREE.Mesh>(null)
  const letterRef = useRef<THREE.Mesh>(null)
  const flight = useRef<OwlFlight | null>(null)
  const flagUp = useRef(0)
  const [hover, setHover] = useState(false)
  useCursor(hover)

  const y = terrainHeight(POS_X, POS_Z)

  // owl flies in whenever a new quest lands
  useEffect(() => {
    let known = new Set(useGameStore.getState().quests.map((q) => q.id))
    return useGameStore.subscribe((s, prev) => {
      if (s.quests === prev.quests) return
      const fresh = s.quests.some((q) => !known.has(q.id))
      known = new Set(s.quests.map((q) => q.id))
      if (fresh && !flight.current) {
        flight.current = { start: performance.now(), phase: 'in' }
        window.dispatchEvent(new CustomEvent('aisleland-sfx', { detail: { name: 'owl_delivery' } }))
      }
    })
  }, [])

  const from = useMemo(() => new THREE.Vector3(POS_X - 24, y + 11, POS_Z - 14), [y])
  const mid = useMemo(() => new THREE.Vector3(POS_X - 7, y + 4.5, POS_Z - 4), [y])
  const at = useMemo(() => new THREE.Vector3(POS_X, y + 2.1, POS_Z), [y])
  const exitMid = useMemo(() => new THREE.Vector3(POS_X + 8, y + 5.5, POS_Z + 4), [y])
  const exit = useMemo(() => new THREE.Vector3(POS_X + 26, y + 13, POS_Z + 11), [y])

  useFrame(({ clock }) => {
    const hasQuests = useGameStore.getState().quests.length > 0

    // flag eases up/down
    flagUp.current = THREE.MathUtils.lerp(flagUp.current, hasQuests ? 1 : 0, 0.06)
    if (flagRef.current) flagRef.current.rotation.z = THREE.MathUtils.lerp(-1.35, 0, flagUp.current)

    // owl flight
    const owl = owlRef.current
    if (!owl) return
    const f = flight.current
    if (!f) {
      owl.visible = false
      if (letterRef.current) letterRef.current.visible = false
      return
    }
    owl.visible = true
    const IN_MS = 2200, HOLD_MS = 500, OUT_MS = 1800
    const t = performance.now() - f.start
    const flap = Math.abs(Math.sin(clock.elapsedTime * 14))
    if (wingL.current) wingL.current.rotation.z = 0.4 + flap * 0.9
    if (wingR.current) wingR.current.rotation.z = -0.4 - flap * 0.9

    if (t < IN_MS) {
      const k = t / IN_MS
      const e = 1 - Math.pow(1 - k, 2.4)
      bez(from, mid, at, e, v)
      owl.position.copy(v)
      owl.rotation.y = Math.atan2(at.x - from.x, at.z - from.z)
    } else if (t < IN_MS + HOLD_MS) {
      owl.position.copy(at)
      // the letter drops into the box
      if (letterRef.current) {
        const lk = (t - IN_MS) / HOLD_MS
        letterRef.current.visible = lk < 0.9
        letterRef.current.position.set(POS_X, y + 2.0 - lk * 0.62, POS_Z)
        letterRef.current.rotation.z = lk * 1.2
      }
    } else if (t < IN_MS + HOLD_MS + OUT_MS) {
      const k = (t - IN_MS - HOLD_MS) / OUT_MS
      bez(at, exitMid, exit, k * k * (3 - 2 * k), v)
      owl.position.copy(v)
      owl.rotation.y = Math.atan2(exit.x - at.x, exit.z - at.z)
      if (letterRef.current) letterRef.current.visible = false
    } else {
      flight.current = null
    }
  })

  const openJournal = (e: { stopPropagation: () => void }) => {
    e.stopPropagation()
    useGameStore.getState().setJournalOpen(true)
    window.dispatchEvent(new CustomEvent('aisleland-sfx', { detail: { name: 'ui_tap' } }))
  }

  return (
    <group>
      <group
        position={[POS_X, y, POS_Z]}
        onClick={openJournal}
        onPointerOver={(e) => { e.stopPropagation(); setHover(true) }}
        onPointerOut={() => setHover(false)}
      >
        <mesh geometry={bodyGeo} material={mat} castShadow />
        <mesh ref={flagRef} geometry={flagGeo} material={mat} position={[0.31, 1.28, 0.12]} rotation-z={-1.35} />
      </group>

      {/* the owl postman — oversized so the moment reads from the hero camera */}
      <group ref={owlRef} visible={false} scale={1.55}>
        <mesh material={owlMat}>
          <sphereGeometry args={[0.3, 12, 10]} />
        </mesh>
        <mesh material={owlBellyMat} position={[0, -0.02, 0.14]} scale={[0.72, 0.8, 0.5]}>
          <sphereGeometry args={[0.26, 10, 8]} />
        </mesh>
        <mesh material={owlMat} position={[0, 0.3, 0.06]}>
          <sphereGeometry args={[0.22, 12, 10]} />
        </mesh>
        {/* face + beak */}
        <mesh position={[-0.08, 0.34, 0.22]}>
          <sphereGeometry args={[0.045, 8, 8]} />
          <meshBasicMaterial color="#3A2E28" />
        </mesh>
        <mesh position={[0.08, 0.34, 0.22]}>
          <sphereGeometry args={[0.045, 8, 8]} />
          <meshBasicMaterial color="#3A2E28" />
        </mesh>
        <mesh material={beakMat} position={[0, 0.27, 0.26]} rotation-x={1.2}>
          <coneGeometry args={[0.05, 0.12, 6]} />
        </mesh>
        <mesh ref={wingL} material={owlMat} position={[-0.26, 0.05, 0]} rotation-z={0.4}>
          <boxGeometry args={[0.4, 0.08, 0.26]} />
        </mesh>
        <mesh ref={wingR} material={owlMat} position={[0.26, 0.05, 0]} rotation-z={-0.4}>
          <boxGeometry args={[0.4, 0.08, 0.26]} />
        </mesh>
      </group>

      {/* the dropped letter */}
      <mesh ref={letterRef} visible={false}>
        <boxGeometry args={[0.26, 0.02, 0.18]} />
        <meshBasicMaterial color="#FFF9EF" />
      </mesh>
    </group>
  )
}
