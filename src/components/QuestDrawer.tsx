import type { Quest } from '../game/QuestManager'
import { getSourceIcon, getSourceLabel, getDifficultyLabel } from '../game/QuestManager'
import { FONT } from '../theme'

interface Props {
  quests: Quest[]
  open: boolean
  onToggle: () => void
  onCompleteQuest: (questId: string) => void
}

export function QuestDrawer({ quests, open, onToggle, onCompleteQuest }: Props) {
  const activeQuests = quests.filter(q => q.status === 'active')
  const completedCount = quests.filter(q => q.status === 'completed').length

  return (
    <>
      {/* Toggle button — always visible */}
      <button className="btn-glass" onClick={onToggle} style={styles.toggleBtn}>
        <span style={styles.toggleIcon}>📋</span>
        {activeQuests.length > 0 && (
          <span style={styles.badge}>{activeQuests.length}</span>
        )}
      </button>

      {/* Drawer panel */}
      <div style={{
        ...styles.drawer,
        transform: open ? 'translateY(0)' : 'translateY(calc(100% - 0px))',
      }}>
        <div style={styles.handle} onClick={onToggle}>
          <div style={styles.handleBar} />
        </div>

        <div style={styles.header}>
          <h2 style={styles.title}>Quests</h2>
          <span style={styles.subtitle}>{completedCount} completed today</span>
        </div>

        <div style={styles.questList}>
          {activeQuests.map(quest => (
            <div className="quest-card" key={quest.id} style={styles.questCard}>
              <div style={{
                ...styles.sourceLabel,
                color: getSourceColor(quest.source),
              }}>
                {getSourceIcon(quest.source)} {getSourceLabel(quest.source)}
              </div>
              <div style={styles.questTitle}>{quest.title}</div>
              <div style={styles.questMeta}>
                <span style={styles.questXp}>+{quest.xpReward} XP</span>
                <span style={styles.questDiff}>{getDifficultyLabel(quest.difficulty)}</span>
              </div>
              <button
                className="complete-btn"
                style={styles.completeBtn}
                onClick={() => onCompleteQuest(quest.id)}
              >
                Complete
              </button>
            </div>
          ))}

          {activeQuests.length === 0 && (
            <div style={styles.emptyState}>
              <span style={{ fontSize: 32 }}>🏝️</span>
              <p style={{ margin: '8px 0 0', opacity: 0.6 }}>
                No active quests. Your island is resting.
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

function getSourceColor(source: string): string {
  switch (source) {
    case 'gmail': return '#E07A6E'
    case 'docs': return '#7EAED4'
    case 'sheets': return '#6BAF8D'
    case 'slides': return '#E8B44C'
    case 'calendar': return '#8CC5A2'
    default: return '#A09A94'
  }
}

const styles: Record<string, React.CSSProperties> = {
  toggleBtn: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 52,
    height: 52,
    borderRadius: '50%',
    background: 'rgba(255,255,255,0.22)',
    backdropFilter: 'blur(12px)',
    border: '1px solid rgba(255,255,255,0.3)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 15,
    boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
  },
  toggleIcon: {
    fontSize: 22,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 20,
    height: 20,
    borderRadius: '50%',
    background: '#E07A6E',
    color: '#fff',
    fontSize: 11,
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: FONT,
  },
  drawer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: '60vh',
    background: 'rgba(255, 253, 248, 0.92)',
    backdropFilter: 'blur(20px)',
    borderRadius: '20px 20px 0 0',
    border: '1px solid rgba(255,255,255,0.4)',
    borderBottom: 'none',
    boxShadow: '0 -4px 30px rgba(0,0,0,0.08)',
    transition: 'transform 0.3s ease',
    zIndex: 20,
    display: 'flex',
    flexDirection: 'column',
    fontFamily: FONT,
  },
  handle: {
    padding: '10px 0 6px',
    cursor: 'pointer',
    display: 'flex',
    justifyContent: 'center',
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    background: 'rgba(0,0,0,0.12)',
  },
  header: {
    padding: '4px 20px 12px',
    borderBottom: '1px solid rgba(0,0,0,0.06)',
  },
  title: {
    fontSize: 16,
    fontWeight: 600,
    color: '#3A3632',
    margin: 0,
  },
  subtitle: {
    fontSize: 11,
    color: '#A09A94',
  },
  questList: {
    padding: '12px 20px',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  questCard: {
    background: 'rgba(0,0,0,0.02)',
    border: '1px solid rgba(0,0,0,0.06)',
    borderRadius: 12,
    padding: 14,
    position: 'relative',
  },
  sourceLabel: {
    fontSize: 10,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: 4,
    fontWeight: 600,
  },
  questTitle: {
    fontSize: 14,
    fontWeight: 500,
    color: '#3A3632',
    marginBottom: 8,
    lineHeight: 1.3,
  },
  questMeta: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  questXp: {
    fontSize: 12,
    color: '#C4963A',
    fontWeight: 600,
  },
  questDiff: {
    fontSize: 11,
    color: '#A09A94',
  },
  completeBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    background: 'rgba(140, 197, 162, 0.15)',
    border: '1px solid rgba(140, 197, 162, 0.3)',
    borderRadius: 8,
    padding: '4px 12px',
    color: '#5A9E73',
    fontSize: 11,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: FONT,
  },
  emptyState: {
    textAlign: 'center' as const,
    padding: '24px 0',
    color: '#A09A94',
    fontSize: 13,
  },
}
