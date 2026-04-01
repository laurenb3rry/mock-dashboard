export const ALLOCATION_COLORS = [
  '#005B47',
  '#007A60',
  '#009978',
  '#00B38C',
  '#00D4AA',
  '#38E0BB',
  '#72EBD0',
]

export function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}
