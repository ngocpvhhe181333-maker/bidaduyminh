function allocateInteger(total, weights) {
  const amount = Math.max(0, Math.round(Number(total) || 0))
  const sum = weights.reduce((value, weight) => value + weight, 0)
  if (sum <= 0) return weights.map((_, index) => index === weights.length - 1 ? amount : 0)

  const exact = weights.map((weight) => amount * weight / sum)
  const allocated = exact.map(Math.floor)
  const remainder = amount - allocated.reduce((value, part) => value + part, 0)
  const byFraction = exact.map((value, index) => ({ index, fraction: value - allocated[index] }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index)
  for (let i = 0; i < remainder; i += 1) allocated[byFraction[i].index] += 1
  return allocated
}

export function allocateInvoiceToTables(invoice, sessionTransfers = []) {
  const transfers = [...sessionTransfers].sort((a, b) =>
    new Date(a.transferred_at) - new Date(b.transferred_at) || String(a.id).localeCompare(String(b.id)))
  if (transfers.length === 0) {
    return [{
      tableId: invoice.table_id,
      tableName: invoice.table_name,
      totalSeconds: invoice.duration_seconds,
      billedMinutes: invoice.billed_minutes,
      tableFee: invoice.table_fee,
      itemsFee: invoice.items_fee,
    }]
  }

  const started = new Date(invoice.started_at).getTime()
  const ended = new Date(invoice.ended_at).getTime()
  const segments = []
  let tableId = transfers[0].from_table_id
  let tableName = transfers[0].from_table_name
  let cursor = started

  for (const transfer of transfers) {
    const transferTime = Math.min(ended, Math.max(cursor, new Date(transfer.transferred_at).getTime()))
    segments.push({ tableId, tableName, weight: Math.max(0, transferTime - cursor) })
    tableId = transfer.to_table_id
    tableName = transfer.to_table_name
    cursor = transferTime
  }
  segments.push({ tableId, tableName, weight: Math.max(0, ended - cursor) })

  const weights = segments.map((segment) => segment.weight)
  const seconds = allocateInteger(invoice.duration_seconds, weights)
  const billedMinutes = allocateInteger(invoice.billed_minutes, weights)
  const tableFees = allocateInteger(invoice.table_fee, weights)
  const byTable = new Map()

  segments.forEach((segment, index) => {
    if (!byTable.has(segment.tableId)) {
      byTable.set(segment.tableId, {
        tableId: segment.tableId,
        tableName: segment.tableName,
        totalSeconds: 0,
        billedMinutes: 0,
        tableFee: 0,
        itemsFee: 0,
      })
    }
    const row = byTable.get(segment.tableId)
    row.totalSeconds += seconds[index]
    row.billedMinutes += billedMinutes[index]
    row.tableFee += tableFees[index]
  })

  // Món trên hóa đơn thuộc bàn cuối cùng vì hóa đơn chỉ lưu tổng món của cả phiên.
  if (!byTable.has(invoice.table_id)) {
    byTable.set(invoice.table_id, {
      tableId: invoice.table_id,
      tableName: invoice.table_name,
      totalSeconds: 0,
      billedMinutes: 0,
      tableFee: 0,
      itemsFee: 0,
    })
  }
  byTable.get(invoice.table_id).itemsFee += invoice.items_fee
  return [...byTable.values()]
}
