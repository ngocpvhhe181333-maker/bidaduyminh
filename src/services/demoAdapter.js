import { calculateTableFee } from '../utils/pricing.js'
import { calculateDiscount } from '../utils/discount.js'

const STORAGE_KEY = 'duyminhbida_demo_state_v1'
const AUTH_SESSION_KEY = 'duyminhbida_demo_auth_v1'

function uuid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

function createInitialState() {
  const now = new Date()
  const adminId = 'demo-admin-001'
  const cashierId = 'demo-cashier-001'
  const normalTypeId = 'type-normal'
  const vipTypeId = 'type-vip'

  const started45mAgo = new Date(now.getTime() - 47 * 60 * 1000).toISOString()
  const shiftOpenTime = new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString()
  const paidYesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()
  const paidYesterdayStart = new Date(now.getTime() - 26 * 60 * 60 * 1000).toISOString()
  const shiftYesterdayOpen = new Date(now.getTime() - 29 * 60 * 60 * 1000).toISOString()
  const shiftYesterdayClose = new Date(now.getTime() - 22 * 60 * 60 * 1000).toISOString()

  const activeSessionId = 'demo-session-001'
  const activeShiftId = 'demo-shift-open'
  const closedShiftId = 'demo-shift-yesterday'
  const sampleInvoiceId = 'demo-inv-001'

  return {
    profiles: [
      {
        id: adminId,
        email: 'admin@duyminhbida.vn',
        full_name: 'Chủ quán (Admin)',
        role: 'admin',
        is_active: true,
        created_at: shiftYesterdayOpen,
      },
      {
        id: cashierId,
        email: 'thungan@duyminhbida.vn',
        full_name: 'Nhân viên Thu ngân',
        role: 'cashier',
        is_active: true,
        created_at: shiftYesterdayOpen,
      },
    ],
    tableTypes: [
      {
        id: normalTypeId,
        name: 'Bàn Lỗ Thường',
        hourly_rate: 50000,
        rounding_minutes: 15,
        rounding_mode: 'ceil',
        min_minutes: 0,
      },
      {
        id: vipTypeId,
        name: 'Bàn Lỗ VIP',
        hourly_rate: 70000,
        rounding_minutes: 15,
        rounding_mode: 'ceil',
        min_minutes: 0,
      },
    ],
    tables: [
      {
        id: 'table-1',
        table_number: 1,
        name: 'Bàn 1',
        table_type_id: normalTypeId,
        custom_hourly_rate: null,
        custom_rounding_minutes: null,
        custom_rounding_mode: null,
        custom_min_minutes: null,
        status: 'playing',
        notes: 'Gần cửa sổ',
      },
      {
        id: 'table-2',
        table_number: 2,
        name: 'Bàn 2',
        table_type_id: normalTypeId,
        custom_hourly_rate: null,
        custom_rounding_minutes: null,
        custom_rounding_mode: null,
        custom_min_minutes: null,
        status: 'available',
        notes: '',
      },
      {
        id: 'table-3',
        table_number: 3,
        name: 'Bàn 3',
        table_type_id: normalTypeId,
        custom_hourly_rate: null,
        custom_rounding_minutes: null,
        custom_rounding_mode: null,
        custom_min_minutes: null,
        status: 'available',
        notes: '',
      },
      {
        id: 'table-4',
        table_number: 4,
        name: 'Bàn 4',
        table_type_id: vipTypeId,
        custom_hourly_rate: null,
        custom_rounding_minutes: null,
        custom_rounding_mode: null,
        custom_min_minutes: null,
        status: 'available',
        notes: 'Nỉ mới, điều hòa riêng',
      },
      {
        id: 'table-5',
        table_number: 5,
        name: 'Bàn 5',
        table_type_id: vipTypeId,
        custom_hourly_rate: null,
        custom_rounding_minutes: null,
        custom_rounding_mode: null,
        custom_min_minutes: null,
        status: 'maintenance',
        notes: 'Đang thay đầu cơ và cân chỉnh băng',
      },
    ],
    menuItems: [
      { id: 'menu-1', name: 'Sting dâu', category: 'Đồ uống', unit: 'Chai', price: 15000, purchase_price: 9000, stock_quantity: 24, is_active: true, sort_order: 1 },
      { id: 'menu-2', name: 'Bò húc (Red Bull)', category: 'Đồ uống', unit: 'Lon', price: 20000, purchase_price: 13000, stock_quantity: 24, is_active: true, sort_order: 2 },
      { id: 'menu-3', name: 'Coca-Cola', category: 'Đồ uống', unit: 'Lon', price: 15000, purchase_price: 9000, stock_quantity: 24, is_active: true, sort_order: 3 },
      { id: 'menu-4', name: 'Nước suối Aquafina', category: 'Đồ uống', unit: 'Chai', price: 10000, purchase_price: 5000, stock_quantity: 24, is_active: true, sort_order: 4 },
      { id: 'menu-5', name: 'Trà chanh', category: 'Đồ uống', unit: 'Ly', price: 12000, purchase_price: 4000, stock_quantity: 20, is_active: true, sort_order: 5 },
      { id: 'menu-6', name: 'Cà phê sữa đá', category: 'Đồ uống', unit: 'Ly', price: 22000, purchase_price: 7000, stock_quantity: 20, is_active: true, sort_order: 6 },
      { id: 'menu-7', name: 'Mì tôm trứng', category: 'Đồ ăn', unit: 'Tô', price: 25000, purchase_price: 12000, stock_quantity: 15, is_active: true, sort_order: 7 },
      { id: 'menu-8', name: 'Mì xào bò', category: 'Đồ ăn', unit: 'Đĩa', price: 45000, purchase_price: 26000, stock_quantity: 12, is_active: true, sort_order: 8 },
      { id: 'menu-9', name: 'Khoai tây chiên', category: 'Đồ ăn', unit: 'Đĩa', price: 35000, purchase_price: 17000, stock_quantity: 15, is_active: true, sort_order: 9 },
      { id: 'menu-10', name: 'Khăn lạnh', category: 'Khác', unit: 'Cái', price: 3000, purchase_price: 1000, stock_quantity: 30, is_active: true, sort_order: 10 },
    ],
    shifts: [
      {
        id: activeShiftId,
        opened_by: cashierId,
        opened_by_name: 'Nhân viên Thu ngân',
        opened_at: shiftOpenTime,
        opening_cash: 500000,
        closed_by: null,
        closed_by_name: null,
        closed_at: null,
        actual_cash: null,
        expected_cash: null,
        cash_revenue: 0,
        transfer_revenue: 0,
        table_revenue: 0,
        items_revenue: 0,
        discount_total: 0,
        cash_difference: null,
        notes: 'Ca tối',
        status: 'open',
      },
      {
        id: closedShiftId,
        opened_by: cashierId,
        opened_by_name: 'Nhân viên Thu ngân',
        opened_at: shiftYesterdayOpen,
        opening_cash: 500000,
        closed_by: cashierId,
        closed_by_name: 'Nhân viên Thu ngân',
        closed_at: shiftYesterdayClose,
        actual_cash: 645000,
        expected_cash: 645000,
        cash_revenue: 145000,
        transfer_revenue: 0,
        table_revenue: 105000,
        items_revenue: 40000,
        discount_total: 0,
        cash_difference: 0,
        notes: 'Đủ tiền mặt',
        status: 'closed',
      },
    ],
    sessions: [
      {
        id: activeSessionId,
        table_id: 'table-1',
        table_name_snapshot: 'Bàn 1',
        table_type_snapshot: 'Bàn Lỗ Thường',
        opened_by: cashierId,
        opened_by_name: 'Nhân viên Thu ngân',
        started_at: started45mAgo,
        ended_at: null,
        hourly_rate_snapshot: 50000,
        rounding_minutes_snapshot: 15,
        rounding_mode_snapshot: 'ceil',
        min_minutes_snapshot: 0,
        notes: '',
        status: 'open',
      },
      {
        id: 'demo-session-old-1',
        table_id: 'table-4',
        table_name_snapshot: 'Bàn 4',
        table_type_snapshot: 'Bàn Lỗ VIP',
        opened_by: cashierId,
        opened_by_name: 'Nhân viên Thu ngân',
        started_at: paidYesterdayStart,
        ended_at: paidYesterday,
        hourly_rate_snapshot: 70000,
        rounding_minutes_snapshot: 15,
        rounding_mode_snapshot: 'ceil',
        min_minutes_snapshot: 0,
        notes: '',
        status: 'closed',
      },
    ],
    sessionItems: [
      {
        id: 'demo-si-1',
        session_id: activeSessionId,
        menu_item_id: 'menu-1',
        item_name_snapshot: 'Sting dâu',
        unit_snapshot: 'Chai',
        unit_price_snapshot: 15000,
      purchase_price_snapshot: 9000,
        quantity: 2,
        added_by: cashierId,
        created_at: started45mAgo,
      },
    ],
    sessionTransfers: [],
    invoices: [
      {
        id: sampleInvoiceId,
        invoice_code: 'HD-DEMO-0001',
      sale_type: 'table',
        session_id: 'demo-session-old-1',
        shift_id: closedShiftId,
        table_id: 'table-4',
        table_name: 'Bàn 4',
        table_type_name: 'Bàn Lỗ VIP',
        started_at: paidYesterdayStart,
        ended_at: paidYesterday,
        duration_seconds: 5400,
        billed_minutes: 90,
        hourly_rate_snapshot: 70000,
        rounding_minutes_snapshot: 15,
        rounding_mode_snapshot: 'ceil',
        min_minutes_snapshot: 0,
        table_fee: 105000,
        items_fee: 40000,
        discount_amount: 0,
        total_amount: 145000,
        payment_method: 'cash',
        cashier_id: cashierId,
        cashier_name: 'Nhân viên Thu ngân',
        paid_at: paidYesterday,
        status: 'paid',
        note: '',
      },
    ],
    invoiceItems: [
      {
        id: 'demo-ii-1',
        invoice_id: sampleInvoiceId,
        menu_item_id: 'menu-2',
        item_name: 'Bò húc (Red Bull)',
        unit: 'Lon',
        unit_price: 20000,
        purchase_price_snapshot: 13000,
        line_cost: 26000,
        quantity: 2,
        line_total: 40000,
      },
    ],
    invoiceAdjustments: [],
  }
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    // fallback
  }
  const initial = createInitialState()
  saveState(initial)
  return initial
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

function getCurrentDemoUser(state) {
  const userId = localStorage.getItem(AUTH_SESSION_KEY)
  if (!userId) return null
  const profile = state.profiles.find((p) => p.id === userId)
  if (!profile || !profile.is_active) return null
  return profile
}

function requireStaff(state) {
  const user = getCurrentDemoUser(state)
  if (!user) throw new Error('Vui lòng đăng nhập.')
  return user
}

function requireAdmin(state) {
  const user = requireStaff(state)
  if (user.role !== 'admin') {
    throw new Error('Chỉ Admin mới có quyền thực hiện thao tác này.')
  }
  return user
}

function computeShiftSummaryFromState(state, shiftId) {
  const shiftInvoices = state.invoices.filter((i) => i.shift_id === shiftId)
  const valid = shiftInvoices.filter((i) => i.status !== 'voided')
  return {
    invoice_count: valid.length,
    voided_count: shiftInvoices.filter((i) => i.status === 'voided').length,
    cash_revenue: valid.filter((i) => i.payment_method === 'cash').reduce((s, i) => s + i.total_amount, 0),
    transfer_revenue: valid.filter((i) => i.payment_method === 'transfer').reduce((s, i) => s + i.total_amount, 0),
    table_revenue: valid.reduce((s, i) => s + i.table_fee, 0),
    items_revenue: valid.reduce((s, i) => s + i.items_fee, 0),
    discount_total: valid.reduce((s, i) => s + i.discount_amount, 0),
  }
}

function enrichInvoice(state, invoice) {
  return {
    ...invoice,
    invoice_items: state.invoiceItems.filter((ii) => ii.invoice_id === invoice.id),
    invoice_adjustments: state.invoiceAdjustments
      .filter((adj) => adj.invoice_id === invoice.id)
      .sort((a, b) => new Date(b.adjusted_at).getTime() - new Date(a.adjusted_at).getTime()),
  }
}

const listeners = new Set()
function notifyListeners(event) {
  for (const cb of listeners) cb(event)
}

export const demoAdapter = {
  mode: 'demo',

  resetDemoData() {
    const fresh = createInitialState()
    saveState(fresh)
    return fresh
  },

  async getSessionAndProfile() {
    const state = loadState()
    const profile = getCurrentDemoUser(state)
    if (!profile) return null
    return { user: { id: profile.id, email: profile.email }, profile }
  },

  async signIn({ email, password }) {
    const state = loadState()
    const normalized = email.trim().toLowerCase()
    const profile = state.profiles.find((p) => p.email.toLowerCase() === normalized)
    if (!profile) {
      throw new Error('Email không tồn tại trong chế độ Demo (chọn nút đăng nhập nhanh bên dưới).')
    }
    if (password && profile.demo_password && password !== profile.demo_password) {
      throw new Error('Mật khẩu không đúng.')
    }
    if (!profile.is_active) {
      throw new Error('Tài khoản đang bị khóa bởi Admin.')
    }
    localStorage.setItem(AUTH_SESSION_KEY, profile.id)
    notifyListeners('SIGNED_IN')
    return { user: { id: profile.id, email: profile.email }, profile }
  },

  async quickDemoLogin(role) {
    const state = loadState()
    const profile = state.profiles.find((p) => p.role === role && p.is_active)
    if (!profile) throw new Error(`Không tìm thấy tài khoản ${role} đang hoạt động.`)
    localStorage.setItem(AUTH_SESSION_KEY, profile.id)
    notifyListeners('SIGNED_IN')
    return { user: { id: profile.id, email: profile.email }, profile }
  },

  async signOut() {
    localStorage.removeItem(AUTH_SESSION_KEY)
    notifyListeners('SIGNED_OUT')
  },

  onAuthStateChange(callback) {
    listeners.add(callback)
    return () => listeners.delete(callback)
  },

  subscribeOperationalChanges() {
    return () => {}
  },

  async fetchOperationalState() {
    const state = loadState()
    requireStaff(state)
    const openShift = state.shifts.find((s) => s.status === 'open') || null
    const openShiftSummary = openShift ? computeShiftSummaryFromState(state, openShift.id) : null
    const openSessions = state.sessions
      .filter((s) => s.status === 'open' || s.status === 'pending')
      .map((s) => ({
        ...s,
        session_items: state.sessionItems.filter((si) => si.session_id === s.id),
        session_transfers: state.sessionTransfers.filter((st) => st.session_id === s.id),
      }))

    return {
      tableTypes: [...state.tableTypes].sort((a, b) => a.hourly_rate - b.hourly_rate),
      tables: [...state.tables].sort((a, b) => a.table_number - b.table_number),
      menuItems: [...state.menuItems].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)),
      openSessions,
      openShift,
      openShiftSummary,
    }
  },

  async openShift({ openingCash, notes = '' }) {
    const state = loadState()
    const user = requireStaff(state)
    if (state.shifts.some((s) => s.status === 'open')) {
      throw new Error('Hiện đang có một ca làm chưa chốt. Vui lòng chốt ca trước khi mở ca mới.')
    }
    const newShift = {
      id: uuid(),
      opened_by: user.id,
      opened_by_name: user.full_name,
      opened_at: new Date().toISOString(),
      opening_cash: Math.max(0, Number(openingCash) || 0),
      closed_by: null,
      closed_by_name: null,
      closed_at: null,
      actual_cash: null,
      expected_cash: null,
      cash_revenue: 0,
      transfer_revenue: 0,
      table_revenue: 0,
      items_revenue: 0,
      discount_total: 0,
      cash_difference: null,
      notes: notes || '',
      status: 'open',
    }
    state.shifts.unshift(newShift)
    saveState(state)
    return newShift
  },

  async closeShift({ shiftId, actualCash, notes = '' }) {
    const state = loadState()
    const user = requireStaff(state)
    const shift = state.shifts.find((s) => s.id === shiftId)
    if (!shift) throw new Error('Không tìm thấy ca làm.')
    if (shift.status !== 'open') throw new Error('Ca làm đã chốt trước đó.')

    const sum = computeShiftSummaryFromState(state, shift.id)
    const actual = Math.max(0, Number(actualCash) || 0)
    const expected = shift.opening_cash + sum.cash_revenue

    shift.closed_by = user.id
    shift.closed_by_name = user.full_name
    shift.closed_at = new Date().toISOString()
    shift.actual_cash = actual
    shift.expected_cash = expected
    shift.cash_revenue = sum.cash_revenue
    shift.transfer_revenue = sum.transfer_revenue
    shift.table_revenue = sum.table_revenue
    shift.items_revenue = sum.items_revenue
    shift.discount_total = sum.discount_total
    shift.cash_difference = actual - expected
    if (notes.trim()) {
      shift.notes = shift.notes ? `${shift.notes}\n${notes.trim()}` : notes.trim()
    }
    shift.status = 'closed'

    saveState(state)
    return shift
  },

  async openTableSession({ tableId, notes = '' }) {
    const state = loadState()
    const user = requireStaff(state)
    const openShift = state.shifts.find((s) => s.status === 'open')
    if (!openShift) {
      throw new Error('Chưa có ca làm đang mở. Vui lòng mở ca trước khi mở bàn.')
    }
    const table = state.tables.find((t) => t.id === tableId)
    if (!table) throw new Error('Không tìm thấy bàn.')
    if (table.status === 'maintenance') throw new Error('Bàn đang bảo trì, không thể mở phiên.')
    if (table.status === 'playing' || state.sessions.some((s) => s.table_id === tableId && s.status === 'open')) {
      throw new Error('Bàn này đang có người chơi, không thể mở hai phiên đồng thời.')
    }

    const tType = state.tableTypes.find((tt) => tt.id === table.table_type_id) || state.tableTypes[0]
    const session = {
      id: uuid(),
      table_id: table.id,
      table_name_snapshot: table.name,
      table_type_snapshot: tType.name,
      opened_by: user.id,
      opened_by_name: user.full_name,
      started_at: new Date().toISOString(),
      ended_at: null,
      hourly_rate_snapshot: table.custom_hourly_rate ?? tType.hourly_rate,
      rounding_minutes_snapshot: table.custom_rounding_minutes ?? tType.rounding_minutes,
      rounding_mode_snapshot: table.custom_rounding_mode ?? tType.rounding_mode,
      min_minutes_snapshot: table.custom_min_minutes ?? tType.min_minutes,
      notes: notes || '',
      status: 'open',
    }
    state.sessions.push(session)
    table.status = 'playing'
    saveState(state)
    return session
  },

  async addSessionItem({ sessionId, menuItemId, quantity = 1 }) {
    const state = loadState()
    const user = requireStaff(state)
    const session = state.sessions.find((s) => s.id === sessionId && s.status === 'open')
    if (!session) throw new Error('Phiên chơi không tồn tại hoặc đã đóng.')

    const menu = state.menuItems.find((m) => m.id === menuItemId)
    if (!menu) throw new Error('Không tìm thấy món.')
    if (!menu.is_active) throw new Error(`Món "${menu.name}" đã ngừng bán.`)

    const qty = Math.max(1, Number(quantity) || 1)
    if (menu.stock_quantity != null && menu.stock_quantity < qty) {
      throw new Error(`Món "${menu.name}" không đủ tồn kho.`)
    }
    const existing = state.sessionItems.find(
      (si) => si.session_id === sessionId && si.menu_item_id === menuItemId && si.unit_price_snapshot === menu.price && si.purchase_price_snapshot === (menu.purchase_price ?? null)
    )
    if (menu.stock_quantity != null) menu.stock_quantity -= qty
    if (existing) {
      existing.quantity += qty
      saveState(state)
      return existing
    }
    const item = {
      id: uuid(),
      session_id: sessionId,
      menu_item_id: menu.id,
      item_name_snapshot: menu.name,
      unit_snapshot: menu.unit,
      unit_price_snapshot: menu.price,
      purchase_price_snapshot: menu.purchase_price ?? null,
      quantity: qty,
      added_by: user.id,
      created_at: new Date().toISOString(),
    }
    state.sessionItems.push(item)
    saveState(state)
    return item
  },

  async setSessionItemQuantity({ sessionItemId, quantity }) {
    const state = loadState()
    requireStaff(state)
    const idx = state.sessionItems.findIndex((si) => si.id === sessionItemId)
    if (idx === -1) throw new Error('Không tìm thấy dòng món.')
    const item = state.sessionItems[idx]
    const session = state.sessions.find((s) => s.id === item.session_id)
    if (!session || session.status !== 'open') {
      throw new Error('Phiên chơi đã đóng.')
    }
    const menu = state.menuItems.find((m) => m.id === item.menu_item_id)
    const nextQuantity = Math.max(0, Number(quantity) || 0)
    const delta = nextQuantity - item.quantity
    if (menu?.stock_quantity != null && delta > menu.stock_quantity) {
      throw new Error(`Món "${menu.name}" không đủ tồn kho.`)
    }
    if (menu?.stock_quantity != null) menu.stock_quantity -= delta
    if (nextQuantity === 0) {
      state.sessionItems.splice(idx, 1)
    } else {
      item.quantity = nextQuantity
    }
    saveState(state)
  },

  async transferTableSession({ sessionId, toTableId, applyTargetPricing = false, note = '' }) {
    const state = loadState()
    const user = requireStaff(state)
    const session = state.sessions.find((s) => s.id === sessionId && s.status === 'open')
    if (!session) throw new Error('Phiên chơi không tồn tại hoặc đã đóng.')

    const fromTable = state.tables.find((t) => t.id === session.table_id)
    const toTable = state.tables.find((t) => t.id === toTableId)
    if (!toTable || toTable.status !== 'available') {
      throw new Error('Bàn đích phải ở trạng thái Trống.')
    }

    const toType = state.tableTypes.find((tt) => tt.id === toTable.table_type_id) || state.tableTypes[0]
    fromTable.status = 'available'
    toTable.status = 'playing'

    state.sessionTransfers.push({
      id: uuid(),
      session_id: session.id,
      from_table_id: fromTable.id,
      from_table_name: fromTable.name,
      to_table_id: toTable.id,
      to_table_name: toTable.name,
      transferred_by: user.id,
      transferred_by_name: user.full_name,
      transferred_at: new Date().toISOString(),
      note: note || '',
    })

    session.table_id = toTable.id
    session.table_name_snapshot = toTable.name
    session.table_type_snapshot = toType.name
    if (applyTargetPricing) {
      session.hourly_rate_snapshot = toTable.custom_hourly_rate ?? toType.hourly_rate
      session.rounding_minutes_snapshot = toTable.custom_rounding_minutes ?? toType.rounding_minutes
      session.rounding_mode_snapshot = toTable.custom_rounding_mode ?? toType.rounding_mode
      session.min_minutes_snapshot = toTable.custom_min_minutes ?? toType.min_minutes
    }

    saveState(state)
    return session
  },

  async stopTableSession({ sessionId }) {
    const state = loadState()
    requireStaff(state)
    const session = state.sessions.find((s) => s.id === sessionId)
    if (!session || !['open', 'pending'].includes(session.status)) {
      throw new Error('Phiên chơi không tồn tại hoặc đã thanh toán.')
    }
    if (session.status === 'open') {
      session.status = 'pending'
      session.ended_at = new Date().toISOString()
      saveState(state)
    }
    return session
  },

  async checkoutSession({ sessionId, paymentMethod, note = '', discountType = 'none', discountValue = 0 }) {
    const state = loadState()
    const user = requireStaff(state)
    if (paymentMethod !== 'cash' && paymentMethod !== 'transfer') {
      throw new Error('Phương thức thanh toán không hợp lệ.')
    }
    const openShift = state.shifts.find((s) => s.status === 'open')
    if (!openShift) {
      throw new Error('Chưa có ca làm đang mở. Vui lòng mở ca trước khi thu tiền.')
    }
    const session = state.sessions.find((s) => s.id === sessionId && ['open', 'pending'].includes(s.status))
    if (!session) throw new Error('Phiên chơi không tồn tại hoặc đã thanh toán.')

    const endedAt = session.ended_at ? new Date(session.ended_at) : new Date()
    const paidAt = new Date()
    const calc = calculateTableFee({
      startedAt: session.started_at,
      endedAt,
      hourlyRate: session.hourly_rate_snapshot,
      roundingMinutes: session.rounding_minutes_snapshot,
      roundingMode: session.rounding_mode_snapshot,
      minMinutes: session.min_minutes_snapshot,
    })

    const items = state.sessionItems.filter((si) => si.session_id === sessionId)
    const itemsFee = items.reduce((sum, i) => sum + i.unit_price_snapshot * i.quantity, 0)
    const discount = calculateDiscount(calc.tableFee + itemsFee, discountType, discountValue)
    if (!discount.valid) throw new Error('Giá trị giảm giá không hợp lệ.')
    const dateTag = paidAt.toISOString().slice(0, 10).replaceAll('-', '')
    const seq = String(state.invoices.length + 1).padStart(4, '0')

    const invoice = {
      id: uuid(),
      invoice_code: `HD-${dateTag}-${seq}`,
      sale_type: 'table',
      session_id: session.id,
      shift_id: openShift.id,
      table_id: session.table_id,
      table_name: session.table_name_snapshot,
      table_type_name: session.table_type_snapshot,
      started_at: session.started_at,
      ended_at: endedAt.toISOString(),
      duration_seconds: calc.durationSeconds,
      billed_minutes: calc.billedMinutes,
      hourly_rate_snapshot: session.hourly_rate_snapshot,
      rounding_minutes_snapshot: session.rounding_minutes_snapshot,
      rounding_mode_snapshot: session.rounding_mode_snapshot,
      min_minutes_snapshot: session.min_minutes_snapshot,
      table_fee: calc.tableFee,
      items_fee: itemsFee,
      discount_amount: discount.amount,
      total_amount: calc.tableFee + itemsFee - discount.amount,
      payment_method: paymentMethod,
      cashier_id: user.id,
      cashier_name: user.full_name,
      paid_at: paidAt.toISOString(),
      status: 'paid',
      note: note.trim() || session.notes || '',
    }

    state.invoices.unshift(invoice)
    for (const si of items) {
      state.invoiceItems.push({
        id: uuid(),
        invoice_id: invoice.id,
        menu_item_id: si.menu_item_id,
        item_name: si.item_name_snapshot,
        unit: si.unit_snapshot,
        unit_price: si.unit_price_snapshot,
        purchase_price_snapshot: si.purchase_price_snapshot ?? null,
        line_cost: si.purchase_price_snapshot == null ? null : si.purchase_price_snapshot * si.quantity,
        quantity: si.quantity,
        line_total: si.unit_price_snapshot * si.quantity,
      })
    }

    session.status = 'closed'
    session.ended_at = endedAt.toISOString()
    const table = state.tables.find((t) => t.id === session.table_id)
    if (table) table.status = 'available'

    saveState(state)
    return enrichInvoice(state, invoice)
  },

  async checkoutRetailSale({ items, paymentMethod, note = '', discountType = 'none', discountValue = 0 }) {
    const state = loadState()
    const user = requireStaff(state)
    const openShift = state.shifts.find((shift) => shift.status === 'open')
    if (!openShift) throw new Error('Chưa có ca làm đang mở. Vui lòng mở ca trước khi thu tiền.')
    if (!['cash', 'transfer'].includes(paymentMethod)) throw new Error('Phương thức thanh toán không hợp lệ.')
    if (!Array.isArray(items) || items.length === 0) throw new Error('Vui lòng chọn ít nhất một món.')

    const lines = items.map(({ menuItemId, quantity }) => {
      const menuItem = state.menuItems.find((item) => item.id === menuItemId && item.is_active)
      if (!menuItem) throw new Error('Món đã ngừng bán hoặc không tồn tại.')
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
        throw new Error('Số lượng món phải từ 1 đến 99.')
      }
      return { menuItem, quantity }
    })

    const neededByMenu = new Map()
    for (const { menuItem, quantity } of lines) {
      neededByMenu.set(menuItem.id, (neededByMenu.get(menuItem.id) || 0) + quantity)
    }
    for (const [menuItemId, quantity] of neededByMenu) {
      const menuItem = state.menuItems.find((item) => item.id === menuItemId)
      if (menuItem.stock_quantity != null && menuItem.stock_quantity < quantity) {
        throw new Error(`Món "${menuItem.name}" không đủ tồn kho.`)
      }
    }

    const paidAt = new Date()
    const itemsFee = lines.reduce((sum, { menuItem, quantity }) => sum + menuItem.price * quantity, 0)
    const discount = calculateDiscount(itemsFee, discountType, discountValue)
    if (!discount.valid) throw new Error('Giá trị giảm giá không hợp lệ.')
    const dateTag = paidAt.toISOString().slice(0, 10).replaceAll('-', '')
    const seq = String(state.invoices.length + 1).padStart(4, '0')
    const invoice = {
      id: uuid(),
      invoice_code: `HD-${dateTag}-${seq}`,
      sale_type: 'retail',
      session_id: null,
      shift_id: openShift.id,
      table_id: null,
      table_name: 'Bán lẻ',
      table_type_name: 'Không dùng bàn',
      started_at: paidAt.toISOString(),
      ended_at: paidAt.toISOString(),
      duration_seconds: 0,
      billed_minutes: 0,
      hourly_rate_snapshot: 0,
      rounding_minutes_snapshot: 1,
      rounding_mode_snapshot: 'ceil',
      min_minutes_snapshot: 0,
      table_fee: 0,
      items_fee: itemsFee,
      discount_amount: discount.amount,
      total_amount: itemsFee - discount.amount,
      payment_method: paymentMethod,
      cashier_id: user.id,
      cashier_name: user.full_name,
      paid_at: paidAt.toISOString(),
      status: 'paid',
      note: note.trim(),
    }

    state.invoices.unshift(invoice)
    for (const { menuItem, quantity } of lines) {
      state.invoiceItems.push({
        id: uuid(),
        invoice_id: invoice.id,
        menu_item_id: menuItem.id,
        item_name: menuItem.name,
        unit: menuItem.unit,
        unit_price: menuItem.price,
        purchase_price_snapshot: menuItem.purchase_price ?? null,
        line_cost: menuItem.purchase_price == null ? null : menuItem.purchase_price * quantity,
        quantity,
        line_total: menuItem.price * quantity,
      })
    }
    for (const [menuItemId, quantity] of neededByMenu) {
      const menuItem = state.menuItems.find((item) => item.id === menuItemId)
      if (menuItem.stock_quantity != null) menuItem.stock_quantity -= quantity
    }
    saveState(state)
    return enrichInvoice(state, invoice)
  },

  async fetchShifts() {
    const state = loadState()
    const user = requireStaff(state)
    const filtered =
      user.role === 'admin'
        ? state.shifts
        : state.shifts.filter(
            (s) => s.status === 'open' || s.opened_by === user.id || s.closed_by === user.id
          )
    return [...filtered].sort((a, b) => new Date(b.opened_at).getTime() - new Date(a.opened_at).getTime())
  },

  async fetchShiftSummary(shiftId) {
    const state = loadState()
    requireStaff(state)
    return computeShiftSummaryFromState(state, shiftId)
  },

  async fetchInvoices({ startDate, endDate, tableId, paymentMethod, status } = {}) {
    const state = loadState()
    const user = requireStaff(state)

    const startMs = startDate ? new Date(`${startDate}T00:00:00`).getTime() : null
    const endMs = endDate ? new Date(`${endDate}T23:59:59.999`).getTime() : null

    const visibleShiftIds = new Set(
      state.shifts
        .filter((s) => s.status === 'open' || s.opened_by === user.id)
        .map((s) => s.id)
    )

    return state.invoices
      .filter((inv) => {
        if (user.role !== 'admin' && inv.cashier_id !== user.id && !visibleShiftIds.has(inv.shift_id)) {
          return false
        }
        const paidMs = new Date(inv.paid_at).getTime()
        if (startMs && paidMs < startMs) return false
        if (endMs && paidMs > endMs) return false
        if (tableId === 'retail' && inv.table_id !== null) return false
        if (tableId && tableId !== 'all' && tableId !== 'retail' && inv.table_id !== tableId) return false
        if (paymentMethod && paymentMethod !== 'all' && inv.payment_method !== paymentMethod) return false
        if (status && status !== 'all' && inv.status !== status) return false
        return true
      })
      .sort((a, b) => new Date(b.paid_at).getTime() - new Date(a.paid_at).getTime())
      .map((inv) => enrichInvoice(state, inv))
  },

  async fetchInvoiceDetail(invoiceId) {
    const state = loadState()
    requireStaff(state)
    const inv = state.invoices.find((i) => i.id === invoiceId)
    if (!inv) throw new Error('Không tìm thấy hóa đơn.')
    return enrichInvoice(state, inv)
  },

  async adjustInvoice({ invoiceId, actionType, reason, discountAmount, tableFee, itemsFee, paymentMethod }) {
    const state = loadState()
    const admin = requireAdmin(state)
    if (!reason || reason.trim().length < 3) {
      throw new Error('Vui lòng nhập lý do điều chỉnh (tối thiểu 3 ký tự).')
    }

    const inv = state.invoices.find((i) => i.id === invoiceId)
    if (!inv) throw new Error('Không tìm thấy hóa đơn.')
    if (inv.status === 'voided') throw new Error('Hóa đơn đã bị hủy trước đó.')

    const prev = {
      table_fee: inv.table_fee,
      items_fee: inv.items_fee,
      discount_amount: inv.discount_amount,
      total_amount: inv.total_amount,
      payment_method: inv.payment_method,
      status: inv.status,
    }

    if (actionType === 'void') {
      inv.total_amount = 0
      inv.status = 'voided'
    } else {
      const nextTable = Math.max(0, tableFee ?? inv.table_fee)
      const nextItems = Math.max(0, itemsFee ?? inv.items_fee)
      const nextDiscount = Math.max(0, discountAmount ?? inv.discount_amount)
      if (nextDiscount > nextTable + nextItems) {
        throw new Error('Giảm giá không được vượt quá tổng hóa đơn.')
      }
      inv.table_fee = nextTable
      inv.items_fee = nextItems
      inv.discount_amount = nextDiscount
      inv.total_amount = Math.max(0, nextTable + nextItems - nextDiscount)
      inv.payment_method = paymentMethod ?? inv.payment_method
      inv.status = 'adjusted'
    }

    state.invoiceAdjustments.push({
      id: uuid(),
      invoice_id: inv.id,
      action_type: actionType,
      reason: reason.trim(),
      previous_table_fee: prev.table_fee,
      previous_items_fee: prev.items_fee,
      previous_discount: prev.discount_amount,
      previous_total: prev.total_amount,
      previous_payment_method: prev.payment_method,
      previous_status: prev.status,
      new_table_fee: inv.table_fee,
      new_items_fee: inv.items_fee,
      new_discount: inv.discount_amount,
      new_total: inv.total_amount,
      new_payment_method: inv.payment_method,
      new_status: inv.status,
      adjusted_by: admin.id,
      adjusted_by_name: admin.full_name,
      adjusted_at: new Date().toISOString(),
    })

    const shift = state.shifts.find((s) => s.id === inv.shift_id)
    if (shift && shift.status === 'closed') {
      const sum = computeShiftSummaryFromState(state, shift.id)
      shift.cash_revenue = sum.cash_revenue
      shift.transfer_revenue = sum.transfer_revenue
      shift.table_revenue = sum.table_revenue
      shift.items_revenue = sum.items_revenue
      shift.discount_total = sum.discount_total
      shift.expected_cash = shift.opening_cash + sum.cash_revenue
      shift.cash_difference = (shift.actual_cash ?? 0) - shift.expected_cash
    }

    saveState(state)
    return enrichInvoice(state, inv)
  },

  async fetchReportsData({ startDate, endDate }) {
    const state = loadState()
    requireAdmin(state)
    const startMs = startDate ? new Date(`${startDate}T00:00:00`).getTime() : null
    const endMs = endDate ? new Date(`${endDate}T23:59:59.999`).getTime() : null

    return {
      invoices: state.invoices.filter((inv) => {
        const ms = new Date(inv.paid_at).getTime()
        if (startMs && ms < startMs) return false
        if (endMs && ms > endMs) return false
        return true
      }).map((inv) => enrichInvoice(state, inv)),
      shifts: state.shifts.filter((sh) => {
        const ms = new Date(sh.opened_at).getTime()
        if (startMs && ms < startMs) return false
        if (endMs && ms > endMs) return false
        return true
      }),
      tables: [...state.tables].sort((a, b) => a.table_number - b.table_number),
    }
  },

  async saveTableType(payload) {
    const state = loadState()
    requireAdmin(state)
    const data = {
      name: payload.name.trim(),
      hourly_rate: Number(payload.hourly_rate) || 0,
      rounding_minutes: Number(payload.rounding_minutes) || 15,
      rounding_mode: payload.rounding_mode || 'ceil',
      min_minutes: Number(payload.min_minutes) || 0,
    }
    if (payload.id) {
      const item = state.tableTypes.find((t) => t.id === payload.id)
      if (!item) throw new Error('Không tìm thấy loại bàn.')
      Object.assign(item, data)
      saveState(state)
      return item
    }
    const item = { id: uuid(), ...data }
    state.tableTypes.push(item)
    saveState(state)
    return item
  },

  async deleteTableType(id) {
    const state = loadState()
    requireAdmin(state)
    if (state.tables.some((t) => t.table_type_id === id)) {
      throw new Error('Không thể xóa loại bàn đang được gán cho bàn.')
    }
    state.tableTypes = state.tableTypes.filter((t) => t.id !== id)
    saveState(state)
  },

  async saveTable(payload) {
    const state = loadState()
    requireAdmin(state)
    const patch = {
      name: payload.name.trim(),
      table_type_id: payload.table_type_id,
      custom_hourly_rate:
        payload.custom_hourly_rate === '' || payload.custom_hourly_rate === null
          ? null
          : Number(payload.custom_hourly_rate),
      custom_rounding_minutes:
        payload.custom_rounding_minutes === '' || payload.custom_rounding_minutes === null
          ? null
          : Number(payload.custom_rounding_minutes),
      custom_rounding_mode: payload.custom_rounding_mode || null,
      custom_min_minutes:
        payload.custom_min_minutes === '' || payload.custom_min_minutes === null
          ? null
          : Number(payload.custom_min_minutes),
      notes: (payload.notes || '').trim(),
    }

    const table = state.tables.find((t) => t.id === payload.id)
    if (!table) throw new Error('Không tìm thấy bàn.')
    if (payload.status && table.status !== 'playing' && payload.status !== 'playing') {
      patch.status = payload.status
    }
    Object.assign(table, patch)
    saveState(state)
    return table
  },

  async saveMenuItem(payload) {
    const state = loadState()
    requireAdmin(state)
    const data = {
      name: payload.name.trim(),
      category: payload.category || 'Đồ uống',
      unit: payload.unit.trim() || 'Phần',
      price: Number(payload.price) || 0,
      purchase_price: payload.purchase_price === '' || payload.purchase_price == null ? null : Number(payload.purchase_price),
      stock_quantity: payload.stock_quantity === '' || payload.stock_quantity == null ? null : Number(payload.stock_quantity),
      is_active: payload.is_active !== false,
      sort_order: Number(payload.sort_order) || 0,
    }
    if (payload.id) {
      const item = state.menuItems.find((m) => m.id === payload.id)
      if (!item) throw new Error('Không tìm thấy món.')
      Object.assign(item, data)
      saveState(state)
      return item
    }
    const item = { id: uuid(), ...data }
    state.menuItems.push(item)
    saveState(state)
    return item
  },

  async deleteMenuItem(id) {
    const state = loadState()
    requireAdmin(state)
    state.menuItems = state.menuItems.filter((m) => m.id !== id)
    saveState(state)
  },

  async fetchProfiles() {
    const state = loadState()
    requireAdmin(state)
    return [...state.profiles]
  },

  async updateProfile({ profileId, fullName, role, isActive }) {
    const state = loadState()
    const admin = requireAdmin(state)
    if (profileId === admin.id && (role !== 'admin' || !isActive)) {
      throw new Error('Không thể tự hạ quyền hoặc tự khóa tài khoản Admin đang đăng nhập.')
    }
    const target = state.profiles.find((p) => p.id === profileId)
    if (!target) throw new Error('Không tìm thấy tài khoản.')
    target.full_name = fullName.trim()
    target.role = role
    target.is_active = isActive
    saveState(state)
    return target
  },

  async createStaffUser({ email, password, fullName, role }) {
    const state = loadState()
    requireAdmin(state)
    const normalized = email.trim().toLowerCase()
    if (state.profiles.some((p) => p.email.toLowerCase() === normalized)) {
      throw new Error('Email này đã tồn tại.')
    }
    const newProfile = {
      id: uuid(),
      email: normalized,
      full_name: fullName.trim(),
      role: role === 'admin' ? 'admin' : 'cashier',
      is_active: true,
      demo_password: password,
      created_at: new Date().toISOString(),
    }
    state.profiles.push(newProfile)
    saveState(state)
    return { profile: newProfile, method: 'demo' }
  },
}
