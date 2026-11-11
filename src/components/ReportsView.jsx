import { useEffect, useMemo, useState } from 'react'
import { api } from '../services/api'
import {
  formatDateOnly,
  formatDateTime,
  formatMinutesReadable,
  formatVnd,
  toLocalDateInputValue,
} from '../utils/format'

export function ReportsView() {
  const [startDate, setStartDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 6)
    return toLocalDateInputValue(d)
  })
  const [endDate, setEndDate] = useState(() => toLocalDateInputValue())
  const [data, setData] = useState({ invoices: [], shifts: [], tables: [] })
  const [loadedRange, setLoadedRange] = useState('')
  const [error, setError] = useState('')

  const rangeKey = `${startDate}|${endDate}`
  const loading = loadedRange !== rangeKey

  useEffect(() => {
    let active = true

    async function fetchRange() {
      try {
        const res = await api.fetchReportsData({ startDate, endDate })
        if (!active) return
        setData(res)
        setError('')
        setLoadedRange(rangeKey)
      } catch (err) {
        if (!active) return
        setError(err.message || 'Không thể tải báo cáo.')
        setLoadedRange(rangeKey)
      }
    }

    fetchRange()
    return () => {
      active = false
    }
  }, [rangeKey, startDate, endDate])

  function applyPreset(days) {
    const end = new Date()
    const start = new Date()
    start.setDate(end.getDate() - days)
    setStartDate(toLocalDateInputValue(start))
    setEndDate(toLocalDateInputValue(end))
  }

  const report = useMemo(() => {
    const validInvoices = data.invoices.filter((i) => i.status !== 'voided')
    const voidedCount = data.invoices.filter((i) => i.status === 'voided').length

    let totalRevenue = 0
    let tableRevenue = 0
    let itemsRevenue = 0
    let retailRevenue = 0
    let discountTotal = 0
    let cashRevenue = 0
    let transferRevenue = 0

    const byDayMap = {}
    const byTableMap = {}

    for (const t of data.tables) {
      byTableMap[t.id] = {
        tableId: t.id,
        tableName: t.name,
        sessionsCount: 0,
        totalSeconds: 0,
        billedMinutes: 0,
        tableFee: 0,
        itemsFee: 0,
      }
    }

    for (const inv of validInvoices) {
      totalRevenue += inv.total_amount
      tableRevenue += inv.table_fee
      itemsRevenue += inv.items_fee
      if (inv.sale_type === 'retail') retailRevenue += inv.total_amount
      discountTotal += inv.discount_amount
      if (inv.payment_method === 'cash') cashRevenue += inv.total_amount
      else transferRevenue += inv.total_amount

      const d = new Date(inv.paid_at)
      const dayKey = toLocalDateInputValue(d)
      if (!byDayMap[dayKey]) {
        byDayMap[dayKey] = {
          dayKey,
          label: formatDateOnly(inv.paid_at),
          invoiceCount: 0,
          tableFee: 0,
          itemsFee: 0,
          discount: 0,
          total: 0,
          cash: 0,
          transfer: 0,
        }
      }
      const dayRow = byDayMap[dayKey]
      dayRow.invoiceCount += 1
      dayRow.tableFee += inv.table_fee
      dayRow.itemsFee += inv.items_fee
      dayRow.discount += inv.discount_amount
      dayRow.total += inv.total_amount
      if (inv.payment_method === 'cash') dayRow.cash += inv.total_amount
      else dayRow.transfer += inv.total_amount

      if (inv.sale_type === 'retail' || !inv.table_id) continue

      if (!byTableMap[inv.table_id]) {
        byTableMap[inv.table_id] = {
          tableId: inv.table_id,
          tableName: inv.table_name,
          sessionsCount: 0,
          totalSeconds: 0,
          billedMinutes: 0,
          tableFee: 0,
          itemsFee: 0,
        }
      }
      const tblRow = byTableMap[inv.table_id]
      tblRow.sessionsCount += 1
      tblRow.totalSeconds += inv.duration_seconds
      tblRow.billedMinutes += inv.billed_minutes
      tblRow.tableFee += inv.table_fee
      tblRow.itemsFee += inv.items_fee
    }

    const byDay = Object.values(byDayMap).sort((a, b) => b.dayKey.localeCompare(a.dayKey))
    const byTable = Object.values(byTableMap)

    const byShift = data.shifts.map((sh) => {
      const shInvs = validInvoices.filter((i) => i.shift_id === sh.id)
      const tFee = shInvs.reduce((s, i) => s + i.table_fee, 0)
      const iFee = shInvs.reduce((s, i) => s + i.items_fee, 0)
      const disc = shInvs.reduce((s, i) => s + i.discount_amount, 0)
      const tot = shInvs.reduce((s, i) => s + i.total_amount, 0)
      const cash = shInvs.filter((i) => i.payment_method === 'cash').reduce((s, i) => s + i.total_amount, 0)
      const transfer = shInvs.filter((i) => i.payment_method === 'transfer').reduce((s, i) => s + i.total_amount, 0)
      return {
        ...sh,
        invoiceCount: shInvs.length,
        calcTableRevenue: tFee,
        calcItemsRevenue: iFee,
        calcDiscount: disc,
        calcTotal: tot,
        calcCash: cash,
        calcTransfer: transfer,
      }
    })

    return {
      validCount: validInvoices.length,
      voidedCount,
      totalRevenue,
      tableRevenue,
      itemsRevenue,
      retailRevenue,
      discountTotal,
      cashRevenue,
      transferRevenue,
      byDay,
      byTable,
      byShift,
    }
  }, [data])

  return (
    <div className="page-stack">
      <div className="card">
        <div className="report-toolbar">
          <div className="chip-row">
            <button type="button" className="chip" onClick={() => applyPreset(0)}>
              Hôm nay
            </button>
            <button type="button" className="chip" onClick={() => applyPreset(6)}>
              7 ngày qua
            </button>
            <button type="button" className="chip" onClick={() => applyPreset(29)}>
              30 ngày qua
            </button>
          </div>
          <div className="date-range-inputs">
            <label className="field">
              <span>Từ ngày</span>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </label>
            <label className="field">
              <span>Đến ngày</span>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </label>
          </div>
        </div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      <div className="kpi-grid-reports">
        <div className="card kpi-card">
          <span className="kpi-label">Tổng doanh thu thực thu</span>
          <strong className="kpi-big num text-primary">{formatVnd(report.totalRevenue)}</strong>
          <span className="muted-xs">
            {report.validCount} hóa đơn hợp lệ{report.voidedCount > 0 ? ` • ${report.voidedCount} đã hủy` : ''}
          </span>
        </div>
        <div className="card kpi-card">
          <span className="kpi-label">Tiền giờ chơi</span>
          <strong className="kpi-big num">{formatVnd(report.tableRevenue)}</strong>
          <span className="muted-xs">
            Tiền món: <strong className="num">{formatVnd(report.itemsRevenue)}</strong>
          </span>
          <span className="muted-xs">
            Trong đó bán lẻ: <strong className="num">{formatVnd(report.retailRevenue)}</strong>
          </span>
        </div>
        <div className="card kpi-card">
          <span className="kpi-label">Tiền mặt vs Chuyển khoản</span>
          <div className="live-row" style={{ marginTop: '0.25rem' }}>
            <span>Tiền mặt:</span>
            <strong className="num">{formatVnd(report.cashRevenue)}</strong>
          </div>
          <div className="live-row">
            <span>Chuyển khoản:</span>
            <strong className="num">{formatVnd(report.transferRevenue)}</strong>
          </div>
        </div>
        <div className="card kpi-card">
          <span className="kpi-label">Tổng giảm giá</span>
          <strong className="kpi-big num">{formatVnd(report.discountTotal)}</strong>
          <span className="muted-xs">Giảm giá sau thanh toán bởi Admin</span>
        </div>
      </div>

      {loading ? (
        <div className="card">
          <p className="muted-sm">Đang tổng hợp báo cáo...</p>
        </div>
      ) : (
        <>
          <div className="card">
            <h3>Số phiên chơi &amp; thời gian sử dụng từng bàn</h3>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Bàn</th>
                    <th className="num">Số phiên</th>
                    <th className="num">Tổng thời gian chơi</th>
                    <th className="num">Thời gian tính tiền</th>
                    <th className="num">Doanh thu giờ</th>
                    <th className="num">Doanh thu món</th>
                  </tr>
                </thead>
                <tbody>
                  {report.byTable.map((row) => (
                    <tr key={row.tableId}>
                      <td>
                        <strong>{row.tableName}</strong>
                      </td>
                      <td className="num">{row.sessionsCount}</td>
                      <td className="num">{formatMinutesReadable(Math.round(row.totalSeconds / 60))}</td>
                      <td className="num">{formatMinutesReadable(row.billedMinutes)}</td>
                      <td className="num">{formatVnd(row.tableFee)}</td>
                      <td className="num">{formatVnd(row.itemsFee)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <h3>Doanh thu theo ngày (tách tiền giờ &amp; tiền món)</h3>
            {report.byDay.length === 0 ? (
              <p className="muted-sm">Không có dữ liệu trong khoảng thời gian đã chọn.</p>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Ngày</th>
                      <th className="num">Số HĐ</th>
                      <th className="num">Tiền giờ</th>
                      <th className="num">Tiền món</th>
                      <th className="num">Giảm giá</th>
                      <th className="num">Tiền mặt</th>
                      <th className="num">Chuyển khoản</th>
                      <th className="num">Thực thu</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.byDay.map((row) => (
                      <tr key={row.dayKey}>
                        <td>
                          <strong>{row.label}</strong>
                        </td>
                        <td className="num">{row.invoiceCount}</td>
                        <td className="num">{formatVnd(row.tableFee)}</td>
                        <td className="num">{formatVnd(row.itemsFee)}</td>
                        <td className="num">{row.discount > 0 ? `-${formatVnd(row.discount)}` : '—'}</td>
                        <td className="num">{formatVnd(row.cash)}</td>
                        <td className="num">{formatVnd(row.transfer)}</td>
                        <td className="num">
                          <strong>{formatVnd(row.total)}</strong>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="card">
            <h3>Doanh thu theo ca làm</h3>
            {report.byShift.length === 0 ? (
              <p className="muted-sm">Chưa có ca làm nào trong khoảng thời gian đã chọn.</p>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Thời gian ca</th>
                      <th>Người mở / chốt</th>
                      <th className="num">Số HĐ</th>
                      <th className="num">Tiền giờ</th>
                      <th className="num">Tiền món</th>
                      <th className="num">Tiền mặt</th>
                      <th className="num">Chuyển khoản</th>
                      <th className="num">Thực thu ca</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.byShift.map((sh) => (
                      <tr key={sh.id}>
                        <td>
                          <div>{formatDateTime(sh.opened_at)}</div>
                          <div className="muted-xs">
                            {sh.closed_at ? `→ ${formatDateTime(sh.closed_at)}` : 'Đang mở'}
                          </div>
                        </td>
                        <td>
                          <div>{sh.opened_by_name}</div>
                          {sh.closed_by_name && <div className="muted-xs">Chốt: {sh.closed_by_name}</div>}
                        </td>
                        <td className="num">{sh.invoiceCount}</td>
                        <td className="num">{formatVnd(sh.calcTableRevenue)}</td>
                        <td className="num">{formatVnd(sh.calcItemsRevenue)}</td>
                        <td className="num">{formatVnd(sh.calcCash)}</td>
                        <td className="num">{formatVnd(sh.calcTransfer)}</td>
                        <td className="num">
                          <strong>{formatVnd(sh.calcTotal)}</strong>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
