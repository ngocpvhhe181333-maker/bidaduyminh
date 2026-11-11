import { useState } from 'react'
import { api, isDemoMode } from '../services/api'
import { BilliardIcon } from './Icons'
import { shop } from '../config/shop'

export function LoginPage({ onAuthenticated }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await api.signIn({ email, password })
      onAuthenticated(res)
    } catch (err) {
      setError(err.message || 'Đăng nhập thất bại.')
    } finally {
      setLoading(false)
    }
  }

  async function handleDemoQuickLogin(role) {
    setError('')
    setLoading(true)
    try {
      const res = await api.quickDemoLogin(role)
      onAuthenticated(res)
    } catch (err) {
      setError(err.message || 'Không thể đăng nhập Demo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <div className="brand-badge">
            <BilliardIcon size={26} />
          </div>
          <div>
            <h1>{shop.name}</h1>
            <p>Hệ thống quản lý 5 bàn, tính giờ &amp; thu ngân</p>
          </div>
        </div>

        {isDemoMode && (
          <div className="alert alert-warning">
            <strong>Chế độ dùng thử (Demo):</strong> Bản build chưa nhận được URL và publishable key của
            Supabase. Khi chạy trên máy, kiểm tra <code>.env.local</code>; trên Vercel, kiểm tra Environment
            Variables rồi triển khai lại. Dữ liệu Demo chỉ lưu trong trình duyệt.
          </div>
        )}

        {error && <div className="alert alert-danger">{error}</div>}

        <form onSubmit={handleSubmit} className="form-stack">
          <label className="field">
            <span>Email</span>
            <input
              type="email"
              required
              autoComplete="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>

          <label className="field">
            <span>Mật khẩu</span>
            <input
              type="password"
              required
              minLength={6}
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>

          <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
            {loading ? 'Đang xử lý...' : 'Đăng nhập'}
          </button>
        </form>

        {isDemoMode && (
          <div className="demo-quick-box">
            <div className="demo-quick-title">Đăng nhập nhanh chế độ Demo</div>
            <div className="demo-quick-actions">
              <button
                type="button"
                className="btn btn-outline"
                disabled={loading}
                onClick={() => handleDemoQuickLogin('cashier')}
              >
                Vào vai Thu ngân
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={loading}
                onClick={() => handleDemoQuickLogin('admin')}
              >
                Vào vai Admin
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
