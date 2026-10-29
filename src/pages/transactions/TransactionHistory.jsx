import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { db } from '@/lib/db'
import Header from '@/components/layout/Header'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import EmptyState from '@/components/ui/EmptyState'
import { formatRupiah, formatDateTime, syncStatusLabels, paymentMethodLabels } from '@/lib/utils'
import {
  Receipt,
  Search,
  Calendar,
  Printer,
  AlertTriangle,
  XCircle,
  CheckCircle,
  KeyRound,
  Send,
  ShieldAlert,
  Clock,
  Filter,
} from 'lucide-react'
import toast from 'react-hot-toast'

export default function TransactionHistory() {
  const { isOwner, user, profile } = useAuth()
  const [transactions, setTransactions] = useState([])
  const [localTransactions, setLocalTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [selectedItems, setSelectedItems] = useState([])
  const [dateFilter, setDateFilter] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [statusTab, setStatusTab] = useState('all') // 'all', 'completed', 'requested', 'cancelled'

  // Cancellation Modal States
  const [cancelModalOpen, setCancelModalOpen] = useState(false)
  const [cancelMode, setCancelMode] = useState('pin') // 'pin' | 'request' | 'owner_direct'
  const [cancelReason, setCancelReason] = useState('')
  const [ownerPin, setOwnerPin] = useState('')
  const [cancelling, setCancelling] = useState(false)

  // Rejection Modal
  const [rejectModalOpen, setRejectModalOpen] = useState(false)
  const [rejectNote, setRejectNote] = useState('')
  const [rejecting, setRejecting] = useState(false)

  useEffect(() => {
    fetchTransactions()
  }, [dateFilter])

  const fetchTransactions = async () => {
    setLoading(true)
    try {
      // Fetch from Supabase
      let query = supabase
        .from('orders')
        .select('*')
        .order('created_at_local', { ascending: false })
        .limit(150)

      if (!isOwner) query = query.eq('cashier_id', user.id)

      if (dateFilter) {
        const start = new Date(dateFilter)
        start.setHours(0, 0, 0, 0)
        const end = new Date(dateFilter)
        end.setHours(23, 59, 59, 999)
        query = query.gte('created_at_local', start.toISOString()).lte('created_at_local', end.toISOString())
      }
      const { data } = await query
      setTransactions(data || [])

      // Also fetch local transactions from IndexedDB
      let localOrders = []
      if (db) {
        let localQuery = db.local_orders
        if (!isOwner) localQuery = localQuery.filter((o) => o.cashier_id === user.id)
        localOrders = await localQuery.toArray()
      }
      setLocalTransactions(localOrders)
    } catch (e) {
      console.error(e)
      if (db) {
        const local = await db.local_orders.reverse().sortBy('created_at_local')
        setLocalTransactions(local)
      }
    } finally {
      setLoading(false)
    }
  }

  const viewDetail = async (order, isLocal = false) => {
    setSelected({ ...order, isLocal })
    if (isLocal) {
      const items = await db.local_order_items.where('order_id').equals(order.id).toArray()
      setSelectedItems(items)
    } else {
      const { data } = await supabase.from('order_items').select('*').eq('order_id', order.id)
      setSelectedItems(data || [])
    }
  }

  // Merge transactions without duplicates
  const allTransactions = [
    ...localTransactions.map((t) => ({ ...t, _isLocal: true })),
    ...transactions.filter((t) => !localTransactions.find((lt) => lt.id === t.id)),
  ]

  // Filter based on search and status tab
  const filtered = allTransactions.filter((t) => {
    const matchesSearch =
      t.order_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.cashier_name?.toLowerCase().includes(searchQuery.toLowerCase())

    if (!matchesSearch) return false

    if (statusTab === 'completed') {
      return t.order_status === 'completed' && t.cancellation_status !== 'requested'
    }
    if (statusTab === 'requested') {
      return t.cancellation_status === 'requested'
    }
    if (statusTab === 'cancelled') {
      return t.order_status === 'cancelled'
    }
    return true
  })

  // Count pending cancellation requests
  const pendingRequestsCount = allTransactions.filter(
    (t) => t.cancellation_status === 'requested'
  ).length

  // Handler: Open Cancel Modal
  const openCancelDialog = (order) => {
    setSelected(order)
    setCancelReason('')
    setOwnerPin('')
    if (isOwner) {
      setCancelMode('owner_direct')
    } else {
      setCancelMode('pin')
    }
    setCancelModalOpen(true)
  }

  // Handler: Execute Cancellation / Request
  const handleExecuteCancel = async () => {
    if (!cancelReason.trim()) {
      toast.error('Mohon isi alasan pembatalan transaksi')
      return
    }

    if (cancelMode === 'pin' && (!ownerPin || ownerPin.length < 4)) {
      toast.error('PIN Owner minimal 4 digit')
      return
    }

    setCancelling(true)
    try {
      const orderId = selected.id

      if (cancelMode === 'owner_direct') {
        // Direct cancel by Owner
        const { data, error } = await supabase.rpc('owner_direct_cancel_order', {
          p_order_id: orderId,
          p_reason: cancelReason,
        })

        if (error) throw error
        if (data && !data.success) {
          toast.error(data.message)
          return
        }

        // Update local if exists
        if (db) {
          await db.local_orders.update(orderId, {
            order_status: 'cancelled',
            cancellation_status: 'approved',
            cancellation_reason: cancelReason,
          })
        }

        toast.success('Transaksi berhasil dibatalkan')
      } else if (cancelMode === 'pin') {
        // Cashier cancel with Owner PIN
        const { data, error } = await supabase.rpc('cancel_order_with_pin', {
          p_order_id: orderId,
          p_pin: ownerPin,
          p_reason: cancelReason,
        })

        if (error) {
          // If network failed, check local settings fallback
          if (db) {
            const cachedPin = await db.cached_settings.get('owner_pin')
            const validPin = cachedPin?.value || '1234'
            if (ownerPin.trim() === validPin.trim()) {
              await db.local_orders.update(orderId, {
                order_status: 'cancelled',
                cancellation_status: 'approved',
                cancellation_reason: cancelReason,
                sync_status: 'pending',
              })
              toast.success('Transaksi berhasil dibatalkan secara offline (dengan izin PIN Owner)')
              setCancelModalOpen(false)
              fetchTransactions()
              setSelected(null)
              return
            } else {
              toast.error('PIN Owner salah')
              return
            }
          }
          throw error
        }

        if (data && !data.success) {
          toast.error(data.message)
          return
        }

        if (db) {
          await db.local_orders.update(orderId, {
            order_status: 'cancelled',
            cancellation_status: 'approved',
            cancellation_reason: cancelReason,
          })
        }

        toast.success('Transaksi berhasil dibatalkan dengan otorisasi Owner')
      } else if (cancelMode === 'request') {
        // Cashier request cancellation to Owner
        const { data, error } = await supabase.rpc('request_order_cancellation', {
          p_order_id: orderId,
          p_reason: cancelReason,
        })

        if (error) throw error
        if (data && !data.success) {
          toast.error(data.message)
          return
        }

        if (db) {
          await db.local_orders.update(orderId, {
            cancellation_status: 'requested',
            cancellation_reason: cancelReason,
          })
        }

        toast.success('Permintaan pembatalan berhasil dikirim ke Owner')
      }

      setCancelModalOpen(false)
      setSelected(null)
      fetchTransactions()
    } catch (err) {
      console.error(err)
      toast.error('Gagal memproses pembatalan: ' + (err.message || 'Terjadi kesalahan'))
    } finally {
      setCancelling(false)
    }
  }

  // Handler: Owner Approves Cancellation
  const handleApproveCancellation = async (orderId) => {
    try {
      const { data, error } = await supabase.rpc('approve_order_cancellation', {
        p_order_id: orderId,
      })

      if (error) throw error
      if (data && !data.success) {
        toast.error(data.message)
        return
      }

      if (db) {
        await db.local_orders.update(orderId, {
          order_status: 'cancelled',
          cancellation_status: 'approved',
        })
      }

      toast.success('Pembatalan transaksi berhasil disetujui')
      setSelected(null)
      fetchTransactions()
    } catch (err) {
      console.error(err)
      toast.error('Gagal menyetujui: ' + (err.message || 'Terjadi kesalahan'))
    }
  }

  // Handler: Owner Rejects Cancellation
  const handleRejectCancellation = async () => {
    setRejecting(true)
    try {
      const { data, error } = await supabase.rpc('reject_order_cancellation', {
        p_order_id: selected.id,
        p_rejection_note: rejectNote || 'Ditolak oleh Owner',
      })

      if (error) throw error
      if (data && !data.success) {
        toast.error(data.message)
        return
      }

      if (db) {
        await db.local_orders.update(selected.id, {
          cancellation_status: 'rejected',
        })
      }

      toast.success('Pengajuan pembatalan telah ditolak')
      setRejectModalOpen(false)
      setSelected(null)
      fetchTransactions()
    } catch (err) {
      console.error(err)
      toast.error('Gagal menolak pembatalan')
    } finally {
      setRejecting(false)
    }
  }

  return (
    <div>
      <Header title="Riwayat Transaksi" />
      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
        {/* Banner Alert for Pending Cancellation Requests */}
        {pendingRequestsCount > 0 && (
          <div className="p-4 bg-gradient-to-r from-pink-50 via-rose-50 to-amber-50 border border-pink-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-pink-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-primary-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900">
                  {pendingRequestsCount} Transaksi Menunggu Persetujuan Pembatalan
                </p>
                <p className="text-xs text-gray-600 mt-0.5">
                  {isOwner
                    ? 'Kasir mengajukan pembatalan transaksi. Mohon tinjau dan setujui atau tolak.'
                    : 'Permintaan pembatalan transaksi Anda sedang menunggu persetujuan dari Owner.'}
                </p>
              </div>
            </div>
            <button
              onClick={() => setStatusTab('requested')}
              className="px-4 py-2 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 active:scale-95 text-white text-xs font-bold rounded-xl transition-all shadow-sm shadow-pink-200 whitespace-nowrap self-end sm:self-auto cursor-pointer"
            >
              Lihat Permintaan
            </button>
          </div>
        )}

        {/* Filter Controls */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Cari nomor transaksi / kasir..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-sm sm:text-base border border-pink-200/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-400 bg-white shadow-2xs transition-all"
            />
          </div>
          <div className="flex gap-2">
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="pl-9 pr-3 py-2.5 text-xs sm:text-sm border border-pink-200/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-400 bg-white shadow-2xs transition-all"
              />
            </div>
            {dateFilter && (
              <Button variant="ghost" size="sm" onClick={() => setDateFilter('')} className="hover:bg-pink-50 hover:text-primary-600">
                Reset
              </Button>
            )}
          </div>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {[
            { id: 'all', label: 'Semua Transaksi' },
            { id: 'completed', label: 'Selesai' },
            {
              id: 'requested',
              label: `Perlu Izin (${pendingRequestsCount})`,
              badge: pendingRequestsCount > 0,
            },
            { id: 'cancelled', label: 'Dibatalkan' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusTab(tab.id)}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all duration-200 flex items-center gap-1.5 cursor-pointer ${
                statusTab === tab.id
                  ? 'bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-sm shadow-pink-200 scale-102'
                  : 'bg-white/80 border border-pink-100/80 text-gray-600 hover:bg-pink-50 hover:text-primary-600'
              }`}
            >
              <span>{tab.label}</span>
              {tab.badge && (
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              )}
            </button>
          ))}
        </div>

        {/* Transaction List */}
        {loading ? (
          <div className="text-center py-16 text-gray-400 text-sm">Memuat transaksi...</div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="Tidak ada transaksi"
            description="Tidak ada transaksi yang cocok dengan filter yang dipilih."
          />
        ) : (
          <div className="space-y-3">
            {filtered.map((t) => (
              <Card
                key={t.id}
                className={`cursor-pointer hover:border-pink-300 card-glow transition-all p-4 ${
                  t.cancellation_status === 'requested'
                    ? 'border-amber-300 bg-amber-50/20'
                    : t.order_status === 'cancelled'
                    ? 'border-red-200 bg-red-50/10'
                    : ''
                }`}
                onClick={() => viewDetail(t, t._isLocal)}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div
                      className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                        t.order_status === 'cancelled'
                          ? 'bg-red-50 text-red-600'
                          : t.cancellation_status === 'requested'
                          ? 'bg-amber-50 text-amber-600'
                          : 'bg-primary-50 text-primary-600 shadow-2xs'
                      }`}
                    >
                      {t.order_status === 'cancelled' ? (
                        <XCircle className="w-6 h-6" />
                      ) : t.cancellation_status === 'requested' ? (
                        <Clock className="w-6 h-6" />
                      ) : (
                        <Receipt className="w-6 h-6" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-gray-900 truncate">{t.order_number}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {formatDateTime(t.created_at_local)} • {t.cashier_name || 'Kasir'}
                      </p>
                      {t.cancellation_status === 'requested' && (
                        <p className="text-xs font-semibold text-amber-700 mt-1 flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>Menunggu persetujuan pembatalan</span>
                        </p>
                      )}
                      {t.order_status === 'cancelled' && (
                        <p className="text-xs text-red-600 mt-1 truncate">
                          Alasan: {t.cancellation_reason || 'Dibatalkan'}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <p
                      className={`font-extrabold text-base ${
                        t.order_status === 'cancelled'
                          ? 'line-through text-gray-400'
                          : 'text-primary-600'
                      }`}
                    >
                      {formatRupiah(t.total_amount)}
                    </p>
                    <div className="flex items-center justify-end gap-1.5 mt-1.5 flex-wrap">
                      {t.order_status === 'cancelled' ? (
                        <Badge variant="danger">Dibatalkan</Badge>
                      ) : t.cancellation_status === 'requested' ? (
                        <Badge variant="warning">Perlu Izin</Badge>
                      ) : (
                        <Badge variant="success">Selesai</Badge>
                      )}
                      <span className="text-[10px] px-2 py-0.5 bg-pink-50 border border-pink-100 rounded-md font-semibold text-pink-700 uppercase">
                        {t.payment_method}
                      </span>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Detail Modal */}
        <Modal
          isOpen={!!selected && !cancelModalOpen && !rejectModalOpen}
          onClose={() => setSelected(null)}
          title="Detail Transaksi"
          size="md"
          footer={
            selected && (
              <div className="w-full flex flex-col gap-2">
                {/* Actions for Requested Cancellation */}
                {selected.cancellation_status === 'requested' && (
                  <>
                    {isOwner ? (
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          variant="danger"
                          className="w-full"
                          onClick={() => setRejectModalOpen(true)}
                          icon={XCircle}
                        >
                          Tolak
                        </Button>
                        <Button
                          variant="primary"
                          className="w-full bg-green-600 hover:bg-green-700 text-white"
                          onClick={() => handleApproveCancellation(selected.id)}
                          icon={CheckCircle}
                        >
                          Setujui Batal
                        </Button>
                      </div>
                    ) : (
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-center text-xs font-semibold text-amber-800">
                        Permintaan pembatalan sedang menunggu konfirmasi dari Owner.
                      </div>
                    )}
                  </>
                )}

                {/* Action for Active Completed Order: Cancellation Button */}
                {selected.order_status === 'completed' &&
                  selected.cancellation_status !== 'requested' && (
                    <Button
                      variant="outline"
                      className="w-full border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 font-semibold"
                      onClick={() => openCancelDialog(selected)}
                      icon={XCircle}
                    >
                      {isOwner ? 'Batalkan Transaksi' : 'Batalkan Transaksi (Izin Owner)'}
                    </Button>
                  )}

                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => window.print()}
                  icon={Printer}
                >
                  Cetak Struk
                </Button>
              </div>
            )
          }
        >
          {selected && (
            <div className="space-y-4">
              {/* Status Alert in Detail */}
              {selected.order_status === 'cancelled' && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-xs text-red-700">
                  <XCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">Transaksi Telah Dibatalkan</p>
                    <p className="mt-0.5">Alasan: {selected.cancellation_reason || '-'}</p>
                    {selected.cancellation_approved_at && (
                      <p className="text-[11px] text-red-500 mt-0.5">
                        Dibatalkan pada: {formatDateTime(selected.cancellation_approved_at)}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {selected.cancellation_status === 'requested' && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-xs text-amber-800">
                  <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">Pengajuan Pembatalan Menunggu Persetujuan</p>
                    <p className="mt-0.5">Alasan: {selected.cancellation_reason || '-'}</p>
                    <p className="text-[11px] text-amber-600 mt-0.5">
                      Diajukan oleh: {selected.cancellation_requested_by_name || selected.cashier_name || 'Kasir'}
                    </p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 text-sm bg-gray-50 p-3.5 rounded-xl">
                <div>
                  <span className="text-xs text-gray-500">No. Transaksi</span>
                  <p className="font-bold text-gray-900">{selected.order_number}</p>
                </div>
                <div>
                  <span className="text-xs text-gray-500">Waktu</span>
                  <p className="font-medium text-gray-900">{formatDateTime(selected.created_at_local)}</p>
                </div>
                <div>
                  <span className="text-xs text-gray-500">Kasir</span>
                  <p className="font-medium text-gray-900">{selected.cashier_name || 'Kasir'}</p>
                </div>
                <div>
                  <span className="text-xs text-gray-500">Pembayaran</span>
                  <p className="font-medium text-gray-900">
                    {paymentMethodLabels[selected.payment_method] || selected.payment_method}
                  </p>
                </div>
              </div>

              {/* Items */}
              <div className="border-t pt-3">
                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                  Daftar Pesanan
                </h4>
                <div className="space-y-1.5">
                  {selectedItems.map((item) => (
                    <div key={item.id} className="flex justify-between py-1 text-sm">
                      <div className="pr-2">
                        <span className="font-medium text-gray-900">{item.product_name}</span>
                        {item.variant_name && (
                          <span className="text-xs text-gray-500"> ({item.variant_name})</span>
                        )}
                        <span className="text-xs text-gray-400"> × {item.quantity}</span>
                      </div>
                      <span className="font-semibold text-gray-900 shrink-0">
                        {formatRupiah(item.subtotal)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Totals */}
              <div className="border-t pt-3 space-y-1.5 text-sm">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal</span>
                  <span>{formatRupiah(selected.subtotal)}</span>
                </div>
                {selected.discount_amount > 0 && (
                  <div className="flex justify-between text-green-600 font-medium">
                    <span>Diskon</span>
                    <span>-{formatRupiah(selected.discount_amount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-extrabold text-base text-gray-900 pt-1 border-t">
                  <span>Total Pembayaran</span>
                  <span className={selected.order_status === 'cancelled' ? 'line-through text-gray-400' : 'text-primary-600'}>
                    {formatRupiah(selected.total_amount)}
                  </span>
                </div>
                {selected.cash_received && (
                  <>
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>Uang Tunai Diterima</span>
                      <span>{formatRupiah(selected.cash_received)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>Kembalian</span>
                      <span>{formatRupiah(selected.change_amount)}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </Modal>

        {/* Cancellation Action Modal (With Owner Permission) */}
        <Modal
          isOpen={cancelModalOpen}
          onClose={() => setCancelModalOpen(false)}
          title="Batalkan Transaksi"
          size="md"
          footer={
            <div className="flex gap-2 w-full">
              <Button
                variant="outline"
                className="w-1/2"
                onClick={() => setCancelModalOpen(false)}
                disabled={cancelling}
              >
                Batal
              </Button>
              <Button
                variant="danger"
                className="w-1/2 font-bold"
                onClick={handleExecuteCancel}
                loading={cancelling}
                icon={cancelMode === 'request' ? Send : XCircle}
              >
                {cancelMode === 'request' ? 'Kirim Pengajuan' : 'Konfirmasi Batal'}
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            <div className="p-3 bg-red-50 rounded-xl border border-red-100 flex items-center gap-3">
              <ShieldAlert className="w-8 h-8 text-red-600 shrink-0" />
              <div>
                <p className="text-xs text-red-600">Nomor Transaksi:</p>
                <p className="text-base font-extrabold text-red-900">{selected?.order_number}</p>
                <p className="text-xs text-red-700">Total: {formatRupiah(selected?.total_amount || 0)}</p>
              </div>
            </div>

            {/* Mode Selector for Cashier */}
            {!isOwner && (
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  Metode Otorisasi
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setCancelMode('pin')}
                    className={`p-3 rounded-xl border text-left transition-colors ${
                      cancelMode === 'pin'
                        ? 'border-primary-500 bg-primary-50 text-primary-900 font-bold'
                        : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                    }`}
                  >
                    <KeyRound className="w-5 h-5 mb-1 text-primary-600" />
                    <p className="text-xs font-bold">PIN Owner di Tempat</p>
                    <p className="text-[11px] font-normal text-gray-500 mt-0.5">
                      Owner ada di kedai dan memasukkan PIN langsung
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCancelMode('request')}
                    className={`p-3 rounded-xl border text-left transition-colors ${
                      cancelMode === 'request'
                        ? 'border-primary-500 bg-primary-50 text-primary-900 font-bold'
                        : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                    }`}
                  >
                    <Send className="w-5 h-5 mb-1 text-primary-600" />
                    <p className="text-xs font-bold">Pengajuan Jarak Jauh</p>
                    <p className="text-[11px] font-normal text-gray-500 mt-0.5">
                      Kirim permintaan ke dashboard Owner
                    </p>
                  </button>
                </div>
              </div>
            )}

            {/* If PIN mode: Input PIN */}
            {cancelMode === 'pin' && (
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Masukkan PIN Otorisasi Owner
                </label>
                <div className="relative">
                  <input
                    type="password"
                    maxLength={6}
                    value={ownerPin}
                    onChange={(e) => setOwnerPin(e.target.value.replace(/\D/g, ''))}
                    placeholder="Masukkan 4-6 digit PIN"
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl font-mono text-center tracking-widest text-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    autoFocus
                  />
                  <KeyRound className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                </div>
                <p className="text-[11px] text-gray-400 mt-1">
                  Minta pemilik kedai untuk memasukkan PIN keamanan (default: 1234).
                </p>
              </div>
            )}

            {/* Alasan Pembatalan */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Alasan Pembatalan <span className="text-red-500">*</span>
              </label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Contoh: Pelanggan batal bayar QRIS, salah pilih varian menu, dll."
                rows={3}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
        </Modal>

        {/* Rejection Modal for Owner */}
        <Modal
          isOpen={rejectModalOpen}
          onClose={() => setRejectModalOpen(false)}
          title="Tolak Pengajuan Pembatalan"
          size="sm"
          footer={
            <div className="flex gap-2 w-full">
              <Button
                variant="outline"
                className="w-1/2"
                onClick={() => setRejectModalOpen(false)}
                disabled={rejecting}
              >
                Kembali
              </Button>
              <Button
                variant="danger"
                className="w-1/2"
                onClick={handleRejectCancellation}
                loading={rejecting}
              >
                Konfirmasi Tolak
              </Button>
            </div>
          }
        >
          <div className="space-y-3">
            <p className="text-xs text-gray-600">
              Berikan catatan penolakan untuk kasir mengenai transaksi{' '}
              <strong>{selected?.order_number}</strong>:
            </p>
            <textarea
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              placeholder="Contoh: Bukti pembayaran QRIS sudah terverifikasi masuk di mutasi bank."
              rows={3}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </Modal>
      </div>
    </div>
  )
}
