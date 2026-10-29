import { Outlet } from 'react-router-dom'
import { useLayout } from '@/contexts/LayoutContext'
import Sidebar from './Sidebar'
import BottomNav from './BottomNav'

export default function AppLayout() {
  const { sidebarOpen, closeSidebar } = useLayout()

  return (
    // App shell container: pas 100dvh dan overflow-hidden agar window tidak pernah scroll liar di mobile Chrome/Safari
    <div className="h-full h-[100dvh] bg-linen flex flex-col overflow-hidden">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          data-testid="sidebar-backdrop"
          className="fixed inset-0 bg-zinc-950/40 z-50 lg:hidden backdrop-blur-[2px] animate-fade-in"
          onClick={closeSidebar}
        />
      )}

      {/* Sidebar (drawer di mobile, fixed di desktop) */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-[272px] lg:w-[248px] transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]
          lg:translate-x-0 ${sidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}`}
      >
        <Sidebar />
      </div>

      {/* Main content area — flex-1 min-h-0 mengisi penuh area tengah & scroll secara internal */}
      <main className="flex-1 min-h-0 w-full overflow-y-auto lg:pl-[248px] flex flex-col">
        <Outlet />
      </main>

      {/* BottomNav — berada di bawah flex column secara natural, 100% selalu terlihat di mobile tanpa perlu scroll */}
      <BottomNav />
    </div>
  )
}
