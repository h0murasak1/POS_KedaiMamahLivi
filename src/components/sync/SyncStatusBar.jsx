import { useSync } from '@/contexts/SyncContext'
import { RefreshCw, AlertTriangle, WifiOff, CloudUpload } from 'lucide-react'

export default function SyncStatusBar() {
  const { isOnline, isSyncing, pendingCount, failedCount, syncNow } = useSync()

  // Don't show if everything is fine and online
  if (isOnline && pendingCount === 0 && failedCount === 0) return null

  const tone = !isOnline
    ? 'bg-zinc-900 text-white'
    : failedCount > 0
      ? 'bg-red-600 text-white'
      : 'bg-amber-500 text-amber-950'

  return (
    <div
      data-testid="sync-status-bar"
      className="no-print fixed z-[45] left-1/2 -translate-x-1/2 top-[72px] lg:top-auto lg:bottom-5 lg:left-[calc(50%+124px)] animate-scale-in"
    >
      <div className={`flex items-center gap-2.5 pl-3.5 pr-2 py-2 rounded-full shadow-[0_12px_30px_-10px_rgba(24,24,27,0.5)] text-xs sm:text-sm font-semibold whitespace-nowrap ${tone}`}>
        {!isOnline ? (
          <>
            <WifiOff className="w-4 h-4" />
            <span className="pr-1.5">Offline — transaksi aman tersimpan di perangkat</span>
          </>
        ) : isSyncing ? (
          <>
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span className="pr-1.5">Menyinkronkan transaksi…</span>
          </>
        ) : failedCount > 0 ? (
          <>
            <AlertTriangle className="w-4 h-4" />
            <span>{failedCount} gagal sinkron</span>
            <button
              onClick={syncNow}
              data-testid="sync-status-retry-button"
              className="px-3 py-1 bg-white/20 rounded-full hover:bg-white/30 text-xs font-bold transition-colors"
            >
              Coba Lagi
            </button>
          </>
        ) : (
          <>
            <CloudUpload className="w-4 h-4" />
            <span>{pendingCount} menunggu sinkron</span>
            <button
              onClick={syncNow}
              data-testid="sync-status-sync-button"
              className="px-3 py-1 bg-white/30 rounded-full hover:bg-white/50 text-xs font-bold transition-colors"
            >
              Sinkronkan
            </button>
          </>
        )}
      </div>
    </div>
  )
}
