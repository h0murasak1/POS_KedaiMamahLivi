import { Outlet } from 'react-router-dom'
import { useLayout } from '@/contexts/LayoutContext'
import Sidebar from './Sidebar'

export default function AppLayout() {
  const { sidebarOpen, closeSidebar } = useLayout()

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50/60 via-white to-pink-50/40 flex">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-primary-900/30 z-40 lg:hidden backdrop-blur-sm transition-opacity duration-300"
          onClick={closeSidebar}
        />
      )}

      {/* Sidebar */}
      <div
        className={`
          fixed inset-y-0 left-0 z-40 w-64 transition-transform duration-300 ease-in-out
          lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <Sidebar />
      </div>

      {/* Main content area */}
      <div className="flex-1 lg:pl-64 flex flex-col min-h-screen w-full overflow-x-hidden">
        <Outlet />
      </div>
    </div>
  )
}
