import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useSync } from '@/contexts/SyncContext'
import { supabase } from '@/lib/supabase'
import { db, getDeviceId } from '@/lib/db'
import Header from '@/components/layout/Header'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import Kbd from '@/components/ui/Kbd'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { Skeleton } from '@/components/ui/LoadingSpinner'
import NumericKeypad from '@/components/pos/NumericKeypad'
import ReceiptView, { receiptToText } from '@/components/pos/ReceiptView'
import { useStoreSettings } from '@/lib/useStoreSettings'
import { playBeep, playSuccess, playError } from '@/lib/sound'
import { formatRupiah, generateId, generateOrderNumber, calculateCartTotals } from '@/lib/utils'
import confetti from 'canvas-confetti'
import toast from 'react-hot-toast'
import {
  Search, Plus, Minus, Trash2, ShoppingBag, CreditCard, Banknote, QrCode, Check, Printer,
  ArrowRight, X, Tag, UtensilsCrossed, Layers, MessageCircle, RotateCcw, ChevronUp, Percent,
  SearchX, Receipt as ReceiptIcon,
} from 'lucide-react'

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Tunai', icon: Banknote, hint: 'Hitung kembalian' },
  { value: 'qris', label: 'QRIS', icon: QrCode, hint: 'Scan e-wallet' },
  { value: 'transfer', label: 'Transfer', icon: CreditCard, hint: 'Rekening bank' },
]

// Smart cash suggestions: exact + nearest common denominations above the total
const cashSuggestions = (total) => {
  if (total <= 0) return []
  const set = new Set()
    ;[5000, 10000, 20000, 50000, 100000].forEach((step) => {
      const v = Math.ceil(total / step) * step
      if (v > total) set.add(v)
    })
  return [...set].sort((a, b) => a - b).slice(0, 4)
}

function ProductCard({ product, qty, variantCount, onClick, index }) {
  const [popKey, setPopKey] = useState(0)
  const handle = () => {
    setPopKey((k) => k + 1)
    onClick(product)
  }
  const inCart = qty > 0
  return (
    <button
      onClick={handle}
      data-testid={`pos-product-card-${product.id}`}
      className={`group relative bg-white rounded-2xl p-2 text-left flex flex-col border transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 active:translate-y-0
        ${inCart
          ? 'border-primary-400 shadow-[0_0_0_3px_rgba(249,115,22,0.15),0_12px_24px_-14px_rgba(234,88,12,0.5)]'
          : 'border-zinc-200/80 hover:border-primary-300 hover:shadow-[0_14px_28px_-16px_rgba(234,88,12,0.45)]'}`}
      style={{ animationDelay: `${Math.min(index, 12) * 25}ms` }}
    >
      <div key={popKey} className={`relative w-full aspect-[4/3] rounded-xl overflow-hidden ${popKey ? 'animate-pop' : ''}`}>
        {product.image_url ? (
          <img src={product.image_url} alt={product.name} loading="lazy" className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary-50 via-secondary-50 to-primary-100 flex items-center justify-center">
            <span className="font-heading text-3xl font-bold text-primary-300 select-none">{product.name?.charAt(0)?.toUpperCase()}</span>
            <UtensilsCrossed className="absolute bottom-2 right-2 w-4 h-4 text-primary-300" />
          </div>
        )}
        {variantCount > 0 && (
          <span className="absolute bottom-1.5 left-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/90 backdrop-blur text-[10px] font-bold text-zinc-700 shadow-sm">
            <Layers className="w-3 h-3" /> {variantCount} varian
          </span>
        )}
        {popKey > 0 && (
          <span key={`c${popKey}`} className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="w-11 h-11 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-lg animate-check-flash">
              <Check className="w-6 h-6" strokeWidth={3} />
            </span>
          </span>
        )}
      </div>
      {inCart && (
        <span
          key={`q${qty}`}
          data-testid={`pos-product-qty-badge-${product.id}`}
          className="absolute -top-2 -right-2 min-w-7 h-7 px-1.5 rounded-full bg-primary-600 text-white text-xs font-bold font-mono flex items-center justify-center border-2 border-white shadow-md animate-bump"
        >
          {qty}
        </span>
      )}
      <div className="px-1.5 pt-2.5 pb-1 flex-1 flex flex-col">
        <p className="text-[13px] sm:text-sm font-semibold text-zinc-900 line-clamp-2 leading-snug">{product.name}</p>
        <div className="mt-auto pt-2 flex items-center justify-between gap-1">
          <p className="font-mono text-[13px] sm:text-sm font-semibold text-primary-700 tabular">{formatRupiah(product.price)}</p>
          <span className={`w-7 h-7 rounded-lg flex items-center justify-center transition-[background-color,color,transform] duration-200 group-active:scale-90 ${inCart ? 'bg-primary-600 text-white' : 'bg-zinc-100 text-zinc-600 group-hover:bg-primary-600 group-hover:text-white'}`}>
            <Plus className="w-4 h-4" strokeWidth={2.5} />
          </span>
        </div>
      </div>
    </button>
  )
}

export default function POSPage() {
  const { user, profile } = useAuth()
  const { isOnline, updateCounts } = useSync()
  const navigate = useNavigate()
  const storeSettings = useStoreSettings()
  const searchRef = useRef(null)

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
  const [showDiscount, setShowDiscount] = useState(false)
  const [showReceipt, setShowReceipt] = useState(false)
  const [lastOrder, setLastOrder] = useState(null)
  const [variantModal, setVariantModal] = useState(null)
  const [confirmClear, setConfirmClear] = useState(false)
  const [processing, setProcessing] = useState(false)
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

  const categoryCounts = useMemo(() => {
    const counts = {}
    products.forEach((p) => { counts[p.category_id] = (counts[p.category_id] || 0) + 1 })
    return counts
  }, [products])

  const qtyByProduct = useMemo(() => {
    const m = {}
    cart.forEach((i) => { m[i.product_id] = (m[i.product_id] || 0) + i.quantity })
    return m
  }, [cart])

  const variantCountByProduct = useMemo(() => {
    const m = {}
    variants.forEach((v) => { m[v.product_id] = (m[v.product_id] || 0) + 1 })
    return m
  }, [variants])

  const cartTotals = useMemo(() => {
    const { subtotal } = calculateCartTotals(cart)
    const d = Math.min(discount, subtotal)
    return { subtotal, discount: d, total: Math.max(0, subtotal - d) }
  }, [cart, discount])

  const change = useMemo(() => {
    return (parseFloat(cashReceived) || 0) - cartTotals.total
  }, [cashReceived, cartTotals.total])

  const addToCart = (product, variant = null) => {
    const cartItemId = variant ? `${product.id}_${variant.id}` : product.id
    setCart((prev) => {
      const existing = prev.find((item) => item.cartItemId === cartItemId)
      if (existing) {
        return prev.map((item) => item.cartItemId === cartItemId ? { ...item, quantity: item.quantity + 1 } : item)
      }
      return [...prev, {
        cartItemId, product_id: product.id, product_name: product.name, price: product.price,
        variant_id: variant?.id || null, variant_name: variant?.name || null,
        variant_price_addition: variant?.price_addition || 0, quantity: 1,
      }]
    })
    playBeep()
    setVariantModal(null)
  }

  const handleProductClick = (product) => {
    const pv = variants.filter(v => v.product_id === product.id)
    if (pv.length > 0) setVariantModal({ product, variants: pv })
    else addToCart(product)
  }

  const updateQuantity = (cartItemId, delta) => {
    setCart((prev) => prev.map((item) => {
      if (item.cartItemId === cartItemId) {
        return { ...item, quantity: item.quantity + delta }
      }
      return item
    }).filter((item) => item.quantity > 0))
  }

  const clearCart = () => { setCart([]); setDiscount(0); setShowDiscount(false) }

  const openPayment = useCallback(() => {
    if (cart.length === 0) return
    setMobileCartOpen(false)
    setShowPayment(true)
  }, [cart.length])

  // Keyboard shortcuts (desktop): "/" or F2 search, F4 pay, Esc clears search
  useEffect(() => {
    const onKey = (e) => {
      const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)
      if ((e.key === '/' && !typing) || e.key === 'F2') {
        e.preventDefault()
        searchRef.current?.focus()
      } else if (e.key === 'F4') {
        e.preventDefault()
        if (!showPayment && !showReceipt) openPayment()
      } else if (e.key === 'Escape' && document.activeElement === searchRef.current) {
        setSearchQuery('')
        searchRef.current?.blur()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [openPayment, showPayment, showReceipt])

  const celebrate = () => {
    const colors = ['#ea580c', '#f59e0b', '#10b981', '#fb923c', '#ffffff']
    confetti({ particleCount: 90, spread: 75, origin: { y: 0.65 }, colors, zIndex: 9999, disableForReducedMotion: true })
    setTimeout(() => confetti({ particleCount: 50, angle: 60, spread: 60, origin: { x: 0, y: 0.7 }, colors, zIndex: 9999, disableForReducedMotion: true }), 180)
    setTimeout(() => confetti({ particleCount: 50, angle: 120, spread: 60, origin: { x: 1, y: 0.7 }, colors, zIndex: 9999, disableForReducedMotion: true }), 300)
  }

  const processPayment = async () => {
    if (cart.length === 0 || processing) return
    if (paymentMethod === 'cash' && change < 0) { playError(); toast.error('Nominal pembayaran kurang'); return }

    setProcessing(true)
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
      playSuccess()
      celebrate()
    } catch (error) {
      console.error('Error processing payment:', error)
      playError()
      toast.error('Gagal memproses transaksi')
    } finally {
      setProcessing(false)
    }
  }

  const shareWhatsApp = () => {
    if (!lastOrder) return
    const text = receiptToText(lastOrder, lastOrder.items, storeSettings)
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener')
  }

  const startNewOrder = () => {
    setShowReceipt(false)
    setTimeout(() => searchRef.current?.focus(), 50)
  }

  const renderCartItems = () => (
    <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2" data-testid="cart-items-list">
      {cart.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full text-center py-14" data-testid="cart-empty-state">
          <div className="relative mb-4">
            <div className="absolute inset-0 bg-primary-200/60 blur-2xl rounded-full" />
            <div className="relative w-20 h-20 rounded-[28px] bg-gradient-to-br from-primary-50 to-secondary-100 border border-primary-200/60 flex items-center justify-center animate-float">
              <ShoppingBag className="w-9 h-9 text-primary-500" />
            </div>
          </div>
          <p className="font-heading font-bold text-zinc-900">Belum ada pesanan</p>
          <p className="text-xs text-zinc-500 mt-1 max-w-[220px]">Ketuk menu di sebelah kiri untuk mulai mencatat pesanan pelanggan.</p>
        </div>
      ) : (
        cart.map((item) => {
          const unit = item.price + item.variant_price_addition
          return (
            <div
              key={item.cartItemId}
              data-testid={`cart-item-${item.cartItemId}`}
              className="group flex gap-3 p-3 rounded-2xl bg-white border border-zinc-200/80 hover:border-primary-200 hover:bg-primary-50/30 transition-[background-color,border-color] animate-slide-in-right"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-zinc-900 leading-snug truncate">{item.product_name}</p>
                {item.variant_name && (
                  <span className="inline-block mt-0.5 text-[10px] font-bold uppercase tracking-wide text-primary-700 bg-primary-50 border border-primary-200/70 px-1.5 py-0.5 rounded-md">{item.variant_name}</span>
                )}
                <p className="font-mono text-xs text-zinc-500 mt-1 tabular">{formatRupiah(unit)}</p>
              </div>
              <div className="flex flex-col items-end justify-between gap-2 shrink-0">
                <p className="font-mono text-sm font-semibold text-zinc-900 tabular" data-testid={`cart-item-subtotal-${item.cartItemId}`}>{formatRupiah(unit * item.quantity)}</p>
                <div className="flex items-center gap-1 bg-zinc-100 rounded-xl p-0.5">
                  <button
                    onClick={() => updateQuantity(item.cartItemId, -1)}
                    data-testid={`cart-item-qty-dec-${item.cartItemId}`}
                    className="w-8 h-8 rounded-lg bg-white text-zinc-700 flex items-center justify-center shadow-2xs hover:text-red-600 active:scale-90 transition-[color,transform]"
                    aria-label="Kurangi"
                  >
                    {item.quantity === 1 ? <Trash2 className="w-3.5 h-3.5" /> : <Minus className="w-3.5 h-3.5" />}
                  </button>
                  <span key={item.quantity} className="font-mono text-sm font-bold text-zinc-900 w-7 text-center animate-bump" data-testid={`cart-item-qty-${item.cartItemId}`}>{item.quantity}</span>
                  <button
                    onClick={() => updateQuantity(item.cartItemId, 1)}
                    data-testid={`cart-item-qty-inc-${item.cartItemId}`}
                    className="w-8 h-8 rounded-lg bg-primary-600 text-white flex items-center justify-center shadow-2xs hover:bg-primary-700 active:scale-90 transition-[background-color,transform]"
                    aria-label="Tambah"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )
        })
      )}
    </div>
  )

  const renderCartSummary = () => cart.length > 0 && (
    <div className="border-t border-zinc-200/80 p-4 bg-white space-y-3 shrink-0">
      {/* Discount */}
      {showDiscount ? (
        <div className="p-3 rounded-2xl bg-emerald-50/60 border border-emerald-200 animate-fade-in-up space-y-2" data-testid="cart-discount-panel">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-emerald-800 flex items-center gap-1.5"><Tag className="w-3.5 h-3.5" /> Diskon (Rp)</p>
            <button onClick={() => { setDiscount(0); setShowDiscount(false) }} className="text-[11px] font-semibold text-emerald-700 hover:underline" data-testid="cart-discount-remove-button">Hapus</button>
          </div>
          <input
            type="text"
            inputMode="numeric"
            value={discount ? discount.toLocaleString('id-ID') : ''}
            onChange={(e) => setDiscount(parseInt(e.target.value.replace(/\D/g, '')) || 0)}
            placeholder="0"
            data-testid="cart-discount-input"
            className="w-full h-10 px-3 rounded-xl border border-emerald-200 bg-white font-mono text-sm font-semibold focus:outline-none focus:ring-4 focus:ring-emerald-500/15 focus:border-emerald-500"
          />
          <div className="flex gap-1.5">
            {[5, 10, 15, 20].map((pct) => (
              <button
                key={pct}
                onClick={() => setDiscount(Math.round((cartTotals.subtotal * pct) / 100))}
                data-testid={`cart-discount-pct-${pct}`}
                className="flex-1 h-8 rounded-lg bg-white border border-emerald-200 text-xs font-bold text-emerald-800 hover:bg-emerald-100 active:scale-95 transition-[background-color,transform]"
              >
                {pct}%
              </button>
            ))}
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowDiscount(true)}
          data-testid="cart-add-discount-button"
          className="w-full flex items-center justify-center gap-1.5 h-9 rounded-xl border border-dashed border-zinc-300 text-xs font-semibold text-zinc-600 hover:border-emerald-400 hover:text-emerald-700 hover:bg-emerald-50/50 transition-colors"
        >
          <Percent className="w-3.5 h-3.5" /> Tambah diskon
        </button>
      )}

      <div className="space-y-1.5 text-sm">
        <div className="flex justify-between text-zinc-500">
          <span>Subtotal · {totalItemCount} item</span>
          <span className="font-mono tabular">{formatRupiah(cartTotals.subtotal)}</span>
        </div>
        {cartTotals.discount > 0 && (
          <div className="flex justify-between text-emerald-700 font-semibold">
            <span>Diskon</span>
            <span className="font-mono tabular">-{formatRupiah(cartTotals.discount)}</span>
          </div>
        )}
        <div className="flex items-end justify-between pt-2 border-t border-dashed border-zinc-200">
          <span className="text-sm font-semibold text-zinc-700">Total</span>
          <span className="font-mono text-2xl font-bold text-zinc-900 tabular tracking-tight" data-testid="cart-total-amount">{formatRupiah(cartTotals.total)}</span>
        </div>
      </div>
      <button
        onClick={openPayment}
        data-testid="btn-checkout"
        className="group w-full min-h-14 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white font-bold text-base flex items-center justify-between px-5 shadow-[0_14px_30px_-12px_rgba(234,88,12,0.75)] active:scale-[0.98] transition-[background-color,transform]"
      >
        <span className="flex items-center gap-2"><CreditCard className="w-5 h-5" /> Bayar Sekarang</span>
        <span className="flex items-center gap-2">
          <Kbd className="!bg-white/20 !border-white/30 !text-white">F4</Kbd>
          <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
        </span>
      </button>
    </div>
  )

  const suggestions = cashSuggestions(cartTotals.total)
  const cashValue = parseFloat(cashReceived) || 0

  return (
    <div className="flex-1 flex flex-col overflow-hidden min-h-0">
      <Header title="Kasir" subtitle="Catat pesanan pelanggan dengan cepat" />
      <div className="flex-1 flex overflow-hidden relative">
        {/* Menu Area */}
        <section className="flex-1 flex flex-col overflow-hidden min-w-0">
          <div className="px-3 sm:px-5 pt-3 sm:pt-4 pb-3 space-y-3 bg-linen">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-zinc-400 pointer-events-none" />
              <input
                ref={searchRef}
                type="text"
                placeholder="Cari menu… (contoh: es teh)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                data-testid="pos-search-input"
                className="w-full h-12 pl-11 pr-20 text-[15px] rounded-2xl bg-white border border-zinc-200 focus:outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-500/15 transition-[border-color,box-shadow] placeholder:text-zinc-400 shadow-[0_1px_2px_rgba(24,24,27,0.04)]"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                {searchQuery ? (
                  <button onClick={() => setSearchQuery('')} data-testid="pos-search-clear-button" className="w-7 h-7 rounded-lg bg-zinc-100 text-zinc-500 hover:text-zinc-900 flex items-center justify-center">
                    <X className="w-4 h-4" />
                  </button>
                ) : (
                  <Kbd>/</Kbd>
                )}
              </div>
            </div>
            <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-3 px-3 sm:mx-0 sm:px-0" data-testid="pos-category-chips">
              {[{ id: 'all', name: 'Semua', count: products.length }, ...categories.map((c) => ({ ...c, count: categoryCounts[c.id] || 0 }))].map((cat) => {
                const active = selectedCategory === cat.id
                return (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    data-testid={`pos-category-chip-${cat.id}`}
                    className={`shrink-0 h-10 pl-4 pr-2 rounded-full text-sm font-semibold whitespace-nowrap flex items-center gap-2 border transition-[background-color,color,border-color,transform] duration-150 active:scale-95 ${active
                      ? 'bg-zinc-900 text-white border-zinc-900'
                      : 'bg-white text-zinc-700 border-zinc-200 hover:border-primary-300 hover:text-primary-800'
                      }`}
                  >
                    {cat.name}
                    <span className={`min-w-6 h-6 px-1.5 rounded-full text-[11px] font-bold flex items-center justify-center ${active ? 'bg-white/15 text-white' : 'bg-zinc-100 text-zinc-500'}`}>{cat.count}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-3 sm:px-5 pb-28 lg:pb-6 pt-1">
            {loading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 sm:gap-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="bg-white rounded-2xl p-2 border border-zinc-200/70">
                    <Skeleton className="w-full aspect-[4/3]" />
                    <Skeleton className="h-4 w-3/4 mt-3" />
                    <Skeleton className="h-4 w-1/2 mt-2 mb-1" />
                  </div>
                ))}
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center py-20" data-testid="pos-no-products">
                <div className="w-16 h-16 rounded-3xl bg-white border border-zinc-200 flex items-center justify-center mb-4">
                  <SearchX className="w-7 h-7 text-zinc-400" />
                </div>
                <p className="font-heading font-bold text-zinc-900">{products.length === 0 ? 'Belum ada menu tersedia' : 'Menu tidak ditemukan'}</p>
                <p className="text-sm text-zinc-500 mt-1 max-w-xs">
                  {products.length === 0 ? 'Owner dapat menambahkan menu di halaman Menu & Kategori.' : `Tidak ada menu yang cocok dengan “${searchQuery}”.`}
                </p>
                {searchQuery && (
                  <Button variant="secondary" size="sm" className="mt-4" onClick={() => setSearchQuery('')} icon={RotateCcw} data-testid="pos-reset-search-button">Reset pencarian</Button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 sm:gap-4 stagger" data-testid="pos-product-grid">
                {filteredProducts.map((product, idx) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    index={idx}
                    qty={qtyByProduct[product.id] || 0}
                    variantCount={variantCountByProduct[product.id] || 0}
                    onClick={handleProductClick}
                  />
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Cart panel — laptop / tablet landscape */}
        <aside className="hidden lg:flex w-[340px] xl:w-[380px] bg-zinc-50/80 border-l border-zinc-200/80 flex-col shrink-0" data-testid="cart-panel">
          <div className="px-4 h-14 border-b border-zinc-200/80 flex items-center justify-between bg-white">
            <h3 className="font-heading font-bold text-zinc-900 flex items-center gap-2">
              Pesanan
              <span key={totalItemCount} className="min-w-6 h-6 px-1.5 rounded-full bg-primary-600 text-white text-xs font-bold font-mono flex items-center justify-center animate-bump" data-testid="cart-item-count">
                {totalItemCount}
              </span>
            </h3>
            {cart.length > 0 && (
              <button onClick={() => setConfirmClear(true)} data-testid="cart-clear-button" className="h-8 px-2.5 rounded-lg text-xs font-semibold text-zinc-500 hover:text-red-600 hover:bg-red-50 flex items-center gap-1.5 transition-colors">
                <Trash2 className="w-3.5 h-3.5" /> Kosongkan
              </button>
            )}
          </div>
          {renderCartItems()}
          {renderCartSummary()}
          {cart.length === 0 && (
            <div className="px-4 py-3 border-t border-zinc-200/80 text-[11px] text-zinc-500 flex items-center justify-center gap-3">
              <span className="flex items-center gap-1"><Kbd>/</Kbd> cari</span>
              <span className="flex items-center gap-1"><Kbd>F4</Kbd> bayar</span>
              <span className="flex items-center gap-1"><Kbd>Esc</Kbd> tutup</span>
            </div>
          )}
        </aside>
      </div>

      {/* Floating cart bar — phone & tablet portrait */}
      {cart.length > 0 && (
        <div className="lg:hidden fixed inset-x-3 sm:inset-x-6 bottom-[calc(var(--bnav)+0.75rem)] z-30 animate-scale-in" data-testid="mobile-cart-bar">
          <div className="flex items-center gap-2 p-2 rounded-[22px] bg-zinc-900 text-white shadow-[0_18px_40px_-14px_rgba(24,24,27,0.7)]">
            <button
              onClick={() => setMobileCartOpen(true)}
              data-testid="mobile-cart-open-button"
              className="flex-1 flex items-center gap-3 pl-2 pr-1 min-w-0 text-left"
            >
              <span className="relative w-11 h-11 rounded-2xl bg-white/10 flex items-center justify-center shrink-0">
                <ShoppingBag className="w-5 h-5" />
                <span key={totalItemCount} className="absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1 rounded-full bg-primary-500 text-[11px] font-bold font-mono flex items-center justify-center animate-bump" data-testid="mobile-cart-count">{totalItemCount}</span>
              </span>
              <span className="min-w-0">
                <span className="block text-[11px] text-white/60 font-medium">Lihat pesanan <ChevronUp className="inline w-3 h-3" /></span>
                <span className="block font-mono font-semibold text-base truncate tabular" data-testid="mobile-cart-total">{formatRupiah(cartTotals.total)}</span>
              </span>
            </button>
            <button
              onClick={openPayment}
              data-testid="mobile-checkout-button"
              className="h-12 px-5 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-600 font-bold flex items-center gap-2 active:scale-95 transition-transform shrink-0"
            >
              Bayar <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Mobile cart sheet */}
      <Modal
        isOpen={mobileCartOpen}
        onClose={() => setMobileCartOpen(false)}
        title={`Pesanan (${totalItemCount} item)`}
        icon={ShoppingBag}
        testId="mobile-cart-sheet"
        size="md"
      >
        <div className="-mx-5 sm:-mx-6 -my-5 flex flex-col max-h-[70dvh]">
          {cart.length > 0 && (
            <div className="px-4 pt-3 flex justify-end">
              <button onClick={() => setConfirmClear(true)} data-testid="mobile-cart-clear-button" className="h-8 px-2.5 rounded-lg text-xs font-semibold text-zinc-500 hover:text-red-600 hover:bg-red-50 flex items-center gap-1.5">
                <Trash2 className="w-3.5 h-3.5" /> Kosongkan
              </button>
            </div>
          )}
          {renderCartItems()}
          {renderCartSummary()}
        </div>
      </Modal>

      {/* Variant Picker */}
      <Modal
        isOpen={!!variantModal}
        onClose={() => setVariantModal(null)}
        title={variantModal?.product?.name}
        subtitle="Pilih varian pesanan"
        icon={Layers}
        size="sm"
        testId="variant-modal"
      >
        {variantModal && (
          <div className="grid grid-cols-1 gap-2.5">
            {[{ id: 'regular', name: 'Regular', price_addition: 0, regular: true }, ...variantModal.variants].map((v) => (
              <button
                key={v.id}
                onClick={() => addToCart(variantModal.product, v.regular ? null : v)}
                data-testid={`variant-option-${v.id}`}
                className="group w-full flex items-center justify-between gap-3 p-4 rounded-2xl border border-zinc-200 hover:border-primary-400 hover:bg-primary-50/50 active:scale-[0.98] transition-[background-color,border-color,transform] text-left"
              >
                <div>
                  <p className="text-sm font-bold text-zinc-900">{v.name}{v.regular && <span className="text-zinc-400 font-medium"> · standar</span>}</p>
                  {v.price_addition > 0 && <p className="text-xs text-zinc-500 mt-0.5">+{formatRupiah(v.price_addition)}</p>}
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm font-semibold text-primary-700 tabular">{formatRupiah(variantModal.product.price + (v.price_addition || 0))}</span>
                  <span className="w-8 h-8 rounded-xl bg-zinc-100 group-hover:bg-primary-600 group-hover:text-white flex items-center justify-center transition-colors">
                    <Plus className="w-4 h-4" />
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </Modal>

      {/* Payment */}
      <Modal
        isOpen={showPayment}
        onClose={() => !processing && setShowPayment(false)}
        title="Pembayaran"
        subtitle={`${totalItemCount} item · ${cart.length} jenis menu`}
        icon={CreditCard}
        size="lg"
        testId="payment-modal"
        footer={
          <Button
            size="xl"
            className="w-full"
            onClick={processPayment}
            loading={processing}
            disabled={paymentMethod === 'cash' && change < 0}
            icon={Check}
            data-testid="payment-modal-submit-button"
          >
            {paymentMethod === 'cash' && change < 0
              ? `Kurang ${formatRupiah(Math.abs(change))}`
              : `Selesaikan · ${formatRupiah(cartTotals.total)}`}
          </Button>
        }
      >
        <div className="grid md:grid-cols-2 gap-5">
          <div className="space-y-4">
            <div className="relative overflow-hidden rounded-2xl bg-zinc-900 text-white p-5">
              <div className="absolute -right-6 -top-6 w-28 h-28 rounded-full bg-primary-500/30 blur-2xl" />
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/60">Total Tagihan</p>
              <p className="font-mono text-3xl sm:text-4xl font-semibold mt-1 tabular tracking-tight" data-testid="payment-modal-total">{formatRupiah(cartTotals.total)}</p>
              {cartTotals.discount > 0 && (
                <p className="text-xs text-emerald-300 mt-1">Hemat {formatRupiah(cartTotals.discount)} dari diskon</p>
              )}
            </div>

            <div>
              <p className="text-[11px] font-bold text-zinc-500 uppercase tracking-[0.08em] mb-2">Metode Pembayaran</p>
              <div className="grid grid-cols-3 gap-2">
                {PAYMENT_METHODS.map((m) => {
                  const active = paymentMethod === m.value
                  return (
                    <button
                      key={m.value}
                      onClick={() => setPaymentMethod(m.value)}
                      data-testid={`payment-method-${m.value}`}
                      className={`relative p-3 rounded-2xl border-2 text-center transition-[background-color,border-color,transform] active:scale-95 ${active ? 'border-primary-500 bg-primary-50' : 'border-zinc-200 bg-white hover:border-zinc-300'
                        }`}
                    >
                      {active && <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-primary-600 text-white flex items-center justify-center animate-pop"><Check className="w-2.5 h-2.5" strokeWidth={4} /></span>}
                      <m.icon className={`w-6 h-6 mx-auto ${active ? 'text-primary-600' : 'text-zinc-500'}`} />
                      <p className={`text-sm font-bold mt-1.5 ${active ? 'text-primary-900' : 'text-zinc-800'}`}>{m.label}</p>
                      <p className="text-[10px] text-zinc-500 hidden sm:block">{m.hint}</p>
                    </button>
                  )
                })}
              </div>
            </div>

            {paymentMethod === 'cash' && (
              <div className="space-y-2">
                <p className="text-[11px] font-bold text-zinc-500 uppercase tracking-[0.08em]">Uang Cepat</p>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => setCashReceived(String(cartTotals.total))}
                    data-testid="payment-quick-exact"
                    className="h-11 rounded-xl text-sm font-bold bg-primary-600 text-white hover:bg-primary-700 active:scale-95 transition-[background-color,transform]"
                  >
                    Uang Pas
                  </button>
                  {suggestions.map((amt) => (
                    <button
                      key={amt}
                      onClick={() => setCashReceived(String(amt))}
                      data-testid={`payment-quick-${amt}`}
                      className={`h-11 rounded-xl text-sm font-semibold font-mono border transition-[background-color,border-color,transform] active:scale-95 ${cashValue === amt ? 'bg-primary-50 border-primary-400 text-primary-900' : 'bg-white border-zinc-200 text-zinc-800 hover:border-primary-300'}`}
                    >
                      {amt >= 1000 ? `${amt / 1000}rb` : amt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {paymentMethod !== 'cash' && (
              <div className="p-4 rounded-2xl bg-sky-50 border border-sky-200 text-sm text-sky-900 animate-fade-in-up" data-testid="payment-noncash-info">
                <p className="font-bold">Pastikan dana sudah masuk</p>
                <p className="text-xs text-sky-800 mt-1 leading-relaxed">
                  Cek notifikasi {paymentMethod === 'qris' ? 'QRIS / e-wallet' : 'mutasi rekening'} sebelum menyelesaikan. Transaksi akan ditandai “Menunggu Verifikasi”.
                </p>
                {!isOnline && <p className="text-xs font-semibold text-amber-800 mt-2">⚠ Mode offline: transaksi disimpan lokal.</p>}
              </div>
            )}
          </div>

          {paymentMethod === 'cash' && (
            <div className="space-y-3">
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                <p className="text-[11px] font-bold text-zinc-500 uppercase tracking-[0.08em]">Uang Diterima</p>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="font-mono text-lg text-zinc-400">Rp</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoFocus
                    value={cashValue ? cashValue.toLocaleString('id-ID') : ''}
                    onChange={(e) => setCashReceived(e.target.value.replace(/\D/g, '').slice(0, 9))}
                    onKeyDown={(e) => e.key === 'Enter' && processPayment()}
                    placeholder="0"
                    data-testid="payment-cash-input"
                    className="flex-1 min-w-0 bg-transparent font-mono text-3xl font-semibold text-zinc-900 tabular focus:outline-none placeholder:text-zinc-300"
                  />
                </div>
              </div>
              <div
                data-testid="payment-change-display"
                className={`rounded-2xl p-4 flex items-center justify-between transition-colors ${!cashReceived ? 'bg-zinc-50 border border-dashed border-zinc-200' : change >= 0 ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200'
                  }`}
              >
                <p className={`text-sm font-bold ${!cashReceived ? 'text-zinc-400' : change >= 0 ? 'text-emerald-800' : 'text-red-700'}`}>
                  {!cashReceived ? 'Kembalian' : change >= 0 ? 'Kembalian' : 'Masih kurang'}
                </p>
                <p className={`font-mono text-2xl font-semibold tabular ${!cashReceived ? 'text-zinc-300' : change >= 0 ? 'text-emerald-700' : 'text-red-600'}`} data-testid="payment-change-amount">
                  {formatRupiah(Math.abs(cashReceived ? change : 0))}
                </p>
              </div>
              <NumericKeypad value={cashReceived} onChange={setCashReceived} testIdPrefix="payment-keypad" />
            </div>
          )}
        </div>
      </Modal>

      {/* Success + Receipt */}
      <Modal isOpen={showReceipt} onClose={startNewOrder} size="md" showClose={false} testId="receipt-modal">
        {lastOrder && (
          <div className="space-y-5">
            <div className="text-center pt-1">
              <div className="relative mx-auto w-16 h-16">
                <span className="absolute inset-0 rounded-full bg-emerald-400/40 animate-ping-soft" />
                <span className="relative w-16 h-16 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-[0_12px_30px_-10px_rgba(16,185,129,0.8)] animate-pop">
                  <Check className="w-8 h-8" strokeWidth={3} />
                </span>
              </div>
              <h3 className="font-heading text-2xl font-bold text-zinc-900 mt-4" data-testid="receipt-success-title">Pembayaran Berhasil!</h3>
              {lastOrder.payment_method === 'cash' && lastOrder.change_amount > 0 ? (
                <p className="text-sm text-zinc-500 mt-1">
                  Kembalian <span className="font-mono font-bold text-emerald-700 text-base" data-testid="receipt-change-amount">{formatRupiah(lastOrder.change_amount)}</span>
                </p>
              ) : (
                <p className="text-sm text-zinc-500 mt-1">Pesanan tercatat. Terima kasih!</p>
              )}
            </div>

            <ReceiptView order={lastOrder} items={lastOrder.items} settings={storeSettings} />

            <div className="grid grid-cols-2 gap-2 no-print">
              <Button variant="secondary" onClick={() => window.print()} icon={Printer} data-testid="receipt-print-button">Cetak</Button>
              <Button variant="secondary" onClick={shareWhatsApp} icon={MessageCircle} data-testid="receipt-whatsapp-button">WhatsApp</Button>
              <Button className="col-span-2" size="lg" onClick={startNewOrder} icon={Plus} autoFocus data-testid="receipt-new-order-button">Pesanan Baru</Button>
            </div>
            <button
              type="button"
              onClick={() => { setShowReceipt(false); navigate('/transaksi') }}
              data-testid="receipt-cancel-link"
              className="no-print w-full flex items-center justify-center gap-1.5 text-xs font-medium text-zinc-500 hover:text-red-600 py-1 transition-colors"
            >
              <ReceiptIcon className="w-3.5 h-3.5" /> Ada kesalahan? Batalkan transaksi di Riwayat
            </button>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={confirmClear}
        onClose={() => setConfirmClear(false)}
        onConfirm={() => { clearCart(); setConfirmClear(false); setMobileCartOpen(false) }}
        title="Kosongkan pesanan?"
        description="Semua item di keranjang akan dihapus. Tindakan ini tidak bisa dibatalkan."
        confirmLabel="Ya, kosongkan"
      />
    </div>
  )
}
