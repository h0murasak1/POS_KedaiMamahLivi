import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useSync } from '@/contexts/SyncContext'
import { supabase } from '@/lib/supabase'
import { db } from '@/lib/db'
import Header from '@/components/layout/Header'
import Card, { CardHeader, CardTitle } from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import EmptyState from '@/components/ui/EmptyState'
import { formatRupiah, getGreeting } from '@/lib/utils'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import {
  ShoppingCart, TrendingUp, Users, AlertTriangle, Award, ArrowRight, Receipt, Clock,
  UtensilsCrossed, BarChart3, ChevronRight,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export default function OwnerDashboard() {
  const { profile } = useAuth()
  const { pendingCount, failedCount } = useSync()
  const navigate = useNavigate()

  const [stats, setStats] = useState({
    totalSales: 0,
    totalTransactions: 0,
    avgTransaction: 0,
    activeCashiers: 0,
  })
  const [pendingCancellations, setPendingCancellations] = useState(0)
  const [salesChart, setSalesChart] = useState([])
  const [topProducts, setTopProducts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStats()
  }, [])

  const fetchStats = async () => {
    try {
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      // Fetch active cashiers count
      const { count: activeCashiers } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'cashier')
        .eq('is_active', true)

      // Fetch pending cancellation requests count
      let cancelCount = 0
      try {
        const { count: serverCancelCount } = await supabase
          .from('orders')
          .select('*', { count: 'exact', head: true })
          .eq('cancellation_status', 'requested')
        cancelCount = serverCancelCount || 0
      } catch (err) {
        console.warn('Cancel count check error:', err)
      }

      if (db) {
        try {
          const localRequests = await db.local_orders
            .filter((o) => o.cancellation_status === 'requested')
            .count()
          cancelCount = Math.max(cancelCount, localRequests)
        } catch (_) { }
      }
      setPendingCancellations(cancelCount)

      // 1. Fetch today's completed orders from Supabase
      const { data: serverOrders, error: ordersError } = await supabase
        .from('orders')
        .select('id, total_amount, created_at_local, order_status')
        .gte('created_at_local', today.toISOString())
        .eq('order_status', 'completed')

      if (ordersError) console.warn('Supabase orders fetch notice:', ordersError)

      // 2. Fetch today's completed orders from local IndexedDB (offline / pending sync)
      let localOrders = []
      if (db) {
        try {
          localOrders = await db.local_orders
            .filter(
              (o) => new Date(o.created_at_local) >= today && o.order_status === 'completed'
            )
            .toArray()
        } catch (dbErr) {
          console.warn('Local db fetch notice:', dbErr)
        }
      }

      // 3. Merge server and local orders uniquely by id
      const orderMap = new Map()
        ; (serverOrders || []).forEach((o) => orderMap.set(o.id, o))
      localOrders.forEach((o) => {
        if (!orderMap.has(o.id)) orderMap.set(o.id, o)
      })
      const orders = Array.from(orderMap.values())

      if (orders.length > 0) {
        const totalSales = orders.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0)
        const totalTransactions = orders.length
        const avgTransaction = totalTransactions > 0 ? totalSales / totalTransactions : 0

        setStats({
          totalSales,
          totalTransactions,
          avgTransaction,
          activeCashiers: activeCashiers || 0,
        })

        // Group today's sales by hour for the chart
        const hourly = {}
        orders.forEach((o) => {
          const h = `${new Date(o.created_at_local).getHours().toString().padStart(2, '0')}:00`
          hourly[h] = (hourly[h] || 0) + (Number(o.total_amount) || 0)
        })
        const chartData = Object.entries(hourly)
          .map(([time, amount]) => ({ time, amount }))
          .sort((a, b) => a.time.localeCompare(b.time))
        setSalesChart(chartData)

        // Fetch top products for today's orders (both Supabase & local)
        const orderIds = orders.map((o) => o.id)
        let serverItems = []
        if (serverOrders && serverOrders.length > 0 && orderIds.length > 0) {
          const { data: sItems } = await supabase
            .from('order_items')
            .select('id, product_name, quantity, subtotal, order_id')
            .in('order_id', orderIds)
          serverItems = sItems || []
        }

        let localItems = []
        if (db) {
          try {
            const allLocalItems = await db.local_order_items.toArray()
            const orderIdSet = new Set(orderIds)
            localItems = allLocalItems.filter((i) => orderIdSet.has(i.order_id))
          } catch (itemErr) {
            console.warn('Local items fetch notice:', itemErr)
          }
        }

        // Merge items uniquely
        const itemMap = new Map()
        serverItems.forEach((i) => itemMap.set(i.id || `${i.order_id}-${i.product_name}`, i))
        localItems.forEach((i) => {
          const key = i.id || `${i.order_id}-${i.product_name}`
          if (!itemMap.has(key)) itemMap.set(key, i)
        })
        const items = Array.from(itemMap.values())

        if (items.length > 0) {
          const byProduct = {}
          items.forEach((i) => {
            const name = i.product_name || 'Menu'
            if (!byProduct[name]) {
              byProduct[name] = { qty: 0, revenue: 0 }
            }
            byProduct[name].qty += Number(i.quantity) || 1
            byProduct[name].revenue += Number(i.subtotal) || 0
          })
          const sorted = Object.entries(byProduct)
            .map(([name, d]) => ({ name, ...d }))
            .sort((a, b) => b.qty - a.qty)
            .slice(0, 5)
          setTopProducts(sorted)
        } else {
          setTopProducts([])
        }
      } else {
        setStats({
          totalSales: 0,
          totalTransactions: 0,
          avgTransaction: 0,
          activeCashiers: activeCashiers || 0,
        })
        setSalesChart([])
        setTopProducts([])
      }
    } catch (error) {
      console.error('Error fetching dashboard stats:', error)
    } finally {
      setLoading(false)
    }
  }

  const greeting = getGreeting()
  const todayLabel = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const maxQty = topProducts[0]?.qty || 1

  const kpis = [
    { title: 'Transaksi', value: stats.totalTransactions, suffix: 'pesanan', icon: Receipt, tone: 'bg-primary-50 text-primary-700 border-primary-200/70', id: 'transactions' },
    { title: 'Rata-rata / Transaksi', value: formatRupiah(stats.avgTransaction), icon: TrendingUp, tone: 'bg-secondary-50 text-secondary-700 border-secondary-200', id: 'average', mono: true },
    { title: 'Kasir Aktif', value: stats.activeCashiers, suffix: 'orang', icon: Users, tone: 'bg-emerald-50 text-emerald-700 border-emerald-200', id: 'active-cashiers' },
  ]

  const quickActions = [
    { label: 'Tambah Menu', icon: UtensilsCrossed, to: '/menu', id: 'menu' },
    { label: 'Riwayat', icon: Receipt, to: '/transaksi', id: 'transaksi' },
    { label: 'Laporan', icon: BarChart3, to: '/laporan', id: 'laporan' },
    { label: 'Staf Kasir', icon: Users, to: '/kasir', id: 'kasir' },
  ]

  return (
    <div>
      <Header title="Beranda" subtitle="Ringkasan kedai hari ini" />
      <div className="p-4 sm:p-6 lg:p-8 space-y-5 sm:space-y-6 max-w-[1400px] w-full">
        {/* Bento hero */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5 stagger">
          <div className="lg:col-span-2 relative overflow-hidden rounded-3xl bg-zinc-900 text-white p-6 sm:p-8" data-testid="owner-hero">
            <div className="absolute inset-0 bg-dots opacity-40" />
            <div className="absolute -right-16 -top-16 w-72 h-72 rounded-full bg-primary-600/40 blur-3xl" />
            <div className="absolute right-24 -bottom-24 w-56 h-56 rounded-full bg-secondary-500/25 blur-3xl" />
            <div className="relative flex flex-col sm:flex-row sm:items-end justify-between gap-6">
              <div>
                <p className="text-xs font-medium text-white/60">{todayLabel}</p>
                <h1 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight mt-1" data-testid="owner-greeting">
                  {greeting}, {profile?.full_name?.split(' ')[0] || 'Pemilik'} 👋
                </h1>
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary-300 mt-6">Penjualan hari ini</p>
                <p className="font-mono text-4xl sm:text-5xl font-semibold tabular tracking-tight mt-1" data-testid="owner-total-sales">
                  {loading ? <span className="inline-block w-48 h-11 rounded-xl bg-white/10 animate-pulse" /> : formatRupiah(stats.totalSales)}
                </p>
                <p className="text-sm text-white/60 mt-2">dari {stats.totalTransactions} transaksi selesai</p>
              </div>
              <button
                onClick={() => navigate('/pos')}
                data-testid="owner-open-pos-button"
                className="group inline-flex items-center gap-2.5 h-13 px-6 bg-gradient-to-br from-primary-500 to-primary-600 hover:from-primary-400 hover:to-primary-600 font-bold rounded-2xl shadow-[0_14px_30px_-10px_rgba(234,88,12,0.8)] active:scale-95 transition-[background-color,transform] self-start sm:self-auto"
              >
                <ShoppingCart className="w-5 h-5" />
                Buka Kasir
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-3 lg:grid-cols-1 gap-3 sm:gap-4">
            {kpis.map((k) => (
              <Card key={k.id} className="p-3.5 sm:p-5 flex flex-col lg:flex-row lg:items-center gap-2.5 lg:gap-4" data-testid={`owner-kpi-${k.id}`}>
                <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-2xl border flex items-center justify-center shrink-0 ${k.tone}`}>
                  <k.icon className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] sm:text-xs font-semibold text-zinc-500 leading-tight">{k.title}</p>
                  <p className={`text-base sm:text-2xl font-bold text-zinc-900 tracking-tight mt-0.5 truncate ${k.mono ? 'font-mono text-sm sm:text-xl' : 'font-heading'}`}>
                    {loading ? '…' : k.value}
                    {k.suffix && !loading && <span className="text-xs font-sans font-medium text-zinc-400 ml-1 hidden sm:inline">{k.suffix}</span>}
                  </p>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Alerts */}
        {pendingCancellations > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 sm:p-5 rounded-3xl bg-amber-50 border border-amber-200 animate-fade-in-up" data-testid="owner-cancellation-alert">
            <div className="flex items-center gap-3.5">
              <div className="relative w-11 h-11 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
                <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center">{pendingCancellations}</span>
              </div>
              <div>
                <p className="text-sm font-bold text-amber-950">{pendingCancellations} pengajuan pembatalan menunggu persetujuan</p>
                <p className="text-xs text-amber-800 mt-0.5">Kasir butuh izin Anda untuk membatalkan transaksi.</p>
              </div>
            </div>
            <Button variant="dark" size="sm" onClick={() => navigate('/transaksi')} iconRight={ChevronRight} data-testid="owner-review-cancellations-button" className="self-end sm:self-auto">
              Tinjau sekarang
            </Button>
          </div>
        )}

        {(pendingCount > 0 || failedCount > 0) && (
          <div className="flex items-center gap-3 p-4 rounded-2xl bg-white border border-zinc-200" data-testid="owner-sync-warning">
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0"><Clock className="w-4 h-4" /></div>
            <p className="text-sm text-zinc-700">
              {pendingCount > 0 && <><b>{pendingCount}</b> transaksi menunggu sinkronisasi. </>}
              {failedCount > 0 && <><b className="text-red-600">{failedCount}</b> gagal disinkronkan.</>}
            </p>
          </div>
        )}

        {/* Quick actions */}
        <div className="grid grid-cols-4 gap-2.5 sm:gap-4">
          {quickActions.map((a) => (
            <button
              key={a.id}
              onClick={() => navigate(a.to)}
              data-testid={`owner-quick-${a.id}`}
              className="group flex flex-col sm:flex-row items-center gap-2 sm:gap-3 p-3 sm:p-4 rounded-2xl bg-white border border-zinc-200/80 hover:border-primary-300 hover:-translate-y-0.5 hover:shadow-[0_12px_24px_-16px_rgba(234,88,12,0.5)] transition-[border-color,transform,box-shadow] text-center sm:text-left"
            >
              <span className="w-10 h-10 rounded-xl bg-zinc-100 group-hover:bg-primary-600 group-hover:text-white text-zinc-700 flex items-center justify-center transition-colors shrink-0">
                <a.icon className="w-5 h-5" />
              </span>
              <span className="text-[11px] sm:text-sm font-semibold text-zinc-800 leading-tight">{a.label}</span>
              <ChevronRight className="hidden sm:block w-4 h-4 text-zinc-300 ml-auto group-hover:text-primary-600 group-hover:translate-x-0.5 transition-[color,transform]" />
            </button>
          ))}
        </div>

        {/* Chart + Top products */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 sm:gap-5">
          <Card className="lg:col-span-3" hover={false} data-testid="owner-sales-chart">
            <CardHeader>
              <div>
                <CardTitle>Tren Penjualan per Jam</CardTitle>
                <p className="text-xs text-zinc-500 mt-0.5">Omzet hari ini berdasarkan jam transaksi</p>
              </div>
              <Badge variant="primary" dot>Hari ini</Badge>
            </CardHeader>
            {loading ? (
              <div className="h-64 animate-shimmer rounded-2xl" />
            ) : salesChart.length > 0 ? (
              <div className="h-64 w-full -ml-2">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={salesChart} margin={{ top: 10, right: 8, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="ownerSales" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#ea580c" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#ea580c" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f4f4f5" />
                    <XAxis dataKey="time" tick={{ fontSize: 11, fill: '#71717a' }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}rb`} tick={{ fontSize: 11, fill: '#71717a' }} axisLine={false} tickLine={false} />
                    <Tooltip
                      formatter={(v) => [formatRupiah(v), 'Penjualan']}
                      labelFormatter={(l) => `Pukul ${l}`}
                      contentStyle={{ borderRadius: 14, border: '1px solid #e4e4e7', boxShadow: '0 12px 30px -12px rgba(24,24,27,0.25)', fontSize: 12 }}
                    />
                    <Area type="monotone" dataKey="amount" stroke="#ea580c" strokeWidth={2.5} fill="url(#ownerSales)" dot={{ r: 3, fill: '#ea580c' }} activeDot={{ r: 6 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyState compact icon={TrendingUp} title="Belum ada transaksi hari ini" description="Grafik terisi otomatis saat kasir memproses pesanan." />
            )}
          </Card>

          <Card className="lg:col-span-2" hover={false} data-testid="owner-top-products">
            <CardHeader>
              <div>
                <CardTitle>Menu Terlaris</CardTitle>
                <p className="text-xs text-zinc-500 mt-0.5">Top 5 berdasarkan porsi</p>
              </div>
              <button onClick={() => navigate('/laporan')} data-testid="owner-full-report-link" className="text-xs font-bold text-primary-700 hover:text-primary-800 flex items-center gap-0.5">
                Laporan <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </CardHeader>
            {loading ? (
              <div className="space-y-3">{[0, 1, 2, 3].map((i) => <div key={i} className="h-12 animate-shimmer rounded-xl" />)}</div>
            ) : topProducts.length > 0 ? (
              <div className="space-y-3.5 stagger">
                {topProducts.map((p, idx) => (
                  <div key={p.name} data-testid={`owner-top-product-${idx}`}>
                    <div className="flex items-center justify-between gap-3 mb-1.5">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className={`w-6 h-6 rounded-lg text-[11px] font-bold flex items-center justify-center shrink-0 ${idx === 0 ? 'bg-secondary-400 text-secondary-950' : idx === 1 ? 'bg-zinc-300 text-zinc-800' : idx === 2 ? 'bg-primary-200 text-primary-900' : 'bg-zinc-100 text-zinc-500'}`}>{idx + 1}</span>
                        <p className="text-sm font-semibold text-zinc-900 truncate">{p.name}</p>
                      </div>
                      <p className="font-mono text-xs font-semibold text-zinc-700 shrink-0 tabular">{formatRupiah(p.revenue)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 rounded-full bg-zinc-100 overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-primary-500 to-secondary-400 transition-[width] duration-700" style={{ width: `${(p.qty / maxQty) * 100}%` }} />
                      </div>
                      <span className="text-[11px] font-semibold text-zinc-500 w-14 text-right">{p.qty} porsi</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState compact icon={Award} title="Belum ada menu terjual" description="Menu favorit pelanggan akan muncul di sini." />
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
