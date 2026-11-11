import { useState } from 'react'
import { api, isDemoMode } from '../services/api'
import { BilliardIcon } from './Icons'

export function LoginPage({ onAuthenticated }) {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setInfo('')
    setLoading(true)
    try {
      if (mode === 'login') {
        const res = await api.signIn({ email, password })
        onAuthenticated(res)
      } else {
        const res = await api.signUp({ email, password, fullName })
        if (res.needsEmailConfirmation) {
          setInfo('Đăng ký thành công! Vui lòng kiểm tra email để xác nhận trước khi đăng nhập.')
          setMode('login')
        } else if (res.pendingActivation) {
          setInfo('Đã tạo tài khoản. Vui lòng nhờ Admin kích hoạt tài khoản của bạn trong mục Quản trị.')
          setMode('login')
        } else {
          onAuthenticated(res)
        }
      }
    } catch (err) {
      setError(err.message || 'Đăng nhập thất bại.')
    } finally {
      setLoading(false)
    }
  }

  async function handleDemoQuickLogin(role) {
    setError('')
    setInfo('')
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
            <h1>Duy Minh Bi-a</h1>
            <p>Hệ thống quản lý 5 bàn, tính giờ &amp; thu ngân</p>
          </div>
        </div>

        {isDemoMode && (
          <div className="alert alert-warning">
            <strong>Chế độ dùng thử cục bộ (Demo):</strong> Chưa phát hiện cấu hình Supabase trong{' '}
            <code>.env.local</code>. Dữ liệu được lưu tạm trên trình duyệt để bạn trải nghiệm ngay toàn bộ chức năng.
          </div>
        )}

        <div className="tab-pills" style={{ marginBottom: '1rem' }}>
          <button
            type="button"
            className={`tab-pill ${mode === 'login' ? 'active' : ''}`}
            onClick={() => {
              setMode('login')
              setError('')
            }}
          >
            Đăng nhập
          </button>
          <button
            type="button"
            className={`tab-pill ${mode === 'signup' ? 'active' : ''}`}
            onClick={() => {
              setMode('signup')
              setError('')
            }}
          >
            Đăng ký tài khoản
          </button>
        </div>

        {error && <div className="alert alert-danger">{error}</div>}
        {info && <div className="alert alert-success">{info}</div>}

        <form onSubmit={handleSubmit} className="form-stack">
          {mode === 'signup' && (
            <label className="field">
              <span>Họ và tên</span>
              <input
                type="text"
                required
                minLength={2}
                placeholder="Ví dụ: Nguyễn Văn A"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </label>
          )}

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
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>

          <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
            {loading ? 'Đang xử lý...' : mode === 'login' ? 'Đăng nhập' : 'Tạo tài khoản'}
          </button>
        </form>

        {mode === 'signup' && (
          <p className="helper-note">
            * Tài khoản tự đăng ký mặc định là <strong>Thu ngân</strong> ở trạng thái chờ kích hoạt. Chủ quán tạo
            tài khoản rồi gán quyền <strong>Admin</strong> trong Supabase SQL Editor theo hướng dẫn ở README.
          </p>
        )}

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
