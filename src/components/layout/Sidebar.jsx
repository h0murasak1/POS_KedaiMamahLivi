import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useLayout } from '@/contexts/LayoutContext'
import {
  LayoutDashboard,
  ShoppingCart,
  UtensilsCrossed,
  Users,
  Receipt,
  BarChart3,
  Settings,
  LogOut,
  ChefHat,
  ClipboardList,
  X,
  Sparkles,
} from 'lucide-react'

export default function Sidebar() {
  const { profile, signOut, isOwner } = useAuth()
  const { closeSidebar } = useLayout()
  const navigate = useNavigate()

  const handleLogout = async () => {
    closeSidebar()
    await signOut()
    navigate('/login')
  }

  const ownerLinks = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/pos', icon: ShoppingCart, label: 'POS (Kasir)' },
    { to: '/menu', icon: UtensilsCrossed, label: 'Menu' },
    { to: '/kasir', icon: Users, label: 'Kasir' },
    { to: '/transaksi', icon: Receipt, label: 'Transaksi' },
    { to: '/laporan', icon: BarChart3, label: 'Laporan' },
    { to: '/pengaturan', icon: Settings, label: 'Pengaturan' },
    { to: '/audit', icon: ClipboardList, label: 'Audit Log' },
  ]

  const cashierLinks = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/pos', icon: ShoppingCart, label: 'POS (Kasir)' },
    { to: '/transaksi', icon: Receipt, label: 'Transaksi' },
  ]

  const links = isOwner ? ownerLinks : cashierLinks

  return (
    <aside className="h-full w-full bg-white/95 backdrop-blur-xl border-r border-pink-100/80 flex flex-col shadow-xl lg:shadow-none">
      {/* Logo & Close Button */}
      <div className="px-5 py-5 border-b border-pink-100/60 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 bg-gradient-to-br from-primary-500 to-primary-600 rounded-2xl flex items-center justify-center shadow-lg shadow-primary-200/50 animate-pulse-pink">
            <ChefHat className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-base font-extrabold text-gray-900 leading-tight tracking-tight">Kedai</h1>
            <p className="text-xs font-medium text-primary-500 flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              Mamah Livi
            </p>
          </div>
        </div>
        {/* Mobile close button */}
        <button
          onClick={closeSidebar}
          className="lg:hidden p-2 text-gray-400 hover:text-primary-600 rounded-xl hover:bg-primary-50 transition-all duration-200"
          aria-label="Tutup Menu"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            onClick={closeSidebar}
            className={({ isActive }) =>
              `group flex items-center gap-3 px-3.5 py-3 rounded-2xl text-sm font-medium transition-all duration-200 ${
                isActive
                  ? 'bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-md shadow-primary-200/40 font-bold scale-[1.02]'
                  : 'text-gray-600 hover:bg-primary-50/80 hover:text-primary-700 active:scale-[0.98]'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-200 ${
                  isActive 
                    ? 'bg-white/25' 
                    : 'bg-gray-100/80 group-hover:bg-primary-100'
                }`}>
                  <link.icon className="w-4.5 h-4.5 shrink-0" />
                </div>
                <span>{link.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User info & Logout */}
      <div className="border-t border-pink-100/60 px-3 py-4">
        <div className="flex items-center gap-3 px-3 mb-3">
          <div className="w-9 h-9 bg-gradient-to-br from-primary-400 to-primary-500 rounded-full flex items-center justify-center shadow-sm shadow-primary-200/30">
            <span className="text-sm font-bold text-white">
              {profile?.full_name?.charAt(0)?.toUpperCase() || 'U'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-gray-900 truncate">
              {profile?.full_name || 'User'}
            </p>
            <p className="text-xs font-medium text-primary-400 capitalize">
              {profile?.role === 'owner' ? '✨ Pemilik' : 'Kasir'}
            </p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:bg-red-50 hover:text-red-500 w-full transition-all duration-200 active:scale-[0.97]"
        >
          <LogOut className="w-4 h-4" />
          Keluar
        </button>
      </div>
    </aside>
  )
}
