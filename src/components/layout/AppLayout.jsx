import { Outlet } from 'react-router-dom'
import { useLayout } from '@/contexts/LayoutContext'
import Sidebar from './Sidebar'
import BottomNav from './BottomNav'

export default function AppLayout() {
  const { sidebarOpen, closeSidebar } = useLayout()

  return (
    // Wrapper utama: flex COLUMN agar BottomNav bisa sticky di bawah
    <div className="min-h-[100dvh] bg-linen flex flex-col">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          data-testid="sidebar-backdrop"
          className="fixed inset-0 bg-zinc-950/40 z-50 lg:hidden backdrop-blur-[2px] animate-fade-in"
          onClick={closeSidebar}
        />
      )}

      {/* Sidebar (fixed, tidak mempengaruhi flow) */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-[272px] lg:w-[248px] transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]
          lg:translate-x-0 ${sidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}`}
      >
        <Sidebar />
      </div>

      {/* Main content area — flex-1 mengisi sisa ruang di atas BottomNav */}
      <main
        className="flex-1 lg:pl-[248px] flex flex-col w-full min-w-0"
        style={{ paddingBottom: 'var(--bnav)' }}
      >
        <Outlet />
      </main>

      {/* BottomNav — fixed di viewport bottom, konten di-pad via --bnav di main */}
      <BottomNav />
    </div>
  )
}
