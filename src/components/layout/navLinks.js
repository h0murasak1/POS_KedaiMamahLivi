import {
    LayoutDashboard,
    ShoppingCart,
    UtensilsCrossed,
    Users,
    Receipt,
    BarChart3,
    Settings,
    ClipboardList,
} from 'lucide-react'

export const ownerLinks = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Beranda', group: 'Operasional', id: 'dashboard' },
    { to: '/pos', icon: ShoppingCart, label: 'Kasir (POS)', group: 'Operasional', id: 'pos' },
    { to: '/transaksi', icon: Receipt, label: 'Riwayat Transaksi', short: 'Riwayat', group: 'Operasional', id: 'transaksi' },
    { to: '/menu', icon: UtensilsCrossed, label: 'Menu & Kategori', short: 'Menu', group: 'Kelola Kedai', id: 'menu' },
    { to: '/kasir', icon: Users, label: 'Staf Kasir', group: 'Kelola Kedai', id: 'kasir' },
    { to: '/laporan', icon: BarChart3, label: 'Laporan', group: 'Kelola Kedai', id: 'laporan' },
    { to: '/pengaturan', icon: Settings, label: 'Pengaturan', group: 'Sistem', id: 'pengaturan' },
    { to: '/audit', icon: ClipboardList, label: 'Audit Log', group: 'Sistem', id: 'audit' },
]

export const cashierLinks = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Beranda', group: 'Operasional', id: 'dashboard' },
    { to: '/pos', icon: ShoppingCart, label: 'Kasir (POS)', group: 'Operasional', id: 'pos' },
    { to: '/transaksi', icon: Receipt, label: 'Riwayat Transaksi', short: 'Riwayat', group: 'Operasional', id: 'transaksi' },
]
