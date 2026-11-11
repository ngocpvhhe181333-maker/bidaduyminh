function pad2(n) {
  return String(n).padStart(2, '0')
}

export function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

export function daysInMonth(year, month) {
  const days = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  return days[month - 1] || 30
}

export function formatYmd(year, month, day) {
  return `${String(year).padStart(4, '0')}-${pad2(month)}-${pad2(day)}`
}

export function parseYmd(str) {
  const [y, m, d] = (str || '').split('-').map(Number)
  if (!y || !m || !d) return null
  return { y, m, d }
}

export function shiftYmd(str, deltaDays) {
  const p = parseYmd(str)
  if (!p) return str
  const dt = new Date(Date.UTC(p.y, p.m - 1, p.d + deltaDays))
  return formatYmd(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate())
}

export function diffDaysInclusive(startStr, endStr) {
  const a = parseYmd(startStr)
  const b = parseYmd(endStr)
  if (!a || !b) return 1
  const msA = Date.UTC(a.y, a.m - 1, a.d)
  const msB = Date.UTC(b.y, b.m - 1, b.d)
  return Math.max(1, Math.round((msB - msA) / 86400000) + 1)
}

/**
 * Trả về 0 = Chủ nhật, 1 = Thứ 2, ..., 6 = Thứ 7 theo lịch UTC từ YYYY-MM-DD.
 */
export function getDayOfWeekFromYmd(str) {
  const p = parseYmd(str)
  if (!p) return 0
  return new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay()
}

export const REPORT_PRESETS = [
  { id: 'today', label: 'Hôm nay' },
  { id: 'yesterday', label: 'Hôm qua' },
  { id: 'thisWeek', label: 'Tuần này' },
  { id: 'lastWeek', label: 'Tuần trước' },
  { id: 'thisMonth', label: 'Tháng này' },
  { id: 'lastMonth', label: 'Tháng trước' },
  { id: 'thisQuarter', label: 'Quý này' },
  { id: 'lastQuarter', label: 'Quý trước' },
  { id: 'thisYear', label: 'Năm này' },
  { id: 'lastYear', label: 'Năm trước' },
]

export function getRangeForPreset(presetId, todayStr) {
  const p = parseYmd(todayStr)
  if (!p) return { startDate: todayStr, endDate: todayStr }

  const dow = getDayOfWeekFromYmd(todayStr)
  const offsetToMonday = dow === 0 ? -6 : 1 - dow

  switch (presetId) {
    case 'today':
      return { startDate: todayStr, endDate: todayStr }
    case 'yesterday': {
      const yest = shiftYmd(todayStr, -1)
      return { startDate: yest, endDate: yest }
    }
    case 'thisWeek': {
      const mon = shiftYmd(todayStr, offsetToMonday)
      const sun = shiftYmd(mon, 6)
      return { startDate: mon, endDate: sun }
    }
    case 'lastWeek': {
      const thisMon = shiftYmd(todayStr, offsetToMonday)
      const prevMon = shiftYmd(thisMon, -7)
      const prevSun = shiftYmd(prevMon, 6)
      return { startDate: prevMon, endDate: prevSun }
    }
    case 'thisMonth': {
      return {
        startDate: formatYmd(p.y, p.m, 1),
        endDate: formatYmd(p.y, p.m, daysInMonth(p.y, p.m)),
      }
    }
    case 'lastMonth': {
      const pm = p.m === 1 ? 12 : p.m - 1
      const py = p.m === 1 ? p.y - 1 : p.y
      return {
        startDate: formatYmd(py, pm, 1),
        endDate: formatYmd(py, pm, daysInMonth(py, pm)),
      }
    }
    case 'thisQuarter': {
      const qStartMonth = Math.floor((p.m - 1) / 3) * 3 + 1
      const qEndMonth = qStartMonth + 2
      return {
        startDate: formatYmd(p.y, qStartMonth, 1),
        endDate: formatYmd(p.y, qEndMonth, daysInMonth(p.y, qEndMonth)),
      }
    }
    case 'lastQuarter': {
      const currQStart = Math.floor((p.m - 1) / 3) * 3 + 1
      const prevQEndMonth = currQStart === 1 ? 12 : currQStart - 1
      const prevQYear = currQStart === 1 ? p.y - 1 : p.y
      const prevQStartMonth = prevQEndMonth - 2
      return {
        startDate: formatYmd(prevQYear, prevQStartMonth, 1),
        endDate: formatYmd(prevQYear, prevQEndMonth, daysInMonth(prevQYear, prevQEndMonth)),
      }
    }
    case 'thisYear':
      return { startDate: formatYmd(p.y, 1, 1), endDate: formatYmd(p.y, 12, 31) }
    case 'lastYear':
      return { startDate: formatYmd(p.y - 1, 1, 1), endDate: formatYmd(p.y - 1, 12, 31) }
    default:
      return { startDate: todayStr, endDate: todayStr }
  }
}

export function getPreviousComparisonRange(startStr, endStr, presetId, todayStr) {
  if (presetId === 'thisWeek') return getRangeForPreset('lastWeek', todayStr)
  if (presetId === 'thisMonth') return getRangeForPreset('lastMonth', todayStr)
  if (presetId === 'thisQuarter') return getRangeForPreset('lastQuarter', todayStr)
  if (presetId === 'thisYear') return getRangeForPreset('lastYear', todayStr)

  const span = diffDaysInclusive(startStr, endStr)
  return {
    startDate: shiftYmd(startStr, -span),
    endDate: shiftYmd(startStr, -1),
  }
}

export function enumerateDateStrings(startStr, endStr, maxDays = 370) {
  const p = parseYmd(startStr)
  if (!p || !endStr || startStr > endStr) return []

  const result = []
  let y = p.y
  let m = p.m
  let d = p.d

  for (let guard = 0; guard < maxDays; guard += 1) {
    const key = formatYmd(y, m, d)
    result.push({
      key,
      shortLabel: `${pad2(d)}/${pad2(m)}`,
      fullLabel: `${pad2(d)}/${pad2(m)}/${y}`,
    })
    if (key >= endStr) break
    d += 1
    if (d > daysInMonth(y, m)) {
      d = 1
      m += 1
      if (m > 12) {
        m = 1
        y += 1
      }
    }
  }
  return result
}
