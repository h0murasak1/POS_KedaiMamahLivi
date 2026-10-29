import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useSync } from '@/contexts/SyncContext'
import { supabase } from '@/lib/supabase'
import { db } from '@/lib/db'
import Header from '@/components/layout/Header'
import Card, { CardHeader, CardTitle } from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import { formatRupiah } from '@/lib/utils'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import {
  DollarSign,
  ShoppingCart,
  TrendingUp,
  Users,
  AlertTriangle,
  Award,
  ArrowRight,
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
        } catch (_) {}
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
      ;(serverOrders || []).forEach((o) => orderMap.set(o.id, o))
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

  const statCards = [
    {
      title: 'Penjualan Hari Ini',
      value: formatRupiah(stats.totalSales),
      icon: DollarSign,
      color: 'text-primary-600',
      bg: 'bg-primary-50 border border-primary-100',
    },
    {
      title: 'Total Transaksi',
      value: stats.totalTransactions,
      icon: ShoppingCart,
      color: 'text-rose-600',
      bg: 'bg-rose-50 border border-rose-100',
    },
    {
      title: 'Rata-rata Transaksi',
      value: formatRupiah(stats.avgTransaction),
      icon: TrendingUp,
      color: 'text-fuchsia-600',
      bg: 'bg-fuchsia-50 border border-fuchsia-100',
    },
    {
      title: 'Kasir Aktif',
      value: stats.activeCashiers,
      icon: Users,
      color: 'text-purple-600',
      bg: 'bg-purple-50 border border-purple-100',
    },
  ]

  return (
    <div>
      <Header title="Dashboard Pemilik" />
      <div className="p-4 sm:p-6 space-y-6 animate-fade-in-up">
        {/* Greeting Banner */}
        <div className="bg-gradient-to-r from-primary-500 via-primary-600 to-pink-600 rounded-3xl p-6 sm:p-8 text-white shadow-lg shadow-primary-200/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5 relative overflow-hidden">
          <div className="absolute -right-8 -top-8 w-48 h-48 bg-white/10 rounded-full blur-xl pointer-events-none" />
          <div className="relative z-10">
            <span className="inline-block px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs font-bold uppercase tracking-wider mb-2">
              ✨ Ringkasan Harian
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Selamat Datang, {profile?.full_name || 'Pemilik'} 🌸
            </h1>
            <p className="text-white/85 text-xs sm:text-sm mt-1 max-w-md">
              Pantau arus penjualan, kasir aktif, dan menu paling laris di Kedai Mamah Livi hari ini.
            </p>
          </div>
          <button
            onClick={() => navigate('/pos')}
            className="inline-flex items-center justify-center gap-2.5 px-6 py-3.5 bg-white text-primary-700 hover:bg-pink-50 active:scale-95 font-extrabold rounded-2xl shadow-md transition-all self-start sm:self-auto relative z-10 text-sm"
          >
            <ShoppingCart className="w-5 h-5 text-primary-600" />
            <span>Buka Kasir (POS)</span>
          </button>
        </div>

        {/* Pending Cancellation Alert */}
        {pendingCancellations > 0 && (
          <div className="p-4 sm:p-5 bg-gradient-to-r from-rose-50 to-pink-50 border border-rose-200 rounded-3xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-rose-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6 text-rose-600" />
              </div>
              <div>
                <p className="text-sm font-extrabold text-rose-900">
                  {pendingCancellations} Pengajuan Pembatalan Transaksi Menunggu Persetujuan
                </p>
                <p className="text-xs text-rose-700 mt-0.5">
                  Kasir mengajukan pembatalan pesanan. Buka Riwayat Transaksi untuk menyetujui atau menolak.
                </p>
              </div>
            </div>
            <button
              onClick={() => navigate('/transaksi')}
              className="px-4 py-2 bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 active:scale-95 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-rose-200/50 whitespace-nowrap self-end sm:self-auto"
            >
              Tinjau Transaksi
            </button>
          </div>
        )}

        {/* Sync warnings */}
        {(pendingCount > 0 || failedCount > 0) && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-amber-800">
                {pendingCount > 0 && `${pendingCount} transaksi menunggu sinkronisasi. `}
                {failedCount > 0 && `${failedCount} transaksi gagal disinkronkan.`}
              </p>
              <p className="text-xs text-amber-600 mt-0.5">
                Dashboard memprioritaskan data transaksi yang sudah tersinkronisasi ke server.
              </p>
            </div>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
          {statCards.map((stat, idx) => (
            <Card key={idx} className="p-4 sm:p-5 card-glow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-gray-500 font-semibold">{stat.title}</p>
                  <p className="text-lg sm:text-2xl font-black text-gray-900 mt-1.5 tracking-tight">
                    {loading ? '...' : stat.value}
                  </p>
                </div>
                <div className={`w-11 h-11 sm:w-13 sm:h-13 ${stat.bg} rounded-2xl flex items-center justify-center shrink-0 shadow-2xs`}>
                  <stat.icon className={`w-5 h-5 sm:w-6 sm:h-6 ${stat.color}`} />
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Charts & Top Products */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Sales Chart */}
          <Card className="p-5 sm:p-6 flex flex-col justify-between">
            <CardHeader className="mb-4">
              <div className="flex items-center justify-between w-full">
                <div>
                  <CardTitle>Grafik Penjualan Hari Ini</CardTitle>
                  <p className="text-xs text-gray-500 mt-0.5">Tren omzet per jam</p>
                </div>
                <span className="text-xs font-bold px-3 py-1 bg-primary-50 text-primary-700 rounded-xl border border-primary-200/60 shadow-2xs">
                  {formatRupiah(stats.totalSales)}
                </span>
              </div>
            </CardHeader>

            {loading ? (
              <div className="h-64 flex items-center justify-center text-gray-400 text-sm">
                Memuat grafik...
              </div>
            ) : salesChart.length > 0 ? (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={salesChart} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#fce7f3" />
                    <XAxis dataKey="time" tick={{ fontSize: 11, fill: '#9d174d' }} axisLine={false} tickLine={false} />
                    <YAxis
                      tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                      tick={{ fontSize: 11, fill: '#9d174d' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      formatter={(v) => [formatRupiah(v), 'Penjualan']}
                      labelFormatter={(l) => `Pukul ${l}`}
                      contentStyle={{ 
                        borderRadius: '16px', 
                        borderColor: '#fbcfe8', 
                        boxShadow: '0 10px 25px -5px rgba(236, 72, 153, 0.15)',
                        backgroundColor: '#ffffff'
                      }}
                    />
                    <Bar dataKey="amount" fill="#ec4899" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex flex-col items-center justify-center text-gray-400 bg-pink-50/30 rounded-2xl border border-dashed border-pink-200">
                <TrendingUp className="w-10 h-10 mb-2 opacity-30 text-primary-400" />
                <p className="text-sm font-bold text-gray-600">Belum ada transaksi hari ini</p>
                <p className="text-xs text-gray-400 mt-1">Grafik akan terisi otomatis saat kasir memproses pesanan</p>
              </div>
            )}
          </Card>

          {/* Top Products */}
          <Card className="p-5 sm:p-6 flex flex-col justify-between">
            <CardHeader className="mb-4">
              <div className="flex items-center justify-between w-full">
                <div>
                  <CardTitle>Menu Terlaris Hari Ini</CardTitle>
                  <p className="text-xs text-gray-500 mt-0.5">Berdasarkan porsi terjual</p>
                </div>
                <button
                  onClick={() => navigate('/laporan')}
                  className="text-xs font-bold text-primary-600 hover:text-primary-700 flex items-center gap-1 hover:underline"
                >
                  <span>Laporan Lengkap</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </CardHeader>

            {loading ? (
              <div className="h-64 flex items-center justify-center text-gray-400 text-sm">
                Memuat data...
              </div>
            ) : topProducts.length > 0 ? (
              <div className="space-y-2.5">
                {topProducts.map((p, idx) => (
                  <div
                    key={p.name}
                    className="flex items-center justify-between p-3 rounded-2xl bg-pink-50/40 hover:bg-pink-50/80 transition-colors border border-pink-100/70"
                  >
                    <div className="flex items-center gap-3 min-w-0 pr-2">
                      <div
                        className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black shrink-0 ${
                          idx === 0
                            ? 'bg-gradient-to-br from-amber-400 to-amber-500 text-white shadow-xs'
                            : idx === 1
                            ? 'bg-gradient-to-br from-slate-300 to-slate-400 text-white shadow-xs'
                            : idx === 2
                            ? 'bg-gradient-to-br from-amber-600 to-amber-700 text-white shadow-xs'
                            : 'bg-primary-100 text-primary-800'
                        }`}
                      >
                        {idx + 1}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-gray-900 truncate">{p.name}</p>
                        <p className="text-xs text-gray-500">{p.qty} porsi terjual</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-black text-primary-600">{formatRupiah(p.revenue)}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-64 flex flex-col items-center justify-center text-gray-400 bg-pink-50/30 rounded-2xl border border-dashed border-pink-200">
                <Award className="w-10 h-10 mb-2 opacity-30 text-primary-400" />
                <p className="text-sm font-bold text-gray-600">Belum ada menu terjual hari ini</p>
                <p className="text-xs text-gray-400 mt-1">Daftar menu terpopuler akan otomatis muncul di sini</p>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
