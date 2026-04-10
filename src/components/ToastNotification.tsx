import { FONT } from '../theme'

interface Props {
  message: string
  xp: number
}

export function ToastNotification({ message, xp }: Props) {
  return (
    <div style={styles.toast}>
      <span style={styles.icon}>🌷</span>
      <span style={styles.message}>{message}</span>
      <span style={styles.xp}>+{xp} XP</span>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  toast: {
    position: 'absolute',
    bottom: 24,
    left: '50%',
    transform: 'translateX(-50%)',
    background: 'rgba(255, 253, 248, 0.92)',
    backdropFilter: 'blur(16px)',
    borderRadius: 16,
    padding: '12px 24px',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    fontSize: 14,
    color: '#3A3632',
    fontFamily: FONT,
    border: '1px solid rgba(255,255,255,0.4)',
    boxShadow: '0 4px 24px rgba(0,0,0,0.1)',
    animation: 'slideUp 0.4s ease-out',
    zIndex: 20,
  },
  icon: {
    fontSize: 20,
  },
  message: {
    maxWidth: 260,
  },
  xp: {
    color: '#C4963A',
    fontWeight: 700,
  },
}
