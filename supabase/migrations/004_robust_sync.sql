-- ==========================================
-- 14. RPC: sync_transaction (Robust & Type-Safe)
-- ==========================================
CREATE OR REPLACE FUNCTION sync_transaction(
  p_order JSONB,
  p_items JSONB
)
RETURNS JSONB AS $$
DECLARE
  v_order_id UUID;
  v_exists BOOLEAN;
  v_item JSONB;
BEGIN
  v_order_id := (p_order->>'id')::UUID;

  -- 1. Cek apakah transaksi sudah ada di server (Idempoten)
  SELECT EXISTS(SELECT 1 FROM orders WHERE id = v_order_id) INTO v_exists;

  IF v_exists THEN
    RETURN jsonb_build_object('status', 'already_exists', 'order_id', v_order_id);
  END IF;

  -- 2. Simpan transaksi utama
  INSERT INTO orders (
    id, order_number, cashier_id, cashier_name, device_id,
    created_at_local, subtotal, discount_amount, total_amount,
    payment_method, cash_received, change_amount,
    payment_status, order_status
  ) VALUES (
    v_order_id,
    p_order->>'order_number',
    (p_order->>'cashier_id')::UUID,
    COALESCE(p_order->>'cashier_name', 'Kasir'),
    p_order->>'device_id',
    (p_order->>'created_at_local')::TIMESTAMPTZ,
    ROUND(COALESCE((p_order->>'subtotal')::NUMERIC, 0))::INTEGER,
    ROUND(COALESCE((p_order->>'discount_amount')::NUMERIC, 0))::INTEGER,
    ROUND(COALESCE((p_order->>'total_amount')::NUMERIC, 0))::INTEGER,
    COALESCE(p_order->>'payment_method', 'cash'),
    ROUND(NULLIF(p_order->>'cash_received', '')::NUMERIC)::INTEGER,
    ROUND(NULLIF(p_order->>'change_amount', '')::NUMERIC)::INTEGER,
    COALESCE(p_order->>'payment_status', 'paid'),
    COALESCE(p_order->>'order_status', 'completed')
  );

  -- 3. Simpan rincian item transaksi
  IF p_items IS NOT NULL AND jsonb_array_length(p_items) > 0 THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
      INSERT INTO order_items (
        id, order_id, product_id, product_name,
        variant_id, variant_name, quantity,
        unit_price, variant_price_addition, subtotal
      ) VALUES (
        (v_item->>'id')::UUID,
        v_order_id,
        NULLIF(v_item->>'product_id', '')::UUID,
        COALESCE(v_item->>'product_name', 'Item Menu'),
        NULLIF(v_item->>'variant_id', '')::UUID,
        v_item->>'variant_name',
        ROUND(COALESCE((v_item->>'quantity')::NUMERIC, 1))::INTEGER,
        ROUND(COALESCE((v_item->>'unit_price')::NUMERIC, 0))::INTEGER,
        ROUND(COALESCE((v_item->>'variant_price_addition')::NUMERIC, 0))::INTEGER,
        ROUND(COALESCE((v_item->>'subtotal')::NUMERIC, 0))::INTEGER
      );
    END LOOP;
  END IF;

  -- 4. Catat aktivitas ke audit log
  INSERT INTO audit_logs (user_id, user_name, action, details)
  VALUES (
    (p_order->>'cashier_id')::UUID,
    COALESCE(p_order->>'cashier_name', 'Kasir'),
    'sync_transaction',
    'Transaksi ' || COALESCE(p_order->>'order_number', '') || ' disinkronkan ke server'
  );

  RETURN jsonb_build_object('status', 'created', 'order_id', v_order_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION sync_transaction TO authenticated, anon;
