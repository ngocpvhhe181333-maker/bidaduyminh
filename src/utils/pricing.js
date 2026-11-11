/**
 * Tính tiền giờ chơi khớp hoàn toàn với hàm PostgreSQL `public.calculate_table_fee`.
 */
export function calculateTableFee({
  startedAt,
  endedAt = new Date(),
  hourlyRate,
  roundingMinutes = 15,
  roundingMode = 'ceil',
  minMinutes = 0,
}) {
  const startMs = new Date(startedAt).getTime()
  const endMs = new Date(endedAt).getTime()

  if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs <= startMs) {
    return { durationSeconds: 0, billedMinutes: 0, tableFee: 0 }
  }

  const durationSeconds = Math.max(0, Math.floor((endMs - startMs) / 1000))
  if (durationSeconds === 0) {
    return { durationSeconds: 0, billedMinutes: 0, tableFee: 0 }
  }

  const elapsedMinutes = Math.max(1, Math.ceil(durationSeconds / 60))
  const step = Math.max(1, Number(roundingMinutes) || 15)
  const rate = Math.max(0, Number(hourlyRate) || 0)
  const minMins = Math.max(0, Number(minMinutes) || 0)

  let billedMinutes
  if (roundingMode === 'exact') {
    billedMinutes = elapsedMinutes
  } else if (roundingMode === 'round') {
    billedMinutes = Math.max(step, Math.round(elapsedMinutes / step) * step)
  } else {
    billedMinutes = Math.ceil(elapsedMinutes / step) * step
  }

  billedMinutes = Math.max(billedMinutes, minMins)
  const tableFee = Math.round((billedMinutes * rate) / 60)

  return {
    durationSeconds,
    billedMinutes,
    tableFee,
  }
}

export function getEffectiveTablePricing(table, tableTypesMap) {
  const type = table.table_type || tableTypesMap?.[table.table_type_id] || {}
  return {
    typeName: type.name || 'Tiêu chuẩn',
    hourlyRate: table.custom_hourly_rate ?? type.hourly_rate ?? 50000,
    roundingMinutes: table.custom_rounding_minutes ?? type.rounding_minutes ?? 15,
    roundingMode: table.custom_rounding_mode ?? type.rounding_mode ?? 'ceil',
    minMinutes: table.custom_min_minutes ?? type.min_minutes ?? 0,
    hasCustomOverride:
      table.custom_hourly_rate !== null && table.custom_hourly_rate !== undefined ||
      table.custom_rounding_minutes !== null && table.custom_rounding_minutes !== undefined ||
      table.custom_rounding_mode !== null && table.custom_rounding_mode !== undefined ||
      table.custom_min_minutes !== null && table.custom_min_minutes !== undefined,
  }
}
