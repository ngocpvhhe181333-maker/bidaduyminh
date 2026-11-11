import { useCallback, useEffect, useRef, useState } from 'react'
import { formatDateTime, formatMinutesReadable, formatVnd } from '../utils/format'
import { TransferQr } from './TransferQr'
import { PrintIcon } from './Icons'
import { shop } from '../config/shop'

export function PaymentPreview({ tableName, startedAt, endedAt, billedMinutes, tableFee, items, itemsFee, discountAmount, amountDue, paymentMethod, memo, note, busy, onBack, onConfirm }) {
  const [readyKey, setReadyKey] = useState('')
  const receiptRef = useRef(null)
  const printElementsRef = useRef([])
  const qrKey = `${amountDue}|${memo}`
  const needsQr = paymentMethod === 'transfer' && amountDue > 0
  const onQrGenerated = useCallback(() => setReadyKey(qrKey), [qrKey])

  const cleanupPrint = useCallback(() => {
    document.body.classList.remove('printing-payment-preview')
    for (const element of printElementsRef.current) {
      element.classList.remove('print-path', 'print-content')
    }
    printElementsRef.current = []
  }, [])

  useEffect(() => cleanupPrint, [cleanupPrint])

  function printInvoice() {
    const receipt = receiptRef.current
    if (!receipt) return
    cleanupPrint()
    const elements = []
    for (let parent = receipt.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
      parent.classList.add('print-path')
      elements.push(parent)
    }
    for (const element of [receipt, ...receipt.querySelectorAll('*')]) {
      element.classList.add('print-content')
      elements.push(element)
    }
    printElementsRef.current = elements
    document.body.classList.add('printing-payment-preview')
    window.addEventListener('afterprint', cleanupPrint, { once: true })
    window.print()
  }

  return (
    <div className="payment-preview">
      <div className="payment-preview-actions no-print">
        <button type="button" className="btn btn-ghost" disabled={busy} onClick={onBack}>← Sửa hóa đơn</button>
        <button type="button" className="btn btn-outline" disabled={busy || (needsQr && readyKey !== qrKey)} onClick={printInvoice}>
          <PrintIcon size={16} /> {needsQr && readyKey !== qrKey ? 'Đang tạo QR...' : needsQr ? 'In hóa đơn có QR' : 'In hóa đơn'}
        </button>
      </div>

      <div ref={receiptRef} className="receipt-sheet payment-preview-print">
        <div className="receipt-header">
          <h2>{shop.name}</h2>
          <div className="receipt-shop-address">{shop.address}</div>
          <div className="receipt-shop-hotline">Hotline: {shop.hotline}</div>
          <p>HÓA ĐƠN CHỜ THANH TOÁN</p>
          {needsQr && <div className="receipt-code">Tham chiếu: {memo}</div>}
        </div>

        <div className="receipt-meta">
          <div><span>Loại đơn:</span><strong>{tableName || 'Bán lẻ'}</strong></div>
          {startedAt && <div><span>Giờ vào:</span><span>{formatDateTime(startedAt)}</span></div>}
          {endedAt && <div><span>Giờ kết thúc:</span><span>{formatDateTime(endedAt)}</span></div>}
          {billedMinutes != null && <div><span>Thời gian tính tiền:</span><span>{formatMinutesReadable(billedMinutes)}</span></div>}
          <div><span>Phương thức:</span><strong>{paymentMethod === 'transfer' ? 'Chuyển khoản' : 'Tiền mặt'}</strong></div>
        </div>

        {tableFee > 0 && <div className="receipt-section">
          <div className="receipt-section-title">Tiền giờ chơi</div>
          <div className="receipt-line"><span>{tableName}</span><strong className="num">{formatVnd(tableFee)}</strong></div>
        </div>}

        <div className="receipt-section">
          <div className="receipt-section-title">Đồ uống &amp; đồ ăn</div>
          {items.length === 0 ? <div className="receipt-empty">Không gọi món</div> : items.map((item, index) =>
            <div className="receipt-line" key={item.id || index}>
              <span>{item.name} × {item.quantity}</span>
              <span className="num">{formatVnd(item.total)}</span>
            </div>)}
          <div className="receipt-line"><span>Cộng tiền món</span><strong className="num">{formatVnd(itemsFee)}</strong></div>
        </div>

        <div className="receipt-totals">
          <div className="receipt-line"><span>Tạm tính</span><span className="num">{formatVnd(tableFee + itemsFee)}</span></div>
          {discountAmount > 0 && <div className="receipt-line"><span>Giảm giá</span><span className="num">−{formatVnd(discountAmount)}</span></div>}
          <div className="receipt-line grand-total"><span>KHÁCH THANH TOÁN</span><span className="num">{formatVnd(amountDue)}</span></div>
          {note && <div className="receipt-note">Ghi chú: {note}</div>}
        </div>

        {needsQr && <TransferQr amount={amountDue} memo={memo} compact onGenerated={onQrGenerated} />}
        <div className="receipt-footer">{shop.thanks}</div>
      </div>

      <div className="payment-preview-actions no-print">
        <button type="button" className="btn btn-primary btn-lg" disabled={busy} onClick={onConfirm}>
          {busy ? 'Đang lưu thanh toán...' : paymentMethod === 'transfer'
            ? `Đã nhận chuyển khoản ${formatVnd(amountDue)}`
            : `Đã thu tiền mặt ${formatVnd(amountDue)}`}
        </button>
      </div>
    </div>
  )
}
