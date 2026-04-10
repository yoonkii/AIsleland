import { useState, useEffect, useRef } from 'react'
import { Application, Assets, Sprite, Container, Ticker } from 'pixi.js'
import type { User } from 'firebase/auth'
import { getPlaceableAssets } from '../engine/assetManifest'
import { createGrid, getRandomEmptyCell } from '../engine/IslandGrid'
import { createInitialIsland } from '../game/IslandState'
import type { IslandState } from '../game/IslandState'
import type { Quest } from '../game/QuestManager'
import { StatusBar } from './StatusBar'
import { QuestDrawer } from './QuestDrawer'
import { ToastNotification } from './ToastNotification'
import { SKY_GRADIENT, FONT } from '../theme'
import { httpsCallable } from 'firebase/functions'
import { functions } from '../firebase/config'
import { getOrCreateUser, getOrCreateIsland, subscribeToQuests, subscribeToIsland } from '../firebase/firestore'
import { playGrowthAnimation } from '../engine/GrowthAnimator'
import { playChime, setMuted } from '../engine/AudioEngine'
import type { GridCell } from '../engine/IslandGrid'

interface Props {
  user: User
  onSignOut: () => void
}

export function IslandView({ user, onSignOut }: Props) {
  const [island, setIsland] = useState<IslandState>(createInitialIsland)
  const [quests, setQuests] = useState<Quest[]>(DEMO_QUESTS)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [toast, setToast] = useState<{ message: string; xp: number } | null>(null)
  const [pixiReady, setPixiReady] = useState(false)
  const [pixiError, setPixiError] = useState<string | null>(null)
  const [soundEnabled, setSoundEnabled] = useState(false)
  const canvasRef = useRef<HTMLDivElement>(null)
  const appRef = useRef<Application | null>(null)
  const islandContainerRef = useRef<Container | null>(null)
  const gridRef = useRef<GridCell[]>(createGrid())

  // Load user data and subscribe to real-time updates
  useEffect(() => {
    getOrCreateUser(user.uid, user.email || '', user.displayName || '')
    getOrCreateIsland(user.uid)

    // Subscribe to island state changes (XP, level, assets updated by Cloud Functions)
    const unsubIsland = subscribeToIsland(user.uid, (doc) => {
      setIsland(prev => ({
        ...prev,
        level: doc.level,
        xp: doc.xp,
        xpToNextLevel: doc.xpToNextLevel,
        season: doc.season,
        unlockedAssetTypes: doc.unlockedAssetTypes,
        streakCount: doc.streakCount,
        lastQuestCompletedAt: doc.lastQuestCompletedAt,
      }))
    })

    // Subscribe to active quests
    const unsubQuests = subscribeToQuests(user.uid, (firestoreQuests) => {
      if (firestoreQuests.length > 0) {
        setQuests(firestoreQuests.map(q => ({
          ...q,
          difficulty: q.difficulty as 1 | 2 | 3 | 4,
        })))
      }
    })

    return () => { unsubIsland(); unsubQuests() }
  }, [user.uid])

  // Initialize PixiJS
  useEffect(() => {
    let cancelled = false

    async function setup() {
      if (!canvasRef.current) return
      try {
        const app = new Application()
        await app.init({
          backgroundAlpha: 0,
          resizeTo: canvasRef.current,
        })
        if (cancelled) { app.destroy(true); return }

        canvasRef.current.appendChild(app.canvas as HTMLCanvasElement)
        appRef.current = app

        const mapTex = await Assets.load('/assets/map.png')
        if (cancelled) return
        const mapSprite = new Sprite(mapTex)
        mapSprite.anchor.set(0.5, 0.5)

        const container = new Container()
        container.addChild(mapSprite)
        islandContainerRef.current = container

        const s = Math.min(app.screen.width, app.screen.height) / 1024 * 0.9
        container.scale.set(s)
        container.x = app.screen.width / 2
        container.y = app.screen.height / 2
        app.stage.addChild(container)

        const defs = getPlaceableAssets(island.level)
        await Promise.all(defs.map(d => Assets.load(`/assets/${d.file}`)))
        if (cancelled) return

        const grid = createGrid()
        const count = Math.min(defs.length, 3 + island.level * 2)
        for (let i = 0; i < count; i++) {
          const cell = getRandomEmptyCell(grid)
          if (!cell) break
          cell.occupied = true
          const def = defs[i % defs.length]
          const tex = Assets.get(`/assets/${def.file}`)
          if (!tex) continue
          const sp = new Sprite(tex)
          sp.anchor.set(def.anchorX, def.anchorY)
          sp.width = def.displayWidth
          sp.height = def.displayHeight
          sp.x = cell.x - 512
          sp.y = cell.y - 512
          sp.zIndex = def.zLayer * 100 + cell.row
          container.addChild(sp)
        }
        container.sortChildren()

        let t = 0
        app.ticker.add((ticker: Ticker) => {
          t += ticker.deltaTime * 0.015
          container.y = app.screen.height / 2 + Math.sin(t) * 4
        })

        setPixiReady(true)
      } catch (e: any) {
        console.error('PixiJS init failed:', e)
        setPixiError(e?.message || String(e))
      }
    }

    setup()
    return () => {
      cancelled = true
      appRef.current?.destroy(true)
      appRef.current = null
    }
  }, [])

  const handleComplete = async (questId: string) => {
    const quest = quests.find(q => q.id === questId)
    if (!quest || quest.status !== 'active') return

    // Optimistic UI: mark as completed locally
    setQuests(prev => prev.map(q =>
      q.id === questId ? { ...q, status: 'completed' as const, completedAt: Date.now() } : q
    ))

    try {
      // Call Cloud Function to complete quest server-side (awards XP, places asset)
      const completeQuestFn = httpsCallable<{ questId: string }, { xpAwarded: number; rewardType: string }>(functions, 'completeQuest')
      const result = await completeQuestFn({ questId })

      const msgs: Record<string, string> = {
        flower: 'A flower bloomed on your island!',
        tree: 'A new tree is growing!',
        building: 'Your village is expanding!',
        character_chance: 'Something rustles in the bushes...',
      }
      setToast({
        message: msgs[result.data.rewardType] || 'Your island grew!',
        xp: result.data.xpAwarded,
      })
      setTimeout(() => setToast(null), 3000)

      // Play growth animation on the island
      if (islandContainerRef.current) {
        const rewardAssets: Record<string, string[]> = {
          flower: ['flower-1', 'flower-2', 'flower-3'],
          tree: ['tree-1', 'tree-2', 'tree-3', 'tree-4'],
          building: ['small-house', 'stall-1', 'windmill-1'],
        }
        const candidates = rewardAssets[result.data.rewardType] || ['flower-1']
        const assetKey = candidates[Math.floor(Math.random() * candidates.length)]

        // Load the asset if not already loaded
        const def = (await import('../engine/assetManifest')).getAssetDef(assetKey)
        if (def) {
          await Assets.load(`/assets/${def.file}`)
          await playGrowthAnimation(islandContainerRef.current, assetKey, gridRef.current)
        }
      }

      // Play chime
      playChime(result.data.rewardType as any)
    } catch (e: any) {
      console.error('Quest completion failed:', e)
      // Revert optimistic update
      setQuests(prev => prev.map(q =>
        q.id === questId ? { ...q, status: 'active' as const, completedAt: null } : q
      ))
      setToast({ message: e?.message || 'Failed to complete quest', xp: 0 })
      setTimeout(() => setToast(null), 3000)
    }
  }

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', position: 'relative' }}>
      <div
        ref={canvasRef}
        style={{
          position: 'absolute', inset: 0,
          background: SKY_GRADIENT,
        }}
      />

      {!pixiReady && !pixiError && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          color: '#6B6560', fontFamily: FONT, fontSize: 18, zIndex: 5,
        }}>
          Loading your island...
        </div>
      )}
      {pixiError && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          color: '#E07A6E', fontFamily: FONT, fontSize: 14,
          padding: 20, textAlign: 'center', zIndex: 5,
        }}>
          Failed to load island: {pixiError}
        </div>
      )}

      <StatusBar island={island} />

      {/* User info + controls */}
      <div style={{
        position: 'absolute', top: 16, right: 16, zIndex: 10,
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <button
          className="btn-glass"
          onClick={() => { const next = !soundEnabled; setSoundEnabled(next); setMuted(!next) }}
          style={{
            background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.3)',
            borderRadius: 12, padding: '4px 10px', color: '#3A3632', fontSize: 14,
            cursor: 'pointer', backdropFilter: 'blur(12px)',
          }}
          title={soundEnabled ? 'Mute sounds' : 'Enable sounds'}
        >
          {soundEnabled ? '\uD83D\uDD0A' : '\uD83D\uDD07'}
        </button>
        <span style={{
          color: '#3A3632', fontSize: 13, fontFamily: FONT,
          background: 'rgba(255,255,255,0.18)', borderRadius: 12,
          padding: '4px 10px', backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255,255,255,0.3)',
        }}>
          {user.displayName || user.email}
        </span>
        <button className="btn-glass" onClick={onSignOut} style={{
          background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.3)',
          borderRadius: 12, padding: '4px 10px', color: '#3A3632', fontSize: 12,
          cursor: 'pointer', fontFamily: FONT, backdropFilter: 'blur(12px)',
        }}>
          Sign out
        </button>
      </div>

      <QuestDrawer
        quests={quests}
        open={drawerOpen}
        onToggle={() => setDrawerOpen(!drawerOpen)}
        onCompleteQuest={handleComplete}
      />
      {toast && <ToastNotification message={toast.message} xp={toast.xp} />}
    </div>
  )
}

const DEMO_QUESTS: Quest[] = [
  {
    id: '1', source: 'calendar', title: 'Prepare agenda for 1:1 with Mike',
    difficulty: 1, xpReward: 20, rewardType: 'flower', status: 'active',
    createdAt: Date.now(), completedAt: null, verificationMethod: 'self_report',
    sourceEventId: 'cal-001',
  },
  {
    id: '2', source: 'gmail', title: 'Reply to design review from Sarah',
    difficulty: 2, xpReward: 30, rewardType: 'tree', status: 'active',
    createdAt: Date.now(), completedAt: null, verificationMethod: 'auto',
    sourceEventId: 'gmail-001',
  },
  {
    id: '3', source: 'docs', title: 'Continue working on Q2 planning doc',
    difficulty: 2, xpReward: 50, rewardType: 'building', status: 'active',
    createdAt: Date.now(), completedAt: null, verificationMethod: 'auto',
    sourceEventId: 'docs-001',
  },
]
