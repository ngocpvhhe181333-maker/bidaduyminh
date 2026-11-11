-- ============================================================================
-- TÙY CHỈNH BACKEND: CHO PHÉP ADMIN XÓA CA LÀM VIỆC ĐÃ CHỐT
-- Chạy file này trong Supabase Dashboard -> SQL Editor (sau schema.sql)
-- ============================================================================

-- 1. Cho phép tách liên kết ca khỏi hóa đơn khi xóa ca (giữ nguyên hóa đơn & doanh thu)
ALTER TABLE public.invoices
  ALTER COLUMN shift_id DROP NOT NULL;

DO $$
DECLARE
  v_conname TEXT;
BEGIN
  FOR v_conname IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    JOIN pg_attribute att ON att.attrelid = rel.oid AND att.attnum = ANY(con.conkey)
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'invoices'
      AND con.contype = 'f'
      AND att.attname = 'shift_id'
  LOOP
    EXECUTE format('ALTER TABLE public.invoices DROP CONSTRAINT %I', v_conname);
  END LOOP;
END $$;

ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_shift_id_fkey
  FOREIGN KEY (shift_id) REFERENCES public.shifts(id) ON DELETE SET NULL;

-- 2. Bổ sung policy DELETE trên shifts cho Admin
DROP POLICY IF EXISTS shifts_delete ON public.shifts;
CREATE POLICY shifts_delete ON public.shifts
  FOR DELETE USING (public.is_admin());

-- 3. RPC xóa ca làm việc đã chốt (CHỈ ADMIN)
CREATE OR REPLACE FUNCTION public.admin_delete_shift(p_shift_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shift public.shifts;
  v_detached_invoices INTEGER := 0;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Chỉ Admin mới có quyền xóa ca làm việc.';
  END IF;

  SELECT * INTO v_shift
  FROM public.shifts
  WHERE id = p_shift_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Không tìm thấy ca làm việc cần xóa.';
  END IF;

  IF v_shift.status <> 'closed' THEN
    RAISE EXCEPTION 'Không thể xóa ca đang mở. Vui lòng chốt ca trước khi xóa.';
  END IF;

  UPDATE public.invoices
  SET shift_id = NULL
  WHERE shift_id = p_shift_id;
  GET DIAGNOSTICS v_detached_invoices = ROW_COUNT;

  DELETE FROM public.shifts
  WHERE id = p_shift_id;

  RETURN jsonb_build_object(
    'deleted_shift_id', p_shift_id,
    'detached_invoices', v_detached_invoices
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_delete_shift(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_delete_shift(UUID) TO authenticated;
