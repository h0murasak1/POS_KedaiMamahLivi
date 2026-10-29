import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Header from '@/components/layout/Header'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Modal from '@/components/ui/Modal'
import Badge from '@/components/ui/Badge'
import EmptyState from '@/components/ui/EmptyState'
import { formatRupiah } from '@/lib/utils'
import toast from 'react-hot-toast'
import {
  Plus, Pencil, Archive, UtensilsCrossed, FolderPlus,
  GripVertical, Eye, EyeOff, Trash2, Upload, Image as ImageIcon, X,
} from 'lucide-react'

export default function MenuManagement() {
  const [categories, setCategories] = useState([])
  const [products, setProducts] = useState([])
  const [variants, setVariants] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('products')

  // Category modal
  const [catModal, setCatModal] = useState(false)
  const [editCat, setEditCat] = useState(null)
  const [catForm, setCatForm] = useState({ name: '', sort_order: 0 })

  // Product modal
  const [prodModal, setProdModal] = useState(false)
  const [editProd, setEditProd] = useState(null)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [prodForm, setProdForm] = useState({
    name: '', category_id: '', description: '', price: '', image_url: '', is_available: true,
  })

  // Variant modal
  const [varModal, setVarModal] = useState(false)
  const [varProduct, setVarProduct] = useState(null)
  const [varForm, setVarForm] = useState({ name: '', price_addition: '' })

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    try {
      const [{ data: c }, { data: p }, { data: v }] = await Promise.all([
        supabase.from('categories').select('*').order('sort_order'),
        supabase.from('products').select('*').order('name'),
        supabase.from('product_variants').select('*').order('name'),
      ])
      setCategories(c || [])
      setProducts(p || [])
      setVariants(v || [])
    } catch (e) {
      toast.error('Gagal memuat data menu')
    } finally {
      setLoading(false)
    }
  }

  // === Category CRUD ===
  const openCatModal = (cat = null) => {
    setEditCat(cat)
    setCatForm(cat ? { name: cat.name, sort_order: cat.sort_order } : { name: '', sort_order: categories.length })
    setCatModal(true)
  }

  const saveCat = async () => {
    if (!catForm.name.trim()) { toast.error('Nama kategori wajib diisi'); return }
    try {
      if (editCat) {
        const { error } = await supabase.from('categories').update(catForm).eq('id', editCat.id)
        if (error) throw error
        toast.success('Kategori diperbarui')
      } else {
        const { error } = await supabase.from('categories').insert(catForm)
        if (error) throw error
        toast.success('Kategori ditambahkan')
      }
      setCatModal(false)
      fetchData()
    } catch (e) {
      toast.error(e.message)
    }
  }

  const deleteCat = async (id) => {
    if (!confirm('Hapus kategori ini?')) return
    const { error } = await supabase.from('categories').delete().eq('id', id)
    if (error) toast.error(error.message)
    else { toast.success('Kategori dihapus'); fetchData() }
  }

  // === Product CRUD ===
  const openProdModal = (prod = null) => {
    setEditProd(prod)
    setProdForm(prod ? {
      name: prod.name, category_id: prod.category_id || '', description: prod.description || '',
      price: prod.price, image_url: prod.image_url || '', is_available: prod.is_available,
    } : { name: '', category_id: categories[0]?.id || '', description: '', price: '', image_url: '', is_available: true })
    setProdModal(true)
  }

  const saveProd = async () => {
    if (!prodForm.name.trim() || !prodForm.price) { toast.error('Nama dan harga wajib diisi'); return }
    const data = { ...prodForm, price: parseInt(prodForm.price) }
    try {
      if (editProd) {
        const { error } = await supabase.from('products').update(data).eq('id', editProd.id)
        if (error) throw error
        toast.success('Menu diperbarui')
      } else {
        const { error } = await supabase.from('products').insert(data)
        if (error) throw error
        toast.success('Menu ditambahkan')
      }
      setProdModal(false)
      fetchData()
    } catch (e) {
      toast.error(e.message)
    }
  }

  const toggleAvailability = async (prod) => {
    const { error } = await supabase.from('products').update({ is_available: !prod.is_available }).eq('id', prod.id)
    if (error) toast.error(error.message)
    else fetchData()
  }

  const handleImageFileChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast.error('File harus berupa gambar (JPG, PNG, WebP)')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Ukuran gambar maksimal 2 MB')
      return
    }

    setUploadingImage(true)
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${fileExt}`
      const filePath = `menu/${fileName}`

      const { data, error } = await supabase.storage
        .from('products')
        .upload(filePath, file, { cacheControl: '3600', upsert: true })

      if (error) throw error

      const { data: { publicUrl } } = supabase.storage
        .from('products')
        .getPublicUrl(filePath)

      setProdForm(prev => ({ ...prev, image_url: publicUrl }))
      toast.success('Foto berhasil diunggah!')
    } catch (err) {
      console.error(err)
      toast.error(err.message || 'Gagal mengunggah foto. Pastikan bucket "products" sudah dibuat di Supabase.')
    } finally {
      setUploadingImage(false)
    }
  }

  // === Variant CRUD ===
  const openVarModal = (product) => {
    setVarProduct(product)
    setVarForm({ name: '', price_addition: '' })
    setVarModal(true)
  }

  const saveVar = async () => {
    if (!varForm.name.trim()) { toast.error('Nama varian wajib diisi'); return }
    try {
      const { error } = await supabase.from('product_variants').insert({
        product_id: varProduct.id, name: varForm.name,
        price_addition: parseInt(varForm.price_addition) || 0,
      })
      if (error) throw error
      toast.success('Varian ditambahkan')
      setVarModal(false)
      fetchData()
    } catch (e) {
      toast.error(e.message)
    }
  }

  const deleteVar = async (id) => {
    if (!confirm('Hapus varian ini?')) return
    const { error } = await supabase.from('product_variants').delete().eq('id', id)
    if (error) toast.error(error.message)
    else { toast.success('Varian dihapus'); fetchData() }
  }

  const getCategoryName = (id) => categories.find(c => c.id === id)?.name || '-'

  return (
    <div>
      <Header title="Manajemen Menu" />
      <div className="p-4 sm:p-6 space-y-6">
        {/* Tabs */}
        <div className="flex gap-2 p-1 bg-pink-100/60 rounded-2xl w-fit border border-pink-200/60 backdrop-blur-xs">
          <button
            onClick={() => setActiveTab('products')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 ${
              activeTab === 'products'
                ? 'bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-sm shadow-pink-300'
                : 'text-gray-600 hover:text-primary-700 hover:bg-white/60'
            }`}
          >
            Daftar Menu ({products.length})
          </button>
          <button
            onClick={() => setActiveTab('categories')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 ${
              activeTab === 'categories'
                ? 'bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-sm shadow-pink-300'
                : 'text-gray-600 hover:text-primary-700 hover:bg-white/60'
            }`}
          >
            Kategori ({categories.length})
          </button>
        </div>

        {/* Categories Tab */}
        {activeTab === 'categories' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-gray-900">Kategori Menu</h3>
                <p className="text-xs text-gray-500">Kelola kelompok makanan dan minuman</p>
              </div>
              <Button size="sm" onClick={() => openCatModal()} icon={FolderPlus}>
                Tambah Kategori
              </Button>
            </div>
            <div className="space-y-2.5">
              {categories.map((cat) => (
                <Card key={cat.id} className="flex items-center justify-between p-3.5 sm:p-4 hover:border-pink-300 transition-all">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-pink-50 flex items-center justify-center text-primary-400">
                      <GripVertical className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="font-bold text-gray-900 text-sm sm:text-base">{cat.name}</span>
                      <span className="ml-2.5">
                        <Badge variant="primary">
                          {products.filter(p => p.category_id === cat.id).length} menu
                        </Badge>
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    <Button variant="ghost" size="sm" onClick={() => openCatModal(cat)} icon={Pencil} title="Edit kategori" />
                    <Button variant="ghost" size="sm" onClick={() => deleteCat(cat.id)} icon={Trash2} title="Hapus kategori" className="text-red-500 hover:text-red-700 hover:bg-red-50" />
                  </div>
                </Card>
              ))}
              {categories.length === 0 && (
                <EmptyState icon={FolderPlus} title="Belum ada kategori" description="Tambah kategori untuk mengelompokkan menu Anda" />
              )}
            </div>
          </div>
        )}

        {/* Products Tab */}
        {activeTab === 'products' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-gray-900">Daftar Menu</h3>
                <p className="text-xs text-gray-500">Kelola item makanan, minuman, dan varian harga</p>
              </div>
              <Button size="sm" onClick={() => openProdModal()} icon={Plus}>
                Tambah Menu
              </Button>
            </div>
            <div className="grid gap-3">
              {products.map((prod) => {
                const pv = variants.filter(v => v.product_id === prod.id)
                return (
                  <Card key={prod.id} className="p-3.5 sm:p-4 hover:border-pink-300 transition-all">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                        {prod.image_url ? (
                          <img
                            src={prod.image_url}
                            alt={prod.name}
                            className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl object-cover shrink-0 border border-pink-100 shadow-xs"
                          />
                        ) : (
                          <div className="w-14 h-14 sm:w-16 sm:h-16 bg-pink-50/80 rounded-xl flex items-center justify-center shrink-0 border border-pink-100/60 text-primary-400">
                            <UtensilsCrossed className="w-6 h-6" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-bold text-gray-900 text-sm sm:text-base">{prod.name}</p>
                            <Badge variant={prod.is_available ? 'success' : 'danger'}>
                              {prod.is_available ? 'Tersedia' : 'Habis'}
                            </Badge>
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5">{getCategoryName(prod.category_id)}</p>
                          <p className="text-sm sm:text-base font-extrabold text-primary-600 mt-0.5">
                            {formatRupiah(prod.price)}
                          </p>
                          {pv.length > 0 && (
                            <div className="flex gap-1.5 mt-1.5 flex-wrap">
                              {pv.map(v => (
                                <span
                                  key={v.id}
                                  className="inline-flex items-center gap-1 text-[11px] font-medium bg-pink-50 text-pink-700 border border-pink-200/80 px-2 py-0.5 rounded-full"
                                >
                                  {v.name} (+{formatRupiah(v.price_addition)})
                                  <button
                                    onClick={() => deleteVar(v.id)}
                                    className="text-pink-400 hover:text-red-600 font-bold ml-0.5"
                                    title="Hapus varian"
                                  >
                                    ×
                                  </button>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 self-end sm:self-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openVarModal(prod)}
                          icon={Plus}
                          title="Tambah varian"
                          className="text-primary-600 hover:bg-pink-50"
                        >
                          <span className="hidden sm:inline text-xs">Varian</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleAvailability(prod)}
                          icon={prod.is_available ? EyeOff : Eye}
                          title={prod.is_available ? 'Tandai habis' : 'Tandai tersedia'}
                          className={prod.is_available ? 'text-gray-500 hover:bg-gray-100' : 'text-primary-600 hover:bg-pink-50'}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openProdModal(prod)}
                          icon={Pencil}
                          title="Edit menu"
                          className="hover:bg-pink-50 hover:text-primary-600"
                        />
                      </div>
                    </div>
                  </Card>
                )
              })}
              {products.length === 0 && (
                <EmptyState icon={UtensilsCrossed} title="Belum ada menu" description="Tambah menu pertama Anda agar bisa dijual oleh kasir" />
              )}
            </div>
          </div>
        )}

        {/* Category Modal */}
        <Modal isOpen={catModal} onClose={() => setCatModal(false)} title={editCat ? 'Edit Kategori' : 'Tambah Kategori'} size="sm">
          <div className="space-y-4">
            <Input label="Nama Kategori" value={catForm.name} onChange={e => setCatForm({ ...catForm, name: e.target.value })} placeholder="Contoh: Minuman Segar" />
            <Input label="Urutan Prioritas" type="number" value={catForm.sort_order} onChange={e => setCatForm({ ...catForm, sort_order: parseInt(e.target.value) || 0 })} />
            <Button className="w-full" onClick={saveCat}>{editCat ? 'Simpan Perubahan' : 'Tambah Kategori'}</Button>
          </div>
        </Modal>

        {/* Product Modal */}
        <Modal isOpen={prodModal} onClose={() => setProdModal(false)} title={editProd ? 'Edit Menu' : 'Tambah Menu Baru'} size="md">
          <div className="space-y-4">
            <Input label="Nama Menu" value={prodForm.name} onChange={e => setProdForm({ ...prodForm, name: e.target.value })} placeholder="Contoh: Es Teh Manis" />
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1.5">Kategori Menu</label>
              <select
                value={prodForm.category_id}
                onChange={e => setProdForm({ ...prodForm, category_id: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-white border border-pink-200/90 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-400 text-sm text-gray-800 transition-all"
              >
                <option value="">Pilih kategori</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <Input label="Harga (Rp)" type="number" value={prodForm.price} onChange={e => setProdForm({ ...prodForm, price: e.target.value })} placeholder="15000" />
            <Input label="Deskripsi (Opsional)" value={prodForm.description} onChange={e => setProdForm({ ...prodForm, description: e.target.value })} placeholder="Deskripsi singkat menu" />
            
            {/* Upload Foto Menu */}
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1.5">Foto Menu</label>
              {prodForm.image_url ? (
                <div className="relative w-32 h-32 rounded-2xl overflow-hidden border border-pink-200 group shadow-xs">
                  <img src={prodForm.image_url} alt="Preview" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setProdForm(prev => ({ ...prev, image_url: '' }))}
                    className="absolute top-2 right-2 p-1.5 bg-red-600 text-white rounded-full opacity-80 hover:opacity-100 transition-opacity shadow-sm"
                    title="Hapus Foto"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <label className={`
                  flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-pink-200
                  rounded-2xl cursor-pointer hover:border-primary-400 hover:bg-pink-50/60 transition-colors
                  ${uploadingImage ? 'opacity-50 cursor-not-allowed' : ''}
                `}>
                  <div className="flex flex-col items-center justify-center pt-2 pb-3">
                    {uploadingImage ? (
                      <div className="flex items-center gap-2 text-sm text-primary-600 font-semibold">
                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Mengunggah foto...
                      </div>
                    ) : (
                      <>
                        <Upload className="w-6 h-6 text-primary-400 mb-1" />
                        <p className="text-xs text-gray-700 font-bold">Klik untuk upload foto menu</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">JPG, PNG, atau WebP (Maks. 2MB)</p>
                      </>
                    )}
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageFileChange}
                    disabled={uploadingImage}
                    className="hidden"
                  />
                </label>
              )}
            </div>

            <label className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-pink-50/50 cursor-pointer">
              <input
                type="checkbox"
                checked={prodForm.is_available}
                onChange={e => setProdForm({ ...prodForm, is_available: e.target.checked })}
                className="w-4 h-4 rounded text-primary-600 focus:ring-primary-400 border-gray-300 accent-primary-500"
              />
              <span className="text-sm font-semibold text-gray-800">Tersedia untuk dijual</span>
            </label>
            <Button className="w-full" onClick={saveProd}>{editProd ? 'Simpan Perubahan' : 'Tambah Menu'}</Button>
          </div>
        </Modal>

        {/* Variant Modal */}
        <Modal isOpen={varModal} onClose={() => setVarModal(false)} title={`Tambah Varian — ${varProduct?.name}`} size="sm">
          <div className="space-y-4">
            <Input label="Nama Varian" value={varForm.name} onChange={e => setVarForm({ ...varForm, name: e.target.value })} placeholder="Contoh: Dingin, Jumbo, Pedas" />
            <Input label="Harga Tambahan (Rp)" type="number" value={varForm.price_addition} onChange={e => setVarForm({ ...varForm, price_addition: e.target.value })} placeholder="3000" />
            <Button className="w-full" onClick={saveVar}>Tambah Varian</Button>
          </div>
        </Modal>
      </div>
    </div>
  )
}
