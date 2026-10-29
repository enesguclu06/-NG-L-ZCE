import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { BottomNav } from './BottomNav'
import { AiSettingsModal } from './AiSettingsModal'
import { NotificationModal } from '../notifications/NotificationModal'
import { getGeminiApiKey } from '../../lib/api'
import { useStreak } from '../../hooks/useStreak'
import { StreakModal, StreakCelebrationModal } from '../streak/StreakModal'

export function Layout({ children }) {
  const { signOut, user } = useAuth()
  const navigate = useNavigate()
  const [showAiModal, setShowAiModal] = useState(false)
  const [showStreakModal, setShowStreakModal] = useState(false)
  const [showNotificationModal, setShowNotificationModal] = useState(false)
  const hasGemini = !!getGeminiApiKey()
  const streak = useStreak()

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
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary-500 via-primary-400 to-accent-400 flex items-center justify-center shadow-glow-primary border border-white/10">
              <span className="text-white text-xs font-black tracking-tighter">EG</span>
            </div>
            <span className="font-black text-base tracking-wide gradient-text">Enesglish</span>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Notification Reminder Trigger */}
            <button
              onClick={() => setShowNotificationModal(true)}
              className="flex items-center gap-1 p-2 rounded-lg text-xs font-medium transition-all bg-white/5 text-amber-300 hover:text-amber-200 hover:bg-white/10 border border-white/5"
              title="Kelime Hatırlatıcı Bildirimler (10:00 & 22:00)"
            >
              <span className="text-sm">🔔</span>
            </button>

            {/* Streak Counter Trigger */}
            <button
              onClick={() => setShowStreakModal(true)}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                streak.isCompletedToday
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30 hover:bg-amber-500/25 shadow-glow-orange'
                  : streak.currentStreak > 0
                    ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20 hover:bg-orange-500/15'
                    : 'bg-white/5 text-slate-400 hover:text-slate-200 border border-white/5'
              }`}
              title="Günlük Tekrar Serisi (Streak) ve Hedef"
            >
              <span className={`text-sm ${streak.isCompletedToday ? 'animate-bounce-short' : ''}`}>🔥</span>
              <span>{streak.currentStreak}</span>
              {!streak.isCompletedToday && (
                <span className="text-[10px] opacity-75 font-normal hidden xs:inline">
                  ({streak.todayCount}/10)
                </span>
              )}
            </button>

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

      {/* ── Notification Reminder Modal ── */}
      <NotificationModal
        isOpen={showNotificationModal}
        onClose={() => setShowNotificationModal(false)}
      />

      {/* ── AI Settings Modal ── */}
      <AiSettingsModal isOpen={showAiModal} onClose={() => setShowAiModal(false)} />

      {/* ── Daily Streak Modal ── */}
      <StreakModal
        isOpen={showStreakModal}
        onClose={() => setShowStreakModal(false)}
        streak={streak}
      />

      {/* ── Streak Goal Celebration Modal (hits 10 words) ── */}
      <StreakCelebrationModal
        isOpen={streak.justCompletedModal}
        onClose={streak.closeCelebration}
        currentStreak={streak.currentStreak}
      />

      {/* ── Bottom Nav ── */}
      <BottomNav />
    </div>
  )
}
