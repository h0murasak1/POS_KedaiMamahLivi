import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { db } from '@/lib/db'
import Header from '@/components/layout/Header'
import Card, { CardHeader, CardTitle } from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import EmptyState from '@/components/ui/EmptyState'
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
import { TrendingUp, Award, CreditCard, Wallet, Receipt, Flame } from 'lucide-react'

const COLORS = ['#ea580c', '#f59e0b', '#10b981', '#0284c7', '#71717a', '#fb923c']

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
        ; (serverOrders || []).forEach((o) => orderMap.set(o.id, o))
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

  const periods = [
    { val: 'today', label: 'Hari Ini' },
    { val: 'week', label: '7 Hari' },
    { val: 'month', label: '30 Hari' },
    { val: 'year', label: '1 Tahun' },
  ]
  const paymentTotal = paymentData.reduce((s, d) => s + d.value, 0) || 1
  const maxQty = topProducts[0]?.qty || 1
  const bestSlot = salesData.reduce((best, d) => (d.amount > (best?.amount || 0) ? d : best), null)

  const summaryCards = [
    { id: 'total', label: 'Total Pendapatan', value: formatRupiah(summary.total), icon: Wallet, dark: true },
    { id: 'count', label: 'Transaksi Selesai', value: `${summary.count}`, suffix: 'transaksi', icon: Receipt },
    { id: 'avg', label: 'Rata-rata / Transaksi', value: formatRupiah(summary.avg), icon: TrendingUp, mono: true },
    { id: 'peak', label: period === 'today' ? 'Jam Tersibuk' : 'Hari Terlaris', value: bestSlot?.date || '-', icon: Flame },
  ]

  return (
    <div>
      <Header title="Laporan Penjualan" subtitle="Pantau performa kedai dari waktu ke waktu" />
      <div className="p-4 sm:p-6 lg:p-8 space-y-5 sm:space-y-6 max-w-[1400px] w-full">
        <div className="flex gap-1 p-1 bg-zinc-100 rounded-2xl w-full sm:w-fit" data-testid="report-period-tabs">
          {periods.map((p) => (
            <button
              key={p.val}
              onClick={() => setPeriod(p.val)}
              data-testid={`report-period-${p.val}`}
              className={`flex-1 sm:flex-none h-10 px-5 rounded-xl text-sm font-semibold whitespace-nowrap transition-[background-color,color,box-shadow] ${period === p.val ? 'bg-white text-zinc-900 shadow-[0_1px_3px_rgba(24,24,27,0.12)]' : 'text-zinc-500 hover:text-zinc-800'
                }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 stagger">
          {summaryCards.map((c) => (
            <div
              key={c.id}
              data-testid={`report-summary-${c.id}`}
              className={`relative overflow-hidden rounded-2xl p-4 sm:p-5 border ${c.dark ? 'bg-zinc-900 border-zinc-900 text-white col-span-2 lg:col-span-1' : 'bg-white border-zinc-200/80'}`}
            >
              {c.dark && <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-primary-600/40 blur-2xl" />}
              <div className="relative flex items-center justify-between">
                <p className={`text-xs font-semibold ${c.dark ? 'text-white/60' : 'text-zinc-500'}`}>{c.label}</p>
                <c.icon className={`w-4 h-4 ${c.dark ? 'text-primary-300' : 'text-zinc-400'}`} />
              </div>
              <p className={`relative mt-2 font-semibold tracking-tight truncate ${c.dark || c.mono ? 'font-mono' : 'font-heading font-bold'} ${c.dark ? 'text-2xl sm:text-3xl' : 'text-lg sm:text-2xl text-zinc-900'}`}>
                {loading ? '…' : c.value}
                {c.suffix && !loading && <span className="text-xs font-sans font-medium text-zinc-400 ml-1">{c.suffix}</span>}
              </p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 sm:gap-5">
          <Card className="lg:col-span-3" hover={false} data-testid="report-sales-chart">
            <CardHeader>
              <div>
                <CardTitle>Grafik Omzet</CardTitle>
                <p className="text-xs text-zinc-500 mt-0.5">{period === 'today' ? 'Per jam' : 'Per tanggal'}</p>
              </div>
            </CardHeader>
            {loading ? (
              <div className="h-72 animate-shimmer rounded-2xl" />
            ) : salesData.length > 0 ? (
              <div className="h-72 w-full -ml-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={salesData} margin={{ top: 10, right: 8, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="reportBar" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f97316" />
                        <stop offset="100%" stopColor="#ea580c" stopOpacity={0.75} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f4f4f5" />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#71717a' }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}rb`} tick={{ fontSize: 11, fill: '#71717a' }} axisLine={false} tickLine={false} />
                    <Tooltip
                      cursor={{ fill: 'rgba(234,88,12,0.06)' }}
                      formatter={(v) => [formatRupiah(v), 'Omzet']}
                      contentStyle={{ borderRadius: 14, border: '1px solid #e4e4e7', boxShadow: '0 12px 30px -12px rgba(24,24,27,0.25)', fontSize: 12 }}
                    />
                    <Bar dataKey="amount" fill="url(#reportBar)" radius={[8, 8, 2, 2]} maxBarSize={48} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyState compact icon={TrendingUp} title="Tidak ada transaksi" description="Belum ada penjualan pada periode ini." />
            )}
          </Card>

          <Card className="lg:col-span-2" hover={false} data-testid="report-payment-chart">
            <CardHeader>
              <div>
                <CardTitle>Metode Pembayaran</CardTitle>
                <p className="text-xs text-zinc-500 mt-0.5">Porsi omzet per metode</p>
              </div>
            </CardHeader>
            {loading ? (
              <div className="h-72 animate-shimmer rounded-2xl" />
            ) : paymentData.length > 0 ? (
              <div className="flex flex-col items-center gap-5">
                <div className="relative w-44 h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={paymentData} cx="50%" cy="50%" innerRadius={54} outerRadius={80} paddingAngle={3} dataKey="value" stroke="none">
                        {paymentData.map((_, idx) => <Cell key={idx} fill={COLORS[idx % COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v) => formatRupiah(v)} contentStyle={{ borderRadius: 14, border: '1px solid #e4e4e7', fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Metode</span>
                    <span className="font-heading text-2xl font-bold text-zinc-900">{paymentData.length}</span>
                  </div>
                </div>
                <div className="w-full space-y-2.5">
                  {paymentData.map((d, idx) => (
                    <div key={d.name} className="flex items-center gap-3 text-sm" data-testid={`report-payment-row-${d.name.toLowerCase()}`}>
                      <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                      <span className="font-semibold text-zinc-700 flex-1">{d.name}</span>
                      <span className="text-xs font-semibold text-zinc-400">{Math.round((d.value / paymentTotal) * 100)}%</span>
                      <span className="font-mono text-sm font-semibold text-zinc-900 tabular">{formatRupiah(d.value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <EmptyState compact icon={CreditCard} title="Tidak ada data" description="Belum ada pembayaran pada periode ini." />
            )}
          </Card>
        </div>

        <Card hover={false} data-testid="report-top-products">
          <CardHeader>
            <div>
              <CardTitle>Peringkat Menu Terlaris</CardTitle>
              <p className="text-xs text-zinc-500 mt-0.5">Menu paling banyak dipesan pada periode ini</p>
            </div>
            <Badge variant="primary">Top 10</Badge>
          </CardHeader>
          {loading ? (
            <div className="space-y-2">{[0, 1, 2, 3].map((i) => <div key={i} className="h-12 animate-shimmer rounded-xl" />)}</div>
          ) : topProducts.length > 0 ? (
            <div className="divide-y divide-zinc-100 stagger">
              {topProducts.map((p, idx) => (
                <div key={p.name} className="flex items-center gap-3 sm:gap-4 py-3" data-testid={`report-top-product-${idx}`}>
                  <span className={`w-8 h-8 rounded-xl text-xs font-bold flex items-center justify-center shrink-0 ${idx === 0 ? 'bg-secondary-400 text-secondary-950' : idx === 1 ? 'bg-zinc-300 text-zinc-800' : idx === 2 ? 'bg-primary-200 text-primary-900' : 'bg-zinc-100 text-zinc-500'}`}>
                    {idx === 0 ? <Award className="w-4 h-4" /> : idx + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-zinc-900 truncate">{p.name}</p>
                      <p className="font-mono text-sm font-semibold text-zinc-900 shrink-0 tabular">{formatRupiah(p.revenue)}</p>
                    </div>
                    <div className="flex items-center gap-2 mt-1.5">
                      <div className="flex-1 h-1.5 rounded-full bg-zinc-100 overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-primary-500 to-secondary-400" style={{ width: `${(p.qty / maxQty) * 100}%` }} />
                      </div>
                      <span className="text-[11px] font-semibold text-zinc-500 w-16 text-right">{p.qty} porsi</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState compact icon={Award} title="Belum ada menu terjual" description="Peringkat akan muncul setelah ada transaksi." />
          )}
        </Card>
      </div>
    </div>
  )
}
