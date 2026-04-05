import { useState, useEffect, useRef } from 'react'
import { Application, Assets, Sprite, Container, Ticker } from 'pixi.js'
import { getPlaceableAssets } from './engine/assetManifest'
import { createGrid, getRandomEmptyCell } from './engine/IslandGrid'
import { createInitialIsland } from './game/IslandState'
import type { IslandState } from './game/IslandState'
import type { Quest } from './game/QuestManager'
import { StatusBar } from './components/StatusBar'
import { QuestDrawer } from './components/QuestDrawer'
import { ToastNotification } from './components/ToastNotification'

export function App() {
  const [island, setIsland] = useState<IslandState>(createInitialIsland)
  const [quests, setQuests] = useState<Quest[]>(DEMO_QUESTS)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [toast, setToast] = useState<{ message: string; xp: number } | null>(null)
  const [pixiReady, setPixiReady] = useState(false)
  const [pixiError, setPixiError] = useState<string | null>(null)
  const canvasRef = useRef<HTMLDivElement>(null)
  const appRef = useRef<Application | null>(null)

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

        // Load map
        const mapTex = await Assets.load('/assets/map.png')
        if (cancelled) return
        const mapSprite = new Sprite(mapTex)
        mapSprite.anchor.set(0.5, 0.5)

        const container = new Container()
        container.addChild(mapSprite)

        // Scale to fit
        const s = Math.min(app.screen.width, app.screen.height) / 1024 * 0.9
        container.scale.set(s)
        container.x = app.screen.width / 2
        container.y = app.screen.height / 2
        app.stage.addChild(container)

        // Load placeable assets
        const defs = getPlaceableAssets(island.level)
        await Promise.all(defs.map(d => Assets.load(`/assets/${d.file}`)))
        if (cancelled) return

        // Place some on the grid
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

        // Ambient float
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

  const handleComplete = (questId: string) => {
    const quest = quests.find(q => q.id === questId)
    if (!quest || quest.status !== 'active') return

    setQuests(prev => prev.map(q =>
      q.id === questId ? { ...q, status: 'completed' as const, completedAt: Date.now() } : q
    ))

    setIsland(prev => {
      const newXp = prev.xp + quest.xpReward
      let level = prev.level
      const thresholds = [0, 60, 140, 240, 360, 520, 720, 960, 1240, 1600]
      while (level < 10 && newXp >= thresholds[level]) level++
      return {
        ...prev,
        xp: newXp,
        level,
        xpToNextLevel: thresholds[level] ?? 99999,
        streakCount: prev.streakCount + 1,
        lastQuestCompletedAt: Date.now(),
      }
    })

    const msgs: Record<string, string> = {
      flower: 'A flower bloomed on your island!',
      tree: 'A new tree is growing!',
      building: 'Your village is expanding!',
      character_chance: 'Something rustles in the bushes...',
    }
    setToast({ message: msgs[quest.rewardType] || 'Your island grew!', xp: quest.xpReward })
    setTimeout(() => setToast(null), 3000)
  }

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', position: 'relative' }}>
      {/* Sky gradient background */}
      <div
        ref={canvasRef}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(180deg, #87CEEB 0%, #B0E0E6 40%, #98D8C8 70%, #87CEEB 100%)',
        }}
      />

      {/* Loading / Error states */}
      {!pixiReady && !pixiError && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontFamily: 'system-ui', fontSize: 18,
          zIndex: 5,
        }}>
          Loading your island...
        </div>
      )}
      {pixiError && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          color: '#ff6b6b', fontFamily: 'system-ui', fontSize: 14,
          padding: 20, textAlign: 'center', zIndex: 5,
        }}>
          Failed to load island: {pixiError}
        </div>
      )}

      {/* UI overlay */}
      <StatusBar island={island} />
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
