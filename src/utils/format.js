export function formatVnd(amount) {
  const num = Number(amount) || 0
  return `${new Intl.NumberFormat('vi-VN').format(Math.round(num))} ₫`
}

export function formatDateTime(isoString) {
  if (!isoString) return '—'
  const d = new Date(isoString)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatTimeOnly(isoString) {
  if (!isoString) return '—'
  const d = new Date(isoString)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

export function formatDateOnly(isoString) {
  if (!isoString) return '—'
  const d = new Date(isoString)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export function formatDurationHms(totalSeconds) {
  const secs = Math.max(0, Math.floor(Number(totalSeconds) || 0))
  const hours = Math.floor(secs / 3600)
  const mins = Math.floor((secs % 3600) / 60)
  const remSecs = secs % 60
  return [hours, mins, remSecs].map((v) => String(v).padStart(2, '0')).join(':')
}

export function formatMinutesReadable(minutes) {
  const m = Math.max(0, Math.round(Number(minutes) || 0))
  const hours = Math.floor(m / 60)
  const mins = m % 60
  if (hours === 0) return `${mins} phút`
  if (mins === 0) return `${hours} giờ`
  return `${hours} giờ ${mins} phút`
}

export function toLocalDateInputValue(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function getRoundingLabel(roundingMode, roundingMinutes, minMinutes = 0) {
  let modeText = `Làm tròn lên mỗi ${roundingMinutes} phút`
  if (roundingMode === 'exact') {
    modeText = 'Tính đúng từng phút'
  } else if (roundingMode === 'round') {
    modeText = `Làm tròn gần nhất (${roundingMinutes} phút)`
  }
  if (minMinutes > 0) {
    return `${modeText} • Tối thiểu ${minMinutes} phút`
  }
  return modeText
}

export function getPaymentMethodLabel(method) {
  return method === 'transfer' ? 'Chuyển khoản' : 'Tiền mặt'
}

export function getInvoiceStatusLabel(status) {
  if (status === 'voided') return 'Đã hủy'
  if (status === 'adjusted') return 'Đã sửa'
  return 'Đã thanh toán'
}
