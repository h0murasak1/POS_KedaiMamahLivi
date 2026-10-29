import { v4 as uuidv4 } from 'uuid'
import { format, formatDistanceToNow } from 'date-fns'
import { id as localeId } from 'date-fns/locale/id'

// Generate UUID
export const generateId = () => uuidv4()

// Format currency to Rupiah
export const formatRupiah = (amount) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

// Format date
export const formatDate = (date) => {
  return format(new Date(date), 'dd MMM yyyy', { locale: localeId })
}

// Format datetime
export const formatDateTime = (date) => {
  return format(new Date(date), 'dd MMM yyyy HH:mm', { locale: localeId })
}

// Format time
export const formatTime = (date) => {
  return format(new Date(date), 'HH:mm:ss')
}

// Format relative time
export const formatRelative = (date) => {
  return formatDistanceToNow(new Date(date), { addSuffix: true, locale: localeId })
}

// Generate local order number
export const generateOrderNumber = () => {
  const now = new Date()
  const dateStr = format(now, 'yyyyMMdd')
  const timeStr = format(now, 'HHmmss')
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
  return `LCL-${dateStr}-${timeStr}-${random}`
}

// Calculate cart totals
export const calculateCartTotals = (items) => {
  const subtotal = items.reduce((sum, item) => {
    const itemPrice = item.price + (item.variant_price_addition || 0)
    return sum + (itemPrice * item.quantity)
  }, 0)
  return { subtotal }
}

// Sync status labels
export const syncStatusLabels = {
  pending: { label: 'Menunggu', color: 'text-yellow-600', bg: 'bg-yellow-100' },
  syncing: { label: 'Mengirim', color: 'text-blue-600', bg: 'bg-blue-100' },
  synced: { label: 'Tersinkronisasi', color: 'text-green-600', bg: 'bg-green-100' },
  failed: { label: 'Gagal', color: 'text-red-600', bg: 'bg-red-100' },
}

// Order status labels
export const orderStatusLabels = {
  completed: { label: 'Selesai', color: 'text-green-600', bg: 'bg-green-100' },
  cancelled: { label: 'Dibatalkan', color: 'text-red-600', bg: 'bg-red-100' },
  refunded: { label: 'Dikembalikan', color: 'text-orange-600', bg: 'bg-orange-100' },
}

// Payment method labels
export const paymentMethodLabels = {
  cash: 'Tunai',
  qris: 'QRIS',
  transfer: 'Transfer',
  other: 'Lainnya',
}

// Clamp number
export const clamp = (num, min, max) => Math.min(Math.max(num, min), max)

// Friendly greeting by local time of day
export const getGreeting = (date = new Date()) => {
  const h = date.getHours()
  if (h < 11) return 'Selamat pagi'
  if (h < 15) return 'Selamat siang'
  if (h < 18) return 'Selamat sore'
  return 'Selamat malam'
}
