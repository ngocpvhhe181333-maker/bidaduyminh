export function calculateDiscount(subtotal, type, rawValue) {
  if (type === 'none') return { amount: 0, valid: true }

  const value = rawValue === '' ? 0 : Number(rawValue)
  if (!Number.isInteger(value) || value < 0) return { amount: 0, valid: false }
  if (type === 'percent') {
    if (value > 100) return { amount: 0, valid: false }
    return { amount: Math.round(subtotal * value / 100), valid: true }
  }
  if (type === 'amount') {
    if (value > subtotal) return { amount: 0, valid: false }
    return { amount: value, valid: true }
  }
  return { amount: 0, valid: false }
}
