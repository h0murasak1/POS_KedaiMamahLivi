import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Header from '@/components/layout/Header'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Modal from '@/components/ui/Modal'
import Badge from '@/components/ui/Badge'
import EmptyState from '@/components/ui/EmptyState'
import toast from 'react-hot-toast'
import { Plus, Users, UserCheck, UserX, Pencil, Mail } from 'lucide-react'

export default function CashierManagement() {
  const [cashiers, setCashiers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editMode, setEditMode] = useState(null)
  const [form, setForm] = useState({ email: '', password: '', full_name: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => { fetchCashiers() }, [])

  const fetchCashiers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'cashier')
        .order('created_at', { ascending: false })
      if (error) throw error
      setCashiers(data || [])
    } catch (e) {
      toast.error('Gagal memuat daftar kasir')
    } finally {
      setLoading(false)
    }
  }

  const openCreateModal = () => {
    setEditMode(null)
    setForm({ email: '', password: '', full_name: '' })
    setShowModal(true)
  }

  const openEditModal = (cashier) => {
    setEditMode(cashier)
    setForm({ email: cashier.email || '', password: '', full_name: cashier.full_name || '' })
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.full_name.trim()) { toast.error('Nama kasir wajib diisi'); return }

    setSaving(true)
    try {
      if (editMode) {
        // Update profile
        const { error } = await supabase
          .from('profiles')
          .update({ full_name: form.full_name })
          .eq('id', editMode.id)
        if (error) throw error
        toast.success('Data kasir diperbarui')
      } else {
        // Create new cashier via trusted RPC database function
        if (!form.email || !form.password) {
          toast.error('Email dan password wajib diisi')
          setSaving(false)
          return
        }
        if (form.password.length < 6) {
          toast.error('Password minimal 6 karakter')
          setSaving(false)
          return
        }

        const cleanEmail = form.email.trim().toLowerCase()
        const { data, error } = await supabase.rpc('create_cashier_account', {
          p_email: cleanEmail,
          p_password: form.password,
          p_full_name: form.full_name.trim(),
        })

        if (error) {
          // If RPC is missing, try edge function fallback
          if (error.message?.includes('function') || error.code === '42883') {
            const edgeRes = await supabase.functions.invoke('create-cashier', {
              body: {
                email: form.email,
                password: form.password,
                full_name: form.full_name,
              },
            })
            if (edgeRes.error) throw new Error(edgeRes.error.message || error.message)
          } else {
            throw error
          }
        }
        toast.success('Akun kasir berhasil dibuat')
      }
      setShowModal(false)
      fetchCashiers()
    } catch (e) {
      toast.error(e.message || 'Gagal menyimpan data kasir')
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (cashier) => {
    const newStatus = !cashier.is_active
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: newStatus })
        .eq('id', cashier.id)
      if (error) throw error
      toast.success(newStatus ? 'Akun kasir diaktifkan' : 'Akun kasir dinonaktifkan')
      fetchCashiers()
    } catch (e) {
      toast.error(e.message)
    }
  }

  const activeCount = cashiers.filter((c) => c.is_active).length
  const palette = ['from-primary-500 to-red-600', 'from-secondary-400 to-primary-600', 'from-emerald-500 to-teal-600', 'from-sky-500 to-indigo-600', 'from-zinc-700 to-zinc-900']

  return (
    <div>
      <Header title="Staf Kasir" subtitle={`${activeCount} aktif dari ${cashiers.length} akun`} />
      <div className="p-4 sm:p-6 lg:p-8 space-y-5 max-w-[1200px] w-full">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-heading text-lg font-bold text-zinc-900">Daftar Akun Kasir</h3>
            <p className="text-sm text-zinc-500">Kelola staf yang melayani transaksi di kedai</p>
          </div>
          <Button onClick={openCreateModal} icon={Plus} data-testid="cashier-add-button">Tambah Kasir</Button>
        </div>

        {loading ? (
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">{[0, 1, 2].map((i) => <div key={i} className="h-40 animate-shimmer rounded-2xl" />)}</div>
        ) : cashiers.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Belum ada kasir"
            description="Tambahkan akun kasir agar staf bisa login dan melayani transaksi."
            action={<Button onClick={openCreateModal} icon={Plus} data-testid="cashier-empty-add-button">Tambah Kasir Baru</Button>}
          />
        ) : (
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4 stagger" data-testid="cashier-list">
            {cashiers.map((cashier, idx) => (
              <Card key={cashier.id} className={`p-5 flex flex-col ${cashier.is_active ? '' : 'bg-zinc-50/80'}`} data-testid={`cashier-card-${cashier.id}`}>
                <div className="flex items-start gap-3.5">
                  <div className="relative shrink-0">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-heading text-xl font-bold text-white bg-gradient-to-br ${cashier.is_active ? palette[idx % palette.length] : 'from-zinc-300 to-zinc-400'}`}>
                      {cashier.full_name?.charAt(0)?.toUpperCase() || 'K'}
                    </div>
                    <span className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-[3px] border-white ${cashier.is_active ? 'bg-emerald-500' : 'bg-zinc-400'}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-zinc-900 truncate">{cashier.full_name || 'Kasir'}</p>
                    <p className="text-xs text-zinc-500 mt-0.5 flex items-center gap-1.5 truncate">
                      <Mail className="w-3.5 h-3.5 shrink-0" /> <span className="truncate">{cashier.email || '-'}</span>
                    </p>
                    <Badge variant={cashier.is_active ? 'success' : 'default'} dot className="mt-2">{cashier.is_active ? 'Aktif' : 'Nonaktif'}</Badge>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-5 pt-4 border-t border-zinc-100">
                  <Button variant="secondary" size="sm" onClick={() => openEditModal(cashier)} icon={Pencil} data-testid={`cashier-edit-${cashier.id}`}>Edit</Button>
                  <Button
                    variant={cashier.is_active ? 'danger-soft' : 'soft'}
                    size="sm"
                    onClick={() => toggleActive(cashier)}
                    icon={cashier.is_active ? UserX : UserCheck}
                    data-testid={`cashier-toggle-${cashier.id}`}
                  >
                    {cashier.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}

        <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editMode ? 'Edit Data Kasir' : 'Kasir Baru'} subtitle={editMode ? editMode.email : 'Buat akun login untuk staf'} icon={Users} size="sm" testId="cashier-modal"
          footer={<Button className="w-full" size="lg" onClick={handleSave} loading={saving} data-testid="cashier-save-button">{editMode ? 'Simpan Perubahan' : 'Buat Akun Kasir'}</Button>}
        >
          <div className="space-y-4">
            <Input label="Nama Lengkap" value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} placeholder="Nama kasir" data-testid="cashier-name-input" autoFocus />
            {!editMode && (
              <>
                <Input label="Email Login" type="email" icon={Mail} value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="kasir@email.com" data-testid="cashier-email-input" />
                <Input label="Password" hint="min. 6 karakter" type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="••••••" data-testid="cashier-password-input" />
              </>
            )}
          </div>
        </Modal>
      </div>
    </div>
  )
}
