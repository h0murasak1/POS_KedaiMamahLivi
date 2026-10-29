import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import { SyncProvider } from '@/contexts/SyncContext'
import { LayoutProvider } from '@/contexts/LayoutContext'
import AppLayout from '@/components/layout/AppLayout'
import SyncStatusBar from '@/components/sync/SyncStatusBar'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

// Pages
import LoginPage from '@/pages/auth/LoginPage'
import OwnerDashboard from '@/pages/owner/OwnerDashboard'
import CashierDashboard from '@/pages/cashier/CashierDashboard'
import POSPage from '@/pages/pos/POSPage'
import MenuManagement from '@/pages/menu/MenuManagement'
import CashierManagement from '@/pages/kasir-mgmt/CashierManagement'
import TransactionHistory from '@/pages/transactions/TransactionHistory'
import ReportsPage from '@/pages/reports/ReportsPage'
import SettingsPage from '@/pages/settings/SettingsPage'
import AuditLogPage from '@/pages/audit/AuditLogPage'

// Protected Route component
function ProtectedRoute({ children, ownerOnly = false }) {
  const { user, profile, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-linen">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />
  if (ownerOnly && profile?.role !== 'owner') return <Navigate to="/dashboard" replace />

  return children
}

// Dashboard Router — shows correct dashboard by role
function DashboardRouter() {
  const { isOwner } = useAuth()
  return isOwner ? <OwnerDashboard /> : <CashierDashboard />
}

function AppRoutes() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-linen" data-testid="app-loading">
        <div className="text-center animate-fade-in-up">
          <LoadingSpinner size="lg" />
          <p className="mt-4 font-heading font-semibold text-zinc-700">Menyiapkan kedai…</p>
          <p className="text-xs text-zinc-400 mt-1">Kedai Mamah Livi POS</p>
        </div>
      </div>
    )
  }

  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <LoginPage />} />

      {/* Protected with layout */}
      <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        <Route path="/dashboard" element={<DashboardRouter />} />
        <Route path="/pos" element={<POSPage />} />
        <Route path="/transaksi" element={<TransactionHistory />} />

        {/* Owner only */}
        <Route path="/menu" element={<ProtectedRoute ownerOnly><MenuManagement /></ProtectedRoute>} />
        <Route path="/kasir" element={<ProtectedRoute ownerOnly><CashierManagement /></ProtectedRoute>} />
        <Route path="/laporan" element={<ProtectedRoute ownerOnly><ReportsPage /></ProtectedRoute>} />
        <Route path="/pengaturan" element={<ProtectedRoute ownerOnly><SettingsPage /></ProtectedRoute>} />
        <Route path="/audit" element={<ProtectedRoute ownerOnly><AuditLogPage /></ProtectedRoute>} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SyncProvider>
          <LayoutProvider>
            <AppRoutes />
            <SyncStatusBar />
            <Toaster
              position="top-center"
              containerStyle={{ top: 76 }}
              toastOptions={{
                duration: 3000,
                style: {
                  borderRadius: '16px',
                  background: '#18181b',
                  color: '#fafafa',
                  fontFamily: 'var(--font-sans)',
                  fontSize: '14px',
                  fontWeight: 600,
                  padding: '10px 14px',
                  boxShadow: '0 16px 40px -12px rgba(24,24,27,0.5)',
                },
                success: { iconTheme: { primary: '#10b981', secondary: '#fff' } },
                error: { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
              }}
            />
          </LayoutProvider>
        </SyncProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
