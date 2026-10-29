import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Header from '@/components/layout/Header'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import EmptyState from '@/components/ui/EmptyState'
import { formatDateTime } from '@/lib/utils'
import { ClipboardList, Search, Calendar } from 'lucide-react'

const actionLabels = {
  login: { label: 'Login', variant: 'info' },
  logout: { label: 'Logout', variant: 'default' },
  create_order: { label: 'Transaksi Baru', variant: 'success' },
  cancel_order: { label: 'Pembatalan', variant: 'danger' },
  create_cashier: { label: 'Buat Kasir', variant: 'primary' },
  update_menu: { label: 'Ubah Menu', variant: 'warning' },
  update_settings: { label: 'Ubah Pengaturan', variant: 'warning' },
  sync_transaction: { label: 'Sinkronisasi', variant: 'info' },
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

  return (
    <div>
      <Header title="Audit Log" />
      <div className="p-4 sm:p-6 space-y-6">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Cari aktivitas atau pengguna..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-sm sm:text-base border border-pink-200/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-400 bg-white shadow-2xs transition-all"
            />
          </div>
          <div className="relative">
            <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="date"
              value={dateFilter}
              onChange={e => setDateFilter(e.target.value)}
              className="pl-10 pr-4 py-2.5 text-xs sm:text-sm border border-pink-200/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-400 bg-white shadow-2xs transition-all"
            />
          </div>
        </div>

        {loading ? (
          <div className="text-center py-16 text-gray-400 text-sm">Memuat catatan aktivitas...</div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={ClipboardList} title="Tidak ada log aktivitas" description="Semua riwayat aksi sistem dan pengguna akan tercatat rapi di sini" />
        ) : (
          <div className="space-y-2.5">
            {filtered.map((log) => {
              const action = actionLabels[log.action] || { label: log.action, variant: 'default' }
              return (
                <Card key={log.id} className="p-3.5 sm:p-4 hover:border-pink-300 card-glow transition-all">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <Badge variant={action.variant}>{action.label}</Badge>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{log.details || log.action}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Oleh: <span className="font-medium text-gray-700">{log.user_name || 'System'}</span> • {formatDateTime(log.created_at)}
                        </p>
                      </div>
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
