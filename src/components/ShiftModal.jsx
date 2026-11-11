import { useState } from 'react'
import { api } from '../services/api'
import { formatVnd } from '../utils/format'

export function ShiftModal({ mode, openShift, openShiftSummary, onClose, onCompleted }) {
  const expectedCash = openShift
    ? openShift.opening_cash + (openShiftSummary?.cash_revenue || 0)
    : 0

  const [openingCash, setOpeningCash] = useState('500000')
  const [actualCash, setActualCash] = useState(() => String(expectedCash))
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      if (mode === 'open') {
        await api.openShift({
          openingCash: Number(openingCash) || 0,
          notes,
        })
      } else if (openShift) {
        await api.closeShift({
          shiftId: openShift.id,
          actualCash: Number(actualCash) || 0,
          notes,
        })
      }
      await onCompleted?.()
      onClose()
    } catch (err) {
      setError(err.message || 'Thao tác ca làm thất bại.')
    } finally {
      setBusy(false)
    }
  }

  const previewDiff = actualCash === '' ? 0 : (Number(actualCash) || 0) - expectedCash

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={mode === 'open' ? 'Mở ca làm việc' : 'Chốt ca làm việc'}
    >
      <div className="modal-card modal-sm">
        <div className="modal-sheet-handle" aria-hidden="true" />
        <div className="modal-header">
          <h3>{mode === 'open' ? 'Mở ca làm việc' : 'Chốt ca & Đối soát tiền mặt'}</h3>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            Đóng
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body form-stack">
          {error && <div className="alert alert-danger">{error}</div>}

          {mode === 'open' ? (
            <>
              <label className="field">
                <span>Tiền mặt đầu ca trong két (VNĐ)</span>
                <input
                  type="number"
                  min={0}
                  step={1000}
                  required
                  value={openingCash}
                  onChange={(e) => setOpeningCash(e.target.value)}
                />
              </label>
              <label className="field">
                <span>Ghi chú mở ca</span>
                <input
                  type="text"
                  placeholder="Ví dụ: Ca sáng / Ca tối..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </label>
            </>
          ) : (
            <>
              <div className="info-box">
                <div className="live-row">
                  <span>Tiền mặt đầu ca</span>
                  <strong className="num">{formatVnd(openShift?.opening_cash || 0)}</strong>
                </div>
                <div className="live-row">
                  <span>Doanh thu tiền mặt</span>
                  <strong className="num">{formatVnd(openShiftSummary?.cash_revenue || 0)}</strong>
                </div>
                <div className="live-row">
                  <span>Doanh thu chuyển khoản</span>
                  <strong className="num">{formatVnd(openShiftSummary?.transfer_revenue || 0)}</strong>
                </div>
                <div className="live-row live-total">
                  <span>Tiền mặt lý thuyết cuối ca</span>
                  <strong className="num">{formatVnd(expectedCash)}</strong>
                </div>
              </div>

              <label className="field">
                <span>Tiền mặt thực đếm cuối ca (VNĐ)</span>
                <input
                  type="number"
                  min={0}
                  step={1000}
                  required
                  value={actualCash}
                  onChange={(e) => setActualCash(e.target.value)}
                />
              </label>

              <div className="live-row info-box-inline">
                <span>Chênh lệch cuối ca</span>
                <strong
                  className={`num ${
                    previewDiff === 0 ? 'text-green' : previewDiff > 0 ? 'text-brass' : 'text-danger'
                  }`}
                >
                  {previewDiff > 0 ? `+${formatVnd(previewDiff)}` : formatVnd(previewDiff)}
                </strong>
              </div>

              <label className="field">
                <span>Ghi chú chốt ca (giải trình nếu lệch)</span>
                <textarea
                  rows={2}
                  placeholder="Ghi chú bàn giao ca..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </label>
            </>
          )}

          <div className="modal-footer-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Hủy
            </button>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy
                ? 'Đang xử lý...'
                : mode === 'open'
                  ? 'Xác nhận mở ca'
                  : 'Xác nhận chốt ca'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
