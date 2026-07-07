// Shared material singletons for Module A. One vertex-colored meringue
// material covers the island, rocks, clouds and grass tufts (fewer program
// switches; hue lives in vertex colors).

import { makeMeringue } from '../materials'

/** THE world material: meringue toon + vertex colors. */
export const meringueVertexMat = makeMeringue({ vertexColors: true })

/**
 * Desaturated single-color meringue for the distant mini-island silhouette.
 * curved:false — at r=70+ the world bend would fold it into a glassy shard.
 */
export const miniIslandMat = makeMeringue({ color: '#B8CFDB', curved: false })

/** Dark soil skirt just inside the cliff so noise gaps read as earth, not void. */
export const soilSkirtMat = makeMeringue({ color: '#8A5F42' })
