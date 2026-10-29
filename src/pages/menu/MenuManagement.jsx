import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Header from '@/components/layout/Header'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input, { fieldClass, FieldLabel } from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Modal from '@/components/ui/Modal'
import Badge from '@/components/ui/Badge'
import EmptyState from '@/components/ui/EmptyState'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { formatRupiah } from '@/lib/utils'
import toast from 'react-hot-toast'
import {
  Plus, Pencil, UtensilsCrossed, FolderPlus, Trash2, Upload, X, Search, Layers, Tag, Hash,
} from 'lucide-react'

function Switch({ checked, onChange, testId, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      data-testid={testId}
      className={`relative w-11 h-6 rounded-full transition-colors duration-200 shrink-0 ${checked ? 'bg-emerald-500' : 'bg-zinc-300'}`}
    >
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${checked ? 'translate-x-5' : ''}`} />
    </button>
  )
}

export default function MenuManagement() {
  const [categories, setCategories] = useState([])
  const [products, setProducts] = useState([])
  const [variants, setVariants] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('products')
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('all')
  const [confirmDel, setConfirmDel] = useState(null) // { type: 'cat' | 'var', id, name }

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
    const { error } = await supabase.from('product_variants').delete().eq('id', id)
    if (error) toast.error(error.message)
    else { toast.success('Varian dihapus'); fetchData() }
  }

  const getCategoryName = (id) => categories.find(c => c.id === id)?.name || '-'


  const q = search.toLowerCase()
  const visibleProducts = products.filter((p) =>
    (catFilter === 'all' || p.category_id === catFilter) &&
    (p.name.toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q))
  )
  const availableCount = products.filter((p) => p.is_available).length

  const handleConfirmDelete = async () => {
    if (!confirmDel) return
    if (confirmDel.type === 'cat') await deleteCat(confirmDel.id)
    else await deleteVar(confirmDel.id)
    setConfirmDel(null)
  }

  return (
    <div>
      <Header title="Menu & Kategori" subtitle={`${products.length} menu · ${availableCount} tersedia`} />
      <div className="p-4 sm:p-6 lg:p-8 space-y-5 max-w-[1400px] w-full">
        {/* Toolbar */}
        <div className="flex flex-col md:flex-row md:items-center gap-3 justify-between">
          <div className="flex gap-1 p-1 bg-zinc-100 rounded-2xl w-full md:w-fit" data-testid="menu-tabs">
            {[
              { id: 'products', label: 'Daftar Menu', count: products.length, icon: UtensilsCrossed },
              { id: 'categories', label: 'Kategori', count: categories.length, icon: Tag },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                data-testid={`menu-tab-${t.id}`}
                className={`flex-1 md:flex-none h-10 px-4 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-[background-color,color,box-shadow] ${activeTab === t.id ? 'bg-white text-zinc-900 shadow-[0_1px_3px_rgba(24,24,27,0.12)]' : 'text-zinc-500 hover:text-zinc-800'
                  }`}
              >
                <t.icon className="w-4 h-4" />
                {t.label}
                <span className={`min-w-6 h-5 px-1.5 rounded-full text-[11px] font-bold flex items-center justify-center ${activeTab === t.id ? 'bg-primary-100 text-primary-800' : 'bg-zinc-200 text-zinc-600'}`}>{t.count}</span>
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            {activeTab === 'products' && (
              <div className="relative flex-1 md:w-72">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari menu…" data-testid="menu-search-input" className={`${fieldClass} pl-10 bg-white`} />
              </div>
            )}
            {activeTab === 'products' ? (
              <Button onClick={() => openProdModal()} icon={Plus} data-testid="menu-add-product-button">
                <span className="hidden sm:inline">Tambah </span>Menu
              </Button>
            ) : (
              <Button onClick={() => openCatModal()} icon={FolderPlus} data-testid="menu-add-category-button" className="w-full md:w-auto">
                Tambah Kategori
              </Button>
            )}
          </div>
        </div>

        {/* Categories */}
        {activeTab === 'categories' && (
          loading ? (
            <div className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="h-16 animate-shimmer rounded-2xl" />)}</div>
          ) : categories.length === 0 ? (
            <EmptyState icon={FolderPlus} title="Belum ada kategori" description="Kelompokkan menu agar kasir lebih cepat menemukan pesanan." action={<Button onClick={() => openCatModal()} icon={Plus}>Tambah Kategori</Button>} />
          ) : (
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3 stagger" data-testid="menu-category-list">
              {categories.map((cat) => {
                const count = products.filter((p) => p.category_id === cat.id).length
                return (
                  <Card key={cat.id} className="p-4 flex items-center gap-3.5" data-testid={`menu-category-card-${cat.id}`}>
                    <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-primary-50 to-secondary-100 border border-primary-200/60 flex items-center justify-center font-heading font-bold text-primary-700 shrink-0">
                      {cat.name?.charAt(0)?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-zinc-900 truncate">{cat.name}</p>
                      <p className="text-xs text-zinc-500 mt-0.5 flex items-center gap-2">
                        <span>{count} menu</span>
                        <span className="inline-flex items-center gap-0.5 text-zinc-400"><Hash className="w-3 h-3" />{cat.sort_order}</span>
                      </p>
                    </div>
                    <button onClick={() => openCatModal(cat)} data-testid={`menu-category-edit-${cat.id}`} title="Edit" className="w-9 h-9 rounded-xl flex items-center justify-center text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 transition-colors">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => setConfirmDel({ type: 'cat', id: cat.id, name: cat.name })} data-testid={`menu-category-delete-${cat.id}`} title="Hapus" className="w-9 h-9 rounded-xl flex items-center justify-center text-zinc-400 hover:bg-red-50 hover:text-red-600 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </Card>
                )
              })}
            </div>
          )
        )}

        {/* Products */}
        {activeTab === 'products' && (
          <>
            <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0" data-testid="menu-category-filter">
              {[{ id: 'all', name: 'Semua' }, ...categories].map((c) => (
                <button
                  key={c.id}
                  onClick={() => setCatFilter(c.id)}
                  data-testid={`menu-filter-${c.id}`}
                  className={`shrink-0 h-9 px-4 rounded-full text-sm font-semibold border transition-[background-color,color,border-color] ${catFilter === c.id ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-white text-zinc-700 border-zinc-200 hover:border-primary-300'}`}
                >
                  {c.name}
                </button>
              ))}
            </div>

            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4">{[0, 1, 2, 3].map((i) => <div key={i} className="h-72 animate-shimmer rounded-2xl" />)}</div>
            ) : visibleProducts.length === 0 ? (
              <EmptyState
                icon={UtensilsCrossed}
                title={products.length === 0 ? 'Belum ada menu' : 'Menu tidak ditemukan'}
                description={products.length === 0 ? 'Tambahkan menu pertama agar bisa dijual oleh kasir.' : 'Coba kata kunci atau kategori lain.'}
                action={products.length === 0 && <Button onClick={() => openProdModal()} icon={Plus}>Tambah Menu</Button>}
              />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4 stagger" data-testid="menu-product-grid">
                {visibleProducts.map((prod) => {
                  const pv = variants.filter((v) => v.product_id === prod.id)
                  return (
                    <Card key={prod.id} padding={false} className={`overflow-hidden flex flex-col ${prod.is_available ? '' : 'opacity-75'}`} data-testid={`menu-product-card-${prod.id}`}>
                      <div className="relative aspect-[16/10] bg-zinc-100 overflow-hidden">
                        {prod.image_url ? (
                          <img src={prod.image_url} alt={prod.name} loading="lazy" className={`absolute inset-0 w-full h-full object-cover ${prod.is_available ? '' : 'grayscale'}`} />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-primary-50 via-secondary-50 to-primary-100 flex items-center justify-center">
                            <span className="font-heading text-5xl font-bold text-primary-200">{prod.name?.charAt(0)?.toUpperCase()}</span>
                          </div>
                        )}
                        <span className="absolute top-3 left-3"><Badge variant={prod.is_available ? 'success' : 'danger'} dot className="bg-white/95">{prod.is_available ? 'Tersedia' : 'Habis'}</Badge></span>
                        <button
                          onClick={() => openProdModal(prod)}
                          data-testid={`menu-product-edit-${prod.id}`}
                          title="Edit menu"
                          className="absolute top-3 right-3 w-9 h-9 rounded-xl bg-white/95 backdrop-blur text-zinc-700 hover:text-primary-700 flex items-center justify-center shadow-sm active:scale-90 transition-transform"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="p-4 flex-1 flex flex-col">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">{getCategoryName(prod.category_id)}</p>
                        <p className="font-semibold text-zinc-900 mt-0.5 leading-snug">{prod.name}</p>
                        {prod.description && <p className="text-xs text-zinc-500 mt-1 line-clamp-2">{prod.description}</p>}
                        <p className="font-mono font-semibold text-primary-700 mt-2 tabular">{formatRupiah(prod.price)}</p>

                        <div className="flex flex-wrap gap-1.5 mt-3">
                          {pv.map((v) => (
                            <span key={v.id} className="inline-flex items-center gap-1 h-7 pl-2.5 pr-1 rounded-full bg-zinc-100 text-[11px] font-semibold text-zinc-700">
                              {v.name} <span className="text-zinc-400">+{formatRupiah(v.price_addition)}</span>
                              <button onClick={() => setConfirmDel({ type: 'var', id: v.id, name: v.name })} data-testid={`menu-variant-delete-${v.id}`} title="Hapus varian" className="w-5 h-5 rounded-full hover:bg-red-100 hover:text-red-600 flex items-center justify-center text-zinc-400">
                                <X className="w-3 h-3" />
                              </button>
                            </span>
                          ))}
                          <button onClick={() => openVarModal(prod)} data-testid={`menu-product-add-variant-${prod.id}`} className="inline-flex items-center gap-1 h-7 px-2.5 rounded-full border border-dashed border-zinc-300 text-[11px] font-semibold text-zinc-600 hover:border-primary-400 hover:text-primary-700 transition-colors">
                            <Plus className="w-3 h-3" /> Varian
                          </button>
                        </div>

                        <div className="mt-auto pt-4">
                          <div className="flex items-center justify-between pt-3 border-t border-zinc-100">
                            <span className="text-xs font-semibold text-zinc-600">Tampilkan di kasir</span>
                            <Switch checked={prod.is_available} onChange={() => toggleAvailability(prod)} testId={`menu-product-toggle-${prod.id}`} label="Ketersediaan menu" />
                          </div>
                        </div>
                      </div>
                    </Card>
                  )
                })}
              </div>
            )}
          </>
        )}

        {/* Category Modal */}
        <Modal isOpen={catModal} onClose={() => setCatModal(false)} title={editCat ? 'Edit Kategori' : 'Kategori Baru'} icon={Tag} size="sm" testId="menu-category-modal"
          footer={<Button className="w-full" size="lg" onClick={saveCat} data-testid="menu-category-save-button">{editCat ? 'Simpan Perubahan' : 'Tambah Kategori'}</Button>}
        >
          <div className="space-y-4">
            <Input label="Nama Kategori" value={catForm.name} onChange={e => setCatForm({ ...catForm, name: e.target.value })} placeholder="Contoh: Minuman Segar" data-testid="menu-category-name-input" autoFocus />
            <Input label="Urutan Tampil" hint="angka kecil tampil duluan" type="number" value={catForm.sort_order} onChange={e => setCatForm({ ...catForm, sort_order: parseInt(e.target.value) || 0 })} data-testid="menu-category-order-input" />
          </div>
        </Modal>

        {/* Product Modal */}
        <Modal isOpen={prodModal} onClose={() => setProdModal(false)} title={editProd ? 'Edit Menu' : 'Menu Baru'} subtitle="Info ini tampil di layar kasir" icon={UtensilsCrossed} size="lg" testId="menu-product-modal"
          footer={<Button className="w-full" size="lg" onClick={saveProd} disabled={uploadingImage} data-testid="menu-product-save-button">{editProd ? 'Simpan Perubahan' : 'Tambah Menu'}</Button>}
        >
          <div className="grid sm:grid-cols-[200px_1fr] gap-5">
            <div>
              <FieldLabel>Foto Menu</FieldLabel>
              {prodForm.image_url ? (
                <div className="relative aspect-square rounded-2xl overflow-hidden border border-zinc-200 group">
                  <img src={prodForm.image_url} alt="Preview" className="w-full h-full object-cover" />
                  <button type="button" onClick={() => setProdForm(prev => ({ ...prev, image_url: '' }))} data-testid="menu-product-remove-image-button" title="Hapus foto"
                    className="absolute top-2 right-2 w-8 h-8 bg-zinc-900/80 hover:bg-red-600 text-white rounded-full flex items-center justify-center transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <label className={`flex flex-col items-center justify-center aspect-square rounded-2xl border-2 border-dashed border-zinc-300 bg-zinc-50 cursor-pointer hover:border-primary-400 hover:bg-primary-50/50 transition-colors text-center px-3 ${uploadingImage ? 'opacity-60 pointer-events-none' : ''}`} data-testid="menu-product-upload-dropzone">
                  {uploadingImage ? (
                    <span className="text-sm font-semibold text-primary-700 flex items-center gap-2">
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                      Mengunggah…
                    </span>
                  ) : (
                    <>
                      <span className="w-11 h-11 rounded-2xl bg-white border border-zinc-200 flex items-center justify-center mb-2"><Upload className="w-5 h-5 text-primary-600" /></span>
                      <span className="text-xs font-bold text-zinc-800">Unggah foto</span>
                      <span className="text-[10px] text-zinc-400 mt-0.5">JPG/PNG/WebP · maks 2MB</span>
                    </>
                  )}
                  <input type="file" accept="image/*" onChange={handleImageFileChange} disabled={uploadingImage} className="hidden" data-testid="menu-product-image-input" />
                </label>
              )}
            </div>
            <div className="space-y-4">
              <Input label="Nama Menu" value={prodForm.name} onChange={e => setProdForm({ ...prodForm, name: e.target.value })} placeholder="Contoh: Es Teh Manis" data-testid="menu-product-name-input" />
              <div className="grid grid-cols-2 gap-3">
                <Select label="Kategori" value={prodForm.category_id} onChange={e => setProdForm({ ...prodForm, category_id: e.target.value })} placeholder="Pilih kategori" options={categories.map(c => ({ value: c.id, label: c.name }))} data-testid="menu-product-category-select" />
                <Input label="Harga" prefix="Rp" type="number" inputMode="numeric" value={prodForm.price} onChange={e => setProdForm({ ...prodForm, price: e.target.value })} placeholder="15000" data-testid="menu-product-price-input" />
              </div>
              <div>
                <FieldLabel hint="opsional">Deskripsi</FieldLabel>
                <textarea value={prodForm.description} onChange={e => setProdForm({ ...prodForm, description: e.target.value })} placeholder="Deskripsi singkat menu" rows={2} data-testid="menu-product-description-input" className={`${fieldClass} resize-none`} />
              </div>
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-zinc-50 border border-zinc-200">
                <div>
                  <p className="text-sm font-semibold text-zinc-900">Tersedia untuk dijual</p>
                  <p className="text-xs text-zinc-500">Matikan jika stok sedang habis</p>
                </div>
                <Switch checked={prodForm.is_available} onChange={() => setProdForm({ ...prodForm, is_available: !prodForm.is_available })} testId="menu-product-available-switch" label="Tersedia" />
              </div>
            </div>
          </div>
        </Modal>

        {/* Variant Modal */}
        <Modal isOpen={varModal} onClose={() => setVarModal(false)} title="Varian Baru" subtitle={varProduct?.name} icon={Layers} size="sm" testId="menu-variant-modal"
          footer={<Button className="w-full" size="lg" onClick={saveVar} data-testid="menu-variant-save-button">Tambah Varian</Button>}
        >
          <div className="space-y-4">
            <Input label="Nama Varian" value={varForm.name} onChange={e => setVarForm({ ...varForm, name: e.target.value })} placeholder="Contoh: Dingin, Jumbo, Pedas" data-testid="menu-variant-name-input" autoFocus />
            <Input label="Harga Tambahan" prefix="Rp" type="number" inputMode="numeric" value={varForm.price_addition} onChange={e => setVarForm({ ...varForm, price_addition: e.target.value })} placeholder="3000" data-testid="menu-variant-price-input" />
            <div className="flex flex-wrap gap-1.5">
              {['Dingin', 'Panas', 'Jumbo', 'Pedas', 'Extra Telur'].map((n) => (
                <button key={n} type="button" onClick={() => setVarForm({ ...varForm, name: n })} data-testid={`menu-variant-suggest-${n.toLowerCase().replace(/\s+/g, '-')}`}
                  className="h-8 px-3 rounded-full text-xs font-semibold border border-zinc-200 bg-white hover:border-primary-300 hover:text-primary-800 transition-colors">
                  {n}
                </button>
              ))}
            </div>
          </div>
        </Modal>

        <ConfirmDialog
          isOpen={!!confirmDel}
          onClose={() => setConfirmDel(null)}
          onConfirm={handleConfirmDelete}
          title={confirmDel?.type === 'cat' ? 'Hapus kategori?' : 'Hapus varian?'}
          description={`“${confirmDel?.name}” akan dihapus permanen.`}
          confirmLabel="Ya, hapus"
        />
      </div>
    </div>
  )
}
