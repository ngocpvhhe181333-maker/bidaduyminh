import { useCallback, useEffect, useState } from 'react'
import { api, isDemoMode } from '../services/api'
import { formatDateTime, formatVnd, getRoundingLabel } from '../utils/format'
import { getEffectiveTablePricing } from '../utils/pricing'

export function AdminView({ currentProfile, tableTypes, tables, menuItems, onRefresh }) {
  const [subTab, setSubTab] = useState('tables') // 'tables' | 'pricing' | 'menu' | 'accounts'
  const [profiles, setProfiles] = useState([])
  const [profilesLoadedKey, setProfilesLoadedKey] = useState(0)
  const [profilesFetchTrigger, setProfilesFetchTrigger] = useState(1)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [busy, setBusy] = useState(false)

  // Form Loại bàn
  const [typeModal, setTypeModal] = useState(null)
  // Form Sửa bàn
  const [tableModal, setTableModal] = useState(null)
  // Form Món
  const [menuModal, setMenuModal] = useState(null)
  // Form Sửa tài khoản
  const [profileModal, setProfileModal] = useState(null)
  // Form Tạo tài khoản mới
  const [newUserModal, setNewUserModal] = useState(null)

  const tableTypesMap = Object.fromEntries(tableTypes.map((tt) => [tt.id, tt]))
  const loadingProfiles = subTab === 'accounts' && profilesLoadedKey !== profilesFetchTrigger

  const reloadProfiles = useCallback(async () => {
    try {
      const data = await api.fetchProfiles()
      setProfiles(data)
    } catch (err) {
      setError(err.message || 'Không thể tải danh sách tài khoản.')
    }
  }, [])

  useEffect(() => {
    if (subTab !== 'accounts') return
    let active = true

    async function fetchAccounts() {
      try {
        const data = await api.fetchProfiles()
        if (!active) return
        setProfiles(data)
        setProfilesLoadedKey(profilesFetchTrigger)
      } catch (err) {
        if (!active) return
        setError(err.message || 'Không thể tải danh sách tài khoản.')
        setProfilesLoadedKey(profilesFetchTrigger)
      }
    }

    fetchAccounts()
    return () => {
      active = false
    }
  }, [subTab, profilesFetchTrigger])

  function clearMessages() {
    setError('')
    setSuccess('')
  }

  async function handleSaveTableType(e) {
    e.preventDefault()
    setBusy(true)
    clearMessages()
    try {
      await api.saveTableType(typeModal)
      setTypeModal(null)
      setSuccess('Đã lưu cấu hình loại bàn & bảng giá.')
      await onRefresh()
    } catch (err) {
      setError(err.message || 'Không thể lưu loại bàn.')
    } finally {
      setBusy(false)
    }
  }

  async function handleDeleteTableType(id) {
    if (!window.confirm('Xóa loại bàn này?')) return
    setBusy(true)
    clearMessages()
    try {
      await api.deleteTableType(id)
      setSuccess('Đã xóa loại bàn.')
      await onRefresh()
    } catch (err) {
      setError(err.message || 'Không thể xóa loại bàn (có thể đang được gán cho bàn).')
    } finally {
      setBusy(false)
    }
  }

  async function handleSaveTable(e) {
    e.preventDefault()
    setBusy(true)
    clearMessages()
    try {
      await api.saveTable(tableModal)
      setTableModal(null)
      setSuccess('Đã cập nhật thông tin bàn.')
      await onRefresh()
    } catch (err) {
      setError(err.message || 'Không thể lưu bàn.')
    } finally {
      setBusy(false)
    }
  }

  async function handleToggleMaintenance(table) {
    if (table.status === 'playing') return
    setBusy(true)
    clearMessages()
    try {
      await api.saveTable({
        ...table,
        status: table.status === 'maintenance' ? 'available' : 'maintenance',
      })
      setSuccess(
        table.status === 'maintenance'
          ? `Đã đưa ${table.name} hoạt động trở lại.`
          : `Đã chuyển ${table.name} sang trạng thái Bảo trì.`
      )
      await onRefresh()
    } catch (err) {
      setError(err.message || 'Không thể đổi trạng thái bàn.')
    } finally {
      setBusy(false)
    }
  }

  async function handleSaveMenuItem(e) {
    e.preventDefault()
    setBusy(true)
    clearMessages()
    try {
      await api.saveMenuItem(menuModal)
      setMenuModal(null)
      setSuccess('Đã lưu món vào thực đơn.')
      await onRefresh()
    } catch (err) {
      setError(err.message || 'Không thể lưu món.')
    } finally {
      setBusy(false)
    }
  }

  async function handleToggleMenuActive(item) {
    setBusy(true)
    clearMessages()
    try {
      await api.saveMenuItem({ ...item, is_active: !item.is_active })
      await onRefresh()
    } catch (err) {
      setError(err.message || 'Không thể đổi trạng thái món.')
    } finally {
      setBusy(false)
    }
  }

  async function handleDeleteMenuItem(item) {
    if (!window.confirm(`Xóa món "${item.name}"? (Nếu món đã từng bán, nên chọn "Ngừng bán" thay vì xóa.)`)) return
    setBusy(true)
    clearMessages()
    try {
      await api.deleteMenuItem(item.id)
      setSuccess('Đã xóa món.')
      await onRefresh()
    } catch (err) {
      setError(err.message || 'Không thể xóa món này. Bạn có thể chuyển sang Ngừng bán.')
    } finally {
      setBusy(false)
    }
  }

  async function handleUpdateProfile(e) {
    e.preventDefault()
    setBusy(true)
    clearMessages()
    try {
      await api.updateProfile({
        profileId: profileModal.id,
        fullName: profileModal.full_name,
        role: profileModal.role,
        isActive: profileModal.is_active,
      })
      setProfileModal(null)
      setSuccess('Đã cập nhật thông tin tài khoản.')
      await reloadProfiles()
    } catch (err) {
      setError(err.message || 'Không thể cập nhật tài khoản.')
    } finally {
      setBusy(false)
    }
  }

  async function handleCreateUser(e) {
    e.preventDefault()
    setBusy(true)
    clearMessages()
    try {
      await api.createStaffUser(newUserModal)
      setNewUserModal(null)
      setSuccess('Đã tạo tài khoản nhân sự mới.')
      await reloadProfiles()
    } catch (err) {
      setError(err.message || 'Không thể tạo tài khoản mới.')
    } finally {
      setBusy(false)
    }
  }

  async function handleResetDemo() {
    if (!window.confirm('Đặt lại toàn bộ dữ liệu Demo về trạng thái ban đầu?')) return
    api.resetDemoData?.()
    await onRefresh()
    if (subTab === 'accounts') await reloadProfiles()
    setSuccess('Đã khôi phục dữ liệu Demo mặc định.')
  }

  return (
    <div className="page-stack">
      <div className="admin-topbar">
        <div className="tab-pills">
          <button
            type="button"
            className={`tab-pill ${subTab === 'tables' ? 'active' : ''}`}
            onClick={() => {
              setSubTab('tables')
              clearMessages()
            }}
          >
            Quản lý 5 Bàn
          </button>
          <button
            type="button"
            className={`tab-pill ${subTab === 'pricing' ? 'active' : ''}`}
            onClick={() => {
              setSubTab('pricing')
              clearMessages()
            }}
          >
            Loại bàn &amp; Bảng giá
          </button>
          <button
            type="button"
            className={`tab-pill ${subTab === 'menu' ? 'active' : ''}`}
            onClick={() => {
              setSubTab('menu')
              clearMessages()
            }}
          >
            Thực đơn ({menuItems.length})
          </button>
          <button
            type="button"
            className={`tab-pill ${subTab === 'accounts' ? 'active' : ''}`}
            onClick={() => {
              setSubTab('accounts')
              setProfilesFetchTrigger((v) => v + 1)
              clearMessages()
            }}
          >
            Tài khoản
          </button>
        </div>

        {isDemoMode && (
          <button type="button" className="btn btn-sm btn-outline" onClick={handleResetDemo}>
            Khôi phục dữ liệu Demo
          </button>
        )}
      </div>

      {error && <div className="alert alert-danger">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {/* 1. QUẢN LÝ 5 BÀN */}
      {subTab === 'tables' && (
        <div className="card">
          <div className="section-head">
            <div>
              <h3>Cấu hình từng bàn &amp; trạng thái bảo trì</h3>
              <p className="muted-sm">
                Mặc định bàn dùng giá &amp; quy tắc làm tròn theo Loại bàn, hoặc thiết lập giá riêng cho từng bàn.
              </p>
            </div>
          </div>

          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Số</th>
                  <th>Tên bàn</th>
                  <th>Loại bàn</th>
                  <th>Giá &amp; Làm tròn đang áp dụng</th>
                  <th>Trạng thái</th>
                  <th>Ghi chú</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {tables.map((t) => {
                  const eff = getEffectiveTablePricing(t, tableTypesMap)
                  return (
                    <tr key={t.id}>
                      <td>#{t.table_number}</td>
                      <td>
                        <strong>{t.name}</strong>
                      </td>
                      <td>{eff.typeName}</td>
                      <td>
                        <div className="num">
                          <strong>{formatVnd(eff.hourlyRate)}/giờ</strong>{' '}
                          {eff.hasCustomOverride && <span className="badge">Giá riêng</span>}
                        </div>
                        <div className="muted-xs">
                          {getRoundingLabel(eff.roundingMode, eff.roundingMinutes, eff.minMinutes)}
                        </div>
                      </td>
                      <td>
                        <span className={`status-pill status-${t.status}`}>
                          {t.status === 'available'
                            ? 'Trống'
                            : t.status === 'playing'
                              ? 'Đang chơi'
                              : 'Bảo trì'}
                        </span>
                      </td>
                      <td className="muted-xs">{t.notes || '—'}</td>
                      <td>
                        <div className="row-actions">
                          <button
                            type="button"
                            className="btn btn-sm btn-outline"
                            onClick={() =>
                              setTableModal({
                                ...t,
                                custom_hourly_rate: t.custom_hourly_rate ?? '',
                                custom_rounding_minutes: t.custom_rounding_minutes ?? '',
                                custom_rounding_mode: t.custom_rounding_mode ?? '',
                                custom_min_minutes: t.custom_min_minutes ?? '',
                              })
                            }
                          >
                            Sửa
                          </button>
                          {t.status !== 'playing' && (
                            <button
                              type="button"
                              className="btn btn-sm btn-ghost"
                              disabled={busy}
                              onClick={() => handleToggleMaintenance(t)}
                            >
                              {t.status === 'maintenance' ? 'Mở lại bàn' : 'Đặt bảo trì'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 2. LOẠI BÀN & BẢNG GIÁ */}
      {subTab === 'pricing' && (
        <div className="card">
          <div className="section-head">
            <div>
              <h3>Bảng giá theo loại bàn &amp; quy tắc làm tròn</h3>
              <p className="muted-sm">
                Khi sửa giá ở đây, các hóa đơn đã thanh toán hoặc phiên đang chạy trước đó vẫn giữ nguyên đơn giá cũ.
              </p>
            </div>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() =>
                setTypeModal({
                  name: '',
                  hourly_rate: 50000,
                  rounding_minutes: 15,
                  rounding_mode: 'ceil',
                  min_minutes: 0,
                })
              }
            >
              + Thêm loại bàn
            </button>
          </div>

          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Tên loại bàn</th>
                  <th className="num">Giá giờ</th>
                  <th>Quy tắc làm tròn</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {tableTypes.map((tt) => (
                  <tr key={tt.id}>
                    <td>
                      <strong>{tt.name}</strong>
                    </td>
                    <td className="num">
                      <strong>{formatVnd(tt.hourly_rate)}/giờ</strong>
                    </td>
                    <td>{getRoundingLabel(tt.rounding_mode, tt.rounding_minutes, tt.min_minutes)}</td>
                    <td>
                      <div className="row-actions">
                        <button
                          type="button"
                          className="btn btn-sm btn-outline"
                          onClick={() => setTypeModal({ ...tt })}
                        >
                          Sửa
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-ghost-danger"
                          onClick={() => handleDeleteTableType(tt.id)}
                        >
                          Xóa
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. THỰC ĐƠN */}
      {subTab === 'menu' && (
        <div className="card">
          <div className="section-head">
            <div>
              <h3>Danh sách đồ uống &amp; đồ ăn</h3>
              <p className="muted-sm">Các món ở trạng thái &ldquo;Ngừng bán&rdquo; sẽ không hiển thị khi thu ngân gọi món.</p>
            </div>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() =>
                setMenuModal({
                  name: '',
                  category: 'Đồ uống',
                  unit: 'Lon',
                  purchase_price: '',
                  stock_quantity: 0,
                  price: 15000,
                  is_active: true,
                  sort_order: menuItems.length + 1,
                })
              }
            >
              + Thêm món mới
            </button>
          </div>

          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Tên món</th>
                  <th>Nhóm</th>
                  <th>Đơn vị</th>
                  <th className="num">Giá bán</th>
                  <th className="num">Giá nhập</th>
                  <th className="num">Tồn kho</th>
                  <th className="num">Giá trị tồn</th>
                  <th className="num">Lãi gộp/món</th>
                  <th>Trạng thái</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {menuItems.map((m) => (
                  <tr key={m.id} className={!m.is_active ? 'row-muted' : ''}>
                    <td>
                      <strong>{m.name}</strong>
                    </td>
                    <td>{m.category}</td>
                    <td>{m.unit}</td>
                    <td className="num">
                      <strong>{formatVnd(m.price)}</strong>
                    </td>
                    <td className="num">{m.purchase_price == null ? 'Chưa nhập' : formatVnd(m.purchase_price)}</td>
                    <td className="num">{m.stock_quantity == null ? 'Chưa theo dõi' : `${m.stock_quantity} ${m.unit}`}</td>
                    <td className="num">{m.stock_quantity == null || m.purchase_price == null ? '—' : formatVnd(m.stock_quantity * m.purchase_price)}</td>
                    <td className="num">{m.purchase_price == null ? '—' : formatVnd(m.price - m.purchase_price)}</td>
                    <td>
                      <span className={`status-pill ${m.is_active && m.stock_quantity !== 0 ? 'status-available' : 'status-closed'}`}>
                        {!m.is_active ? 'Ngừng bán' : m.stock_quantity === 0 ? 'Hết hàng' : 'Còn bán'}
                      </span>
                    </td>
                    <td>
                      <div className="row-actions">
                        <button
                          type="button"
                          className="btn btn-sm btn-outline"
                          onClick={() => setMenuModal({ ...m })}
                        >
                          Sửa
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-ghost"
                          disabled={busy}
                          onClick={() => handleToggleMenuActive(m)}
                        >
                          {m.is_active ? 'Ngừng bán' : 'Bán lại'}
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-ghost-danger"
                          disabled={busy}
                          onClick={() => handleDeleteMenuItem(m)}
                        >
                          Xóa
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. QUẢN LÝ TÀI KHOẢN */}
      {subTab === 'accounts' && (
        <div className="card">
          <div className="section-head">
            <div>
              <h3>Quản lý tài khoản nhân sự</h3>
              <p className="muted-sm">
                Chỉ tài khoản đang hoạt động mới được truy cập dữ liệu. Admin tạo và quản lý tài khoản nhân sự tại đây.
              </p>
            </div>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() =>
                setNewUserModal({
                  email: '',
                  password: '',
                  fullName: '',
                  role: 'cashier',
                })
              }
            >
              + Tạo tài khoản
            </button>
          </div>

          {loadingProfiles ? (
            <p className="muted-sm">Đang tải tài khoản...</p>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Họ tên</th>
                    <th>Email</th>
                    <th>Vai trò</th>
                    <th>Trạng thái</th>
                    <th>Ngày tạo</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {profiles.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <strong>{p.full_name}</strong>
                        {p.id === currentProfile?.id && <span className="badge" style={{ marginLeft: 6 }}>Bạn</span>}
                      </td>
                      <td>{p.email}</td>
                      <td>
                        <span className={`role-badge ${p.role}`}>
                          {p.role === 'admin' ? 'Admin' : 'Thu ngân'}
                        </span>
                      </td>
                      <td>
                        <span className={`status-pill ${p.is_active ? 'status-available' : 'status-maintenance'}`}>
                          {p.is_active ? 'Hoạt động' : 'Chờ duyệt / Khóa'}
                        </span>
                      </td>
                      <td className="muted-xs">{formatDateTime(p.created_at)}</td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline"
                          onClick={() => setProfileModal({ ...p })}
                        >
                          Phân quyền / Sửa
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal Loại bàn */}
      {typeModal && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-card modal-sm">
            <div className="modal-header">
              <h3>{typeModal.id ? 'Sửa loại bàn' : 'Thêm loại bàn'}</h3>
              <button type="button" className="btn btn-ghost" onClick={() => setTypeModal(null)}>
                Đóng
              </button>
            </div>
            <form onSubmit={handleSaveTableType} className="modal-body form-stack">
              <label className="field">
                <span>Tên loại bàn</span>
                <input
                  type="text"
                  required
                  value={typeModal.name}
                  onChange={(e) => setTypeModal({ ...typeModal, name: e.target.value })}
                />
              </label>
              <label className="field">
                <span>Giá giờ chơi (VNĐ/giờ)</span>
                <input
                  type="number"
                  min={0}
                  step={1000}
                  required
                  value={typeModal.hourly_rate}
                  onChange={(e) => setTypeModal({ ...typeModal, hourly_rate: e.target.value })}
                />
              </label>
              <label className="field">
                <span>Kiểu làm tròn thời gian</span>
                <select
                  value={typeModal.rounding_mode}
                  onChange={(e) => setTypeModal({ ...typeModal, rounding_mode: e.target.value })}
                >
                  <option value="ceil">Làm tròn lên theo block phút</option>
                  <option value="round">Làm tròn gần nhất theo block phút</option>
                  <option value="exact">Tính đúng từng phút (không theo block)</option>
                </select>
              </label>
              {typeModal.rounding_mode !== 'exact' && (
                <label className="field">
                  <span>Bước làm tròn (phút)</span>
                  <select
                    value={typeModal.rounding_minutes}
                    onChange={(e) => setTypeModal({ ...typeModal, rounding_minutes: Number(e.target.value) })}
                  >
                    {[1, 5, 10, 15, 30, 60].map((m) => (
                      <option key={m} value={m}>
                        {m} phút
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label className="field">
                <span>Số phút tính tối thiểu</span>
                <input
                  type="number"
                  min={0}
                  step={5}
                  value={typeModal.min_minutes}
                  onChange={(e) => setTypeModal({ ...typeModal, min_minutes: e.target.value })}
                />
              </label>
              <div className="modal-footer-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setTypeModal(null)}>
                  Hủy
                </button>
                <button type="submit" className="btn btn-primary" disabled={busy}>
                  {busy ? 'Đang lưu...' : 'Lưu'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Sửa bàn */}
      {tableModal && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-card modal-sm">
            <div className="modal-header">
              <h3>Cấu hình {tableModal.name}</h3>
              <button type="button" className="btn btn-ghost" onClick={() => setTableModal(null)}>
                Đóng
              </button>
            </div>
            <form onSubmit={handleSaveTable} className="modal-body form-stack">
              <label className="field">
                <span>Tên bàn</span>
                <input
                  type="text"
                  required
                  value={tableModal.name}
                  onChange={(e) => setTableModal({ ...tableModal, name: e.target.value })}
                />
              </label>
              <label className="field">
                <span>Loại bàn</span>
                <select
                  value={tableModal.table_type_id}
                  onChange={(e) => setTableModal({ ...tableModal, table_type_id: e.target.value })}
                >
                  {tableTypes.map((tt) => (
                    <option key={tt.id} value={tt.id}>
                      {tt.name} ({formatVnd(tt.hourly_rate)}/giờ)
                    </option>
                  ))}
                </select>
              </label>

              <div className="info-box">
                <strong>Thiết lập riêng cho bàn này (để trống nếu dùng theo Loại bàn)</strong>
              </div>

              <label className="field">
                <span>Giá giờ riêng (VNĐ/giờ)</span>
                <input
                  type="number"
                  min={0}
                  step={1000}
                  placeholder="Theo loại bàn"
                  value={tableModal.custom_hourly_rate}
                  onChange={(e) => setTableModal({ ...tableModal, custom_hourly_rate: e.target.value })}
                />
              </label>
              <label className="field">
                <span>Kiểu làm tròn riêng</span>
                <select
                  value={tableModal.custom_rounding_mode}
                  onChange={(e) => setTableModal({ ...tableModal, custom_rounding_mode: e.target.value })}
                >
                  <option value="">Theo loại bàn</option>
                  <option value="ceil">Làm tròn lên</option>
                  <option value="round">Làm tròn gần nhất</option>
                  <option value="exact">Tính đúng từng phút</option>
                </select>
              </label>
              <label className="field">
                <span>Bước làm tròn riêng (phút)</span>
                <select
                  value={tableModal.custom_rounding_minutes}
                  onChange={(e) => setTableModal({ ...tableModal, custom_rounding_minutes: e.target.value })}
                >
                  <option value="">Theo loại bàn</option>
                  {[1, 5, 10, 15, 30, 60].map((m) => (
                    <option key={m} value={m}>
                      {m} phút
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Ghi chú bàn</span>
                <input
                  type="text"
                  value={tableModal.notes}
                  onChange={(e) => setTableModal({ ...tableModal, notes: e.target.value })}
                />
              </label>

              <div className="modal-footer-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setTableModal(null)}>
                  Hủy
                </button>
                <button type="submit" className="btn btn-primary" disabled={busy}>
                  {busy ? 'Đang lưu...' : 'Lưu bàn'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Món thực đơn */}
      {menuModal && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-card modal-sm">
            <div className="modal-header">
              <h3>{menuModal.id ? 'Sửa món' : 'Thêm món mới'}</h3>
              <button type="button" className="btn btn-ghost" onClick={() => setMenuModal(null)}>
                Đóng
              </button>
            </div>
            <form onSubmit={handleSaveMenuItem} className="modal-body form-stack">
              <label className="field">
                <span>Tên món</span>
                <input
                  type="text"
                  required
                  value={menuModal.name}
                  onChange={(e) => setMenuModal({ ...menuModal, name: e.target.value })}
                />
              </label>
              <label className="field">
                <span>Nhóm</span>
                <select
                  value={menuModal.category}
                  onChange={(e) => setMenuModal({ ...menuModal, category: e.target.value })}
                >
                  <option value="Đồ uống">Đồ uống</option>
                  <option value="Đồ ăn">Đồ ăn</option>
                  <option value="Khác">Khác</option>
                </select>
              </label>
              <label className="field">
                <span>Đơn vị tính</span>
                <input
                  type="text"
                  required
                  placeholder="Lon, Chai, Ly, Đĩa..."
                  value={menuModal.unit}
                  onChange={(e) => setMenuModal({ ...menuModal, unit: e.target.value })}
                />
              </label>
              <label className="field">
                <span>Giá nhập mỗi {menuModal.unit || 'phần'} (VNĐ)</span>
                <input
                  type="number"
                  min={0}
                  step={1000}
                  placeholder="Nhập giá vốn để tính lãi"
                  value={menuModal.purchase_price ?? ''}
                  onChange={(e) => setMenuModal({ ...menuModal, purchase_price: e.target.value })}
                />
              </label>
              <label className="field">
                <span>Số lượng tồn kho hiện tại (để trống nếu chưa theo dõi)</span>
                <input
                  type="number"
                  min={0}
                  step={1}
                  placeholder="Ví dụ: 24"
                  value={menuModal.stock_quantity ?? ''}
                  onChange={(e) => setMenuModal({ ...menuModal, stock_quantity: e.target.value })}
                />
              </label>
              <label className="field">
                <span>Giá bán (VNĐ)</span>
                <input
                  type="number"
                  min={0}
                  step={1000}
                  required
                  value={menuModal.price}
                  onChange={(e) => setMenuModal({ ...menuModal, price: e.target.value })}
                />
              </label>
              <label className="checkbox-field">
                <input
                  type="checkbox"
                  checked={menuModal.is_active !== false}
                  onChange={(e) => setMenuModal({ ...menuModal, is_active: e.target.checked })}
                />
                <span>Đang còn bán</span>
              </label>
              <div className="modal-footer-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setMenuModal(null)}>
                  Hủy
                </button>
                <button type="submit" className="btn btn-primary" disabled={busy}>
                  {busy ? 'Đang lưu...' : 'Lưu món'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Sửa tài khoản */}
      {profileModal && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-card modal-sm">
            <div className="modal-header">
              <h3>Cập nhật tài khoản</h3>
              <button type="button" className="btn btn-ghost" onClick={() => setProfileModal(null)}>
                Đóng
              </button>
            </div>
            <form onSubmit={handleUpdateProfile} className="modal-body form-stack">
              <div className="muted-sm">{profileModal.email}</div>
              <label className="field">
                <span>Họ và tên</span>
                <input
                  type="text"
                  required
                  minLength={2}
                  value={profileModal.full_name}
                  onChange={(e) => setProfileModal({ ...profileModal, full_name: e.target.value })}
                />
              </label>
              <label className="field">
                <span>Vai trò</span>
                <select
                  value={profileModal.role}
                  onChange={(e) => setProfileModal({ ...profileModal, role: e.target.value })}
                >
                  <option value="cashier">Thu ngân</option>
                  <option value="admin">Admin (Chủ quán)</option>
                </select>
              </label>
              <label className="checkbox-field">
                <input
                  type="checkbox"
                  checked={profileModal.is_active}
                  onChange={(e) => setProfileModal({ ...profileModal, is_active: e.target.checked })}
                />
                <span>Cho phép đăng nhập &amp; thao tác (Hoạt động)</span>
              </label>
              <div className="modal-footer-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setProfileModal(null)}>
                  Hủy
                </button>
                <button type="submit" className="btn btn-primary" disabled={busy}>
                  {busy ? 'Đang lưu...' : 'Lưu tài khoản'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Tạo tài khoản mới */}
      {newUserModal && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-card modal-sm">
            <div className="modal-header">
              <h3>Tạo tài khoản nhân sự</h3>
              <button type="button" className="btn btn-ghost" onClick={() => setNewUserModal(null)}>
                Đóng
              </button>
            </div>
            <form onSubmit={handleCreateUser} className="modal-body form-stack">
              <label className="field">
                <span>Họ và tên</span>
                <input
                  type="text"
                  required
                  minLength={2}
                  value={newUserModal.fullName}
                  onChange={(e) => setNewUserModal({ ...newUserModal, fullName: e.target.value })}
                />
              </label>
              <label className="field">
                <span>Email đăng nhập</span>
                <input
                  type="email"
                  required
                  value={newUserModal.email}
                  onChange={(e) => setNewUserModal({ ...newUserModal, email: e.target.value })}
                />
              </label>
              <label className="field">
                <span>Mật khẩu tạm thời (≥ 6 ký tự)</span>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={newUserModal.password}
                  onChange={(e) => setNewUserModal({ ...newUserModal, password: e.target.value })}
                />
              </label>
              <label className="field">
                <span>Vai trò</span>
                <select
                  value={newUserModal.role}
                  onChange={(e) => setNewUserModal({ ...newUserModal, role: e.target.value })}
                >
                  <option value="cashier">Thu ngân</option>
                  <option value="admin">Admin</option>
                </select>
              </label>
              {!isDemoMode && (
                <p className="muted-xs">
                  Chức năng tạo trực tiếp sử dụng Edge Function <code>admin-create-user</code> để giữ bảo mật (không đưa{' '}
                  <code>service_role</code> vào trình duyệt). Nếu chưa deploy Edge Function, hãy tạo tài khoản trong Supabase Dashboard → Authentication → Users rồi phân quyền tại đây.
                </p>
              )}
              <div className="modal-footer-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setNewUserModal(null)}>
                  Hủy
                </button>
                <button type="submit" className="btn btn-primary" disabled={busy}>
                  {busy ? 'Đang tạo...' : 'Tạo tài khoản'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
