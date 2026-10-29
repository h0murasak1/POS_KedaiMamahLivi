-- ============================================
-- Sistem POS Kedai Mamah Livi
-- Database Migration v1.0
-- Jalankan SQL ini di Supabase SQL Editor
-- ============================================

-- ==========================================
-- 1. PROFILES — Profil pengguna dan role
-- ==========================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'cashier' CHECK (role IN ('owner', 'cashier')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, is_active)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'cashier'),
    true
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ==========================================
-- 2. CATEGORIES — Kategori menu
-- ==========================================
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==========================================
-- 3. PRODUCTS — Menu, harga, foto
-- ==========================================
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  price INTEGER NOT NULL DEFAULT 0,
  image_url TEXT DEFAULT '',
  is_available BOOLEAN NOT NULL DEFAULT true,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==========================================
-- 4. PRODUCT_VARIANTS — Varian menu
-- ==========================================
CREATE TABLE IF NOT EXISTS product_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price_addition INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==========================================
-- 5. ORDERS — Transaksi utama
-- ==========================================
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY, -- UUID dari client, untuk idempotency
  server_order_number BIGSERIAL, -- nomor urut server
  order_number TEXT, -- nomor lokal dari device
  cashier_id UUID NOT NULL REFERENCES profiles(id),
  cashier_name TEXT DEFAULT '',
  device_id TEXT DEFAULT '',
  created_at_local TIMESTAMPTZ NOT NULL,
  received_at_server TIMESTAMPTZ NOT NULL DEFAULT now(),
  subtotal INTEGER NOT NULL DEFAULT 0,
  discount_amount INTEGER NOT NULL DEFAULT 0,
  total_amount INTEGER NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('cash', 'qris', 'transfer', 'other')),
  cash_received INTEGER,
  change_amount INTEGER,
  payment_status TEXT NOT NULL DEFAULT 'paid' CHECK (payment_status IN ('paid', 'pending_verification', 'verified', 'refunded')),
  order_status TEXT NOT NULL DEFAULT 'completed' CHECK (order_status IN ('completed', 'cancelled', 'refunded')),
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique constraint for idempotent sync
CREATE UNIQUE INDEX IF NOT EXISTS orders_id_unique ON orders(id);

-- ==========================================
-- 6. ORDER_ITEMS — Rincian item transaksi
-- ==========================================
CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL, -- snapshot nama saat transaksi
  variant_id UUID,
  variant_name TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price INTEGER NOT NULL DEFAULT 0, -- snapshot harga saat transaksi
  variant_price_addition INTEGER NOT NULL DEFAULT 0,
  discount_amount INTEGER NOT NULL DEFAULT 0,
  subtotal INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==========================================
-- 7. PAYMENTS — Informasi pembayaran
-- ==========================================
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  payment_method TEXT NOT NULL,
  amount INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'completed',
  reference_number TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==========================================
-- 8. AUDIT_LOGS — Aktivitas penting
-- ==========================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id),
  user_name TEXT,
  action TEXT NOT NULL,
  details TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==========================================
-- 9. STORE_SETTINGS — Konfigurasi kedai
-- ==========================================
CREATE TABLE IF NOT EXISTS store_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Insert default settings
INSERT INTO store_settings (key, value) VALUES
  ('store_name', 'Kedai Mamah Livi'),
  ('store_address', ''),
  ('store_phone', ''),
  ('receipt_footer', 'Terima kasih telah berbelanja!'),
  ('currency', 'IDR')
ON CONFLICT (key) DO NOTHING;

-- ==========================================
-- 10. ROW LEVEL SECURITY (RLS)
-- ==========================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_settings ENABLE ROW LEVEL SECURITY;

-- Helper function: check if user is owner
CREATE OR REPLACE FUNCTION is_owner()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'owner'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- PROFILES policies
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (id = auth.uid());
CREATE POLICY "Owner can view all profiles" ON profiles
  FOR SELECT USING (is_owner());
CREATE POLICY "Owner can update profiles" ON profiles
  FOR UPDATE USING (is_owner());
CREATE POLICY "Owner can insert profiles" ON profiles
  FOR INSERT WITH CHECK (is_owner());

-- CATEGORIES policies (semua user bisa baca, owner bisa CRUD)
CREATE POLICY "Anyone can view categories" ON categories
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Owner can manage categories" ON categories
  FOR ALL USING (is_owner());

-- PRODUCTS policies
CREATE POLICY "Anyone can view products" ON products
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Owner can manage products" ON products
  FOR ALL USING (is_owner());

-- PRODUCT_VARIANTS policies
CREATE POLICY "Anyone can view variants" ON product_variants
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Owner can manage variants" ON product_variants
  FOR ALL USING (is_owner());

-- ORDERS policies
CREATE POLICY "Owner can view all orders" ON orders
  FOR SELECT USING (is_owner());
CREATE POLICY "Cashier can view own orders" ON orders
  FOR SELECT USING (cashier_id = auth.uid());
CREATE POLICY "Authenticated users can insert orders" ON orders
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND cashier_id = auth.uid());
CREATE POLICY "Owner can update orders" ON orders
  FOR UPDATE USING (is_owner());

-- ORDER_ITEMS policies
CREATE POLICY "Owner can view all order items" ON order_items
  FOR SELECT USING (is_owner());
CREATE POLICY "Cashier can view own order items" ON order_items
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM orders WHERE orders.id = order_items.order_id AND orders.cashier_id = auth.uid())
  );
CREATE POLICY "Authenticated users can insert order items" ON order_items
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- PAYMENTS policies
CREATE POLICY "Owner can view all payments" ON payments
  FOR SELECT USING (is_owner());
CREATE POLICY "Authenticated users can insert payments" ON payments
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- AUDIT_LOGS policies
CREATE POLICY "Owner can view audit logs" ON audit_logs
  FOR SELECT USING (is_owner());
CREATE POLICY "Authenticated can insert audit logs" ON audit_logs
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- STORE_SETTINGS policies
CREATE POLICY "Anyone can view settings" ON store_settings
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Owner can manage settings" ON store_settings
  FOR ALL USING (is_owner());

-- ==========================================
-- 11. RPC: sync_transaction (Idempotent)
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

  -- Check if already exists (idempotent)
  SELECT EXISTS(SELECT 1 FROM orders WHERE id = v_order_id) INTO v_exists;

  IF v_exists THEN
    RETURN jsonb_build_object('status', 'already_exists', 'order_id', v_order_id);
  END IF;

  -- Insert order
  INSERT INTO orders (
    id, order_number, cashier_id, cashier_name, device_id,
    created_at_local, subtotal, discount_amount, total_amount,
    payment_method, cash_received, change_amount,
    payment_status, order_status
  ) VALUES (
    v_order_id,
    p_order->>'order_number',
    (p_order->>'cashier_id')::UUID,
    p_order->>'cashier_name',
    p_order->>'device_id',
    (p_order->>'created_at_local')::TIMESTAMPTZ,
    (p_order->>'subtotal')::INTEGER,
    (p_order->>'discount_amount')::INTEGER,
    (p_order->>'total_amount')::INTEGER,
    p_order->>'payment_method',
    (p_order->>'cash_received')::INTEGER,
    (p_order->>'change_amount')::INTEGER,
    p_order->>'payment_status',
    p_order->>'order_status'
  );

  -- Insert order items
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
      v_item->>'product_name',
      NULLIF(v_item->>'variant_id', '')::UUID,
      v_item->>'variant_name',
      (v_item->>'quantity')::INTEGER,
      (v_item->>'unit_price')::INTEGER,
      (v_item->>'variant_price_addition')::INTEGER,
      (v_item->>'subtotal')::INTEGER
    );
  END LOOP;

  -- Insert audit log
  INSERT INTO audit_logs (user_id, user_name, action, details)
  VALUES (
    (p_order->>'cashier_id')::UUID,
    p_order->>'cashier_name',
    'sync_transaction',
    'Transaksi ' || (p_order->>'order_number') || ' disinkronkan'
  );

  RETURN jsonb_build_object('status', 'created', 'order_id', v_order_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
