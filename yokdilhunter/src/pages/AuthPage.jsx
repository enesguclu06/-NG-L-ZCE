import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { Toast, useToast } from '../components/Toast'

export default function AuthPage() {
  const [mode, setMode] = useState('login') // 'login' | 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [signupDone, setSignupDone] = useState(false)

  const { signIn, signUp } = useAuth()
  const navigate = useNavigate()
  const { toast, showToast, clearToast } = useToast()

  async function handleSubmit(e) {
    e.preventDefault()
    if (!email || !password) return
    setSubmitting(true)

    try {
      if (mode === 'login') {
        await signIn(email, password)
        navigate('/add')
      } else {
        await signUp(email, password)
        setSignupDone(true)
        showToast('Kayıt başarılı! E-postanı onaylayıp giriş yap.', 'success')
      }
    } catch (err) {
      showToast(translateError(err.message), 'error')
    } finally {
      setSubmitting(false)
    }
  }

  if (signupDone) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-base-900 px-4">
        <Toast {...toast} onClose={clearToast} />
        <div className="glass rounded-3xl p-8 max-w-sm w-full text-center animate-card-appear shadow-card">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-easy/20 border border-easy/30 flex items-center justify-center">
            <span className="text-3xl">📬</span>
          </div>
          <h2 className="text-xl font-bold text-white mb-2">E-postanı Onayla</h2>
          <p className="text-slate-400 text-sm mb-6">
            <strong className="text-slate-200">{email}</strong> adresine bir onay bağlantısı gönderdik.
            Bağlantıya tıkladıktan sonra giriş yapabilirsin.
          </p>
          <button
            id="btn-go-to-login"
            className="btn-primary w-full"
            onClick={() => { setSignupDone(false); setMode('login') }}
          >
            Giriş Sayfasına Git
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-dvh flex flex-col bg-base-900 overflow-hidden">
      <Toast {...toast} onClose={clearToast} />

      {/* ── Background decoration ── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-accent-500/8 rounded-full blur-3xl" />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-64 h-64 bg-primary-600/5 rounded-full blur-2xl" />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-4 py-12 relative z-10">
        {/* ── Hero ── */}
        <div className="text-center mb-10 animate-fade-up">
          <div className="w-20 h-20 mx-auto mb-5 rounded-3xl bg-gradient-to-br from-primary-500 to-accent-400 flex items-center justify-center shadow-glow-primary">
            <span className="text-white text-3xl font-black">Y</span>
          </div>
          <h1 className="text-4xl font-black tracking-tight gradient-text mb-2">
            YOKDILHUNTER
          </h1>
          <p className="text-slate-400 text-sm font-medium">
            İngilizce kelimeleri yakala, Türkçesiyle öğren
          </p>
        </div>

        {/* ── Auth Card ── */}
        <div className="glass rounded-3xl p-6 sm:p-8 w-full max-w-sm shadow-card animate-card-appear">
          {/* Tab toggle */}
          <div className="flex bg-base-900 rounded-2xl p-1 mb-6">
            <button
              id="tab-login"
              onClick={() => setMode('login')}
              className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all duration-200
                ${mode === 'login' ? 'bg-primary-500 text-white shadow-glow-primary' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Giriş Yap
            </button>
            <button
              id="tab-signup"
              onClick={() => setMode('signup')}
              className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all duration-200
                ${mode === 'signup' ? 'bg-primary-500 text-white shadow-glow-primary' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Kayıt Ol
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 block">
                E-posta
              </label>
              <input
                id="input-email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="input-base"
                placeholder="ornek@email.com"
                required
                autoComplete="email"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 block">
                Şifre
              </label>
              <input
                id="input-password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="input-base"
                placeholder={mode === 'signup' ? 'En az 6 karakter' : '••••••••'}
                required
                minLength={6}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              />
            </div>

            <button
              id="btn-auth-submit"
              type="submit"
              disabled={submitting}
              className="btn-primary w-full mt-2"
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <LoadingSpinner size="sm" />
                  {mode === 'login' ? 'Giriş yapılıyor...' : 'Kayıt yapılıyor...'}
                </span>
              ) : (
                mode === 'login' ? 'Giriş Yap' : 'Kayıt Ol'
              )}
            </button>
          </form>

          {/* Switch mode link */}
          <p className="text-center text-slate-500 text-sm mt-5">
            {mode === 'login' ? 'Hesabın yok mu? ' : 'Zaten hesabın var mı? '}
            <button
              id="btn-toggle-mode"
              onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
              className="text-primary-300 hover:text-primary-200 font-semibold transition-colors"
            >
              {mode === 'login' ? 'Kayıt Ol' : 'Giriş Yap'}
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}

function LoadingSpinner({ size = 'md' }) {
  const sz = size === 'sm' ? 'w-4 h-4' : 'w-6 h-6'
  return (
    <svg className={`animate-spin ${sz}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}

function translateError(msg) {
  if (msg.includes('Invalid login credentials')) return 'E-posta veya şifre hatalı.'
  if (msg.includes('Email not confirmed')) return 'E-posta adresini henüz onaylamadın.'
  if (msg.includes('User already registered')) return 'Bu e-posta ile zaten bir hesap var.'
  if (msg.includes('Password should be at least')) return 'Şifre en az 6 karakter olmalı.'
  return msg
}
