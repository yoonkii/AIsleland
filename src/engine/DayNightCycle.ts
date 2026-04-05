// Day/night tinting using multiply blend for watercolor art
// Avoids flat color overlay that looks muddy on warm watercolors

export interface TimeOfDay {
  name: 'morning' | 'day' | 'evening' | 'night'
  tint: number
  alpha: number // overlay opacity
}

export function getTimeOfDay(): TimeOfDay {
  const hour = new Date().getHours()

  if (hour >= 5 && hour < 8) {
    // Morning: warm golden tint
    return { name: 'morning', tint: 0xFFE4B5, alpha: 0.15 }
  } else if (hour >= 8 && hour < 17) {
    // Day: no tint
    return { name: 'day', tint: 0xFFFFFF, alpha: 0 }
  } else if (hour >= 17 && hour < 20) {
    // Evening: warm amber
    return { name: 'evening', tint: 0xFFB347, alpha: 0.2 }
  } else {
    // Night: soft blue
    return { name: 'night', tint: 0x6B7DB3, alpha: 0.3 }
  }
}

// Interpolated tint for smooth transitions
export function getTintColor(hour: number): { tint: number; alpha: number } {
  // Simplified: snap to nearest time of day
  // Future: lerp between adjacent time slots
  if (hour >= 5 && hour < 8) return { tint: 0xFFE4B5, alpha: 0.15 }
  if (hour >= 8 && hour < 17) return { tint: 0xFFFFFF, alpha: 0 }
  if (hour >= 17 && hour < 20) return { tint: 0xFFB347, alpha: 0.2 }
  return { tint: 0x6B7DB3, alpha: 0.3 }
}
