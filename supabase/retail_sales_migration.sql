-- Chạy file này trong Supabase SQL Editor sau supabase/schema.sql.
-- Cho phép hóa đơn bán đồ ăn/uống không gắn với bàn hoặc phiên chơi.

ALTER TABLE public.invoices
  ALTER COLUMN session_id DROP NOT NULL,
  ALTER COLUMN table_id DROP NOT NULL;

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS sale_type TEXT NOT NULL DEFAULT 'table';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.invoices'::regclass
      AND conname = 'invoices_sale_type_check'
  ) THEN
    ALTER TABLE public.invoices ADD CONSTRAINT invoices_sale_type_check CHECK (
      (sale_type = 'table' AND session_id IS NOT NULL AND table_id IS NOT NULL)
      OR
      (sale_type = 'retail' AND session_id IS NULL AND table_id IS NULL AND table_fee = 0)
    );
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.checkout_retail_sale(
  p_items JSONB,
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
  v_item JSONB;
  v_menu public.menu_items;
  v_menu_id UUID;
  v_quantity INTEGER;
  v_items_fee INTEGER := 0;
  v_paid_at TIMESTAMPTZ := now();
  v_code_prefix TEXT;
  v_seq INTEGER;
  v_invoice public.invoices;
BEGIN
  IF NOT public.is_staff() THEN
    RAISE EXCEPTION 'Bạn không có quyền thanh toán.';
  END IF;

  IF p_payment_method NOT IN ('cash', 'transfer') THEN
    RAISE EXCEPTION 'Phương thức thanh toán không hợp lệ.';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array'
     OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Vui lòng chọn ít nhất một món.';
  END IF;

  SELECT id INTO v_shift_id
  FROM public.shifts
  WHERE status = 'open'
  LIMIT 1
  FOR UPDATE;

  IF v_shift_id IS NULL THEN
    RAISE EXCEPTION 'Chưa có ca làm đang mở. Vui lòng mở ca trước khi thu tiền.';
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE id = auth.uid();

  -- Tính tiền từ bảng menu trên server, không tin giá do trình duyệt gửi.
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    IF jsonb_typeof(v_item) <> 'object' THEN
      RAISE EXCEPTION 'Dữ liệu món không hợp lệ.';
    END IF;
    v_menu_id := (v_item->>'menu_item_id')::UUID;
    v_quantity := (v_item->>'quantity')::INTEGER;
    IF v_menu_id IS NULL OR v_quantity IS NULL OR v_quantity < 1 OR v_quantity > 99 THEN
      RAISE EXCEPTION 'Số lượng món phải từ 1 đến 99.';
    END IF;

    SELECT * INTO v_menu FROM public.menu_items
    WHERE id = v_menu_id AND is_active = true
    FOR SHARE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Món đã ngừng bán hoặc không tồn tại.';
    END IF;
    v_items_fee := v_items_fee + v_menu.price * v_quantity;
  END LOOP;

  -- Cùng khóa với checkout_session để mã hóa đơn không trùng khi thu đồng thời.
  PERFORM pg_advisory_xact_lock(77665544);
  v_code_prefix := 'HD-' || to_char(v_paid_at AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYYMMDD') || '-';
  SELECT COALESCE(MAX(NULLIF(split_part(invoice_code, '-', 3), '')::INTEGER), 0) + 1
  INTO v_seq
  FROM public.invoices
  WHERE invoice_code LIKE v_code_prefix || '%';

  INSERT INTO public.invoices (
    invoice_code, sale_type, session_id, shift_id, table_id,
    table_name, table_type_name, started_at, ended_at,
    duration_seconds, billed_minutes, hourly_rate_snapshot,
    rounding_minutes_snapshot, rounding_mode_snapshot, min_minutes_snapshot,
    table_fee, items_fee, discount_amount, total_amount,
    payment_method, cashier_id, cashier_name, paid_at, status, note
  ) VALUES (
    v_code_prefix || lpad(v_seq::TEXT, 4, '0'), 'retail', NULL, v_shift_id, NULL,
    'Bán lẻ', 'Không dùng bàn', v_paid_at, v_paid_at,
    0, 0, 0, 1, 'ceil', 0,
    0, v_items_fee, 0, v_items_fee,
    p_payment_method, v_profile.id, v_profile.full_name, v_paid_at, 'paid',
    COALESCE(trim(p_note), '')
  ) RETURNING * INTO v_invoice;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    v_menu_id := (v_item->>'menu_item_id')::UUID;
    v_quantity := (v_item->>'quantity')::INTEGER;
    SELECT * INTO v_menu FROM public.menu_items WHERE id = v_menu_id;

    INSERT INTO public.invoice_items (
      invoice_id, menu_item_id, item_name, unit, unit_price, quantity, line_total
    ) VALUES (
      v_invoice.id, v_menu.id, v_menu.name, v_menu.unit,
      v_menu.price, v_quantity, v_menu.price * v_quantity
    );
  END LOOP;

  RETURN v_invoice;
END;
$$;

REVOKE ALL ON FUNCTION public.checkout_retail_sale(JSONB, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.checkout_retail_sale(JSONB, TEXT, TEXT) TO authenticated;
