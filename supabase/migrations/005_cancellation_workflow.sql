-- ==========================================
-- 005_cancellation_workflow.sql
-- Fitur Pembatalan Transaksi dengan Perizinan Owner
-- ==========================================

-- 1. Tambah kolom pembatalan ke tabel orders jika belum ada
ALTER TABLE orders 
  ADD COLUMN IF NOT EXISTS cancellation_status TEXT DEFAULT 'none' CHECK (cancellation_status IN ('none', 'requested', 'approved', 'rejected')),
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS cancellation_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancellation_requested_by UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS cancellation_requested_by_name TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS cancellation_approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancellation_approved_by UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS cancellation_rejection_note TEXT DEFAULT '';

-- 2. Tambah pengaturan default PIN Owner (default: 1234)
INSERT INTO store_settings (key, value) VALUES
  ('owner_pin', '1234')
ON CONFLICT (key) DO NOTHING;

-- 3. RPC: Kasir mengajukan pembatalan ke Owner (Remote Approval)
CREATE OR REPLACE FUNCTION request_order_cancellation(
  p_order_id UUID,
  p_reason TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_user_name TEXT;
  v_order_num TEXT;
BEGIN
  -- Ambil nama kasir / user yang sedang login
  SELECT full_name INTO v_user_name FROM profiles WHERE id = auth.uid();
  IF v_user_name IS NULL THEN
    v_user_name := 'Kasir';
  END IF;

  -- Ambil nomor transaksi
  SELECT order_number INTO v_order_num FROM orders WHERE id = p_order_id;
  IF v_order_num IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Transaksi tidak ditemukan');
  END IF;

  -- Update status pembatalan menjadi 'requested'
  UPDATE orders
  SET 
    cancellation_status = 'requested',
    cancellation_reason = COALESCE(p_reason, 'Tidak ada alasan'),
    cancellation_requested_at = now(),
    cancellation_requested_by = auth.uid(),
    cancellation_requested_by_name = v_user_name
  WHERE id = p_order_id;

  -- Catat ke audit log
  INSERT INTO audit_logs (user_id, user_name, action, details)
  VALUES (
    auth.uid(),
    v_user_name,
    'request_cancellation',
    'Pengajuan pembatalan transaksi ' || v_order_num || ' oleh ' || v_user_name || '. Alasan: ' || COALESCE(p_reason, '-')
  );

  RETURN jsonb_build_object(
    'success', true, 
    'message', 'Permintaan pembatalan transaksi berhasil diajukan ke Owner'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 4. RPC: Kasir membatalkan transaksi langsung dengan otorisasi PIN Owner di tempat
CREATE OR REPLACE FUNCTION cancel_order_with_pin(
  p_order_id UUID,
  p_pin TEXT,
  p_reason TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_stored_pin TEXT;
  v_user_name TEXT;
  v_order_num TEXT;
BEGIN
  -- Ambil PIN Owner dari store_settings
  SELECT value INTO v_stored_pin FROM store_settings WHERE key = 'owner_pin';
  IF v_stored_pin IS NULL OR v_stored_pin = '' THEN
    v_stored_pin := '1234';
  END IF;

  -- Validasi PIN
  IF TRIM(p_pin) != TRIM(v_stored_pin) THEN
    RETURN jsonb_build_object('success', false, 'message', 'PIN Owner salah. Pastikan PIN yang dimasukkan benar.');
  END IF;

  -- Ambil nama kasir
  SELECT full_name INTO v_user_name FROM profiles WHERE id = auth.uid();
  IF v_user_name IS NULL THEN
    v_user_name := 'Kasir';
  END IF;

  -- Ambil nomor order
  SELECT order_number INTO v_order_num FROM orders WHERE id = p_order_id;
  IF v_order_num IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Transaksi tidak ditemukan');
  END IF;

  -- Batalkan transaksi
  UPDATE orders
  SET 
    order_status = 'cancelled',
    cancellation_status = 'approved',
    cancellation_reason = COALESCE(p_reason, 'Dibatalkan oleh kasir dengan otorisasi PIN Owner'),
    cancellation_approved_at = now(),
    cancellation_requested_by = auth.uid(),
    cancellation_requested_by_name = v_user_name
  WHERE id = p_order_id;

  -- Catat ke audit log
  INSERT INTO audit_logs (user_id, user_name, action, details)
  VALUES (
    auth.uid(),
    v_user_name,
    'cancel_with_pin',
    'Transaksi ' || v_order_num || ' dibatalkan di tempat via otorisasi PIN Owner oleh ' || v_user_name || '. Alasan: ' || COALESCE(p_reason, '-')
  );

  RETURN jsonb_build_object(
    'success', true, 
    'message', 'Transaksi berhasil dibatalkan dengan izin Owner'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 5. RPC: Owner menyetujui pengajuan pembatalan (Approve)
CREATE OR REPLACE FUNCTION approve_order_cancellation(
  p_order_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_is_owner BOOLEAN;
  v_owner_name TEXT;
  v_order_num TEXT;
  v_reason TEXT;
BEGIN
  -- Validasi role Owner
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'owner'
  ) INTO v_is_owner;

  IF NOT v_is_owner THEN
    RETURN jsonb_build_object('success', false, 'message', 'Hanya Owner yang berhak menyetujui pembatalan transaksi');
  END IF;

  SELECT full_name INTO v_owner_name FROM profiles WHERE id = auth.uid();
  SELECT order_number, cancellation_reason INTO v_order_num, v_reason FROM orders WHERE id = p_order_id;

  -- Setujui pembatalan
  UPDATE orders
  SET 
    order_status = 'cancelled',
    cancellation_status = 'approved',
    cancellation_approved_at = now(),
    cancellation_approved_by = auth.uid()
  WHERE id = p_order_id;

  -- Catat ke audit log
  INSERT INTO audit_logs (user_id, user_name, action, details)
  VALUES (
    auth.uid(),
    COALESCE(v_owner_name, 'Owner'),
    'approve_cancellation',
    'Owner menyetujui pembatalan transaksi ' || COALESCE(v_order_num, '') || '. Alasan: ' || COALESCE(v_reason, '-')
  );

  RETURN jsonb_build_object(
    'success', true, 
    'message', 'Pembatalan transaksi berhasil disetujui'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 6. RPC: Owner menolak pengajuan pembatalan (Reject)
CREATE OR REPLACE FUNCTION reject_order_cancellation(
  p_order_id UUID,
  p_rejection_note TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_is_owner BOOLEAN;
  v_owner_name TEXT;
  v_order_num TEXT;
BEGIN
  -- Validasi role Owner
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'owner'
  ) INTO v_is_owner;

  IF NOT v_is_owner THEN
    RETURN jsonb_build_object('success', false, 'message', 'Hanya Owner yang berhak menolak pembatalan transaksi');
  END IF;

  SELECT full_name INTO v_owner_name FROM profiles WHERE id = auth.uid();
  SELECT order_number INTO v_order_num FROM orders WHERE id = p_order_id;

  -- Tolak pengajuan pembatalan
  UPDATE orders
  SET 
    cancellation_status = 'rejected',
    cancellation_rejection_note = COALESCE(p_rejection_note, 'Ditolak oleh Owner')
  WHERE id = p_order_id;

  -- Catat ke audit log
  INSERT INTO audit_logs (user_id, user_name, action, details)
  VALUES (
    auth.uid(),
    COALESCE(v_owner_name, 'Owner'),
    'reject_cancellation',
    'Owner menolak pembatalan transaksi ' || COALESCE(v_order_num, '') || '. Catatan: ' || COALESCE(p_rejection_note, '-')
  );

  RETURN jsonb_build_object(
    'success', true, 
    'message', 'Pengajuan pembatalan transaksi ditolak'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 7. RPC: Owner membatalkan transaksi langsung
CREATE OR REPLACE FUNCTION owner_direct_cancel_order(
  p_order_id UUID,
  p_reason TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_is_owner BOOLEAN;
  v_owner_name TEXT;
  v_order_num TEXT;
BEGIN
  -- Validasi role Owner
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'owner'
  ) INTO v_is_owner;

  IF NOT v_is_owner THEN
    RETURN jsonb_build_object('success', false, 'message', 'Hanya Owner yang memiliki akses pembatalan langsung');
  END IF;

  SELECT full_name INTO v_owner_name FROM profiles WHERE id = auth.uid();
  SELECT order_number INTO v_order_num FROM orders WHERE id = p_order_id;

  UPDATE orders
  SET 
    order_status = 'cancelled',
    cancellation_status = 'approved',
    cancellation_reason = COALESCE(p_reason, 'Dibatalkan langsung oleh Owner'),
    cancellation_approved_at = now(),
    cancellation_approved_by = auth.uid()
  WHERE id = p_order_id;

  INSERT INTO audit_logs (user_id, user_name, action, details)
  VALUES (
    auth.uid(),
    COALESCE(v_owner_name, 'Owner'),
    'direct_cancel',
    'Transaksi ' || COALESCE(v_order_num, '') || ' dibatalkan langsung oleh Owner. Alasan: ' || COALESCE(p_reason, '-')
  );

  RETURN jsonb_build_object(
    'success', true, 
    'message', 'Transaksi berhasil dibatalkan'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
