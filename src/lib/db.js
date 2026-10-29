import Dexie from 'dexie'

export const db = new Dexie('KedaiMamahLiviPOS')

db.version(1).stores({
  // Cache produk & kategori dari server
  cached_categories: 'id, name, sort_order',
  cached_products: 'id, category_id, name, price, is_available',
  cached_variants: 'id, product_id, name, price_addition',

  // Pengaturan lokal
  cached_settings: 'key',

  // Transaksi lokal
  local_orders: 'id, cashier_id, device_id, created_at_local, sync_status, order_status',
  local_order_items: 'id, order_id, product_id',

  // Antrean sinkronisasi
  sync_queue: 'id, order_id, status, created_at, last_attempt',

  // Metadata sinkronisasi
  sync_metadata: 'key'
})

// Helper to get device ID
export async function getDeviceId() {
  let meta = await db.sync_metadata.get('device_id')
  if (!meta) {
    const deviceId = crypto.randomUUID()
    await db.sync_metadata.put({ key: 'device_id', value: deviceId })
    return deviceId
  }
  return meta.value
}

// Helper to get last sync time
export async function getLastSyncTime() {
  const meta = await db.sync_metadata.get('last_sync_time')
  return meta?.value || null
}

// Helper to set last sync time
export async function setLastSyncTime(time) {
  await db.sync_metadata.put({ key: 'last_sync_time', value: time })
}
