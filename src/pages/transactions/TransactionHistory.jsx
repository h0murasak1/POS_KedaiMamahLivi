import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { db } from '@/lib/db'
import Header from '@/components/layout/Header'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import EmptyState from '@/components/ui/EmptyState'
import { fieldClass, FieldLabel } from '@/components/ui/Input'
import NumericKeypad from '@/components/pos/NumericKeypad'
import ReceiptView from '@/components/pos/ReceiptView'
import { useStoreSettings } from '@/lib/useStoreSettings'
import { formatRupiah, formatDate, formatDateTime, paymentMethodLabels } from '@/lib/utils'
import { format, isToday, isYesterday } from 'date-fns'
import {
  Receipt, Search, Calendar, Printer, AlertTriangle, XCircle, CheckCircle, KeyRound, Send,
  ShieldAlert, Clock, RotateCcw, ChevronRight, CloudOff,
} from 'lucide-react'
import toast from 'react-hot-toast'

export default function TransactionHistory() {
  const { isOwner, user } = useAuth()
  const storeSettings = useStoreSettings()
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

  const QUICK_REASONS = ['Salah input menu', 'Pelanggan batal pesan', 'Pembayaran gagal', 'Pesanan dobel']

  const sorted = [...filtered].sort((a, b) => new Date(b.created_at_local) - new Date(a.created_at_local))
  const groups = sorted.reduce((acc, t) => {
    const d = new Date(t.created_at_local)
    const label = isToday(d) ? 'Hari ini' : isYesterday(d) ? 'Kemarin' : formatDate(t.created_at_local)
    if (!acc.length || acc[acc.length - 1].label !== label) acc.push({ label, items: [] })
    acc[acc.length - 1].items.push(t)
    return acc
  }, [])

  const completedList = filtered.filter((t) => t.order_status === 'completed')
  const completedTotal = completedList.reduce((s, t) => s + (Number(t.total_amount) || 0), 0)

  const tabs = [
    { id: 'all', label: 'Semua' },
    { id: 'completed', label: 'Selesai' },
    { id: 'requested', label: 'Perlu Izin', count: pendingRequestsCount },
    { id: 'cancelled', label: 'Dibatalkan' },
  ]

  const statusOf = (t) =>
    t.order_status === 'cancelled'
      ? { label: 'Dibatalkan', variant: 'danger', icon: XCircle, tone: 'bg-red-50 text-red-600' }
      : t.cancellation_status === 'requested'
        ? { label: 'Perlu Izin', variant: 'warning', icon: Clock, tone: 'bg-amber-50 text-amber-600' }
        : { label: 'Selesai', variant: 'success', icon: CheckCircle, tone: 'bg-emerald-50 text-emerald-600' }

  return (
    <div>
      <Header title="Riwayat Transaksi" subtitle={isOwner ? 'Semua transaksi kedai' : 'Transaksi yang Anda proses'} />
      <div className="p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-5 max-w-[1200px] w-full">
        {pendingRequestsCount > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-3xl bg-amber-50 border border-amber-200 animate-fade-in-up" data-testid="tx-pending-requests-banner">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-amber-950">{pendingRequestsCount} transaksi menunggu persetujuan pembatalan</p>
                <p className="text-xs text-amber-800 mt-0.5">
                  {isOwner ? 'Tinjau lalu setujui atau tolak pengajuan kasir.' : 'Pengajuan Anda sedang menunggu keputusan Owner.'}
                </p>
              </div>
            </div>
            <Button variant="dark" size="sm" onClick={() => setStatusTab('requested')} data-testid="tx-view-requests-button" className="self-end sm:self-auto">
              Lihat pengajuan
            </Button>
          </div>
        )}

        {/* Summary strip */}
        <div className="grid grid-cols-3 gap-2.5 sm:gap-4">
          {[
            { label: 'Transaksi', value: filtered.length, id: 'count' },
            { label: 'Omzet selesai', value: formatRupiah(completedTotal), mono: true, id: 'total' },
            { label: 'Perlu izin', value: pendingRequestsCount, id: 'requested', warn: pendingRequestsCount > 0 },
          ].map((s) => (
            <div key={s.id} className="p-3 sm:p-4 rounded-2xl bg-white border border-zinc-200/80" data-testid={`tx-summary-${s.id}`}>
              <p className="text-[11px] sm:text-xs font-semibold text-zinc-500">{s.label}</p>
              <p className={`mt-1 font-bold tracking-tight truncate ${s.mono ? 'font-mono text-sm sm:text-xl' : 'font-heading text-lg sm:text-2xl'} ${s.warn ? 'text-amber-600' : 'text-zinc-900'}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Cari nomor transaksi atau nama kasir…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              data-testid="tx-search-input"
              className={`${fieldClass} pl-10 bg-white`}
            />
          </div>
          <div className="flex gap-2">
            <div className="relative flex-1 md:flex-none">
              <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                data-testid="tx-date-filter"
                className={`${fieldClass} pl-10 bg-white md:w-48`}
              />
            </div>
            {dateFilter && (
              <Button variant="secondary" onClick={() => setDateFilter('')} icon={RotateCcw} data-testid="tx-date-reset-button">Reset</Button>
            )}
          </div>
        </div>

        <div className="flex gap-1 p-1 bg-zinc-100 rounded-2xl w-full sm:w-fit overflow-x-auto no-scrollbar" data-testid="tx-status-tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusTab(tab.id)}
              data-testid={`tx-tab-${tab.id}`}
              className={`flex-1 sm:flex-none shrink-0 h-9 px-4 rounded-xl text-sm font-semibold whitespace-nowrap flex items-center justify-center gap-1.5 transition-[background-color,color,box-shadow] ${statusTab === tab.id ? 'bg-white text-zinc-900 shadow-[0_1px_3px_rgba(24,24,27,0.12)]' : 'text-zinc-500 hover:text-zinc-800'
                }`}
            >
              {tab.label}
              {tab.count > 0 && <span className="min-w-5 h-5 px-1 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center">{tab.count}</span>}
            </button>
          ))}
        </div>

        {/* List */}
        {loading ? (
          <div className="space-y-2.5">{[0, 1, 2, 3, 4].map((i) => <div key={i} className="h-[76px] animate-shimmer rounded-2xl" />)}</div>
        ) : sorted.length === 0 ? (
          <EmptyState icon={Receipt} title="Tidak ada transaksi" description="Belum ada transaksi yang cocok dengan filter yang dipilih." />
        ) : (
          <div className="space-y-5" data-testid="tx-list">
            {groups.map((g) => (
              <div key={g.label}>
                <div className="flex items-center gap-3 mb-2 px-1">
                  <p className="text-xs font-bold uppercase tracking-[0.1em] text-zinc-500">{g.label}</p>
                  <span className="flex-1 h-px bg-zinc-200" />
                  <span className="text-[11px] font-semibold text-zinc-400">{g.items.length} transaksi</span>
                </div>
                <div className="bg-white rounded-2xl border border-zinc-200/80 divide-y divide-zinc-100 overflow-hidden stagger">
                  {g.items.map((t) => {
                    const st = statusOf(t)
                    return (
                      <button
                        key={t.id}
                        onClick={() => viewDetail(t, t._isLocal)}
                        data-testid={`tx-row-${t.id}`}
                        className={`group w-full flex items-center gap-3 sm:gap-4 px-3.5 sm:px-5 py-3.5 text-left hover:bg-primary-50/40 transition-colors ${t.cancellation_status === 'requested' ? 'bg-amber-50/40' : ''}`}
                      >
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${st.tone}`}>
                          <st.icon className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-mono text-[13px] font-semibold text-zinc-900 truncate">{t.order_number}</p>
                          <p className="text-xs text-zinc-500 mt-0.5 truncate">
                            {format(new Date(t.created_at_local), 'HH:mm')} · {t.cashier_name || 'Kasir'} · {paymentMethodLabels[t.payment_method] || t.payment_method}
                          </p>
                          {t.order_status === 'cancelled' && t.cancellation_reason && (
                            <p className="text-[11px] text-red-600 mt-0.5 truncate">Alasan: {t.cancellation_reason}</p>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <p className={`font-mono text-sm sm:text-base font-semibold tabular ${t.order_status === 'cancelled' ? 'line-through text-zinc-400' : 'text-zinc-900'}`}>
                            {formatRupiah(t.total_amount)}
                          </p>
                          <div className="flex items-center justify-end gap-1 mt-1">
                            {t.sync_status && t.sync_status !== 'synced' && t._isLocal && (
                              <span title="Belum tersinkron" className="w-5 h-5 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center"><CloudOff className="w-3 h-3" /></span>
                            )}
                            <Badge variant={st.variant}>{st.label}</Badge>
                          </div>
                        </div>
                        <ChevronRight className="hidden sm:block w-4 h-4 text-zinc-300 group-hover:text-primary-600 group-hover:translate-x-0.5 transition-[color,transform]" />
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Detail Modal */}
        <Modal
          isOpen={!!selected && !cancelModalOpen && !rejectModalOpen}
          onClose={() => setSelected(null)}
          title="Detail Transaksi"
          subtitle={selected ? formatDateTime(selected.created_at_local) : ''}
          icon={Receipt}
          size="md"
          testId="tx-detail-modal"
          footer={
            selected && (
              <div className="w-full flex flex-col gap-2">
                {selected.cancellation_status === 'requested' && (
                  isOwner ? (
                    <div className="grid grid-cols-2 gap-2">
                      <Button variant="danger-soft" onClick={() => setRejectModalOpen(true)} icon={XCircle} data-testid="tx-reject-cancel-button">Tolak</Button>
                      <Button variant="success" onClick={() => handleApproveCancellation(selected.id)} icon={CheckCircle} data-testid="tx-approve-cancel-button">Setujui Batal</Button>
                    </div>
                  ) : (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-center text-xs font-semibold text-amber-800">
                      Pengajuan pembatalan sedang menunggu keputusan Owner.
                    </div>
                  )
                )}
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="secondary" onClick={() => window.print()} icon={Printer} data-testid="tx-print-button" className={selected.order_status === 'completed' && selected.cancellation_status !== 'requested' ? '' : 'col-span-2'}>
                    Cetak Struk
                  </Button>
                  {selected.order_status === 'completed' && selected.cancellation_status !== 'requested' && (
                    <Button variant="danger-soft" onClick={() => openCancelDialog(selected)} icon={XCircle} data-testid="tx-open-cancel-button">
                      Batalkan
                    </Button>
                  )}
                </div>
              </div>
            )
          }
        >
          {selected && (
            <div className="space-y-4">
              {selected.order_status === 'cancelled' && (
                <div className="p-3.5 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3 text-xs text-red-700" data-testid="tx-detail-cancelled-alert">
                  <XCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-sm">Transaksi telah dibatalkan</p>
                    <p className="mt-0.5">Alasan: {selected.cancellation_reason || '-'}</p>
                    {selected.cancellation_approved_at && <p className="text-[11px] text-red-500 mt-0.5">Pada {formatDateTime(selected.cancellation_approved_at)}</p>}
                  </div>
                </div>
              )}
              {selected.cancellation_status === 'requested' && (
                <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3 text-xs text-amber-800" data-testid="tx-detail-requested-alert">
                  <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-sm">Pengajuan pembatalan menunggu persetujuan</p>
                    <p className="mt-0.5">Alasan: {selected.cancellation_reason || '-'}</p>
                    <p className="text-[11px] text-amber-600 mt-0.5">Diajukan oleh {selected.cancellation_requested_by_name || selected.cashier_name || 'Kasir'}</p>
                  </div>
                </div>
              )}
              <ReceiptView order={selected} items={selectedItems} settings={storeSettings} showSync={!!selected.isLocal} />
            </div>
          )}
        </Modal>

        {/* Cancellation Modal */}
        <Modal
          isOpen={cancelModalOpen}
          onClose={() => setCancelModalOpen(false)}
          title="Batalkan Transaksi"
          subtitle={selected?.order_number}
          icon={ShieldAlert}
          size="md"
          testId="tx-cancel-modal"
          footer={
            <div className="grid grid-cols-2 gap-2 w-full">
              <Button variant="secondary" onClick={() => setCancelModalOpen(false)} disabled={cancelling} data-testid="tx-cancel-modal-back-button">Kembali</Button>
              <Button variant="danger" onClick={handleExecuteCancel} loading={cancelling} icon={cancelMode === 'request' ? Send : XCircle} data-testid="tx-cancel-modal-confirm-button">
                {cancelMode === 'request' ? 'Kirim Pengajuan' : 'Konfirmasi Batal'}
              </Button>
            </div>
          }
        >
          <div className="space-y-5">
            <div className="flex items-center justify-between p-4 rounded-2xl bg-zinc-900 text-white">
              <div>
                <p className="text-[11px] text-white/60 font-semibold uppercase tracking-wider">Total transaksi</p>
                <p className="font-mono text-2xl font-semibold tabular mt-0.5">{formatRupiah(selected?.total_amount || 0)}</p>
              </div>
              <ShieldAlert className="w-9 h-9 text-primary-400" />
            </div>

            {!isOwner && (
              <div>
                <FieldLabel>Metode Otorisasi</FieldLabel>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'pin', icon: KeyRound, title: 'PIN Owner', desc: 'Owner ada di kedai' },
                    { id: 'request', icon: Send, title: 'Ajukan Jarak Jauh', desc: 'Kirim ke dashboard Owner' },
                  ].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setCancelMode(m.id)}
                      data-testid={`tx-cancel-mode-${m.id}`}
                      className={`p-3.5 rounded-2xl border-2 text-left transition-[background-color,border-color] ${cancelMode === m.id ? 'border-primary-500 bg-primary-50' : 'border-zinc-200 hover:border-zinc-300'}`}
                    >
                      <m.icon className={`w-5 h-5 ${cancelMode === m.id ? 'text-primary-600' : 'text-zinc-500'}`} />
                      <p className="text-sm font-bold text-zinc-900 mt-2">{m.title}</p>
                      <p className="text-[11px] text-zinc-500 mt-0.5">{m.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {cancelMode === 'pin' && (
              <div className="animate-fade-in-up">
                <FieldLabel hint="4–6 digit">PIN Otorisasi Owner</FieldLabel>
                <div className="flex justify-center gap-2.5 py-3" data-testid="tx-pin-dots">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <span
                      key={i}
                      className={`w-3.5 h-3.5 rounded-full transition-[background-color,transform] duration-150 ${i < ownerPin.length ? 'bg-primary-600 scale-110' : i < 4 ? 'bg-zinc-300' : 'bg-zinc-200'}`}
                    />
                  ))}
                </div>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={ownerPin}
                  onChange={(e) => setOwnerPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="Ketik PIN atau gunakan tombol"
                  data-testid="tx-owner-pin-input"
                  className={`${fieldClass} text-center font-mono tracking-[0.5em] mb-2`}
                />
                <NumericKeypad value={ownerPin} onChange={setOwnerPin} maxLength={6} showTripleZero={false} testIdPrefix="tx-pin-keypad" />
              </div>
            )}

            <div>
              <FieldLabel>Alasan Pembatalan *</FieldLabel>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {QUICK_REASONS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setCancelReason(r)}
                    data-testid={`tx-quick-reason-${r.toLowerCase().replace(/\s+/g, '-')}`}
                    className={`h-8 px-3 rounded-full text-xs font-semibold border transition-colors ${cancelReason === r ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-white text-zinc-700 border-zinc-200 hover:border-primary-300'}`}
                  >
                    {r}
                  </button>
                ))}
              </div>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Tulis alasan lain jika perlu…"
                rows={2}
                data-testid="tx-cancel-reason-input"
                className={`${fieldClass} resize-none`}
              />
            </div>
          </div>
        </Modal>

        {/* Rejection Modal */}
        <Modal
          isOpen={rejectModalOpen}
          onClose={() => setRejectModalOpen(false)}
          title="Tolak Pengajuan"
          subtitle={selected?.order_number}
          icon={XCircle}
          size="sm"
          testId="tx-reject-modal"
          footer={
            <div className="grid grid-cols-2 gap-2 w-full">
              <Button variant="secondary" onClick={() => setRejectModalOpen(false)} disabled={rejecting} data-testid="tx-reject-back-button">Kembali</Button>
              <Button variant="danger" onClick={handleRejectCancellation} loading={rejecting} data-testid="tx-reject-confirm-button">Tolak</Button>
            </div>
          }
        >
          <FieldLabel>Catatan untuk kasir</FieldLabel>
          <textarea
            value={rejectNote}
            onChange={(e) => setRejectNote(e.target.value)}
            placeholder="Contoh: Pembayaran QRIS sudah masuk di mutasi."
            rows={3}
            data-testid="tx-reject-note-input"
            className={`${fieldClass} resize-none`}
          />
        </Modal>
      </div>
    </div>
  )
}
