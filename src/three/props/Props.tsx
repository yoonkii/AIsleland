// Module B (props) — entry point. Reads placed assets from the store, renders
// each via <Prop>, applies the shared island bob/roll to the whole layer, and
// hosts arrange mode (ghost + green/red cell tint, click to move, Esc cancels).

import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import type { ThreeEvent } from '@react-three/fiber'
import { effectiveTimeOfDay, useGameStore } from '../../state/gameStore'
import { CELL, ISLAND_RADIUS, SURFACE_Y, gridToWorld, terrainHeight, worldToGrid } from '../coords'
import { islandBob, islandRoll } from '../islandMotion'
import { PALETTE } from '../../design/tokens'
import { Prop } from './Prop'
import { getPropBuild, jitterFor } from './recipes'
import {
  cellTintMaterial, ghostInvalidMaterial, ghostValidMaterial,
  pointerPlaneMaterial, updatePropGlow,
} from './propMaterials'

export { Prop } from './Prop'
export { PROP_INFO } from './recipes'

function sfx(name: string): void {
  window.dispatchEvent(new CustomEvent('aisleland-sfx', { detail: { name } }))
}

export function Props() {
  const assets = useGameStore((s) => s.assets)
  const arrangingAssetId = useGameStore((s) => s.arrangingAssetId)
  const rootRef = useRef<THREE.Group>(null)

  useFrame((state) => {
    const t = state.clock.elapsedTime
    const root = rootRef.current
    if (root) {
      root.position.y = islandBob(t)
      root.rotation.z = islandRoll(t)
    }
    updatePropGlow(effectiveTimeOfDay(useGameStore.getState()), t)
  })

  return (
    <group ref={rootRef}>
      {assets.map((asset) => {
        if (asset.id === arrangingAssetId) return null // the ghost stands in
        const [x, z] = gridToWorld(asset.gridX, asset.gridY)
        return (
          <Prop
            key={asset.id}
            id={asset.id}
            type={asset.type}
            position={[x, terrainHeight(x, z), z]}
            plantedAt={asset.plantedAt}
          />
        )
      })}
      {arrangingAssetId !== null && <ArrangeOverlay assetId={arrangingAssetId} />}
    </group>
  )
}

// ---------------------------------------------------------------------------
// Arrange mode — a ghost of the prop snaps to the hovered grid cell; the cell
// tints green when free / red when occupied; click plants, Escape cancels.
// ---------------------------------------------------------------------------

const planeGeo = new THREE.CircleGeometry(ISLAND_RADIUS, 40)
const cellGeo = new THREE.PlaneGeometry(CELL * 0.92, CELL * 0.92)
const ringGeo = new THREE.TorusGeometry(CELL * 0.42, 0.035, 6, 28)
const _tintValid = new THREE.Color(PALETTE.validGreen)
const _tintInvalid = new THREE.Color(PALETTE.invalidRed)

function ArrangeOverlay({ assetId }: { assetId: string }) {
  const assets = useGameStore((s) => s.assets)
  const season = useGameStore((s) => s.island.season)
  const setArrangingAssetId = useGameStore((s) => s.setArrangingAssetId)

  const asset = assets.find((a) => a.id === assetId) ?? null
  const [cell, setCell] = useState<{ col: number; row: number } | null>(
    asset ? { col: asset.gridX, row: asset.gridY } : null,
  )
  const cellRef = useRef(cell)
  const ghostRef = useRef<THREE.Group>(null)

  // Esc cancels.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setArrangingAssetId(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setArrangingAssetId])

  useFrame((state) => {
    const t = state.clock.elapsedTime
    // pulsing valid/invalid tint @ 1.2 Hz (occupancy re-checked here so the
    // ref is never written during render)
    const cur = cellRef.current
    let blocked = false
    if (cur) {
      const all = useGameStore.getState().assets
      for (let i = 0; i < all.length; i++) {
        const a = all[i]
        if (a.id !== assetId && a.gridX === cur.col && a.gridY === cur.row) {
          blocked = true
          break
        }
      }
    }
    cellTintMaterial.color.copy(blocked ? _tintInvalid : _tintValid)
    cellTintMaterial.opacity = 0.3 + 0.18 * Math.sin(t * Math.PI * 2 * 1.2)
    // gentle hover bob on the ghost so it reads as "picked up"
    const ghost = ghostRef.current
    if (ghost && cellRef.current) {
      ghost.position.y = (ghost.userData.baseY as number) + 0.06 + 0.05 * Math.sin(t * 2.4)
    }
  })

  if (!asset) return null

  const occupied = cell !== null &&
    assets.some((a) => a.id !== assetId && a.gridX === cell.col && a.gridY === cell.row)

  const build = getPropBuild(asset.type, season)
  const jitter = jitterFor(assetId, asset.type)

  const onPointerMove = (e: ThreeEvent<PointerEvent>) => {
    const g = worldToGrid(e.point.x, e.point.z)
    const cur = cellRef.current
    if (g === null) {
      if (cur !== null) {
        cellRef.current = null
        setCell(null)
      }
      return
    }
    if (!cur || cur.col !== g.col || cur.row !== g.row) {
      cellRef.current = g
      setCell(g)
    }
  }

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    const g = worldToGrid(e.point.x, e.point.z)
    if (!g) return
    const blocked = assets.some(
      (a) => a.id !== assetId && a.gridX === g.col && a.gridY === g.row,
    )
    if (blocked) {
      sfx('ui_tap')
      return
    }
    void useGameStore.getState().adapter?.moveAsset(assetId, g.col, g.row).catch(() => {})
    sfx('plant_flower')
    setArrangingAssetId(null)
  }

  let ghostX = 0
  let ghostY = 0
  let ghostZ = 0
  let cellX = 0
  let cellY = 0
  let cellZ = 0
  if (cell) {
    const [gx, gz] = gridToWorld(cell.col, cell.row)
    ghostX = gx + jitter.dx
    ghostZ = gz + jitter.dz
    ghostY = terrainHeight(ghostX, ghostZ)
    cellX = gx
    cellZ = gz
    cellY = terrainHeight(gx, gz)
  }

  return (
    <group>
      {/* invisible raycast surface over the island top */}
      <mesh
        geometry={planeGeo}
        material={pointerPlaneMaterial}
        rotation-x={-Math.PI / 2}
        position={[0, SURFACE_Y + 0.05, 0]}
        onPointerMove={onPointerMove}
        onClick={onClick}
      />
      {cell && (
        <>
          <group
            ref={ghostRef}
            position={[ghostX, ghostY, ghostZ]}
            rotation-y={jitter.rot}
            userData={{ baseY: ghostY }}
          >
            <mesh
              geometry={build.solid}
              material={occupied ? ghostInvalidMaterial : ghostValidMaterial}
            />
            {build.spin && (
              <mesh
                geometry={build.spin}
                material={occupied ? ghostInvalidMaterial : ghostValidMaterial}
                position={build.spinPos}
              />
            )}
          </group>
          <mesh
            geometry={cellGeo}
            material={cellTintMaterial}
            rotation-x={-Math.PI / 2}
            position={[cellX, cellY + 0.04, cellZ]}
          />
          <mesh
            geometry={ringGeo}
            material={cellTintMaterial}
            rotation-x={-Math.PI / 2}
            position={[cellX, cellY + 0.07, cellZ]}
          />
        </>
      )}
    </group>
  )
}
