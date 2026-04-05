import type { IslandState } from '../game/IslandState'

interface Props {
  island: IslandState
}

export function StatusBar({ island }: Props) {
  const xpProgress = island.xpToNextLevel > 0
    ? Math.min((island.xp / island.xpToNextLevel) * 100, 100)
    : 100

  return (
    <div style={styles.container}>
      <div style={styles.levelBadge}>Lv. {island.level}</div>
      <div style={styles.xpContainer}>
        <div style={styles.xpBarOuter}>
          <div style={{ ...styles.xpBarInner, width: `${xpProgress}%` }} />
        </div>
        <span style={styles.xpText}>{island.xp} / {island.xpToNextLevel} XP</span>
      </div>
      {island.streakCount > 0 && (
        <div style={styles.streak}>{island.streakCount} streak</div>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'absolute',
    top: 16,
    left: 16,
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    zIndex: 10,
  },
  levelBadge: {
    background: 'rgba(0,0,0,0.5)',
    backdropFilter: 'blur(8px)',
    borderRadius: 20,
    padding: '6px 14px',
    fontSize: 14,
    fontWeight: 700,
    color: '#FFD700',
    fontFamily: 'system-ui, sans-serif',
  },
  xpContainer: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 2,
  },
  xpBarOuter: {
    width: 140,
    height: 12,
    background: 'rgba(0,0,0,0.3)',
    borderRadius: 10,
    overflow: 'hidden',
  },
  xpBarInner: {
    height: '100%',
    background: 'linear-gradient(90deg, #FFD700, #FFA500)',
    borderRadius: 10,
    transition: 'width 0.5s ease',
  },
  xpText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
    fontFamily: 'system-ui, sans-serif',
  },
  streak: {
    background: 'rgba(255,100,50,0.6)',
    backdropFilter: 'blur(8px)',
    borderRadius: 12,
    padding: '4px 10px',
    fontSize: 12,
    color: '#fff',
    fontFamily: 'system-ui, sans-serif',
  },
}
