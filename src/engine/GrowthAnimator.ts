import { Container, Sprite, Graphics, Assets } from 'pixi.js'
import { getAssetDef } from './assetManifest'
import { getRandomEmptyCell } from './IslandGrid'
import type { GridCell } from './IslandGrid'

/**
 * Plays a bloom/growth animation when a quest is completed.
 * 1. Sparkle particles appear at a grid cell
 * 2. A new sprite scales up from 0 with bounce easing
 * 3. Sparkles fade out
 */
export async function playGrowthAnimation(
  container: Container,
  assetKey: string,
  grid: GridCell[],
): Promise<void> {
  const def = getAssetDef(assetKey)
  if (!def) return

  const cell = getRandomEmptyCell(grid)
  if (!cell) return
  cell.occupied = true

  const x = cell.x - 512
  const y = cell.y - 512

  // Phase 1: Sparkle particles
  const sparkles = createSparkles(x, y)
  container.addChild(sparkles)

  // Animate sparkles rising
  await animate(600, (t) => {
    sparkles.alpha = 1 - t * 0.5
    sparkles.y = y - t * 30
    sparkles.scale.set(1 + t * 0.5)
  })

  // Phase 2: Sprite grows in
  const texture = Assets.get(`/assets/${def.file}`)
  if (!texture) {
    container.removeChild(sparkles)
    return
  }

  const sprite = new Sprite(texture)
  sprite.anchor.set(def.anchorX, def.anchorY)
  sprite.width = def.displayWidth
  sprite.height = def.displayHeight
  sprite.x = x
  sprite.y = y
  sprite.zIndex = def.zLayer * 100 + cell.row
  sprite.scale.set(0)
  container.addChild(sprite)

  // Bounce easing scale-up
  await animate(500, (t) => {
    const scale = bounceEaseOut(t)
    const targetScaleX = def.displayWidth / texture.width
    const targetScaleY = def.displayHeight / texture.height
    sprite.scale.set(targetScaleX * scale, targetScaleY * scale)
  })

  // Phase 3: Fade sparkles
  await animate(300, (t) => {
    sparkles.alpha = 0.5 * (1 - t)
  })

  container.removeChild(sparkles)
  sparkles.destroy()
  container.sortChildren()
}

/**
 * Creates a simple sparkle effect using Graphics
 */
function createSparkles(x: number, y: number): Container {
  const container = new Container()
  container.x = x
  container.y = y

  const colors = [0xFFD700, 0xFFF8DC, 0xFFE4B5, 0xFFA500]

  for (let i = 0; i < 8; i++) {
    const g = new Graphics()
    const angle = (i / 8) * Math.PI * 2
    const dist = 10 + Math.random() * 15
    const size = 2 + Math.random() * 3

    g.circle(0, 0, size)
    g.fill({ color: colors[i % colors.length], alpha: 0.8 })
    g.x = Math.cos(angle) * dist
    g.y = Math.sin(angle) * dist

    container.addChild(g)
  }

  return container
}

/**
 * Bounce ease-out for satisfying scale animations
 */
function bounceEaseOut(t: number): number {
  if (t < 0.3636) {
    return 7.5625 * t * t
  } else if (t < 0.7273) {
    const t2 = t - 0.5455
    return 7.5625 * t2 * t2 + 0.75
  } else if (t < 0.9091) {
    const t2 = t - 0.8182
    return 7.5625 * t2 * t2 + 0.9375
  } else {
    const t2 = t - 0.9545
    return 7.5625 * t2 * t2 + 0.984375
  }
}

/**
 * Simple promise-based animation helper
 */
function animate(durationMs: number, update: (t: number) => void): Promise<void> {
  return new Promise((resolve) => {
    const start = performance.now()
    function frame() {
      const elapsed = performance.now() - start
      const t = Math.min(elapsed / durationMs, 1)
      update(t)
      if (t < 1) {
        requestAnimationFrame(frame)
      } else {
        resolve()
      }
    }
    requestAnimationFrame(frame)
  })
}
