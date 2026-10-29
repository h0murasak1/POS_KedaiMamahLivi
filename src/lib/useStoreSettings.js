import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { db } from '@/lib/db'

const DEFAULTS = {
  store_name: 'Kedai Mamah Livi',
  store_address: '',
  store_phone: '',
  receipt_footer: 'Terima kasih telah berbelanja!',
  currency: 'IDR',
  owner_pin: '1234',
}

/**
 * Hook to fetch store settings from Supabase (with IndexedDB fallback).
 * Returns an object like { store_name, store_address, store_phone, receipt_footer, ... }
 */
export function useStoreSettings() {
  const [settings, setSettings] = useState(DEFAULTS)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        const { data } = await supabase.from('store_settings').select('*')
        if (!cancelled && data && data.length > 0) {
          const s = {}
          data.forEach((row) => { s[row.key] = row.value })
          setSettings((prev) => ({ ...prev, ...s }))

          // Cache locally
          if (db) {
            for (const row of data) {
              await db.cached_settings.put({ key: row.key, value: row.value })
            }
          }
          return
        }
      } catch (e) {
        // Network error — fall through to local cache
      }

      // Fallback: read from IndexedDB cache
      if (db) {
        try {
          const local = await db.cached_settings.toArray()
          if (!cancelled && local.length > 0) {
            const s = {}
            local.forEach((row) => { s[row.key] = row.value })
            setSettings((prev) => ({ ...prev, ...s }))
          }
        } catch (_) { }
      }
    }

    load()
    return () => { cancelled = true }
  }, [])

  return settings
}
