import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Eye, EyeOff, Mail, Lock, ArrowRight, WifiOff, Zap, ShieldCheck, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { BrandMark } from '@/components/layout/Sidebar'
import { fieldClass, FieldLabel } from '@/components/ui/Input'
import { playError, playSuccess } from '@/lib/sound'

const HERO_IMG = 'https://images.unsplash.com/photo-1611506168759-1e69a83b5a53?crop=entropy&cs=srgb&fm=jpg&q=80&w=1400'

const highlights = [
  { icon: Zap, title: 'Cepat & sat-set', desc: 'Pesanan selesai dalam hitungan detik' },
  { icon: WifiOff, title: 'Tetap jalan saat offline', desc: 'Tersinkron otomatis begitu online' },
  { icon: ShieldCheck, title: 'Pembatalan berizin', desc: 'PIN Owner & persetujuan jarak jauh' },
]

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [capsLock, setCapsLock] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [shakeKey, setShakeKey] = useState(0)
  const { signIn } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErrorMsg('')
    if (!email || !password) {
      setErrorMsg('Masukkan email dan password')
      setShakeKey((k) => k + 1)
      return
    }
    setLoading(true)
    try {
      await signIn(email.trim().toLowerCase(), password)
      playSuccess()
      toast.success('Login berhasil! Selamat bertugas')
      navigate('/dashboard')
    } catch (error) {
      const msg = error.message === 'Invalid login credentials'
        ? 'Email atau password salah. Coba lagi ya.'
        : error.message || 'Login gagal. Periksa email dan password.'
      setErrorMsg(msg)
      setShakeKey((k) => k + 1)
      playError()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[100dvh] bg-linen flex">
      {/* Left brand panel (desktop/tablet landscape) */}
      <section className="hidden lg:flex relative w-[46%] xl:w-1/2 overflow-hidden bg-zinc-950 text-white">
        <img src={HERO_IMG} alt="Nasi goreng spesial" className="absolute inset-0 w-full h-full object-cover opacity-60 scale-105" />
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/60 to-primary-900/30" />
        <div className="relative z-10 flex flex-col justify-between p-10 xl:p-14 w-full">
          <div className="flex items-center gap-3">
            <BrandMark />
            <div>
              <p className="font-heading text-lg font-bold leading-tight">Kedai Mamah Livi</p>
              <p className="text-xs text-white/60">Point of Sale</p>
            </div>
          </div>

          <div className="max-w-md">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur border border-white/15 text-[11px] font-bold uppercase tracking-[0.14em] text-primary-200">
              <span className="w-1.5 h-1.5 rounded-full bg-secondary-400" /> Sistem Kasir Warung Modern
            </span>
            <h1 className="font-heading text-4xl xl:text-5xl font-bold leading-[1.05] tracking-tight mt-5">
              Layani pelanggan<br />lebih cepat,<br />
              <span className="text-primary-400">rekap lebih rapi.</span>
            </h1>
            <div className="mt-9 space-y-4 stagger">
              {highlights.map((h) => (
                <div key={h.title} className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center shrink-0">
                    <h.icon className="w-5 h-5 text-primary-300" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{h.title}</p>
                    <p className="text-xs text-white/60 mt-0.5">{h.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs text-white/40">© {new Date().getFullYear()} Kedai Mamah Livi</p>
        </div>
      </section>

      {/* Right form */}
      <section className="flex-1 flex flex-col">
        {/* Mobile hero strip */}
        <div className="lg:hidden relative h-48 sm:h-56 overflow-hidden">
          <img src={HERO_IMG} alt="" className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-linen via-zinc-950/30 to-zinc-950/40" />
          <div className="absolute top-5 left-5 flex items-center gap-2.5 text-white">
            <BrandMark />
            <p className="font-heading font-bold text-lg drop-shadow">Kedai Mamah Livi</p>
          </div>
        </div>

        <div className="flex-1 flex items-start lg:items-center justify-center px-5 sm:px-8 -mt-10 lg:mt-0 pb-10 relative z-10">
          <div
            key={shakeKey}
            className={`w-full max-w-[420px] bg-white lg:bg-transparent rounded-3xl lg:rounded-none p-6 sm:p-8 lg:p-0 shadow-[0_20px_50px_-24px_rgba(24,24,27,0.35)] lg:shadow-none border border-zinc-100 lg:border-0 ${shakeKey ? 'animate-shake' : 'animate-fade-in-up'}`}
          >
            <p className="text-sm font-semibold text-primary-700">Selamat datang kembali 👋</p>
            <h2 className="font-heading text-3xl font-bold text-zinc-900 tracking-tight mt-1">Masuk ke akun</h2>
            <p className="text-sm text-zinc-500 mt-1.5">Gunakan akun Pemilik atau Kasir yang terdaftar.</p>

            {errorMsg && (
              <div className="mt-5 flex items-start gap-2.5 p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700 animate-fade-in-up" data-testid="login-error-message">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span className="font-medium">{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 mt-6" data-testid="login-form">
              <div>
                <FieldLabel>Email</FieldLabel>
                <div className="relative">
                  <Mail className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nama@kedaimamahlivi.com"
                    autoComplete="email"
                    data-testid="login-email-input"
                    className={`${fieldClass} pl-10 min-h-12`}
                    required
                  />
                </div>
              </div>

              <div>
                <FieldLabel hint={capsLock ? '⚠ Caps Lock aktif' : null}>Password</FieldLabel>
                <div className="relative">
                  <Lock className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyUp={(e) => setCapsLock(e.getModifierState?.('CapsLock'))}
                    placeholder="Masukkan password"
                    autoComplete="current-password"
                    data-testid="login-password-input"
                    className={`${fieldClass} pl-10 pr-12 min-h-12`}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    data-testid="login-toggle-password-button"
                    aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-lg flex items-center justify-center text-zinc-400 hover:text-zinc-800 hover:bg-zinc-100 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                data-testid="login-submit-button"
                className="group w-full min-h-13 py-3.5 mt-2 bg-gradient-to-br from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 active:scale-[0.98] text-white font-bold rounded-2xl transition-[background-color,transform,box-shadow] shadow-[0_12px_28px_-10px_rgba(234,88,12,0.7)] disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-base"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <span>Sedang masuk…</span>
                  </>
                ) : (
                  <>
                    <span>Masuk Sekarang</span>
                    <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
                  </>
                )}
              </button>
            </form>

            <p className="text-xs text-zinc-400 mt-6 text-center lg:text-left">
              Lupa password? Hubungi pemilik kedai untuk reset akun kasir.
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}
