-- ==========================================
-- 006_fix_cashier_auth.sql (Updated & Type-Safe)
-- Perbaikan Error "database error querying schema" pada Login Kasir
-- ==========================================

-- 1. Perbaiki akun yang sudah terlanjur dibuat (isi token dengan string kosong, bukan NULL)
UPDATE auth.users
SET 
  confirmation_token = COALESCE(confirmation_token, ''),
  recovery_token = COALESCE(recovery_token, ''),
  email_change_token_new = COALESCE(email_change_token_new, ''),
  email_change = COALESCE(email_change, ''),
  phone_change = COALESCE(phone_change, ''),
  phone_change_token = COALESCE(phone_change_token, ''),
  reauthentication_token = COALESCE(reauthentication_token, ''),
  is_super_admin = COALESCE(is_super_admin, false),
  is_sso_user = COALESCE(is_sso_user, false)
WHERE 
  confirmation_token IS NULL 
  OR recovery_token IS NULL 
  OR email_change_token_new IS NULL;

-- Periksa kolom is_anonymous jika ada pada versi Supabase Anda
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'auth' AND table_name = 'users' AND column_name = 'is_anonymous'
  ) THEN
    EXECUTE 'UPDATE auth.users SET is_anonymous = false WHERE is_anonymous IS NULL';
  END IF;
END $$;

-- 2. Daftarkan identitas email di auth.identities untuk semua akun yang belum memilikinya
-- Catatan: id adalah tipe UUID di Supabase project Anda
INSERT INTO auth.identities (
  id,
  user_id,
  identity_data,
  provider,
  provider_id,
  last_sign_in_at,
  created_at,
  updated_at
)
SELECT 
  u.id, -- UUID
  u.id, -- UUID
  jsonb_build_object('sub', u.id::text, 'email', lower(u.email)),
  'email',
  u.id::text, -- provider_id is text
  now(),
  now(),
  now()
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM auth.identities i 
  WHERE i.user_id = u.id AND i.provider = 'email'
);


-- 3. Perbarui fungsi create_cashier_account agar akun baru otomatis valid & langsung bisa login
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
  v_clean_email TEXT;
BEGIN
  -- 1. Verifikasi hanya pemilik yang bisa membuat akun kasir
  IF NOT is_owner() THEN
    RAISE EXCEPTION 'Hanya pemilik yang dapat membuat akun kasir';
  END IF;

  -- 2. Validasi input
  IF p_email IS NULL OR p_email = '' OR p_password IS NULL OR length(p_password) < 6 THEN
    RAISE EXCEPTION 'Email dan password valid (min 6 karakter) diperlukan';
  END IF;

  v_clean_email := lower(trim(p_email));

  -- 3. Cek apakah email sudah terdaftar
  IF EXISTS (SELECT 1 FROM auth.users WHERE lower(email) = v_clean_email) THEN
    RAISE EXCEPTION 'Email % sudah terdaftar di sistem', v_clean_email;
  END IF;

  -- 4. Enkripsi password menggunakan bcrypt standar
  v_encrypted_pw := extensions.crypt(p_password, extensions.gen_salt('bf'));

  -- 5. Masukkan ke auth.users dengan token lengkap berupa string kosong (BUKAN NULL)
  INSERT INTO auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change,
    phone_change,
    phone_change_token,
    reauthentication_token,
    is_super_admin,
    is_sso_user,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at
  ) VALUES (
    v_user_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    v_clean_email,
    v_encrypted_pw,
    now(),
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    false,
    false,
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name', p_full_name, 'role', 'cashier'),
    now(),
    now()
  );

  -- 6. Masukkan juga ke auth.identities (id adalah UUID)
  INSERT INTO auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES (
    v_user_id, -- UUID
    v_user_id, -- UUID
    jsonb_build_object('sub', v_user_id::text, 'email', v_clean_email),
    'email',
    v_user_id::text, -- text
    now(),
    now(),
    now()
  );

  -- 7. Masukkan ke public.profiles
  INSERT INTO public.profiles (id, email, full_name, role, is_active)
  VALUES (v_user_id, v_clean_email, p_full_name, 'cashier', true)
  ON CONFLICT (id) DO UPDATE
  SET full_name = p_full_name, role = 'cashier', is_active = true;

  -- 8. Catat ke audit log
  INSERT INTO public.audit_logs (user_id, user_name, action, details)
  VALUES (
    auth.uid(),
    COALESCE((SELECT full_name FROM public.profiles WHERE id = auth.uid()), 'Pemilik'),
    'create_cashier',
    'Membuat akun kasir baru: ' || p_full_name || ' (' || v_clean_email || ')'
  );

  RETURN jsonb_build_object('success', true, 'user_id', v_user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
