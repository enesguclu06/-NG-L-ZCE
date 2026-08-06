import { useEffect, useState, useMemo } from 'react'
import { useWords } from '../hooks/useWords'
import { useReview } from '../hooks/useReview'
import { FlashCard } from '../components/review/FlashCard'
import { Toast, useToast } from '../components/Toast'

const MODE_OPTIONS = [
  { key: 'default', label: '🎯 Varsayılan (Zor + Orta + Yeni)',  description: 'Kolay olarak işaretlenenler hariç' },
  { key: 'hard',    label: '🔴 Sadece Zor kelimeler',            description: 'Çalışmaya devam etmen gerekenler' },
  { key: 'medium',  label: '🟡 Sadece Orta kelimeler',           description: 'Biraz daha tekrar gerektirenler' },
  { key: 'easy',    label: '🟢 Sadece Kolay kelimeler',          description: 'Öğrendiğin kelimeleri gözden geçir' },
  { key: 'unrated', label: '⚪ Sadece Yeni kelimeler',           description: 'Henüz değerlendirilmemişler' },
]

export default function ReviewPage() {
  const { words, loading, fetchWords } = useWords()
  const [selectedMode, setSelectedMode] = useState('default')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const { toast, showToast, clearToast } = useToast()

  const {
    queue, currentIndex, currentWord,
    isFlipped, isComplete, isStarted,
    sessionResults, startSession,
    flip, rateDifficulty,
    restartSession, total, progress,
  } = useReview(words, selectedMode, selectedCategory)

  useEffect(() => {
    fetchWords()
  }, [fetchWords])

  async function handleRate(difficulty) {
    try {
      await rateDifficulty(difficulty)
    } catch (e) {
      showToast('Kaydetme hatası: ' + e.message, 'error')
    }
  }

  // Queue size preview per mode
  const modeCounts = useMemo(() => {
    let filteredWords = words
    if (selectedCategory !== 'all') {
      if (selectedCategory === 'none') {
        filteredWords = filteredWords.filter(w => !w.category)
      } else {
        filteredWords = filteredWords.filter(w => w.category === selectedCategory)
      }
    }

    const counts = {}
    for (const opt of MODE_OPTIONS) {
      if (opt.key === 'default') {
        counts[opt.key] = filteredWords.filter(w => w.difficulty !== 'easy').length
      } else {
        counts[opt.key] = filteredWords.filter(w => w.difficulty === opt.key).length
      }
    }
    return counts
  }, [words, selectedCategory])

  // Get unique categories for dropdown
  const uniqueCategories = useMemo(() => {
    const cats = new Set()
    words.forEach(w => {
      if (w.category) cats.add(w.category)
    })
    return Array.from(cats).sort()
  }, [words])

  // ── Start Screen ──────────────────────────────────────────────
  if (!isStarted) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-6">
        <Toast {...toast} onClose={clearToast} />

        <div className="mb-6 animate-fade-up">
          <h2 className="text-2xl font-black text-white">Tekrar Modu</h2>
          <p className="text-slate-400 text-sm mt-1">Hangi kelimeleri tekrar etmek istiyorsun?</p>
        </div>

        {loading ? (
          <div className="text-center py-16">
            <LoadingSpinner size="lg" />
            <p className="text-slate-500 mt-3 text-sm">Kelimeler yükleniyor...</p>
          </div>
        ) : words.length === 0 ? (
          <div className="text-center py-16 glass rounded-3xl animate-fade-up">
            <span className="text-5xl">📭</span>
            <p className="text-slate-300 font-semibold mt-4">Henüz kelime yok</p>
            <p className="text-slate-500 text-sm mt-1">"Ekle" sekmesinden kelime ekleyerek başla</p>
          </div>
        ) : (
          <div className="space-y-4 animate-fade-up">
            
            {/* Category Select */}
            <div className="bg-base-800 rounded-2xl p-4 border border-white/[0.06]">
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Hangi listeden çalışmak istiyorsun?
              </label>
              <select
                value={selectedCategory}
                onChange={e => setSelectedCategory(e.target.value)}
                className="input-base cursor-pointer appearance-none text-sm w-full"
              >
                <option value="all">Tüm Kelimeler (Hepsi)</option>
                <option value="none">Genel (Kategorisiz)</option>
                {uniqueCategories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div className="space-y-3">
            {MODE_OPTIONS.map(({ key, label, description }) => {
              const count = modeCounts[key] ?? 0
              const isSelected = selectedMode === key
              return (
                <button
                  key={key}
                  id={`mode-${key}`}
                  onClick={() => setSelectedMode(key)}
                  disabled={count === 0}
                  className={`w-full text-left p-4 rounded-2xl border transition-all duration-200
                    ${count === 0 ? 'opacity-40 cursor-not-allowed border-white/[0.04] bg-base-800/50' :
                      isSelected
                        ? 'border-primary-500/60 bg-primary-500/10 shadow-glow-primary'
                        : 'border-white/[0.06] bg-base-800 hover:border-white/20 hover:bg-base-700'}`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={`font-semibold text-sm ${isSelected ? 'text-primary-300' : 'text-slate-200'}`}>
                        {label}
                      </p>
                      <p className="text-slate-500 text-xs mt-0.5">{description}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`px-2.5 py-1 rounded-xl text-xs font-bold
                        ${count === 0 ? 'bg-base-700 text-slate-500' :
                          isSelected ? 'bg-primary-500 text-white' : 'bg-base-700 text-slate-300'}`}>
                        {count}
                      </span>
                      {isSelected && (
                        <div className="w-5 h-5 rounded-full bg-primary-500 flex items-center justify-center">
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="currentColor">
                            <path fillRule="evenodd" d="M19.916 4.626a.75.75 0 0 1 .208 1.04l-9 13.5a.75.75 0 0 1-1.154.114l-6-6a.75.75 0 0 1 1.06-1.06l5.353 5.353 8.493-12.74a.75.75 0 0 1 1.04-.207Z" clipRule="evenodd" />
                          </svg>
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              )
            })}
            </div>

            <button
              id="btn-start-review"
              onClick={startSession}
              disabled={modeCounts[selectedMode] === 0}
              className="btn-primary w-full mt-4 py-4 text-base"
            >
              🚀 Tekrarı Başlat ({modeCounts[selectedMode] ?? 0} kelime)
            </button>
          </div>
        )}
      </div>
    )
  }

  // ── Session Complete Screen ───────────────────────────────────
  if (isComplete) {
    const totalReviewed = Object.values(sessionResults).reduce((a, b) => a + b, 0)
    return (
      <div className="max-w-2xl mx-auto px-4 py-6 flex flex-col items-center">
        <Toast {...toast} onClose={clearToast} />

        <div className="w-full glass rounded-3xl p-8 text-center animate-card-appear shadow-card">
          <div className="text-6xl mb-4">🎉</div>
          <h2 className="text-2xl font-black text-white mb-1">Oturum Tamamlandı!</h2>
          <p className="text-slate-400 text-sm mb-8">{totalReviewed} kelime tekrar edildi</p>

          {/* Result breakdown */}
          <div className="grid grid-cols-3 gap-3 mb-8">
            <ResultStat count={sessionResults.easy ?? 0} label="Kolay" cls="text-easy" bg="bg-easy/10 border-easy/20" emoji="😊" />
            <ResultStat count={sessionResults.medium ?? 0} label="Orta" cls="text-medium" bg="bg-medium/10 border-medium/20" emoji="🤔" />
            <ResultStat count={sessionResults.hard ?? 0} label="Zor" cls="text-hard" bg="bg-hard/10 border-hard/20" emoji="😰" />
          </div>

          {/* Progress message */}
          {sessionResults.easy > 0 && (
            <p className="text-slate-400 text-sm mb-6">
              🌟 {sessionResults.easy} kelime artık günlük tekrardan çıkacak.
            </p>
          )}

          <div className="flex gap-3">
            <button
              id="btn-restart-session"
              onClick={restartSession}
              className="btn-ghost flex-1"
            >
              🔄 Tekrar Et
            </button>
            <button
              id="btn-new-session"
              onClick={() => window.location.reload()}
              className="btn-primary flex-1"
            >
              Yeni Oturum
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Review Session ────────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto px-4 py-4">
      <Toast {...toast} onClose={clearToast} />

      {/* ── Progress bar ── */}
      <div className="mb-4 animate-fade-up">
        <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
          <span className="font-semibold text-slate-300">{currentIndex + 1} / {total}</span>
          <span>{Math.round(progress * 100)}% tamamlandı</span>
        </div>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${progress * 100}%` }} />
        </div>
      </div>

      {/* ── FlashCard ── */}
      {currentWord && (
        <FlashCard
          word={currentWord}
          isFlipped={isFlipped}
          onFlip={flip}
          onRate={handleRate}
        />
      )}

      {/* ── Flip hint (only when not flipped) ── */}
      {!isFlipped && (
        <p className="text-center text-slate-600 text-xs mt-4 animate-pulse-soft">
          Kartın üzerine tıkla veya dokun
        </p>
      )}
    </div>
  )
}

function ResultStat({ count, label, cls, bg, emoji }) {
  return (
    <div className={`rounded-2xl p-4 border ${bg}`}>
      <div className="text-2xl mb-1">{emoji}</div>
      <div className={`text-2xl font-black ${cls}`}>{count}</div>
      <div className="text-slate-500 text-xs font-medium mt-0.5">{label}</div>
    </div>
  )
}

function LoadingSpinner({ size = 'md' }) {
  const sz = size === 'lg' ? 'w-8 h-8' : 'w-5 h-5'
  return (
    <svg className={`animate-spin ${sz} mx-auto text-primary-400`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}
