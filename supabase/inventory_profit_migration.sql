-- Chạy trong Supabase SQL Editor sau schema.sql và retail_sales_migration.sql.
-- Hàng cũ chưa có giá vốn được giữ NULL; hãy nhập tồn kho và giá nhập hiện tại trong Quản trị.

ALTER TABLE public.menu_items
  ADD COLUMN IF NOT EXISTS purchase_price INTEGER CHECK (purchase_price >= 0),
  ADD COLUMN IF NOT EXISTS stock_quantity INTEGER CHECK (stock_quantity >= 0);

ALTER TABLE public.session_items
  ADD COLUMN IF NOT EXISTS purchase_price_snapshot INTEGER CHECK (purchase_price_snapshot >= 0);

ALTER TABLE public.invoice_items
  ADD COLUMN IF NOT EXISTS purchase_price_snapshot INTEGER CHECK (purchase_price_snapshot >= 0),
  ADD COLUMN IF NOT EXISTS line_cost INTEGER CHECK (line_cost >= 0),
  ADD COLUMN IF NOT EXISTS source_session_item_id UUID REFERENCES public.session_items(id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_invoice_items_source_session_item
  ON public.invoice_items (source_session_item_id)
  WHERE source_session_item_id IS NOT NULL;

-- Trừ tồn khi món được gọi cho bàn; trả lại tồn nếu giảm/xóa món trước thanh toán.
CREATE OR REPLACE FUNCTION public.update_session_item_stock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_delta INTEGER;
  v_purchase_price INTEGER;
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.menu_items
    SET stock_quantity = CASE WHEN stock_quantity IS NULL THEN NULL ELSE stock_quantity - NEW.quantity END
    WHERE id = NEW.menu_item_id
      AND (stock_quantity IS NULL OR stock_quantity >= NEW.quantity)
    RETURNING purchase_price INTO v_purchase_price;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Không đủ hàng tồn kho để thêm món.';
    END IF;
    NEW.purchase_price_snapshot := v_purchase_price;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.menu_item_id IS DISTINCT FROM OLD.menu_item_id THEN
      RAISE EXCEPTION 'Không thể đổi món trên dòng đã gọi.';
    END IF;
    v_delta := NEW.quantity - OLD.quantity;
    IF v_delta > 0 THEN
      UPDATE public.menu_items
      SET stock_quantity = CASE WHEN stock_quantity IS NULL THEN NULL ELSE stock_quantity - v_delta END
      WHERE id = NEW.menu_item_id
        AND (stock_quantity IS NULL OR stock_quantity >= v_delta);
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Không đủ hàng tồn kho để tăng số lượng món.';
      END IF;
    ELSIF v_delta < 0 THEN
      UPDATE public.menu_items
      SET stock_quantity = CASE WHEN stock_quantity IS NULL THEN NULL ELSE stock_quantity - v_delta END
      WHERE id = NEW.menu_item_id;
    END IF;
    NEW.purchase_price_snapshot := OLD.purchase_price_snapshot;
    RETURN NEW;
  END IF;

  UPDATE public.menu_items
  SET stock_quantity = CASE WHEN stock_quantity IS NULL THEN NULL ELSE stock_quantity + OLD.quantity END
  WHERE id = OLD.menu_item_id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_session_items_stock ON public.session_items;
CREATE TRIGGER trg_session_items_stock
  BEFORE INSERT OR UPDATE OR DELETE ON public.session_items
  FOR EACH ROW EXECUTE FUNCTION public.update_session_item_stock();

-- Khi giá nhập thay đổi, lượt gọi mới tạo dòng riêng để giữ giá vốn cũ.
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
  IF NOT FOUND OR NOT v_menu.is_active THEN
    RAISE EXCEPTION 'Món không tồn tại hoặc đã ngừng bán.';
  END IF;

  SELECT * INTO v_existing
  FROM public.session_items
  WHERE session_id = p_session_id
    AND menu_item_id = p_menu_item_id
    AND unit_price_snapshot = v_menu.price
    AND purchase_price_snapshot IS NOT DISTINCT FROM v_menu.purchase_price
  LIMIT 1;

  IF FOUND THEN
    UPDATE public.session_items
    SET quantity = quantity + p_quantity
    WHERE id = v_existing.id
    RETURNING * INTO v_result;
  ELSE
    INSERT INTO public.session_items (
      session_id, menu_item_id, item_name_snapshot, unit_snapshot,
      unit_price_snapshot, quantity, added_by
    ) VALUES (
      p_session_id, v_menu.id, v_menu.name, v_menu.unit,
      v_menu.price, p_quantity, auth.uid()
    ) RETURNING * INTO v_result;
  END IF;

  RETURN v_result;
END;
$$;

-- Hóa đơn lưu giá vốn tại thời điểm bán. Đơn bán lẻ trừ kho khi thanh toán.
CREATE OR REPLACE FUNCTION public.set_invoice_item_cost()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session_id UUID;
  v_purchase_price INTEGER;
BEGIN
  SELECT session_id INTO v_session_id
  FROM public.invoices WHERE id = NEW.invoice_id;

  IF v_session_id IS NULL THEN
    UPDATE public.menu_items
    SET stock_quantity = CASE WHEN stock_quantity IS NULL THEN NULL ELSE stock_quantity - NEW.quantity END
    WHERE id = NEW.menu_item_id AND is_active = true
      AND (stock_quantity IS NULL OR stock_quantity >= NEW.quantity)
    RETURNING purchase_price INTO v_purchase_price;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Không đủ hàng tồn kho hoặc món đã ngừng bán.';
    END IF;
  ELSE
    SELECT purchase_price_snapshot INTO v_purchase_price
    FROM public.session_items
    WHERE id = NEW.source_session_item_id
      AND session_id = v_session_id
    ORDER BY created_at DESC
    LIMIT 1;
    IF NEW.source_session_item_id IS NULL OR NOT FOUND THEN
      RAISE EXCEPTION 'Thiếu dòng món nguồn khi xuất hóa đơn bàn.';
    END IF;
  END IF;

  NEW.purchase_price_snapshot := v_purchase_price;
  NEW.line_cost := CASE WHEN v_purchase_price IS NULL THEN NULL ELSE v_purchase_price * NEW.quantity END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_invoice_items_cost ON public.invoice_items;
CREATE TRIGGER trg_invoice_items_cost
  BEFORE INSERT ON public.invoice_items
  FOR EACH ROW EXECUTE FUNCTION public.set_invoice_item_cost();

-- Gắn chính xác từng dòng hóa đơn bàn với dòng món đã gọi để giữ giá vốn.
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
