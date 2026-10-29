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

  return (
    <div>
      <Header title="Manajemen Kasir" />
      <div className="p-4 sm:p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-gray-900">Daftar Akun Kasir</h3>
            <p className="text-xs text-gray-500 mt-0.5">Kelola staf yang bertugas melayani transaksi</p>
          </div>
          <Button onClick={openCreateModal} icon={Plus}>
            Tambah Kasir
          </Button>
        </div>

        {loading ? (
          <div className="text-center py-16 text-gray-400 text-sm">Memuat data kasir...</div>
        ) : cashiers.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Belum ada kasir"
            description="Tambahkan akun kasir agar staf Anda bisa login dan melayani transaksi POS"
            action={<Button onClick={openCreateModal} icon={Plus}>Tambah Kasir Baru</Button>}
          />
        ) : (
          <div className="grid gap-3">
            {cashiers.map((cashier) => (
              <Card key={cashier.id} className="p-4 hover:border-pink-300 card-glow transition-all">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3.5">
                    <div
                      className={`w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-extrabold shrink-0 shadow-2xs ${
                        cashier.is_active
                          ? 'bg-gradient-to-br from-primary-400 to-primary-600 text-white shadow-pink-200'
                          : 'bg-gray-100 text-gray-400'
                      }`}
                    >
                      {cashier.full_name?.charAt(0)?.toUpperCase() || 'K'}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-gray-900 text-sm sm:text-base">{cashier.full_name || 'Kasir'}</p>
                        <Badge variant={cashier.is_active ? 'success' : 'danger'}>
                          {cashier.is_active ? 'Aktif' : 'Nonaktif'}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-gray-500 mt-0.5">
                        <Mail className="w-3.5 h-3.5 text-primary-400" />
                        <span>{cashier.email || '-'}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditModal(cashier)}
                      icon={Pencil}
                      className="hover:bg-pink-50 hover:text-primary-600"
                    >
                      Edit
                    </Button>
                    <Button
                      variant={cashier.is_active ? 'ghost' : 'secondary'}
                      size="sm"
                      onClick={() => toggleActive(cashier)}
                      icon={cashier.is_active ? UserX : UserCheck}
                      className={cashier.is_active ? 'text-red-500 hover:bg-red-50 hover:text-red-600' : ''}
                    >
                      {cashier.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Create/Edit Modal */}
        <Modal isOpen={showModal} onClose={() => setShowModal(false)}
          title={editMode ? 'Edit Data Kasir' : 'Tambah Kasir Baru'} size="sm">
          <div className="space-y-4">
            <Input label="Nama Lengkap" value={form.full_name}
              onChange={e => setForm({ ...form, full_name: e.target.value })} placeholder="Nama kasir" />
            {!editMode && (
              <>
                <Input label="Email Kasir" type="email" value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })} placeholder="kasir@email.com" />
                <Input label="Password" type="password" value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })} placeholder="Minimal 6 karakter" />
              </>
            )}
            <Button className="w-full mt-2" onClick={handleSave} loading={saving}>
              {editMode ? 'Simpan Perubahan' : 'Buat Akun Kasir'}
            </Button>
          </div>
        </Modal>
      </div>
    </div>
  )
}
