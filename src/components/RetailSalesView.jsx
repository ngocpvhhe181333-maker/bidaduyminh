import { useMemo, useState } from 'react'
import { api } from '../services/api'
import { formatVnd } from '../utils/format'
import { playPaymentSuccessSound } from '../utils/paymentSound'

export function RetailSalesView({ menuItems, openShift, onOpenShiftModal, onInvoiceCreated, onRefresh }) {
  const [cart, setCart] = useState({})
  const [category, setCategory] = useState('Tất cả')
  const [search, setSearch] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const visibleMenu = useMemo(() => {
    const query = search.trim().toLowerCase()
    return menuItems.filter((item) => item.is_active &&
      (category === 'Tất cả' || item.category === category) &&
      (!query || item.name.toLowerCase().includes(query)))
  }, [menuItems, category, search])

  const lines = useMemo(() => menuItems
    .filter((item) => cart[item.id] > 0)
    .map((item) => ({ ...item, quantity: cart[item.id] })), [menuItems, cart])
  const total = lines.reduce((sum, item) => sum + item.price * item.quantity, 0)

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

  async function handleCheckout(event) {
    event.preventDefault()
    if (!openShift || lines.length === 0 || busy) return
    setBusy(true)
    setError('')
    try {
      const invoice = await api.checkoutRetailSale({
        items: lines.map((item) => ({ menuItemId: item.id, quantity: item.quantity })),
        paymentMethod,
        note,
      })
      playPaymentSuccessSound()
      setCart({})
      setNote('')
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
          <button type="button" className="btn btn-primary btn-sm" onClick={onOpenShiftModal}>Mở ca ngay</button>
        </div>
      )}

      <div className="card">
        <h2>Bán đồ ăn/uống không dùng bàn</h2>
        <p className="muted-sm">Chọn món và thu tiền trực tiếp. Hóa đơn được ghi vào ca đang mở, không tính giờ chơi.</p>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      <div className="session-order-layout">
        <div className="panel-box">
          <h4>Thực đơn</h4>
          <div className="menu-filter-bar">
            <input type="search" placeholder="Tìm đồ ăn, thức uống..." value={search}
              onChange={(event) => setSearch(event.target.value)} />
            <div className="chip-row">
              {['Tất cả', 'Đồ uống', 'Đồ ăn', 'Khác'].map((name) => (
                <button key={name} type="button" className={`chip ${category === name ? 'active' : ''}`}
                  onClick={() => setCategory(name)}>{name}</button>
              ))}
            </div>
          </div>
          <div className="menu-picker-grid">
            {visibleMenu.length === 0 ? <p className="muted-sm">Không có món phù hợp đang bán.</p> : visibleMenu.map((item) => (
              <button key={item.id} type="button" className="menu-pick-btn" disabled={busy || !openShift || cart[item.id] >= 99 || (item.stock_quantity != null && (cart[item.id] || 0) >= item.stock_quantity)}
                onClick={() => changeQuantity(item.id, 1)}>
                <span className="menu-pick-name">{item.name}</span>
                <span className="menu-pick-meta"><strong className="num">{formatVnd(item.price)}</strong> / {item.unit}{item.stock_quantity != null && ` • Còn ${item.stock_quantity}`}</span>
              </button>
            ))}
          </div>
        </div>

        <form className="panel-box form-stack" onSubmit={handleCheckout}>
          <h4>Đơn bán lẻ</h4>
          {lines.length === 0 ? <p className="muted-sm">Chưa chọn món.</p> : (
            <div className="ordered-list">
              {lines.map((item) => (
                <div className="ordered-item" key={item.id}>
                  <div>
                    <strong>{item.name}</strong>
                    <div className="muted-xs num">{formatVnd(item.price)} / {item.unit}</div>
                  </div>
                  <div className="qty-controls">
                    <button type="button" className="btn-qty" disabled={busy} onClick={() => changeQuantity(item.id, -1)} aria-label={`Giảm ${item.name}`}>−</button>
                    <span className="num qty-num">{item.quantity}</span>
                    <button type="button" className="btn-qty" disabled={busy || item.quantity >= 99 || (item.stock_quantity != null && item.quantity >= item.stock_quantity)} onClick={() => changeQuantity(item.id, 1)} aria-label={`Tăng ${item.name}`}>+</button>
                    <strong className="num line-total">{formatVnd(item.price * item.quantity)}</strong>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="summary-divider">
            <div className="live-row live-total"><span>Tổng thanh toán</span><strong className="num">{formatVnd(total)}</strong></div>
          </div>

          <div className="field">
            <span>Phương thức thanh toán</span>
            <div className="payment-methods">
              <button type="button" className={`pay-choice ${paymentMethod === 'cash' ? 'active' : ''}`}
                disabled={busy} onClick={() => setPaymentMethod('cash')}><strong>Tiền mặt</strong><span>Cộng vào tiền két</span></button>
              <button type="button" className={`pay-choice ${paymentMethod === 'transfer' ? 'active' : ''}`}
                disabled={busy} onClick={() => setPaymentMethod('transfer')}><strong>Chuyển khoản</strong><span>QR / Ngân hàng</span></button>
            </div>
          </div>

          <label className="field">
            <span>Ghi chú hóa đơn (tùy chọn)</span>
            <input type="text" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Ví dụ: Mang về" />
          </label>
          <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={busy || !openShift || lines.length === 0}>
            {busy ? 'Đang thanh toán...' : `Xác nhận thu ${formatVnd(total)}`}
          </button>
        </form>
      </div>
    </div>
  )
}
