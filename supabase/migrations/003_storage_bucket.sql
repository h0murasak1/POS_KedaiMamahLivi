-- ==========================================
-- 13. Storage: Bucket products (Foto Menu)
-- ==========================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('products', 'products', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Public can view images
DROP POLICY IF EXISTS "Public Access Products" ON storage.objects;
CREATE POLICY "Public Access Products" ON storage.objects
  FOR SELECT USING (bucket_id = 'products');

-- Authenticated users (Owner) can upload
DROP POLICY IF EXISTS "Authenticated Upload Products" ON storage.objects;
CREATE POLICY "Authenticated Upload Products" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'products' AND auth.uid() IS NOT NULL);

-- Authenticated users can update & delete
DROP POLICY IF EXISTS "Authenticated Manage Products" ON storage.objects;
CREATE POLICY "Authenticated Manage Products" ON storage.objects
  FOR ALL USING (bucket_id = 'products' AND auth.uid() IS NOT NULL);
