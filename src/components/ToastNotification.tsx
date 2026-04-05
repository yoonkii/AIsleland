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
    background: 'rgba(40, 30, 20, 0.85)',
    backdropFilter: 'blur(10px)',
    borderRadius: 16,
    padding: '12px 24px',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    fontSize: 14,
    color: '#FFF5E1',
    fontFamily: 'system-ui, sans-serif',
    border: '1px solid rgba(255,200,100,0.3)',
    boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
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
    color: '#FFD700',
    fontWeight: 700,
  },
}
