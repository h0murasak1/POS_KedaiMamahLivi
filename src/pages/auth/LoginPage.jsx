import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { ChefHat, Eye, EyeOff, Sparkles, Heart } from 'lucide-react'
import toast from 'react-hot-toast'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const { signIn } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email || !password) {
      toast.error('Masukkan email dan password')
      return
    }
    setLoading(true)
    try {
      await signIn(email.trim().toLowerCase(), password)
      toast.success('Login berhasil! Selamat datang ✨')
      navigate('/dashboard')
    } catch (error) {
      toast.error(error.message || 'Login gagal. Periksa email dan password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-100 via-pink-50 to-white flex items-center justify-center p-4 relative overflow-hidden">
      {/* Decorative background blobs */}
      <div className="absolute top-[-10%] right-[-5%] w-96 h-96 bg-primary-200/40 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-5%] w-96 h-96 bg-pink-300/30 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 left-1/4 w-64 h-64 bg-white/60 rounded-full blur-2xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10 animate-fade-in-up">
        {/* Logo & Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-primary-500 to-primary-600 rounded-3xl shadow-xl shadow-primary-300/50 mb-4 animate-pulse-pink">
            <ChefHat className="w-11 h-11 text-white" />
          </div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight flex items-center justify-center gap-1.5">
            Kedai Mamah Livi
            <Sparkles className="w-5 h-5 text-primary-500 animate-bounce" />
          </h1>
          <p className="text-xs sm:text-sm font-medium text-primary-600 mt-1 flex items-center justify-center gap-1">
            <span>Sistem Kasir Pintar & Ramah</span>
            <Heart className="w-3.5 h-3.5 fill-primary-400 text-primary-400" />
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-xl shadow-pink-200/40 border border-pink-100 p-7 sm:p-8">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-gray-900 tracking-tight">Masuk ke Akun</h2>
            <p className="text-xs text-gray-500 mt-1">Silakan masukkan akun Pemilik atau Kasir Anda</p>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@kedaimamahlivi.com"
                className="w-full px-4 py-3 border border-pink-200 rounded-2xl bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-400/50 focus:border-primary-500 transition-all text-sm font-medium"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Masukkan password akun"
                  className="w-full px-4 py-3 border border-pink-200 rounded-2xl bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-400/50 focus:border-primary-500 transition-all pr-11 text-sm font-medium"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-primary-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 active:scale-[0.98] text-white font-bold rounded-2xl transition-all shadow-md shadow-primary-300/40 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-base mt-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <span>Sedang Masuk...</span>
                </>
              ) : (
                <span>Masuk Sekarang</span>
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-primary-400 mt-6 font-medium">
          © 2026 Kedai Mamah Livi — Pink & Sweet Edition 🌸
        </p>
      </div>
    </div>
  )
}
