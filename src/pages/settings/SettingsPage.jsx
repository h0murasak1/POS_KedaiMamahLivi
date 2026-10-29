import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { db } from '@/lib/db'
import { useAuth } from '@/contexts/AuthContext'
import Header from '@/components/layout/Header'
import Card, { CardHeader, CardTitle } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input, { fieldClass, FieldLabel } from '@/components/ui/Input'
import ReceiptView from '@/components/pos/ReceiptView'
import { useSoundEnabled, setSoundEnabled, playSuccess } from '@/lib/sound'
import toast from 'react-hot-toast'
import { Save, Store, Shield, KeyRound, Eye, EyeOff, Smartphone, Volume2, VolumeX, Lock, ShieldCheck } from 'lucide-react'

export default function SettingsPage() {
  const { user, profile } = useAuth()
  const [activeTab, setActiveTab] = useState('all') // 'all' | 'security' | 'store' | 'device'
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
  const soundOn = useSoundEnabled()

  // State untuk ganti password pemilik
  const [ownerPassword, setOwnerPassword] = useState('')
  const [ownerConfirm, setOwnerConfirm] = useState('')
  const [showOwnerPassword, setShowOwnerPassword] = useState(false)
  const [changingPassword, setChangingPassword] = useState(false)

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

  const handleChangeOwnerPassword = async (e) => {
    e.preventDefault()
    if (!ownerPassword || ownerPassword.length < 6) {
      toast.error('Password baru minimal 6 karakter')
      return
    }
    if (ownerPassword !== ownerConfirm) {
      toast.error('Konfirmasi password tidak cocok')
      return
    }

    setChangingPassword(true)
    try {
      const { error } = await supabase.auth.updateUser({
        password: ownerPassword,
      })
      if (error) throw error

      toast.success('Password akun pemilik berhasil diperbarui!')
      setOwnerPassword('')
      setOwnerConfirm('')

      // Catat ke audit log
      try {
        await supabase.from('audit_logs').insert({
          user_id: user?.id,
          user_name: profile?.full_name || 'Pemilik',
          action: 'change_owner_password',
          details: 'Pemilik memperbarui password akun login',
        })
      } catch (_) {}
    } catch (err) {
      toast.error(err.message || 'Gagal mengubah password pemilik')
    } finally {
      setChangingPassword(false)
    }
  }

  const update = (key, value) => setSettings(prev => ({ ...prev, [key]: value }))

  const sampleOrder = {
    order_number: 'LCL-CONTOH-001',
    created_at_local: new Date().toISOString(),
    cashier_name: 'Kasir',
    subtotal: 33000,
    discount_amount: 0,
    total_amount: 33000,
    payment_method: 'cash',
    cash_received: 50000,
    change_amount: 17000,
  }
  const sampleItems = [
    { id: 's1', product_name: 'Nasi Goreng Spesial', quantity: 1, unit_price: 25000, variant_price_addition: 0, subtotal: 25000 },
    { id: 's2', product_name: 'Es Teh Manis', variant_name: 'Jumbo', quantity: 2, unit_price: 3000, variant_price_addition: 1000, subtotal: 8000 },
  ]

  const showSecurity = activeTab === 'all' || activeTab === 'security'
  const showStore = activeTab === 'all' || activeTab === 'store'
  const showDevice = activeTab === 'all' || activeTab === 'device'

  return (
    <div>
      <Header title="Pengaturan" subtitle="Informasi kedai, struk & keamanan" />
      <div className="p-4 sm:p-6 lg:p-8 max-w-[1200px] w-full space-y-4">
        {/* Navigation filter tabs */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
          {[
            { id: 'all', label: 'Semua Pengaturan' },
            { id: 'security', label: 'Keamanan & Password' },
            { id: 'store', label: 'Informasi Kedai' },
            { id: 'device', label: 'Preferensi Perangkat' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'bg-zinc-900 text-white shadow-sm'
                  : 'bg-white text-zinc-600 border border-zinc-200/80 hover:bg-zinc-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="grid lg:grid-cols-[1fr_340px] gap-6 items-start pt-1">
          <div className="space-y-5">
            {/* Owner Account Password */}
            {showSecurity && (
              <Card hover={false} data-testid="settings-owner-password-card">
                <CardHeader>
                  <div className="flex items-center gap-3.5">
                    <div className="w-11 h-11 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl flex items-center justify-center shrink-0">
                      <Lock className="w-5 h-5" />
                    </div>
                    <div>
                      <CardTitle>Password Akun Pemilik</CardTitle>
                      <p className="text-xs text-zinc-500 mt-0.5">Ubah password akun login Pemilik ({profile?.email || user?.email || 'Owner'})</p>
                    </div>
                  </div>
                </CardHeader>
                <form onSubmit={handleChangeOwnerPassword} className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <FieldLabel hint="min. 6 karakter">Password Baru</FieldLabel>
                      <div className="relative">
                        <Lock className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type={showOwnerPassword ? 'text' : 'password'}
                          value={ownerPassword}
                          onChange={(e) => setOwnerPassword(e.target.value)}
                          placeholder="Password baru"
                          className={`${fieldClass} pl-10 pr-11`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowOwnerPassword(!showOwnerPassword)}
                          className="absolute right-1.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-lg flex items-center justify-center text-zinc-400 hover:text-zinc-800 hover:bg-zinc-100"
                        >
                          {showOwnerPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <FieldLabel>Konfirmasi Password Baru</FieldLabel>
                      <div className="relative">
                        <Lock className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type={showOwnerPassword ? 'text' : 'password'}
                          value={ownerConfirm}
                          onChange={(e) => setOwnerConfirm(e.target.value)}
                          placeholder="Ulangi password baru"
                          className={`${fieldClass} pl-10`}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-end pt-1">
                    <Button
                      type="submit"
                      variant="dark"
                      loading={changingPassword}
                      icon={KeyRound}
                      data-testid="settings-change-password-button"
                    >
                      Ubah Password Pemilik
                    </Button>
                  </div>
                </form>
              </Card>
            )}

            {/* Security — PIN Pembatalan */}
            {showSecurity && (
              <Card hover={false} data-testid="settings-security-card">
                <CardHeader>
                  <div className="flex items-center gap-3.5">
                    <div className="w-11 h-11 bg-amber-50 border border-amber-200 text-amber-700 rounded-2xl flex items-center justify-center shrink-0"><Shield className="w-5 h-5" /></div>
                    <div>
                      <CardTitle>PIN Otorisasi Pembatalan & Reset</CardTitle>
                      <p className="text-xs text-zinc-500 mt-0.5">Digunakan untuk otorisasi pembatalan dan reset password via PIN</p>
                    </div>
                  </div>
                </CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="relative sm:w-64">
                    <KeyRound className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type={showPin ? 'text' : 'password'}
                      inputMode="numeric"
                      maxLength={6}
                      value={settings.owner_pin}
                      onChange={(e) => update('owner_pin', e.target.value.replace(/\D/g, ''))}
                      placeholder="4–6 digit"
                      data-testid="settings-owner-pin-input"
                      className={`${fieldClass} pl-10 pr-11 font-mono tracking-[0.4em] text-lg`}
                    />
                    <button type="button" onClick={() => setShowPin(!showPin)} data-testid="settings-toggle-pin-button" className="absolute right-1.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-lg flex items-center justify-center text-zinc-400 hover:text-zinc-800 hover:bg-zinc-100">
                      {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <div className="flex gap-1.5" aria-hidden>
                    {Array.from({ length: 6 }).map((_, i) => (
                      <span key={i} className={`w-2.5 h-2.5 rounded-full transition-colors ${i < (settings.owner_pin?.length || 0) ? 'bg-primary-600' : 'bg-zinc-200'}`} />
                    ))}
                  </div>
                </div>
                <p className="text-xs text-zinc-500 mt-3 leading-relaxed">
                  Default <b className="text-zinc-800">1234</b> — jangan bagikan ke kasir. PIN ini dapat digunakan untuk reset password darurat saat lupa password di halaman login.
                </p>
              </Card>
            )}

            {/* Store info */}
            {showStore && (
              <Card hover={false} data-testid="settings-store-card">
                <CardHeader>
                  <div className="flex items-center gap-3.5">
                    <div className="w-11 h-11 bg-primary-50 border border-primary-200/70 text-primary-700 rounded-2xl flex items-center justify-center shrink-0"><Store className="w-5 h-5" /></div>
                    <div>
                      <CardTitle>Informasi Kedai</CardTitle>
                      <p className="text-xs text-zinc-500 mt-0.5">Tampil di bagian atas struk pelanggan</p>
                    </div>
                  </div>
                </CardHeader>
                {loading ? (
                  <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="h-11 animate-shimmer rounded-xl" />)}</div>
                ) : (
                  <div className="space-y-4">
                    <Input label="Nama Kedai" value={settings.store_name} onChange={e => update('store_name', e.target.value)} placeholder="Nama kedai Anda" data-testid="settings-store-name-input" />
                    <div className="grid sm:grid-cols-2 gap-4">
                      <Input label="Alamat" value={settings.store_address} onChange={e => update('store_address', e.target.value)} placeholder="Alamat kedai" data-testid="settings-store-address-input" />
                      <Input label="Telepon / WhatsApp" value={settings.store_phone} onChange={e => update('store_phone', e.target.value)} placeholder="08xx-xxxx-xxxx" data-testid="settings-store-phone-input" />
                    </div>
                    <div>
                      <FieldLabel>Catatan Bawah Struk</FieldLabel>
                      <textarea value={settings.receipt_footer} onChange={e => update('receipt_footer', e.target.value)} rows={2} placeholder="Pesan di bagian bawah struk" data-testid="settings-receipt-footer-input" className={`${fieldClass} resize-none`} />
                    </div>
                  </div>
                )}
              </Card>
            )}

            {/* Device preferences */}
            {showDevice && (
              <Card hover={false} data-testid="settings-device-card">
                <CardHeader>
                  <div className="flex items-center gap-3.5">
                    <div className="w-11 h-11 bg-sky-50 border border-sky-200 text-sky-700 rounded-2xl flex items-center justify-center shrink-0"><Smartphone className="w-5 h-5" /></div>
                    <div>
                      <CardTitle>Preferensi Perangkat Ini</CardTitle>
                      <p className="text-xs text-zinc-500 mt-0.5">Tersimpan di perangkat, tidak memengaruhi kasir lain</p>
                    </div>
                  </div>
                </CardHeader>
                <div className="flex items-center justify-between p-3.5 rounded-2xl bg-zinc-50 border border-zinc-200">
                  <div className="flex items-center gap-3">
                    {soundOn ? <Volume2 className="w-5 h-5 text-primary-600" /> : <VolumeX className="w-5 h-5 text-zinc-400" />}
                    <div>
                      <p className="text-sm font-semibold text-zinc-900">Suara kasir</p>
                      <p className="text-xs text-zinc-500">Bunyi “beep” saat tambah menu & nada sukses saat bayar</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={soundOn}
                    onClick={() => { setSoundEnabled(!soundOn); if (!soundOn) setTimeout(playSuccess, 30) }}
                    data-testid="settings-sound-switch"
                    className={`relative w-11 h-6 rounded-full transition-colors duration-200 shrink-0 ${soundOn ? 'bg-emerald-500' : 'bg-zinc-300'}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${soundOn ? 'translate-x-5' : ''}`} />
                  </button>
                </div>
              </Card>
            )}

            <div className="sticky bottom-[calc(var(--bnav)+12px)] lg:bottom-4 z-20 flex justify-end">
              <Button onClick={saveSettings} loading={saving} icon={Save} size="lg" data-testid="settings-save-button" className="w-full sm:w-auto">
                Simpan Pengaturan
              </Button>
            </div>
          </div>

          {/* Live receipt preview */}
          <div className="lg:sticky lg:top-24 space-y-3" data-testid="settings-receipt-preview">
            <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-zinc-500 flex items-center gap-1.5"><Eye className="w-3.5 h-3.5" /> Pratinjau Struk</p>
            <div className="p-4 rounded-3xl bg-zinc-100 border border-zinc-200">
              <ReceiptView order={sampleOrder} items={sampleItems} settings={settings} showSync={false} />
            </div>
            <p className="text-xs text-zinc-500">Berubah langsung saat Anda mengetik.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
