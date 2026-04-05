import * as admin from 'firebase-admin'

const db = admin.firestore()

// XP thresholds for each level (cumulative)
const LEVEL_THRESHOLDS = [0, 60, 140, 240, 360, 520, 720, 960, 1240, 1600]

const LEVEL_UNLOCKS: Record<number, string[]> = {
  1: ['flower-1', 'flower-2', 'flower-3'],
  3: ['tree-1', 'tree-2', 'tree-3', 'tree-4', 'road'],
  4: ['small-house', 'stall-1'],
  5: ['street-light-1', 'water-kattle-1'],
  6: ['windmill-1', 'windmill-2', 'windmill-3', 'fruit-baskets'],
  7: ['big-house', 'lumber'],
  8: ['cat', 'rabbit', 'small-dog-1'],
  9: ['hamster-1', 'hamster-2'],
  10: ['cat-1', 'rabbit-1'],
}

export async function awardXP(userId: string, xp: number, rewardType: string): Promise<void> {
  const islandRef = db.doc(`islands/${userId}`)

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(islandRef)
    if (!snap.exists) return

    const data = snap.data()!
    const newXp = (data.xp || 0) + xp
    let newLevel = data.level || 1

    // Check for level up
    while (newLevel < 10 && newXp >= LEVEL_THRESHOLDS[newLevel]) {
      newLevel++
    }

    // Compute unlocked asset types
    const unlocked: string[] = []
    for (let l = 1; l <= newLevel; l++) {
      if (LEVEL_UNLOCKS[l]) unlocked.push(...LEVEL_UNLOCKS[l])
    }

    tx.update(islandRef, {
      xp: newXp,
      level: newLevel,
      xpToNextLevel: LEVEL_THRESHOLDS[newLevel] ?? 99999,
      unlockedAssetTypes: unlocked,
      streakCount: (data.streakCount || 0) + 1,
      lastQuestCompletedAt: Date.now(),
    })

    // Place an asset on the island grid
    const assetType = pickAssetForReward(rewardType, unlocked)
    if (assetType) {
      const gridPos = await findEmptyGridCell(userId, tx)
      if (gridPos) {
        const assetRef = db.collection(`islands/${userId}/assets`).doc()
        tx.set(assetRef, {
          type: assetType,
          gridX: gridPos.col,
          gridY: gridPos.row,
          plantedAt: Date.now(),
          growthStage: 1,
        })
      }
    }
  })
}

function pickAssetForReward(rewardType: string, unlocked: string[]): string | null {
  let candidates: string[]
  switch (rewardType) {
    case 'flower':
      candidates = unlocked.filter(a => a.startsWith('flower'))
      break
    case 'tree':
      candidates = unlocked.filter(a => a.startsWith('tree'))
      break
    case 'building':
      candidates = unlocked.filter(a =>
        a.includes('house') || a.includes('windmill') || a.includes('stall')
      )
      break
    default:
      candidates = unlocked
  }
  if (candidates.length === 0) return null
  return candidates[Math.floor(Math.random() * candidates.length)]
}

async function findEmptyGridCell(
  userId: string,
  tx: admin.firestore.Transaction,
): Promise<{ col: number; row: number } | null> {
  const assetsSnap = await tx.get(
    db.collection(`islands/${userId}/assets`)
  )
  const occupied = new Set(
    assetsSnap.docs.map(d => `${d.data().gridX},${d.data().gridY}`)
  )

  // Simple grid: 8 cols x 7 rows, oval clearing
  for (let row = 0; row < 7; row++) {
    for (let col = 0; col < 8; col++) {
      const key = `${col},${row}`
      if (!occupied.has(key) && isInClearing(col, row)) {
        return { col, row }
      }
    }
  }
  return null
}

function isInClearing(col: number, row: number): boolean {
  const cx = 3.5, cy = 3
  const dx = (col - cx) / 4
  const dy = (row - cy) / 3.5
  return dx * dx + dy * dy <= 1.0
}
