export const ALLOCATION_COLORS = [
  '#007a60',
  '#008e6e',
  '#00a882',
  '#00bb96',
  '#00d4aa',
  '#50e3c5',
  '#80edd8',
]

export function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}
