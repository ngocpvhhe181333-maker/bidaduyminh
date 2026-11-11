import { useEffect, useState } from 'react'
import { VietQR } from 'vietqr'
import { formatVnd } from '../utils/format'

const vietQr = new VietQR()
const BANK_BIN = '970407'
const ACCOUNT_NUMBER = '1999222299999'
const ACCOUNT_NAME = 'DONG DUY MINH'

export function TransferQr({ amount, memo, onReceipt = false, onGenerated }) {
  const [qrState, setQrState] = useState({ key: '', imageUrl: '', error: '' })
  const key = `${amount}|${memo}`
  const imageUrl = qrState.key === key ? qrState.imageUrl : ''
  const error = qrState.key === key ? qrState.error : ''

  useEffect(() => {
    let active = true
    if (!Number.isInteger(amount) || amount <= 0) return

    vietQr.genQRCodeBase64({
      bank: BANK_BIN,
      accountNumber: ACCOUNT_NUMBER,
      accountName: ACCOUNT_NAME,
      amount: String(amount),
      memo,
      media: 'png',
    }).then((response) => {
      if (!active) return
      const url = response.data?.data?.qrDataURL
      if (response.data?.code !== '00' || !url) throw new Error('Không tạo được mã QR.')
      setQrState({ key, imageUrl: url, error: '' })
      onGenerated?.()
    }).catch(() => {
      if (active) {
        setQrState({ key, imageUrl: '', error: 'Không tạo được mã QR. Vui lòng dùng thông tin tài khoản bên dưới.' })
        onGenerated?.()
      }
    })

    return () => { active = false }
  }, [amount, memo, key, onGenerated])

  if (amount <= 0) return <p className="muted-sm">Số tiền cần trả là 0 đ, không cần chuyển khoản.</p>

  return (
    <div className="transfer-qr">
      <strong>{onReceipt ? 'Mã QR của hóa đơn' : 'Quét mã chuyển khoản'}</strong>
      {imageUrl ? <img src={imageUrl} alt={`Mã QR Techcombank chuyển ${formatVnd(amount)}`} /> :
        <span className="muted-sm">{error || 'Đang tạo mã QR...'}</span>}
      <div className="transfer-qr-details">
        <span>Techcombank (TCB) · {ACCOUNT_NUMBER}</span>
        <strong>{ACCOUNT_NAME}</strong>
        <span>Số tiền: <strong>{formatVnd(amount)}</strong></span>
        <span>Nội dung: {memo}</span>
      </div>
      {onReceipt ? <p className="muted-xs">Hóa đơn đã ghi nhận thanh toán. Mã QR dùng để đối chiếu giao dịch.</p> :
        <p className="muted-xs">Kiểm tra tiền đã vào tài khoản trước khi xác nhận thanh toán.</p>}
    </div>
  )
}
