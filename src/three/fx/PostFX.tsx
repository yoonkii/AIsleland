// Post-processing chain per docs/VISUAL_PLAYBOOK.md "Global grade pass":
// Bloom → tilt-shift (photo mode) → HueSaturation → Noise → Vignette → SMAA.
// Quality 'low' keeps only SMAA + Vignette.

import { EffectComposer, Bloom, HueSaturation, Noise, Vignette, SMAA, TiltShift2 } from '@react-three/postprocessing'
import { BlendFunction } from 'postprocessing'
import { HalfFloatType } from 'three'
import { useGameStore } from '../../state/gameStore'

export function PostFX() {
  const quality = useGameStore((s) => s.quality)
  const photoMode = useGameStore((s) => s.photoMode)

  if (quality === 'low') {
    return (
      <EffectComposer frameBufferType={HalfFloatType} multisampling={0}>
        <Vignette offset={0.3} darkness={0.45} />
        <SMAA />
      </EffectComposer>
    )
  }

  return (
    <EffectComposer frameBufferType={HalfFloatType} multisampling={0}>
      <Bloom mipmapBlur luminanceThreshold={0.85} intensity={0.6} radius={0.7} />
      {photoMode ? <TiltShift2 blur={0.15} /> : <></>}
      <HueSaturation saturation={0.12} />
      <Noise premultiply blendFunction={BlendFunction.SOFT_LIGHT} opacity={0.25} />
      <Vignette offset={0.3} darkness={0.5} />
      <SMAA />
    </EffectComposer>
  )
}
