-- ============================================================================
-- DUY MINH BI-A — SUPABASE SCHEMA, RLS & RPC FUNCTIONS
-- Chạy toàn bộ file này trong Supabase Dashboard -> SQL Editor
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. BẢNG HỒ SƠ NGƯỜI DÙNG & PHÂN QUYỀN
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'cashier' CHECK (role IN ('admin', 'cashier')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Hàm helper kiểm tra quyền (SECURITY DEFINER để tránh đệ quy RLS)
CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('admin', 'cashier')
      AND is_active = true
  );
$$;
-- Kiểm tra quyền Admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'admin'
      AND is_active = true
  );
$$;

-- Trigger cập nhật updated_at dùng chung
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Trigger tự động tạo profile khi tạo user trong auth.users
-- Tài khoản do Edge Function của Admin tạo sẽ mang cờ app_metadata.created_by_admin = true.
-- Mọi tài khoản tự đăng ký đều là Thu ngân chờ kích hoạt. Chủ quán gán Admin
-- cho tài khoản của mình trong SQL Editor; không tự cấp Admin theo thứ tự đăng ký.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT := 'cashier';
  v_active BOOLEAN := false;
  v_full_name TEXT;
  v_created_by_admin BOOLEAN := false;
BEGIN
  v_created_by_admin := COALESCE((NEW.raw_app_meta_data->>'created_by_admin')::BOOLEAN, false);

  v_full_name := COALESCE(
    NULLIF(trim(NEW.raw_user_meta_data->>'full_name'), ''),
    split_part(COALESCE(NEW.email, 'user'), '@', 1)
  );

  IF v_created_by_admin THEN
    v_role := CASE
      WHEN (NEW.raw_app_meta_data->>'role') IN ('admin', 'cashier')
        THEN NEW.raw_app_meta_data->>'role'
      ELSE 'cashier'
    END;
    v_active := true;
  ELSE
    v_role := 'cashier';
    v_active := false;
  END IF;

  INSERT INTO public.profiles (id, email, full_name, role, is_active)
  VALUES (NEW.id, COALESCE(NEW.email, NEW.id::TEXT), v_full_name, v_role, v_active)
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- 2. LOẠI BÀN & BẢNG GIÁ / QUY TẮC LÀM TRÒN
CREATE TABLE IF NOT EXISTS public.table_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  hourly_rate INTEGER NOT NULL CHECK (hourly_rate >= 0),
  rounding_minutes INTEGER NOT NULL DEFAULT 15 CHECK (rounding_minutes IN (1, 5, 10, 15, 30, 60)),
  rounding_mode TEXT NOT NULL DEFAULT 'ceil' CHECK (rounding_mode IN ('exact', 'ceil', 'round')),
  min_minutes INTEGER NOT NULL DEFAULT 0 CHECK (min_minutes >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_table_types_updated_at ON public.table_types;
CREATE TRIGGER trg_table_types_updated_at
  BEFORE UPDATE ON public.table_types
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. DANH SÁCH 5 BÀN BI-A
CREATE TABLE IF NOT EXISTS public.billiard_tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_number INTEGER NOT NULL UNIQUE CHECK (table_number > 0),
  name TEXT NOT NULL,
  table_type_id UUID NOT NULL REFERENCES public.table_types(id) ON DELETE RESTRICT,
  custom_hourly_rate INTEGER CHECK (custom_hourly_rate IS NULL OR custom_hourly_rate >= 0),
  custom_rounding_minutes INTEGER CHECK (custom_rounding_minutes IS NULL OR custom_rounding_minutes IN (1, 5, 10, 15, 30, 60)),
  custom_rounding_mode TEXT CHECK (custom_rounding_mode IS NULL OR custom_rounding_mode IN ('exact', 'ceil', 'round')),
  custom_min_minutes INTEGER CHECK (custom_min_minutes IS NULL OR custom_min_minutes >= 0),
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'playing', 'maintenance')),
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_billiard_tables_updated_at ON public.billiard_tables;
CREATE TRIGGER trg_billiard_tables_updated_at
  BEFORE UPDATE ON public.billiard_tables
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4. THỰC ĐƠN ĐỒ UỐNG & ĐỒ ĂN
CREATE TABLE IF NOT EXISTS public.menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Đồ uống' CHECK (category IN ('Đồ uống', 'Đồ ăn', 'Khác')),
  unit TEXT NOT NULL DEFAULT 'Phần',
  price INTEGER NOT NULL CHECK (price >= 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_menu_items_updated_at ON public.menu_items;
CREATE TRIGGER trg_menu_items_updated_at
  BEFORE UPDATE ON public.menu_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5. CA LÀM VIỆC & ĐỐI SOÁT TIỀN
CREATE TABLE IF NOT EXISTS public.shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opened_by UUID NOT NULL REFERENCES public.profiles(id),
  opened_by_name TEXT NOT NULL,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  opening_cash INTEGER NOT NULL DEFAULT 0 CHECK (opening_cash >= 0),
  closed_by UUID REFERENCES public.profiles(id),
  closed_by_name TEXT,
  closed_at TIMESTAMPTZ,
  actual_cash INTEGER CHECK (actual_cash IS NULL OR actual_cash >= 0),
  expected_cash INTEGER,
  cash_revenue INTEGER NOT NULL DEFAULT 0,
  transfer_revenue INTEGER NOT NULL DEFAULT 0,
  table_revenue INTEGER NOT NULL DEFAULT 0,
  items_revenue INTEGER NOT NULL DEFAULT 0,
  discount_total INTEGER NOT NULL DEFAULT 0,
  cash_difference INTEGER,
  notes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Chỉ cho phép tối đa 1 ca đang mở tại một thời điểm
CREATE UNIQUE INDEX IF NOT EXISTS idx_shifts_single_open
  ON public.shifts ((1))
  WHERE status = 'open';

DROP TRIGGER IF EXISTS trg_shifts_updated_at ON public.shifts;
CREATE TRIGGER trg_shifts_updated_at
  BEFORE UPDATE ON public.shifts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 6. PHIÊN CHƠI (SNAPSHOT GIÁ & QUY TẮC TẠI THỜI ĐIỂM MỞ)
CREATE TABLE IF NOT EXISTS public.sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id UUID NOT NULL REFERENCES public.billiard_tables(id),
  table_name_snapshot TEXT NOT NULL,
  table_type_snapshot TEXT NOT NULL,
  opened_by UUID NOT NULL REFERENCES public.profiles(id),
  opened_by_name TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  hourly_rate_snapshot INTEGER NOT NULL CHECK (hourly_rate_snapshot >= 0),
  rounding_minutes_snapshot INTEGER NOT NULL CHECK (rounding_minutes_snapshot IN (1, 5, 10, 15, 30, 60)),
  rounding_mode_snapshot TEXT NOT NULL CHECK (rounding_mode_snapshot IN ('exact', 'ceil', 'round')),
  min_minutes_snapshot INTEGER NOT NULL DEFAULT 0 CHECK (min_minutes_snapshot >= 0),
  notes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ràng buộc cứng: không cho mở 2 phiên đồng thời trên cùng 1 bàn
CREATE UNIQUE INDEX IF NOT EXISTS idx_sessions_one_open_per_table
  ON public.sessions (table_id)
  WHERE status = 'open';

DROP TRIGGER IF EXISTS trg_sessions_updated_at ON public.sessions;
CREATE TRIGGER trg_sessions_updated_at
  BEFORE UPDATE ON public.sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 7. MÓN ĐÃ GỌI TRONG PHIÊN CHƠI
CREATE TABLE IF NOT EXISTS public.session_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  menu_item_id UUID REFERENCES public.menu_items(id) ON DELETE SET NULL,
  item_name_snapshot TEXT NOT NULL,
  unit_snapshot TEXT NOT NULL,
  unit_price_snapshot INTEGER NOT NULL CHECK (unit_price_snapshot >= 0),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  added_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_session_items_updated_at ON public.session_items;
CREATE TRIGGER trg_session_items_updated_at
  BEFORE UPDATE ON public.session_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 8. LỊCH SỬ CHUYỂN BÀN
CREATE TABLE IF NOT EXISTS public.session_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  from_table_id UUID NOT NULL REFERENCES public.billiard_tables(id),
  from_table_name TEXT NOT NULL,
  to_table_id UUID NOT NULL REFERENCES public.billiard_tables(id),
  to_table_name TEXT NOT NULL,
  transferred_by UUID NOT NULL REFERENCES public.profiles(id),
  transferred_by_name TEXT NOT NULL,
  transferred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  note TEXT NOT NULL DEFAULT ''
);

-- 9. HÓA ĐƠN THANH TOÁN (KHÔNG CHO XÓA)
CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_code TEXT NOT NULL UNIQUE,
  session_id UUID NOT NULL UNIQUE REFERENCES public.sessions(id),
  shift_id UUID NOT NULL REFERENCES public.shifts(id),
  table_id UUID NOT NULL REFERENCES public.billiard_tables(id),
  table_name TEXT NOT NULL,
  table_type_name TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ NOT NULL,
  duration_seconds INTEGER NOT NULL CHECK (duration_seconds >= 0),
  billed_minutes INTEGER NOT NULL CHECK (billed_minutes >= 0),
  hourly_rate_snapshot INTEGER NOT NULL CHECK (hourly_rate_snapshot >= 0),
  rounding_minutes_snapshot INTEGER NOT NULL,
  rounding_mode_snapshot TEXT NOT NULL,
  min_minutes_snapshot INTEGER NOT NULL DEFAULT 0,
  table_fee INTEGER NOT NULL CHECK (table_fee >= 0),
  items_fee INTEGER NOT NULL CHECK (items_fee >= 0),
  discount_amount INTEGER NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  total_amount INTEGER NOT NULL CHECK (total_amount >= 0),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'transfer')),
  cashier_id UUID NOT NULL REFERENCES public.profiles(id),
  cashier_name TEXT NOT NULL,
  paid_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'paid' CHECK (status IN ('paid', 'adjusted', 'voided')),
  note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoices_paid_at ON public.invoices (paid_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_shift_id ON public.invoices (shift_id);
CREATE INDEX IF NOT EXISTS idx_invoices_table_id ON public.invoices (table_id);

DROP TRIGGER IF EXISTS trg_invoices_updated_at ON public.invoices;
CREATE TRIGGER trg_invoices_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 10. CHI TIẾT MÓN TRÊN HÓA ĐƠN
CREATE TABLE IF NOT EXISTS public.invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE RESTRICT,
  menu_item_id UUID REFERENCES public.menu_items(id) ON DELETE SET NULL,
  item_name TEXT NOT NULL,
  unit TEXT NOT NULL,
  unit_price INTEGER NOT NULL CHECK (unit_price >= 0),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  line_total INTEGER NOT NULL CHECK (line_total >= 0)
);

CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON public.invoice_items (invoice_id);

-- 11. NHẬT KÝ GIẢM GIÁ / SỬA / HỦY HÓA ĐƠN (CHỈ ADMIN)
CREATE TABLE IF NOT EXISTS public.invoice_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE RESTRICT,
  action_type TEXT NOT NULL CHECK (action_type IN ('discount', 'edit', 'void')),
  reason TEXT NOT NULL CHECK (length(trim(reason)) >= 3),
  previous_table_fee INTEGER NOT NULL,
  previous_items_fee INTEGER NOT NULL,
  previous_discount INTEGER NOT NULL,
  previous_total INTEGER NOT NULL,
  previous_payment_method TEXT NOT NULL,
  previous_status TEXT NOT NULL,
  new_table_fee INTEGER NOT NULL,
  new_items_fee INTEGER NOT NULL,
  new_discount INTEGER NOT NULL,
  new_total INTEGER NOT NULL,
  new_payment_method TEXT NOT NULL,
  new_status TEXT NOT NULL,
  adjusted_by UUID NOT NULL REFERENCES public.profiles(id),
  adjusted_by_name TEXT NOT NULL,
  adjusted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoice_adjustments_invoice_id ON public.invoice_adjustments (invoice_id);


-- ============================================================================
-- HÀM TÍNH TIỀN GIỜ CHƠI (ĐỒNG BỘ VỚI FRONTEND src/utils/pricing.js)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.calculate_table_fee(
  p_started_at TIMESTAMPTZ,
  p_ended_at TIMESTAMPTZ,
  p_hourly_rate INTEGER,
  p_rounding_minutes INTEGER,
  p_rounding_mode TEXT,
  p_min_minutes INTEGER
)
RETURNS TABLE (
  duration_seconds INTEGER,
  billed_minutes INTEGER,
  table_fee INTEGER
)
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_seconds INTEGER;
  v_elapsed_mins INTEGER;
  v_step INTEGER;
  v_billed INTEGER;
BEGIN
  v_seconds := GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (p_ended_at - p_started_at)))::INTEGER);

  IF v_seconds = 0 THEN
    RETURN QUERY SELECT 0, 0, 0;
    RETURN;
  END IF;

  v_elapsed_mins := GREATEST(1, CEIL(v_seconds / 60.0)::INTEGER);
  v_step := GREATEST(1, COALESCE(p_rounding_minutes, 15));

  IF p_rounding_mode = 'exact' THEN
    v_billed := v_elapsed_mins;
  ELSIF p_rounding_mode = 'round' THEN
    v_billed := GREATEST(v_step, (ROUND(v_elapsed_mins::NUMERIC / v_step) * v_step)::INTEGER);
  ELSE
    -- Mặc định: 'ceil' (làm tròn lên theo block phút)
    v_billed := (CEIL(v_elapsed_mins::NUMERIC / v_step) * v_step)::INTEGER;
  END IF;

  v_billed := GREATEST(v_billed, COALESCE(p_min_minutes, 0));

  RETURN QUERY SELECT
    v_seconds,
    v_billed,
    ROUND((v_billed::NUMERIC * p_hourly_rate::NUMERIC) / 60.0)::INTEGER;
END;
$$;


-- ============================================================================
-- BẬT ROW LEVEL SECURITY (RLS) & CHÍNH SÁCH PHÂN QUYỀN
-- ============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.table_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billiard_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_adjustments ENABLE ROW LEVEL SECURITY;

-- PROFILES
DROP POLICY IF EXISTS profiles_select ON public.profiles;
CREATE POLICY profiles_select ON public.profiles
  FOR SELECT USING (id = auth.uid() OR public.is_admin());

-- TABLE TYPES (Staff đọc; chỉ Admin sửa)
DROP POLICY IF EXISTS table_types_select ON public.table_types;
CREATE POLICY table_types_select ON public.table_types
  FOR SELECT USING (public.is_staff());

DROP POLICY IF EXISTS table_types_insert ON public.table_types;
CREATE POLICY table_types_insert ON public.table_types
  FOR INSERT WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS table_types_update ON public.table_types;
CREATE POLICY table_types_update ON public.table_types
  FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS table_types_delete ON public.table_types;
CREATE POLICY table_types_delete ON public.table_types
  FOR DELETE USING (public.is_admin());

-- BILLIARD TABLES (Staff đọc; chỉ Admin sửa thông tin bàn/giá/bảo trì; mở/đóng bàn qua RPC)
DROP POLICY IF EXISTS billiard_tables_select ON public.billiard_tables;
CREATE POLICY billiard_tables_select ON public.billiard_tables
  FOR SELECT USING (public.is_staff());

DROP POLICY IF EXISTS billiard_tables_insert ON public.billiard_tables;
CREATE POLICY billiard_tables_insert ON public.billiard_tables
  FOR INSERT WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS billiard_tables_update ON public.billiard_tables;
CREATE POLICY billiard_tables_update ON public.billiard_tables
  FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

-- MENU ITEMS (Staff đọc; chỉ Admin thêm/sửa/xóa)
DROP POLICY IF EXISTS menu_items_select ON public.menu_items;
CREATE POLICY menu_items_select ON public.menu_items
  FOR SELECT USING (public.is_staff());

DROP POLICY IF EXISTS menu_items_insert ON public.menu_items;
CREATE POLICY menu_items_insert ON public.menu_items
  FOR INSERT WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS menu_items_update ON public.menu_items;
CREATE POLICY menu_items_update ON public.menu_items
  FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS menu_items_delete ON public.menu_items;
CREATE POLICY menu_items_delete ON public.menu_items
  FOR DELETE USING (public.is_admin());

-- SHIFTS (Admin xem tất cả; Thu ngân chỉ xem ca đang mở hoặc ca của chính mình)
DROP POLICY IF EXISTS shifts_select ON public.shifts;
CREATE POLICY shifts_select ON public.shifts
  FOR SELECT USING (
    public.is_admin()
    OR (
      public.is_staff()
      AND (status = 'open' OR opened_by = auth.uid() OR closed_by = auth.uid())
    )
  );

-- SESSIONS, SESSION_ITEMS, SESSION_TRANSFERS (Staff xem; ghi qua RPC đã kiểm tra chặt)
DROP POLICY IF EXISTS sessions_select ON public.sessions;
CREATE POLICY sessions_select ON public.sessions
  FOR SELECT USING (public.is_staff());

DROP POLICY IF EXISTS session_items_select ON public.session_items;
CREATE POLICY session_items_select ON public.session_items
  FOR SELECT USING (public.is_staff());

DROP POLICY IF EXISTS session_transfers_select ON public.session_transfers;
CREATE POLICY session_transfers_select ON public.session_transfers
  FOR SELECT USING (public.is_staff());

-- INVOICES (Admin xem toàn bộ; Thu ngân xem hóa đơn do mình thu hoặc trong ca đang mở / ca của mình; CẤM DELETE)
DROP POLICY IF EXISTS invoices_select ON public.invoices;
CREATE POLICY invoices_select ON public.invoices
  FOR SELECT USING (
    public.is_admin()
    OR (
      public.is_staff()
      AND (
        cashier_id = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM public.shifts sh
          WHERE sh.id = invoices.shift_id
            AND (sh.status = 'open' OR sh.opened_by = auth.uid())
        )
      )
    )
  );

DROP POLICY IF EXISTS invoice_items_select ON public.invoice_items;
CREATE POLICY invoice_items_select ON public.invoice_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.invoices inv WHERE inv.id = invoice_items.invoice_id
    )
  );

DROP POLICY IF EXISTS invoice_adjustments_select ON public.invoice_adjustments;
CREATE POLICY invoice_adjustments_select ON public.invoice_adjustments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.invoices inv WHERE inv.id = invoice_adjustments.invoice_id
    )
  );


-- ============================================================================
-- RPC NGHIỆP VỤ (ATOMIC & KIỂM TRA QUYỀN TẠI DATABASE)
-- ============================================================================

-- 1. Mở ca làm việc
CREATE OR REPLACE FUNCTION public.open_shift(
  p_opening_cash INTEGER,
  p_notes TEXT DEFAULT ''
)
RETURNS public.shifts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile public.profiles;
  v_shift public.shifts;
BEGIN
  IF NOT public.is_staff() THEN
    RAISE EXCEPTION 'Bạn không có quyền thực hiện thao tác này.';
  END IF;

  IF p_opening_cash IS NULL OR p_opening_cash < 0 THEN
    RAISE EXCEPTION 'Số tiền mặt đầu ca không hợp lệ.';
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE id = auth.uid();

  IF EXISTS (SELECT 1 FROM public.shifts WHERE status = 'open') THEN
    RAISE EXCEPTION 'Hiện đang có một ca làm chưa chốt. Vui lòng chốt ca trước khi mở ca mới.';
  END IF;

  INSERT INTO public.shifts (opened_by, opened_by_name, opening_cash, notes, status)
  VALUES (v_profile.id, v_profile.full_name, p_opening_cash, COALESCE(p_notes, ''), 'open')
  RETURNING * INTO v_shift;

  RETURN v_shift;
END;
$$;

-- 2. Tạm tính doanh thu cho 1 ca làm (dùng cho ca đang mở hoặc cập nhật lại ca đã đóng)
CREATE OR REPLACE FUNCTION public.get_shift_live_summary(p_shift_id UUID)
RETURNS TABLE (
  invoice_count INTEGER,
  voided_count INTEGER,
  cash_revenue INTEGER,
  transfer_revenue INTEGER,
  table_revenue INTEGER,
  items_revenue INTEGER,
  discount_total INTEGER
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shift public.shifts;
BEGIN
  IF NOT public.is_staff() THEN
    RAISE EXCEPTION 'Không có quyền truy cập.';
  END IF;

  SELECT * INTO v_shift FROM public.shifts WHERE id = p_shift_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Không tìm thấy ca làm.';
  END IF;

  IF NOT public.is_admin()
     AND v_shift.status <> 'open'
     AND v_shift.opened_by <> auth.uid()
     AND v_shift.closed_by IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Bạn chỉ được xem doanh thu ca của mình.';
  END IF;

  RETURN QUERY
  SELECT
    COUNT(*) FILTER (WHERE status <> 'voided')::INTEGER,
    COUNT(*) FILTER (WHERE status = 'voided')::INTEGER,
    COALESCE(SUM(total_amount) FILTER (WHERE status <> 'voided' AND payment_method = 'cash'), 0)::INTEGER,
    COALESCE(SUM(total_amount) FILTER (WHERE status <> 'voided' AND payment_method = 'transfer'), 0)::INTEGER,
    COALESCE(SUM(table_fee) FILTER (WHERE status <> 'voided'), 0)::INTEGER,
    COALESCE(SUM(items_fee) FILTER (WHERE status <> 'voided'), 0)::INTEGER,
    COALESCE(SUM(discount_amount) FILTER (WHERE status <> 'voided'), 0)::INTEGER
  FROM public.invoices
  WHERE shift_id = p_shift_id;
END;
$$;

-- 3. Chốt ca làm việc & đối soát tiền mặt
CREATE OR REPLACE FUNCTION public.close_shift(
  p_shift_id UUID,
  p_actual_cash INTEGER,
  p_notes TEXT DEFAULT ''
)
RETURNS public.shifts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile public.profiles;
  v_shift public.shifts;
  v_cash_rev INTEGER := 0;
  v_transfer_rev INTEGER := 0;
  v_table_rev INTEGER := 0;
  v_items_rev INTEGER := 0;
  v_discount_total INTEGER := 0;
  v_expected_cash INTEGER := 0;
BEGIN
  IF NOT public.is_staff() THEN
    RAISE EXCEPTION 'Không có quyền thực hiện thao tác này.';
  END IF;

  IF p_actual_cash IS NULL OR p_actual_cash < 0 THEN
    RAISE EXCEPTION 'Số tiền mặt thực đếm không hợp lệ.';
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE id = auth.uid();
  SELECT * INTO v_shift FROM public.shifts WHERE id = p_shift_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Không tìm thấy ca làm.';
  END IF;

  IF v_shift.status <> 'open' THEN
    RAISE EXCEPTION 'Ca làm này đã được chốt trước đó.';
  END IF;

  SELECT
    COALESCE(SUM(total_amount) FILTER (WHERE status <> 'voided' AND payment_method = 'cash'), 0)::INTEGER,
    COALESCE(SUM(total_amount) FILTER (WHERE status <> 'voided' AND payment_method = 'transfer'), 0)::INTEGER,
    COALESCE(SUM(table_fee) FILTER (WHERE status <> 'voided'), 0)::INTEGER,
    COALESCE(SUM(items_fee) FILTER (WHERE status <> 'voided'), 0)::INTEGER,
    COALESCE(SUM(discount_amount) FILTER (WHERE status <> 'voided'), 0)::INTEGER
  INTO v_cash_rev, v_transfer_rev, v_table_rev, v_items_rev, v_discount_total
  FROM public.invoices
  WHERE shift_id = p_shift_id;

  v_expected_cash := v_shift.opening_cash + v_cash_rev;

  UPDATE public.shifts
  SET
    closed_by = v_profile.id,
    closed_by_name = v_profile.full_name,
    closed_at = now(),
    actual_cash = p_actual_cash,
    expected_cash = v_expected_cash,
    cash_revenue = v_cash_rev,
    transfer_revenue = v_transfer_rev,
    table_revenue = v_table_rev,
    items_revenue = v_items_rev,
    discount_total = v_discount_total,
    cash_difference = p_actual_cash - v_expected_cash,
    notes = CASE
      WHEN trim(COALESCE(p_notes, '')) = '' THEN v_shift.notes
      WHEN trim(v_shift.notes) = '' THEN trim(p_notes)
      ELSE v_shift.notes || E'\n' || trim(p_notes)
    END,
    status = 'closed'
  WHERE id = p_shift_id
  RETURNING * INTO v_shift;

  RETURN v_shift;
END;
$$;

-- 4. Mở phiên chơi cho bàn trống
CREATE OR REPLACE FUNCTION public.open_table_session(
  p_table_id UUID,
  p_notes TEXT DEFAULT ''
)
RETURNS public.sessions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile public.profiles;
  v_table public.billiard_tables;
  v_type public.table_types;
  v_open_shift UUID;
  v_rate INTEGER;
  v_round_min INTEGER;
  v_round_mode TEXT;
  v_min_min INTEGER;
  v_session public.sessions;
BEGIN
  IF NOT public.is_staff() THEN
    RAISE EXCEPTION 'Bạn không có quyền mở bàn.';
  END IF;

  SELECT id INTO v_open_shift FROM public.shifts WHERE status = 'open' LIMIT 1;
  IF v_open_shift IS NULL THEN
    RAISE EXCEPTION 'Chưa có ca làm đang mở. Vui lòng mở ca trước khi mở bàn.';
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE id = auth.uid();
  SELECT * INTO v_table FROM public.billiard_tables WHERE id = p_table_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Không tìm thấy bàn.';
  END IF;

  IF v_table.status = 'maintenance' THEN
    RAISE EXCEPTION 'Bàn đang ở trạng thái bảo trì, không thể mở phiên.';
  END IF;

  IF v_table.status = 'playing'
     OR EXISTS (SELECT 1 FROM public.sessions WHERE table_id = p_table_id AND status = 'open') THEN
    RAISE EXCEPTION 'Bàn này đang có người chơi, không thể mở hai phiên đồng thời.';
  END IF;

  SELECT * INTO v_type FROM public.table_types WHERE id = v_table.table_type_id;

  v_rate := COALESCE(v_table.custom_hourly_rate, v_type.hourly_rate);
  v_round_min := COALESCE(v_table.custom_rounding_minutes, v_type.rounding_minutes);
  v_round_mode := COALESCE(v_table.custom_rounding_mode, v_type.rounding_mode);
  v_min_min := COALESCE(v_table.custom_min_minutes, v_type.min_minutes);

  INSERT INTO public.sessions (
    table_id,
    table_name_snapshot,
    table_type_snapshot,
    opened_by,
    opened_by_name,
    hourly_rate_snapshot,
    rounding_minutes_snapshot,
    rounding_mode_snapshot,
    min_minutes_snapshot,
    notes,
    status
  )
  VALUES (
    v_table.id,
    v_table.name,
    v_type.name,
    v_profile.id,
    v_profile.full_name,
    v_rate,
    v_round_min,
    v_round_mode,
    v_min_min,
    COALESCE(p_notes, ''),
    'open'
  )
  RETURNING * INTO v_session;

  UPDATE public.billiard_tables
  SET status = 'playing'
  WHERE id = p_table_id;

  RETURN v_session;
END;
$$;

-- 5. Thêm / tăng số lượng món vào phiên đang chơi (lấy giá chuẩn từ menu_items)
CREATE OR REPLACE FUNCTION public.add_session_item(
  p_session_id UUID,
  p_menu_item_id UUID,
  p_quantity INTEGER DEFAULT 1
)
RETURNS public.session_items
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session public.sessions;
  v_menu public.menu_items;
  v_existing public.session_items;
  v_result public.session_items;
BEGIN
  IF NOT public.is_staff() THEN
    RAISE EXCEPTION 'Bạn không có quyền thêm món.';
  END IF;

  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'Số lượng phải lớn hơn 0.';
  END IF;

  SELECT * INTO v_session FROM public.sessions WHERE id = p_session_id FOR UPDATE;
  IF NOT FOUND OR v_session.status <> 'open' THEN
    RAISE EXCEPTION 'Phiên chơi không tồn tại hoặc đã đóng.';
  END IF;

  SELECT * INTO v_menu FROM public.menu_items WHERE id = p_menu_item_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Không tìm thấy món trong thực đơn.';
  END IF;

  IF NOT v_menu.is_active THEN
    RAISE EXCEPTION 'Món "%" hiện đã ngừng bán.', v_menu.name;
  END IF;

  SELECT * INTO v_existing
  FROM public.session_items
  WHERE session_id = p_session_id
    AND menu_item_id = p_menu_item_id
    AND unit_price_snapshot = v_menu.price
  LIMIT 1;

  IF FOUND THEN
    UPDATE public.session_items
    SET quantity = quantity + p_quantity
    WHERE id = v_existing.id
    RETURNING * INTO v_result;
  ELSE
    INSERT INTO public.session_items (
      session_id,
      menu_item_id,
      item_name_snapshot,
      unit_snapshot,
      unit_price_snapshot,
      quantity,
      added_by
    )
    VALUES (
      p_session_id,
      v_menu.id,
      v_menu.name,
      v_menu.unit,
      v_menu.price,
      p_quantity,
      auth.uid()
    )
    RETURNING * INTO v_result;
  END IF;

  RETURN v_result;
END;
$$;

-- 6. Cập nhật số lượng hoặc xóa món khỏi phiên đang chơi (quantity <= 0 sẽ xóa)
CREATE OR REPLACE FUNCTION public.set_session_item_quantity(
  p_session_item_id UUID,
  p_quantity INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item public.session_items;
  v_session public.sessions;
BEGIN
  IF NOT public.is_staff() THEN
    RAISE EXCEPTION 'Bạn không có quyền sửa món.';
  END IF;

  SELECT * INTO v_item FROM public.session_items WHERE id = p_session_item_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Không tìm thấy dòng món.';
  END IF;

  SELECT * INTO v_session FROM public.sessions WHERE id = v_item.session_id FOR UPDATE;
  IF v_session.status <> 'open' THEN
    RAISE EXCEPTION 'Phiên chơi đã đóng, không thể thay đổi món.';
  END IF;

  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    DELETE FROM public.session_items WHERE id = p_session_item_id;
  ELSE
    UPDATE public.session_items
    SET quantity = p_quantity
    WHERE id = p_session_item_id;
  END IF;
END;
$$;

-- 7. Chuyển bàn đang chơi (giờ bắt đầu và món đã gọi đi theo phiên)
CREATE OR REPLACE FUNCTION public.transfer_table_session(
  p_session_id UUID,
  p_to_table_id UUID,
  p_apply_target_pricing BOOLEAN DEFAULT false,
  p_note TEXT DEFAULT ''
)
RETURNS public.sessions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile public.profiles;
  v_session public.sessions;
  v_from_table public.billiard_tables;
  v_to_table public.billiard_tables;
  v_to_type public.table_types;
BEGIN
  IF NOT public.is_staff() THEN
    RAISE EXCEPTION 'Bạn không có quyền chuyển bàn.';
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE id = auth.uid();
  SELECT * INTO v_session FROM public.sessions WHERE id = p_session_id FOR UPDATE;

  IF NOT FOUND OR v_session.status <> 'open' THEN
    RAISE EXCEPTION 'Phiên chơi không tồn tại hoặc đã đóng.';
  END IF;

  IF v_session.table_id = p_to_table_id THEN
    RAISE EXCEPTION 'Bàn đích trùng với bàn hiện tại.';
  END IF;

  -- Khóa theo thứ tự UUID để tránh deadlock
  IF v_session.table_id < p_to_table_id THEN
    SELECT * INTO v_from_table FROM public.billiard_tables WHERE id = v_session.table_id FOR UPDATE;
    SELECT * INTO v_to_table FROM public.billiard_tables WHERE id = p_to_table_id FOR UPDATE;
  ELSE
    SELECT * INTO v_to_table FROM public.billiard_tables WHERE id = p_to_table_id FOR UPDATE;
    SELECT * INTO v_from_table FROM public.billiard_tables WHERE id = v_session.table_id FOR UPDATE;
  END IF;

  IF NOT FOUND OR v_to_table.id IS NULL THEN
    RAISE EXCEPTION 'Không tìm thấy bàn đích.';
  END IF;

  IF v_to_table.status <> 'available'
     OR EXISTS (SELECT 1 FROM public.sessions WHERE table_id = p_to_table_id AND status = 'open') THEN
    RAISE EXCEPTION 'Bàn đích không ở trạng thái Trống.';
  END IF;

  SELECT * INTO v_to_type FROM public.table_types WHERE id = v_to_table.table_type_id;

  UPDATE public.billiard_tables SET status = 'available' WHERE id = v_from_table.id;
  UPDATE public.billiard_tables SET status = 'playing' WHERE id = v_to_table.id;

  INSERT INTO public.session_transfers (
    session_id,
    from_table_id,
    from_table_name,
    to_table_id,
    to_table_name,
    transferred_by,
    transferred_by_name,
    note
  )
  VALUES (
    v_session.id,
    v_from_table.id,
    v_from_table.name,
    v_to_table.id,
    v_to_table.name,
    v_profile.id,
    v_profile.full_name,
    COALESCE(p_note, '')
  );

  UPDATE public.sessions
  SET
    table_id = v_to_table.id,
    table_name_snapshot = v_to_table.name,
    table_type_snapshot = v_to_type.name,
    hourly_rate_snapshot = CASE
      WHEN p_apply_target_pricing THEN COALESCE(v_to_table.custom_hourly_rate, v_to_type.hourly_rate)
      ELSE hourly_rate_snapshot
    END,
    rounding_minutes_snapshot = CASE
      WHEN p_apply_target_pricing THEN COALESCE(v_to_table.custom_rounding_minutes, v_to_type.rounding_minutes)
      ELSE rounding_minutes_snapshot
    END,
    rounding_mode_snapshot = CASE
      WHEN p_apply_target_pricing THEN COALESCE(v_to_table.custom_rounding_mode, v_to_type.rounding_mode)
      ELSE rounding_mode_snapshot
    END,
    min_minutes_snapshot = CASE
      WHEN p_apply_target_pricing THEN COALESCE(v_to_table.custom_min_minutes, v_to_type.min_minutes)
      ELSE min_minutes_snapshot
    END
  WHERE id = v_session.id
  RETURNING * INTO v_session;

  RETURN v_session;
END;
$$;

-- 8. Thanh toán & xuất hóa đơn (Atomic: tính tiền, lưu hóa đơn, đóng phiên, trả bàn trống)
CREATE OR REPLACE FUNCTION public.checkout_session(
  p_session_id UUID,
  p_payment_method TEXT,
  p_note TEXT DEFAULT ''
)
RETURNS public.invoices
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile public.profiles;
  v_shift_id UUID;
  v_session public.sessions;
  v_ended_at TIMESTAMPTZ := now();
  v_calc RECORD;
  v_items_fee INTEGER := 0;
  v_total INTEGER := 0;
  v_code_prefix TEXT;
  v_seq INTEGER;
  v_invoice_code TEXT;
  v_invoice public.invoices;
BEGIN
  IF NOT public.is_staff() THEN
    RAISE EXCEPTION 'Bạn không có quyền thanh toán.';
  END IF;

  IF p_payment_method NOT IN ('cash', 'transfer') THEN
    RAISE EXCEPTION 'Phương thức thanh toán phải là Tiền mặt hoặc Chuyển khoản.';
  END IF;

  SELECT id INTO v_shift_id FROM public.shifts WHERE status = 'open' LIMIT 1;
  IF v_shift_id IS NULL THEN
    RAISE EXCEPTION 'Chưa có ca làm đang mở. Vui lòng mở ca trước khi thu tiền.';
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE id = auth.uid();
  SELECT * INTO v_session FROM public.sessions WHERE id = p_session_id FOR UPDATE;

  IF NOT FOUND OR v_session.status <> 'open' THEN
    RAISE EXCEPTION 'Phiên chơi không tồn tại hoặc đã thanh toán trước đó.';
  END IF;

  PERFORM 1 FROM public.billiard_tables WHERE id = v_session.table_id FOR UPDATE;

  SELECT * INTO v_calc FROM public.calculate_table_fee(
    v_session.started_at,
    v_ended_at,
    v_session.hourly_rate_snapshot,
    v_session.rounding_minutes_snapshot,
    v_session.rounding_mode_snapshot,
    v_session.min_minutes_snapshot
  );

  SELECT COALESCE(SUM(unit_price_snapshot * quantity), 0)::INTEGER
  INTO v_items_fee
  FROM public.session_items
  WHERE session_id = p_session_id;

  v_total := v_calc.table_fee + v_items_fee;

  -- Sinh mã hóa đơn theo ngày giờ Việt Nam
  PERFORM pg_advisory_xact_lock(77665544);
  v_code_prefix := 'HD-' || to_char(v_ended_at AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYYMMDD') || '-';
  SELECT COALESCE(MAX(NULLIF(split_part(invoice_code, '-', 3), '')::INTEGER), 0) + 1
  INTO v_seq
  FROM public.invoices
  WHERE invoice_code LIKE v_code_prefix || '%';
  v_invoice_code := v_code_prefix || lpad(v_seq::TEXT, 4, '0');

  INSERT INTO public.invoices (
    invoice_code,
    session_id,
    shift_id,
    table_id,
    table_name,
    table_type_name,
    started_at,
    ended_at,
    duration_seconds,
    billed_minutes,
    hourly_rate_snapshot,
    rounding_minutes_snapshot,
    rounding_mode_snapshot,
    min_minutes_snapshot,
    table_fee,
    items_fee,
    discount_amount,
    total_amount,
    payment_method,
    cashier_id,
    cashier_name,
    paid_at,
    status,
    note
  )
  VALUES (
    v_invoice_code,
    v_session.id,
    v_shift_id,
    v_session.table_id,
    v_session.table_name_snapshot,
    v_session.table_type_snapshot,
    v_session.started_at,
    v_ended_at,
    v_calc.duration_seconds,
    v_calc.billed_minutes,
    v_session.hourly_rate_snapshot,
    v_session.rounding_minutes_snapshot,
    v_session.rounding_mode_snapshot,
    v_session.min_minutes_snapshot,
    v_calc.table_fee,
    v_items_fee,
    0,
    v_total,
    p_payment_method,
    v_profile.id,
    v_profile.full_name,
    v_ended_at,
    'paid',
    COALESCE(NULLIF(trim(p_note), ''), v_session.notes)
  )
  RETURNING * INTO v_invoice;

  INSERT INTO public.invoice_items (
    invoice_id,
    menu_item_id,
    item_name,
    unit,
    unit_price,
    quantity,
    line_total
  )
  SELECT
    v_invoice.id,
    menu_item_id,
    item_name_snapshot,
    unit_snapshot,
    unit_price_snapshot,
    quantity,
    unit_price_snapshot * quantity
  FROM public.session_items
  WHERE session_id = p_session_id;

  UPDATE public.sessions
  SET status = 'closed', ended_at = v_ended_at
  WHERE id = p_session_id;

  UPDATE public.billiard_tables
  SET status = 'available'
  WHERE id = v_session.table_id;

  RETURN v_invoice;
END;
$$;

-- 9. Giảm giá, sửa hoặc hủy giao dịch đã thanh toán (CHỈ ADMIN + BẮT BUỘC LÝ DO)
CREATE OR REPLACE FUNCTION public.admin_adjust_invoice(
  p_invoice_id UUID,
  p_action_type TEXT,
  p_reason TEXT,
  p_discount_amount INTEGER DEFAULT NULL,
  p_table_fee INTEGER DEFAULT NULL,
  p_items_fee INTEGER DEFAULT NULL,
  p_payment_method TEXT DEFAULT NULL
)
RETURNS public.invoices
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin public.profiles;
  v_inv public.invoices;
  v_shift public.shifts;
  v_new_table_fee INTEGER;
  v_new_items_fee INTEGER;
  v_new_discount INTEGER;
  v_new_total INTEGER;
  v_new_method TEXT;
  v_new_status TEXT;
  v_cash_rev INTEGER;
  v_transfer_rev INTEGER;
  v_table_rev INTEGER;
  v_items_rev INTEGER;
  v_discount_total INTEGER;
  v_expected_cash INTEGER;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Chỉ Admin mới được giảm giá, sửa hoặc hủy hóa đơn đã thanh toán.';
  END IF;

  IF p_action_type NOT IN ('discount', 'edit', 'void') THEN
    RAISE EXCEPTION 'Loại điều chỉnh không hợp lệ.';
  END IF;

  IF length(trim(COALESCE(p_reason, ''))) < 3 THEN
    RAISE EXCEPTION 'Vui lòng nhập lý do điều chỉnh (tối thiểu 3 ký tự).';
  END IF;

  SELECT * INTO v_admin FROM public.profiles WHERE id = auth.uid();
  SELECT * INTO v_inv FROM public.invoices WHERE id = p_invoice_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Không tìm thấy hóa đơn.';
  END IF;

  IF v_inv.status = 'voided' THEN
    RAISE EXCEPTION 'Hóa đơn này đã bị hủy trước đó.';
  END IF;

  IF p_action_type = 'void' THEN
    v_new_table_fee := v_inv.table_fee;
    v_new_items_fee := v_inv.items_fee;
    v_new_discount := v_inv.discount_amount;
    v_new_total := 0;
    v_new_method := v_inv.payment_method;
    v_new_status := 'voided';
  ELSE
    v_new_table_fee := GREATEST(0, COALESCE(p_table_fee, v_inv.table_fee));
    v_new_items_fee := GREATEST(0, COALESCE(p_items_fee, v_inv.items_fee));
    v_new_discount := GREATEST(0, COALESCE(p_discount_amount, v_inv.discount_amount));
    v_new_method := COALESCE(p_payment_method, v_inv.payment_method);

    IF v_new_method NOT IN ('cash', 'transfer') THEN
      RAISE EXCEPTION 'Phương thức thanh toán không hợp lệ.';
    END IF;

    IF v_new_discount > (v_new_table_fee + v_new_items_fee) THEN
      RAISE EXCEPTION 'Số tiền giảm giá không được vượt quá tổng tiền hóa đơn.';
    END IF;

    v_new_total := GREATEST(0, v_new_table_fee + v_new_items_fee - v_new_discount);
    v_new_status := 'adjusted';
  END IF;

  INSERT INTO public.invoice_adjustments (
    invoice_id,
    action_type,
    reason,
    previous_table_fee,
    previous_items_fee,
    previous_discount,
    previous_total,
    previous_payment_method,
    previous_status,
    new_table_fee,
    new_items_fee,
    new_discount,
    new_total,
    new_payment_method,
    new_status,
    adjusted_by,
    adjusted_by_name
  )
  VALUES (
    v_inv.id,
    p_action_type,
    trim(p_reason),
    v_inv.table_fee,
    v_inv.items_fee,
    v_inv.discount_amount,
    v_inv.total_amount,
    v_inv.payment_method,
    v_inv.status,
    v_new_table_fee,
    v_new_items_fee,
    v_new_discount,
    v_new_total,
    v_new_method,
    v_new_status,
    v_admin.id,
    v_admin.full_name
  );

  UPDATE public.invoices
  SET
    table_fee = v_new_table_fee,
    items_fee = v_new_items_fee,
    discount_amount = v_new_discount,
    total_amount = v_new_total,
    payment_method = v_new_method,
    status = v_new_status
  WHERE id = v_inv.id
  RETURNING * INTO v_inv;

  -- Nếu ca chứa hóa đơn này đã chốt, cập nhật lại số liệu đối soát của ca đó
  SELECT * INTO v_shift FROM public.shifts WHERE id = v_inv.shift_id FOR UPDATE;
  IF FOUND AND v_shift.status = 'closed' THEN
    SELECT
      COALESCE(SUM(total_amount) FILTER (WHERE status <> 'voided' AND payment_method = 'cash'), 0)::INTEGER,
      COALESCE(SUM(total_amount) FILTER (WHERE status <> 'voided' AND payment_method = 'transfer'), 0)::INTEGER,
      COALESCE(SUM(table_fee) FILTER (WHERE status <> 'voided'), 0)::INTEGER,
      COALESCE(SUM(items_fee) FILTER (WHERE status <> 'voided'), 0)::INTEGER,
      COALESCE(SUM(discount_amount) FILTER (WHERE status <> 'voided'), 0)::INTEGER
    INTO v_cash_rev, v_transfer_rev, v_table_rev, v_items_rev, v_discount_total
    FROM public.invoices
    WHERE shift_id = v_shift.id;

    v_expected_cash := v_shift.opening_cash + v_cash_rev;

    UPDATE public.shifts
    SET
      cash_revenue = v_cash_rev,
      transfer_revenue = v_transfer_rev,
      table_revenue = v_table_rev,
      items_revenue = v_items_rev,
      discount_total = v_discount_total,
      expected_cash = v_expected_cash,
      cash_difference = COALESCE(v_shift.actual_cash, 0) - v_expected_cash
    WHERE id = v_shift.id;
  END IF;

  RETURN v_inv;
END;
$$;

-- 10. Quản lý tài khoản (CHỈ ADMIN)
CREATE OR REPLACE FUNCTION public.admin_update_profile(
  p_profile_id UUID,
  p_full_name TEXT,
  p_role TEXT,
  p_is_active BOOLEAN
)
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile public.profiles;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Chỉ Admin mới có quyền quản lý tài khoản.';
  END IF;

  IF p_role NOT IN ('admin', 'cashier') THEN
    RAISE EXCEPTION 'Vai trò không hợp lệ.';
  END IF;

  IF length(trim(COALESCE(p_full_name, ''))) < 2 THEN
    RAISE EXCEPTION 'Họ tên phải có ít nhất 2 ký tự.';
  END IF;

  IF p_profile_id = auth.uid() AND (p_role <> 'admin' OR NOT p_is_active) THEN
    RAISE EXCEPTION 'Không thể tự hạ quyền hoặc tự khóa tài khoản Admin đang đăng nhập.';
  END IF;

  UPDATE public.profiles
  SET
    full_name = trim(p_full_name),
    role = p_role,
    is_active = p_is_active
  WHERE id = p_profile_id
  RETURNING * INTO v_profile;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Không tìm thấy tài khoản.';
  END IF;

  RETURN v_profile;
END;
$$;


-- ============================================================================
-- DỮ LIỆU KHỞI TẠO MẶC ĐỊNH (5 BÀN & THỰC ĐƠN MẪU)
-- ============================================================================
INSERT INTO public.table_types (name, hourly_rate, rounding_minutes, rounding_mode, min_minutes)
VALUES
  ('Bàn Lỗ Thường', 50000, 15, 'ceil', 0),
  ('Bàn Lỗ VIP', 70000, 15, 'ceil', 0)
ON CONFLICT (name) DO NOTHING;

DO $$
DECLARE
  v_normal_id UUID;
  v_vip_id UUID;
BEGIN
  SELECT id INTO v_normal_id FROM public.table_types WHERE name = 'Bàn Lỗ Thường' LIMIT 1;
  SELECT id INTO v_vip_id FROM public.table_types WHERE name = 'Bàn Lỗ VIP' LIMIT 1;

  INSERT INTO public.billiard_tables (table_number, name, table_type_id, status)
  VALUES
    (1, 'Bàn 1', v_normal_id, 'available'),
    (2, 'Bàn 2', v_normal_id, 'available'),
    (3, 'Bàn 3', v_normal_id, 'available'),
    (4, 'Bàn 4', v_vip_id, 'available'),
    (5, 'Bàn 5', v_vip_id, 'available')
  ON CONFLICT (table_number) DO NOTHING;
END $$;

INSERT INTO public.menu_items (name, category, unit, price, is_active, sort_order)
SELECT v.name, v.category, v.unit, v.price, true, v.sort_order
FROM (VALUES
  ('Sting dâu', 'Đồ uống', 'Chai', 15000, 1),
  ('Bò húc (Red Bull)', 'Đồ uống', 'Lon', 20000, 2),
  ('Coca-Cola', 'Đồ uống', 'Lon', 15000, 3),
  ('Nước suối Aquafina', 'Đồ uống', 'Chai', 10000, 4),
  ('Trà đá / Trà chanh', 'Đồ uống', 'Ly', 12000, 5),
  ('Cà phê sữa đá', 'Đồ uống', 'Ly', 22000, 6),
  ('Mì tôm trứng', 'Đồ ăn', 'Tô', 25000, 7),
  ('Mì xào bò', 'Đồ ăn', 'Đĩa', 45000, 8),
  ('Khoai tây chiên', 'Đồ ăn', 'Đĩa', 35000, 9),
  ('Khăn lạnh', 'Khác', 'Cái', 3000, 10)
) AS v(name, category, unit, price, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM public.menu_items);
