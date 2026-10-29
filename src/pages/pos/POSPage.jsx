import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useSync } from '@/contexts/SyncContext'
import { supabase } from '@/lib/supabase'
import { db, getDeviceId } from '@/lib/db'
import Header from '@/components/layout/Header'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import { formatRupiah, generateId, generateOrderNumber, calculateCartTotals } from '@/lib/utils'
import toast from 'react-hot-toast'
import {
  Search,
  Plus,
  Minus,
  Trash2,
  ShoppingCart,
  CreditCard,
  Banknote,
  QrCode,
  Check,
  Printer,
  ArrowRight,
  X,
} from 'lucide-react'

export default function POSPage() {
  const { user, profile } = useAuth()
  const { isOnline, updateCounts } = useSync()

  const [categories, setCategories] = useState([])
  const [products, setProducts] = useState([])
  const [variants, setVariants] = useState([])
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')

  const [cart, setCart] = useState([])
  const [mobileCartOpen, setMobileCartOpen] = useState(false)
  const [showPayment, setShowPayment] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [cashReceived, setCashReceived] = useState('')
  const [discount, setDiscount] = useState(0)
  const [showReceipt, setShowReceipt] = useState(false)
  const [lastOrder, setLastOrder] = useState(null)
  const [variantModal, setVariantModal] = useState(null)
  const [loading, setLoading] = useState(true)

  const totalItemCount = useMemo(() => cart.reduce((sum, item) => sum + item.quantity, 0), [cart])

  useEffect(() => { loadMenuData() }, [])

  const loadMenuData = async () => {
    try {
      if (isOnline) {
        const [{ data: cats }, { data: prods }, { data: vars }] = await Promise.all([
          supabase.from('categories').select('*').order('sort_order'),
          supabase.from('products').select('*').eq('is_available', true).order('name'),
          supabase.from('product_variants').select('*').order('name'),
        ])
        if (cats) { setCategories(cats); await db.cached_categories.clear(); await db.cached_categories.bulkPut(cats) }
        if (prods) { setProducts(prods); await db.cached_products.clear(); await db.cached_products.bulkPut(prods) }
        if (vars) { setVariants(vars); await db.cached_variants.clear(); await db.cached_variants.bulkPut(vars) }
      } else {
        setCategories(await db.cached_categories.orderBy('sort_order').toArray())
        setProducts(await db.cached_products.toArray())
        setVariants(await db.cached_variants.toArray())
      }
    } catch (error) {
      console.error('Error loading menu:', error)
      setCategories(await db.cached_categories.toArray())
      setProducts(await db.cached_products.toArray())
      setVariants(await db.cached_variants.toArray())
    } finally {
      setLoading(false)
    }
  }

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchCat = selectedCategory === 'all' || p.category_id === selectedCategory
      const matchSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase())
      return matchCat && matchSearch
    })
  }, [products, selectedCategory, searchQuery])

  const cartTotals = useMemo(() => {
    const { subtotal } = calculateCartTotals(cart)
    return { subtotal, discount, total: Math.max(0, subtotal - discount) }
  }, [cart, discount])

  const change = useMemo(() => {
    return (parseFloat(cashReceived) || 0) - cartTotals.total
  }, [cashReceived, cartTotals.total])

  const addToCart = (product, variant = null) => {
    const cartItemId = variant ? `${product.id}_${variant.id}` : product.id
    const existing = cart.find((item) => item.cartItemId === cartItemId)
    if (existing) {
      setCart(cart.map((item) => item.cartItemId === cartItemId ? { ...item, quantity: item.quantity + 1 } : item))
    } else {
      setCart([...cart, {
        cartItemId, product_id: product.id, product_name: product.name, price: product.price,
        variant_id: variant?.id || null, variant_name: variant?.name || null,
        variant_price_addition: variant?.price_addition || 0, quantity: 1,
      }])
    }
    setVariantModal(null)
  }

  const handleProductClick = (product) => {
    const pv = variants.filter(v => v.product_id === product.id)
    if (pv.length > 0) setVariantModal({ product, variants: pv })
    else addToCart(product)
  }

  const updateQuantity = (cartItemId, delta) => {
    setCart(cart.map((item) => {
      if (item.cartItemId === cartItemId) {
        const nq = item.quantity + delta
        return nq > 0 ? { ...item, quantity: nq } : item
      }
      return item
    }).filter((item) => item.quantity > 0))
  }

  const removeFromCart = (id) => setCart(cart.filter((item) => item.cartItemId !== id))
  const clearCart = () => { setCart([]); setDiscount(0) }

  const processPayment = async () => {
    if (cart.length === 0) return
    if (paymentMethod === 'cash' && change < 0) { toast.error('Nominal pembayaran kurang'); return }

    try {
      const orderId = generateId()
      const orderNumber = generateOrderNumber()
      const deviceId = await getDeviceId()
      const now = new Date().toISOString()

      const order = {
        id: orderId, order_number: orderNumber, cashier_id: user.id,
        cashier_name: profile?.full_name || 'Kasir', device_id: deviceId,
        created_at_local: now, subtotal: cartTotals.subtotal,
        discount_amount: cartTotals.discount, total_amount: cartTotals.total,
        payment_method: paymentMethod,
        cash_received: paymentMethod === 'cash' ? parseFloat(cashReceived) || 0 : null,
        change_amount: paymentMethod === 'cash' ? Math.max(0, change) : null,
        payment_status: paymentMethod === 'cash' ? 'paid' : 'pending_verification',
        order_status: 'completed', sync_status: 'pending',
      }

      const orderItems = cart.map((item) => ({
        id: generateId(), order_id: orderId, product_id: item.product_id,
        product_name: item.product_name, variant_id: item.variant_id,
        variant_name: item.variant_name, quantity: item.quantity,
        unit_price: item.price, variant_price_addition: item.variant_price_addition,
        subtotal: (item.price + item.variant_price_addition) * item.quantity,
      }))

      // Offline-first: simpan ke IndexedDB dulu
      await db.local_orders.put(order)
      await db.local_order_items.bulkPut(orderItems)
      await db.sync_queue.put({
        id: generateId(), order_id: orderId, status: 'pending',
        created_at: now, last_attempt: null, retry_count: 0, error_message: null,
      })

      let currentSyncStatus = 'pending'

      // Coba langsung sync kalau online
      if (isOnline) {
        try {
          const { error } = await supabase.rpc('sync_transaction', { p_order: order, p_items: orderItems })
          if (!error) {
            currentSyncStatus = 'synced'
            await db.sync_queue.where('order_id').equals(orderId).modify({ status: 'synced' })
            await db.local_orders.update(orderId, { sync_status: 'synced' })
          } else {
            console.warn('Sync pending:', error)
          }
        } catch (err) {
          console.warn('Sync pending:', err)
          /* Tetap pending, akan sync nanti */
        }
      }

      await updateCounts()
      setLastOrder({ ...order, sync_status: currentSyncStatus, items: orderItems })
      setShowPayment(false)
      setShowReceipt(true)
      clearCart()
      setCashReceived('')
      setPaymentMethod('cash')
      toast.success('Transaksi berhasil!')
    } catch (error) {
      console.error('Error processing payment:', error)
      toast.error('Gagal memproses transaksi')
    }
  }

  const renderCartContent = () => (
    <>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {cart.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 py-16">
            <div className="w-16 h-16 rounded-3xl bg-pink-50 flex items-center justify-center mb-3 text-primary-400">
              <ShoppingCart className="w-8 h-8 opacity-60" />
            </div>
            <p className="text-sm font-bold text-gray-600">Keranjang masih kosong</p>
            <p className="text-xs text-gray-400 mt-0.5">Pilih menu favorit untuk menambahkan</p>
          </div>
        ) : (
          cart.map((item) => (
            <div key={item.cartItemId} className="bg-pink-50/40 rounded-2xl p-3.5 border border-pink-100/80 hover:border-pink-200 transition-all shadow-2xs">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0 pr-2">
                  <p className="text-sm font-bold text-gray-900 truncate">{item.product_name}</p>
                  {item.variant_name && <p className="text-xs font-semibold text-primary-500">{item.variant_name}</p>}
                  <p className="text-xs text-primary-600 font-extrabold mt-0.5">{formatRupiah(item.price + item.variant_price_addition)}</p>
                </div>
                <button
                  onClick={() => removeFromCart(item.cartItemId)}
                  className="p-1.5 text-gray-400 hover:text-rose-500 rounded-lg active:scale-90 transition-transform"
                  aria-label="Hapus item"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => updateQuantity(item.cartItemId, -1)}
                    className="w-8 h-8 rounded-xl bg-white border border-pink-200 text-primary-700 flex items-center justify-center active:bg-pink-50 active:scale-90 transition-all shadow-2xs"
                    aria-label="Kurang"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-sm font-black text-gray-900 w-8 text-center">{item.quantity}</span>
                  <button
                    onClick={() => updateQuantity(item.cartItemId, 1)}
                    className="w-8 h-8 rounded-xl bg-white border border-pink-200 text-primary-700 flex items-center justify-center active:bg-pink-50 active:scale-90 transition-all shadow-2xs"
                    aria-label="Tambah"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
                <p className="text-sm font-black text-gray-900">
                  {formatRupiah((item.price + item.variant_price_addition) * item.quantity)}
                </p>
              </div>
            </div>
          ))
        )}
      </div>

      {cart.length > 0 && (
        <div className="border-t border-pink-100 p-4 bg-white space-y-3 shrink-0 shadow-lg shadow-pink-100/20">
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between text-gray-500 font-medium text-xs sm:text-sm">
              <span>Subtotal</span>
              <span>{formatRupiah(cartTotals.subtotal)}</span>
            </div>
            {cartTotals.discount > 0 && (
              <div className="flex justify-between text-emerald-600 font-bold text-xs sm:text-sm">
                <span>Diskon</span>
                <span>-{formatRupiah(cartTotals.discount)}</span>
              </div>
            )}
            <div className="flex justify-between text-base sm:text-lg font-black text-gray-900 pt-2 border-t border-pink-100">
              <span>Total Tagihan</span>
              <span className="text-primary-600">{formatRupiah(cartTotals.total)}</span>
            </div>
          </div>
          <Button
            size="lg"
            className="w-full py-3.5 text-base font-extrabold shadow-lg shadow-primary-200/50 active:scale-[0.98] transition-transform"
            onClick={() => {
              setMobileCartOpen(false)
              setShowPayment(true)
            }}
            icon={CreditCard}
          >
            Bayar ({formatRupiah(cartTotals.total)})
          </Button>
        </div>
      )}
    </>
  )

  return (
    <div className="h-[100dvh] flex flex-col overflow-hidden bg-gradient-to-br from-pink-50/40 via-white to-pink-50/20">
      <Header title="Kasir (POS)" />
      <div className="flex-1 flex overflow-hidden relative">
        {/* Menu Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="p-3 sm:p-4 border-b border-pink-100/80 bg-white/90 backdrop-blur-md">
            <div className="relative mb-2.5 sm:mb-3">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-primary-400" />
              <input type="text" placeholder="Cari menu lezat..." value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 text-sm sm:text-base border border-pink-200 rounded-2xl bg-pink-50/30 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-400/50 focus:border-primary-500 transition-all placeholder:text-gray-400" />
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
              <button onClick={() => setSelectedCategory('all')}
                className={`px-4 py-2 rounded-2xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all active:scale-95 ${
                  selectedCategory === 'all' 
                    ? 'bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-md shadow-primary-200/40' 
                    : 'bg-white border border-pink-200 text-gray-700 hover:bg-pink-50/80 hover:text-primary-700 shadow-2xs'
                }`}>
                Semua Menu
              </button>
              {categories.map((cat) => (
                <button key={cat.id} onClick={() => setSelectedCategory(cat.id)}
                  className={`px-4 py-2 rounded-2xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all active:scale-95 ${
                    selectedCategory === cat.id 
                      ? 'bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-md shadow-primary-200/40' 
                      : 'bg-white border border-pink-200 text-gray-700 hover:bg-pink-50/80 hover:text-primary-700 shadow-2xs'
                  }`}>
                  {cat.name}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 sm:p-4">
            {loading ? (
              <div className="flex items-center justify-center h-full text-gray-400">Memuat menu...</div>
            ) : filteredProducts.length === 0 ? (
              <div className="flex items-center justify-center h-full text-gray-400">Tidak ada menu ditemukan</div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-4 pb-24 lg:pb-4">
                {filteredProducts.map((product) => (
                  <button key={product.id} onClick={() => handleProductClick(product)}
                    className="bg-white rounded-3xl border border-pink-100/90 p-3 text-left hover:shadow-lg hover:shadow-primary-100/40 hover:border-primary-300 active:scale-[0.96] transition-all flex flex-col justify-between group relative overflow-hidden">
                    <div className="w-full">
                      {product.image_url ? (
                        <div className="w-full aspect-square bg-pink-50/50 rounded-2xl mb-2.5 overflow-hidden shadow-2xs border border-pink-100/60 group-hover:scale-[1.02] transition-transform">
                          <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className="w-full aspect-square bg-gradient-to-br from-pink-50 to-pink-100/60 rounded-2xl mb-2.5 flex items-center justify-center border border-pink-100/60 group-hover:scale-[1.02] transition-transform">
                          <ShoppingCart className="w-8 h-8 text-primary-300" />
                        </div>
                      )}
                      <p className="text-xs sm:text-sm font-bold text-gray-900 line-clamp-2 leading-tight group-hover:text-primary-600 transition-colors">
                        {product.name}
                      </p>
                    </div>
                    <div className="flex items-center justify-between w-full mt-2.5 pt-2 border-t border-pink-50">
                      <p className="text-xs sm:text-sm font-black text-primary-600">{formatRupiah(product.price)}</p>
                      <span className="w-6 h-6 rounded-full bg-primary-50 text-primary-600 group-hover:bg-primary-500 group-hover:text-white flex items-center justify-center transition-colors shadow-2xs text-xs font-bold">
                        +
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Cart Sidebar for Tablet Landscape & Desktop */}
        <aside className="hidden lg:flex w-80 xl:w-96 bg-white/95 backdrop-blur-md border-l border-pink-100 flex-col shrink-0 shadow-lg shadow-pink-100/30">
          <div className="p-4 border-b border-pink-100 flex items-center justify-between bg-pink-50/40">
            <h3 className="font-extrabold text-gray-900 flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-primary-600" />
              <span>Keranjang</span>
              <span className="bg-primary-500 text-white text-xs px-2 py-0.5 rounded-full font-black">
                {totalItemCount}
              </span>
            </h3>
            {cart.length > 0 && (
              <button onClick={clearCart} className="text-xs text-rose-500 hover:text-rose-700 font-semibold hover:underline">
                Hapus Semua
              </button>
            )}
          </div>
          {renderCartContent()}
        </aside>
      </div>

      {/* Floating Bottom Bar for Mobile & Tablet Portrait */}
      {cart.length > 0 && (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 p-3 bg-white/95 backdrop-blur-md border-t border-pink-200/80 shadow-2xl shadow-primary-900/20 z-20">
          <div className="flex items-center gap-2.5">
            {/* View/Edit Cart Drawer Button */}
            <button
              onClick={() => setMobileCartOpen(true)}
              className="flex-1 bg-pink-50 hover:bg-pink-100/80 active:bg-pink-200/80 py-2.5 px-3.5 rounded-2xl border border-pink-200/80 flex items-center justify-between text-left transition-colors shadow-2xs"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="bg-gradient-to-r from-primary-500 to-primary-600 text-white px-2.5 py-0.5 rounded-xl text-xs font-black shrink-0 shadow-xs">
                  {totalItemCount}
                </span>
                <div className="truncate">
                  <p className="text-[10px] text-gray-500 font-semibold leading-tight">Total Pesanan</p>
                  <p className="text-sm font-black text-gray-900 leading-tight truncate">{formatRupiah(cartTotals.total)}</p>
                </div>
              </div>
              <span className="text-xs font-bold text-primary-600 shrink-0">Rincian</span>
            </button>

            {/* Direct Pay button */}
            <button
              onClick={() => setShowPayment(true)}
              className="bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 active:scale-95 text-white font-extrabold py-3 px-6 rounded-2xl shadow-lg shadow-primary-300/50 flex items-center gap-2 text-sm sm:text-base shrink-0 transition-all"
            >
              <CreditCard className="w-4 h-4" />
              <span>Bayar</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Mobile Cart Drawer */}
      {mobileCartOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileCartOpen(false)}
          />
          <div className="relative bg-white rounded-t-3xl max-h-[85vh] flex flex-col shadow-2xl z-10 animate-fade-in-up border-t border-pink-200">
            <div className="p-4 border-b border-pink-100 flex items-center justify-between bg-pink-50/50">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-primary-600" />
                <h3 className="font-extrabold text-gray-900 text-base">Keranjang Pesanan</h3>
                <span className="bg-primary-500 text-white text-xs px-2.5 py-0.5 rounded-full font-black">
                  {totalItemCount}
                </span>
              </div>
              <div className="flex items-center gap-3">
                {cart.length > 0 && (
                  <button onClick={clearCart} className="text-xs text-rose-500 hover:text-rose-700 font-bold">
                    Hapus Semua
                  </button>
                )}
                <button
                  onClick={() => setMobileCartOpen(false)}
                  className="p-1.5 rounded-full bg-white border border-pink-200 text-gray-500 hover:text-primary-600 shadow-2xs"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-hidden flex flex-col max-h-[65vh]">
              {renderCartContent()}
            </div>
          </div>
        </div>
      )}

      {/* Variant Modal */}
      <Modal isOpen={!!variantModal} onClose={() => setVariantModal(null)} title={`Pilih Varian — ${variantModal?.product?.name}`} size="sm">
        {variantModal && (
          <div className="space-y-2.5">
            <button onClick={() => addToCart(variantModal.product)}
              className="w-full text-left p-3.5 rounded-2xl border border-pink-100 hover:bg-pink-50 hover:border-primary-300 transition-all shadow-2xs active:scale-[0.98]">
              <p className="text-sm font-bold text-gray-900">Regular (Standar)</p>
              <p className="text-sm font-black text-primary-600 mt-0.5">{formatRupiah(variantModal.product.price)}</p>
            </button>
            {variantModal.variants.map((v) => (
              <button key={v.id} onClick={() => addToCart(variantModal.product, v)}
                className="w-full text-left p-3.5 rounded-2xl border border-pink-100 hover:bg-pink-50 hover:border-primary-300 transition-all shadow-2xs active:scale-[0.98]">
                <p className="text-sm font-bold text-gray-900">{v.name}</p>
                <p className="text-sm font-black text-primary-600 mt-0.5">
                  {formatRupiah(variantModal.product.price + v.price_addition)}
                  {v.price_addition > 0 && <span className="text-xs text-gray-400 font-normal ml-1">(+{formatRupiah(v.price_addition)})</span>}
                </p>
              </button>
            ))}
          </div>
        )}
      </Modal>

      {/* Payment Modal with Sticky Footer */}
      <Modal
        isOpen={showPayment}
        onClose={() => setShowPayment(false)}
        title="Pembayaran Pesanan"
        size="md"
        footer={
          <Button
            size="lg"
            className="w-full py-4 text-base font-black shadow-lg shadow-primary-200/50 active:scale-[0.98] transition-transform"
            onClick={processPayment}
            disabled={paymentMethod === 'cash' && change < 0}
            icon={Check}
          >
            {paymentMethod === 'cash' && change < 0
              ? 'Nominal Pembayaran Kurang'
              : `Selesaikan Pembayaran (${formatRupiah(cartTotals.total)})`}
          </Button>
        }
      >
        <div className="space-y-4">
          <div className="text-center p-4 bg-gradient-to-br from-pink-50 via-primary-50 to-pink-50 rounded-2xl border border-pink-200/70 shadow-xs">
            <p className="text-xs font-bold text-primary-600 uppercase tracking-wider">Total Tagihan</p>
            <p className="text-3xl sm:text-4xl font-black text-primary-700 mt-1">{formatRupiah(cartTotals.total)}</p>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-2 uppercase tracking-wide">Pilih Metode Pembayaran</label>
            <div className="grid grid-cols-3 gap-2.5">
              {[
                { value: 'cash', label: 'Tunai', icon: Banknote },
                { value: 'qris', label: 'QRIS', icon: QrCode },
                { value: 'transfer', label: 'Transfer', icon: CreditCard },
              ].map((m) => (
                <button
                  key={m.value}
                  onClick={() => setPaymentMethod(m.value)}
                  className={`p-3 rounded-2xl border text-center transition-all ${
                    paymentMethod === m.value
                      ? 'border-primary-500 bg-pink-50 text-primary-800 font-black shadow-xs scale-[1.02]'
                      : 'border-pink-100 bg-white hover:bg-pink-50/50 text-gray-700'
                  }`}
                >
                  <m.icon className={`w-5 h-5 mx-auto mb-1.5 ${paymentMethod === m.value ? 'text-primary-600' : 'text-gray-500'}`} />
                  <span className="text-xs font-bold">{m.label}</span>
                </button>
              ))}
            </div>
          </div>

          {paymentMethod === 'cash' && (
            <div className="space-y-2.5">
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide">Uang Diterima</label>
              <input
                type="number"
                value={cashReceived}
                onChange={(e) => setCashReceived(e.target.value)}
                placeholder="Nominal uang diterima"
                autoFocus
                className="w-full px-4 py-3 border border-pink-200 rounded-2xl text-lg font-black focus:outline-none focus:ring-2 focus:ring-primary-400/50 focus:border-primary-500 bg-white"
              />
              <div className="flex gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => setCashReceived(cartTotals.total.toString())}
                  className="px-3 py-1.5 text-xs font-black bg-pink-50 text-primary-700 border border-primary-200 rounded-xl hover:bg-pink-100 active:scale-95 transition-all shadow-2xs"
                >
                  Uang Pas
                </button>
                {[10000, 20000, 50000, 100000]
                  .filter((v, i, a) => a.indexOf(v) === i)
                  .map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setCashReceived(amt.toString())}
                      className="px-3 py-1.5 text-xs font-semibold bg-white border border-gray-200 hover:bg-pink-50/50 rounded-xl text-gray-700 active:scale-95 transition-all shadow-2xs"
                    >
                      {formatRupiah(amt)}
                    </button>
                  ))}
              </div>
              {parseFloat(cashReceived) >= cartTotals.total && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between shadow-2xs">
                  <p className="text-xs font-bold text-emerald-800">Kembalian</p>
                  <p className="text-xl font-black text-emerald-700">{formatRupiah(change)}</p>
                </div>
              )}
            </div>
          )}

          {paymentMethod !== 'cash' && !isOnline && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-xs font-semibold text-amber-800">
              ⚠️ Pembayaran {paymentMethod === 'qris' ? 'QRIS' : 'Transfer'} dalam mode offline akan disimpan sebagai "Menunggu Verifikasi".
            </div>
          )}
        </div>
      </Modal>

      {/* Receipt Modal */}
      <Modal isOpen={showReceipt} onClose={() => setShowReceipt(false)} title="Struk Transaksi" size="sm">
        {lastOrder && (
          <div className="receipt-print">
            <div className="text-center mb-4">
              <h3 className="font-bold text-lg">Kedai Mamah Livi</h3>
              <p className="text-xs text-gray-500">{lastOrder.order_number}</p>
              <p className="text-xs text-gray-500">{new Date(lastOrder.created_at_local).toLocaleString('id-ID')}</p>
              <p className="text-xs text-gray-500">Kasir: {lastOrder.cashier_name}</p>
            </div>
            <div className="border-t border-dashed pt-3 space-y-2">
              {lastOrder.items.map((item) => (
                <div key={item.id} className="flex justify-between text-sm">
                  <div>
                    <span>{item.product_name}</span>
                    {item.variant_name && <span className="text-gray-500"> ({item.variant_name})</span>}
                    <span className="text-gray-500"> x{item.quantity}</span>
                  </div>
                  <span>{formatRupiah(item.subtotal)}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-dashed mt-3 pt-3 space-y-1">
              <div className="flex justify-between text-sm"><span>Subtotal</span><span>{formatRupiah(lastOrder.subtotal)}</span></div>
              {lastOrder.discount_amount > 0 && (
                <div className="flex justify-between text-sm text-green-600"><span>Diskon</span><span>-{formatRupiah(lastOrder.discount_amount)}</span></div>
              )}
              <div className="flex justify-between font-bold"><span>Total</span><span>{formatRupiah(lastOrder.total_amount)}</span></div>
              {lastOrder.payment_method === 'cash' && (
                <>
                  <div className="flex justify-between text-sm"><span>Tunai</span><span>{formatRupiah(lastOrder.cash_received)}</span></div>
                  <div className="flex justify-between text-sm"><span>Kembalian</span><span>{formatRupiah(lastOrder.change_amount)}</span></div>
                </>
              )}
            </div>
            {lastOrder.sync_status === 'synced' ? (
              <div className="text-center mt-3 text-xs text-green-600 font-medium">✓ Tersinkronisasi dengan server</div>
            ) : (
              <div className="text-center mt-3 text-xs text-yellow-600">⚠ Disimpan di perangkat lokal (menunggu sinkronisasi)</div>
            )}
            <div className="text-center mt-4 text-xs text-gray-400">Terima kasih telah berbelanja!</div>
          </div>
        )}
        <div className="mt-4 space-y-2">
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => window.print()} icon={Printer}>Cetak Struk</Button>
            <Button className="flex-1" onClick={() => setShowReceipt(false)}>Selesai</Button>
          </div>
          <button
            type="button"
            onClick={() => {
              setShowReceipt(false)
              navigate('/transaksi')
            }}
            className="w-full text-center text-xs text-red-500 hover:text-red-700 py-1 transition-colors"
          >
            Ada kesalahan input? Batalkan transaksi ini di Riwayat
          </button>
        </div>
      </Modal>
    </div>
  )
}
