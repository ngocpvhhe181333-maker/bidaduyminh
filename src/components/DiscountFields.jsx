import { formatVnd } from '../utils/format'
import { calculateDiscount } from '../utils/discount'

export function DiscountFields({ subtotal, type, value, onTypeChange, onValueChange, disabled }) {
  const discount = calculateDiscount(subtotal, type, value)

  return (
    <div className="field">
      <span>Giảm giá cho khách</span>
      <div className="tab-pills">
        {[
          ['none', 'Không giảm'],
          ['percent', 'Theo %'],
          ['amount', 'Số tiền'],
        ].map(([option, label]) => (
          <button key={option} type="button" disabled={disabled}
            className={`tab-pill ${type === option ? 'active' : ''}`}
            onClick={() => { onTypeChange(option); onValueChange('') }}>
            {label}
          </button>
        ))}
      </div>
      {type !== 'none' && (
        <label className="field">
          <span>{type === 'percent' ? 'Phần trăm giảm (%)' : 'Số tiền giảm (đ)'}</span>
          <input type="number" min="0" max={type === 'percent' ? 100 : subtotal} step="1"
            value={value} disabled={disabled} placeholder={type === 'percent' ? 'Ví dụ: 10' : 'Ví dụ: 20000'}
            onChange={(event) => onValueChange(event.target.value)} />
        </label>
      )}
      {!discount.valid && <span className="text-danger">{type === 'percent' ? 'Phần trăm giảm phải từ 0 đến 100.' : `Số tiền giảm không được vượt ${formatVnd(subtotal)}.`}</span>}
    </div>
  )
}
