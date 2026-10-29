import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useLayout } from '@/contexts/LayoutContext'
import { useSync } from '@/contexts/SyncContext'
import { LogOut, ChefHat, X } from 'lucide-react'
import { ownerLinks, cashierLinks } from './navLinks'

export function BrandMark({ size = 'md' }) {
  const box = size === 'lg' ? 'w-14 h-14 rounded-[20px]' : 'w-11 h-11 rounded-2xl'
  const icon = size === 'lg' ? 'w-7 h-7' : 'w-6 h-6'
  return (
    <div className={`${box} relative bg-gradient-to-br from-primary-500 via-primary-600 to-red-600 flex items-center justify-center shadow-[0_8px_20px_-8px_rgba(234,88,12,0.7)] shrink-0`}>
      <ChefHat className={`${icon} text-white`} strokeWidth={2.2} />
      <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-secondary-400 border-2 border-white" />
    </div>
  )
}

export default function Sidebar() {
  const { profile, signOut, isOwner } = useAuth()
  const { closeSidebar } = useLayout()
  const { isOnline } = useSync()
  const navigate = useNavigate()

  const handleLogout = async () => {
    closeSidebar()
    await signOut()
    navigate('/login')
  }

  const links = isOwner ? ownerLinks : cashierLinks
  const groups = [...new Set(links.map((l) => l.group))]

  return (
    <aside className="h-full w-full bg-white border-r border-zinc-200/70 flex flex-col" data-testid="sidebar">
      {/* Brand */}
      <div className="px-5 pt-6 pb-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BrandMark />
          <div className="leading-tight">
            <p className="font-heading text-[17px] font-bold text-zinc-900 tracking-tight">Kedai Mamah Livi</p>
            <p className="text-[11px] font-semibold text-zinc-500 flex items-center gap-1.5 mt-0.5">
              <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              {isOnline ? 'Terhubung' : 'Mode Offline'}
            </p>
          </div>
        </div>
        <button
          onClick={closeSidebar}
          data-testid="sidebar-close-button"
          className="lg:hidden w-9 h-9 flex items-center justify-center text-zinc-400 hover:text-zinc-900 rounded-xl hover:bg-zinc-100 transition-colors"
          aria-label="Tutup Menu"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 pb-4 overflow-y-auto space-y-5">
        {groups.map((group) => (
          <div key={group}>
            <p className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-400">{group}</p>
            <div className="space-y-0.5">
              {links.filter((l) => l.group === group).map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  onClick={closeSidebar}
                  data-testid={`sidebar-nav-${link.id}`}
                  className={({ isActive }) =>
                    `group relative flex items-center gap-3 px-3 min-h-11 rounded-xl text-sm transition-[background-color,color] duration-150 ${isActive
                      ? 'bg-primary-50 text-primary-800 font-bold'
                      : 'text-zinc-600 font-medium hover:bg-zinc-50 hover:text-zinc-900'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <span className={`absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-primary-600 transition-transform duration-200 origin-left ${isActive ? 'scale-x-100' : 'scale-x-0'}`} />
                      <link.icon className={`w-[18px] h-[18px] shrink-0 transition-transform duration-200 group-hover:scale-110 ${isActive ? 'text-primary-600' : 'text-zinc-400 group-hover:text-zinc-700'}`} />
                      <span>{link.label}</span>
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* User card */}
      <div className="p-3 border-t border-zinc-100">
        <div className="flex items-center gap-3 p-2.5 rounded-2xl bg-zinc-50 border border-zinc-100">
          <div className="w-10 h-10 bg-gradient-to-br from-zinc-800 to-zinc-950 rounded-xl flex items-center justify-center shrink-0">
            <span className="font-heading text-sm font-bold text-white" data-testid="sidebar-user-initial">
              {profile?.full_name?.charAt(0)?.toUpperCase() || 'U'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-zinc-900 truncate" data-testid="sidebar-user-name">{profile?.full_name || 'Pengguna'}</p>
            <p className="text-[11px] font-semibold text-primary-700" data-testid="sidebar-user-role">
              {profile?.role === 'owner' ? 'Pemilik Kedai' : 'Kasir'}
            </p>
          </div>
          <button
            onClick={handleLogout}
            data-testid="sidebar-logout-button"
            title="Keluar"
            className="w-9 h-9 rounded-xl flex items-center justify-center text-zinc-400 hover:text-red-600 hover:bg-red-50 transition-colors active:scale-90"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  )
}
