import { NavLink } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useLayout } from '@/contexts/LayoutContext'
import { LayoutDashboard, ShoppingCart, Receipt, BarChart3, Grid2x2 } from 'lucide-react'

/** Ergonomic thumb-zone navigation for phones & portrait tablets */
export default function BottomNav() {
    const { isOwner } = useAuth()
    const { toggleSidebar } = useLayout()

    const items = [
        { to: '/dashboard', icon: LayoutDashboard, label: 'Beranda', id: 'dashboard' },
        { to: '/transaksi', icon: Receipt, label: 'Riwayat', id: 'transaksi' },
        { to: '/pos', icon: ShoppingCart, label: 'Kasir', id: 'pos', center: true },
        ...(isOwner ? [{ to: '/laporan', icon: BarChart3, label: 'Laporan', id: 'laporan' }] : []),
    ]

    return (
        <nav
            data-testid="bottom-nav"
            className="lg:hidden fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur-md border-t border-zinc-200/80 shadow-[0_-4px_20px_rgba(0,0,0,0.04)]"
            style={{
                paddingBottom: 'env(safe-area-inset-bottom, 0px)',
                // z-index eksplisit — lebih tinggi dari sidebar backdrop (z-50) tidak perlu,
                // tapi harus di atas konten halaman (z-30 header). Gunakan inline agar pasti tidak
                // di-override class Tailwind yang mungkin conflict
                zIndex: 50,
                // GPU composite layer — mencegah bottom nav "berkedip" saat scroll di iOS/Android
                transform: 'translate3d(0, 0, 0)',
                WebkitTransform: 'translate3d(0, 0, 0)',
            }}
        >
            <div className="h-[68px] grid grid-flow-col auto-cols-fr items-center px-2">
                {items.map((item) =>
                    item.center ? (
                        <NavLink key={item.to} to={item.to} data-testid={`bottom-nav-${item.id}`} className="flex justify-center">
                            {({ isActive }) => (
                                <span className={`-mt-7 w-14 h-14 rounded-[20px] flex items-center justify-center text-white border-4 border-linen transition-transform duration-200 active:scale-90 ${isActive ? 'bg-zinc-900 shadow-[0_10px_24px_-8px_rgba(24,24,27,0.6)]' : 'bg-gradient-to-br from-primary-500 to-primary-600 shadow-[0_10px_24px_-8px_rgba(234,88,12,0.7)]'}`}>
                                    <item.icon className="w-6 h-6" />
                                </span>
                            )}
                        </NavLink>
                    ) : (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            data-testid={`bottom-nav-${item.id}`}
                            className={({ isActive }) =>
                                `flex flex-col items-center justify-center gap-1 h-full rounded-2xl text-[11px] transition-colors ${isActive ? 'text-primary-700 font-bold' : 'text-zinc-500 font-medium'}`
                            }
                        >
                            {({ isActive }) => (
                                <>
                                    <span className={`w-12 h-7 rounded-full flex items-center justify-center transition-[background-color,transform] duration-200 ${isActive ? 'bg-primary-100 scale-100' : 'scale-90'}`}>
                                        <item.icon className="w-5 h-5" />
                                    </span>
                                    {item.label}
                                </>
                            )}
                        </NavLink>
                    )
                )}
                <button
                    onClick={toggleSidebar}
                    data-testid="bottom-nav-more"
                    className="flex flex-col items-center justify-center gap-1 h-full text-[11px] font-medium text-zinc-500 active:text-primary-700"
                >
                    <span className="w-12 h-7 rounded-full flex items-center justify-center">
                        <Grid2x2 className="w-5 h-5" />
                    </span>
                    Lainnya
                </button>
            </div>
        </nav>
    )
}
