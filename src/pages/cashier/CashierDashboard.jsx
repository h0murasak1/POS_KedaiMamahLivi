import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useSync } from '@/contexts/SyncContext'
import { supabase } from '@/lib/supabase'
import { db } from '@/lib/db'
import Header from '@/components/layout/Header'
import Card, { CardHeader, CardTitle } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import { formatRupiah, formatRelative, getGreeting } from '@/lib/utils'
import {
  ShoppingCart, Receipt, Wallet, Clock, RefreshCw, AlertTriangle, CheckCircle, ArrowRight, Keyboard,
} from 'lucide-react'

export default function CashierDashboard() {
  const { profile, user } = useAuth()
  const { isOnline, isSyncing, pendingCount, failedCount, lastSyncTime, syncNow } = useSync()
  const navigate = useNavigate()
  const [todayStats, setTodayStats] = useState({ count: 0, total: 0 })

  useEffect(() => {
    fetchTodayStats()
  }, [user])

  const fetchTodayStats = async () => {
    try {
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      let serverOrders = []
      if (isOnline) {
        const { data } = await supabase
          .from('orders')
          .select('id, total_amount, order_status')
          .eq('cashier_id', user?.id)
          .gte('created_at_local', today.toISOString())
          .eq('order_status', 'completed')
        serverOrders = data || []
      }

      let localOrders = []
      if (db) {
        try {
          localOrders = await db.local_orders
            .where('cashier_id')
            .equals(user?.id || '')
            .filter((o) => new Date(o.created_at_local) >= today && o.order_status === 'completed')
            .toArray()
        } catch (_) { }
      }

      // Merge unik
      const orderMap = new Map()
      serverOrders.forEach((o) => orderMap.set(o.id, o))
      localOrders.forEach((o) => {
        if (!orderMap.has(o.id)) orderMap.set(o.id, o)
      })
      const finalOrders = Array.from(orderMap.values())

      setTodayStats({
        count: finalOrders.length,
        total: finalOrders.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0),
      })
    } catch (error) {
      console.error('Error fetching stats:', error)
    }
  }

  const greeting = getGreeting()
  const todayLabel = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })
  const allSynced = pendingCount === 0 && failedCount === 0

  const tips = [
    { k: '/', t: 'Cari menu dengan cepat' },
    { k: 'F4', t: 'Buka pembayaran' },
    { k: 'Esc', t: 'Tutup jendela' },
  ]

  return (
    <div>
      <Header title="Beranda" subtitle="Semangat melayani hari ini" />
      <div className="p-4 sm:p-6 lg:p-8 space-y-5 sm:space-y-6 max-w-[1200px] w-full">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-3xl bg-zinc-900 text-white p-6 sm:p-8 animate-fade-in-up" data-testid="cashier-hero">
          <div className="absolute inset-0 bg-dots opacity-40" />
          <div className="absolute -right-10 -top-20 w-72 h-72 rounded-full bg-primary-600/40 blur-3xl" />
          <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <p className="text-xs font-medium text-white/60">{todayLabel}</p>
              <h1 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight mt-1" data-testid="cashier-greeting">
                {greeting}, {profile?.full_name?.split(' ')[0] || 'Kasir'} 👋
              </h1>
              <p className="text-sm text-white/70 mt-2 max-w-md">Siap melayani pelanggan Kedai Mamah Livi dengan cepat & ramah.</p>
            </div>
            <button
              onClick={() => navigate('/pos')}
              data-testid="cashier-open-pos-button"
              className="group relative inline-flex items-center justify-center gap-3 h-16 px-8 bg-gradient-to-br from-primary-500 to-primary-600 hover:from-primary-400 font-heading text-lg font-bold rounded-2xl shadow-[0_16px_36px_-12px_rgba(234,88,12,0.85)] active:scale-95 transition-[background-color,transform]"
            >
              <span className="absolute inset-0 rounded-2xl animate-pulse-pink" />
              <ShoppingCart className="w-6 h-6" />
              Mulai Transaksi
              <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
            </button>
          </div>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-2 gap-3 sm:gap-5 stagger">
          <Card className="p-4 sm:p-6" data-testid="cashier-kpi-sales">
            <div className="w-11 h-11 rounded-2xl bg-primary-50 border border-primary-200/70 text-primary-700 flex items-center justify-center">
              <Wallet className="w-5 h-5" />
            </div>
            <p className="text-xs sm:text-sm font-semibold text-zinc-500 mt-4">Penjualan saya hari ini</p>
            <p className="font-mono text-xl sm:text-3xl font-semibold text-zinc-900 tracking-tight mt-1 tabular truncate">{formatRupiah(todayStats.total)}</p>
          </Card>
          <Card className="p-4 sm:p-6" data-testid="cashier-kpi-count">
            <div className="w-11 h-11 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center">
              <Receipt className="w-5 h-5" />
            </div>
            <p className="text-xs sm:text-sm font-semibold text-zinc-500 mt-4">Transaksi berhasil</p>
            <p className="font-heading text-xl sm:text-3xl font-bold text-zinc-900 tracking-tight mt-1">
              {todayStats.count} <span className="text-sm font-sans font-medium text-zinc-400">pesanan</span>
            </p>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 sm:gap-5">
          {/* Sync status */}
          <Card className="lg:col-span-3" hover={false} data-testid="cashier-sync-card">
            <CardHeader>
              <div>
                <CardTitle>Jaringan & Sinkronisasi</CardTitle>
                <p className="text-xs text-zinc-500 mt-0.5">
                  {lastSyncTime ? `Sinkron terakhir ${formatRelative(lastSyncTime)}` : 'Belum pernah sinkron di perangkat ini'}
                </p>
              </div>
              <Badge variant={isOnline ? 'success' : 'warning'} dot>{isOnline ? 'Online' : 'Offline'}</Badge>
            </CardHeader>

            <div className={`flex items-center gap-4 p-4 rounded-2xl border ${allSynced ? 'bg-emerald-50/70 border-emerald-200' : failedCount > 0 ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${allSynced ? 'bg-emerald-500 text-white' : failedCount > 0 ? 'bg-red-500 text-white' : 'bg-amber-400 text-amber-950'}`}>
                {allSynced ? <CheckCircle className="w-6 h-6" /> : failedCount > 0 ? <AlertTriangle className="w-6 h-6" /> : <Clock className="w-6 h-6" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-bold ${allSynced ? 'text-emerald-900' : failedCount > 0 ? 'text-red-900' : 'text-amber-950'}`} data-testid="cashier-sync-status-text">
                  {allSynced ? 'Semua data aman tersinkron' : failedCount > 0 ? `${failedCount} transaksi gagal terkirim` : `${pendingCount} transaksi menunggu sinkron`}
                </p>
                <p className="text-xs text-zinc-600 mt-0.5">
                  {allSynced ? 'Transaksi tersimpan di server cloud.' : failedCount > 0 ? 'Coba sinkron ulang. Hubungi pemilik jika tetap gagal.' : 'Akan terkirim otomatis saat online.'}
                </p>
              </div>
              {!allSynced && (
                <Button variant="dark" size="sm" onClick={syncNow} disabled={isSyncing || !isOnline} loading={isSyncing} icon={RefreshCw} data-testid="cashier-sync-now-button">
                  Sinkron
                </Button>
              )}
            </div>
          </Card>

          {/* Tips */}
          <Card className="lg:col-span-2" hover={false} data-testid="cashier-tips-card">
            <CardHeader>
              <div>
                <CardTitle>Tips Kasir Cepat</CardTitle>
                <p className="text-xs text-zinc-500 mt-0.5">Pintasan keyboard di laptop</p>
              </div>
              <Keyboard className="w-5 h-5 text-zinc-400" />
            </CardHeader>
            <div className="space-y-2">
              {tips.map((t) => (
                <div key={t.k} className="flex items-center justify-between p-3 rounded-xl bg-zinc-50 border border-zinc-100">
                  <span className="text-sm text-zinc-700">{t.t}</span>
                  <kbd className="min-w-8 h-7 px-2 rounded-lg border border-zinc-200 bg-white font-mono text-xs font-semibold text-zinc-600 flex items-center justify-center shadow-[0_1px_0_rgba(24,24,27,0.08)]">{t.k}</kbd>
                </div>
              ))}
              <p className="text-xs text-zinc-500 pt-1">Di HP & tablet, gunakan tombol <b>Kasir</b> oranye di bawah layar.</p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
