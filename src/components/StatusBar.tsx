import type { IslandState } from '../game/IslandState'
import { FONT } from '../theme'

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
    background: 'rgba(255,255,255,0.22)',
    backdropFilter: 'blur(12px)',
    borderRadius: 20,
    padding: '6px 14px',
    fontSize: 14,
    fontWeight: 800,
    color: '#C4963A',
    fontFamily: FONT,
    border: '1px solid rgba(255,255,255,0.3)',
  },
  xpContainer: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 2,
  },
  xpBarOuter: {
    width: 140,
    height: 10,
    background: 'rgba(255,255,255,0.2)',
    borderRadius: 8,
    overflow: 'hidden',
    border: '1px solid rgba(255,255,255,0.15)',
  },
  xpBarInner: {
    height: '100%',
    background: 'linear-gradient(90deg, #F2C464, #E8A848)',
    borderRadius: 8,
    transition: 'width 0.5s ease',
  },
  xpText: {
    fontSize: 11,
    color: 'rgba(58,54,50,0.6)',
    fontFamily: FONT,
  },
  streak: {
    background: 'rgba(224,122,110,0.2)',
    backdropFilter: 'blur(12px)',
    borderRadius: 12,
    padding: '4px 10px',
    fontSize: 12,
    color: '#C4603A',
    fontFamily: FONT,
    border: '1px solid rgba(224,122,110,0.3)',
  },
}
