import { useEffect, useMemo, useState } from 'react'
import { api } from '../services/api'
import {
  formatDurationHms,
  formatMinutesReadable,
  formatTimeOnly,
  formatVnd,
  getRoundingLabel,
} from '../utils/format'
import { calculateTableFee, getEffectiveTablePricing } from '../utils/pricing'
import { calculateDiscount } from '../utils/discount'
import { playPaymentSuccessSound } from '../utils/paymentSound'
import { noteWithTransferReference, referenceFromSessionId, transferMemo } from '../utils/transferReference'
import { DiscountFields } from './DiscountFields'
import { PaymentPreview } from './PaymentPreview'
import { CoffeeIcon, PlusIcon, SwapIcon } from './Icons'

export function TablesView({
  tableTypes,
  tables,
  menuItems,
  openSessions,
  openShift,
  onRefresh,
  onOpenShiftModal,
  onInvoiceCreated,
}) {
  const [nowMs, setNowMs] = useState(() => Date.now())
  const [openTableTarget, setOpenTableTarget] = useState(null)
  const [openNote, setOpenNote] = useState('')
  const [selectedSessionId, setSelectedSessionId] = useState(null)
  const [sessionTab, setSessionTab] = useState('order') // 'order' | 'transfer' | 'checkout'
  const [menuCategory, setMenuCategory] = useState('Tất cả')
  const [menuSearch, setMenuSearch] = useState('')
  const [transferTargetId, setTransferTargetId] = useState('')
  const [applyTargetPricing, setApplyTargetPricing] = useState(false)
  const [transferNote, setTransferNote] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [discountType, setDiscountType] = useState('none')
  const [discountValue, setDiscountValue] = useState('')
  const [checkoutNote, setCheckoutNote] = useState('')
  const [showPaymentPreview, setShowPaymentPreview] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  const tableTypesMap = useMemo(() => {
    const map = {}
    for (const tt of tableTypes) map[tt.id] = tt
    return map
  }, [tableTypes])

  const sessionByTableId = useMemo(() => {
    const map = {}
    for (const s of openSessions) map[s.table_id] = s
    return map
  }, [openSessions])

  const selectedSession = useMemo(
    () => openSessions.find((s) => s.id === selectedSessionId) || null,
    [openSessions, selectedSessionId]
  )

  const availableTables = useMemo(
    () => tables.filter((t) => t.status === 'available'),
    [tables]
  )

  const stats = useMemo(() => {
    let available = 0
    let playing = 0
    let pending = 0
    let maintenance = 0
    let provisionalTotal = 0

    for (const t of tables) {
      if (t.status === 'available') available += 1
      else if (t.status === 'maintenance') maintenance += 1
      else if (t.status === 'playing') {
        const s = sessionByTableId[t.id]
        if (s) {
          if (s.status === 'pending') pending += 1
          else playing += 1
          const calc = calculateTableFee({
            startedAt: s.started_at,
            endedAt: s.ended_at || nowMs,
            hourlyRate: s.hourly_rate_snapshot,
            roundingMinutes: s.rounding_minutes_snapshot,
            roundingMode: s.rounding_mode_snapshot,
            minMinutes: s.min_minutes_snapshot,
          })
          const itemsSum = (s.session_items || []).reduce(
            (sum, i) => sum + i.unit_price_snapshot * i.quantity,
            0
          )
          provisionalTotal += calc.tableFee + itemsSum
        }
      }
    }
    return { available, playing, pending, maintenance, provisionalTotal }
  }, [tables, sessionByTableId, nowMs])

  const activeMenuItems = useMemo(() => {
    const q = menuSearch.trim().toLowerCase()
    return menuItems.filter((item) => {
      if (!item.is_active) return false
      if (menuCategory !== 'Tất cả' && item.category !== menuCategory) return false
      if (q && !item.name.toLowerCase().includes(q)) return false
      return true
    })
  }, [menuItems, menuCategory, menuSearch])

  function handleClickOpenTable(table) {
    setError('')
    if (!openShift) {
      onOpenShiftModal()
      return
    }
    setOpenNote('')
    setOpenTableTarget(table)
  }

  async function handleConfirmOpenTable(e) {
    e.preventDefault()
    if (!openTableTarget) return
    setBusy(true)
    setError('')
    try {
      const created = await api.openTableSession({
        tableId: openTableTarget.id,
        notes: openNote,
      })
      setOpenTableTarget(null)
      await onRefresh()
      setSelectedSessionId(created.id)
      setSessionTab('order')
    } catch (err) {
      setError(err.message || 'Không thể mở bàn.')
    } finally {
      setBusy(false)
    }
  }

  function openSessionWorkspace(session, initialTab = 'order') {
    setError('')
    setSelectedSessionId(session.id)
    setSessionTab(session.status === 'pending' ? 'checkout' : initialTab)
    setDiscountType('none')
    setDiscountValue('')
    setMenuCategory('Tất cả')
    setMenuSearch('')
    setTransferTargetId(availableTables[0]?.id || '')
    setApplyTargetPricing(false)
    setTransferNote('')
    setPaymentMethod('cash')
    setCheckoutNote(session.notes || '')
    setShowPaymentPreview(false)
  }

  async function handleAddMenuItem(menuItemId) {
    if (!selectedSession) return
    setBusy(true)
    setError('')
    try {
      await api.addSessionItem({
        sessionId: selectedSession.id,
        menuItemId,
        quantity: 1,
      })
      await onRefresh()
    } catch (err) {
      setError(err.message || 'Không thể thêm món.')
    } finally {
      setBusy(false)
    }
  }

  async function handleChangeItemQty(sessionItemId, nextQty) {
    setBusy(true)
    setError('')
    try {
      await api.setSessionItemQuantity({
        sessionItemId,
        quantity: nextQty,
      })
      await onRefresh()
    } catch (err) {
      setError(err.message || 'Không thể cập nhật số lượng món.')
    } finally {
      setBusy(false)
    }
  }

  async function handleTransferTable(e) {
    e.preventDefault()
    if (!selectedSession || !transferTargetId) return
    setBusy(true)
    setError('')
    try {
      await api.transferTableSession({
        sessionId: selectedSession.id,
        toTableId: transferTargetId,
        applyTargetPricing,
        note: transferNote,
      })
      await onRefresh()
      setSessionTab('order')
      setTransferNote('')
    } catch (err) {
      setError(err.message || 'Không thể chuyển bàn.')
    } finally {
      setBusy(false)
    }
  }

  function handleConfirmBill(e) {
    e.preventDefault()
    if (!selectedSession || selectedSession.status !== 'pending' || !tableDiscount.valid) return
    setShowPaymentPreview(true)
  }

  async function handleCheckout() {
    if (!selectedSession || selectedSession.status !== 'pending' || !tableDiscount.valid || !showPaymentPreview || busy) return
    setBusy(true)
    setError('')
    try {
      const invoice = await api.checkoutSession({
        sessionId: selectedSession.id,
        paymentMethod,
        note: paymentMethod === 'transfer'
          ? noteWithTransferReference(checkoutNote, referenceFromSessionId(selectedSession.id))
          : checkoutNote,
        discountType,
        discountValue: discountType === 'none' ? 0 : Number(discountValue || 0),
      })
      playPaymentSuccessSound()
      setDiscountType('none')
      setDiscountValue('')
      setShowPaymentPreview(false)
      setSelectedSessionId(null)
      await onRefresh()
      onInvoiceCreated(invoice)
    } catch (err) {
      setError(err.message || 'Thanh toán thất bại.')
    } finally {
      setBusy(false)
    }
  }

  async function handleStopSession() {
    if (!selectedSession || selectedSession.status !== 'open' || busy) return
    setBusy(true)
    setError('')
    try {
      await api.stopTableSession({ sessionId: selectedSession.id })
      await onRefresh()
      setSessionTab('checkout')
      setShowPaymentPreview(false)
    } catch (err) {
      setError(err.message || 'Không thể kết thúc bàn.')
    } finally {
      setBusy(false)
    }
  }

  const selectedSessionPricing = useMemo(() => {
    if (!selectedSession) return null
    const calc = calculateTableFee({
      startedAt: selectedSession.started_at,
      endedAt: selectedSession.ended_at || nowMs,
      hourlyRate: selectedSession.hourly_rate_snapshot,
      roundingMinutes: selectedSession.rounding_minutes_snapshot,
      roundingMode: selectedSession.rounding_mode_snapshot,
      minMinutes: selectedSession.min_minutes_snapshot,
    })
    const items = selectedSession.session_items || []
    const itemsFee = items.reduce((sum, i) => sum + i.unit_price_snapshot * i.quantity, 0)
    return {
      ...calc,
      itemsFee,
      totalFee: calc.tableFee + itemsFee,
    }
  }, [selectedSession, nowMs])
  const tableDiscount = calculateDiscount(selectedSessionPricing?.totalFee || 0, discountType, discountValue)
  const tableAmountDue = (selectedSessionPricing?.totalFee || 0) - tableDiscount.amount

  return (
    <div className="page-stack">
      {!openShift && (
        <div className="alert alert-warning split-alert">
          <div>
            <strong>Chưa mở ca làm việc:</strong> Thu ngân cần mở ca với tiền mặt đầu ca trước khi mở bàn và thu tiền.
          </div>
          <button type="button" className="btn btn-primary btn-sm" onClick={onOpenShiftModal}>
            Mở ca ngay
          </button>
        </div>
      )}

      {error && !selectedSession && !openTableTarget && <div className="alert alert-danger">{error}</div>}

      <div className="kpi-strip">
        <div className="kpi-chip">
          <span className="kpi-label">Đang chơi</span>
          <strong className="kpi-value text-amber">{stats.playing} bàn</strong>
        </div>
        <div className="kpi-chip">
          <span className="kpi-label">Bàn trống</span>
          <strong className="kpi-value text-green">{stats.available} bàn</strong>
        </div>
        <div className="kpi-chip">
          <span className="kpi-label">Chờ thanh toán</span>
          <strong className="kpi-value">{stats.pending} bàn</strong>
        </div>
        <div className="kpi-chip">
          <span className="kpi-label">Bảo trì</span>
          <strong className="kpi-value text-muted">{stats.maintenance} bàn</strong>
        </div>
        <div className="kpi-chip">
          <span className="kpi-label">Tạm tính hiện tại</span>
          <strong className="kpi-value num">{formatVnd(stats.provisionalTotal)}</strong>
        </div>
      </div>

      <div className="tables-grid">
        {tables.map((table) => {
          const pricing = getEffectiveTablePricing(table, tableTypesMap)
          const session = sessionByTableId[table.id]
          const isPlaying = table.status === 'playing' && session
          const isPending = session?.status === 'pending'
          const isMaintenance = table.status === 'maintenance'

          let liveCalc = null
          let itemsFee = 0
          let itemsCount = 0

          if (isPlaying) {
            liveCalc = calculateTableFee({
              startedAt: session.started_at,
              endedAt: session.ended_at || nowMs,
              hourlyRate: session.hourly_rate_snapshot,
              roundingMinutes: session.rounding_minutes_snapshot,
              roundingMode: session.rounding_mode_snapshot,
              minMinutes: session.min_minutes_snapshot,
            })
            for (const item of session.session_items || []) {
              itemsCount += item.quantity
              itemsFee += item.unit_price_snapshot * item.quantity
            }
          }

          return (
            <article
              key={table.id}
              className={`table-card status-card-${table.status}`}
            >
              <div className="table-card-head">
                <div>
                  <h3>{table.name}</h3>
                  <div className="table-type-label">{pricing.typeName}</div>
                </div>
                <span className={`status-pill status-${table.status}`}>
                  {table.status === 'available'
                    ? 'Trống'
                    : table.status === 'playing'
                      ? isPending ? 'Chờ thanh toán' : 'Đang chơi'
                      : 'Bảo trì'}
                </span>
              </div>

              <div className="table-card-rate">
                <span className="num">{formatVnd(isPlaying ? session.hourly_rate_snapshot : pricing.hourlyRate)}/giờ</span>
                <span className="muted-xs">
                  {getRoundingLabel(
                    isPlaying ? session.rounding_mode_snapshot : pricing.roundingMode,
                    isPlaying ? session.rounding_minutes_snapshot : pricing.roundingMinutes,
                    isPlaying ? session.min_minutes_snapshot : pricing.minMinutes
                  )}
                </span>
              </div>

              {isPlaying && liveCalc ? (
                <div className="table-live-box">
                  <div className="live-row">
                    <span>Giờ bắt đầu</span>
                    <strong className="num">{formatTimeOnly(session.started_at)}</strong>
                  </div>
                  <div className="live-row">
                    <span>{isPending ? 'Thời gian đã chốt' : 'Thời gian chơi'}</span>
                    <strong className="timer-badge num">{formatDurationHms(liveCalc.durationSeconds)}</strong>
                  </div>
                  <div className="live-row">
                    <span>Tiền giờ ({formatMinutesReadable(liveCalc.billedMinutes)})</span>
                    <span className="num">{formatVnd(liveCalc.tableFee)}</span>
                  </div>
                  <div className="live-row">
                    <span>Đồ uống/ăn ({itemsCount})</span>
                    <span className="num">{formatVnd(itemsFee)}</span>
                  </div>
                  <div className="live-row live-total">
                    <span>Tạm tính</span>
                    <strong className="num">{formatVnd(liveCalc.tableFee + itemsFee)}</strong>
                  </div>
                </div>
              ) : (
                <div className="table-idle-box">
                  {isMaintenance ? (
                    <p className="muted-sm">
                      {table.notes || 'Bàn đang bảo trì, tạm ngưng phục vụ.'}
                    </p>
                  ) : (
                    <p className="muted-sm">
                      {table.notes || 'Sẵn sàng đón khách.'}
                    </p>
                  )}
                </div>
              )}

              <div className="table-card-actions">
                {table.status === 'available' && (
                  <button
                    type="button"
                    className="btn btn-primary btn-block"
                    onClick={() => handleClickOpenTable(table)}
                  >
                    <PlusIcon size={16} />
                    <span>Mở bàn</span>
                  </button>
                )}

                {isPlaying && (
                  <>
                    {!isPending && <button
                      type="button"
                      className="btn btn-outline"
                      onClick={() => openSessionWorkspace(session, 'order')}
                    >
                      <CoffeeIcon size={16} />
                      <span>Gọi món / Chi tiết</span>
                    </button>}
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => openSessionWorkspace(session, 'checkout')}
                    >
                      {isPending ? 'Hóa đơn & thu tiền' : 'Kết thúc bàn'}
                    </button>
                  </>
                )}

                {isMaintenance && (
                  <button type="button" className="btn btn-ghost btn-block" disabled>
                    Đang bảo trì
                  </button>
                )}
              </div>
            </article>
          )
        })}
      </div>

      {/* Modal mở bàn */}
      {openTableTarget && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Mở phiên chơi">
          <div className="modal-card modal-sm">
            <div className="modal-header">
              <h3>Mở phiên — {openTableTarget.name}</h3>
              <button type="button" className="btn btn-ghost" onClick={() => setOpenTableTarget(null)}>
                Đóng
              </button>
            </div>
            <form onSubmit={handleConfirmOpenTable} className="modal-body form-stack">
              {error && <div className="alert alert-danger">{error}</div>}
              {(() => {
                const p = getEffectiveTablePricing(openTableTarget, tableTypesMap)
                return (
                  <div className="info-box">
                    <div>
                      Loại bàn: <strong>{p.typeName}</strong>
                    </div>
                    <div>
                      Đơn giá áp dụng: <strong className="num">{formatVnd(p.hourlyRate)}/giờ</strong>
                    </div>
                    <div className="muted-xs">
                      {getRoundingLabel(p.roundingMode, p.roundingMinutes, p.minMinutes)}
                    </div>
                  </div>
                )
              })()}

              <label className="field">
                <span>Ghi chú khách / bàn (không bắt buộc)</span>
                <input
                  type="text"
                  placeholder="Ví dụ: Khách quen, nhóm 4 người..."
                  value={openNote}
                  onChange={(e) => setOpenNote(e.target.value)}
                />
              </label>

              <div className="modal-footer-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setOpenTableTarget(null)}>
                  Hủy
                </button>
                <button type="submit" className="btn btn-primary" disabled={busy}>
                  {busy ? 'Đang mở...' : 'Bắt đầu tính giờ'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal vận hành phiên đang chơi */}
      {selectedSession && selectedSessionPricing && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Chi tiết phiên chơi">
          <div className="modal-card modal-xl">
            <div className="modal-header">
              <div>
                <h3>
                  {selectedSession.table_name_snapshot} • {selectedSession.table_type_snapshot}
                </h3>
                <div className="muted-sm">
                  Bắt đầu lúc {formatTimeOnly(selectedSession.started_at)} • Đã chơi{' '}
                  <strong className="num">{formatDurationHms(selectedSessionPricing.durationSeconds)}</strong> •{' '}
                  Tính tiền <strong>{formatMinutesReadable(selectedSessionPricing.billedMinutes)}</strong> (
                  <span className="num">{formatVnd(selectedSession.hourly_rate_snapshot)}/giờ</span>)
                </div>
              </div>
              <button type="button" className="btn btn-ghost" onClick={() => setSelectedSessionId(null)}>
                Đóng
              </button>
            </div>

            <div className="modal-subtabs">
              <button
                type="button"
                className={`tab-pill ${sessionTab === 'order' ? 'active' : ''}`}
                disabled={selectedSession.status === 'pending'}
                onClick={() => {
                  setSessionTab('order')
                  setError('')
                }}
              >
                Gọi món ({(selectedSession.session_items || []).reduce((s, i) => s + i.quantity, 0)})
              </button>
              <button
                type="button"
                className={`tab-pill ${sessionTab === 'transfer' ? 'active' : ''}`}
                disabled={selectedSession.status === 'pending'}
                onClick={() => {
                  setSessionTab('transfer')
                  setTransferTargetId(availableTables[0]?.id || '')
                  setError('')
                }}
              >
                <SwapIcon size={15} /> Chuyển bàn
              </button>
              <button
                type="button"
                className={`tab-pill ${sessionTab === 'checkout' ? 'active' : ''}`}
                onClick={() => {
                  setSessionTab('checkout')
                  setError('')
                }}
              >
                {selectedSession.status === 'pending' ? 'Hóa đơn & thanh toán' : 'Kết thúc bàn'} ({formatVnd(selectedSessionPricing.totalFee)})
              </button>
            </div>

            <div className="modal-body">
              {error && <div className="alert alert-danger" style={{ marginBottom: '0.85rem' }}>{error}</div>}

              {sessionTab === 'order' && (
                <div className="session-order-layout">
                  {/* Danh sách món đã gọi */}
                  <div className="panel-box">
                    <h4>Món đã gọi trên {selectedSession.table_name_snapshot}</h4>
                    {(selectedSession.session_items || []).length === 0 ? (
                      <p className="muted-sm">Chưa có món nào. Chọn món từ thực đơn bên cạnh để thêm.</p>
                    ) : (
                      <div className="ordered-list">
                        {(selectedSession.session_items || []).map((item) => (
                          <div key={item.id} className="ordered-item">
                            <div>
                              <strong>{item.item_name_snapshot}</strong>
                              <div className="muted-xs num">
                                {formatVnd(item.unit_price_snapshot)} / {item.unit_snapshot}
                              </div>
                            </div>
                            <div className="qty-controls">
                              <button
                                type="button"
                                className="btn-qty"
                                disabled={busy}
                                onClick={() => handleChangeItemQty(item.id, item.quantity - 1)}
                                aria-label="Giảm số lượng"
                              >
                                −
                              </button>
                              <span className="num qty-num">{item.quantity}</span>
                              <button
                                type="button"
                                className="btn-qty"
                                disabled={busy}
                                onClick={() => handleChangeItemQty(item.id, item.quantity + 1)}
                                aria-label="Tăng số lượng"
                              >
                                +
                              </button>
                              <strong className="num line-total">
                                {formatVnd(item.unit_price_snapshot * item.quantity)}
                              </strong>
                              <button
                                type="button"
                                className="btn btn-sm btn-ghost-danger"
                                disabled={busy}
                                onClick={() => handleChangeItemQty(item.id, 0)}
                              >
                                Xóa
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="summary-divider">
                      <div className="live-row">
                        <span>Tiền giờ tạm tính</span>
                        <span className="num">{formatVnd(selectedSessionPricing.tableFee)}</span>
                      </div>
                      <div className="live-row">
                        <span>Tiền đồ uống &amp; đồ ăn</span>
                        <span className="num">{formatVnd(selectedSessionPricing.itemsFee)}</span>
                      </div>
                      <div className="live-row live-total">
                        <span>Tổng tạm tính</span>
                        <strong className="num">{formatVnd(selectedSessionPricing.totalFee)}</strong>
                      </div>
                    </div>

                    {(selectedSession.session_transfers || []).length > 0 && (
                      <div className="transfer-history">
                        <div className="muted-xs" style={{ fontWeight: 600, marginBottom: '0.25rem' }}>
                          Lịch sử chuyển bàn:
                        </div>
                        {selectedSession.session_transfers.map((tr) => (
                          <div key={tr.id} className="muted-xs">
                            • {tr.from_table_name} → {tr.to_table_name} ({formatTimeOnly(tr.transferred_at)})
                            {tr.note ? ` — ${tr.note}` : ''}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Chọn món từ thực đơn */}
                  <div className="panel-box">
                    <div className="menu-filter-bar">
                      <input
                        type="search"
                        placeholder="Tìm nhanh đồ uống, đồ ăn..."
                        value={menuSearch}
                        onChange={(e) => setMenuSearch(e.target.value)}
                      />
                      <div className="chip-row">
                        {['Tất cả', 'Đồ uống', 'Đồ ăn', 'Khác'].map((cat) => (
                          <button
                            key={cat}
                            type="button"
                            className={`chip ${menuCategory === cat ? 'active' : ''}`}
                            onClick={() => setMenuCategory(cat)}
                          >
                            {cat}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="menu-picker-grid">
                      {activeMenuItems.length === 0 ? (
                        <p className="muted-sm">Không có món phù hợp đang bán.</p>
                      ) : (
                        activeMenuItems.map((m) => (
                          <button
                            key={m.id}
                            type="button"
                            className="menu-pick-btn"
                            disabled={busy || (m.stock_quantity != null && m.stock_quantity < 1)}
                            onClick={() => handleAddMenuItem(m.id)}
                          >
                            <span className="menu-pick-name">{m.name}</span>
                            <span className="menu-pick-meta">
                              <strong className="num">{formatVnd(m.price)}</strong> / {m.unit}
                              {m.stock_quantity != null && ` • Còn ${m.stock_quantity}`}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}

              {sessionTab === 'transfer' && (
                <form onSubmit={handleTransferTable} className="form-stack narrow-panel">
                  <h4>Chuyển bàn đang chơi</h4>
                  <p className="muted-sm">
                    Giờ bắt đầu ({formatTimeOnly(selectedSession.started_at)}) và toàn bộ{' '}
                    <strong>{(selectedSession.session_items || []).length}</strong> món đã gọi sẽ được chuyển sang bàn mới.
                  </p>

                  {availableTables.length === 0 ? (
                    <div className="alert alert-warning">
                      Hiện không còn bàn trống nào để chuyển sang.
                    </div>
                  ) : (
                    <>
                      <label className="field">
                        <span>Chọn bàn đích (đang Trống)</span>
                        <select
                          required
                          value={transferTargetId}
                          onChange={(e) => setTransferTargetId(e.target.value)}
                        >
                          {availableTables.map((t) => {
                            const p = getEffectiveTablePricing(t, tableTypesMap)
                            return (
                              <option key={t.id} value={t.id}>
                                {t.name} ({p.typeName} — {formatVnd(p.hourlyRate)}/giờ)
                              </option>
                            )
                          })}
                        </select>
                      </label>

                      <label className="checkbox-field">
                        <input
                          type="checkbox"
                          checked={applyTargetPricing}
                          onChange={(e) => setApplyTargetPricing(e.target.checked)}
                        />
                        <span>Áp dụng đơn giá &amp; quy tắc làm tròn của bàn mới</span>
                      </label>

                      <label className="field">
                        <span>Lý do / ghi chú chuyển bàn</span>
                        <input
                          type="text"
                          placeholder="Ví dụ: Khách đổi sang bàn VIP / Bàn cũ bị chói đèn..."
                          value={transferNote}
                          onChange={(e) => setTransferNote(e.target.value)}
                        />
                      </label>

                      <div>
                        <button type="submit" className="btn btn-primary" disabled={busy}>
                          {busy ? 'Đang chuyển...' : 'Xác nhận chuyển bàn'}
                        </button>
                      </div>
                    </>
                  )}
                </form>
              )}

              {sessionTab === 'checkout' && (selectedSession.status !== 'pending' ? (
                <div className="panel-box form-stack">
                  <h4>Kết thúc bàn để lập hóa đơn</h4>
                  <p className="muted-sm">Bàn vẫn đang tính giờ. Hãy kết thúc bàn để chốt thời gian và số tiền; sau đó hóa đơn cùng mã QR chuyển khoản mới xuất hiện.</p>
                  <div className="live-row"><span>Tạm tính hiện tại</span><strong className="num">{formatVnd(selectedSessionPricing.totalFee)}</strong></div>
                  <button type="button" className="btn btn-primary btn-lg" disabled={busy} onClick={handleStopSession}>
                    {busy ? 'Đang kết thúc bàn...' : 'Kết thúc bàn & chốt hóa đơn'}
                  </button>
                </div>
              ) : showPaymentPreview ? (
                <PaymentPreview
                  tableName={selectedSession.table_name_snapshot}
                  startedAt={selectedSession.started_at}
                  endedAt={selectedSession.ended_at}
                  billedMinutes={selectedSessionPricing.billedMinutes}
                  tableFee={selectedSessionPricing.tableFee}
                  items={(selectedSession.session_items || []).map((item) => ({
                    id: item.id, name: item.item_name_snapshot, quantity: item.quantity,
                    total: item.unit_price_snapshot * item.quantity,
                  }))}
                  itemsFee={selectedSessionPricing.itemsFee}
                  discountAmount={tableDiscount.amount}
                  amountDue={tableAmountDue}
                  paymentMethod={paymentMethod}
                  memo={transferMemo(referenceFromSessionId(selectedSession.id))}
                  note={checkoutNote}
                  busy={busy}
                  onBack={() => setShowPaymentPreview(false)}
                  onConfirm={handleCheckout}
                />
              ) : (
                <form onSubmit={handleConfirmBill} className="checkout-layout">
                  <div className="panel-box">
                    <h4>Xem trước hóa đơn thanh toán</h4>
                    <div className="checkout-breakdown">
                      <div className="live-row">
                        <span>Bàn</span>
                        <strong>{selectedSession.table_name_snapshot}</strong>
                      </div>
                      <div className="live-row">
                        <span>Giờ vào</span>
                        <span>{formatTimeOnly(selectedSession.started_at)}</span>
                      </div>
                      <div className="live-row">
                        <span>Thời lượng chơi</span>
                        <span className="num">{formatDurationHms(selectedSessionPricing.durationSeconds)}</span>
                      </div>
                      <div className="live-row">
                        <span>Thời gian tính tiền</span>
                        <span>{formatMinutesReadable(selectedSessionPricing.billedMinutes)}</span>
                      </div>
                      <div className="live-row">
                        <span>Đơn giá giờ</span>
                        <span className="num">{formatVnd(selectedSession.hourly_rate_snapshot)}/giờ</span>
                      </div>
                      <div className="live-row">
                        <span>Tiền giờ chơi</span>
                        <strong className="num">{formatVnd(selectedSessionPricing.tableFee)}</strong>
                      </div>
                      <div className="live-row">
                        <span>Tiền đồ uống &amp; đồ ăn</span>
                        <strong className="num">{formatVnd(selectedSessionPricing.itemsFee)}</strong>
                      </div>
                      {(selectedSession.session_items || []).map((item) => <div className="live-row" key={item.id}>
                        <span>{item.item_name_snapshot} × {item.quantity}</span>
                        <span className="num">{formatVnd(item.unit_price_snapshot * item.quantity)}</span>
                      </div>)}
                      <div className="live-row">
                        <span>Tạm tính</span>
                        <strong className="num">{formatVnd(selectedSessionPricing.totalFee)}</strong>
                      </div>
                      {tableDiscount.amount > 0 && <div className="live-row">
                        <span>Giảm giá</span>
                        <strong className="num">−{formatVnd(tableDiscount.amount)}</strong>
                      </div>}
                      <div className="live-row live-total">
                        <span>Khách thanh toán</span>
                        <strong className="num">{formatVnd(tableAmountDue)}</strong>
                      </div>
                    </div>
                  </div>

                  <div className="panel-box form-stack">
                    <h4>Xác nhận hóa đơn</h4>
                    <DiscountFields subtotal={selectedSessionPricing.totalFee} type={discountType} value={discountValue}
                      onTypeChange={setDiscountType} onValueChange={setDiscountValue} disabled={busy} />
                    <div className="field">
                      <span>Phương thức thanh toán</span>
                      <div className="payment-methods">
                        <button
                          type="button"
                          className={`pay-choice ${paymentMethod === 'cash' ? 'active' : ''}`}
                          onClick={() => setPaymentMethod('cash')}
                        >
                          <strong>Tiền mặt</strong>
                          <span>Cộng vào tiền két trong ca</span>
                        </button>
                        <button
                          type="button"
                          className={`pay-choice ${paymentMethod === 'transfer' ? 'active' : ''}`}
                          onClick={() => setPaymentMethod('transfer')}
                        >
                          <strong>Chuyển khoản</strong>
                          <span>QR / Ngân hàng</span>
                        </button>
                      </div>
                    </div>

                    <label className="field">
                      <span>Ghi chú hóa đơn (tùy chọn)</span>
                      <input
                        type="text"
                        placeholder="Ghi chú in trên hóa đơn..."
                        value={checkoutNote}
                        onChange={(e) => setCheckoutNote(e.target.value)}
                      />
                    </label>

                    <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={busy || !tableDiscount.valid}>
                      {paymentMethod === 'transfer' ? 'Xác nhận hóa đơn → Xem QR & in' : 'Xác nhận hóa đơn → In'}
                    </button>
                    <p className="muted-xs">
                      Sau bước này, bạn có thể in hóa đơn chờ thanh toán. Bàn chỉ trở về Trống khi xác nhận đã nhận tiền.
                    </p>
                  </div>
                </form>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
