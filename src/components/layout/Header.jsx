import { useEffect, useState } from 'react'
import { useSync } from '@/contexts/SyncContext'
import { useLayout } from '@/contexts/LayoutContext'
import { useSoundEnabled, setSoundEnabled, playTap } from '@/lib/sound'
import { format } from 'date-fns'
import { id as localeId } from 'date-fns/locale/id'
import { RefreshCw, AlertTriangle, Menu as MenuIcon, Volume2, VolumeX } from 'lucide-react'
import { BrandMark } from './Sidebar'

function LiveClock() {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(t)
  }, [])
  return (
    <div className="hidden md:flex flex-col items-end leading-tight pr-1" data-testid="header-clock">
      <span className="font-mono text-sm font-semibold text-zinc-900 tabular">{format(now, 'HH:mm')}</span>
      <span className="text-[10px] font-medium text-zinc-500">{format(now, 'EEEE, d MMM', { locale: localeId })}</span>
    </div>
  )
}

export default function Header({ title, subtitle, onMenuClick, actions }) {
  const { isOnline, isSyncing, pendingCount, failedCount, syncNow } = useSync()
  const { toggleSidebar } = useLayout()
  const soundOn = useSoundEnabled()

  return (
    <header className="glass border-b border-zinc-200/70 px-4 sm:px-6 h-16 flex items-center justify-between gap-3 sticky top-0 z-30" data-testid="page-header">
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onMenuClick || toggleSidebar}
          aria-label="Buka Menu Navigasi"
          data-testid="header-menu-button"
          className="lg:hidden -ml-1 shrink-0"
        >
          <span className="sr-only">Menu</span>
          <span className="hidden sm:flex w-10 h-10 rounded-xl items-center justify-center hover:bg-zinc-100 text-zinc-700">
            <MenuIcon className="w-5 h-5" />
          </span>
          <span className="sm:hidden block scale-[0.82] origin-left"><BrandMark /></span>
        </button>
        <div className="min-w-0">
          <h2 className="font-heading text-lg sm:text-xl font-bold text-zinc-900 tracking-tight truncate leading-tight" data-testid="page-title">{title}</h2>
          {subtitle && <p className="text-xs text-zinc-500 truncate hidden sm:block">{subtitle}</p>}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {actions}
        {pendingCount > 0 && (
          <button
            onClick={syncNow}
            disabled={isSyncing || !isOnline}
            data-testid="header-sync-button"
            className="flex items-center gap-1.5 px-3 h-9 rounded-xl text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 active:scale-95 transition-[background-color,transform] disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{isSyncing ? 'Menyinkronkan…' : `${pendingCount} antre sync`}</span>
            <span className="sm:hidden">{pendingCount}</span>
          </button>
        )}

        {failedCount > 0 && (
          <div className="flex items-center gap-1.5 px-2.5 h-9 rounded-xl text-xs font-bold bg-red-50 text-red-700 border border-red-200" data-testid="header-failed-count">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>{failedCount}</span>
          </div>
        )}

        <button
          onClick={() => { setSoundEnabled(!soundOn); if (!soundOn) setTimeout(playTap, 30) }}
          data-testid="header-sound-toggle"
          title={soundOn ? 'Matikan suara' : 'Nyalakan suara'}
          className="w-9 h-9 rounded-xl flex items-center justify-center text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 transition-colors active:scale-90"
        >
          {soundOn ? <Volume2 className="w-[18px] h-[18px]" /> : <VolumeX className="w-[18px] h-[18px]" />}
        </button>

        <div
          data-testid="header-online-status"
          className={`flex items-center gap-2 px-3 h-9 rounded-xl text-xs font-bold border ${isOnline ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-800 border-amber-200'
            }`}
        >
          <span className="relative flex w-2 h-2">
            {isOnline && <span className="absolute inset-0 rounded-full bg-emerald-500 animate-ping-soft" />}
            <span className={`relative w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-amber-500'}`} />
          </span>
          <span className="hidden sm:inline">{isOnline ? 'Online' : 'Offline'}</span>
        </div>

        <LiveClock />
      </div>
    </header>
  )
}
