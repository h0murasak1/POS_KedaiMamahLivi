import { useSync } from '@/contexts/SyncContext'
import { RefreshCw, CheckCircle, AlertTriangle, WifiOff, Cloud } from 'lucide-react'
import { formatRelative } from '@/lib/utils'

export default function SyncStatusBar() {
  const { isOnline, isSyncing, pendingCount, failedCount, lastSyncTime, syncNow } = useSync()

  // Don't show if everything is fine and online
  if (isOnline && pendingCount === 0 && failedCount === 0) return null

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 lg:left-[calc(50%+128px)] z-50">
      <div className={`flex items-center gap-3 px-4 py-2.5 rounded-full shadow-lg text-sm font-medium ${
        !isOnline
          ? 'bg-gray-800 text-white'
          : failedCount > 0
          ? 'bg-red-600 text-white'
          : 'bg-yellow-500 text-white'
      }`}>
        {!isOnline ? (
          <>
            <WifiOff className="w-4 h-4" />
            <span>Mode Offline — Transaksi tersimpan lokal</span>
          </>
        ) : isSyncing ? (
          <>
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span>Menyinkronkan transaksi...</span>
          </>
        ) : failedCount > 0 ? (
          <>
            <AlertTriangle className="w-4 h-4" />
            <span>{failedCount} transaksi gagal sinkron</span>
            <button
              onClick={syncNow}
              className="ml-2 px-2 py-0.5 bg-white/20 rounded-full hover:bg-white/30 text-xs"
            >
              Coba Lagi
            </button>
          </>
        ) : (
          <>
            <Cloud className="w-4 h-4" />
            <span>{pendingCount} transaksi menunggu sinkronisasi</span>
            <button
              onClick={syncNow}
              className="ml-2 px-2 py-0.5 bg-white/20 rounded-full hover:bg-white/30 text-xs"
            >
              Sinkronkan
            </button>
          </>
        )}
      </div>
    </div>
  )
}
