import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { db } from '@/lib/db'
import Header from '@/components/layout/Header'
import Card, { CardHeader, CardTitle } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import toast from 'react-hot-toast'
import { Save, Store, Shield, KeyRound, Eye, EyeOff } from 'lucide-react'

export default function SettingsPage() {
  const [settings, setSettings] = useState({
    store_name: 'Kedai Mamah Livi',
    store_address: '',
    store_phone: '',
    receipt_footer: 'Terima kasih telah berbelanja!',
    currency: 'IDR',
    owner_pin: '1234',
  })
  const [showPin, setShowPin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => { fetchSettings() }, [])

  const fetchSettings = async () => {
    try {
      const { data } = await supabase.from('store_settings').select('*')
      if (data && data.length > 0) {
        const s = {}
        data.forEach(row => { s[row.key] = row.value })
        setSettings(prev => ({ ...prev, ...s }))

        // Cache ke local IndexedDB
        if (db) {
          for (const row of data) {
            await db.cached_settings.put({ key: row.key, value: row.value })
          }
        }
      } else if (db) {
        // Fallback local
        const localSettings = await db.cached_settings.toArray()
        if (localSettings.length > 0) {
          const s = {}
          localSettings.forEach(row => { s[row.key] = row.value })
          setSettings(prev => ({ ...prev, ...s }))
        }
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const saveSettings = async () => {
    if (!settings.owner_pin || settings.owner_pin.length < 4) {
      toast.error('PIN Owner minimal 4 digit angka')
      return
    }

    setSaving(true)
    try {
      const entries = Object.entries(settings).map(([key, value]) => ({ key, value: String(value) }))
      for (const entry of entries) {
        await supabase.from('store_settings').upsert(entry, { onConflict: 'key' })
        if (db) {
          await db.cached_settings.put(entry)
        }
      }
      toast.success('Pengaturan berhasil disimpan')
    } catch (e) {
      toast.error('Gagal menyimpan pengaturan')
    } finally {
      setSaving(false)
    }
  }

  const update = (key, value) => setSettings(prev => ({ ...prev, [key]: value }))

  return (
    <div>
      <Header title="Pengaturan Kedai" />
      <div className="p-4 sm:p-6 max-w-3xl space-y-6">
        {/* Informasi Kedai */}
        <Card className="p-5 sm:p-6 hover:border-pink-300 card-glow transition-all">
          <CardHeader className="mb-4">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 bg-pink-100/70 text-primary-600 rounded-2xl flex items-center justify-center shrink-0 shadow-2xs">
                <Store className="w-5 h-5" />
              </div>
              <div>
                <CardTitle>Informasi Kedai</CardTitle>
                <p className="text-xs text-gray-500 mt-0.5">Nama dan kontak yang tampil pada struk belanja pelanggan</p>
              </div>
            </div>
          </CardHeader>

          <div className="space-y-4">
            <Input label="Nama Kedai" value={settings.store_name}
              onChange={e => update('store_name', e.target.value)} placeholder="Nama kedai Anda" />
            <Input label="Alamat Kedai" value={settings.store_address}
              onChange={e => update('store_address', e.target.value)} placeholder="Alamat lengkap kedai" />
            <Input label="No. Telepon / WhatsApp" value={settings.store_phone}
              onChange={e => update('store_phone', e.target.value)} placeholder="08xx-xxxx-xxxx" />
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1.5">Catatan Bawah Struk</label>
              <textarea value={settings.receipt_footer}
                onChange={e => update('receipt_footer', e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white border border-pink-200/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-400 text-sm text-gray-800 shadow-2xs transition-all"
                rows={3} placeholder="Pesan di bagian bawah struk" />
            </div>
          </div>
        </Card>

        {/* Keamanan & Otorisasi PIN Owner */}
        <Card className="p-5 sm:p-6 hover:border-pink-300 card-glow transition-all">
          <CardHeader className="mb-4">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center shrink-0 shadow-2xs border border-amber-200/50">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <CardTitle>Keamanan & Otorisasi Pembatalan</CardTitle>
                <p className="text-xs text-gray-500 mt-0.5">
                  PIN otorisasi yang harus dimasukkan kasir saat membatalkan transaksi di tempat
                </p>
              </div>
            </div>
          </CardHeader>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1.5">
                PIN Otorisasi Owner (4 - 6 Digit)
              </label>
              <div className="relative max-w-xs">
                <input
                  type={showPin ? 'text' : 'password'}
                  maxLength={6}
                  value={settings.owner_pin}
                  onChange={(e) => update('owner_pin', e.target.value.replace(/\D/g, ''))}
                  placeholder="Misal: 1234"
                  className="w-full pl-10 pr-10 py-2.5 border border-pink-200/80 rounded-xl tracking-widest text-lg font-mono focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-400 bg-white shadow-2xs"
                />
                <KeyRound className="w-4 h-4 text-primary-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-primary-600"
                >
                  {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-2 leading-relaxed">
                Default: <strong className="text-primary-600 font-bold">1234</strong>. Jangan berikan PIN ini sembarangan kepada kasir. Kasir hanya dapat membatalkan transaksi jika Owner memasukkan PIN ini atau Owner menyetujuinya dari jarak jauh.
              </p>
            </div>
          </div>
        </Card>

        <div className="flex justify-end pt-2">
          <Button onClick={saveSettings} loading={saving} icon={Save} size="lg">
            Simpan Seluruh Pengaturan
          </Button>
        </div>
      </div>
    </div>
  )
}
