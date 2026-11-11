import { shop } from '../config/shop'
import { isDemoMode } from '../services/api'
import { formatVnd } from '../utils/format'
import {
  BilliardIcon,
  ChartIcon,
  ClockIcon,
  CoffeeIcon,
  LogOutIcon,
  PoolTableIcon,
  ReceiptIcon,
  SettingsIcon,
} from './Icons'

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
    { id: 'tables', label: 'Bàn chơi (5)', shortLabel: '5 Bàn', icon: <PoolTableIcon size={18} /> },
    { id: 'retail', label: 'Bán lẻ', shortLabel: 'Bán lẻ', icon: <CoffeeIcon size={18} /> },
    { id: 'shifts', label: 'Ca & Hóa đơn', shortLabel: 'Ca & HĐ', icon: <ReceiptIcon size={18} /> },
  ]

  if (isAdmin) {
    tabs.push({ id: 'reports', label: 'Báo cáo', shortLabel: 'Báo cáo', icon: <ChartIcon size={18} /> })
    tabs.push({ id: 'admin', label: 'Quản trị', shortLabel: 'Quản trị', icon: <SettingsIcon size={18} /> })
  }

  return (
    <>
      <header className="topbar no-print">
        <div className="topbar-inner">
          <div className="topbar-left">
            <div className="topbar-brand">
              <span className="brand-dot" aria-hidden="true">
                <BilliardIcon size={20} />
              </span>
              <div className="brand-text">
                <div className="brand-name">{shop.name}</div>
                <div className="brand-sub">
                  {isDemoMode ? 'Chế độ Demo' : 'Club POS • Trực tuyến'}
                </div>
              </div>
            </div>

            <nav className="nav-tabs desktop-nav" aria-label="Điều hướng chính">
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
              <ClockIcon size={14} />
              {openShift ? (
                <>
                  <span className="hide-mobile">
                    Ca mở • Đầu ca <span className="num">{formatVnd(openShift.opening_cash)}</span>
                  </span>
                  <span className="show-mobile-inline">Ca mở</span>
                </>
              ) : (
                <>
                  <span className="hide-mobile">Chưa mở ca — Mở ca</span>
                  <span className="show-mobile-inline">Mở ca</span>
                </>
              )}
            </button>

            <div className="user-pill">
              <div className="user-meta">
                <strong className="user-name-truncate">{profile?.full_name}</strong>
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
                <LogOutIcon size={16} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Thanh điều hướng dưới cùng dành cho điện thoại */}
      <nav className="mobile-bottom-nav no-print" aria-label="Điều hướng di động">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`mobile-nav-item ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => onChangeTab(tab.id)}
          >
            <span className="mobile-nav-icon">{tab.icon}</span>
            <span className="mobile-nav-label">{tab.shortLabel}</span>
          </button>
        ))}
      </nav>
    </>
  )
}
