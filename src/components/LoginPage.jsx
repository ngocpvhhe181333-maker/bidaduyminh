import { useState } from 'react'
import { shop } from '../config/shop'
import { api, isDemoMode } from '../services/api'
import { BilliardIcon } from './Icons'

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
      <div className="login-felt-backdrop" aria-hidden="true">
        <div className="rack-balls">
          <span className="pool-ball ball-1">1</span>
          <span className="pool-ball ball-9">9</span>
          <span className="pool-ball ball-8">8</span>
        </div>
      </div>

      <div className="login-card">
        <div className="login-brand">
          <div className="brand-badge">
            <BilliardIcon size={28} />
          </div>
          <div>
            <div className="login-eyebrow">BILLIARDS CLUB POS</div>
            <h1>{shop.name}</h1>
            <p>{shop.address}</p>
          </div>
        </div>

        {isDemoMode && (
          <div className="alert alert-warning">
            <strong>Chế độ dùng thử (Demo):</strong> Bản build chưa nhận được URL và publishable key của
            Supabase. Dữ liệu Demo chỉ lưu trong trình duyệt.
          </div>
        )}

        {error && <div className="alert alert-danger">{error}</div>}

        <form onSubmit={handleSubmit} className="form-stack">
          <label className="field">
            <span>Email nhân sự</span>
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

          <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={loading}>
            {loading ? 'Đang vào ca...' : 'Đăng nhập hệ thống'}
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
                className="btn btn-brass"
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
