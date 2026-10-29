-- ==========================================
-- 12. RPC: create_cashier_account (Trusted DB Function)
-- ==========================================
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION create_cashier_account(
  p_email TEXT,
  p_password TEXT,
  p_full_name TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_user_id UUID := gen_random_uuid();
  v_encrypted_pw TEXT;
BEGIN
  -- 1. Verifikasi hanya pemilik yang bisa membuat akun kasir
  IF NOT is_owner() THEN
    RAISE EXCEPTION 'Hanya pemilik yang dapat membuat akun kasir';
  END IF;

  -- 2. Validasi input
  IF p_email IS NULL OR p_email = '' OR p_password IS NULL OR length(p_password) < 6 THEN
    RAISE EXCEPTION 'Email dan password valid (min 6 karakter) diperlukan';
  END IF;

  -- 3. Cek apakah email sudah terdaftar
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = p_email) THEN
    RAISE EXCEPTION 'Email % sudah terdaftar di sistem', p_email;
  END IF;

  -- 4. Enkripsi password menggunakan bcrypt
  v_encrypted_pw := extensions.crypt(p_password, extensions.gen_salt('bf'));

  -- 5. Masukkan langsung ke auth.users
  INSERT INTO auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at
  ) VALUES (
    v_user_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    p_email,
    v_encrypted_pw,
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name', p_full_name, 'role', 'cashier'),
    now(),
    now()
  );

  -- 6. Masukkan/update profil kasir
  INSERT INTO public.profiles (id, email, full_name, role, is_active)
  VALUES (v_user_id, p_email, p_full_name, 'cashier', true)
  ON CONFLICT (id) DO UPDATE
  SET full_name = p_full_name, role = 'cashier', is_active = true;

  -- 7. Catat ke audit log
  INSERT INTO public.audit_logs (user_id, user_name, action, details)
  VALUES (
    auth.uid(),
    COALESCE((SELECT full_name FROM public.profiles WHERE id = auth.uid()), 'Pemilik'),
    'create_cashier',
    'Membuat akun kasir baru: ' || p_full_name || ' (' || p_email || ')'
  );

  RETURN jsonb_build_object('success', true, 'user_id', v_user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
