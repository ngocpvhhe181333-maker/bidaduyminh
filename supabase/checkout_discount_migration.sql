-- Chạy sau schema.sql, retail_sales_migration.sql và inventory_profit_migration.sql.
-- Giữ các hàm thanh toán cũ để bản Vercel đang chạy vẫn hoạt động trong lúc triển khai.

CREATE OR REPLACE FUNCTION public.calculate_checkout_discount(
  p_subtotal INTEGER,
  p_discount_type TEXT,
  p_discount_value INTEGER
)
RETURNS INTEGER
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
BEGIN
  IF p_subtotal IS NULL OR p_subtotal < 0 OR p_discount_value IS NULL OR p_discount_value < 0 THEN
    RAISE EXCEPTION 'Giá trị giảm giá không hợp lệ.';
  END IF;

  IF p_discount_type = 'none' AND p_discount_value = 0 THEN
    RETURN 0;
  ELSIF p_discount_type = 'percent' AND p_discount_value <= 100 THEN
    RETURN round(p_subtotal::NUMERIC * p_discount_value / 100)::INTEGER;
  ELSIF p_discount_type = 'amount' AND p_discount_value <= p_subtotal THEN
    RETURN p_discount_value;
  END IF;

  RAISE EXCEPTION 'Giảm giá phải là 0–100%% hoặc số tiền không vượt tổng hóa đơn.';
END;
$$;

CREATE OR REPLACE FUNCTION public.checkout_session_with_discount(
  p_session_id UUID,
  p_payment_method TEXT,
  p_note TEXT,
  p_discount_type TEXT,
  p_discount_value INTEGER
)
RETURNS public.invoices
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice public.invoices;
  v_discount INTEGER;
BEGIN
  -- Hàm gốc khóa phiên, tính giờ và tạo hóa đơn trong cùng giao dịch.
  v_invoice := public.checkout_session(p_session_id, p_payment_method, p_note);
  v_discount := public.calculate_checkout_discount(
    v_invoice.table_fee + v_invoice.items_fee,
    p_discount_type,
    p_discount_value
  );

  UPDATE public.invoices
  SET discount_amount = v_discount,
      total_amount = v_invoice.table_fee + v_invoice.items_fee - v_discount
  WHERE id = v_invoice.id
  RETURNING * INTO v_invoice;

  RETURN v_invoice;
END;
$$;

CREATE OR REPLACE FUNCTION public.checkout_retail_sale_with_discount(
  p_items JSONB,
  p_payment_method TEXT,
  p_note TEXT,
  p_discount_type TEXT,
  p_discount_value INTEGER
)
RETURNS public.invoices
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice public.invoices;
  v_discount INTEGER;
BEGIN
  -- Giữ việc kiểm tra giá món và tồn kho của hàm bán lẻ hiện có.
  v_invoice := public.checkout_retail_sale(p_items, p_payment_method, p_note);
  v_discount := public.calculate_checkout_discount(
    v_invoice.items_fee,
    p_discount_type,
    p_discount_value
  );

  UPDATE public.invoices
  SET discount_amount = v_discount,
      total_amount = v_invoice.items_fee - v_discount
  WHERE id = v_invoice.id
  RETURNING * INTO v_invoice;

  RETURN v_invoice;
END;
$$;

REVOKE ALL ON FUNCTION public.calculate_checkout_discount(INTEGER, TEXT, INTEGER) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.checkout_session_with_discount(UUID, TEXT, TEXT, TEXT, INTEGER) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.checkout_retail_sale_with_discount(JSONB, TEXT, TEXT, TEXT, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.checkout_session_with_discount(UUID, TEXT, TEXT, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.checkout_retail_sale_with_discount(JSONB, TEXT, TEXT, TEXT, INTEGER) TO authenticated;
