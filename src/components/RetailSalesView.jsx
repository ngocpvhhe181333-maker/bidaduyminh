import { useMemo, useState } from 'react'
import { api } from '../services/api'
import { calculateDiscount } from '../utils/discount'
import { formatVnd } from '../utils/format'
import { playPaymentSuccessSound } from '../utils/paymentSound'
import { createTransferReference, noteWithTransferReference, transferMemo } from '../utils/transferReference'
import { DiscountFields } from './DiscountFields'
import { PaymentPreview } from './PaymentPreview'

export function RetailSalesView({ menuItems, openShift, onOpenShiftModal, onInvoiceCreated, onRefresh }) {
  const [cart, setCart] = useState({})
  const [category, setCategory] = useState('Tất cả')
  const [search, setSearch] = useState('')
  const [mobilePane, setMobilePane] = useState('menu') // 'menu' | 'cart'
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [transferReference, setTransferReference] = useState(createTransferReference)
  const [discountType, setDiscountType] = useState('none')
  const [discountValue, setDiscountValue] = useState('')
  const [note, setNote] = useState('')
  const [showPaymentPreview, setShowPaymentPreview] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const visibleMenu = useMemo(() => {
    const query = search.trim().toLowerCase()
    return menuItems.filter(
      (item) =>
        item.is_active &&
        (category === 'Tất cả' || item.category === category) &&
        (!query || item.name.toLowerCase().includes(query))
    )
  }, [menuItems, category, search])

  const lines = useMemo(
    () => menuItems.filter((item) => cart[item.id] > 0).map((item) => ({ ...item, quantity: cart[item.id] })),
    [menuItems, cart]
  )
  const totalCount = lines.reduce((sum, item) => sum + item.quantity, 0)
  const total = lines.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const discount = calculateDiscount(total, discountType, discountValue)
  const amountDue = total - discount.amount

  function changeQuantity(id, delta) {
    setCart((current) => {
      const nextQuantity = Math.max(0, Math.min(99, (current[id] || 0) + delta))
      const next = { ...current }
      if (nextQuantity === 0) delete next[id]
      else next[id] = nextQuantity
      return next
    })
    setError('')
  }

  function handleConfirmBill(event) {
    event.preventDefault()
    if (!openShift || lines.length === 0 || busy || !discount.valid) return
    setShowPaymentPreview(true)
  }

  async function handleCheckout() {
    if (!showPaymentPreview || !openShift || lines.length === 0 || busy || !discount.valid) return
    setBusy(true)
    setError('')
    try {
      const invoice = await api.checkoutRetailSale({
        items: lines.map((item) => ({ menuItemId: item.id, quantity: item.quantity })),
        paymentMethod,
        note: paymentMethod === 'transfer' ? noteWithTransferReference(note, transferReference) : note,
        discountType,
        discountValue: discountType === 'none' ? 0 : Number(discountValue || 0),
      })
      playPaymentSuccessSound()
      setCart({})
      setNote('')
      setShowPaymentPreview(false)
      setMobilePane('menu')
      setTransferReference(createTransferReference())
      setDiscountType('none')
      setDiscountValue('')
      onInvoiceCreated(invoice)
      await onRefresh()
    } catch (err) {
      setError(err.message || 'Không thể thanh toán đơn bán lẻ.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page-stack">
      {!openShift && (
        <div className="alert alert-warning split-alert">
          <span>Cần mở ca làm việc trước khi bán đồ ăn/uống.</span>
          <button type="button" className="btn btn-primary btn-sm" onClick={onOpenShiftModal}>
            Mở ca ngay
          </button>
        </div>
      )}

      <div className="card">
        <h3>Bán đồ ăn / uống không dùng bàn</h3>
        <p className="muted-sm">
          Chọn món và thu tiền trực tiếp. Hóa đơn được ghi vào ca đang mở, không tính giờ chơi.
        </p>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {!showPaymentPreview && (
        <div className="mobile-pane-switch">
          <button
            type="button"
            className={`mobile-switch-btn ${mobilePane === 'menu' ? 'active' : ''}`}
            onClick={() => setMobilePane('menu')}
          >
            1. Thực đơn
          </button>
          <button
            type="button"
            className={`mobile-switch-btn ${mobilePane === 'cart' ? 'active' : ''}`}
            onClick={() => setMobilePane('cart')}
          >
            2. Giỏ &amp; Thu tiền ({totalCount}) • <span className="num">{formatVnd(amountDue)}</span>
          </button>
        </div>
      )}

      <div className={showPaymentPreview ? 'payment-preview-page' : 'session-order-layout'}>
        {!showPaymentPreview && (
          <div className={`panel-box ${mobilePane !== 'menu' ? 'mobile-hide-pane' : ''}`}>
            <h4>Thực đơn</h4>
            <div className="menu-filter-bar">
              <input
                type="search"
                placeholder="Tìm đồ ăn, thức uống..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <div className="chip-row scrollable-chips">
                {['Tất cả', 'Đồ uống', 'Đồ ăn', 'Khác'].map((name) => (
                  <button
                    key={name}
                    type="button"
                    className={`chip ${category === name ? 'active' : ''}`}
                    onClick={() => setCategory(name)}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>
            <div className="menu-picker-grid">
              {visibleMenu.length === 0 ? (
                <p className="muted-sm">Không có món phù hợp đang bán.</p>
              ) : (
                visibleMenu.map((item) => {
                  const qty = cart[item.id] || 0
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={`menu-pick-btn ${qty > 0 ? 'has-qty' : ''}`}
                      disabled={
                        busy ||
                        !openShift ||
                        qty >= 99 ||
                        (item.stock_quantity != null && qty >= item.stock_quantity)
                      }
                      onClick={() => changeQuantity(item.id, 1)}
                    >
                      <div className="menu-pick-top">
                        <span className="menu-pick-name">{item.name}</span>
                        {qty > 0 && <span className="qty-pill num">×{qty}</span>}
                      </div>
                      <span className="menu-pick-meta">
                        <strong className="num text-brass">{formatVnd(item.price)}</strong> / {item.unit}
                        {item.stock_quantity != null && ` • Còn ${item.stock_quantity}`}
                      </span>
                    </button>
                  )
                })
              )}
            </div>
          </div>
        )}

        {showPaymentPreview ? (
          <PaymentPreview
            items={lines.map((item) => ({
              id: item.id,
              name: item.name,
              quantity: item.quantity,
              total: item.price * item.quantity,
            }))}
            tableFee={0}
            itemsFee={total}
            discountAmount={discount.amount}
            amountDue={amountDue}
            paymentMethod={paymentMethod}
            memo={transferMemo(transferReference)}
            note={note}
            busy={busy}
            onBack={() => setShowPaymentPreview(false)}
            onConfirm={handleCheckout}
          />
        ) : (
          <form
            className={`panel-box form-stack ${mobilePane !== 'cart' ? 'mobile-hide-pane' : ''}`}
            onSubmit={handleConfirmBill}
          >
            <h4>Đơn bán lẻ</h4>
            {lines.length === 0 ? (
              <p className="muted-sm">Chưa chọn món.</p>
            ) : (
              <div className="ordered-list">
                {lines.map((item) => (
                  <div className="ordered-item" key={item.id}>
                    <div className="ordered-item-info">
                      <strong>{item.name}</strong>
                      <div className="muted-xs num">
                        {formatVnd(item.price)} / {item.unit}
                      </div>
                    </div>
                    <div className="qty-controls">
                      <button
                        type="button"
                        className="btn-qty"
                        disabled={busy}
                        onClick={() => changeQuantity(item.id, -1)}
                        aria-label={`Giảm ${item.name}`}
                      >
                        −
                      </button>
                      <span className="num qty-num">{item.quantity}</span>
                      <button
                        type="button"
                        className="btn-qty"
                        disabled={
                          busy ||
                          item.quantity >= 99 ||
                          (item.stock_quantity != null && item.quantity >= item.stock_quantity)
                        }
                        onClick={() => changeQuantity(item.id, 1)}
                        aria-label={`Tăng ${item.name}`}
                      >
                        +
                      </button>
                      <strong className="num line-total">{formatVnd(item.price * item.quantity)}</strong>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="summary-divider">
              <div className="live-row">
                <span>Tạm tính</span>
                <strong className="num">{formatVnd(total)}</strong>
              </div>
              {discount.amount > 0 && (
                <div className="live-row">
                  <span>Giảm giá</span>
                  <strong className="num text-danger">−{formatVnd(discount.amount)}</strong>
                </div>
              )}
              <div className="live-row live-total">
                <span>Khách thanh toán</span>
                <strong className="num text-brass">{formatVnd(amountDue)}</strong>
              </div>
            </div>

            <DiscountFields
              subtotal={total}
              type={discountType}
              value={discountValue}
              onTypeChange={setDiscountType}
              onValueChange={setDiscountValue}
              disabled={busy}
            />

            <div className="field">
              <span>Phương thức thanh toán</span>
              <div className="payment-methods">
                <button
                  type="button"
                  className={`pay-choice ${paymentMethod === 'cash' ? 'active' : ''}`}
                  disabled={busy}
                  onClick={() => setPaymentMethod('cash')}
                >
                  <strong>Tiền mặt</strong>
                  <span>Cộng vào tiền két</span>
                </button>
                <button
                  type="button"
                  className={`pay-choice ${paymentMethod === 'transfer' ? 'active' : ''}`}
                  disabled={busy}
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
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Ví dụ: Mang về"
              />
            </label>
            <button
              type="submit"
              className="btn btn-primary btn-lg btn-block"
              disabled={busy || !openShift || lines.length === 0 || !discount.valid}
            >
              {paymentMethod === 'transfer' ? 'Xác nhận hóa đơn → Xem QR & in' : 'Xác nhận hóa đơn → In'}
            </button>
          </form>
        )}
      </div>

      {/* Thanh nổi nhanh trên điện thoại khi đang ở tab Thực đơn và đã có món trong giỏ */}
      {!showPaymentPreview && mobilePane === 'menu' && lines.length > 0 && (
        <div className="mobile-floating-bar">
          <div>
            <div className="muted-xs">{totalCount} món đã chọn</div>
            <strong className="num text-brass">{formatVnd(amountDue)}</strong>
          </div>
          <button type="button" className="btn btn-primary" onClick={() => setMobilePane('cart')}>
            Xem đơn &amp; Thu tiền →
          </button>
        </div>
      )}
    </div>
  )
}
