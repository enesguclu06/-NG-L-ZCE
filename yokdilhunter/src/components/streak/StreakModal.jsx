import { useNavigate } from 'react-router-dom'

export function StreakModal({ isOpen, onClose, streak }) {
  const navigate = useNavigate()
  if (!isOpen || !streak) return null

  const {
    currentStreak,
    bestStreak,
    todayCount,
    target,
    isCompletedToday,
    progressPercent,
    freezeAvailable,
    daysUntilFreeze,
    freezeUsedNotice,
    dismissNotice,
  } = streak

  const remaining = Math.max(0, target - todayCount)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div
        className="w-full max-w-sm bg-base-800 border border-white/10 rounded-3xl p-6 shadow-2xl relative overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow behind flame */}
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-40 h-40 bg-amber-500/20 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/5 transition-colors z-10"
        >
          ✕
        </button>

        {/* Freeze Notice Alert (if freeze saved yesterday) */}
        {freezeUsedNotice && (
          <div className="mb-4 p-3.5 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-200 text-xs flex items-start gap-2.5 animate-bounce-short">
            <span className="text-lg shrink-0">🛡️</span>
            <div className="flex-1">
              <p className="font-bold text-white mb-0.5">Kurtarma Kalkanı Devreye Girdi!</p>
              <p className="text-cyan-200/90 leading-relaxed mb-2">
                Dün giriş yapmadığın için 14 günlük kurtarma kalkanın serini korudu. Serin sıfırlanmadı!
              </p>
              <button
                onClick={dismissNotice}
                className="text-[11px] font-semibold bg-cyan-500/20 hover:bg-cyan-500/30 px-2.5 py-1 rounded-md text-cyan-100 transition-colors"
              >
                Tamam, Anladım
              </button>
            </div>
          </div>
        )}

        {/* Big Flame & Counter */}
        <div className="text-center pt-2 pb-4">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-tr from-amber-500/20 to-orange-500/20 border border-orange-500/30 shadow-glow-orange mb-3">
            <span className="text-4xl animate-pulse">🔥</span>
          </div>

          <div className="flex items-baseline justify-center gap-1.5">
            <span className="text-4xl font-black text-white tracking-tight">{currentStreak}</span>
            <span className="text-sm font-semibold text-amber-400 uppercase tracking-wider">Günlük Seri</span>
          </div>

          <p className="text-xs text-slate-400 mt-1">
            {isCompletedToday
              ? '🎉 Harika! Bugünün 10 kelimelik tekrar hedefini tamamladın.'
              : currentStreak > 0
                ? `Serini korumak için bugün ${remaining} kelime daha tekrar et!`
                : `Bugün ${remaining} kelime tekrar ederek 1 günlük serini başlat!`}
          </p>
        </div>

        {/* Today's Target Progress Card */}
        <div className="p-4 rounded-2xl bg-base-900/70 border border-white/5 mb-3">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="font-medium text-slate-300 flex items-center gap-1.5">
              <span>📅</span> Günlük Tekrar Hedefi
            </span>
            <span className={`font-bold ${isCompletedToday ? 'text-emerald-400' : 'text-amber-400'}`}>
              {todayCount} / {target} Kelime
            </span>
          </div>

          {/* Progress Bar */}
          <div className="h-2.5 w-full bg-base-700/80 rounded-full overflow-hidden p-0.5 border border-white/5">
            <div
              className={`h-full rounded-full transition-all duration-500 ${isCompletedToday
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                  : 'bg-gradient-to-r from-amber-500 to-orange-500'
                }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          <div className="flex justify-between items-center mt-2 text-[11px] text-slate-500">
            <span>Minimum 10 kelime</span>
            <span>{isCompletedToday ? '✅ Tamamlandı' : `%${progressPercent} bitti`}</span>
          </div>
        </div>

        {/* 14-Day Streak Recovery Shield */}
        <div className="p-3.5 rounded-2xl bg-base-900/50 border border-white/5 mb-4">
          <div className="flex items-start gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${freezeAvailable
                ? 'bg-cyan-500/15 border border-cyan-500/30 text-cyan-300'
                : 'bg-slate-700/40 border border-white/5 text-slate-500'
              }`}>
              <span className="text-base">🛡️</span>
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">Kurtarma Kalkanı</span>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${freezeAvailable
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                    : 'bg-slate-700 text-slate-400'
                  }`}>
                  {freezeAvailable ? 'Kullanıma Hazır' : `${daysUntilFreeze} gün kaldı`}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                {freezeAvailable
                  ? 'Bir gün tekrarı kaçırırsan serin sıfırlanmaz, kalkan serini otomatik kurtarır. (Her 2 haftada 1 hak).'
                  : `Son kalkan kullanımının ardından soğuma süresindedir. ${daysUntilFreeze} gün sonra yenilenir.`}
              </p>
            </div>
          </div>
        </div>

        {/* Stats Row & CTA */}
        <div className="flex items-center justify-between pt-1 mb-4 text-xs text-slate-400 px-1">
          <span className="flex items-center gap-1">
            <span>🏆</span> En Yüksek Seri: <b className="text-white ml-0.5">{bestStreak} gün</b>
          </span>
          <span className="text-slate-500 text-[11px]"></span>
        </div>

        <button
          onClick={() => {
            onClose()
            navigate('/review')
          }}
          className="w-full py-3 px-4 rounded-xl font-bold text-sm bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white shadow-glow-orange transition-all duration-200 active:scale-98 flex items-center justify-center gap-2"
        >
          <span>🔥</span>
          <span>{isCompletedToday ? 'Tekrarlara Devam Et' : 'Hemen Tekrar Et ve Seriyi Koru'}</span>
        </button>
      </div>
    </div>
  )
}

/**
 * Celebration modal when user hits 10 words today
 */
export function StreakCelebrationModal({ isOpen, onClose, currentStreak }) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div
        className="w-full max-w-sm bg-gradient-to-b from-base-800 to-base-900 border border-amber-500/30 rounded-3xl p-6 shadow-2xl relative text-center overflow-hidden animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-amber-500/10 via-transparent to-transparent pointer-events-none" />

        <div className="w-24 h-24 mx-auto rounded-3xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shadow-glow-orange mb-4 animate-bounce">
          <span className="text-5xl">🔥</span>
        </div>

        <span className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest bg-amber-500/20 text-amber-300 border border-amber-500/30 mb-2">
          GÜNLÜK HEDEF BAŞARILDI!
        </span>

        <h3 className="text-2xl font-black text-white mb-1">
          {currentStreak} Günlük Seri!
        </h3>

        <p className="text-xs text-slate-300 leading-relaxed max-w-xs mx-auto mb-6">
          Tebrikler! Bugün 10 kelimelik tekrar hedefini tamamladın ve serini başarıyla sürdürdün. Yarın da devam et!
        </p>

        <button
          onClick={onClose}
          className="w-full py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white shadow-glow-orange transition-all"
        >
          Harika, Devam Et!
        </button>
      </div>
    </div>
  )
}

/**
 * Animated modal when user opens the site and their 14-day shield was used for yesterday
 */
export function StreakShieldUsedModal({ isOpen, onClose, currentStreak }) {
  const navigate = useNavigate()
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div
        className="w-full max-w-sm bg-gradient-to-b from-base-800 to-base-900 border border-cyan-500/35 rounded-3xl p-6 shadow-2xl relative text-center overflow-hidden animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow behind shield */}
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-48 h-48 bg-cyan-500/20 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/5 transition-colors z-10"
        >
          ✕
        </button>

        {/* Shield Icon Box with floating bounce */}
        <div className="w-20 h-20 mx-auto rounded-3xl bg-cyan-500/15 border border-cyan-500/40 flex items-center justify-center shadow-lg shadow-cyan-500/20 mb-3 animate-bounce">
          <span className="text-4xl">🛡️</span>
        </div>

        {/* Tag */}
        <span className="inline-block px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-cyan-500/20 text-cyan-300 border border-cyan-500/35 mb-2">
          KURTARMA KALKANI DEVREDE
        </span>

        {/* Title */}
        <h3 className="text-2xl font-black text-white mb-2">
          Serin Korundu!
        </h3>

        {/* Message */}
        <p className="text-xs text-slate-300 leading-relaxed mb-4">
          Dün giriş yapmadığın için <b className="text-cyan-300 font-semibold">14 günlük kurtarma kalkanın</b> otomatik kullanıldı ve serin sıfırlanmadı!
        </p>

        {/* Current streak banner */}
        <div className="p-3 rounded-2xl bg-base-900/80 border border-white/5 mb-4 flex items-center justify-center gap-2">
          <span className="text-xl">🔥</span>
          <span className="text-sm font-black text-white">{currentStreak} Günlük Seri</span>
          <span className="text-xs text-emerald-400 font-semibold bg-emerald-500/15 px-2 py-0.5 rounded-full border border-emerald-500/30">
            Güvende
          </span>
        </div>

        {/* Warning hint */}
        <p className="text-[11px] text-amber-300/95 bg-amber-500/10 border border-amber-500/25 rounded-xl p-2.5 mb-5 text-left leading-relaxed">
          ⚡ <b>Önemli:</b> Kalkanın dün için kullanıldı. Serini yarın kaybetmemek için <b>bugün 10 kelimelik tekrar hedefini</b> tamamlamayı unutma!
        </p>

        {/* CTA Button */}
        <button
          onClick={() => {
            onClose()
            navigate('/review')
          }}
          className="w-full py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-lg shadow-cyan-500/25 transition-all duration-200 active:scale-98 flex items-center justify-center gap-2"
        >
          <span>🔥</span>
          <span>Hemen Tekrar Et ve Seriyi Koru</span>
        </button>
      </div>
    </div>
  )
}

/**
 * Animated modal when user opens the site and their streak was reset because yesterday was missed
 */
export function StreakLostModal({ isOpen, onClose, lostStreak }) {
  const navigate = useNavigate()
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div
        className="w-full max-w-sm bg-gradient-to-b from-base-800 to-base-900 border border-rose-500/35 rounded-3xl p-6 shadow-2xl relative text-center overflow-hidden animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow behind icon */}
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-48 h-48 bg-rose-500/20 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/5 transition-colors z-10"
        >
          ✕
        </button>

        {/* Broken Flame / Reset Icon */}
        <div className="w-20 h-20 mx-auto rounded-3xl bg-rose-500/15 border border-rose-500/40 flex items-center justify-center shadow-lg shadow-rose-500/20 mb-3 animate-pulse">
          <span className="text-4xl">💔</span>
        </div>

        {/* Tag */}
        <span className="inline-block px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/35 mb-2">
          GİRİŞ SERİSİ SIFIRLANDI
        </span>

        {/* Title */}
        <h3 className="text-2xl font-black text-white mb-2">
          Serin Sıfırlandı
        </h3>

        {/* Message */}
        <p className="text-xs text-slate-300 leading-relaxed mb-4">
          Dün giriş yapmadığın {lostStreak > 0 ? <>ve kurtarma kalkanın hazır olmadığı için <b className="text-rose-300 font-bold">{lostStreak} günlük</b> giriş streakin sıfırlandı.</> : 'için giriş streakin sıfırlandı.'}
        </p>

        {/* Friendly motivational note */}
        <div className="p-3 rounded-2xl bg-base-900/80 border border-white/5 mb-5 text-left text-xs text-slate-400 leading-relaxed">
          <p className="text-slate-300 font-medium mb-1">💪 Sorun değil, pes etmek yok!</p>
          <p className="text-[11px] text-slate-400">
            Öğrenme sürecinde böyle günler olabilir. Hemen bugün 10 kelime tekrar ederek <b>1. gün serini</b> başlat!
          </p>
        </div>

        {/* CTA Button */}
        <button
          onClick={() => {
            onClose()
            navigate('/review')
          }}
          className="w-full py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white shadow-glow-orange transition-all duration-200 active:scale-98 flex items-center justify-center gap-2"
        >
          <span>🚀</span>
          <span>Hemen Yeni Bir Seri Başlat</span>
        </button>
      </div>
    </div>
  )
}

