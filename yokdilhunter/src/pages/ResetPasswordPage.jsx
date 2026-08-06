import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { Toast, useToast } from '../components/Toast'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  
  const { updatePassword } = useAuth()
  const navigate = useNavigate()
  const { toast, showToast, clearToast } = useToast()

  async function handleSubmit(e) {
    e.preventDefault()
    if (!password || password.length < 6) return
    setSubmitting(true)

    try {
      await updatePassword(password)
      showToast('Şifreniz başarıyla güncellendi!', 'success')
      // Redirect to dashboard after a short delay
      setTimeout(() => navigate('/dashboard'), 1500)
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-dvh flex flex-col bg-base-900 overflow-hidden px-4">
      <Toast {...toast} onClose={clearToast} />

      {/* ── Background decoration ── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-accent-500/8 rounded-full blur-3xl" />
      </div>

      <div className="flex-1 flex items-center justify-center relative z-10">
        <div className="glass rounded-3xl p-6 sm:p-8 w-full max-w-sm shadow-card animate-card-appear text-center">
          
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-primary-500/20 border border-primary-500/30 flex items-center justify-center">
            <span className="text-3xl">🔐</span>
          </div>
          
          <h2 className="text-xl font-bold text-white mb-2">Yeni Şifre Belirle</h2>
          <p className="text-slate-400 text-sm mb-6">
            Lütfen hesabınız için yeni bir şifre girin.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4 text-left">
            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 block">
                Yeni Şifre
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="input-base"
                placeholder="En az 6 karakter"
                required
                minLength={6}
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="btn-primary w-full mt-2"
            >
              {submitting ? 'Güncelleniyor...' : 'Şifreyi Güncelle'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
