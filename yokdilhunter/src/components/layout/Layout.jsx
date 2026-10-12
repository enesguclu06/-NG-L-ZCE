import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { BottomNav } from './BottomNav'
import { AiSettingsModal } from './AiSettingsModal'
import { getGeminiApiKey } from '../../lib/api'

export function Layout({ children }) {
  const { signOut, user } = useAuth()
  const navigate = useNavigate()
  const [showAiModal, setShowAiModal] = useState(false)
  const hasGemini = !!getGeminiApiKey()

  async function handleSignOut() {
    try {
      await signOut()
      navigate('/auth')
    } catch (e) {
      console.error('Sign out error:', e)
    }
  }

  return (
    <div className="min-h-dvh flex flex-col bg-base-900">
      {/* ── Top Bar ── */}
      <header className="sticky top-0 z-30 bg-base-900/80 backdrop-blur-md border-b border-white/[0.06]">
        <div className="flex items-center justify-between px-4 h-14 max-w-2xl mx-auto w-full">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary-500 to-accent-400 flex items-center justify-center shadow-glow-primary">
              <span className="text-white text-xs font-black">YDH</span>
            </div>
            <span className="font-black text-sm tracking-widest gradient-text">YOKDILHUNTER</span>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* AI Settings Trigger */}
            <button
              onClick={() => setShowAiModal(true)}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                hasGemini
                  ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/25 hover:bg-emerald-500/20'
                  : 'bg-white/5 text-slate-300 hover:text-white hover:bg-white/10 border border-white/5'
              }`}
              title="Yapay Zeka (Gemini) Ayarları"
            >
              <span>✨</span>
              <span className="hidden xs:inline">AI Cümle</span>
            </button>

            {user && (
              <span className="text-slate-500 text-xs hidden sm:block truncate max-w-[120px]">
                {user.email}
              </span>
            )}
            <button
              id="btn-signout"
              onClick={handleSignOut}
              className="text-slate-500 hover:text-slate-300 transition-colors p-2 rounded-lg hover:bg-white/5"
              title="Çıkış yap"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l-3 3m0 0 3 3m-3-3h12.75" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* ── Page Content ── */}
      <main className="flex-1 pb-nav">
        {children}
      </main>

      {/* ── AI Settings Modal ── */}
      <AiSettingsModal isOpen={showAiModal} onClose={() => setShowAiModal(false)} />

      {/* ── Bottom Nav ── */}
      <BottomNav />
    </div>
  )
}
