import { isDemoMode } from '../services/api'
import { formatVnd } from '../utils/format'
import { BilliardIcon, ChartIcon, ClockIcon, LogOutIcon, ReceiptIcon, SettingsIcon } from './Icons'

export function HeaderBar({
  profile,
  activeTab,
  onChangeTab,
  openShift,
  onOpenShiftClick,
  onSignOut,
}) {
  const isAdmin = profile?.role === 'admin'

  const tabs = [
    { id: 'tables', label: 'Bàn chơi (5)', icon: <BilliardIcon size={17} /> },
    { id: 'shifts', label: 'Ca & Hóa đơn', icon: <ReceiptIcon size={17} /> },
  ]

  if (isAdmin) {
    tabs.push({ id: 'reports', label: 'Báo cáo', icon: <ChartIcon size={17} /> })
    tabs.push({ id: 'admin', label: 'Quản trị', icon: <SettingsIcon size={17} /> })
  }

  return (
    <header className="topbar no-print">
      <div className="topbar-inner">
        <div className="topbar-left">
          <div className="topbar-brand">
            <span className="brand-dot">
              <BilliardIcon size={20} />
            </span>
            <div>
              <div className="brand-name">Duy Minh Bi-a</div>
              <div className="brand-sub">
                {isDemoMode ? 'Chế độ Demo cục bộ' : 'Supabase Live'}
              </div>
            </div>
          </div>

          <nav className="nav-tabs" aria-label="Điều hướng chính">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`nav-tab ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => onChangeTab(tab.id)}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>

        <div className="topbar-right">
          <button
            type="button"
            className={`shift-pill ${openShift ? 'open' : 'closed'}`}
            onClick={onOpenShiftClick}
            title={openShift ? 'Xem hoặc chốt ca đang mở' : 'Mở ca làm việc mới'}
          >
            <ClockIcon size={15} />
            {openShift ? (
              <span>
                Ca đang mở • Đầu ca {formatVnd(openShift.opening_cash)}
              </span>
            ) : (
              <span>Chưa mở ca — Mở ca ngay</span>
            )}
          </button>

          <div className="user-pill">
            <div className="user-meta">
              <strong>{profile?.full_name}</strong>
              <span className={`role-badge ${isAdmin ? 'admin' : 'cashier'}`}>
                {isAdmin ? 'Admin' : 'Thu ngân'}
              </span>
            </div>
            <button
              type="button"
              className="btn-icon"
              onClick={onSignOut}
              title="Đăng xuất"
              aria-label="Đăng xuất"
            >
              <LogOutIcon size={17} />
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}
