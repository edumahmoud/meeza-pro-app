-- ==========================================
-- MEEZA POS - FINANCIAL INTEGRITY FIX (v16.0)
-- ==========================================

-- 1. وظيفة سداد مدفوعات الموردين الاحترافية (سداد دين + تحديث فاتورة + خصم خزينة)
CREATE OR REPLACE FUNCTION public.process_supplier_payment_v2(
  p_supplier_id UUID,
  p_amount DECIMAL,
  p_purchase_id UUID,
  p_notes TEXT,
  p_branch_id UUID,
  p_created_by UUID
) RETURNS VOID 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_payment_id UUID := gen_random_uuid();
  v_timestamp BIGINT := extract(epoch from now()) * 1000;
BEGIN
  -- أ. تسجيل الدفعة في جدول مدفوعات الموردين
  INSERT INTO public.supplier_payments (
    id, supplier_id, purchase_id, amount, notes, timestamp, date, time
  ) VALUES (
    v_payment_id, p_supplier_id, p_purchase_id, p_amount, p_notes, 
    v_timestamp, 
    to_char(now(), 'YYYY-MM-DD'), 
    to_char(now(), 'HH24:MI:SS')
  );

  -- ب. تحديث مديونية المورد الإجمالية (الحساب المالي العام)
  UPDATE public.suppliers 
  SET 
    total_paid = total_paid + p_amount,
    total_debt = total_debt - p_amount
  WHERE id = p_supplier_id;

  -- ج. تحديث المبلغ المتبقي في الفاتورة المحددة (إذا تم اختيار فاتورة بعينها)
  IF p_purchase_id IS NOT NULL THEN
    UPDATE public.purchase_records 
    SET remaining_amount = remaining_amount - p_amount
    WHERE id = p_purchase_id;
  END IF;

  -- د. تسجيل حركة "صرف" في خزينة الفرع (تظهر في السجل اليومي وحركة الصندوق)
  INSERT INTO public.treasury_logs (
    id, branch_id, type, source, reference_id, amount, notes, created_by, timestamp
  ) VALUES (
    gen_random_uuid(), p_branch_id, 'out', 'supplier_payment', 
    v_payment_id::text, 
    p_amount, 
    'سداد دفعة للمورد: ' || p_notes, 
    p_created_by, 
    v_timestamp
  );
END;
$$;

-- 2. وظيفة مرتجع الشراء الموحدة (خصم مخزن + تسوية حساب المورد + إيداع خزينة اختياري)
CREATE OR REPLACE FUNCTION public.process_purchase_return_v2(
  p_id UUID,
  p_original_purchase_id UUID,
  p_supplier_id UUID,
  p_items JSONB,
  p_total_refund DECIMAL,
  p_refund_method TEXT, -- 'cash' or 'debt_deduction'
  p_is_money_received BOOLEAN,
  p_created_by UUID,
  p_branch_id UUID,
  p_notes TEXT
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  item RECORD;
  v_timestamp BIGINT := extract(epoch from now()) * 1000;
BEGIN
  -- أ. تسجيل المرتجع في الأرشيف
  INSERT INTO public.purchase_returns (
    id, original_purchase_id, supplier_id, items, total_refund, 
    refund_method, is_money_received, date, time, timestamp, created_by, branch_id, notes
  ) VALUES (
    p_id, p_original_purchase_id, p_supplier_id, p_items, p_total_refund,
    p_refund_method, p_is_money_received, 
    to_char(now(), 'YYYY-MM-DD'), to_char(now(), 'HH24:MI:SS'),
    v_timestamp, p_created_by, p_branch_id, p_notes
  );

  -- ب. تحديث المخزن لكل صنف (إرجاع للمورد يعني نقص من رصيد المحل)
  FOR item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(product_id UUID, quantity DECIMAL)
  LOOP
    UPDATE public.products 
    SET stock = stock - item.quantity 
    WHERE id = item.product_id;
  END LOOP;

  -- ج. المعالجة المالية الموحدة للمرتجع
  IF p_refund_method = 'debt_deduction' THEN
    -- الحالة الأولى: خصم من المديونية (تقليل المبلغ الذي نطلبه من المورد)
    UPDATE public.suppliers 
    SET total_debt = total_debt - p_total_refund
    WHERE id = p_supplier_id;
  ELSIF p_refund_method = 'cash' AND p_is_money_received = true THEN
    -- الحالة الثانية: استلام نقدي (إيداع المبلغ في خزينة الفرع)
    INSERT INTO public.treasury_logs (
      id, branch_id, type, source, reference_id, amount, notes, created_by, timestamp
    ) VALUES (
      gen_random_uuid(), p_branch_id, 'in', 'purchase_return', p_id::text,
      p_total_refund, 'إيداع نقدي: مرتجع توريد من فاتورة', p_created_by,
      v_timestamp
    );
  END IF;
END;
$$;