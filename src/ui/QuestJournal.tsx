import { useEffect, useState } from 'react'
import { SOURCE_COLORS } from '../design/tokens'
import { useGameStore } from '../state/gameStore'
import type { Quest, QuestSource } from '../state/types'

function sfx(name: string) {
  window.dispatchEvent(new CustomEvent('aisleland-sfx', { detail: { name } }))
}

const SOURCE_LABEL: Record<QuestSource, string> = {
  gmail: 'Gmail', docs: 'Docs', sheets: 'Sheets', slides: 'Slides', calendar: 'Calendar',
}

function SourceIcon({ source }: { source: QuestSource }) {
  switch (source) {
    case 'gmail':
      return <svg viewBox="0 0 24 24" width="14" height="14"><path d="M2 5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5zm2 .8V19h16V5.8l-8 6-8-6zM19.2 5H4.8L12 10.4 19.2 5z" fill="currentColor"/></svg>
    case 'docs':
      return <svg viewBox="0 0 24 24" width="14" height="14"><path d="M6 2a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6H6zm7 1.5L18.5 9H13V3.5zM8 12h8v2H8v-2zm0 4h8v2H8v-2z" fill="currentColor"/></svg>
    case 'sheets':
      return <svg viewBox="0 0 24 24" width="14" height="14"><path d="M4 4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4zm2 4v3h5V8H6zm7 0v3h5V8h-5zm-7 5v3h5v-3H6zm7 0v3h5v-3h-5z" fill="currentColor"/></svg>
    case 'slides':
      return <svg viewBox="0 0 24 24" width="14" height="14"><path d="M3 4h18v12H3V4zm2 2v8h14V6H5zm3 14h8v2H8v-2zm3-4h2v4h-2v-4z" fill="currentColor"/></svg>
    case 'calendar':
      return <svg viewBox="0 0 24 24" width="14" height="14"><path d="M7 2v2H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2V2h-2v2H9V2H7zm-2 7h14v10H5V9zm2 2v2h2v-2H7zm4 0v2h2v-2h-2z" fill="currentColor"/></svg>
  }
}

function Leaves({ n }: { n: number }) {
  return (
    <span className="quest-leaves" title={`Difficulty ${n}`}>
      {Array.from({ length: n }, (_, i) => (
        <svg key={i} viewBox="0 0 12 12" width="11" height="11">
          <path d="M6 1C9 2 11 5 10.5 9 6.5 9.5 3 8 2 4.5 3.5 2.5 4.5 1.5 6 1z" fill="var(--accent-green)" opacity={0.9 - i * 0.12} />
        </svg>
      ))}
    </span>
  )
}

function QuestCard({ quest }: { quest: Quest }) {
  const completeQuest = useGameStore((s) => s.completeQuest)
  const mode = useGameStore((s) => s.mode)
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle')

  const onComplete = async () => {
    if (state !== 'idle') return
    setState('busy')
    sfx('ui_tap')
    try {
      await completeQuest(quest.id)
      setState('done')
    } catch (e) {
      console.warn('complete failed', e)
      setState('error')
      setTimeout(() => setState('idle'), 2500)
    }
  }

  return (
    <div className="quest-card" data-done={state === 'done'}>
      <div className="quest-card-top">
        <span className="quest-chip" style={{ background: SOURCE_COLORS[quest.source] }}>
          <SourceIcon source={quest.source} />
          {SOURCE_LABEL[quest.source]}
        </span>
        <Leaves n={quest.difficulty} />
      </div>
      <p className="quest-title">{quest.title}</p>
      <div className="quest-card-bottom">
        <span className="xp-pill">+{quest.xpReward} xp</span>
        <button className="complete-btn" onClick={onComplete} disabled={state !== 'idle'}>
          {state === 'busy' ? '…' : state === 'error' ? 'Try later' : mode === 'demo' ? 'Complete' : 'I did it!'}
        </button>
      </div>
    </div>
  )
}

export function QuestJournal() {
  const open = useGameStore((s) => s.journalOpen)
  const setOpen = useGameStore((s) => s.setJournalOpen)
  const quests = useGameStore((s) => s.quests)
  const celebration = useGameStore((s) => s.celebration)
  const mode = useGameStore((s) => s.mode)

  // celebrations own the screen
  useEffect(() => {
    if (celebration && open) setOpen(false)
  }, [celebration, open, setOpen])

  return (
    <>
      {open && <div className="journal-scrim" onClick={() => setOpen(false)} />}
      <aside className={`journal ${open ? 'open' : ''}`}>
        <div className="journal-head">
          <h2>Quests</h2>
          <button className="icon-btn" onClick={() => { setOpen(false); sfx('ui_tap') }} aria-label="Close">
            <svg viewBox="0 0 24 24" width="18" height="18"><path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"/></svg>
          </button>
        </div>
        <p className="journal-sub">
          {mode === 'demo'
            ? 'Demo quests — complete them to grow your island.'
            : 'Real tasks from your Workspace. Finish them out there, then check in here.'}
        </p>
        <div className="journal-list">
          {quests.length === 0 && (
            <div className="journal-empty">
              <div className="journal-empty-art">☁️</div>
              <p>All clear! New quests fly in as your work day happens.</p>
            </div>
          )}
          {quests.map((q) => <QuestCard key={q.id} quest={q} />)}
        </div>
      </aside>
    </>
  )
}
