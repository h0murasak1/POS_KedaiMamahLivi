-- ==========================================
-- 008_reset_owner_password_pin.sql
-- RPC: Reset Password Pemilik via PIN Owner (Solusi untuk email custom / offline tanpa inbox)
-- ==========================================

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION reset_owner_password_with_pin(
  p_email TEXT,
  p_pin TEXT,
  p_new_password TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_stored_pin TEXT;
  v_user_id UUID;
  v_role TEXT;
  v_encrypted_pw TEXT;
BEGIN
  -- 1. Validasi PIN Owner dari store_settings
  SELECT value INTO v_stored_pin FROM store_settings WHERE key = 'owner_pin';
  IF v_stored_pin IS NULL OR v_stored_pin = '' THEN
    v_stored_pin := '1234';
  END IF;

  IF p_pin IS NULL OR TRIM(p_pin) != TRIM(v_stored_pin) THEN
    RETURN jsonb_build_object('success', false, 'message', 'PIN Owner salah. Pastikan PIN yang dimasukkan benar.');
  END IF;

  -- 2. Validasi password baru
  IF p_new_password IS NULL OR length(p_new_password) < 6 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Password baru minimal 6 karakter.');
  END IF;

  -- 3. Cari akun pemilik berdasarkan email
  SELECT id, role INTO v_user_id, v_role 
  FROM public.profiles 
  WHERE lower(email) = lower(trim(p_email));

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Akun pemilik dengan email tersebut tidak ditemukan.');
  END IF;

  IF v_role != 'owner' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Email ini terdaftar sebagai Kasir. Akun kasir hanya bisa direset oleh Pemilik melalui menu Staf Kasir.');
  END IF;

  -- 4. Enkripsi password baru menggunakan bcrypt
  v_encrypted_pw := extensions.crypt(p_new_password, extensions.gen_salt('bf'));

  -- 5. Update password di auth.users
  UPDATE auth.users
  SET 
    encrypted_password = v_encrypted_pw,
    updated_at = now()
  WHERE id = v_user_id;

  -- 6. Catat ke audit log
  INSERT INTO public.audit_logs (user_id, user_name, action, details)
  VALUES (
    v_user_id,
    'Pemilik',
    'reset_owner_password_pin',
    'Pemilik mereset password akun ' || p_email || ' menggunakan verifikasi PIN Owner'
  );

  RETURN jsonb_build_object(
    'success', true, 
    'message', 'Password pemilik berhasil direset! Silakan masuk dengan password baru.'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION reset_owner_password_with_pin(TEXT, TEXT, TEXT) TO anon, authenticated;
