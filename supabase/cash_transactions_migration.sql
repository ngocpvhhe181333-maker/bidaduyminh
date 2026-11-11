-- ============================================================================
-- TÙY CHỈNH BACKEND: PHIẾU THU / CHI NGOÀI QUẦY CHO BÁO CÁO "TỔNG THU CHI"
-- Chạy file này trong Supabase Dashboard -> SQL Editor (sau schema.sql)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.cash_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tx_type TEXT NOT NULL CHECK (tx_type IN ('income', 'expense')),
  category TEXT NOT NULL DEFAULT 'Chi phí khác',
  amount INTEGER NOT NULL CHECK (amount > 0),
  payment_method TEXT NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('cash', 'transfer')),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  description TEXT NOT NULL CHECK (length(trim(description)) >= 2),
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_by_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cash_transactions_occurred_at
  ON public.cash_transactions (occurred_at DESC);

ALTER TABLE public.cash_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cash_transactions_select ON public.cash_transactions;
CREATE POLICY cash_transactions_select ON public.cash_transactions
  FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS cash_transactions_delete ON public.cash_transactions;
CREATE POLICY cash_transactions_delete ON public.cash_transactions
  FOR DELETE USING (public.is_admin());

CREATE OR REPLACE FUNCTION public.admin_create_cash_transaction(
  p_tx_type TEXT,
  p_category TEXT,
  p_amount INTEGER,
  p_payment_method TEXT DEFAULT 'cash',
  p_occurred_at TIMESTAMPTZ DEFAULT now(),
  p_description TEXT DEFAULT ''
)
RETURNS public.cash_transactions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin public.profiles;
  v_row public.cash_transactions;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Chỉ Admin mới có quyền lập phiếu thu chi.';
  END IF;

  IF p_tx_type NOT IN ('income', 'expense') THEN
    RAISE EXCEPTION 'Loại phiếu phải là Thu (income) hoặc Chi (expense).';
  END IF;

  IF p_payment_method NOT IN ('cash', 'transfer') THEN
    RAISE EXCEPTION 'Phương thức phải là Tiền mặt hoặc Chuyển khoản.';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Số tiền phải lớn hơn 0.';
  END IF;

  IF length(trim(COALESCE(p_description, ''))) < 2 THEN
    RAISE EXCEPTION 'Vui lòng nhập nội dung phiếu thu/chi (tối thiểu 2 ký tự).';
  END IF;

  SELECT * INTO v_admin FROM public.profiles WHERE id = auth.uid();

  INSERT INTO public.cash_transactions (
    tx_type,
    category,
    amount,
    payment_method,
    occurred_at,
    description,
    created_by,
    created_by_name
  )
  VALUES (
    p_tx_type,
    COALESCE(NULLIF(trim(p_category), ''), CASE WHEN p_tx_type = 'income' THEN 'Thu khác' ELSE 'Chi phí khác' END),
    p_amount,
    p_payment_method,
    COALESCE(p_occurred_at, now()),
    trim(p_description),
    v_admin.id,
    v_admin.full_name
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;
