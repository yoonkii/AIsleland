import { create } from 'zustand'
import type {
  CelebrationEvent, CritterInstance, IslandSummary, PlacedAsset, Quest, Season,
} from './types'

export type GameMode = 'demo' | 'firebase'

export interface PlayerInfo {
  uid: string
  displayName: string
  email: string
  photoURL?: string | null
}

/** Implemented by demoAdapter / firebaseAdapter; the store calls into it. */
export interface DataAdapter {
  /** Ask the backend to complete a quest (demo: instant, firebase: self-report). */
  completeQuest(questId: string): Promise<void>
  /** Persist a manual asset move (arrange mode). May be a no-op. */
  moveAsset(assetId: string, gridX: number, gridY: number): Promise<void>
  dispose(): void
}

export interface GameState {
  // --- session ---
  mode: GameMode | null
  player: PlayerInfo | null
  adapter: DataAdapter | null

  // --- synced game data ---
  island: IslandSummary
  assets: PlacedAsset[]
  critters: CritterInstance[]
  quests: Quest[]

  // --- presentation / UI ---
  /** 0..1 wall-clock day fraction (0 = midnight, 0.5 = noon). */
  timeOfDay: number
  /** Photo-mode override; null = follow real clock. */
  timeOverride: number | null
  photoMode: boolean
  journalOpen: boolean
  muted: boolean
  quality: 'high' | 'low'
  /** Player-chosen island name (persisted to localStorage). */
  islandName: string
  /** Arrange mode: id of the asset being moved, or null. */
  arrangingAssetId: string | null

  // --- celebration pipeline ---
  /** Currently playing celebration (camera + FX own this while non-null). */
  celebration: CelebrationEvent | null
  celebrationQueue: CelebrationEvent[]

  /** World position the camera should fly to; bump focusToken to re-trigger. */
  focusTarget: [number, number, number] | null
  focusToken: number

  // --- actions ---
  startSession(mode: GameMode, player: PlayerInfo, adapter: DataAdapter): void
  endSession(): void
  setIsland(island: IslandSummary): void
  setAssets(assets: PlacedAsset[]): void
  setCritters(critters: CritterInstance[]): void
  setQuests(quests: Quest[]): void

  completeQuest(questId: string): Promise<void>
  enqueueCelebration(ev: CelebrationEvent): void
  /** Pops the queue into `celebration`. Returns the event or null. */
  startNextCelebration(): CelebrationEvent | null
  endCelebration(): void

  setIslandName(name: string): void
  setTimeOfDay(t: number): void
  setTimeOverride(t: number | null): void
  setPhotoMode(on: boolean): void
  setJournalOpen(open: boolean): void
  toggleMuted(): void
  setQuality(q: 'high' | 'low'): void
  setArrangingAssetId(id: string | null): void
  requestFocus(target: [number, number, number] | null): void
}

const initialIsland: IslandSummary = {
  level: 1, xp: 0, xpToNextLevel: 60,
  season: currentSeason(), streakCount: 0,
  unlockedAssetTypes: ['flower-1', 'flower-2', 'flower-3'],
}

export const useGameStore = create<GameState>((set, get) => ({
  mode: null,
  player: null,
  adapter: null,

  island: initialIsland,
  assets: [],
  critters: [],
  quests: [],

  timeOfDay: clockFraction(),
  timeOverride: null,
  photoMode: false,
  journalOpen: false,
  muted: false,
  quality: 'high',
  islandName: loadIslandName(),
  arrangingAssetId: null,

  celebration: null,
  celebrationQueue: [],
  focusTarget: null,
  focusToken: 0,

  startSession: (mode, player, adapter) => {
    // never leak a previous adapter's subscriptions
    const prev = get().adapter
    if (prev && prev !== adapter) prev.dispose()
    set({ mode, player, adapter })
  },
  endSession: () => {
    get().adapter?.dispose()
    set({
      mode: null, player: null, adapter: null,
      island: initialIsland, assets: [], critters: [], quests: [],
      celebration: null, celebrationQueue: [], journalOpen: false,
      photoMode: false, arrangingAssetId: null,
      timeOverride: null, focusTarget: null,
    })
  },

  setIsland: (island) => set({ island }),
  setAssets: (assets) => set({ assets }),
  setCritters: (critters) => set({ critters }),
  setQuests: (quests) => set({ quests }),

  completeQuest: async (questId) => {
    const { adapter } = get()
    if (adapter) await adapter.completeQuest(questId)
  },

  enqueueCelebration: (ev) =>
    set((s) => ({ celebrationQueue: [...s.celebrationQueue, ev] })),

  startNextCelebration: () => {
    const s = get()
    if (s.celebration || s.celebrationQueue.length === 0) return null
    const [next, ...rest] = s.celebrationQueue
    set({ celebration: next, celebrationQueue: rest })
    return next
  },

  endCelebration: () => set({ celebration: null }),

  setIslandName: (name) => {
    const clean = name.trim().slice(0, 24) || 'My Isle'
    try { localStorage.setItem('aisleland-island-name', clean) } catch { /* quota */ }
    set({ islandName: clean })
  },
  setTimeOfDay: (t) => set({ timeOfDay: ((t % 1) + 1) % 1 }),
  setTimeOverride: (t) => set({ timeOverride: t }),
  setPhotoMode: (on) => set({ photoMode: on, journalOpen: false }),
  setJournalOpen: (open) => set({ journalOpen: open }),
  toggleMuted: () => set((s) => ({ muted: !s.muted })),
  setQuality: (q) => set({ quality: q }),
  setArrangingAssetId: (id) => set({ arrangingAssetId: id }),
  requestFocus: (target) =>
    set((s) => ({ focusTarget: target, focusToken: s.focusToken + 1 })),
}))

/** Effective time of day respecting the photo-mode override. */
export function effectiveTimeOfDay(s: Pick<GameState, 'timeOfDay' | 'timeOverride'>): number {
  return s.timeOverride ?? s.timeOfDay
}

function loadIslandName(): string {
  try { return localStorage.getItem('aisleland-island-name') ?? '' } catch { return '' }
}

export function clockFraction(date = new Date()): number {
  return (date.getHours() * 3600 + date.getMinutes() * 60 + date.getSeconds()) / 86400
}

export function currentSeason(date = new Date()): Season {
  const m = date.getMonth()
  if (m >= 2 && m <= 4) return 'spring'
  if (m >= 5 && m <= 7) return 'summer'
  if (m >= 8 && m <= 10) return 'autumn'
  return 'winter'
}
