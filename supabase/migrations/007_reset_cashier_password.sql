-- ==========================================
-- 007_reset_cashier_password.sql
-- RPC: Reset Password Kasir oleh Pemilik
-- ==========================================

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION reset_cashier_password(
  p_cashier_id UUID,
  p_new_password TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_encrypted_pw TEXT;
  v_role TEXT;
  v_cashier_name TEXT;
  v_cashier_email TEXT;
BEGIN
  -- 1. Verifikasi hanya pemilik yang berhak mereset password kasir
  IF NOT is_owner() THEN
    RAISE EXCEPTION 'Hanya pemilik yang berhak mereset password kasir';
  END IF;

  -- 2. Validasi input
  IF p_new_password IS NULL OR length(p_new_password) < 6 THEN
    RAISE EXCEPTION 'Password baru minimal 6 karakter';
  END IF;

  -- 3. Verifikasi akun yang direset adalah kasir
  SELECT role, full_name, email INTO v_role, v_cashier_name, v_cashier_email 
  FROM public.profiles 
  WHERE id = p_cashier_id;

  IF v_role IS NULL THEN
    RAISE EXCEPTION 'Akun kasir tidak ditemukan';
  END IF;

  IF v_role != 'cashier' THEN
    RAISE EXCEPTION 'Fungsi ini khusus untuk mereset akun kasir';
  END IF;

  -- 4. Enkripsi password menggunakan bcrypt
  v_encrypted_pw := extensions.crypt(p_new_password, extensions.gen_salt('bf'));

  -- 5. Update password di auth.users
  UPDATE auth.users
  SET 
    encrypted_password = v_encrypted_pw,
    updated_at = now()
  WHERE id = p_cashier_id;

  -- 6. Catat ke audit log
  INSERT INTO public.audit_logs (user_id, user_name, action, details)
  VALUES (
    auth.uid(),
    COALESCE((SELECT full_name FROM public.profiles WHERE id = auth.uid()), 'Pemilik'),
    'reset_cashier_password',
    'Reset password akun kasir ' || COALESCE(v_cashier_name, 'Kasir') || ' (' || COALESCE(v_cashier_email, '-') || ')'
  );

  RETURN jsonb_build_object(
    'success', true, 
    'message', 'Password kasir berhasil diperbarui'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION reset_cashier_password(UUID, TEXT) TO authenticated;
