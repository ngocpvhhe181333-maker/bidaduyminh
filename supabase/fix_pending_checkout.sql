-- Sửa hàm thanh toán cho phiên đã chốt (pending) mà không đổi dữ liệu hiện có.
-- Chạy sau inventory_profit_migration.sql và checkout_discount_migration.sql.
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
  v_ended_at TIMESTAMPTZ;
  v_paid_at TIMESTAMPTZ := now();
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

  IF NOT FOUND OR v_session.status NOT IN ('open', 'pending') THEN
    RAISE EXCEPTION 'Phiên chơi không tồn tại hoặc đã thanh toán trước đó.';
  END IF;

  v_ended_at := COALESCE(v_session.ended_at, now());

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
  v_code_prefix := 'HD-' || to_char(v_paid_at AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYYMMDD') || '-';
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
    v_paid_at,
    'paid',
    COALESCE(NULLIF(trim(p_note), ''), v_session.notes)
  )
  RETURNING * INTO v_invoice;

  INSERT INTO public.invoice_items (
    invoice_id,
    source_session_item_id,
    menu_item_id,
    item_name,
    unit,
    unit_price,
    quantity,
    line_total
  )
  SELECT
    v_invoice.id,
    id,
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
