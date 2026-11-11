import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../services/api'
import { formatDateOnly, formatDateTime, formatMinutesReadable, formatVnd, toLocalDateInputValue } from '../utils/format'
import {
  REPORT_PRESETS,
  diffDaysInclusive,
  enumerateDateStrings,
  getDayOfWeekFromYmd,
  getPreviousComparisonRange,
  getRangeForPreset,
  parseYmd,
} from '../utils/reportPeriods'
import { allocateInvoiceToTables } from '../utils/reportTableAllocation'
import { AreaLineChart, HorizontalBarChart } from './ReportCharts'

const REPORT_TABS = [
  { id: 'overview', label: 'Thống kê' },
  { id: 'tables', label: 'Thống kê bàn' },
  { id: 'revenue', label: 'Doanh thu & Lãi' },
  { id: 'sales', label: 'Bán hàng' },
  { id: 'cashflow', label: 'Tổng thu chi' },
  { id: 'shifts', label: 'Ca làm việc' },
  { id: 'staff', label: 'Nhân viên' },
]

const WEEKDAY_LABELS = [
  { dow: 1, short: 'T2', full: 'Thứ 2' },
  { dow: 2, short: 'T3', full: 'Thứ 3' },
  { dow: 3, short: 'T4', full: 'Thứ 4' },
  { dow: 4, short: 'T5', full: 'Thứ 5' },
  { dow: 5, short: 'T6', full: 'Thứ 6' },
  { dow: 6, short: 'T7', full: 'Thứ 7' },
  { dow: 0, short: 'CN', full: 'Chủ nhật' },
]

function renderDeltaInfo(currentVal, prevVal) {
  if (prevVal === 0 && currentVal === 0) {
    return { text: '0% so với kỳ trước', tone: 'neutral' }
  }
  if (prevVal === 0) {
    return currentVal > 0
      ? { text: '↑ Mới phát sinh so với kỳ trước', tone: 'up' }
      : { text: '↓ Phát sinh âm so với kỳ trước', tone: 'down' }
  }
  const pct = ((currentVal - prevVal) / Math.abs(prevVal)) * 100
  const formatted = Math.abs(pct).toFixed(1)
  if (pct > 0) return { text: `↑ ${formatted}% so với kỳ trước`, tone: 'up' }
  if (pct < 0) return { text: `↓ ${formatted}% so với kỳ trước`, tone: 'down' }
  return { text: '0.0% so với kỳ trước', tone: 'neutral' }
}

function filterInvoicesByCriteria(invoices, areaFilter, paymentFilter) {
  return invoices.filter((inv) => {
    if (paymentFilter !== 'all' && inv.payment_method !== paymentFilter) return false
    if (areaFilter === 'retail') return inv.sale_type === 'retail' || !inv.table_id
    if (areaFilter !== 'all') {
      if (inv.sale_type === 'retail' || !inv.table_id) return false
      return inv.table_type_name === areaFilter
    }
    return true
  })
}

function DailyProfitCard({ rows }) {
  return (
    <div className="card">
      <h3>Tiền lãi sau vốn theo ngày</h3>
      {rows.length === 0 ? (
        <p className="muted-sm">Không có hóa đơn trong khoảng thời gian đã chọn.</p>
      ) : (
        <>
          <div className="table-wrap desktop-only-table">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Ngày</th>
                  <th className="num">Số HĐ</th>
                  <th className="num">Tiền giờ</th>
                  <th className="num">Tiền món</th>
                  <th className="num">Giảm giá</th>
                  <th className="num">Thực thu</th>
                  <th className="num">Giá vốn</th>
                  <th className="num">Tiền lãi sau vốn</th>
                  <th className="num">Biên lãi</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const margin = row.total > 0 ? ((row.profit / row.total) * 100).toFixed(1) : '0.0'
                  return (
                    <tr key={row.dayKey}>
                      <td>
                        <strong>{row.label}</strong>
                      </td>
                      <td className="num">{row.invoiceCount}</td>
                      <td className="num">{formatVnd(row.tableFee)}</td>
                      <td className="num">{formatVnd(row.itemsFee)}</td>
                      <td className="num">{row.discount > 0 ? `−${formatVnd(row.discount)}` : '—'}</td>
                      <td className="num">{formatVnd(row.total)}</td>
                      <td className="num text-danger">{formatVnd(row.cost)}</td>
                      <td className="num">
                        <strong className={row.profit >= 0 ? 'text-green' : 'text-danger'}>
                          {formatVnd(row.profit)}
                        </strong>
                      </td>
                      <td className="num">{margin}%</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="mobile-card-list mobile-only-cards">
            {rows.map((row) => {
              const margin = row.total > 0 ? ((row.profit / row.total) * 100).toFixed(1) : '0.0'
              return (
                <div key={row.dayKey} className="mobile-data-card">
                  <div className="mobile-card-top">
                    <strong>{row.label}</strong>
                    <span className="badge">{row.invoiceCount} HĐ</span>
                  </div>
                  <div className="mobile-card-grid">
                    <div>
                      <span className="muted-xs">Giờ / Món</span>
                      <span className="num">
                        {formatVnd(row.tableFee)} / {formatVnd(row.itemsFee)}
                      </span>
                    </div>
                    <div>
                      <span className="muted-xs">Thực thu / Giá vốn</span>
                      <span className="num">
                        {formatVnd(row.total)} / {formatVnd(row.cost)}
                      </span>
                    </div>
                  </div>
                  <div className="mobile-card-foot">
                    <span className="muted-xs">Biên lãi {margin}%</span>
                    <strong className={`num ${row.profit >= 0 ? 'text-green' : 'text-danger'}`}>
                      Lãi: {formatVnd(row.profit)}
                    </strong>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

function ProfitPeriodCard({ title, firstColLabel, rows, emptyText }) {
  return (
    <div className="card">
      <h3>{title}</h3>
      {rows.length === 0 ? (
        <p className="muted-sm">{emptyText}</p>
      ) : (
        <>
          <div className="table-wrap desktop-only-table">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{firstColLabel}</th>
                  <th className="num">Số HĐ</th>
                  <th className="num">Tiền giờ</th>
                  <th className="num">Tiền món</th>
                  <th className="num">Thực thu</th>
                  <th className="num">Giá vốn</th>
                  <th className="num">Tiền lãi sau vốn</th>
                  <th className="num">Biên lãi</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const margin = r.value > 0 ? ((r.profit / r.value) * 100).toFixed(1) : '0.0'
                  return (
                    <tr key={r.key}>
                      <td>
                        <strong>{r.fullLabel}</strong>
                      </td>
                      <td className="num">{r.invoiceCount}</td>
                      <td className="num">{formatVnd(r.tableFee)}</td>
                      <td className="num">{formatVnd(r.itemsFee)}</td>
                      <td className="num">{formatVnd(r.value)}</td>
                      <td className="num text-danger">{formatVnd(r.cost)}</td>
                      <td className="num">
                        <strong className={r.profit >= 0 ? 'text-green' : 'text-danger'}>
                          {formatVnd(r.profit)}
                        </strong>
                      </td>
                      <td className="num">{margin}%</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="mobile-card-list mobile-only-cards">
            {rows.map((r) => {
              const margin = r.value > 0 ? ((r.profit / r.value) * 100).toFixed(1) : '0.0'
              return (
                <div key={r.key} className="mobile-data-card">
                  <div className="mobile-card-top">
                    <strong>{r.fullLabel}</strong>
                    <span className="badge">{r.invoiceCount} HĐ</span>
                  </div>
                  <div className="mobile-card-grid">
                    <div>
                      <span className="muted-xs">Thực thu</span>
                      <span className="num">{formatVnd(r.value)}</span>
                    </div>
                    <div>
                      <span className="muted-xs">Giá vốn</span>
                      <span className="num text-danger">{formatVnd(r.cost)}</span>
                    </div>
                  </div>
                  <div className="mobile-card-foot">
                    <span className="muted-xs">Biên lãi {margin}%</span>
                    <strong className={`num ${r.profit >= 0 ? 'text-green' : 'text-danger'}`}>
                      Lãi: {formatVnd(r.profit)}
                    </strong>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

export function ReportsView() {
  const [todayStr] = useState(() => toLocalDateInputValue())
  const [activeTab, setActiveTab] = useState('revenue')
  const [viewMode, setViewMode] = useState('list') // 'list' | 'chart'
  const [activePreset, setActivePreset] = useState('thisWeek')
  const [startDate, setStartDate] = useState(() => getRangeForPreset('thisWeek', toLocalDateInputValue()).startDate)
  const [endDate, setEndDate] = useState(() => getRangeForPreset('thisWeek', toLocalDateInputValue()).endDate)
  const [areaFilter, setAreaFilter] = useState('all')
  const [paymentFilter, setPaymentFilter] = useState('all')

  const [data, setData] = useState({
    invoices: [],
    prevInvoices: [],
    shifts: [],
    tables: [],
    tableTypes: [],
    transfers: [],
    cashTransactions: [],
    cashTransactionsReady: true,
  })
  const [loadedRange, setLoadedRange] = useState('')
  const [reloadNonce, setReloadNonce] = useState(0)
  const [deletingShiftId, setDeletingShiftId] = useState(null)
  const [error, setError] = useState('')

  // Form phiếu thu/chi
  const [showTxForm, setShowTxForm] = useState(false)
  const [txType, setTxType] = useState('expense')
  const [txCategory, setTxCategory] = useState('Nhập hàng')
  const [txAmount, setTxAmount] = useState('')
  const [txMethod, setTxMethod] = useState('cash')
  const [txDescription, setTxDescription] = useState('')
  const [txBusy, setTxBusy] = useState(false)
  const [txError, setTxError] = useState('')

  const prevRange = useMemo(
    () => getPreviousComparisonRange(startDate, endDate, activePreset, todayStr),
    [startDate, endDate, activePreset, todayStr]
  )

  const rangeKey = `${startDate}|${endDate}|${prevRange.startDate}|${prevRange.endDate}|${reloadNonce}`
  const loading = loadedRange !== rangeKey

  useEffect(() => {
    let active = true

    async function fetchRange() {
      try {
        const res = await api.fetchReportsData({
          startDate,
          endDate,
          prevStartDate: prevRange.startDate,
          prevEndDate: prevRange.endDate,
        })
        if (!active) return
        setData({
          invoices: res.invoices || [],
          prevInvoices: res.prevInvoices || [],
          shifts: res.shifts || [],
          tables: res.tables || [],
          tableTypes: res.tableTypes || [],
          transfers: res.transfers || [],
          cashTransactions: res.cashTransactions || [],
          cashTransactionsReady: res.cashTransactionsReady !== false,
        })
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
  }, [rangeKey, startDate, endDate, prevRange.startDate, prevRange.endDate])

  const applyPreset = useCallback(
    (presetId) => {
      const { startDate: s, endDate: e } = getRangeForPreset(presetId, todayStr)
      setStartDate(s)
      setEndDate(e)
      setActivePreset(presetId)
    },
    [todayStr]
  )

  async function handleCreateCashTx(e) {
    e.preventDefault()
    setTxBusy(true)
    setTxError('')
    try {
      await api.createCashTransaction({
        txType,
        category: txCategory,
        amount: Number(txAmount) || 0,
        paymentMethod: txMethod,
        occurredAt: new Date(`${endDate}T12:00:00`).toISOString(),
        description: txDescription,
      })
      setTxAmount('')
      setTxDescription('')
      setShowTxForm(false)
      setReloadNonce((n) => n + 1)
    } catch (err) {
      setTxError(err.message || 'Không thể lưu phiếu thu/chi.')
    } finally {
      setTxBusy(false)
    }
  }

  async function handleDeleteCashTx(id) {
    if (!window.confirm('Xóa phiếu thu/chi này?')) return
    try {
      await api.deleteCashTransaction(id)
      setReloadNonce((n) => n + 1)
    } catch (err) {
      setError(err.message || 'Không thể xóa phiếu thu/chi.')
    }
  }

  async function handleDeleteShift(sh) {
    if (sh.status !== 'closed') return
    const ok = window.confirm(
      `Xóa ca làm việc mở lúc ${formatDateTime(sh.opened_at)} (${sh.opened_by_name})?\nHóa đơn phát sinh trong ca (nếu có) vẫn được giữ nguyên trong lịch sử hóa đơn và báo cáo doanh thu.`
    )
    if (!ok) return

    setDeletingShiftId(sh.id)
    setError('')
    try {
      await api.deleteShift(sh.id)
      setReloadNonce((n) => n + 1)
    } catch (err) {
      setError(err.message || 'Không thể xóa ca làm việc.')
    } finally {
      setDeletingShiftId(null)
    }
  }

  const areaOptions = useMemo(() => {
    const typeNames = new Set((data.tableTypes || []).map((t) => t.name))
    for (const inv of data.invoices) {
      if (inv.sale_type !== 'retail' && inv.table_type_name) {
        typeNames.add(inv.table_type_name)
      }
    }
    return [...typeNames]
  }, [data.tableTypes, data.invoices])

  const report = useMemo(() => {
    const filteredCurrAll = filterInvoicesByCriteria(data.invoices, areaFilter, paymentFilter)
    const filteredPrevAll = filterInvoicesByCriteria(data.prevInvoices, areaFilter, paymentFilter)

    const validInvoices = filteredCurrAll.filter((i) => i.status !== 'voided')
    const voidedCount = filteredCurrAll.filter((i) => i.status === 'voided').length
    const prevValidInvoices = filteredPrevAll.filter((i) => i.status !== 'voided')

    let netRevenue = 0
    let grossRevenue = 0
    let tableRevenue = 0
    let itemsRevenue = 0
    let retailRevenue = 0
    let discountTotal = 0
    let cashRevenue = 0
    let transferRevenue = 0
    let goodsCost = 0
    let unknownCostCount = 0
    const unknownCostInvoiceCodes = []

    const byDayMap = {}
    const byHourArr = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      key: String(hour),
      shortLabel: String(hour),
      fullLabel: `Khung ${String(hour).padStart(2, '0')}:00 – ${String(hour).padStart(2, '0')}:59`,
      value: 0,
      profit: 0,
      cost: 0,
      gross: 0,
      tableFee: 0,
      itemsFee: 0,
      invoiceCount: 0,
    }))
    const byWeekdayMap = new Map(
      WEEKDAY_LABELS.map((w) => [
        w.dow,
        {
          key: String(w.dow),
          shortLabel: w.short,
          fullLabel: w.full,
          value: 0,
          profit: 0,
          cost: 0,
          invoiceCount: 0,
          tableFee: 0,
          itemsFee: 0,
        },
      ])
    )
    const byMonthMap = new Map()
    const byProductMap = new Map()
    const byStaffMap = new Map()

    const transfersBySession = new Map()
    for (const transfer of data.transfers || []) {
      if (!transfersBySession.has(transfer.session_id)) transfersBySession.set(transfer.session_id, [])
      transfersBySession.get(transfer.session_id).push(transfer)
    }

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
      const invGross = inv.table_fee + inv.items_fee
      netRevenue += inv.total_amount
      grossRevenue += invGross
      tableRevenue += inv.table_fee
      itemsRevenue += inv.items_fee
      if (inv.sale_type === 'retail' || !inv.table_id) retailRevenue += inv.total_amount
      discountTotal += inv.discount_amount
      if (inv.payment_method === 'cash') cashRevenue += inv.total_amount
      else transferRevenue += inv.total_amount

      // Chi tiết món & giá vốn
      let invCost = 0
      for (const item of inv.invoice_items || []) {
        if (item.line_cost == null) {
          unknownCostCount += 1
          if (inv.invoice_code && !unknownCostInvoiceCodes.includes(inv.invoice_code)) {
            unknownCostInvoiceCodes.push(inv.invoice_code)
          }
        } else {
          goodsCost += item.line_cost
          invCost += item.line_cost
        }

        const prodName = item.item_name || 'Món khác'
        const prodUnit = item.unit || 'Phần'
        const prodKey = `${prodName}__${prodUnit}`
        if (!byProductMap.has(prodKey)) {
          byProductMap.set(prodKey, {
            key: prodKey,
            name: prodName,
            unit: prodUnit,
            quantity: 0,
            revenue: 0,
            cost: 0,
            missingCost: false,
          })
        }
        const prod = byProductMap.get(prodKey)
        prod.quantity += Number(item.quantity) || 0
        prod.revenue += Number(item.line_total) || 0
        if (item.line_cost == null) prod.missingCost = true
        else prod.cost += item.line_cost
      }
      const invProfit = inv.total_amount - invCost

      // Nhân viên thu ngân
      const staffKey = inv.cashier_id || inv.cashier_name || 'unknown'
      if (!byStaffMap.has(staffKey)) {
        byStaffMap.set(staffKey, {
          key: staffKey,
          name: inv.cashier_name || 'Nhân viên',
          invoiceCount: 0,
          tableFee: 0,
          itemsFee: 0,
          discount: 0,
          cash: 0,
          transfer: 0,
          total: 0,
          shiftIds: new Set(),
        })
      }
      const st = byStaffMap.get(staffKey)
      st.invoiceCount += 1
      st.tableFee += inv.table_fee
      st.itemsFee += inv.items_fee
      st.discount += inv.discount_amount
      if (inv.payment_method === 'cash') st.cash += inv.total_amount
      else st.transfer += inv.total_amount
      st.total += inv.total_amount
      if (inv.shift_id) st.shiftIds.add(inv.shift_id)

      // Theo ngày / giờ / thứ / tháng
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
          cost: 0,
          profit: 0,
          gross: 0,
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
      dayRow.cost += invCost
      dayRow.profit += invProfit
      dayRow.gross += invGross
      if (inv.payment_method === 'cash') dayRow.cash += inv.total_amount
      else dayRow.transfer += inv.total_amount

      const hr = d.getHours()
      if (byHourArr[hr]) {
        byHourArr[hr].value += inv.total_amount
        byHourArr[hr].profit += invProfit
        byHourArr[hr].cost += invCost
        byHourArr[hr].gross += invGross
        byHourArr[hr].tableFee += inv.table_fee
        byHourArr[hr].itemsFee += inv.items_fee
        byHourArr[hr].invoiceCount += 1
      }

      const dow = getDayOfWeekFromYmd(dayKey)
      const wd = byWeekdayMap.get(dow)
      if (wd) {
        wd.value += inv.total_amount
        wd.profit += invProfit
        wd.cost += invCost
        wd.invoiceCount += 1
        wd.tableFee += inv.table_fee
        wd.itemsFee += inv.items_fee
      }

      const monthKey = dayKey.slice(0, 7)
      if (!byMonthMap.has(monthKey)) {
        const [yy, mm] = monthKey.split('-')
        byMonthMap.set(monthKey, {
          key: monthKey,
          shortLabel: `T${Number(mm)}`,
          fullLabel: `Tháng ${Number(mm)}/${yy}`,
          value: 0,
          profit: 0,
          cost: 0,
          invoiceCount: 0,
          tableFee: 0,
          itemsFee: 0,
        })
      }
      const mRow = byMonthMap.get(monthKey)
      mRow.value += inv.total_amount
      mRow.profit += invProfit
      mRow.cost += invCost
      mRow.invoiceCount += 1
      mRow.tableFee += inv.table_fee
      mRow.itemsFee += inv.items_fee

      // Phân bổ từng bàn
      if (inv.sale_type !== 'retail' && inv.table_id) {
        for (const portion of allocateInvoiceToTables(inv, transfersBySession.get(inv.session_id) || [])) {
          if (!byTableMap[portion.tableId]) {
            byTableMap[portion.tableId] = {
              tableId: portion.tableId,
              tableName: portion.tableName,
              sessionsCount: 0,
              totalSeconds: 0,
              billedMinutes: 0,
              tableFee: 0,
              itemsFee: 0,
            }
          }
          const tblRow = byTableMap[portion.tableId]
          tblRow.sessionsCount += 1
          tblRow.totalSeconds += portion.totalSeconds
          tblRow.billedMinutes += portion.billedMinutes
          tblRow.tableFee += portion.tableFee
          tblRow.itemsFee += portion.itemsFee
        }
      }
    }

    // Kỳ trước để tính % tăng/giảm (gồm cả giá vốn và lãi sau vốn)
    const prevNetRevenue = prevValidInvoices.reduce((s, i) => s + i.total_amount, 0)
    const prevGrossRevenue = prevValidInvoices.reduce((s, i) => s + i.table_fee + i.items_fee, 0)
    const prevInvoiceCount = prevValidInvoices.length
    const prevGoodsCost = prevValidInvoices.reduce(
      (sum, inv) =>
        sum +
        (inv.invoice_items || []).reduce(
          (itemSum, item) => itemSum + (item.line_cost != null ? Number(item.line_cost) || 0 : 0),
          0
        ),
      0
    )
    const prevGrossProfit = prevNetRevenue - prevGoodsCost

    const grossProfit = netRevenue - goodsCost
    const itemsProfit = itemsRevenue - goodsCost
    const profitMarginPct = netRevenue > 0 ? (grossProfit / netRevenue) * 100 : 0
    const avgInvoiceValue = validInvoices.length > 0 ? Math.round(netRevenue / validInvoices.length) : 0

    // Chuỗi ngày liên tục cho biểu đồ theo ngày (doanh thu thuần & lãi sau vốn)
    const daySpan = diffDaysInclusive(startDate, endDate)
    let dailyChartPoints = []
    let dailyProfitPoints = []
    if (daySpan <= 92) {
      const seqDays = enumerateDateStrings(startDate, endDate, 95)
      dailyChartPoints = seqDays.map((d) => {
        const row = byDayMap[d.key]
        return {
          key: d.key,
          shortLabel: d.shortLabel,
          fullLabel: d.fullLabel,
          value: row?.total || 0,
          subText: `${row?.invoiceCount || 0} HĐ`,
        }
      })
      dailyProfitPoints = seqDays.map((d) => {
        const row = byDayMap[d.key]
        return {
          key: d.key,
          shortLabel: d.shortLabel,
          fullLabel: d.fullLabel,
          value: row?.profit || 0,
          subText: row ? `Thu ${formatVnd(row.total)} • Vốn ${formatVnd(row.cost)}` : '0 HĐ',
        }
      })
    } else {
      const sortedDays = Object.values(byDayMap).sort((a, b) => a.dayKey.localeCompare(b.dayKey))
      dailyChartPoints = sortedDays.map((r) => ({
        key: r.dayKey,
        shortLabel: r.label.slice(0, 5),
        fullLabel: r.label,
        value: r.total,
        subText: `${r.invoiceCount} HĐ`,
      }))
      dailyProfitPoints = sortedDays.map((r) => ({
        key: r.dayKey,
        shortLabel: r.label.slice(0, 5),
        fullLabel: r.label,
        value: r.profit,
        subText: `Thu ${formatVnd(r.total)} • Vốn ${formatVnd(r.cost)}`,
      }))
    }

    // Chuỗi 12 tháng hoặc các tháng có dữ liệu
    const endYear = (endDate || todayStr).slice(0, 4)
    const monthlyChartPoints = Array.from({ length: 12 }, (_, idx) => {
      const m = String(idx + 1).padStart(2, '0')
      const key = `${endYear}-${m}`
      const row = byMonthMap.get(key)
      return {
        key,
        shortLabel: `T${idx + 1}`,
        fullLabel: `Tháng ${idx + 1}/${endYear}`,
        value: row?.value || 0,
        profit: row?.profit || 0,
        cost: row?.cost || 0,
        invoiceCount: row?.invoiceCount || 0,
        tableFee: row?.tableFee || 0,
        itemsFee: row?.itemsFee || 0,
        subText: `${row?.invoiceCount || 0} HĐ`,
      }
    })

    const monthlyProfitPoints = monthlyChartPoints.map((m) => ({
      ...m,
      value: m.profit,
      subText: m.invoiceCount > 0 ? `Thu ${formatVnd(m.value)} • Vốn ${formatVnd(m.cost)}` : '0 HĐ',
    }))

    const weekdayChartPoints = WEEKDAY_LABELS.map((w) => {
      const row = byWeekdayMap.get(w.dow)
      return {
        ...row,
        subText: `${row.invoiceCount} HĐ`,
      }
    })

    const weekdayProfitPoints = weekdayChartPoints.map((w) => ({
      ...w,
      value: w.profit,
      subText: w.invoiceCount > 0 ? `Thu ${formatVnd(w.value)} • Vốn ${formatVnd(w.cost)}` : '0 HĐ',
    }))

    const hourlyChartPoints = byHourArr.map((h) => ({ ...h, subText: `${h.invoiceCount} HĐ` }))
    const hourlyProfitPoints = byHourArr.map((h) => ({
      ...h,
      value: h.profit,
      subText: h.invoiceCount > 0 ? `Thu ${formatVnd(h.value)} • Vốn ${formatVnd(h.cost)}` : '0 HĐ',
    }))

    const startP = parseYmd(startDate)
    const endP = parseYmd(endDate)
    const byMonth = []
    if (startP && endP && startDate <= endDate) {
      let y = startP.y
      let m = startP.m
      for (let guard = 0; guard < 36; guard += 1) {
        const key = `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}`
        const row = byMonthMap.get(key)
        byMonth.push({
          key,
          shortLabel: `T${m}`,
          fullLabel: `Tháng ${m}/${y}`,
          value: row?.value || 0,
          profit: row?.profit || 0,
          cost: row?.cost || 0,
          invoiceCount: row?.invoiceCount || 0,
          tableFee: row?.tableFee || 0,
          itemsFee: row?.itemsFee || 0,
        })
        if (y > endP.y || (y === endP.y && m >= endP.m)) break
        m += 1
        if (m > 12) {
          m = 1
          y += 1
        }
      }
    }

    const byDay = Object.values(byDayMap).sort((a, b) => b.dayKey.localeCompare(a.dayKey))
    const byTable = Object.values(byTableMap)
    const byProduct = [...byProductMap.values()].sort((a, b) => b.revenue - a.revenue || b.quantity - a.quantity)
    const byStaff = [...byStaffMap.values()]
      .map((s) => ({ ...s, shiftCount: s.shiftIds.size }))
      .sort((a, b) => b.total - a.total)

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

    // Tổng thu chi
    const filteredTx = (data.cashTransactions || []).filter(
      (tx) => paymentFilter === 'all' || tx.payment_method === paymentFilter
    )
    const otherIncome = filteredTx.filter((t) => t.tx_type === 'income').reduce((s, t) => s + t.amount, 0)
    const otherExpense = filteredTx.filter((t) => t.tx_type === 'expense').reduce((s, t) => s + t.amount, 0)
    const cashTxNet =
      filteredTx.filter((t) => t.payment_method === 'cash' && t.tx_type === 'income').reduce((s, t) => s + t.amount, 0) -
      filteredTx.filter((t) => t.payment_method === 'cash' && t.tx_type === 'expense').reduce((s, t) => s + t.amount, 0)
    const transferTxNet =
      filteredTx.filter((t) => t.payment_method === 'transfer' && t.tx_type === 'income').reduce((s, t) => s + t.amount, 0) -
      filteredTx.filter((t) => t.payment_method === 'transfer' && t.tx_type === 'expense').reduce((s, t) => s + t.amount, 0)

    const topTables = [...byTable]
      .filter((t) => t.sessionsCount > 0 || t.tableFee + t.itemsFee > 0)
      .sort((a, b) => b.tableFee + b.itemsFee - (a.tableFee + a.itemsFee))
      .slice(0, 5)
    const topProducts = byProduct.slice(0, 5)

    return {
      validCount: validInvoices.length,
      voidedCount,
      netRevenue,
      grossRevenue,
      tableRevenue,
      itemsRevenue,
      retailRevenue,
      discountTotal,
      cashRevenue,
      transferRevenue,
      goodsCost,
      unknownCostCount,
      unknownCostInvoiceCodes,
      grossProfit,
      itemsProfit,
      profitMarginPct,
      avgInvoiceValue,
      prevNetRevenue,
      prevGrossRevenue,
      prevGoodsCost,
      prevGrossProfit,
      prevInvoiceCount,
      dailyChartPoints,
      hourlyChartPoints,
      weekdayChartPoints,
      monthlyChartPoints,
      dailyProfitPoints,
      hourlyProfitPoints,
      weekdayProfitPoints,
      monthlyProfitPoints,
      byDay,
      byMonth,
      byTable,
      byProduct,
      topTables,
      topProducts,
      byShift,
      byStaff,
      filteredTx,
      otherIncome,
      otherExpense,
      netCashflow: netRevenue + otherIncome - otherExpense,
      cashEnding: cashRevenue + cashTxNet,
      transferEnding: transferRevenue + transferTxNet,
    }
  }, [data, areaFilter, paymentFilter, startDate, endDate, todayStr])

  const netDelta = renderDeltaInfo(report.netRevenue, report.prevNetRevenue)
  const grossDelta = renderDeltaInfo(report.grossRevenue, report.prevGrossRevenue)
  const profitDelta = renderDeltaInfo(report.grossProfit, report.prevGrossProfit)
  const costDelta = renderDeltaInfo(report.goodsCost, report.prevGoodsCost)
  const countDelta = renderDeltaInfo(report.validCount, report.prevInvoiceCount)

  const listBreakdownMode = useMemo(() => {
    if (
      activePreset === 'thisMonth' ||
      activePreset === 'lastMonth' ||
      activePreset === 'thisQuarter' ||
      activePreset === 'lastQuarter' ||
      activePreset === 'thisYear' ||
      activePreset === 'lastYear'
    ) {
      return 'month'
    }
    if (activePreset === 'today' || activePreset === 'yesterday') return 'hour'
    if (activePreset === 'thisWeek' || activePreset === 'lastWeek') return 'weekday'
    if (startDate && endDate) {
      if (startDate === endDate) return 'hour'
      if (startDate.slice(0, 7) !== endDate.slice(0, 7) || diffDaysInclusive(startDate, endDate) >= 28) {
        return 'month'
      }
    }
    return 'weekday'
  }, [activePreset, startDate, endDate])

  const secondaryBreakdown = useMemo(() => {
    if (listBreakdownMode === 'month') {
      return {
        mode: 'month',
        title: 'Tiền lãi sau vốn theo tháng',
        firstColLabel: 'Tháng',
        rows: report.byMonth,
        emptyText: 'Không có dữ liệu tháng trong khoảng thời gian đã chọn.',
      }
    }
    if (listBreakdownMode === 'hour') {
      return {
        mode: 'hour',
        title: 'Tiền lãi sau vốn theo khung giờ',
        firstColLabel: 'Khung giờ',
        rows: report.hourlyChartPoints.filter((h) => h.invoiceCount > 0),
        emptyText: 'Không có hóa đơn trong khoảng thời gian đã chọn.',
      }
    }
    return {
      mode: 'weekday',
      title: 'Tiền lãi sau vốn theo thứ trong tuần',
      firstColLabel: 'Thứ',
      rows: report.weekdayChartPoints,
      emptyText: 'Không có hóa đơn trong khoảng thời gian đã chọn.',
    }
  }, [listBreakdownMode, report.byMonth, report.hourlyChartPoints, report.weekdayChartPoints])

  const showsViewModeSwitch = activeTab === 'tables' || activeTab === 'revenue' || activeTab === 'sales'

  return (
    <div className="page-stack">
      {/* Thanh tab con Báo cáo */}
      <div className="report-subnav-wrap">
        <div className="tab-pills scrollable-pills">
          {REPORT_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`tab-pill ${activeTab === t.id ? 'active' : ''}`}
              onClick={() => setActiveTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="report-workspace">
        {/* Cột Bộ lọc bên trái */}
        <aside className="card report-sidebar">
          <div className="sidebar-title">Bộ lọc</div>

          <div className="form-stack">
            <label className="field">
              <span>Khu vực / Loại bàn</span>
              <select value={areaFilter} onChange={(e) => setAreaFilter(e.target.value)}>
                <option value="all">Tất cả khu vực</option>
                {areaOptions.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
                <option value="retail">Bán lẻ (không dùng bàn)</option>
              </select>
            </label>

            <label className="field">
              <span>Phương thức thanh toán</span>
              <select value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value)}>
                <option value="all">Tất cả PTTT</option>
                <option value="cash">Tiền mặt</option>
                <option value="transfer">Chuyển khoản</option>
              </select>
            </label>

            <label className="field">
              <span>Từ ngày</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value)
                  setActivePreset(null)
                }}
              />
            </label>

            <label className="field">
              <span>Đến ngày</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value)
                  setActivePreset(null)
                }}
              />
            </label>

            <div className="field">
              <span>Thời gian nhanh</span>
              <div className="preset-grid-2col">
                {REPORT_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    aria-pressed={activePreset === preset.id}
                    className={`preset-btn ${activePreset === preset.id ? 'active' : ''}`}
                    onClick={() => applyPreset(preset.id)}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </aside>

        {/* Nội dung chính bên phải */}
        <div className="report-main">
          {showsViewModeSwitch && (
            <div className="report-mode-bar">
              <div className="mode-radio-group" role="radiogroup" aria-label="Chế độ xem báo cáo">
                <button
                  type="button"
                  role="radio"
                  aria-checked={viewMode === 'list'}
                  className={`mode-radio-btn ${viewMode === 'list' ? 'active' : ''}`}
                  onClick={() => setViewMode('list')}
                >
                  <span className="radio-dot" />
                  <span>Danh sách</span>
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={viewMode === 'chart'}
                  className={`mode-radio-btn ${viewMode === 'chart' ? 'active' : ''}`}
                  onClick={() => setViewMode('chart')}
                >
                  <span className="radio-dot" />
                  <span>Biểu đồ</span>
                </button>
              </div>

              <span className="muted-xs">
                Kỳ đối chiếu trước: {formatDateOnly(`${prevRange.startDate}T00:00:00`)} –{' '}
                {formatDateOnly(`${prevRange.endDate}T00:00:00`)}
              </span>
            </div>
          )}

          {error && <div className="alert alert-danger">{error}</div>}

          {loading ? (
            <div className="card">
              <p className="muted-sm">Đang tổng hợp số liệu báo cáo...</p>
            </div>
          ) : (
            <>
              {/* 1. TAB THỐNG KÊ (TỔNG QUAN VẬN HÀNH & CƠ CẤU BÁN HÀNG) */}
              {activeTab === 'overview' && (
                <>
                  <div className="kpi-triple-row">
                    <div className="card kpi-compare-card">
                      <span className="kpi-label">Doanh thu thuần (Thực thu)</span>
                      <strong className="kpi-compare-val num text-primary">{formatVnd(report.netRevenue)}</strong>
                      <span className={`delta-text delta-${netDelta.tone}`}>{netDelta.text}</span>
                    </div>
                    <div className="card kpi-compare-card">
                      <span className="kpi-label">Tổng số hóa đơn</span>
                      <strong className="kpi-compare-val num">{report.validCount}</strong>
                      <span className="muted-xs">TB/đơn: {formatVnd(report.avgInvoiceValue)}</span>
                      <span className={`delta-text delta-${countDelta.tone}`}>
                        {countDelta.text}
                        {report.voidedCount > 0 ? ` • ${report.voidedCount} hủy` : ''}
                      </span>
                    </div>
                    <div className="card kpi-compare-card">
                      <span className="kpi-label">Doanh thu tiền giờ / tiền món</span>
                      <strong className="kpi-compare-val num text-brass">{formatVnd(report.grossRevenue)}</strong>
                      <span className="muted-xs">
                        Giờ {formatVnd(report.tableRevenue)} • Món {formatVnd(report.itemsRevenue)}
                        {report.retailRevenue > 0 ? ` (lẻ ${formatVnd(report.retailRevenue)})` : ''}
                      </span>
                      <span className={`delta-text delta-${grossDelta.tone}`}>{grossDelta.text}</span>
                    </div>
                  </div>

                  <div className="kpi-grid-reports">
                    <div className="card kpi-card">
                      <span className="kpi-label">Cơ cấu nguồn thu &amp; Giảm giá</span>
                      <div className="live-row">
                        <span>Tiền giờ chơi:</span>
                        <strong className="num text-green">{formatVnd(report.tableRevenue)}</strong>
                      </div>
                      <div className="live-row">
                        <span>Tiền đồ uống / ăn:</span>
                        <strong className="num">{formatVnd(report.itemsRevenue)}</strong>
                      </div>
                      <div className="live-row">
                        <span>Trong đó bán lẻ:</span>
                        <strong className="num">{formatVnd(report.retailRevenue)}</strong>
                      </div>
                      <div className="live-row live-total">
                        <span>Tổng giảm giá:</span>
                        <strong className="num text-danger">−{formatVnd(report.discountTotal)}</strong>
                      </div>
                    </div>

                    <div className="card kpi-card">
                      <span className="kpi-label">Kênh thanh toán (Tiền mặt vs Chuyển khoản)</span>
                      <div className="live-row">
                        <span>Tiền mặt:</span>
                        <strong className="num">{formatVnd(report.cashRevenue)}</strong>
                      </div>
                      <div className="live-row">
                        <span>Chuyển khoản:</span>
                        <strong className="num">{formatVnd(report.transferRevenue)}</strong>
                      </div>
                      <div className="live-row">
                        <span>Giá vốn món tham chiếu:</span>
                        <strong className="num">{formatVnd(report.goodsCost)}</strong>
                      </div>
                      <div className="live-row live-total">
                        <span>Lãi sau vốn tham chiếu:</span>
                        <strong className={`num ${report.grossProfit >= 0 ? 'text-green' : 'text-danger'}`}>
                          {formatVnd(report.grossProfit)}
                        </strong>
                      </div>
                    </div>
                  </div>

                  {report.unknownCostCount > 0 && (
                    <div className="alert alert-warning">
                      Có {report.unknownCostCount} dòng món trong hóa đơn hợp lệ chưa có giá vốn
                      {report.unknownCostInvoiceCodes.length > 0 ? ` (${report.unknownCostInvoiceCodes.join(', ')})` : ''}
                      — phần lãi sau vốn đang tính giá vốn 0 đ cho các dòng cũ này.
                    </div>
                  )}

                  <div className="card">
                    <AreaLineChart
                      title="Xu hướng doanh thu thuần theo ngày"
                      summaryLabel="Tổng:"
                      summaryValue={report.netRevenue}
                      points={report.dailyChartPoints}
                      color="#16a34a"
                      fillColor="#16a34a"
                      gradientId="overviewDailyGrad"
                    />
                  </div>

                  <div className="kpi-grid-reports">
                    <div className="card kpi-card">
                      <span className="kpi-label">Top bàn nổi bật</span>
                      {report.topTables.length === 0 ? (
                        <p className="muted-sm">Chưa có phiên bàn phát sinh trong kỳ.</p>
                      ) : (
                        report.topTables.map((t, idx) => (
                          <div key={t.tableId} className="live-row">
                            <span>
                              #{idx + 1} {t.tableName}{' '}
                              <span className="muted-xs">({t.sessionsCount} lượt)</span>
                            </span>
                            <strong className="num text-primary">
                              {formatVnd(t.tableFee + t.itemsFee)}
                            </strong>
                          </div>
                        ))
                      )}
                    </div>

                    <div className="card kpi-card">
                      <span className="kpi-label">Top món bán chạy</span>
                      {report.topProducts.length === 0 ? (
                        <p className="muted-sm">Chưa có món nào được bán trong kỳ.</p>
                      ) : (
                        report.topProducts.map((p, idx) => (
                          <div key={p.key} className="live-row">
                            <span>
                              #{idx + 1} {p.name}{' '}
                              <span className="muted-xs">
                                ({p.quantity} {p.unit})
                              </span>
                            </span>
                            <strong className="num text-brass">{formatVnd(p.revenue)}</strong>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </>
              )}

              {/* 2. TAB DOANH THU & LÃI (TRỌNG TÂM TỔNG TIỀN LÃI SAU VỐN) */}
              {activeTab === 'revenue' && (
                <>
                  <div className="kpi-triple-row">
                    <div className="card kpi-compare-card">
                      <span className="kpi-label">Tổng tiền lãi sau vốn</span>
                      <strong
                        className={`kpi-compare-val num ${report.grossProfit >= 0 ? 'text-green' : 'text-danger'}`}
                      >
                        {formatVnd(report.grossProfit)}
                      </strong>
                      <span className="muted-xs">
                        Biên lãi: {report.profitMarginPct.toFixed(1)}% trên thực thu
                      </span>
                      <span className={`delta-text delta-${profitDelta.tone}`}>{profitDelta.text}</span>
                    </div>
                    <div className="card kpi-compare-card">
                      <span className="kpi-label">Doanh thu thuần (Thực thu)</span>
                      <strong className="kpi-compare-val num text-primary">{formatVnd(report.netRevenue)}</strong>
                      <span className="muted-xs">
                        Giờ {formatVnd(report.tableRevenue)} • Món {formatVnd(report.itemsRevenue)}
                      </span>
                      <span className={`delta-text delta-${netDelta.tone}`}>{netDelta.text}</span>
                    </div>
                    <div className="card kpi-compare-card">
                      <span className="kpi-label">Tổng giá vốn món đã bán</span>
                      <strong className="kpi-compare-val num text-brass">{formatVnd(report.goodsCost)}</strong>
                      <span className="muted-xs">
                        Lãi bán món: <strong className="num">{formatVnd(report.itemsProfit)}</strong>
                      </span>
                      <span className="delta-text delta-neutral">{costDelta.text}</span>
                    </div>
                  </div>

                  <div className="card kpi-card">
                    <span className="kpi-label">Phân tích cấu thành tiền lãi sau vốn</span>
                    <div className="live-row">
                      <span>Tiền giờ chơi:</span>
                      <strong className="num">+{formatVnd(report.tableRevenue)}</strong>
                    </div>
                    <div className="live-row">
                      <span>Doanh thu món (tại bàn &amp; bán lẻ):</span>
                      <strong className="num">+{formatVnd(report.itemsRevenue)}</strong>
                    </div>
                    <div className="live-row">
                      <span>Giảm giá hóa đơn:</span>
                      <strong className="num text-danger">−{formatVnd(report.discountTotal)}</strong>
                    </div>
                    <div className="live-row">
                      <span>Doanh thu thuần (Thực thu):</span>
                      <strong className="num text-primary">{formatVnd(report.netRevenue)}</strong>
                    </div>
                    <div className="live-row">
                      <span>Trừ tổng giá vốn món đã bán:</span>
                      <strong className="num text-danger">−{formatVnd(report.goodsCost)}</strong>
                    </div>
                    <div className="live-row live-total">
                      <span>Tổng tiền lãi sau vốn (Thực thu − Giá vốn):</span>
                      <strong className={`num ${report.grossProfit >= 0 ? 'text-green' : 'text-danger'}`}>
                        {formatVnd(report.grossProfit)} ({report.profitMarginPct.toFixed(1)}%)
                      </strong>
                    </div>
                  </div>

                  {report.unknownCostCount > 0 && (
                    <div className="alert alert-warning">
                      Lưu ý: Có {report.unknownCostCount} dòng món cũ chưa ghi giá vốn tại thời điểm bán
                      {report.unknownCostInvoiceCodes.length > 0 ? ` (${report.unknownCostInvoiceCodes.join(', ')})` : ''}
                      ; hệ thống đang tạm tính giá vốn 0 đ cho các dòng này.
                    </div>
                  )}

                  {viewMode === 'chart' ? (
                    <div className="charts-2x2-grid">
                      <div className="card">
                        <AreaLineChart
                          title="Tiền lãi sau vốn theo ngày"
                          summaryLabel="Tổng lãi sau vốn:"
                          summaryValue={report.grossProfit}
                          points={report.dailyProfitPoints}
                          color="#0d7a55"
                          fillColor="#10b981"
                          gradientId="revProfitDailyGrad"
                        />
                      </div>

                      <div className="card">
                        <AreaLineChart
                          title="Tiền lãi sau vốn theo giờ"
                          summaryLabel="Tổng lãi sau vốn:"
                          summaryValue={report.grossProfit}
                          points={report.hourlyProfitPoints}
                          color="#ea580c"
                          fillColor="#ec4899"
                          gradientId="revProfitHourlyGrad"
                        />
                      </div>

                      <div className="card">
                        <AreaLineChart
                          title="Tiền lãi sau vốn theo thứ"
                          summaryLabel="Tổng lãi sau vốn:"
                          summaryValue={report.grossProfit}
                          points={report.weekdayProfitPoints}
                          color="#0284c7"
                          fillColor="#0284c7"
                          gradientId="revProfitWeekdayGrad"
                        />
                      </div>

                      <div className="card">
                        <AreaLineChart
                          title="Tiền lãi sau vốn theo tháng"
                          summaryLabel={`Năm ${(endDate || todayStr).slice(0, 4)}:`}
                          summaryValue={report.monthlyProfitPoints.reduce((s, m) => s + m.value, 0)}
                          points={report.monthlyProfitPoints}
                          color="#16a34a"
                          fillColor="#16a34a"
                          gradientId="revProfitMonthlyGrad"
                        />
                      </div>
                    </div>
                  ) : secondaryBreakdown.mode === 'month' ? (
                    <>
                      <ProfitPeriodCard
                        title={secondaryBreakdown.title}
                        firstColLabel={secondaryBreakdown.firstColLabel}
                        rows={secondaryBreakdown.rows}
                        emptyText={secondaryBreakdown.emptyText}
                      />
                      <DailyProfitCard rows={report.byDay} />
                    </>
                  ) : (
                    <>
                      <DailyProfitCard rows={report.byDay} />
                      <ProfitPeriodCard
                        title={secondaryBreakdown.title}
                        firstColLabel={secondaryBreakdown.firstColLabel}
                        rows={secondaryBreakdown.rows}
                        emptyText={secondaryBreakdown.emptyText}
                      />
                    </>
                  )}
                </>
              )}

              {/* 3. TAB THỐNG KÊ BÀN */}
              {activeTab === 'tables' && (
                <>
                  {viewMode === 'chart' ? (
                    <div className="charts-2x2-grid">
                      <div className="card">
                        <HorizontalBarChart
                          title="Doanh thu giờ theo từng bàn"
                          color="#0d7a55"
                          rows={report.byTable.map((r) => ({
                            key: r.tableId,
                            label: r.tableName,
                            meta: `${r.sessionsCount} lượt`,
                            value: r.tableFee,
                          }))}
                        />
                      </div>
                      <div className="card">
                        <HorizontalBarChart
                          title="Thời gian sử dụng từng bàn"
                          color="#d97706"
                          valueFormatter={(mins) => formatMinutesReadable(mins)}
                          rows={report.byTable.map((r) => ({
                            key: r.tableId,
                            label: r.tableName,
                            meta: `${r.sessionsCount} lượt`,
                            value: Math.round(r.totalSeconds / 60),
                          }))}
                        />
                      </div>
                    </div>
                  ) : null}

                  <div className="card">
                    <h3>Chi tiết sử dụng &amp; doanh thu 5 bàn</h3>
                    <p className="muted-xs" style={{ marginBottom: '0.75rem' }}>
                      Phiên chuyển bàn được tính một lượt cho mỗi bàn đã sử dụng; thời gian và tiền giờ phân bổ theo thời gian thực tế.
                    </p>
                    <div className="table-wrap desktop-only-table">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Bàn</th>
                            <th className="num">Số lượt</th>
                            <th className="num">Chơi thực tế</th>
                            <th className="num">Tính tiền</th>
                            <th className="num">Doanh thu giờ</th>
                            <th className="num">Doanh thu món</th>
                            <th className="num">Tổng</th>
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
                              <td className="num">
                                <strong className="text-brass">{formatVnd(row.tableFee + row.itemsFee)}</strong>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="mobile-card-list mobile-only-cards">
                      {report.byTable.map((row) => (
                        <div key={row.tableId} className="mobile-data-card">
                          <div className="mobile-card-top">
                            <strong>{row.tableName}</strong>
                            <span className="badge">{row.sessionsCount} lượt</span>
                          </div>
                          <div className="mobile-card-grid">
                            <div>
                              <span className="muted-xs">Chơi thực tế</span>
                              <span>{formatMinutesReadable(Math.round(row.totalSeconds / 60))}</span>
                            </div>
                            <div>
                              <span className="muted-xs">Tính tiền</span>
                              <span>{formatMinutesReadable(row.billedMinutes)}</span>
                            </div>
                            <div>
                              <span className="muted-xs">Doanh thu giờ</span>
                              <span className="num">{formatVnd(row.tableFee)}</span>
                            </div>
                            <div>
                              <span className="muted-xs">Doanh thu món</span>
                              <span className="num">{formatVnd(row.itemsFee)}</span>
                            </div>
                          </div>
                          <div className="mobile-card-foot">
                            <span className="muted-xs">Tổng bàn</span>
                            <strong className="num text-brass">{formatVnd(row.tableFee + row.itemsFee)}</strong>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* 4. TAB BÁN HÀNG (TOP ĐỒ UỐNG & ĐỒ ĂN) */}
              {activeTab === 'sales' && (
                <>
                  {viewMode === 'chart' && report.byProduct.length > 0 && (
                    <div className="charts-2x2-grid">
                      <div className="card">
                        <HorizontalBarChart
                          title="Top món theo doanh thu"
                          color="#0284c7"
                          rows={report.byProduct.slice(0, 10).map((p) => ({
                            key: p.key,
                            label: p.name,
                            meta: `${p.quantity} ${p.unit}`,
                            value: p.revenue,
                          }))}
                        />
                      </div>
                      <div className="card">
                        <HorizontalBarChart
                          title="Top món theo số lượng bán"
                          color="#0d7a55"
                          valueFormatter={(qty) => `${qty} phần`}
                          rows={[...report.byProduct]
                            .sort((a, b) => b.quantity - a.quantity)
                            .slice(0, 10)
                            .map((p) => ({
                              key: p.key,
                              label: p.name,
                              meta: p.unit,
                              value: p.quantity,
                            }))}
                        />
                      </div>
                    </div>
                  )}

                  <div className="card">
                    <h3>Chi tiết đồ uống &amp; đồ ăn đã bán ({report.byProduct.length} món)</h3>
                    {report.byProduct.length === 0 ? (
                      <p className="muted-sm">Chưa có món nào được bán trong kỳ đã chọn.</p>
                    ) : (
                      <>
                        <div className="table-wrap desktop-only-table">
                          <table className="data-table">
                            <thead>
                              <tr>
                                <th>Tên món</th>
                                <th>ĐVT</th>
                                <th className="num">Số lượng</th>
                                <th className="num">Doanh thu</th>
                                <th className="num">Giá vốn</th>
                                <th className="num">Lãi gộp</th>
                              </tr>
                            </thead>
                            <tbody>
                              {report.byProduct.map((p) => (
                                <tr key={p.key}>
                                  <td>
                                    <strong>{p.name}</strong>
                                  </td>
                                  <td>{p.unit}</td>
                                  <td className="num">
                                    <strong>{p.quantity}</strong>
                                  </td>
                                  <td className="num">
                                    <strong className="text-brass">{formatVnd(p.revenue)}</strong>
                                  </td>
                                  <td className="num">{p.missingCost ? 'Thiếu giá nhập' : formatVnd(p.cost)}</td>
                                  <td className="num">
                                    <strong className="text-green">
                                      {p.missingCost ? '—' : formatVnd(p.revenue - p.cost)}
                                    </strong>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        <div className="mobile-card-list mobile-only-cards">
                          {report.byProduct.map((p) => (
                            <div key={p.key} className="mobile-data-card">
                              <div className="mobile-card-top">
                                <strong>{p.name}</strong>
                                <span className="badge">
                                  {p.quantity} {p.unit}
                                </span>
                              </div>
                              <div className="mobile-card-grid">
                                <div>
                                  <span className="muted-xs">Doanh thu</span>
                                  <strong className="num text-brass">{formatVnd(p.revenue)}</strong>
                                </div>
                                <div>
                                  <span className="muted-xs">Lãi gộp</span>
                                  <strong className="num text-green">
                                    {p.missingCost ? 'Thiếu giá nhập' : formatVnd(p.revenue - p.cost)}
                                  </strong>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </>
              )}

              {/* 5. TAB TỔNG THU CHI */}
              {activeTab === 'cashflow' && (
                <>
                  <div className="kpi-grid-reports">
                    <div className="card kpi-card">
                      <span className="kpi-label">Thu từ bán hàng (Hóa đơn)</span>
                      <strong className="kpi-big num text-primary">{formatVnd(report.netRevenue)}</strong>
                      <span className="muted-xs">
                        TM: {formatVnd(report.cashRevenue)} • CK: {formatVnd(report.transferRevenue)}
                      </span>
                    </div>
                    <div className="card kpi-card">
                      <span className="kpi-label">Phiếu thu khác</span>
                      <strong className="kpi-big num text-green">+{formatVnd(report.otherIncome)}</strong>
                      <span className="muted-xs">Thu ngoài hóa đơn bàn/lẻ</span>
                    </div>
                    <div className="card kpi-card">
                      <span className="kpi-label">Phiếu chi vận hành</span>
                      <strong className="kpi-big num text-danger">−{formatVnd(report.otherExpense)}</strong>
                      <span className="muted-xs">Nhập hàng, điện nước, chi phí...</span>
                    </div>
                    <div className="card kpi-card">
                      <span className="kpi-label">Tổng thu chi ròng</span>
                      <strong className="kpi-big num text-brass">{formatVnd(report.netCashflow)}</strong>
                      <span className="muted-xs">
                        TM: {formatVnd(report.cashEnding)} • CK: {formatVnd(report.transferEnding)}
                      </span>
                    </div>
                  </div>

                  {!data.cashTransactionsReady && (
                    <div className="alert alert-warning">
                      Chức năng lập phiếu Thu/Chi ngoài quầy cần chạy thêm file{' '}
                      <code>supabase/cash_transactions_migration.sql</code> trong Supabase SQL Editor. Phần Thu bán hàng vẫn hiển thị bình thường.
                    </div>
                  )}

                  <div className="card">
                    <div className="section-head">
                      <div>
                        <h3>Sổ phiếu Thu / Chi khác ({report.filteredTx.length})</h3>
                        <p className="muted-sm">Ghi nhận các khoản nhập hàng, chi phí vận hành hoặc thu ngoài hóa đơn.</p>
                      </div>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        disabled={!data.cashTransactionsReady}
                        onClick={() => {
                          setTxError('')
                          setShowTxForm((v) => !v)
                        }}
                      >
                        {showTxForm ? 'Đóng form' : '+ Lập phiếu Thu / Chi'}
                      </button>
                    </div>

                    {showTxForm && (
                      <form onSubmit={handleCreateCashTx} className="panel-box form-stack" style={{ marginBottom: '1rem' }}>
                        {txError && <div className="alert alert-danger">{txError}</div>}
                        <div className="filter-bar" style={{ marginBottom: 0 }}>
                          <label className="field">
                            <span>Loại phiếu</span>
                            <select
                              value={txType}
                              onChange={(e) => {
                                const next = e.target.value
                                setTxType(next)
                                setTxCategory(next === 'income' ? 'Thu khác' : 'Nhập hàng')
                              }}
                            >
                              <option value="expense">Phiếu chi</option>
                              <option value="income">Phiếu thu</option>
                            </select>
                          </label>
                          <label className="field">
                            <span>Danh mục</span>
                            <select value={txCategory} onChange={(e) => setTxCategory(e.target.value)}>
                              {txType === 'expense' ? (
                                <>
                                  <option value="Nhập hàng">Nhập hàng (nước, đồ ăn)</option>
                                  <option value="Bảo trì bàn / Cơ">Bảo trì bàn / Đầu cơ / Bàn</option>
                                  <option value="Điện nước / Mặt bằng">Điện nước / Mặt bằng</option>
                                  <option value="Lương / Thưởng">Lương / Thưởng nhân viên</option>
                                  <option value="Chi phí khác">Chi phí khác</option>
                                </>
                              ) : (
                                <>
                                  <option value="Thu khác">Thu khác</option>
                                  <option value="Nạp quỹ đầu kỳ">Nạp quỹ bổ sung</option>
                                </>
                              )}
                            </select>
                          </label>
                          <label className="field">
                            <span>Số tiền (VNĐ)</span>
                            <input
                              type="number"
                              min={1000}
                              step={1000}
                              required
                              placeholder="Ví dụ: 250000"
                              value={txAmount}
                              onChange={(e) => setTxAmount(e.target.value)}
                            />
                          </label>
                          <label className="field">
                            <span>Phương thức</span>
                            <select value={txMethod} onChange={(e) => setTxMethod(e.target.value)}>
                              <option value="cash">Tiền mặt</option>
                              <option value="transfer">Chuyển khoản</option>
                            </select>
                          </label>
                        </div>

                        <label className="field">
                          <span>Nội dung / Diễn giải *</span>
                          <input
                            type="text"
                            required
                            minLength={2}
                            placeholder="Ví dụ: Mua 2 thùng Sting, đá lạnh..."
                            value={txDescription}
                            onChange={(e) => setTxDescription(e.target.value)}
                          />
                        </label>

                        <div className="row-actions">
                          <button type="submit" className="btn btn-primary btn-sm" disabled={txBusy}>
                            {txBusy ? 'Đang lưu...' : 'Lưu phiếu'}
                          </button>
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowTxForm(false)}>
                            Hủy
                          </button>
                        </div>
                      </form>
                    )}

                    {report.filteredTx.length === 0 ? (
                      <p className="muted-sm">Chưa có phiếu thu/chi ngoài quầy nào trong kỳ đã chọn.</p>
                    ) : (
                      <>
                        <div className="table-wrap desktop-only-table">
                          <table className="data-table">
                            <thead>
                              <tr>
                                <th>Thời gian</th>
                                <th>Loại</th>
                                <th>Danh mục</th>
                                <th>Nội dung</th>
                                <th>PTTT</th>
                                <th>Người lập</th>
                                <th className="num">Số tiền</th>
                                <th></th>
                              </tr>
                            </thead>
                            <tbody>
                              {report.filteredTx.map((tx) => (
                                <tr key={tx.id}>
                                  <td>{formatDateTime(tx.occurred_at)}</td>
                                  <td>
                                    <span className={`status-pill ${tx.tx_type === 'income' ? 'status-available' : 'status-maintenance'}`}>
                                      {tx.tx_type === 'income' ? 'Phiếu thu' : 'Phiếu chi'}
                                    </span>
                                  </td>
                                  <td>{tx.category}</td>
                                  <td>{tx.description}</td>
                                  <td>{tx.payment_method === 'transfer' ? 'Chuyển khoản' : 'Tiền mặt'}</td>
                                  <td>{tx.created_by_name}</td>
                                  <td className="num">
                                    <strong className={tx.tx_type === 'income' ? 'text-green' : 'text-danger'}>
                                      {tx.tx_type === 'income' ? '+' : '−'}
                                      {formatVnd(tx.amount)}
                                    </strong>
                                  </td>
                                  <td>
                                    <button
                                      type="button"
                                      className="btn btn-sm btn-ghost-danger"
                                      onClick={() => handleDeleteCashTx(tx.id)}
                                    >
                                      Xóa
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        <div className="mobile-card-list mobile-only-cards">
                          {report.filteredTx.map((tx) => (
                            <div key={tx.id} className="mobile-data-card">
                              <div className="mobile-card-top">
                                <div>
                                  <strong>{tx.category}</strong>
                                  <div className="muted-xs">{formatDateTime(tx.occurred_at)}</div>
                                </div>
                                <span className={`status-pill ${tx.tx_type === 'income' ? 'status-available' : 'status-maintenance'}`}>
                                  {tx.tx_type === 'income' ? 'Thu' : 'Chi'}
                                </span>
                              </div>
                              <div className="muted-sm">{tx.description}</div>
                              <div className="mobile-card-foot">
                                <strong className={`num ${tx.tx_type === 'income' ? 'text-green' : 'text-danger'}`}>
                                  {tx.tx_type === 'income' ? '+' : '−'}
                                  {formatVnd(tx.amount)}
                                </strong>
                                <button
                                  type="button"
                                  className="btn btn-sm btn-ghost-danger"
                                  onClick={() => handleDeleteCashTx(tx.id)}
                                >
                                  Xóa
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </>
              )}

              {/* 6. TAB CA LÀM VIỆC */}
              {activeTab === 'shifts' && (
                <div className="card">
                  <h3>Doanh thu &amp; đối soát theo ca làm ({report.byShift.length} ca)</h3>
                  <p className="muted-xs" style={{ marginBottom: '0.75rem' }}>
                    Tính theo các hóa đơn hợp lệ (khớp bộ lọc khu vực &amp; phương thức) trong khoảng ngày đã chọn.
                  </p>
                  {report.byShift.length === 0 ? (
                    <p className="muted-sm">Chưa có ca làm nào trong khoảng thời gian đã chọn.</p>
                  ) : (
                    <>
                      <div className="table-wrap desktop-only-table">
                        <table className="data-table">
                          <thead>
                            <tr>
                              <th>Thời gian ca</th>
                              <th>Người mở / chốt</th>
                              <th className="num">Số HĐ</th>
                              <th className="num">Tiền giờ</th>
                              <th className="num">Tiền món</th>
                              <th className="num">Giảm giá</th>
                              <th className="num">Tiền mặt</th>
                              <th className="num">Chuyển khoản</th>
                              <th className="num">Thực thu</th>
                              <th className="num">Chênh lệch két</th>
                              <th></th>
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
                                <td className="num">{sh.calcDiscount > 0 ? `−${formatVnd(sh.calcDiscount)}` : '—'}</td>
                                <td className="num">{formatVnd(sh.calcCash)}</td>
                                <td className="num">{formatVnd(sh.calcTransfer)}</td>
                                <td className="num">
                                  <strong className="text-brass">{formatVnd(sh.calcTotal)}</strong>
                                </td>
                                <td className="num">
                                  {sh.cash_difference == null ? (
                                    '—'
                                  ) : (
                                    <strong className={sh.cash_difference === 0 ? 'text-green' : sh.cash_difference > 0 ? 'text-primary' : 'text-danger'}>
                                      {sh.cash_difference > 0 ? `+${formatVnd(sh.cash_difference)}` : formatVnd(sh.cash_difference)}
                                    </strong>
                                  )}
                                </td>
                                <td>
                                  {sh.status === 'closed' ? (
                                    <button
                                      type="button"
                                      className="btn btn-sm btn-ghost-danger"
                                      disabled={deletingShiftId === sh.id}
                                      onClick={() => handleDeleteShift(sh)}
                                    >
                                      {deletingShiftId === sh.id ? 'Đang xóa...' : 'Xóa ca'}
                                    </button>
                                  ) : (
                                    <span className="muted-xs" title="Vui lòng chốt ca trước khi xóa">
                                      —
                                    </span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div className="mobile-card-list mobile-only-cards">
                        {report.byShift.map((sh) => (
                          <div key={sh.id} className="mobile-data-card">
                            <div className="mobile-card-top">
                              <div>
                                <strong>{sh.opened_by_name}</strong>
                                <div className="muted-xs">
                                  {formatDateTime(sh.opened_at)}
                                  {sh.closed_at ? ` → ${formatDateTime(sh.closed_at)}` : ' (Đang mở)'}
                                </div>
                              </div>
                              <span className="badge">{sh.invoiceCount} HĐ</span>
                            </div>
                            <div className="mobile-card-grid">
                              <div>
                                <span className="muted-xs">Giờ / Món</span>
                                <span className="num">
                                  {formatVnd(sh.calcTableRevenue)} / {formatVnd(sh.calcItemsRevenue)}
                                </span>
                              </div>
                              <div>
                                <span className="muted-xs">TM / CK</span>
                                <span className="num">
                                  {formatVnd(sh.calcCash)} / {formatVnd(sh.calcTransfer)}
                                </span>
                              </div>
                              <div>
                                <span className="muted-xs">Lệch két</span>
                                <span className="num">
                                  {sh.cash_difference == null
                                    ? '—'
                                    : sh.cash_difference > 0
                                      ? `+${formatVnd(sh.cash_difference)}`
                                      : formatVnd(sh.cash_difference)}
                                </span>
                              </div>
                              <div>
                                <span className="muted-xs">Thực thu</span>
                                <strong className="num text-brass">{formatVnd(sh.calcTotal)}</strong>
                              </div>
                            </div>
                            {sh.status === 'closed' && (
                              <div className="mobile-card-foot">
                                <span className="muted-xs">Hóa đơn thuộc ca vẫn được giữ nguyên</span>
                                <button
                                  type="button"
                                  className="btn btn-sm btn-ghost-danger"
                                  disabled={deletingShiftId === sh.id}
                                  onClick={() => handleDeleteShift(sh)}
                                >
                                  {deletingShiftId === sh.id ? 'Đang xóa...' : 'Xóa ca'}
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* 7. TAB NHÂN VIÊN */}
              {activeTab === 'staff' && (
                <div className="card">
                  <h3>Doanh thu theo nhân viên thu ngân ({report.byStaff.length})</h3>
                  {report.byStaff.length === 0 ? (
                    <p className="muted-sm">Chưa có giao dịch thu tiền nào trong kỳ đã chọn.</p>
                  ) : (
                    <>
                      <div className="table-wrap desktop-only-table">
                        <table className="data-table">
                          <thead>
                            <tr>
                              <th>Nhân viên</th>
                              <th className="num">Số ca tham gia</th>
                              <th className="num">Số HĐ thu</th>
                              <th className="num">Tiền giờ</th>
                              <th className="num">Tiền món</th>
                              <th className="num">Giảm giá</th>
                              <th className="num">Tiền mặt</th>
                              <th className="num">Chuyển khoản</th>
                              <th className="num">Tổng doanh thu</th>
                            </tr>
                          </thead>
                          <tbody>
                            {report.byStaff.map((st) => (
                              <tr key={st.key}>
                                <td>
                                  <strong>{st.name}</strong>
                                </td>
                                <td className="num">{st.shiftCount}</td>
                                <td className="num">{st.invoiceCount}</td>
                                <td className="num">{formatVnd(st.tableFee)}</td>
                                <td className="num">{formatVnd(st.itemsFee)}</td>
                                <td className="num">{st.discount > 0 ? `−${formatVnd(st.discount)}` : '—'}</td>
                                <td className="num">{formatVnd(st.cash)}</td>
                                <td className="num">{formatVnd(st.transfer)}</td>
                                <td className="num">
                                  <strong className="text-brass">{formatVnd(st.total)}</strong>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div className="mobile-card-list mobile-only-cards">
                        {report.byStaff.map((st) => (
                          <div key={st.key} className="mobile-data-card">
                            <div className="mobile-card-top">
                              <strong>{st.name}</strong>
                              <span className="badge">
                                {st.invoiceCount} HĐ • {st.shiftCount} ca
                              </span>
                            </div>
                            <div className="mobile-card-grid">
                              <div>
                                <span className="muted-xs">TM / CK</span>
                                <span className="num">
                                  {formatVnd(st.cash)} / {formatVnd(st.transfer)}
                                </span>
                              </div>
                              <div>
                                <span className="muted-xs">Giờ / Món</span>
                                <span className="num">
                                  {formatVnd(st.tableFee)} / {formatVnd(st.itemsFee)}
                                </span>
                              </div>
                            </div>
                            <div className="mobile-card-foot">
                              <span className="muted-xs">Tổng thu</span>
                              <strong className="num text-brass">{formatVnd(st.total)}</strong>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
