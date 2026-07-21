import { useEffect, useState } from 'react'
import { useGameStore } from '../state/gameStore'

interface Toast {
  id: string
  text: string
}

/** Small non-celebration notifications (a new quest flew in). */
export function ToastHost() {
  const [toasts, setToasts] = useState<Toast[]>([])
  const photoMode = useGameStore((s) => s.photoMode)

  useEffect(() => {
    // Only quests created after this session opened get a toast — the initial
    // backlog (which in firebase mode arrives asynchronously after mount)
    // must not fire a volley of owls.
    const mountedAt = Date.now()
    const seen = new Set(useGameStore.getState().quests.map((q) => q.id))
    const timers = new Set<ReturnType<typeof setTimeout>>()
    const unsub = useGameStore.subscribe((s, prev) => {
      if (s.quests === prev.quests) return
      for (const q of s.quests) {
        if (seen.has(q.id)) continue
        seen.add(q.id)
        if (q.createdAt < mountedAt - 5000) continue
        const toast = { id: q.id, text: `New quest: ${q.title}` }
        setToasts((t) => [...t.slice(-2), toast])
        window.dispatchEvent(new CustomEvent('aisleland-sfx', { detail: { name: 'owl_delivery' } }))
        const timer = setTimeout(() => {
          timers.delete(timer)
          setToasts((t) => t.filter((x) => x.id !== toast.id))
        }, 4500)
        timers.add(timer)
      }
    })
    return () => {
      unsub()
      for (const t of timers) clearTimeout(t)
    }
  }, [])

  if (toasts.length === 0 || photoMode) return null

  return (
    <div className="toast-host">
      {toasts.map((t) => (
        <div key={t.id} className="toast ui-card">
          <span className="toast-owl">📮</span>
          {t.text}
        </div>
      ))}
    </div>
  )
}
