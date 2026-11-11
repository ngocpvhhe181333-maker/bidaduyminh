import { supabase } from '../lib/supabaseClient'

function requireSupabase() {
  if (!supabase) {
    throw new Error('Supabase chưa được cấu hình trong .env.local.')
  }
  return supabase
}

function formatError(error, fallback = 'Đã xảy ra lỗi khi kết nối máy chủ.') {
  if (!error) return new Error(fallback)
  const msg = error.message || error.error_description || fallback
  if (msg.includes('Invalid login credentials')) {
    return new Error('Email hoặc mật khẩu không chính xác.')
  }
  if (msg.includes('Email not confirmed')) {
    return new Error('Email chưa được xác nhận. Vui lòng kiểm tra hộp thư hoặc xác nhận trong Supabase Auth.')
  }
  if (msg.includes('User already registered')) {
    return new Error('Email này đã được đăng ký.')
  }
  if (msg.includes('row-level security')) {
    return new Error('Bạn không có quyền thực hiện thao tác này (RLS chặn).')
  }
  return new Error(msg)
}

function buildDateRangeIso(startDate, endDate) {
  let startIso = null
  let endIso = null
  if (startDate) {
    const start = new Date(`${startDate}T00:00:00`)
    if (!Number.isNaN(start.getTime())) startIso = start.toISOString()
  }
  if (endDate) {
    const end = new Date(`${endDate}T23:59:59.999`)
    if (!Number.isNaN(end.getTime())) endIso = end.toISOString()
  }
  return { startIso, endIso }
}

async function fetchAllPages(makeQuery, pageSize = 500) {
  const rows = []
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await makeQuery().range(offset, offset + pageSize - 1)
    if (error) throw formatError(error)
    rows.push(...(data || []))
    if (!data || data.length < pageSize) return rows
  }
}

export const supabaseAdapter = {
  mode: 'supabase',

  async getSessionAndProfile() {
    const client = requireSupabase()
    const {
      data: { session },
      error: sessionErr,
    } = await client.auth.getSession()
    if (sessionErr) throw formatError(sessionErr)
    if (!session?.user) return null

    const { data: profile, error: profileErr } = await client
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .maybeSingle()

    if (profileErr) throw formatError(profileErr)

    if (!profile) {
      await client.auth.signOut()
      throw new Error('Tài khoản chưa có hồ sơ nhân sự trong hệ thống.')
    }

    if (!profile.is_active) {
      await client.auth.signOut()
      throw new Error('Tài khoản của bạn chưa được kích hoạt hoặc đã bị khóa bởi Admin.')
    }

    return { user: session.user, profile }
  },

  async signIn({ email, password }) {
    const client = requireSupabase()
    const { data, error } = await client.auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    if (error) throw formatError(error)

    const { data: profile, error: profileErr } = await client
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .maybeSingle()

    if (profileErr) throw formatError(profileErr)

    if (!profile) {
      await client.auth.signOut()
      throw new Error('Không tìm thấy hồ sơ tài khoản trong bảng profiles.')
    }

    if (!profile.is_active) {
      await client.auth.signOut()
      throw new Error('Tài khoản chưa được kích hoạt hoặc đang bị khóa. Liên hệ Admin.')
    }

    return { user: data.user, profile }
  },

  async signOut() {
    const client = requireSupabase()
    const { error } = await client.auth.signOut()
    if (error) throw formatError(error)
  },

  onAuthStateChange(callback) {
    const client = requireSupabase()
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((event) => {
      callback(event)
    })
    return () => subscription.unsubscribe()
  },

  async fetchOperationalState() {
    const client = requireSupabase()
    const [typesRes, tablesRes, menuRes, sessionsRes, shiftRes] = await Promise.all([
      client.from('table_types').select('*').order('hourly_rate', { ascending: true }),
      client.from('billiard_tables').select('*').order('table_number', { ascending: true }),
      client.from('menu_items').select('*').order('sort_order', { ascending: true }).order('name', { ascending: true }),
      client
        .from('sessions')
        .select('*, session_items(*), session_transfers(*)')
        .in('status', ['open', 'pending'])
        .order('started_at', { ascending: true }),
      client.from('shifts').select('*').eq('status', 'open').maybeSingle(),
    ])

    for (const res of [typesRes, tablesRes, menuRes, sessionsRes, shiftRes]) {
      if (res.error) throw formatError(res.error)
    }

    const openShift = shiftRes.data || null
    let openShiftSummary = null
    if (openShift) {
      const { data: summaryRows, error: sumErr } = await client.rpc('get_shift_live_summary', {
        p_shift_id: openShift.id,
      })
      if (sumErr) throw formatError(sumErr)
      openShiftSummary = Array.isArray(summaryRows) ? summaryRows[0] || null : summaryRows
    }

    const normalizedSessions = (sessionsRes.data || []).map((s) => ({
      ...s,
      session_items: [...(s.session_items || [])].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      ),
      session_transfers: [...(s.session_transfers || [])].sort(
        (a, b) => new Date(a.transferred_at).getTime() - new Date(b.transferred_at).getTime()
      ),
    }))

    return {
      tableTypes: typesRes.data || [],
      tables: tablesRes.data || [],
      menuItems: menuRes.data || [],
      openSessions: normalizedSessions,
      openShift,
      openShiftSummary,
    }
  },

  subscribeOperationalChanges(onChange) {
    const client = requireSupabase()
    const channel = client
      .channel('bida-ops-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'billiard_tables' }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions' }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'session_items' }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shifts' }, onChange)
      .subscribe()

    return () => {
      client.removeChannel(channel)
    }
  },

  async openShift({ openingCash, notes = '' }) {
    const client = requireSupabase()
    const { data, error } = await client.rpc('open_shift', {
      p_opening_cash: Number(openingCash) || 0,
      p_notes: notes,
    })
    if (error) throw formatError(error)
    return data
  },

  async closeShift({ shiftId, actualCash, notes = '' }) {
    const client = requireSupabase()
    const { data, error } = await client.rpc('close_shift', {
      p_shift_id: shiftId,
      p_actual_cash: Number(actualCash) || 0,
      p_notes: notes,
    })
    if (error) throw formatError(error)
    return data
  },

  async openTableSession({ tableId, notes = '' }) {
    const client = requireSupabase()
    const { data, error } = await client.rpc('open_table_session', {
      p_table_id: tableId,
      p_notes: notes,
    })
    if (error) throw formatError(error)
    return data
  },

  async addSessionItem({ sessionId, menuItemId, quantity = 1 }) {
    const client = requireSupabase()
    const { data, error } = await client.rpc('add_session_item', {
      p_session_id: sessionId,
      p_menu_item_id: menuItemId,
      p_quantity: Number(quantity) || 1,
    })
    if (error) throw formatError(error)
    return data
  },

  async setSessionItemQuantity({ sessionItemId, quantity }) {
    const client = requireSupabase()
    const { error } = await client.rpc('set_session_item_quantity', {
      p_session_item_id: sessionItemId,
      p_quantity: Number(quantity) || 0,
    })
    if (error) throw formatError(error)
  },

  async transferTableSession({ sessionId, toTableId, applyTargetPricing = false, note = '' }) {
    const client = requireSupabase()
    const { data, error } = await client.rpc('transfer_table_session', {
      p_session_id: sessionId,
      p_to_table_id: toTableId,
      p_apply_target_pricing: Boolean(applyTargetPricing),
      p_note: note,
    })
    if (error) throw formatError(error)
    return data
  },

  async stopTableSession({ sessionId }) {
    const client = requireSupabase()
    const { data, error } = await client.rpc('stop_table_session', { p_session_id: sessionId })
    if (error?.code === 'PGRST202') throw new Error('Chưa cập nhật Supabase. Hãy chạy file supabase/stop_table_before_payment_migration.sql trong SQL Editor.')
    if (error) throw formatError(error)
    return data
  },

  async checkoutSession({ sessionId, paymentMethod, note = '', discountType = 'none', discountValue = 0 }) {
    const client = requireSupabase()
    let { data: invoice, error } = await client.rpc('checkout_session_with_discount', {
      p_session_id: sessionId,
      p_payment_method: paymentMethod,
      p_note: note,
      p_discount_type: discountType,
      p_discount_value: discountValue,
    })
    if (error?.code === 'PGRST202' && discountType === 'none') {
      ({ data: invoice, error } = await client.rpc('checkout_session', {
        p_session_id: sessionId, p_payment_method: paymentMethod, p_note: note,
      }))
    }
    if (error?.code === 'PGRST202') throw new Error('Chưa cập nhật Supabase. Hãy chạy file supabase/checkout_discount_migration.sql trong SQL Editor.')
    if (error) throw formatError(error)
    return this.fetchInvoiceDetail(invoice.id)
  },

  async checkoutRetailSale({ items, paymentMethod, note = '', discountType = 'none', discountValue = 0 }) {
    const client = requireSupabase()
    const rpcItems = items.map(({ menuItemId, quantity }) => ({
        menu_item_id: menuItemId,
        quantity,
      }))
    let { data: invoice, error } = await client.rpc('checkout_retail_sale_with_discount', {
      p_items: rpcItems,
      p_payment_method: paymentMethod,
      p_note: note,
      p_discount_type: discountType,
      p_discount_value: discountValue,
    })
    if (error?.code === 'PGRST202' && discountType === 'none') {
      ({ data: invoice, error } = await client.rpc('checkout_retail_sale', {
        p_items: rpcItems, p_payment_method: paymentMethod, p_note: note,
      }))
    }
    if (error?.code === 'PGRST202') {
      throw new Error('Chưa cập nhật Supabase. Hãy chạy file supabase/checkout_discount_migration.sql trong SQL Editor.')
    }
    if (error) throw formatError(error)
    return this.fetchInvoiceDetail(invoice.id)
  },

  async fetchShifts() {
    const client = requireSupabase()
    const { data, error } = await client
      .from('shifts')
      .select('*')
      .order('opened_at', { ascending: false })
      .limit(100)
    if (error) throw formatError(error)
    return data || []
  },

  async fetchShiftSummary(shiftId) {
    const client = requireSupabase()
    const { data, error } = await client.rpc('get_shift_live_summary', {
      p_shift_id: shiftId,
    })
    if (error) throw formatError(error)
    return Array.isArray(data) ? data[0] || null : data
  },

  async fetchInvoices({ startDate, endDate, tableId, paymentMethod, status } = {}) {
    const client = requireSupabase()
    const { startIso, endIso } = buildDateRangeIso(startDate, endDate)

    let query = client
      .from('invoices')
      .select('*, invoice_items(*), invoice_adjustments(*)')
      .order('paid_at', { ascending: false })
      .limit(300)

    if (startIso) query = query.gte('paid_at', startIso)
    if (endIso) query = query.lte('paid_at', endIso)
    if (tableId === 'retail') query = query.is('table_id', null)
    else if (tableId && tableId !== 'all') query = query.eq('table_id', tableId)
    if (paymentMethod && paymentMethod !== 'all') query = query.eq('payment_method', paymentMethod)
    if (status && status !== 'all') query = query.eq('status', status)

    const { data, error } = await query
    if (error) throw formatError(error)
    return (data || []).map((inv) => ({
      ...inv,
      invoice_adjustments: [...(inv.invoice_adjustments || [])].sort(
        (a, b) => new Date(b.adjusted_at).getTime() - new Date(a.adjusted_at).getTime()
      ),
    }))
  },

  async fetchInvoiceDetail(invoiceId) {
    const client = requireSupabase()
    const { data, error } = await client
      .from('invoices')
      .select('*, invoice_items(*), invoice_adjustments(*)')
      .eq('id', invoiceId)
      .single()
    if (error) throw formatError(error)
    return {
      ...data,
      invoice_adjustments: [...(data.invoice_adjustments || [])].sort(
        (a, b) => new Date(b.adjusted_at).getTime() - new Date(a.adjusted_at).getTime()
      ),
    }
  },

  async adjustInvoice({ invoiceId, actionType, reason, discountAmount, tableFee, itemsFee, paymentMethod }) {
    const client = requireSupabase()
    const { data: invoice, error } = await client.rpc('admin_adjust_invoice', {
      p_invoice_id: invoiceId,
      p_action_type: actionType,
      p_reason: reason,
      p_discount_amount: discountAmount ?? null,
      p_table_fee: tableFee ?? null,
      p_items_fee: itemsFee ?? null,
      p_payment_method: paymentMethod ?? null,
    })
    if (error) throw formatError(error)
    return this.fetchInvoiceDetail(invoice.id)
  },

  async fetchReportsData({ startDate, endDate }) {
    const client = requireSupabase()
    const { startIso, endIso } = buildDateRangeIso(startDate, endDate)

    const makeInvoiceQuery = () => {
      let query = client
        .from('invoices')
        .select('*, invoice_items(purchase_price_snapshot, line_cost)')
        .order('paid_at', { ascending: false })
        .order('id', { ascending: false })
      if (startIso) query = query.gte('paid_at', startIso)
      if (endIso) query = query.lte('paid_at', endIso)
      return query
    }
    const makeOpenedShiftQuery = () => {
      let query = client.from('shifts').select('*').order('opened_at', { ascending: false }).order('id', { ascending: false })
      if (startIso) query = query.gte('opened_at', startIso)
      if (endIso) query = query.lte('opened_at', endIso)
      return query
    }

    const [invoices, openedShifts, tablesRes] = await Promise.all([
      fetchAllPages(makeInvoiceQuery),
      fetchAllPages(makeOpenedShiftQuery),
      client.from('billiard_tables').select('*').order('table_number', { ascending: true }),
    ])
    if (tablesRes.error) throw formatError(tablesRes.error)

    const shiftsById = new Map(openedShifts.map((shift) => [shift.id, shift]))
    const missingShiftIds = [...new Set(invoices.map((invoice) => invoice.shift_id))]
      .filter((id) => id && !shiftsById.has(id))
    for (let i = 0; i < missingShiftIds.length; i += 100) {
      const batch = missingShiftIds.slice(i, i + 100)
      const { data, error } = await client.from('shifts').select('*').in('id', batch)
      if (error) throw formatError(error)
      for (const shift of data || []) shiftsById.set(shift.id, shift)
    }

    const sessionIds = [...new Set(invoices.map((invoice) => invoice.session_id))].filter(Boolean)
    const transfers = []
    for (let i = 0; i < sessionIds.length; i += 100) {
      const batch = sessionIds.slice(i, i + 100)
      const rows = await fetchAllPages(() => client
        .from('session_transfers')
        .select('id, session_id, from_table_id, from_table_name, to_table_id, to_table_name, transferred_at')
        .in('session_id', batch)
        .order('transferred_at', { ascending: true })
        .order('id', { ascending: true }))
      transfers.push(...rows)
    }

    return {
      invoices,
      shifts: [...shiftsById.values()].sort((a, b) => new Date(b.opened_at) - new Date(a.opened_at)),
      tables: tablesRes.data || [],
      transfers,
    }
  },

  async saveTableType(payload) {
    const client = requireSupabase()
    const body = {
      name: payload.name.trim(),
      hourly_rate: Number(payload.hourly_rate) || 0,
      rounding_minutes: Number(payload.rounding_minutes) || 15,
      rounding_mode: payload.rounding_mode || 'ceil',
      min_minutes: Number(payload.min_minutes) || 0,
    }
    if (payload.id) {
      const { data, error } = await client
        .from('table_types')
        .update(body)
        .eq('id', payload.id)
        .select()
        .single()
      if (error) throw formatError(error)
      return data
    }
    const { data, error } = await client.from('table_types').insert(body).select().single()
    if (error) throw formatError(error)
    return data
  },

  async deleteTableType(id) {
    const client = requireSupabase()
    const { error } = await client.from('table_types').delete().eq('id', id)
    if (error) throw formatError(error)
  },

  async saveTable(payload) {
    const client = requireSupabase()
    const body = {
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

    if (payload.status && payload.status !== 'playing') {
      body.status = payload.status
    }

    if (payload.id) {
      const { data, error } = await client
        .from('billiard_tables')
        .update(body)
        .eq('id', payload.id)
        .select()
        .single()
      if (error) throw formatError(error)
      return data
    }

    const { data, error } = await client
      .from('billiard_tables')
      .insert({ ...body, table_number: Number(payload.table_number) })
      .select()
      .single()
    if (error) throw formatError(error)
    return data
  },

  async saveMenuItem(payload) {
    const client = requireSupabase()
    const body = {
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
      const { data, error } = await client
        .from('menu_items')
        .update(body)
        .eq('id', payload.id)
        .select()
        .single()
      if (error) throw formatError(error)
      return data
    }
    const { data, error } = await client.from('menu_items').insert(body).select().single()
    if (error) throw formatError(error)
    return data
  },

  async deleteMenuItem(id) {
    const client = requireSupabase()
    const { error } = await client.from('menu_items').delete().eq('id', id)
    if (error) throw formatError(error)
  },

  async fetchProfiles() {
    const client = requireSupabase()
    const { data, error } = await client
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: true })
    if (error) throw formatError(error)
    return data || []
  },

  async updateProfile({ profileId, fullName, role, isActive }) {
    const client = requireSupabase()
    const { data, error } = await client.rpc('admin_update_profile', {
      p_profile_id: profileId,
      p_full_name: fullName,
      p_role: role,
      p_is_active: isActive,
    })
    if (error) throw formatError(error)
    return data
  },

  async createStaffUser({ email, password, fullName, role }) {
    const client = requireSupabase()
    const { data, error } = await client.functions.invoke('admin-create-user', {
      body: {
        email: email.trim(),
        password,
        full_name: fullName.trim(),
        role,
      },
    })
    if (error) {
      throw new Error(
        'Chưa thể gọi Edge Function "admin-create-user". Nếu bạn chưa triển khai Edge Function này, hãy tạo user mới trong Supabase Dashboard -> Authentication -> Users, sau đó kích hoạt và phân quyền tại đây.'
      )
    }
    if (data?.error) {
      throw new Error(data.error)
    }
    return { profile: data?.profile || null, method: 'edge-function' }
  },
}
