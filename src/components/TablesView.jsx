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
  const [checkoutNote, setCheckoutNote] = useState('')
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
    let maintenance = 0
    let provisionalTotal = 0

    for (const t of tables) {
      if (t.status === 'available') available += 1
      else if (t.status === 'maintenance') maintenance += 1
      else if (t.status === 'playing') {
        playing += 1
        const s = sessionByTableId[t.id]
        if (s) {
          const calc = calculateTableFee({
            startedAt: s.started_at,
            endedAt: nowMs,
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
    return { available, playing, maintenance, provisionalTotal }
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
    setSessionTab(initialTab)
    setMenuCategory('Tất cả')
    setMenuSearch('')
    setTransferTargetId(availableTables[0]?.id || '')
    setApplyTargetPricing(false)
    setTransferNote('')
    setPaymentMethod('cash')
    setCheckoutNote(session.notes || '')
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

  async function handleCheckout(e) {
    e.preventDefault()
    if (!selectedSession) return
    setBusy(true)
    setError('')
    try {
      const invoice = await api.checkoutSession({
        sessionId: selectedSession.id,
        paymentMethod,
        note: checkoutNote,
      })
      setSelectedSessionId(null)
      await onRefresh()
      onInvoiceCreated(invoice)
    } catch (err) {
      setError(err.message || 'Thanh toán thất bại.')
    } finally {
      setBusy(false)
    }
  }

  const selectedSessionPricing = useMemo(() => {
    if (!selectedSession) return null
    const calc = calculateTableFee({
      startedAt: selectedSession.started_at,
      endedAt: nowMs,
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
          const isMaintenance = table.status === 'maintenance'

          let liveCalc = null
          let itemsFee = 0
          let itemsCount = 0

          if (isPlaying) {
            liveCalc = calculateTableFee({
              startedAt: session.started_at,
              endedAt: nowMs,
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
                      ? 'Đang chơi'
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
                    <span>Thời gian chơi</span>
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
                    <button
                      type="button"
                      className="btn btn-outline"
                      onClick={() => openSessionWorkspace(session, 'order')}
                    >
                      <CoffeeIcon size={16} />
                      <span>Gọi món / Chi tiết</span>
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => openSessionWorkspace(session, 'checkout')}
                    >
                      Thanh toán
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
                Thanh toán ({formatVnd(selectedSessionPricing.totalFee)})
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
                            disabled={busy}
                            onClick={() => handleAddMenuItem(m.id)}
                          >
                            <span className="menu-pick-name">{m.name}</span>
                            <span className="menu-pick-meta">
                              <strong className="num">{formatVnd(m.price)}</strong> / {m.unit}
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

              {sessionTab === 'checkout' && (
                <form onSubmit={handleCheckout} className="checkout-layout">
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
                      <div className="live-row live-total">
                        <span>TỔNG CỘNG</span>
                        <strong className="num">{formatVnd(selectedSessionPricing.totalFee)}</strong>
                      </div>
                    </div>
                  </div>

                  <div className="panel-box form-stack">
                    <h4>Xác nhận thu tiền</h4>
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

                    <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={busy}>
                      {busy
                        ? 'Đang xử lý thanh toán...'
                        : `Xác nhận thanh toán ${formatVnd(selectedSessionPricing.totalFee)}`}
                    </button>
                    <p className="muted-xs">
                      Sau khi xác nhận, phiên chơi sẽ đóng, bàn trở về trạng thái Trống và hóa đơn được lưu vĩnh viễn.
                    </p>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
