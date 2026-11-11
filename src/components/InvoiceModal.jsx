import { useState } from 'react'
import { api } from '../services/api'
import {
  formatDateTime,
  formatDurationHms,
  formatMinutesReadable,
  formatVnd,
  getInvoiceStatusLabel,
  getPaymentMethodLabel,
  getRoundingLabel,
} from '../utils/format'
import { PrintIcon } from './Icons'

export function InvoiceModal({ invoice, isAdmin, onClose, onInvoiceUpdated }) {
  const [adjustMode, setAdjustMode] = useState(null) // 'discount' | 'edit' | 'void' | null
  const [discountAmount, setDiscountAmount] = useState(invoice.discount_amount ?? 0)
  const [tableFee, setTableFee] = useState(invoice.table_fee ?? 0)
  const [itemsFee, setItemsFee] = useState(invoice.items_fee ?? 0)
  const [paymentMethod, setPaymentMethod] = useState(invoice.payment_method || 'cash')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function startAdjust(mode) {
    setAdjustMode(mode)
    setDiscountAmount(invoice.discount_amount ?? 0)
    setTableFee(invoice.table_fee ?? 0)
    setItemsFee(invoice.items_fee ?? 0)
    setPaymentMethod(invoice.payment_method || 'cash')
    setReason('')
    setError('')
  }

  async function handleSubmitAdjustment(e) {
    e.preventDefault()
    if (reason.trim().length < 3) {
      setError('Vui lòng nhập lý do rõ ràng (tối thiểu 3 ký tự).')
      return
    }
    setSaving(true)
    setError('')
    try {
      const updated = await api.adjustInvoice({
        invoiceId: invoice.id,
        actionType: adjustMode,
        reason: reason.trim(),
        discountAmount: adjustMode === 'void' ? undefined : Number(discountAmount) || 0,
        tableFee: adjustMode === 'edit' ? Number(tableFee) || 0 : undefined,
        itemsFee: adjustMode === 'edit' ? Number(itemsFee) || 0 : undefined,
        paymentMethod: adjustMode === 'edit' ? paymentMethod : undefined,
      })
      setAdjustMode(null)
      onInvoiceUpdated?.(updated)
    } catch (err) {
      setError(err.message || 'Không thể điều chỉnh hóa đơn.')
    } finally {
      setSaving(false)
    }
  }

  const items = invoice.invoice_items || []
  const adjustments = invoice.invoice_adjustments || []

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Chi tiết hóa đơn">
      <div className="modal-card modal-lg">
        <div className="modal-header no-print">
          <div>
            <h3>Hóa đơn {invoice.invoice_code}</h3>
            <span className={`status-pill status-${invoice.status}`}>
              {getInvoiceStatusLabel(invoice.status)}
            </span>
          </div>
          <div className="row-actions">
            <button type="button" className="btn btn-primary" onClick={() => window.print()}>
              <PrintIcon size={16} />
              <span>In hóa đơn</span>
            </button>
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Đóng
            </button>
          </div>
        </div>

        <div className="modal-body invoice-modal-body">
          {/* Khu vực in hóa đơn */}
          <div className="receipt-sheet print-area">
            <div className="receipt-header">
              <h2>DUY MINH BI-A</h2>
              <p>HÓA ĐƠN THANH TOÁN</p>
              <div className="receipt-code">Số: {invoice.invoice_code}</div>
              {invoice.status === 'voided' && (
                <div className="receipt-void-stamp">HÓA ĐƠN ĐÃ HỦY</div>
              )}
            </div>

            <div className="receipt-meta">
              <div>
                <span>Bàn:</span>
                <strong>
                  {invoice.table_name} ({invoice.table_type_name})
                </strong>
              </div>
              <div>
                <span>Thu ngân:</span>
                <strong>{invoice.cashier_name}</strong>
              </div>
              <div>
                <span>Giờ vào:</span>
                <span>{formatDateTime(invoice.started_at)}</span>
              </div>
              <div>
                <span>Giờ ra:</span>
                <span>{formatDateTime(invoice.ended_at)}</span>
              </div>
              <div>
                <span>Chơi thực tế:</span>
                <span>{formatDurationHms(invoice.duration_seconds)}</span>
              </div>
              <div>
                <span>Tính tiền:</span>
                <span>{formatMinutesReadable(invoice.billed_minutes)}</span>
              </div>
              <div>
                <span>Thanh toán:</span>
                <strong>{getPaymentMethodLabel(invoice.payment_method)}</strong>
              </div>
              <div>
                <span>Thời điểm xuất:</span>
                <span>{formatDateTime(invoice.paid_at)}</span>
              </div>
            </div>

            <div className="receipt-section">
              <div className="receipt-section-title">1. Tiền giờ chơi</div>
              <div className="receipt-line">
                <div>
                  <div>
                    {formatVnd(invoice.hourly_rate_snapshot)}/giờ ×{' '}
                    {formatMinutesReadable(invoice.billed_minutes)}
                  </div>
                  <div className="receipt-sub">
                    {getRoundingLabel(
                      invoice.rounding_mode_snapshot,
                      invoice.rounding_minutes_snapshot,
                      invoice.min_minutes_snapshot
                    )}
                  </div>
                </div>
                <strong className="num">{formatVnd(invoice.table_fee)}</strong>
              </div>
            </div>

            <div className="receipt-section">
              <div className="receipt-section-title">2. Đồ uống &amp; Đồ ăn</div>
              {items.length === 0 ? (
                <div className="receipt-empty">Không gọi món</div>
              ) : (
                <table className="receipt-items-table">
                  <thead>
                    <tr>
                      <th>Món</th>
                      <th className="num">SL</th>
                      <th className="num">Đơn giá</th>
                      <th className="num">Thành tiền</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.id}>
                        <td>
                          {item.item_name} <span className="muted">({item.unit})</span>
                        </td>
                        <td className="num">{item.quantity}</td>
                        <td className="num">{formatVnd(item.unit_price)}</td>
                        <td className="num">{formatVnd(item.line_total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <div className="receipt-line" style={{ marginTop: '0.4rem' }}>
                <span>Cộng tiền món</span>
                <strong className="num">{formatVnd(invoice.items_fee)}</strong>
              </div>
            </div>

            <div className="receipt-totals">
              <div className="receipt-line">
                <span>Tạm tính</span>
                <span className="num">{formatVnd(invoice.table_fee + invoice.items_fee)}</span>
              </div>
              {invoice.discount_amount > 0 && (
                <div className="receipt-line">
                  <span>Giảm giá</span>
                  <span className="num">-{formatVnd(invoice.discount_amount)}</span>
                </div>
              )}
              <div className="receipt-line grand-total">
                <span>TỔNG THANH TOÁN</span>
                <span className="num">{formatVnd(invoice.total_amount)}</span>
              </div>
              {invoice.note && <div className="receipt-note">Ghi chú: {invoice.note}</div>}
            </div>

            <div className="receipt-footer">Cảm ơn quý khách &amp; Hẹn gặp lại!</div>
          </div>

          {/* Khu vực điều chỉnh dành cho Admin & Lịch sử điều chỉnh (không in) */}
          <div className="invoice-side no-print">
            {isAdmin && invoice.status !== 'voided' && (
              <div className="panel-box">
                <h4>Thao tác Admin trên hóa đơn</h4>
                <p className="muted-sm">
                  Hóa đơn đã thanh toán không được phép xóa. Mọi giảm giá, chỉnh sửa hoặc hủy giao dịch đều phải ghi rõ lý do.
                </p>
                <div className="row-actions wrap">
                  <button
                    type="button"
                    className={`btn btn-sm ${adjustMode === 'discount' ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => startAdjust('discount')}
                  >
                    Giảm giá
                  </button>
                  <button
                    type="button"
                    className={`btn btn-sm ${adjustMode === 'edit' ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => startAdjust('edit')}
                  >
                    Sửa giao dịch
                  </button>
                  <button
                    type="button"
                    className={`btn btn-sm ${adjustMode === 'void' ? 'btn-danger' : 'btn-outline-danger'}`}
                    onClick={() => startAdjust('void')}
                  >
                    Hủy hóa đơn
                  </button>
                </div>

                {adjustMode && (
                  <form onSubmit={handleSubmitAdjustment} className="form-stack" style={{ marginTop: '0.9rem' }}>
                    {error && <div className="alert alert-danger">{error}</div>}

                    {adjustMode === 'edit' && (
                      <>
                        <label className="field">
                          <span>Tiền giờ chơi (VNĐ)</span>
                          <input
                            type="number"
                            min={0}
                            step={1000}
                            value={tableFee}
                            onChange={(e) => setTableFee(e.target.value)}
                          />
                        </label>
                        <label className="field">
                          <span>Tiền đồ uống / đồ ăn (VNĐ)</span>
                          <input
                            type="number"
                            min={0}
                            step={1000}
                            value={itemsFee}
                            onChange={(e) => setItemsFee(e.target.value)}
                          />
                        </label>
                        <label className="field">
                          <span>Phương thức thanh toán</span>
                          <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                            <option value="cash">Tiền mặt</option>
                            <option value="transfer">Chuyển khoản</option>
                          </select>
                        </label>
                      </>
                    )}

                    {(adjustMode === 'discount' || adjustMode === 'edit') && (
                      <label className="field">
                        <span>Số tiền giảm giá (VNĐ)</span>
                        <input
                          type="number"
                          min={0}
                          step={1000}
                          value={discountAmount}
                          onChange={(e) => setDiscountAmount(e.target.value)}
                        />
                      </label>
                    )}

                    {adjustMode === 'void' && (
                      <div className="alert alert-warning">
                        Xác nhận hủy hóa đơn <strong>{invoice.invoice_code}</strong>? Tổng tiền hóa đơn sẽ chuyển về 0 ₫ và loại khỏi doanh thu.
                      </div>
                    )}

                    <label className="field">
                      <span>Lý do bắt buộc *</span>
                      <textarea
                        rows={2}
                        required
                        minLength={3}
                        placeholder="Ví dụ: Giảm giá khách quen / Nhập nhầm phương thức chuyển khoản..."
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                      />
                    </label>

                    <div className="row-actions">
                      <button
                        type="submit"
                        className={`btn btn-sm ${adjustMode === 'void' ? 'btn-danger' : 'btn-primary'}`}
                        disabled={saving}
                      >
                        {saving ? 'Đang lưu...' : 'Xác nhận lưu'}
                      </button>
                      <button type="button" className="btn btn-sm btn-ghost" onClick={() => setAdjustMode(null)}>
                        Hủy bỏ
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}

            <div className="panel-box">
              <h4>Lịch sử điều chỉnh ({adjustments.length})</h4>
              {adjustments.length === 0 ? (
                <p className="muted-sm">Chưa có điều chỉnh nào trên hóa đơn này.</p>
              ) : (
                <div className="audit-list">
                  {adjustments.map((adj) => (
                    <div key={adj.id} className="audit-item">
                      <div className="audit-head">
                        <span className="badge">
                          {adj.action_type === 'void'
                            ? 'Hủy hóa đơn'
                            : adj.action_type === 'discount'
                              ? 'Giảm giá'
                              : 'Sửa giao dịch'}
                        </span>
                        <span className="muted-xs">{formatDateTime(adj.adjusted_at)}</span>
                      </div>
                      <div className="audit-reason">
                        <strong>Lý do:</strong> {adj.reason}
                      </div>
                      <div className="muted-xs">
                        Thực hiện: {adj.adjusted_by_name} • Tổng: {formatVnd(adj.previous_total)} →{' '}
                        <strong>{formatVnd(adj.new_total)}</strong>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
