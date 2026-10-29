import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { db, getLastSyncTime, setLastSyncTime, getDeviceId } from '@/lib/db'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

const SyncContext = createContext({})

export const useSync = () => useContext(SyncContext)

export function SyncProvider({ children }) {
  const { user } = useAuth()
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [isSyncing, setIsSyncing] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)
  const [failedCount, setFailedCount] = useState(0)
  const [lastSyncTime, setLastSyncTimeState] = useState(null)

  // Monitor online status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Update pending/failed counts
  const updateCounts = useCallback(async () => {
    try {
      const pending = await db.sync_queue
        .where('status')
        .anyOf(['pending', 'syncing'])
        .count()
      const failed = await db.sync_queue
        .where('status')
        .equals('failed')
        .count()
      setPendingCount(pending)
      setFailedCount(failed)

      const syncTime = await getLastSyncTime()
      setLastSyncTimeState(syncTime)
    } catch (err) {
      console.error('Error updating sync counts:', err)
    }
  }, [])

  useEffect(() => {
    updateCounts()
    const interval = setInterval(updateCounts, 10000) // Check every 10s
    return () => clearInterval(interval)
  }, [updateCounts])

  // Auto-sync when coming back online
  useEffect(() => {
    if (isOnline && user && pendingCount > 0) {
      syncNow()
    }
  }, [isOnline, user])

  // Sync all pending transactions
  const syncNow = useCallback(async () => {
    if (isSyncing || !isOnline || !user) return

    setIsSyncing(true)
    try {
      const pendingItems = await db.sync_queue
        .where('status')
        .anyOf(['pending', 'failed'])
        .toArray()

      for (const item of pendingItems) {
        try {
          // Update status to syncing
          await db.sync_queue.update(item.id, { 
            status: 'syncing', 
            last_attempt: new Date().toISOString() 
          })

          // Get the local order
          const order = await db.local_orders.get(item.order_id)
          if (!order) continue

          const orderItems = await db.local_order_items
            .where('order_id')
            .equals(item.order_id)
            .toArray()

          // Send to Supabase
          const { data, error } = await supabase.rpc('sync_transaction', {
            p_order: order,
            p_items: orderItems,
          })

          if (error) throw error

          // Mark as synced
          await db.sync_queue.update(item.id, { status: 'synced' })
          await db.local_orders.update(item.order_id, { sync_status: 'synced' })

        } catch (err) {
          console.error(`Sync failed for order ${item.order_id}:`, err)
          await db.sync_queue.update(item.id, { 
            status: 'failed',
            error_message: err.message,
            last_attempt: new Date().toISOString(),
            retry_count: (item.retry_count || 0) + 1,
          })
          await db.local_orders.update(item.order_id, { sync_status: 'failed' })
        }
      }

      await setLastSyncTime(new Date().toISOString())
      await updateCounts()
    } catch (err) {
      console.error('Sync error:', err)
    } finally {
      setIsSyncing(false)
    }
  }, [isSyncing, isOnline, user, updateCounts])

  const value = {
    isOnline,
    isSyncing,
    pendingCount,
    failedCount,
    lastSyncTime,
    syncNow,
    updateCounts,
  }

  return (
    <SyncContext.Provider value={value}>
      {children}
    </SyncContext.Provider>
  )
}
