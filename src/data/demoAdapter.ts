// Demo mode: instant play without login. Fake Workspace quests trickle in,
// completions are resolved entirely client-side and persisted to localStorage.

import type { DataAdapter } from '../state/gameStore'
import { useGameStore } from '../state/gameStore'
import type {
  CritterInstance, CritterSpecies, PlacedAsset, Quest, RewardType,
} from '../state/types'
import { LEVEL_THRESHOLDS, unlocksUpTo } from '../state/types'
import { isInClearing, GRID_COLS, GRID_ROWS } from '../three/coords'

const STORAGE_KEY = 'aisleland-demo-v2'
const MAX_ACTIVE_QUESTS = 4
const QUEST_ARRIVAL_MS: [number, number] = [12_000, 28_000]

interface DemoSave {
  xp: number
  level: number
  streakCount: number
  assets: PlacedAsset[]
  critters: CritterInstance[]
  questCursor: number
  activeQuests: Quest[]
}

const QUEST_POOL: Array<Pick<Quest, 'source' | 'title' | 'difficulty' | 'xpReward' | 'rewardType'>> = [
  { source: 'gmail', title: 'Reply to Mia about the launch plan', difficulty: 1, xpReward: 20, rewardType: 'flower' },
  { source: 'calendar', title: 'Join the 2pm design sync', difficulty: 1, xpReward: 20, rewardType: 'flower' },
  { source: 'docs', title: 'Add your notes to the retro doc', difficulty: 2, xpReward: 35, rewardType: 'tree' },
  { source: 'gmail', title: 'Clear 3 unread threads', difficulty: 2, xpReward: 35, rewardType: 'tree' },
  { source: 'sheets', title: 'Update the Q3 budget sheet', difficulty: 2, xpReward: 35, rewardType: 'tree' },
  { source: 'slides', title: 'Polish the kickoff deck', difficulty: 3, xpReward: 55, rewardType: 'building' },
  { source: 'gmail', title: 'Send the weekly status update', difficulty: 2, xpReward: 35, rewardType: 'flower' },
  { source: 'calendar', title: 'Schedule 1:1 with your manager', difficulty: 1, xpReward: 20, rewardType: 'flower' },
  { source: 'docs', title: 'Review the PRD comments', difficulty: 3, xpReward: 55, rewardType: 'building' },
  { source: 'gmail', title: 'Answer the customer escalation', difficulty: 3, xpReward: 55, rewardType: 'building' },
  { source: 'sheets', title: 'Reconcile the OKR tracker', difficulty: 2, xpReward: 35, rewardType: 'tree' },
  { source: 'calendar', title: 'Block focus time for tomorrow', difficulty: 1, xpReward: 20, rewardType: 'flower' },
  { source: 'slides', title: 'Add speaker notes to the all-hands deck', difficulty: 2, xpReward: 35, rewardType: 'tree' },
  { source: 'gmail', title: 'Forward the contract to legal', difficulty: 2, xpReward: 35, rewardType: 'character_chance' },
  { source: 'docs', title: 'Finish the launch announcement draft', difficulty: 4, xpReward: 80, rewardType: 'character_chance' },
  { source: 'calendar', title: 'Confirm the offsite agenda', difficulty: 2, xpReward: 35, rewardType: 'tree' },
]

const CRITTER_NAMES: Record<CritterSpecies, string> = {
  'cat': 'Mochi', 'cat-1': 'Latte', 'rabbit': 'Clover', 'rabbit-1': 'Biscuit',
  'small-dog-1': 'Waffle', 'hamster-1': 'Pebble', 'hamster-2': 'Nutmeg',
}

export function createDemoAdapter(): DataAdapter {
  const store = useGameStore
  const save = load() ?? seed()
  let disposed = false
  let arrivalTimer: ReturnType<typeof setTimeout> | null = null

  push()
  scheduleArrival()

  function push() {
    const level = save.level
    store.getState().setIsland({
      level,
      xp: save.xp,
      xpToNextLevel: LEVEL_THRESHOLDS[level] ?? 99999,
      season: store.getState().island.season,
      streakCount: save.streakCount,
      unlockedAssetTypes: unlocksUpTo(level),
    })
    store.getState().setAssets([...save.assets])
    store.getState().setCritters([...save.critters])
    store.getState().setQuests([...save.activeQuests])
  }

  function scheduleArrival() {
    if (disposed) return
    const [lo, hi] = QUEST_ARRIVAL_MS
    arrivalTimer = setTimeout(() => {
      if (!disposed && save.activeQuests.length < MAX_ACTIVE_QUESTS) {
        save.activeQuests.push(nextQuest())
        persist()
        push()
      }
      scheduleArrival()
    }, lo + Math.random() * (hi - lo))
  }

  function nextQuest(): Quest {
    const tpl = QUEST_POOL[save.questCursor % QUEST_POOL.length]
    save.questCursor++
    return {
      ...tpl,
      id: `demo-q-${Date.now()}-${save.questCursor}`,
      status: 'active',
      createdAt: Date.now(),
    }
  }

  return {
    async completeQuest(questId) {
      const quest = save.activeQuests.find((q) => q.id === questId)
      if (!quest) return
      save.activeQuests = save.activeQuests.filter((q) => q.id !== questId)

      const prevLevel = save.level
      save.xp += quest.xpReward
      while (save.level < 10 && save.xp >= LEVEL_THRESHOLDS[save.level]) save.level++
      save.streakCount++

      const unlocked = unlocksUpTo(save.level)
      const { assetId, critterId } = grantReward(save, quest.rewardType, unlocked)
      persist()
      push()

      const s = store.getState()
      s.enqueueCelebration({
        kind: 'quest',
        id: `cel-${quest.id}`,
        quest: { ...quest, status: 'completed' },
        rewardAssetId: assetId,
        rewardCritterId: critterId,
      })
      if (save.level > prevLevel) {
        s.enqueueCelebration({
          kind: 'levelup',
          id: `cel-lvl-${save.level}`,
          newLevel: save.level,
          unlocked: (unlocksUpTo(save.level).filter((t) => !unlocksUpTo(prevLevel).includes(t))),
        })
      }
    },

    async moveAsset(assetId, gridX, gridY) {
      const a = save.assets.find((x) => x.id === assetId)
      if (!a) return
      a.gridX = gridX
      a.gridY = gridY
      persist()
      push()
    },

    dispose() {
      disposed = true
      if (arrivalTimer) clearTimeout(arrivalTimer)
    },
  }
}

function grantReward(
  save: DemoSave,
  rewardType: RewardType,
  unlocked: string[],
): { assetId: string | null; critterId: string | null } {
  // Character chance: at level 8+ roll a critter the player doesn't own yet.
  if (rewardType === 'character_chance' && save.level >= 8) {
    const owned = new Set(save.critters.map((c) => c.species))
    const candidates = (unlocked.filter((t) => t in CRITTER_NAMES) as CritterSpecies[])
      .filter((s) => !owned.has(s))
    if (candidates.length > 0 && Math.random() < 0.6) {
      const species = candidates[Math.floor(Math.random() * candidates.length)]
      const cell = randomFreeCell(save.assets) ?? { col: 4, row: 3 }
      const critter: CritterInstance = {
        id: `critter-${Date.now()}`,
        species,
        name: CRITTER_NAMES[species],
        rarity: species.includes('-1') ? 'rare' : 'common',
        home: { x: cell.col, y: cell.row },
        unlockDate: Date.now(),
      }
      save.critters.push(critter)
      return { assetId: null, critterId: critter.id }
    }
  }

  const buildable = unlocked.filter((t) => !(t in CRITTER_NAMES))
  let candidates: string[]
  switch (rewardType) {
    case 'flower': candidates = buildable.filter((t) => t.startsWith('flower')); break
    case 'tree': candidates = buildable.filter((t) => t.startsWith('tree')); break
    case 'building':
      candidates = buildable.filter((t) =>
        t.includes('house') || t.includes('windmill') || t.includes('stall'))
      break
    default: candidates = buildable
  }
  if (candidates.length === 0) candidates = buildable
  const type = candidates[Math.floor(Math.random() * candidates.length)]
  const cell = randomFreeCell(save.assets)
  if (!cell) return { assetId: null, critterId: null }

  const asset: PlacedAsset = {
    id: `asset-${Date.now()}`,
    type,
    gridX: cell.col,
    gridY: cell.row,
    plantedAt: Date.now(),
    growthStage: 1,
  }
  save.assets.push(asset)
  return { assetId: asset.id, critterId: null }
}

function randomFreeCell(assets: PlacedAsset[]): { col: number; row: number } | null {
  const occupied = new Set(assets.map((a) => `${a.gridX},${a.gridY}`))
  const free: Array<{ col: number; row: number }> = []
  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < GRID_COLS; col++) {
      if (!occupied.has(`${col},${row}`) && isInClearing(col, row)) free.push({ col, row })
    }
  }
  if (free.length === 0) return null
  return free[Math.floor(Math.random() * free.length)]
}

function seed(): DemoSave {
  // A gently pre-grown island so the first screenshot already looks alive.
  const save: DemoSave = {
    xp: 70,
    level: 2,
    streakCount: 3,
    assets: [
      { id: 'seed-1', type: 'flower-1', gridX: 2, gridY: 2, plantedAt: Date.now() - 86400e3, growthStage: 1 },
      { id: 'seed-2', type: 'flower-2', gridX: 5, gridY: 4, plantedAt: Date.now() - 86400e3, growthStage: 1 },
      { id: 'seed-3', type: 'flower-3', gridX: 3, gridY: 5, plantedAt: Date.now() - 43200e3, growthStage: 1 },
    ],
    critters: [],
    questCursor: 3,
    activeQuests: [],
  }
  save.activeQuests = QUEST_POOL.slice(0, 3).map((tpl, i) => ({
    ...tpl,
    id: `demo-q-seed-${i}`,
    status: 'active' as const,
    createdAt: Date.now() - i * 60_000,
  }))
  persistSave(save)
  return save
}

let currentSave: DemoSave | null = null
function load(): DemoSave | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    currentSave = JSON.parse(raw) as DemoSave
    return currentSave
  } catch {
    return null
  }
}
function persistSave(save: DemoSave) {
  currentSave = save
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(save)) } catch { /* quota */ }
}
function persist() {
  if (currentSave) persistSave(currentSave)
}

export function resetDemoSave() {
  try { localStorage.removeItem(STORAGE_KEY) } catch { /* noop */ }
}
