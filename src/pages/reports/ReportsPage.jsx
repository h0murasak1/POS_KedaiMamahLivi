import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { db } from '@/lib/db'
import Header from '@/components/layout/Header'
import Card, { CardHeader, CardTitle } from '@/components/ui/Card'
import { formatRupiah, formatDate } from '@/lib/utils'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import { TrendingUp, Award, CreditCard } from 'lucide-react'

const COLORS = ['#ec4899', '#f43f5e', '#a855f7', '#fb7185', '#d946ef', '#f472b6']

export default function ReportsPage() {
  const [period, setPeriod] = useState('today')
  const [salesData, setSalesData] = useState([])
  const [paymentData, setPaymentData] = useState([])
  const [topProducts, setTopProducts] = useState([])
  const [summary, setSummary] = useState({ total: 0, count: 0, avg: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchReport()
  }, [period])

  const getDateRange = () => {
    const now = new Date()
    const end = new Date(now)
    end.setHours(23, 59, 59, 999)

    let start = new Date(now)
    switch (period) {
      case 'today':
        start.setHours(0, 0, 0, 0)
        break
      case 'week':
        start.setDate(now.getDate() - 7)
        start.setHours(0, 0, 0, 0)
        break
      case 'month':
        start.setMonth(now.getMonth() - 1)
        start.setHours(0, 0, 0, 0)
        break
      case 'year':
        start.setFullYear(now.getFullYear() - 1)
        start.setHours(0, 0, 0, 0)
        break
    }
    return { start: start.toISOString(), end: end.toISOString() }
  }

  const fetchReport = async () => {
    setLoading(true)
    try {
      const { start, end } = getDateRange()
      const startDate = new Date(start)
      const endDate = new Date(end)

      // 1. Fetch completed orders from Supabase
      const { data: serverOrders, error: sErr } = await supabase
        .from('orders')
        .select('id, total_amount, payment_method, created_at_local, order_status')
        .gte('created_at_local', start)
        .lte('created_at_local', end)
        .eq('order_status', 'completed')

      if (sErr) console.warn('Supabase reports fetch notice:', sErr)

      // 2. Fetch completed orders from local IndexedDB
      let localOrders = []
      if (db) {
        try {
          localOrders = await db.local_orders
            .filter((o) => {
              const d = new Date(o.created_at_local)
              return d >= startDate && d <= endDate && o.order_status === 'completed'
            })
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

      if (orders.length === 0) {
        setSummary({ total: 0, count: 0, avg: 0 })
        setSalesData([])
        setPaymentData([])
        setTopProducts([])
        setLoading(false)
        return
      }

      const total = orders.reduce((s, o) => s + (Number(o.total_amount) || 0), 0)
      setSummary({
        total,
        count: orders.length,
        avg: orders.length > 0 ? total / orders.length : 0,
      })

      // Group for chart: by Hour for 'today', by Date for 'week'/'month'/'year'
      const byTime = {}
      orders.forEach((o) => {
        const d = new Date(o.created_at_local)
        const key =
          period === 'today'
            ? `${d.getHours().toString().padStart(2, '0')}:00`
            : formatDate(o.created_at_local)
        byTime[key] = (byTime[key] || 0) + (Number(o.total_amount) || 0)
      })

      let chartPoints = Object.entries(byTime).map(([date, amount]) => ({ date, amount }))
      if (period === 'today') {
        chartPoints.sort((a, b) => a.date.localeCompare(b.date))
      }
      setSalesData(chartPoints)

      // Group by payment method
      const byPayment = {}
      orders.forEach((o) => {
        const m = o.payment_method || 'other'
        byPayment[m] = (byPayment[m] || 0) + (Number(o.total_amount) || 0)
      })
      setPaymentData(
        Object.entries(byPayment).map(([name, value]) => ({
          name:
            name === 'cash'
              ? 'Tunai'
              : name === 'qris'
              ? 'QRIS'
              : name === 'transfer'
              ? 'Transfer'
              : 'Lainnya',
          value,
        }))
      )

      // 4. Fetch top products (both Supabase & local)
      const orderIds = orders.map((o) => o.id)
      let serverItems = []
      if (serverOrders && serverOrders.length > 0 && orderIds.length > 0) {
        const { data: serverItemsData } = await supabase
          .from('order_items')
          .select('id, product_name, quantity, subtotal, order_id')
          .in('order_id', orderIds)
        serverItems = serverItemsData || []
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
          if (!byProduct[name]) byProduct[name] = { qty: 0, revenue: 0 }
          byProduct[name].qty += Number(i.quantity) || 1
          byProduct[name].revenue += Number(i.subtotal) || 0
        })
        setTopProducts(
          Object.entries(byProduct)
            .map(([name, d]) => ({ name, ...d }))
            .sort((a, b) => b.qty - a.qty)
            .slice(0, 10)
        )
      } else {
        setTopProducts([])
      }
    } catch (e) {
      console.error('Error fetching report:', e)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <Header title="Laporan Penjualan" />
      <div className="p-4 sm:p-6 space-y-6 animate-fade-in-up">
        {/* Period Selector Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {[
            { val: 'today', label: 'Hari Ini' },
            { val: 'week', label: '7 Hari Terakhir' },
            { val: 'month', label: '30 Hari Terakhir' },
            { val: 'year', label: '1 Tahun' },
          ].map((p) => (
            <button
              key={p.val}
              onClick={() => setPeriod(p.val)}
              className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all active:scale-95 ${
                period === p.val
                  ? 'bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-md shadow-primary-200/40'
                  : 'bg-white border border-pink-200 text-gray-700 hover:bg-pink-50/80 hover:text-primary-700 shadow-2xs'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Summary Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-5">
          <Card className="p-5 sm:p-6 card-glow">
            <p className="text-xs sm:text-sm text-gray-500 font-semibold">Total Pendapatan</p>
            <p className="text-xl sm:text-2xl font-black text-primary-600 mt-1 tracking-tight">
              {loading ? '...' : formatRupiah(summary.total)}
            </p>
          </Card>
          <Card className="p-5 sm:p-6 card-glow">
            <p className="text-xs sm:text-sm text-gray-500 font-semibold">Jumlah Transaksi Selesai</p>
            <p className="text-xl sm:text-2xl font-black text-gray-900 mt-1 tracking-tight">
              {loading ? '...' : `${summary.count} Transaksi`}
            </p>
          </Card>
          <Card className="p-5 sm:p-6 card-glow">
            <p className="text-xs sm:text-sm text-gray-500 font-semibold">Rata-rata per Transaksi</p>
            <p className="text-xl sm:text-2xl font-black text-gray-900 mt-1 tracking-tight">
              {loading ? '...' : formatRupiah(summary.avg)}
            </p>
          </Card>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Sales Bar Chart */}
          <Card className="p-5 sm:p-6 flex flex-col justify-between">
            <CardHeader className="mb-4">
              <CardTitle>Grafik Penjualan ({period === 'today' ? 'Per Jam' : 'Per Tanggal'})</CardTitle>
            </CardHeader>
            {loading ? (
              <div className="h-64 flex items-center justify-center text-gray-400 text-sm">
                Memuat data grafik...
              </div>
            ) : salesData.length > 0 ? (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={salesData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#fce7f3" />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9d174d' }} axisLine={false} tickLine={false} />
                    <YAxis
                      tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                      tick={{ fontSize: 11, fill: '#9d174d' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      formatter={(v) => [formatRupiah(v), 'Omzet']}
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
                <p className="text-sm font-bold text-gray-600">Tidak ada data transaksi pada periode ini</p>
              </div>
            )}
          </Card>

          {/* Payment Method Distribution */}
          <Card className="p-5 sm:p-6 flex flex-col justify-between">
            <CardHeader className="mb-4">
              <CardTitle>Distribusi Metode Pembayaran</CardTitle>
            </CardHeader>
            {loading ? (
              <div className="h-64 flex items-center justify-center text-gray-400 text-sm">
                Memuat data metode pembayaran...
              </div>
            ) : paymentData.length > 0 ? (
              <div className="flex flex-col sm:flex-row items-center justify-center gap-6 h-64">
                <div className="w-48 h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={paymentData}
                        cx="50%"
                        cy="50%"
                        innerRadius={48}
                        outerRadius={78}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {paymentData.map((_, idx) => (
                          <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v) => formatRupiah(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-3">
                  {paymentData.map((d, idx) => (
                    <div key={d.name} className="flex items-center gap-3 text-sm">
                      <div
                        className="w-3.5 h-3.5 rounded-full shrink-0 shadow-2xs"
                        style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                      />
                      <span className="font-semibold text-gray-700">{d.name}:</span>
                      <span className="font-black text-gray-900">{formatRupiah(d.value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-64 flex flex-col items-center justify-center text-gray-400 bg-pink-50/30 rounded-2xl border border-dashed border-pink-200">
                <CreditCard className="w-10 h-10 mb-2 opacity-30 text-primary-400" />
                <p className="text-sm font-bold text-gray-600">Tidak ada data pembayaran</p>
              </div>
            )}
          </Card>
        </div>

        {/* Top Products Table */}
        <Card className="p-5 sm:p-6">
          <CardHeader className="mb-4">
            <div className="flex items-center justify-between w-full">
              <div>
                <CardTitle>Peringkat Menu Terlaris</CardTitle>
                <p className="text-xs text-gray-500 mt-0.5">Daftar produk paling banyak dipesan pada periode ini</p>
              </div>
              <span className="text-xs font-bold px-3 py-1 bg-primary-50 text-primary-700 rounded-xl border border-primary-200/60 shadow-2xs">
                Top 10 Menu
              </span>
            </div>
          </CardHeader>

          {loading ? (
            <div className="py-8 text-center text-gray-400 text-sm">Memuat data menu...</div>
          ) : topProducts.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-pink-100 text-xs font-bold text-gray-400 uppercase tracking-wider">
                    <th className="text-left py-3 px-3">No</th>
                    <th className="text-left py-3 px-3">Nama Menu</th>
                    <th className="text-right py-3 px-3">Porsi Terjual</th>
                    <th className="text-right py-3 px-3">Total Pendapatan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-pink-50">
                  {topProducts.map((p, idx) => (
                    <tr key={p.name} className="hover:bg-pink-50/40 transition-colors">
                      <td className="py-3 px-3">
                        <span
                          className={`w-7 h-7 rounded-xl inline-flex items-center justify-center text-xs font-black ${
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
                        </span>
                      </td>
                      <td className="py-3 px-3 font-bold text-gray-900">{p.name}</td>
                      <td className="py-3 px-3 text-right font-semibold text-gray-700">{p.qty} porsi</td>
                      <td className="py-3 px-3 text-right font-black text-primary-600">
                        {formatRupiah(p.revenue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-12 flex flex-col items-center justify-center text-gray-400 bg-pink-50/30 rounded-2xl border border-dashed border-pink-200">
              <Award className="w-10 h-10 mb-2 opacity-30 text-primary-400" />
              <p className="text-sm font-bold text-gray-600">Belum ada menu terjual pada periode ini</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
