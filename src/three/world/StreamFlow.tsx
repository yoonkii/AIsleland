// Animated water surface for the creek: a ribbon quad floats just above the
// recessed stream bed along each channel, scrolling soft foam stripes outward
// (pond → waterfall). One shader, two meshes.

import { useMemo } from 'react'
import type { JSX } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { PALETTE } from '../../design/tokens'
import { boundaryRadius, SURFACE_Y, VOXEL, WATERFALL_AZIMUTHS } from '../coords'

const uniforms = {
  uTime: { value: 0 },
  uBase: { value: new THREE.Color(PALETTE.seaShallow) },
  uFoam: { value: new THREE.Color('#EAFBFF') },
}

const material = new THREE.ShaderMaterial({
  uniforms,
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform float uTime;
    uniform vec3 uBase;
    uniform vec3 uFoam;
    varying vec2 vUv;
    void main() {
      // u runs along the stream (0 = source, 1 = cliff edge); flow speeds up
      float flow = vUv.x * 5.0 - uTime * (0.9 + vUv.x * 0.9);
      float f1 = smoothstep(0.72, 0.86, fract(flow + sin(vUv.y * 9.0) * 0.15));
      float f2 = smoothstep(0.8, 0.9, fract(flow * 1.7 + vUv.y * 2.0 + 0.4));
      float foam = max(f1 * 0.5, f2 * 0.35);
      // soft side edges so the ribbon melts into the voxel banks
      float a = smoothstep(0.02, 0.24, vUv.y) * smoothstep(0.98, 0.76, vUv.y);
      gl_FragColor = vec4(mix(uBase, uFoam, foam), a * (0.35 + foam * 0.55));
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }
  `,
  transparent: true,
  depthWrite: false,
})

function ribbonGeometry(azimuth: number, fromR: number): THREE.BufferGeometry {
  const toR = boundaryRadius(Math.atan2(Math.cos(azimuth), Math.sin(azimuth))) - 0.1
  const dirX = Math.sin(azimuth), dirZ = Math.cos(azimuth)
  const perpX = Math.cos(azimuth), perpZ = -Math.sin(azimuth)
  const width = 1.35
  const segs = 14
  const positions = new Float32Array((segs + 1) * 2 * 3)
  const uvs = new Float32Array((segs + 1) * 2 * 2)
  const indices: number[] = []
  const y = SURFACE_Y - VOXEL + 0.05
  for (let i = 0; i <= segs; i++) {
    const t = i / segs
    const r = fromR + (toR - fromR) * t
    // the pond mouth is wider than the creek
    const w = width * (t < 0.18 ? 1.65 - t * 3.6 : 1) * 0.5
    for (let side = 0; side < 2; side++) {
      const s = side === 0 ? -1 : 1
      const idx = (i * 2 + side) * 3
      positions[idx] = dirX * r + perpX * w * s
      positions[idx + 1] = y
      positions[idx + 2] = dirZ * r + perpZ * w * s
      uvs[(i * 2 + side) * 2] = t
      uvs[(i * 2 + side) * 2 + 1] = side
    }
    if (i < segs) {
      const a = i * 2
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
    }
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
  geo.setIndex(indices)
  geo.computeVertexNormals()
  return geo
}

export function StreamFlow(): JSX.Element {
  const geos = useMemo(
    () => [ribbonGeometry(WATERFALL_AZIMUTHS[0], 6.1), ribbonGeometry(WATERFALL_AZIMUTHS[1], 6.4)],
    [],
  )
  useFrame(({ clock }) => {
    uniforms.uTime.value = clock.elapsedTime
  })
  return (
    <group>
      {geos.map((g, i) => (
        <mesh key={i} geometry={g} material={material} renderOrder={2} />
      ))}
    </group>
  )
}
