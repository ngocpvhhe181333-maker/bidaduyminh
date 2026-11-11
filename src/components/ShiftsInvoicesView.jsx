import { useEffect, useState } from 'react'
import { api } from '../services/api'
import {
  formatDateTime,
  formatMinutesReadable,
  formatVnd,
  getInvoiceStatusLabel,
  getPaymentMethodLabel,
  toLocalDateInputValue,
} from '../utils/format'

export function ShiftsInvoicesView({
  refreshKey,
  profile,
  tables,
  openShift,
  openShiftSummary,
  onOpenShiftModal,
  onCloseShiftModal,
  onSelectInvoice,
}) {
  const isAdmin = profile?.role === 'admin'
  const [subTab, setSubTab] = useState('invoices') // 'invoices' | 'shifts'
  const [shifts, setShifts] = useState([])
  const [invoices, setInvoices] = useState([])
  const [loadedKey, setLoadedKey] = useState('')
  const [localRefreshNonce, setLocalRefreshNonce] = useState(0)
  const [deletingShiftId, setDeletingShiftId] = useState(null)
  const [error, setError] = useState('')

  // Bộ lọc hóa đơn
  const [startDate, setStartDate] = useState(() => toLocalDateInputValue())
  const [endDate, setEndDate] = useState(() => toLocalDateInputValue())
  const [tableId, setTableId] = useState('all')
  const [paymentMethod, setPaymentMethod] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

  const queryKey = `${refreshKey}|${localRefreshNonce}|${startDate}|${endDate}|${tableId}|${paymentMethod}|${statusFilter}`
  const loading = loadedKey !== queryKey

  async function handleDeleteShift(sh) {
    if (!isAdmin || sh.status !== 'closed') return
    const ok = window.confirm(
      `Xóa ca làm việc mở lúc ${formatDateTime(sh.opened_at)} (${sh.opened_by_name})?\nHóa đơn phát sinh trong ca (nếu có) vẫn được giữ nguyên trong lịch sử hóa đơn và báo cáo doanh thu.`
    )
    if (!ok) return

    setDeletingShiftId(sh.id)
    setError('')
    try {
      await api.deleteShift(sh.id)
      setLocalRefreshNonce((n) => n + 1)
    } catch (err) {
      setError(err.message || 'Không thể xóa ca làm việc.')
    } finally {
      setDeletingShiftId(null)
    }
  }

  useEffect(() => {
    let active = true

    async function fetchAll() {
      try {
        const [shiftsData, invoicesData] = await Promise.all([
          api.fetchShifts(),
          api.fetchInvoices({ startDate, endDate, tableId, paymentMethod, status: statusFilter }),
        ])
        if (!active) return
        setShifts(shiftsData)
        setInvoices(invoicesData)
        setError('')
        setLoadedKey(queryKey)
      } catch (err) {
        if (!active) return
        setError(err.message || 'Không thể tải dữ liệu ca và hóa đơn.')
        setLoadedKey(queryKey)
      }
    }

    fetchAll()
    return () => {
      active = false
    }
  }, [queryKey, startDate, endDate, tableId, paymentMethod, statusFilter])

  const expectedCash = openShift
    ? openShift.opening_cash + (openShiftSummary?.cash_revenue || 0)
    : 0

  return (
    <div className="page-stack">
      {/* Banner trạng thái ca hiện tại */}
      <div className="card shift-banner">
        {openShift ? (
          <div className="shift-banner-grid">
            <div>
              <div className="badge-row">
                <span className="status-pill status-available">Ca đang mở</span>
                <span className="muted-sm">
                  Mở bởi <strong>{openShift.opened_by_name}</strong> lúc {formatDateTime(openShift.opened_at)}
                </span>
              </div>
              <div className="shift-metrics-row">
                <div>
                  <span className="muted-xs">Tiền đầu ca</span>
                  <strong className="num">{formatVnd(openShift.opening_cash)}</strong>
                </div>
                <div>
                  <span className="muted-xs">Thu tiền mặt</span>
                  <strong className="num">{formatVnd(openShiftSummary?.cash_revenue || 0)}</strong>
                </div>
                <div>
                  <span className="muted-xs">Chuyển khoản</span>
                  <strong className="num">{formatVnd(openShiftSummary?.transfer_revenue || 0)}</strong>
                </div>
                <div>
                  <span className="muted-xs">Tiền két lý thuyết</span>
                  <strong className="num text-brass">{formatVnd(expectedCash)}</strong>
                </div>
                <div>
                  <span className="muted-xs">Hóa đơn hợp lệ</span>
                  <strong className="num">{openShiftSummary?.invoice_count || 0}</strong>
                </div>
              </div>
            </div>
            <div className="shift-banner-cta">
              <button type="button" className="btn btn-primary" onClick={onCloseShiftModal}>
                Chốt ca &amp; Đối soát
              </button>
            </div>
          </div>
        ) : (
          <div className="shift-banner-grid">
            <div>
              <strong>Hiện chưa có ca làm nào đang mở</strong>
              <p className="muted-sm">
                Mở ca và nhập số tiền mặt đầu ca để bắt đầu ghi nhận phiên chơi và doanh thu.
              </p>
            </div>
            <div className="shift-banner-cta">
              <button type="button" className="btn btn-primary" onClick={onOpenShiftModal}>
                Mở ca làm việc
              </button>
            </div>
          </div>
        )}
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      <div className="tab-pills scrollable-pills">
        <button
          type="button"
          className={`tab-pill ${subTab === 'invoices' ? 'active' : ''}`}
          onClick={() => setSubTab('invoices')}
        >
          Danh sách hóa đơn ({invoices.length})
        </button>
        <button
          type="button"
          className={`tab-pill ${subTab === 'shifts' ? 'active' : ''}`}
          onClick={() => setSubTab('shifts')}
        >
          Lịch sử ca làm ({shifts.length})
        </button>
      </div>

      {subTab === 'invoices' && (
        <div className="card">
          <div className="filter-bar">
            <label className="field">
              <span>Từ ngày</span>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </label>
            <label className="field">
              <span>Đến ngày</span>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </label>
            <label className="field">
              <span>Bàn</span>
              <select value={tableId} onChange={(e) => setTableId(e.target.value)}>
                <option value="all">Tất cả</option>
                <option value="retail">Bán lẻ (không dùng bàn)</option>
                {tables.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Thanh toán</span>
              <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                <option value="all">Tất cả</option>
                <option value="cash">Tiền mặt</option>
                <option value="transfer">Chuyển khoản</option>
              </select>
            </label>
            <label className="field">
              <span>Trạng thái</span>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="all">Tất cả</option>
                <option value="paid">Đã thanh toán</option>
                <option value="adjusted">Đã sửa / Giảm giá</option>
                <option value="voided">Đã hủy</option>
              </select>
            </label>
          </div>

          {!isAdmin && (
            <p className="muted-xs" style={{ marginBottom: '0.75rem' }}>
              * Tài khoản Thu ngân chỉ xem được hóa đơn trong ca đang mở hoặc do mình thu (được bảo vệ bởi Supabase RLS).
            </p>
          )}

          {loading ? (
            <p className="muted-sm">Đang tải hóa đơn...</p>
          ) : invoices.length === 0 ? (
            <p className="muted-sm">Không có hóa đơn nào khớp bộ lọc.</p>
          ) : (
            <>
              {/* Bảng trên desktop */}
              <div className="table-wrap desktop-only-table">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Mã HĐ</th>
                      <th>Thời điểm</th>
                      <th>Bàn</th>
                      <th>Thời lượng</th>
                      <th className="num">Tiền giờ</th>
                      <th className="num">Tiền món</th>
                      <th className="num">Giảm giá</th>
                      <th className="num">Tổng thu</th>
                      <th>PTTT</th>
                      <th>Thu ngân</th>
                      <th>Trạng thái</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((inv) => (
                      <tr key={inv.id} className={inv.status === 'voided' ? 'row-muted' : ''}>
                        <td>
                          <strong>{inv.invoice_code}</strong>
                        </td>
                        <td>{formatDateTime(inv.paid_at)}</td>
                        <td>{inv.table_name}</td>
                        <td>{inv.sale_type === 'retail' ? '—' : formatMinutesReadable(inv.billed_minutes)}</td>
                        <td className="num">{formatVnd(inv.table_fee)}</td>
                        <td className="num">{formatVnd(inv.items_fee)}</td>
                        <td className="num">{inv.discount_amount > 0 ? `-${formatVnd(inv.discount_amount)}` : '—'}</td>
                        <td className="num">
                          <strong className="text-brass">{formatVnd(inv.total_amount)}</strong>
                        </td>
                        <td>{getPaymentMethodLabel(inv.payment_method)}</td>
                        <td>{inv.cashier_name}</td>
                        <td>
                          <span className={`status-pill status-${inv.status}`}>
                            {getInvoiceStatusLabel(inv.status)}
                          </span>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline"
                            onClick={() => onSelectInvoice(inv)}
                          >
                            Xem / In
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Danh sách thẻ trên điện thoại */}
              <div className="mobile-card-list mobile-only-cards">
                {invoices.map((inv) => (
                  <div key={inv.id} className={`mobile-data-card ${inv.status === 'voided' ? 'row-muted' : ''}`}>
                    <div className="mobile-card-top">
                      <div>
                        <strong className="mono">{inv.invoice_code}</strong>
                        <div className="muted-xs">{formatDateTime(inv.paid_at)}</div>
                      </div>
                      <span className={`status-pill status-${inv.status}`}>
                        {getInvoiceStatusLabel(inv.status)}
                      </span>
                    </div>

                    <div className="mobile-card-grid">
                      <div>
                        <span className="muted-xs">Bàn / Loại</span>
                        <strong>{inv.table_name}</strong>
                      </div>
                      <div>
                        <span className="muted-xs">Thời lượng</span>
                        <span>{inv.sale_type === 'retail' ? 'Bán lẻ' : formatMinutesReadable(inv.billed_minutes)}</span>
                      </div>
                      <div>
                        <span className="muted-xs">Tiền giờ / Món</span>
                        <span className="num">
                          {formatVnd(inv.table_fee)} / {formatVnd(inv.items_fee)}
                        </span>
                      </div>
                      <div>
                        <span className="muted-xs">Thanh toán</span>
                        <span>{getPaymentMethodLabel(inv.payment_method)}</span>
                      </div>
                    </div>

                    <div className="mobile-card-foot">
                      <div>
                        <span className="muted-xs">Tổng thu</span>
                        <div className="mobile-card-total num text-brass">{formatVnd(inv.total_amount)}</div>
                      </div>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline"
                        onClick={() => onSelectInvoice(inv)}
                      >
                        Xem / In hóa đơn
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {subTab === 'shifts' && (
        <div className="card">
          {!isAdmin && (
            <p className="muted-xs" style={{ marginBottom: '0.75rem' }}>
              * Thu ngân chỉ xem được ca đang mở và các ca do mình thực hiện. Admin xem được toàn bộ lịch sử ca.
            </p>
          )}
          {loading ? (
            <p className="muted-sm">Đang tải lịch sử ca...</p>
          ) : shifts.length === 0 ? (
            <p className="muted-sm">Chưa có lịch sử ca làm nào.</p>
          ) : (
            <>
              <div className="table-wrap desktop-only-table">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Trạng thái</th>
                      <th>Mở ca</th>
                      <th>Chốt ca</th>
                      <th className="num">Đầu ca</th>
                      <th className="num">Tiền mặt</th>
                      <th className="num">Chuyển khoản</th>
                      <th className="num">Lý thuyết két</th>
                      <th className="num">Thực đếm</th>
                      <th className="num">Chênh lệch</th>
                      <th>Ghi chú</th>
                      {isAdmin && <th></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {shifts.map((sh) => {
                      const isOpen = sh.status === 'open'
                      const cashRev = isOpen && openShift?.id === sh.id ? openShiftSummary?.cash_revenue || 0 : sh.cash_revenue
                      const transferRev =
                        isOpen && openShift?.id === sh.id ? openShiftSummary?.transfer_revenue || 0 : sh.transfer_revenue
                      const expected = isOpen ? sh.opening_cash + cashRev : sh.expected_cash
                      const diff = sh.cash_difference

                      return (
                        <tr key={sh.id}>
                          <td>
                            <span className={`status-pill ${isOpen ? 'status-available' : 'status-closed'}`}>
                              {isOpen ? 'Đang mở' : 'Đã chốt'}
                            </span>
                          </td>
                          <td>
                            <div>{sh.opened_by_name}</div>
                            <div className="muted-xs">{formatDateTime(sh.opened_at)}</div>
                          </td>
                          <td>
                            {sh.closed_at ? (
                              <>
                                <div>{sh.closed_by_name}</div>
                                <div className="muted-xs">{formatDateTime(sh.closed_at)}</div>
                              </>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="num">{formatVnd(sh.opening_cash)}</td>
                          <td className="num">{formatVnd(cashRev)}</td>
                          <td className="num">{formatVnd(transferRev)}</td>
                          <td className="num">{formatVnd(expected)}</td>
                          <td className="num">{sh.actual_cash != null ? formatVnd(sh.actual_cash) : '—'}</td>
                          <td className="num">
                            {diff == null ? (
                              '—'
                            ) : (
                              <strong className={diff === 0 ? 'text-green' : diff > 0 ? 'text-brass' : 'text-danger'}>
                                {diff > 0 ? `+${formatVnd(diff)}` : formatVnd(diff)}
                              </strong>
                            )}
                          </td>
                          <td className="muted-xs">{sh.notes || '—'}</td>
                          {isAdmin && (
                            <td>
                              {isOpen ? (
                                <span className="muted-xs" title="Vui lòng chốt ca trước khi xóa">
                                  —
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  className="btn btn-sm btn-ghost-danger"
                                  disabled={deletingShiftId === sh.id}
                                  onClick={() => handleDeleteShift(sh)}
                                >
                                  {deletingShiftId === sh.id ? 'Đang xóa...' : 'Xóa ca'}
                                </button>
                              )}
                            </td>
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <div className="mobile-card-list mobile-only-cards">
                {shifts.map((sh) => {
                  const isOpen = sh.status === 'open'
                  const cashRev = isOpen && openShift?.id === sh.id ? openShiftSummary?.cash_revenue || 0 : sh.cash_revenue
                  const transferRev =
                    isOpen && openShift?.id === sh.id ? openShiftSummary?.transfer_revenue || 0 : sh.transfer_revenue
                  const expected = isOpen ? sh.opening_cash + cashRev : sh.expected_cash
                  const diff = sh.cash_difference

                  return (
                    <div key={sh.id} className="mobile-data-card">
                      <div className="mobile-card-top">
                        <div>
                          <strong>{sh.opened_by_name}</strong>
                          <div className="muted-xs">Mở: {formatDateTime(sh.opened_at)}</div>
                          {sh.closed_at && (
                            <div className="muted-xs">
                              Chốt: {sh.closed_by_name} • {formatDateTime(sh.closed_at)}
                            </div>
                          )}
                        </div>
                        <span className={`status-pill ${isOpen ? 'status-available' : 'status-closed'}`}>
                          {isOpen ? 'Đang mở' : 'Đã chốt'}
                        </span>
                      </div>

                      <div className="mobile-card-grid">
                        <div>
                          <span className="muted-xs">Đầu ca</span>
                          <span className="num">{formatVnd(sh.opening_cash)}</span>
                        </div>
                        <div>
                          <span className="muted-xs">Tiền mặt / CK</span>
                          <span className="num">
                            {formatVnd(cashRev)} / {formatVnd(transferRev)}
                          </span>
                        </div>
                        <div>
                          <span className="muted-xs">Lý thuyết / Thực đếm</span>
                          <span className="num">
                            {formatVnd(expected)} / {sh.actual_cash != null ? formatVnd(sh.actual_cash) : '—'}
                          </span>
                        </div>
                        <div>
                          <span className="muted-xs">Chênh lệch</span>
                          {diff == null ? (
                            <span>—</span>
                          ) : (
                            <strong className={`num ${diff === 0 ? 'text-green' : diff > 0 ? 'text-brass' : 'text-danger'}`}>
                              {diff > 0 ? `+${formatVnd(diff)}` : formatVnd(diff)}
                            </strong>
                          )}
                        </div>
                      </div>
                      {sh.notes && <div className="muted-xs">Ghi chú: {sh.notes}</div>}
                      {isAdmin && !isOpen && (
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
                  )
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
