/* eslint-disable react-hooks/immutability, react-hooks/purity --
   Imperative three.js FX conductor: pooled particle buffers and timeline state
   are deliberately mutated outside React state (per-frame, allocation-free). */
// The celebration conductor (docs/GAME_DESIGN.md §6): watches the store's
// celebration queue and choreographs the Bloom Burst (quest) and Island
// Ascension (level-up) timelines — camera, particles, rings, XP motes, SFX.
// Every FX mesh is created once and pooled; nothing allocates during play.

import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { useFrame, useThree } from '@react-three/fiber'
import { CELEBRATION_COLORS, PALETTE } from '../../design/tokens'
import { useGameStore } from '../../state/gameStore'
import type { CelebrationEvent } from '../../state/types'
import { gridToWorld, terrainHeight } from '../coords'
import { islandBob } from '../islandMotion'
import { jitterFor } from '../props/recipes'
import { daylight } from '../world/skyColors'

const QUEST_MS = 3200
const LEVELUP_MS = 4500
const RAIN_MS = 4200
const CONFETTI_N = 40
const DUST_N = 12
const MOTE_N = 5
const RAIN_N = 240

function sfx(name: string) {
  window.dispatchEvent(new CustomEvent('aisleland-sfx', { detail: { name } }))
}

interface Active {
  ev: CelebrationEvent
  start: number
  target: THREE.Vector3
  source: string
  bellsPlayed: number
  popPlayed: boolean
  motesPlayed: boolean[]
  returned: boolean
}

// ---------- shared scratch ----------
const v1 = new THREE.Vector3()
const v2 = new THREE.Vector3()
const quat = new THREE.Quaternion()
const mat4 = new THREE.Matrix4()
const scl = new THREE.Vector3()
const col = new THREE.Color()
const eul = new THREE.Euler()

function bezier(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, t: number, out: THREE.Vector3) {
  const u = 1 - t
  out.set(
    u * u * a.x + 2 * u * t * b.x + t * t * c.x,
    u * u * a.y + 2 * u * t * b.y + t * t * c.y,
    u * u * a.z + 2 * u * t * b.z + t * t * c.z,
  )
  return out
}

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)
const easeInQuad = (t: number) => t * t

export function CelebrationDirector() {
  const camera = useThree((s) => s.camera)
  const active = useRef<Active | null>(null)
  const root = useRef<THREE.Group>(null)

  // ---------- pooled FX objects ----------
  const confetti = useRef<THREE.InstancedMesh>(null)
  const confettiVel = useMemo(() => new Float32Array(CONFETTI_N * 3), [])
  const confettiSpin = useMemo(() => new Float32Array(CONFETTI_N * 2), [])
  const dust = useRef<THREE.InstancedMesh>(null)
  const dustVel = useMemo(() => new Float32Array(DUST_N * 3), [])
  const ring = useRef<THREE.Mesh>(null)
  const shock1 = useRef<THREE.Mesh>(null)
  const shock2 = useRef<THREE.Mesh>(null)
  const shock3 = useRef<THREE.Mesh>(null)
  const motes = useRef<Array<THREE.Mesh | null>>([])
  const moteFrom = useMemo(() => Array.from({ length: MOTE_N }, () => new THREE.Vector3()), [])
  const moteTo = useMemo(() => Array.from({ length: MOTE_N }, () => new THREE.Vector3()), [])
  const moteMid = useMemo(() => Array.from({ length: MOTE_N }, () => new THREE.Vector3()), [])
  const rain = useRef<THREE.InstancedMesh>(null)
  const rainbow = useRef<THREE.Mesh>(null)
  const rainSeeds = useMemo(() => {
    // deterministic scatter over the island top
    const arr = new Float32Array(RAIN_N * 3)
    let h = 1779033703
    const rnd = () => {
      h = Math.imul(h ^ (h >>> 16), 2246822507)
      return ((h >>> 0) % 10000) / 10000
    }
    for (let i = 0; i < RAIN_N; i++) {
      const a = rnd() * Math.PI * 2
      const r = Math.sqrt(rnd()) * 11.5
      arr[i * 3] = Math.cos(a) * r
      arr[i * 3 + 1] = Math.sin(a) * r
      arr[i * 3 + 2] = rnd() // phase
    }
    return arr
  }, [])
  // delivery props
  const plane = useRef<THREE.Mesh>(null)
  const drop = useRef<THREE.Mesh>(null)
  const splash = useRef<THREE.Mesh>(null)
  const cone = useRef<THREE.Mesh>(null)
  const domino = useRef<THREE.InstancedMesh>(null)

  const geo = useMemo(() => ({
    confetti: new THREE.CircleGeometry(0.13, 3),
    dust: new THREE.CircleGeometry(0.22, 12),
    ring: new THREE.TorusGeometry(1, 0.09, 8, 40),
    mote: new THREE.SphereGeometry(0.13, 8, 8),
    plane: paperPlaneGeometry(),
    drop: new THREE.IcosahedronGeometry(0.22, 1),
    splash: new THREE.CircleGeometry(0.6, 24),
    cone: new THREE.ConeGeometry(1.4, 5, 24, 1, true),
    domino: new THREE.PlaneGeometry(0.9, 0.9),
    rain: new THREE.PlaneGeometry(0.035, 0.55),
    rainbow: rainbowGeometry(),
  }), [])

  const mats = useMemo(() => ({
    confetti: new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }),
    dust: new THREE.MeshBasicMaterial({ color: PALETTE.dustPuff, transparent: true, depthWrite: false, map: softDiscTexture() }),
    ring: new THREE.MeshBasicMaterial({ color: PALETTE.groundRing, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
    shock: new THREE.MeshBasicMaterial({ color: PALETTE.shockwave, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
    mote: new THREE.MeshBasicMaterial({ color: PALETTE.xpMote, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
    plane: new THREE.MeshBasicMaterial({ color: '#FFF9EF', side: THREE.DoubleSide }),
    planeStripe: new THREE.MeshBasicMaterial({ color: PALETTE.heart }),
    drop: new THREE.MeshBasicMaterial({ color: '#7EA8F8' }),
    splash: new THREE.MeshBasicMaterial({ color: '#7EA8F8', transparent: true, depthWrite: false }),
    cone: new THREE.MeshBasicMaterial({ color: '#FFF6D8', transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
    domino: new THREE.MeshBasicMaterial({ color: PALETTE.grassHi, transparent: true, side: THREE.DoubleSide, depthWrite: false }),
    rain: new THREE.MeshBasicMaterial({ color: PALETTE.rain, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide }),
    // normal blending — additive washes the pastel bands to white against the sky
    rainbow: new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }),
  }), [])

  function hideAll() {
    for (const m of [confetti.current, dust.current, ring.current, shock1.current, shock2.current, shock3.current,
      plane.current, drop.current, splash.current, cone.current, domino.current, rain.current, rainbow.current,
      ...motes.current]) {
      if (m) m.visible = false
    }
  }

  function targetFor(ev: CelebrationEvent): THREE.Vector3 {
    const s = useGameStore.getState()
    if (ev.kind === 'quest') {
      if (ev.rewardAssetId) {
        const a = s.assets.find((x) => x.id === ev.rewardAssetId)
        if (a) {
          const [x, z] = gridToWorld(a.gridX, a.gridY)
          const j = jitterFor(a.id, a.type)
          return new THREE.Vector3(x + j.dx, terrainHeight(x + j.dx, z + j.dz), z + j.dz)
        }
      }
      if (ev.rewardCritterId) {
        const c = s.critters.find((x) => x.id === ev.rewardCritterId)
        if (c) {
          const [x, z] = gridToWorld(c.home.x, c.home.y)
          return new THREE.Vector3(x, terrainHeight(x, z), z)
        }
      }
    }
    return new THREE.Vector3(0, terrainHeight(0, 0), 0)
  }

  function begin(ev: CelebrationEvent) {
    const target = targetFor(ev)
    active.current = {
      ev, start: performance.now(), target,
      source: ev.kind === 'quest' ? ev.quest.source : 'levelup',
      bellsPlayed: 0, popPlayed: false,
      motesPlayed: Array.from({ length: MOTE_N }, () => false),
      returned: false,
    }
    if (ev.kind === 'quest') useGameStore.getState().requestFocus([target.x, target.y, target.z])
    else if (ev.kind === 'levelup') useGameStore.getState().requestFocus([0, 1.0, 0])
    sfx(ev.kind === 'quest' ? 'quest_complete' : ev.kind === 'levelup' ? 'levelup' : 'streak_fire')

    // seed particle bursts
    for (let i = 0; i < CONFETTI_N; i++) {
      const a = Math.random() * Math.PI * 2
      const r = 1.2 + Math.random() * 2.2
      confettiVel[i * 3] = Math.cos(a) * r
      confettiVel[i * 3 + 1] = 2.6 + Math.random() * 2.6
      confettiVel[i * 3 + 2] = Math.sin(a) * r
      confettiSpin[i * 2] = 4 + Math.random() * 4
      confettiSpin[i * 2 + 1] = Math.random() * Math.PI * 2
      if (confetti.current) {
        col.set(ev.kind === 'levelup'
          ? (i % 2 ? PALETTE.rainGold : PALETTE.shockwave)
          : CELEBRATION_COLORS[i % CELEBRATION_COLORS.length])
        confetti.current.setColorAt(i, col)
      }
    }
    if (confetti.current?.instanceColor) confetti.current.instanceColor.needsUpdate = true
    for (let i = 0; i < DUST_N; i++) {
      const a = (i / DUST_N) * Math.PI * 2
      const sp = 1.5 + Math.random()
      dustVel[i * 3] = Math.cos(a) * sp
      dustVel[i * 3 + 1] = 0.6 + Math.random() * 0.5
      dustVel[i * 3 + 2] = Math.sin(a) * sp
    }
    // XP motes fly from the reward to the rune ring at the island base
    for (let i = 0; i < MOTE_N; i++) {
      moteFrom[i].copy(target).add(v1.set((Math.random() - 0.5) * 0.5, 0.4, (Math.random() - 0.5) * 0.5))
      v1.copy(target).setY(0)
      if (v1.lengthSq() < 0.01) v1.set(1, 0, 0)
      v1.normalize().multiplyScalar(13.4)
      moteTo[i].set(v1.x, -1.15, v1.z)
      moteMid[i].lerpVectors(moteFrom[i], moteTo[i], 0.5).add(v2.set(0, 2.5 + i * 0.3, 0))
    }
  }

  useFrame((_, dt) => {
    const s = useGameStore.getState()
    if (!active.current) {
      hideAll()
      if (!s.celebration && s.celebrationQueue.length > 0) {
        const ev = s.startNextCelebration()
        if (ev) begin(ev)
      } else if (s.celebration) {
        begin(s.celebration)
      }
      return
    }

    const a = active.current
    const t = performance.now() - a.start
    const total = a.ev.kind === 'quest' ? QUEST_MS : a.ev.kind === 'levelup' ? LEVELUP_MS : RAIN_MS
    if (root.current) root.current.position.y = islandBob(performance.now() / 1000)

    if (a.ev.kind === 'quest') {
      runDelivery(a, t)
      runLanding(a, t)
      if (t > 2400 && !a.returned) { a.returned = true; s.requestFocus(null) }
    } else if (a.ev.kind === 'levelup') {
      runLevelup(a, t, dt)
      if (t > 3600 && !a.returned) { a.returned = true; s.requestFocus(null) }
    } else {
      runRain(t)
    }

    if (t > total) {
      active.current = null
      hideAll()
      s.endCelebration()
    }
  })

  // ---------- quest: phase A, source-flavored delivery (0-900ms) ----------
  function runDelivery(a: Active, t: number) {
    const k = THREE.MathUtils.clamp(t / 900, 0, 1)
    const tgt = a.target

    if (a.source === 'gmail' && plane.current) {
      plane.current.visible = k < 1
      // fly in from camera-left, one barrel roll, dive to target
      v1.set(-30, 14, -10).add(tgt)
      v2.set(-8, 7, 2).add(tgt)
      bezier(v1, v2, tgt, easeOutCubic(k), plane.current.position)
      plane.current.rotation.set(k * Math.PI * 0.4, Math.atan2(tgt.x - v1.x, tgt.z - v1.z), k * Math.PI * 2)
    } else if (a.source === 'docs' && drop.current && splash.current) {
      const fall = THREE.MathUtils.clamp(t / 500, 0, 1)
      drop.current.visible = fall < 1
      drop.current.position.set(tgt.x, tgt.y + 12 * (1 - easeInQuad(fall)), tgt.z)
      const sp = THREE.MathUtils.clamp((t - 500) / 350, 0, 1)
      splash.current.visible = t >= 500 && sp < 1
      splash.current.position.set(tgt.x, tgt.y + 0.03, tgt.z)
      splash.current.rotation.x = -Math.PI / 2
      const scale = sp < 0.7 ? (sp / 0.7) * 1.4 : 1.4 - ((sp - 0.7) / 0.3) * 0.4
      splash.current.scale.setScalar(Math.max(0.001, scale))
      ;(splash.current.material as THREE.MeshBasicMaterial).opacity = 1 - sp
    } else if (a.source === 'slides' && cone.current) {
      cone.current.visible = k < 1
      cone.current.position.set(tgt.x, tgt.y + 2.5, tgt.z)
      cone.current.scale.set(easeOutCubic(Math.min(1, k * 2.2)), 1, easeOutCubic(Math.min(1, k * 2.2)))
      ;(cone.current.material as THREE.MeshBasicMaterial).opacity = 0.28 * (1 - Math.max(0, (k - 0.7) / 0.3))
    } else if (a.source === 'calendar' && cone.current) {
      cone.current.visible = k < 1
      cone.current.position.set(tgt.x, tgt.y + 2.5, tgt.z)
      cone.current.scale.set(1, 1, 1)
      ;(cone.current.material as THREE.MeshBasicMaterial).opacity = 0.35 * (1 - k)
      const bellAt = [0, 180, 360]
      while (a.bellsPlayed < 3 && t >= bellAt[a.bellsPlayed]) {
        if (a.bellsPlayed === 0) sfx('calendar_bells')
        a.bellsPlayed++
      }
    } else if (a.source === 'sheets' && domino.current) {
      domino.current.visible = k < 1
      for (let i = 0; i < 5; i++) {
        const dk = THREE.MathUtils.clamp((t - i * 90) / 350, 0, 1)
        const d = 4 - i * 0.8
        v1.set(tgt.x - d, tgt.y + 0.05, tgt.z)
        quat.setFromEuler(eul.set(-Math.PI / 2 + easeOutCubic(dk) * Math.PI, 0, 0))
        scl.setScalar(dk > 0 && dk < 1 ? 1 : 0.001)
        mat4.compose(v1, quat, scl)
        domino.current.setMatrixAt(i, mat4)
      }
      domino.current.count = 5
      domino.current.instanceMatrix.needsUpdate = true
    }
  }

  // ---------- quest: phase B, shared landing (900ms+) ----------
  function runLanding(a: Active, t: number) {
    const tgt = a.target
    // ground ring 900-1250
    if (ring.current) {
      const rk = THREE.MathUtils.clamp((t - 900) / 350, 0, 1)
      ring.current.visible = rk > 0 && rk < 1
      ring.current.position.set(tgt.x, tgt.y + 0.06, tgt.z)
      ring.current.rotation.x = -Math.PI / 2
      ring.current.scale.setScalar(Math.max(0.001, easeOutCubic(rk) * 2.4))
      mats.ring.opacity = 0.9 * (1 - rk)
    }
    if (!a.popPlayed && t >= 1020) { a.popPlayed = true; sfx('pop_spawn') }
    // dust 980-1580
    if (dust.current) {
      const dk = THREE.MathUtils.clamp((t - 980) / 600, 0, 1)
      dust.current.visible = dk > 0 && dk < 1
      if (dust.current.visible) {
        for (let i = 0; i < DUST_N; i++) {
          v1.set(
            tgt.x + dustVel[i * 3] * dk * 1.4,
            tgt.y + 0.2 + dustVel[i * 3 + 1] * dk - 1.5 * dk * dk,
            tgt.z + dustVel[i * 3 + 2] * dk * 1.4,
          )
          quat.copy(camera.quaternion)
          scl.setScalar(0.6 + dk)
          mat4.compose(v1, quat, scl)
          dust.current.setMatrixAt(i, mat4)
        }
        dust.current.instanceMatrix.needsUpdate = true
        mats.dust.opacity = 0.55 * (1 - dk)
      }
    }
    // confetti 1100-2300
    runConfetti(tgt, t - 1100, 1200)
    // XP motes 1150+, 60ms stagger, 700ms each
    for (let i = 0; i < MOTE_N; i++) {
      const m = motes.current[i]
      if (!m) continue
      const mk = THREE.MathUtils.clamp((t - 1150 - i * 60) / 700, 0, 1)
      m.visible = mk > 0 && mk < 1
      if (m.visible) bezier(moteFrom[i], moteMid[i], moteTo[i], mk, m.position)
      if (mk >= 1 && !a.motesPlayed[i]) { a.motesPlayed[i] = true; sfx('xp_tick') }
    }
  }

  function runConfetti(origin: THREE.Vector3, tMs: number, lifeMs: number) {
    if (!confetti.current) return
    const ck = tMs / lifeMs
    confetti.current.visible = ck > 0 && ck < 1
    if (!confetti.current.visible) return
    const tS = tMs / 1000
    for (let i = 0; i < CONFETTI_N; i++) {
      v1.set(
        origin.x + confettiVel[i * 3] * tS,
        origin.y + 0.4 + confettiVel[i * 3 + 1] * tS - 4.5 * tS * tS,
        origin.z + confettiVel[i * 3 + 2] * tS,
      )
      quat.setFromEuler(eul.set(
        confettiSpin[i * 2] * tS + confettiSpin[i * 2 + 1],
        confettiSpin[i * 2] * tS * 0.7,
        confettiSpin[i * 2 + 1],
      ))
      scl.setScalar(1 - ck * 0.3)
      mat4.compose(v1, quat, scl)
      confetti.current.setMatrixAt(i, mat4)
    }
    confetti.current.instanceMatrix.needsUpdate = true
  }

  // ---------- morning rain ritual: shower + double rainbow ----------
  function runRain(t: number) {
    const camYaw = Math.atan2(camera.position.x, camera.position.z)
    if (rain.current) {
      rain.current.visible = true
      const fadeIn = Math.min(1, t / 400)
      const fadeOut = 1 - THREE.MathUtils.clamp((t - (RAIN_MS - 900)) / 900, 0, 1)
      mats.rain.opacity = 0.5 * fadeIn * fadeOut
      const tS = t / 1000
      for (let i = 0; i < RAIN_N; i++) {
        const x = rainSeeds[i * 3], z = rainSeeds[i * 3 + 1], ph = rainSeeds[i * 3 + 2]
        const yy = 8.5 - ((tS * 12 + ph * 8.5) % 8.5)
        v1.set(x, yy, z)
        quat.setFromEuler(eul.set(0, camYaw, 0.1))
        scl.setScalar(1)
        mat4.compose(v1, quat, scl)
        rain.current.setMatrixAt(i, mat4)
      }
      rain.current.instanceMatrix.needsUpdate = true
    }
    if (rainbow.current) {
      const inK = THREE.MathUtils.clamp((t - 1500) / 1000, 0, 1)
      const outK = THREE.MathUtils.clamp((t - (RAIN_MS - 700)) / 700, 0, 1)
      const op = 0.72 * inK * (1 - outK)
      rainbow.current.visible = op > 0.01
      mats.rainbow.opacity = op
      rainbow.current.position.set(0, 0.4, 0)
      rainbow.current.rotation.y = camYaw
      const grow = 0.86 + 0.14 * (1 - Math.pow(1 - inK, 3))
      rainbow.current.scale.setScalar(grow)
    }
  }

  // ---------- level-up: Island Ascension (camera quake + shockwaves) ----------
  function runLevelup(a: Active, t: number, dt: number) {
    void dt
    // camera shake 400-900ms
    if (t > 400 && t < 900) {
      const decay = 1 - (t - 400) / 500
      camera.position.x += (Math.random() - 0.5) * 0.15 * decay
      camera.position.y += (Math.random() - 0.5) * 0.12 * decay
    }
    const shocks = [shock1.current, shock2.current, shock3.current]
    const starts = [600, 750, 900]
    for (let i = 0; i < 3; i++) {
      const sm = shocks[i]
      if (!sm) continue
      const sk = THREE.MathUtils.clamp((t - starts[i]) / 500, 0, 1)
      sm.visible = sk > 0 && sk < 1
      if (sm.visible) {
        sm.position.set(0, terrainHeight(0, 0) + 0.15, 0)
        sm.rotation.x = -Math.PI / 2
        sm.scale.setScalar(Math.max(0.001, easeOutCubic(sk) * 12))
        ;(sm.material as THREE.MeshBasicMaterial).opacity = 0.7 * (1 - sk)
      }
    }
    runConfetti(a.target, t - 1000, 1600)
  }

  return (
    <group ref={root}>
      <instancedMesh ref={confetti} args={[geo.confetti, mats.confetti, CONFETTI_N]} visible={false} frustumCulled={false} />
      <instancedMesh ref={dust} args={[geo.dust, mats.dust, DUST_N]} visible={false} frustumCulled={false} />
      <instancedMesh ref={domino} args={[geo.domino, mats.domino, 5]} visible={false} frustumCulled={false} />
      <mesh ref={ring} geometry={geo.ring} material={mats.ring} visible={false} frustumCulled={false} />
      <mesh ref={shock1} geometry={geo.ring} material={mats.shock.clone()} visible={false} frustumCulled={false} />
      <mesh ref={shock2} geometry={geo.ring} material={mats.shock.clone()} visible={false} frustumCulled={false} />
      <mesh ref={shock3} geometry={geo.ring} material={mats.shock.clone()} visible={false} frustumCulled={false} />
      {Array.from({ length: MOTE_N }, (_, i) => (
        <mesh
          key={i}
          ref={(m) => { motes.current[i] = m }}
          geometry={geo.mote}
          material={mats.mote}
          visible={false}
          frustumCulled={false}
        />
      ))}
      <mesh ref={plane} geometry={geo.plane} material={mats.plane} visible={false} frustumCulled={false} />
      <mesh ref={drop} geometry={geo.drop} material={mats.drop} visible={false} frustumCulled={false} />
      <mesh ref={splash} geometry={geo.splash} material={mats.splash} visible={false} frustumCulled={false} />
      <mesh ref={cone} geometry={geo.cone} material={mats.cone} visible={false} frustumCulled={false} />
      <instancedMesh ref={rain} args={[geo.rain, mats.rain, RAIN_N]} visible={false} frustumCulled={false} />
      <mesh ref={rainbow} geometry={geo.rainbow} material={mats.rainbow} visible={false} frustumCulled={false} />
    </group>
  )
}

/** Five nested pastel arcs merged into one vertex-colored half-torus fan. */
function rainbowGeometry(): THREE.BufferGeometry {
  const bands = [...CELEBRATION_COLORS]
  const parts: THREE.BufferGeometry[] = []
  const c = new THREE.Color()
  for (let i = 0; i < bands.length; i++) {
    const g = new THREE.TorusGeometry(9.0 - i * 0.3, 0.15, 6, 48, Math.PI).toNonIndexed()
    c.set(bands[i])
    const n = g.attributes.position.count
    const col = new Float32Array(n * 3)
    for (let j = 0; j < n; j++) {
      col[j * 3] = c.r
      col[j * 3 + 1] = c.g
      col[j * 3 + 2] = c.b
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3))
    g.deleteAttribute('uv')
    parts.push(g)
  }
  const merged = mergeGeometries(parts, false)
  for (const p of parts) p.dispose()
  return merged ?? new THREE.BufferGeometry()
}

let softDisc: THREE.CanvasTexture | null = null
function softDiscTexture(): THREE.CanvasTexture {
  if (!softDisc) {
    const c = document.createElement('canvas')
    c.width = c.height = 64
    const ctx = c.getContext('2d')!
    const g = ctx.createRadialGradient(32, 32, 4, 32, 32, 32)
    g.addColorStop(0, 'rgba(255,255,255,1)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 64, 64)
    softDisc = new THREE.CanvasTexture(c)
  }
  return softDisc
}

function paperPlaneGeometry(): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry()
  // two swept-back triangles + a body fold
  const verts = new Float32Array([
    0, 0, 0.5, -0.45, 0.05, -0.4, 0, 0.02, -0.25,
    0, 0, 0.5, 0, 0.02, -0.25, 0.45, 0.05, -0.4,
    0, 0, 0.5, 0, -0.12, -0.3, 0, 0.02, -0.25,
  ])
  g.setAttribute('position', new THREE.BufferAttribute(verts, 3))
  g.computeVertexNormals()
  g.scale(1.4, 1.4, 1.4)
  return g
}

// ---------- ambient atmosphere: pollen, butterflies, balloon, shooting star ----------

const POLLEN_N = 36
const BALLOON_PERIOD_S = 240 // one crossing every ~4 minutes of daytime
const STAR_PERIOD_S = 110

const balloonBodyMat = new THREE.MeshToonMaterial({ color: PALETTE.heart })
const balloonStripeMat = new THREE.MeshToonMaterial({ color: '#FFF6A5' })
const balloonBasketMat = new THREE.MeshToonMaterial({ color: '#A9744F' })
const starMat = new THREE.MeshBasicMaterial({
  color: '#FFF9E5', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
})

export function AmbientFX() {
  const pollen = useRef<THREE.InstancedMesh>(null)
  const wingL = useRef<THREE.Mesh>(null)
  const wingR = useRef<THREE.Mesh>(null)
  const wingL2 = useRef<THREE.Mesh>(null)
  const wingR2 = useRef<THREE.Mesh>(null)
  const fly1 = useRef<THREE.Group>(null)
  const fly2 = useRef<THREE.Group>(null)
  const balloon = useRef<THREE.Group>(null)
  const star = useRef<THREE.Group>(null)
  const wished = useRef(-1)
  const starBurst = useRef<THREE.Mesh>(null)
  const burstAt = useRef(-1)
  const burstPending = useRef(false)

  const seeds = useMemo(() => {
    const arr: Array<{ x: number; y: number; z: number; ph: number; sp: number }> = []
    for (let i = 0; i < POLLEN_N; i++) {
      const a = Math.random() * Math.PI * 2
      const r = Math.sqrt(Math.random()) * 11
      arr.push({
        x: Math.cos(a) * r,
        y: 0.6 + Math.random() * 3.4,
        z: Math.sin(a) * r,
        ph: Math.random() * Math.PI * 2,
        sp: 0.4 + Math.random() * 0.7,
      })
    }
    return arr
  }, [])

  const pollenGeo = useMemo(() => new THREE.CircleGeometry(0.035, 8), [])
  const pollenMat = useMemo(() => new THREE.MeshBasicMaterial({
    color: PALETTE.sparkle, transparent: true, opacity: 0.3, map: softDiscTexture(),
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  }), [])
  const wingGeo = useMemo(() => {
    const g = new THREE.CircleGeometry(0.11, 6)
    g.translate(0.1, 0, 0)
    return g
  }, [])
  const wingMat1 = useMemo(() => new THREE.MeshBasicMaterial({ color: PALETTE.heart, side: THREE.DoubleSide }), [])
  const wingMat2 = useMemo(() => new THREE.MeshBasicMaterial({ color: '#B5D8FF', side: THREE.DoubleSide }), [])

  useFrame(({ camera: cam, clock }) => {
    const el = clock.elapsedTime
    const day = daylight(useGameStore.getState().timeOverride ?? useGameStore.getState().timeOfDay)
    const bob = islandBob(el)

    if (pollen.current) {
      pollen.current.visible = day > 0.35
      pollenMat.opacity = 0.3 * day
      if (pollen.current.visible) {
        for (let i = 0; i < POLLEN_N; i++) {
          const sd = seeds[i]
          v1.set(
            sd.x + Math.sin(el * sd.sp + sd.ph) * 0.8,
            sd.y + bob + Math.sin(el * sd.sp * 0.6 + sd.ph * 2) * 0.5,
            sd.z + Math.cos(el * sd.sp * 0.8 + sd.ph) * 0.8,
          )
          quat.copy(cam.quaternion)
          scl.setScalar(1)
          mat4.compose(v1, quat, scl)
          pollen.current.setMatrixAt(i, mat4)
        }
        pollen.current.instanceMatrix.needsUpdate = true
      }
    }

    const flap = Math.abs(Math.sin(el * 12)) * 1.1
    for (const [fly, off, spd] of [[fly1.current, 0, 1], [fly2.current, Math.PI, 0.8]] as const) {
      if (!fly) continue
      fly.visible = day > 0.2
      const tt = el * 0.25 * spd + off
      fly.position.set(Math.sin(tt) * 7.5, 1.5 + bob + Math.sin(tt * 2.3) * 0.7, Math.cos(tt * 0.7) * 7.5)
      fly.rotation.y = Math.atan2(Math.cos(tt) * 7.5 * 0.25, -Math.sin(tt * 0.7) * 0.7 * 7.5 * 0.25)
    }
    for (const w of [wingL.current, wingL2.current]) if (w) w.rotation.y = -flap
    for (const w of [wingR.current, wingR2.current]) if (w) w.rotation.y = Math.PI + flap

    // --- hot-air balloon: a slow crossing every few daytime minutes ---
    if (balloon.current) {
      const ct = el % BALLOON_PERIOD_S
      const crossing = ct < 55 && day > 0.4
      balloon.current.visible = crossing
      if (crossing) {
        const k = ct / 55
        const wave = Math.floor(el / BALLOON_PERIOD_S) % 2 === 0 ? 1 : -1
        balloon.current.position.set(
          (-34 + k * 68) * wave,
          10.5 + Math.sin(k * Math.PI * 3) * 0.8,
          -14 + k * 6,
        )
      }
    }

    // --- shooting star at night: click within its moment to make a wish ---
    if (star.current) {
      const cycle = Math.floor(el / STAR_PERIOD_S)
      const st = el % STAR_PERIOD_S
      const night = day < 0.15
      const activeStar = night && st < 1.6 && wished.current !== cycle
      star.current.visible = activeStar
      if (activeStar) {
        const k = st / 1.6
        star.current.position.set(-26 + k * 46, 20 - k * 7, -24 + k * 8)
        star.current.rotation.z = -0.28
        starMat.opacity = Math.min(1, k * 6) * (1 - Math.pow(k, 3))
      }
      star.current.userData.cycle = cycle
    }
    if (burstPending.current) {
      burstPending.current = false
      burstAt.current = el
    }
    if (starBurst.current) {
      const bt = el - burstAt.current
      const bursting = burstAt.current > 0 && bt < 0.9
      starBurst.current.visible = bursting
      if (bursting) {
        starBurst.current.scale.setScalar(0.4 + bt * 4)
        ;(starBurst.current.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - bt / 0.9)
      }
    }
  })

  const onStarClick = (e: { stopPropagation: () => void }) => {
    e.stopPropagation()
    const s = star.current
    if (!s || !s.visible) return
    wished.current = (s.userData.cycle as number) ?? -1
    burstPending.current = true
    if (starBurst.current) starBurst.current.position.copy(s.position)
    // wishes are always heard
    sfx('xp_tick')
    setTimeout(() => sfx('quest_complete'), 180)
  }

  return (
    <group>
      <instancedMesh ref={pollen} args={[pollenGeo, pollenMat, POLLEN_N]} frustumCulled={false} />
      <group ref={fly1}>
        <mesh ref={wingL} geometry={wingGeo} material={wingMat1} />
        <mesh ref={wingR} geometry={wingGeo} material={wingMat1} />
      </group>
      <group ref={fly2}>
        <mesh ref={wingL2} geometry={wingGeo} material={wingMat2} />
        <mesh ref={wingR2} geometry={wingGeo} material={wingMat2} />
      </group>

      {/* hot-air balloon (day, occasional) */}
      <group ref={balloon} visible={false}>
        <mesh material={balloonBodyMat}>
          <sphereGeometry args={[1.15, 14, 12]} />
        </mesh>
        <mesh material={balloonStripeMat} scale={[1.02, 0.55, 1.02]}>
          <sphereGeometry args={[1.15, 14, 10]} />
        </mesh>
        <mesh material={balloonBodyMat} position={[0, -1.15, 0]}>
          <coneGeometry args={[0.55, 0.8, 10]} />
        </mesh>
        <mesh material={balloonBasketMat} position={[0, -1.95, 0]}>
          <boxGeometry args={[0.55, 0.42, 0.55]} />
        </mesh>
      </group>

      {/* shooting star (night, wish on click) */}
      <group ref={star} visible={false} onClick={onStarClick}>
        <mesh material={starMat}>
          <planeGeometry args={[3.2, 0.14]} />
        </mesh>
        <mesh material={starMat} position={[1.5, 0, 0]}>
          <circleGeometry args={[0.22, 8]} />
        </mesh>
        {/* generous invisible hit target — it is fast and far away
            (opacity 0 still raycasts; visible={false} would not) */}
        <mesh position={[1.2, 0, 0]}>
          <sphereGeometry args={[2.6, 6, 6]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      </group>
      <mesh ref={starBurst} visible={false} material={starMat.clone()}>
        <circleGeometry args={[0.6, 16]} />
      </mesh>
    </group>
  )
}
