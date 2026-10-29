import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useSync } from '@/contexts/SyncContext'
import { supabase } from '@/lib/supabase'
import { db } from '@/lib/db'
import Header from '@/components/layout/Header'
import Card, { CardHeader, CardTitle } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { formatRupiah, formatRelative } from '@/lib/utils'
import {
  ShoppingCart,
  Receipt,
  DollarSign,
  Clock,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Wifi,
  WifiOff,
  Sparkles,
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
        } catch (_) {}
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

  return (
    <div>
      <Header title="Dashboard Kasir" />
      <div className="p-4 sm:p-6 space-y-6 animate-fade-in-up">
        {/* Welcome Hero Banner */}
        <div className="bg-gradient-to-r from-primary-500 via-primary-600 to-pink-600 rounded-3xl p-6 sm:p-8 text-white shadow-lg shadow-primary-200/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5 relative overflow-hidden">
          <div className="absolute -right-8 -top-8 w-48 h-48 bg-white/10 rounded-full blur-xl pointer-events-none" />
          <div className="relative z-10">
            <span className="inline-flex items-center gap-1 px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs font-bold uppercase tracking-wider mb-2">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Semangat Bekerja</span>
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Halo, {profile?.full_name || 'Kasir'} 👋
            </h1>
            <p className="text-white/85 text-xs sm:text-sm mt-1 max-w-md">
              Siap melayani pesanan pelanggan Kedai Mamah Livi dengan cepat & ramah hari ini.
            </p>
          </div>
          <button
            onClick={() => navigate('/pos')}
            className="inline-flex items-center justify-center gap-2.5 px-6 py-3.5 bg-white text-primary-700 hover:bg-pink-50 active:scale-95 font-extrabold rounded-2xl shadow-md transition-all self-start sm:self-auto relative z-10 text-base"
          >
            <ShoppingCart className="w-5 h-5 text-primary-600" />
            <span>Buka Kasir (POS)</span>
          </button>
        </div>

        {/* Today's Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card className="p-5 sm:p-6 card-glow">
            <div className="flex items-center gap-4">
              <div className="w-13 h-13 bg-primary-50 border border-primary-100 rounded-2xl flex items-center justify-center shrink-0 shadow-2xs">
                <DollarSign className="w-6 h-6 text-primary-600" />
              </div>
              <div>
                <p className="text-xs sm:text-sm text-gray-500 font-semibold">Penjualan Saya Hari Ini</p>
                <p className="text-xl sm:text-2xl font-black text-gray-900 mt-1 tracking-tight">
                  {formatRupiah(todayStats.total)}
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-5 sm:p-6 card-glow">
            <div className="flex items-center gap-4">
              <div className="w-13 h-13 bg-rose-50 border border-rose-100 rounded-2xl flex items-center justify-center shrink-0 shadow-2xs">
                <Receipt className="w-6 h-6 text-rose-600" />
              </div>
              <div>
                <p className="text-xs sm:text-sm text-gray-500 font-semibold">Transaksi Berhasil</p>
                <p className="text-xl sm:text-2xl font-black text-gray-900 mt-1 tracking-tight">
                  {todayStats.count} Transaksi
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Sync Status Card */}
        <Card className="p-5 sm:p-6">
          <CardHeader className="mb-4">
            <CardTitle>Status Jaringan & Sinkronisasi</CardTitle>
          </CardHeader>
          <div className="space-y-3.5">
            <div className="flex items-center justify-between p-3 rounded-2xl bg-pink-50/30 border border-pink-100">
              <div className="flex items-center gap-2 text-sm font-bold">
                {isOnline ? (
                  <>
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-emerald-700">Tersambung ke Server (Online)</span>
                  </>
                ) : (
                  <>
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                    <span className="text-rose-700">Mode Luar Jaringan (Offline)</span>
                  </>
                )}
              </div>
              {lastSyncTime && (
                <span className="text-xs text-gray-400 font-medium">
                  Terakhir: {formatRelative(lastSyncTime)}
                </span>
              )}
            </div>

            {pendingCount > 0 && (
              <div className="flex items-center gap-2.5 p-3 rounded-2xl bg-amber-50 border border-amber-200 text-xs font-semibold text-amber-800">
                <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                <span>{pendingCount} transaksi tersimpan lokal dan menunggu sinkronisasi otomatis.</span>
              </div>
            )}

            {failedCount > 0 && (
              <div className="flex items-center gap-2.5 p-3 rounded-2xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-800">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{failedCount} transaksi gagal terkirim — hubungi pemilik jika berlanjut.</span>
              </div>
            )}

            {pendingCount === 0 && failedCount === 0 && (
              <div className="flex items-center gap-2.5 p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800">
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Semua data pesanan tersinkronisasi sempurna dengan server cloud.</span>
              </div>
            )}

            {(pendingCount > 0 || failedCount > 0) && (
              <div className="pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={syncNow}
                  disabled={isSyncing || !isOnline}
                  loading={isSyncing}
                  icon={RefreshCw}
                >
                  Sinkronkan Sekarang
                </Button>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}
