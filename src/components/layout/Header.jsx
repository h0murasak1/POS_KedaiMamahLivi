import { useSync } from '@/contexts/SyncContext'
import { useAuth } from '@/contexts/AuthContext'
import { useLayout } from '@/contexts/LayoutContext'
import { 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  AlertTriangle,
  Menu as MenuIcon 
} from 'lucide-react'

export default function Header({ title, onMenuClick }) {
  const { isOnline, isSyncing, pendingCount, failedCount, syncNow } = useSync()
  const { toggleSidebar } = useLayout()

  return (
    <header className="bg-white/80 backdrop-blur-md border-b border-pink-100/80 px-4 sm:px-6 py-3 flex items-center justify-between sticky top-0 z-30 transition-all shadow-xs">
      <div className="flex items-center gap-3">
        {/* Mobile menu button */}
        <button
          onClick={onMenuClick || toggleSidebar}
          aria-label="Buka Menu Navigasi"
          className="lg:hidden p-2 -ml-1 rounded-xl hover:bg-primary-50 active:bg-primary-100 text-gray-700 hover:text-primary-600 transition-colors"
        >
          <MenuIcon className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-primary-500 animate-pulse hidden sm:inline-block" />
          <h2 className="text-base sm:text-lg font-extrabold text-gray-900 tracking-tight truncate">{title}</h2>
        </div>
      </div>

      <div className="flex items-center gap-2.5 sm:gap-3">
        {/* Sync status */}
        {pendingCount > 0 && (
          <button
            onClick={syncNow}
            disabled={isSyncing || !isOnline}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200/60 hover:bg-amber-100 active:scale-95 transition-all shadow-2xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-amber-600 ${isSyncing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{isSyncing ? 'Menyinkronkan...' : `${pendingCount} Menunggu Sync`}</span>
            <span className="sm:hidden">{pendingCount}</span>
          </button>
        )}

        {failedCount > 0 && (
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-red-50 text-red-700 border border-red-200/60 shadow-2xs">
            <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
            <span>{failedCount} Gagal</span>
          </div>
        )}

        {/* Online/Offline indicator */}
        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all shadow-2xs ${
          isOnline 
            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60' 
            : 'bg-rose-50 text-rose-700 border border-rose-200/60'
        }`}>
          <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
          {isOnline ? (
            <span className="flex items-center gap-1">
              <Wifi className="w-3 h-3 text-emerald-600" />
              <span>Online</span>
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <WifiOff className="w-3 h-3 text-rose-600" />
              <span>Offline</span>
            </span>
          )}
        </div>
      </div>
    </header>
  )
}
