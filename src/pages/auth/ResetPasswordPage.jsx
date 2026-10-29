import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Eye, EyeOff, Lock, ArrowRight, ShieldCheck, CheckCircle2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { BrandMark } from '@/components/layout/Sidebar'
import { fieldClass, FieldLabel } from '@/components/ui/Input'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [validSession, setValidSession] = useState(false)
  const [checking, setChecking] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    // Periksa apakah ada session aktif dari token recovery
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setValidSession(true)
      }
      setChecking(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || session) {
        setValidSession(true)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleUpdatePassword = async (e) => {
    e.preventDefault()
    if (!password || password.length < 6) {
      toast.error('Password baru minimal 6 karakter')
      return
    }
    if (password !== confirmPassword) {
      toast.error('Konfirmasi password tidak cocok')
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({
        password: password,
      })
      if (error) throw error

      setSuccess(true)
      toast.success('Password berhasil diubah!')
      setTimeout(() => {
        navigate('/dashboard')
      }, 2000)
    } catch (err) {
      toast.error(err.message || 'Gagal mengubah password. Tautan mungkin telah kedaluwarsa.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[100dvh] bg-linen flex items-center justify-center p-4">
      <div className="w-full max-w-[420px] bg-white rounded-3xl p-6 sm:p-8 shadow-[0_20px_50px_-24px_rgba(24,24,27,0.35)] border border-zinc-100 animate-fade-in-up">
        <div className="flex items-center gap-3 mb-6">
          <BrandMark />
          <div>
            <p className="font-heading font-bold text-lg text-zinc-900 leading-tight">Kedai Mamah Livi</p>
            <p className="text-xs text-zinc-500">Reset Password Pemilik</p>
          </div>
        </div>

        {success ? (
          <div className="text-center py-6 space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="font-heading text-xl font-bold text-zinc-900">Password Berhasil Diubah!</h3>
            <p className="text-sm text-zinc-600">
              Password baru Anda telah disimpan. Mengalihkan Anda ke halaman dashboard…
            </p>
          </div>
        ) : checking ? (
          <div className="text-center py-12">
            <div className="animate-spin w-8 h-8 border-3 border-primary-500 border-t-transparent rounded-full mx-auto" />
            <p className="text-sm text-zinc-500 mt-3">Memverifikasi tautan reset…</p>
          </div>
        ) : !validSession ? (
          <div className="space-y-4 py-2">
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-sm leading-relaxed">
              Tautan reset password tidak valid atau sudah kedaluwarsa. Silakan minta tautan baru melalui halaman login.
            </div>
            <button
              onClick={() => navigate('/login')}
              className="w-full h-12 bg-zinc-900 hover:bg-zinc-800 text-white font-bold rounded-2xl text-sm transition-colors"
            >
              Kembali ke Login
            </button>
          </div>
        ) : (
          <form onSubmit={handleUpdatePassword} className="space-y-4">
            <div>
              <h2 className="font-heading text-2xl font-bold text-zinc-900 tracking-tight">Buat Password Baru</h2>
              <p className="text-sm text-zinc-500 mt-1">Masukkan password baru untuk akun pemilik kedai Anda.</p>
            </div>

            <div>
              <FieldLabel hint="min. 6 karakter">Password Baru</FieldLabel>
              <div className="relative">
                <Lock className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password baru"
                  className={`${fieldClass} pl-10 pr-12 min-h-12`}
                  required
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Sembunyikan' : 'Tampilkan'}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-lg flex items-center justify-center text-zinc-400 hover:text-zinc-800 hover:bg-zinc-100"
                >
                  {showPassword ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
                </button>
              </div>
            </div>

            <div>
              <FieldLabel>Konfirmasi Password Baru</FieldLabel>
              <div className="relative">
                <Lock className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Ulangi password baru"
                  className={`${fieldClass} pl-10 min-h-12`}
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full min-h-12 py-3 mt-2 bg-gradient-to-br from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 active:scale-[0.98] text-white font-bold rounded-2xl transition-[background-color,transform,box-shadow] shadow-[0_12px_28px_-10px_rgba(234,88,12,0.7)] disabled:opacity-60 flex items-center justify-center gap-2 text-base"
            >
              {loading ? (
                <span>Menyimpan…</span>
              ) : (
                <>
                  <span>Simpan Password Baru</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
