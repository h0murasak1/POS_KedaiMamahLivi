import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Header from '@/components/layout/Header'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import EmptyState from '@/components/ui/EmptyState'
import { fieldClass } from '@/components/ui/Input'
import { formatDate } from '@/lib/utils'
import { format, isToday, isYesterday } from 'date-fns'
import { ClipboardList, Search, Calendar, RotateCcw, UserRound } from 'lucide-react'

const actionLabels = {
  login: { label: 'Login', variant: 'info' },
  logout: { label: 'Logout', variant: 'default' },
  create_order: { label: 'Transaksi Baru', variant: 'success' },
  cancel_order: { label: 'Pembatalan', variant: 'danger' },
  create_cashier: { label: 'Buat Kasir', variant: 'primary' },
  update_menu: { label: 'Ubah Menu', variant: 'warning' },
  update_settings: { label: 'Ubah Pengaturan', variant: 'warning' },
  sync_transaction: { label: 'Sinkronisasi', variant: 'info' },
  request_cancellation: { label: 'Ajukan Batal', variant: 'warning' },
  approve_cancellation: { label: 'Setujui Batal', variant: 'danger' },
  reject_cancellation: { label: 'Tolak Batal', variant: 'default' },
  direct_cancel: { label: 'Batal Langsung', variant: 'danger' },
  cancel_with_pin: { label: 'Batal via PIN', variant: 'danger' },
}

export default function AuditLogPage() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [dateFilter, setDateFilter] = useState('')

  useEffect(() => { fetchLogs() }, [dateFilter])

  const fetchLogs = async () => {
    setLoading(true)
    try {
      let query = supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(200)
      if (dateFilter) {
        const start = new Date(dateFilter); start.setHours(0, 0, 0, 0)
        const end = new Date(dateFilter); end.setHours(23, 59, 59, 999)
        query = query.gte('created_at', start.toISOString()).lte('created_at', end.toISOString())
      }
      const { data } = await query
      setLogs(data || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const filtered = logs.filter(l =>
    l.user_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    l.action?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    l.details?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const [actionFilter, setActionFilter] = useState('all')
  const shown = filtered.filter((l) => actionFilter === 'all' || l.action === actionFilter)
  const actionsPresent = [...new Set(logs.map((l) => l.action))]

  const dotColor = {
    success: 'bg-emerald-500', danger: 'bg-red-500', warning: 'bg-amber-500', info: 'bg-sky-500', primary: 'bg-primary-500', default: 'bg-zinc-400',
  }

  const groups = shown.reduce((acc, log) => {
    const d = new Date(log.created_at)
    const label = isToday(d) ? 'Hari ini' : isYesterday(d) ? 'Kemarin' : formatDate(log.created_at)
    if (!acc.length || acc[acc.length - 1].label !== label) acc.push({ label, items: [] })
    acc[acc.length - 1].items.push(log)
    return acc
  }, [])

  return (
    <div>
      <Header title="Audit Log" subtitle="Jejak aktivitas penting sistem" />
      <div className="p-4 sm:p-6 lg:p-8 space-y-4 max-w-[1000px] w-full">
        <div className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
            <input type="text" placeholder="Cari aktivitas atau pengguna…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} data-testid="audit-search-input" className={`${fieldClass} pl-10 bg-white`} />
          </div>
          <div className="flex gap-2">
            <div className="relative flex-1 sm:flex-none">
              <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
              <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} data-testid="audit-date-filter" className={`${fieldClass} pl-10 bg-white sm:w-48`} />
            </div>
            {dateFilter && <Button variant="secondary" onClick={() => setDateFilter('')} icon={RotateCcw} data-testid="audit-date-reset-button">Reset</Button>}
          </div>
        </div>

        {actionsPresent.length > 1 && (
          <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0" data-testid="audit-action-filter">
            {['all', ...actionsPresent].map((a) => (
              <button
                key={a}
                onClick={() => setActionFilter(a)}
                data-testid={`audit-filter-${a}`}
                className={`shrink-0 h-9 px-4 rounded-full text-sm font-semibold border transition-[background-color,color,border-color] ${actionFilter === a ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-white text-zinc-700 border-zinc-200 hover:border-primary-300'}`}
              >
                {a === 'all' ? 'Semua' : actionLabels[a]?.label || a}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="space-y-2">{[0, 1, 2, 3, 4].map((i) => <div key={i} className="h-16 animate-shimmer rounded-2xl" />)}</div>
        ) : shown.length === 0 ? (
          <EmptyState icon={ClipboardList} title="Tidak ada log aktivitas" description="Semua riwayat aksi sistem dan pengguna akan tercatat rapi di sini." />
        ) : (
          <div className="space-y-6" data-testid="audit-log-list">
            {groups.map((g) => (
              <div key={g.label}>
                <p className="text-xs font-bold uppercase tracking-[0.1em] text-zinc-500 mb-3 px-1">{g.label}</p>
                <ol className="relative ml-3 border-l-2 border-zinc-200 space-y-3 stagger">
                  {g.items.map((log) => {
                    const action = actionLabels[log.action] || { label: log.action, variant: 'default' }
                    return (
                      <li key={log.id} className="relative pl-6" data-testid={`audit-log-item-${log.id}`}>
                        <span className={`absolute -left-[7px] top-4 w-3 h-3 rounded-full ring-4 ring-linen ${dotColor[action.variant] || dotColor.default}`} />
                        <div className="p-3.5 sm:p-4 rounded-2xl bg-white border border-zinc-200/80 hover:border-primary-200 transition-colors">
                          <div className="flex flex-wrap items-center gap-2 justify-between">
                            <Badge variant={action.variant}>{action.label}</Badge>
                            <span className="font-mono text-[11px] text-zinc-400">{format(new Date(log.created_at), 'HH:mm:ss')}</span>
                          </div>
                          <p className="text-sm font-medium text-zinc-900 mt-2">{log.details || log.action}</p>
                          <p className="text-xs text-zinc-500 mt-1 flex items-center gap-1.5">
                            <UserRound className="w-3.5 h-3.5" /> {log.user_name || 'Sistem'}
                          </p>
                        </div>
                      </li>
                    )
                  })}
                </ol>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
