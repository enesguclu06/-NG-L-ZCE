import { useEffect, useState, useMemo } from 'react'
import { isDueToday } from '../lib/spaced'
import { useWords } from '../hooks/useWords'
import { useDecks } from '../hooks/useDecks'
import { useReview } from '../hooks/useReview'
import { useAuthStore } from '../store/authStore'
import { FlashCard } from '../components/review/FlashCard'
import { HistoryReviewPicker } from '../components/review/HistoryReviewPicker'
import { Toast, useToast } from '../components/Toast'

const MODE_OPTIONS = [
  { key: 'today',       label: '📅 Bugün Eklenenleri Tekrar Et',     description: 'Bugün eklediğin kelimeleri hemen çalış', badge: 'Yeni' },
  { key: 'due',         label: '🗓️ Anki Tekrarı (SM-2)',             description: 'Algoritmanın bugün için planladığı kelimeler', badge: 'Önerilen' },
  { key: 'default',     label: '🎯 Varsayılan (Zor + Orta + Yeni)',  description: 'Kolay olarak işaretlenenler hariç' },
  { key: 'hard_medium', label: '🔴🟡 Sadece Zor + Orta kelimeler',  description: 'Çalışmaya devam etmen gereken tüm kelimeler' },
  { key: 'hard',        label: '🔴 Sadece Zor kelimeler',            description: 'Çalışmaya devam etmen gerekenler' },
  { key: 'medium',      label: '🟡 Sadece Orta kelimeler',           description: 'Biraz daha tekrar gerektirenler' },
  { key: 'easy',        label: '🟢 Sadece Kolay kelimeler',          description: 'Öğrendiğin kelimeleri gözden geçir' },
  { key: 'unrated',     label: '⚪ Sadece Yeni kelimeler',           description: 'Henüz değerlendirilmemişler' },
]

export default function ReviewPage() {
  const { user } = useAuthStore()
  const { words, loading, fetchWords, updateWord, deleteWord, updateAfterReview } = useWords()
  const { decks, fetchDecks, createDeck } = useDecks()
  const [activeTab, setActiveTab] = useState('modes') // 'modes' | 'history'
  const [selectedMode, setSelectedMode] = useState('default')
  const [selectedCategory, setSelectedCategory] = useState('all') // Actually holds deck_id
  const [newDeckName, setNewDeckName] = useState('')
  const [creatingDeck, setCreatingDeck] = useState(false)
  const [sessionInfo, setSessionInfo] = useState(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const { toast, showToast, clearToast } = useToast()

  const {
    queue, currentIndex, currentWord,
    isFlipped, isComplete, isStarted,
    sessionResults, startSession, exitSession,
    flip, rateDifficulty, skip, removeCurrentWord,
    restartSession, total, progress,
  } = useReview(words, selectedMode, selectedCategory, updateAfterReview)

  useEffect(() => {
    fetchWords()
    fetchDecks()
  }, [fetchWords, fetchDecks])

  // ── Keyboard shortcuts ─────────────────────────────────────────
  useEffect(() => {
    function onKeyDown(e) {
      if (showDeleteModal) {
        if (e.key === 'Escape') {
          e.preventDefault()
          setShowDeleteModal(false)
        }
        return
      }

      if (!isStarted || isComplete) return

      if (e.code === 'Space' && e.target === document.body) {
        e.preventDefault()
        if (!isFlipped) {
          flip()
        } else {
          skip()
        }
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [isStarted, isComplete, isFlipped, showDeleteModal, flip, skip])

  async function handleRate(difficulty) {
    try {
      await rateDifficulty(difficulty)
    } catch (e) {
      showToast('Kaydetme hatası: ' + e.message, 'error')
    }
  }

  async function handleDeleteCurrentWord() {
    if (!currentWord || deleting) return
    const wordName = currentWord.english_word
    setDeleting(true)
    try {
      await deleteWord(currentWord.id)
      removeCurrentWord()
      setShowDeleteModal(false)
      showToast(`"${wordName}" silindi.`, 'info')
    } catch (e) {
      showToast('Silme hatası: ' + e.message, 'error')
    } finally {
      setDeleting(false)
    }
  }

  // Queue size preview per mode
  const modeCounts = useMemo(() => {
    let filteredWords = words
    if (selectedCategory !== 'all') {
      if (selectedCategory === 'none') {
        filteredWords = filteredWords.filter(w => !w.deck_id)
      } else {
        filteredWords = filteredWords.filter(w => w.deck_id === selectedCategory)
      }
    }

    // Start of today (midnight local time)
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const counts = {}
    for (const opt of MODE_OPTIONS) {
      if (opt.key === 'today') {
        counts[opt.key] = filteredWords.filter(w => new Date(w.created_at) >= todayStart).length
      } else if (opt.key === 'due') {
        counts[opt.key] = filteredWords.filter(isDueToday).length
      } else if (opt.key === 'default') {
        counts[opt.key] = filteredWords.filter(w => w.difficulty !== 'easy').length
      } else if (opt.key === 'hard_medium') {
        counts[opt.key] = filteredWords.filter(w => w.difficulty === 'hard' || w.difficulty === 'medium').length
      } else {
        counts[opt.key] = filteredWords.filter(w => w.difficulty === opt.key).length
      }
    }
    return counts
  }, [words, selectedCategory])

  async function handleCreateDeck(e) {
    e.preventDefault()
    if (!newDeckName.trim()) return
    setCreatingDeck(true)
    try {
      const d = await createDeck(newDeckName.trim())
      setNewDeckName('')
      setSelectedCategory(d.id)
      showToast(`"${d.name}" listesi oluşturuldu!`, 'success')
    } catch (err) {
      showToast('Liste oluşturulamadı: ' + err.message, 'error')
    } finally {
      setCreatingDeck(false)
    }
  }

  function handleStartStandardReview() {
    const opt = MODE_OPTIONS.find(m => m.key === selectedMode)
    setSessionInfo({
      title: opt ? opt.label : 'Tekrar',
      mode: selectedMode,
    })
    startSession()
  }

  function handleStartHistorySession(matchedWords, meta) {
    setSessionInfo({
      title: `🗓️ ${meta.title}`,
      meta,
    })
    startSession(matchedWords)
  }

  function handleExitReview() {
    setSessionInfo(null)
    exitSession()
  }

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

            {/* ── Main Tab Switcher ── */}
            <div className="flex gap-2 p-1.5 bg-base-800 rounded-2xl border border-white/[0.06]">
              <button
                type="button"
                onClick={() => setActiveTab('modes')}
                className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold transition-all duration-200 flex items-center justify-center gap-2 ${
                  activeTab === 'modes'
                    ? 'bg-primary-500 text-white shadow-glow-primary'
                    : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                <span>🎯</span>
                <span>Akıllı Modlar</span>
              </button>
              <button
                type="button"
                id="tab-history-review"
                onClick={() => setActiveTab('history')}
                className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold transition-all duration-200 flex items-center justify-center gap-2 ${
                  activeTab === 'history'
                    ? 'bg-primary-500 text-white shadow-glow-primary'
                    : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                <span>🗓️</span>
                <span>Geçmiş Gün Tekrarı</span>
                <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Yeni
                </span>
              </button>
            </div>
            
            {/* Category Select & Create */}
            <div className="bg-base-800 rounded-2xl p-5 border border-white/[0.06] space-y-4">
              <div>
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
                  {decks.map(deck => (
                    <option key={deck.id} value={deck.id}>{deck.name}</option>
                  ))}
                </select>
              </div>

              <div className="h-px bg-white/[0.06]" />

              <form onSubmit={handleCreateDeck} className="flex gap-2">
                <input
                  type="text"
                  value={newDeckName}
                  onChange={e => setNewDeckName(e.target.value)}
                  placeholder="Yeni liste adı (örn: YDS)"
                  className="input-base text-sm flex-1"
                />
                <button
                  type="submit"
                  disabled={creatingDeck || !newDeckName.trim()}
                  className="btn-ghost shrink-0 px-4 text-sm"
                >
                  {creatingDeck ? '...' : '+ Oluştur'}
                </button>
              </form>
            </div>

            {/* TAB CONTENT: History vs Standard Modes */}
            {activeTab === 'history' ? (
              <HistoryReviewPicker
                words={words}
                userId={user?.id}
                selectedCategory={selectedCategory}
                onStart={handleStartHistorySession}
              />
            ) : (
              <div className="space-y-4">
                {/* Shortcut banner to History Review */}
                <div
                  onClick={() => setActiveTab('history')}
                  className="bg-gradient-to-r from-primary-500/15 via-accent-500/15 to-transparent border border-primary-500/30 rounded-2xl p-4 flex items-center justify-between cursor-pointer hover:border-primary-400/60 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl group-hover:scale-110 transition-transform">🗓️</span>
                    <div>
                      <h4 className="text-sm font-bold text-white flex items-center gap-2">
                        Geçmiş Tekrarlarını Gün & Zorluğa Göre Seç
                        <span className="px-1.5 py-0.5 rounded-md text-[10px] bg-primary-500 text-white font-extrabold">
                          Dene
                        </span>
                      </h4>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Bugün, dün veya önceki hafta işaretlediğin Kolay/Orta/Zor kelimeleri filtrele
                      </p>
                    </div>
                  </div>
                  <span className="text-primary-400 text-sm font-bold shrink-0">Aç →</span>
                </div>

                <div className="space-y-3">
                  {MODE_OPTIONS.map(({ key, label, description, badge }) => {
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
                            <div className="flex items-center gap-2">
                              <p className={`font-semibold text-sm ${isSelected ? 'text-primary-300' : 'text-slate-200'}`}>
                                {label}
                              </p>
                              {badge && (
                                <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                                  {badge}
                                </span>
                              )}
                            </div>
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
                  onClick={handleStartStandardReview}
                  disabled={modeCounts[selectedMode] === 0}
                  className="btn-primary w-full mt-4 py-4 text-base"
                >
                  🚀 Tekrarı Başlat ({modeCounts[selectedMode] ?? 0} kelime)
                </button>
              </div>
            )}
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
          <p className="text-slate-400 text-sm mb-2">{totalReviewed} kelime tekrar edildi</p>
          {sessionInfo?.title && (
            <p className="text-primary-400 text-xs font-semibold mb-6">
              {sessionInfo.title}
            </p>
          )}

          {/* Result breakdown */}
          <div className="grid grid-cols-3 gap-3 mb-8">
            <ResultStat count={sessionResults.easy ?? 0} label="Kolay" cls="text-easy" bg="bg-easy/10 border-easy/20" emoji="😊" />
            <ResultStat count={sessionResults.medium ?? 0} label="Orta" cls="text-medium" bg="bg-medium/10 border-medium/20" emoji="🤔" />
            <ResultStat count={sessionResults.hard ?? 0} label="Zor" cls="text-hard" bg="bg-hard/10 border-hard/20" emoji="😰" />
          </div>

          {/* Progress message */}
          {sessionResults.easy > 0 && (
            <p className="text-slate-400 text-sm mb-6">
              🌟 {sessionResults.easy} kelime başarıyla tamamlandı.
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
              onClick={handleExitReview}
              className="btn-primary flex-1"
            >
              Yeni Oturum Seç
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Review Session ────────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto px-4 pt-2 pb-1 sm:py-3 flex flex-col justify-start">
      <Toast {...toast} onClose={clearToast} />

      {/* ── Header with session title & exit button ── */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold text-primary-300 bg-primary-500/10 px-2.5 py-1 rounded-lg border border-primary-500/20 truncate max-w-[80%]">
          {sessionInfo?.title || 'Tekrar Oturumu'}
        </span>
        <button
          type="button"
          onClick={handleExitReview}
          className="text-xs text-slate-400 hover:text-white px-2.5 py-1 rounded-lg hover:bg-white/10 transition-colors flex items-center gap-1 shrink-0"
          title="Tekrardan Çık"
        >
          <span>✕</span>
          <span>Çık</span>
        </button>
      </div>

      {/* ── Progress bar ── */}
      <div className="mb-2 sm:mb-3 animate-fade-up">
        <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
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
          onSkip={skip}
          onUpdateWord={updateWord}
          onDelete={() => setShowDeleteModal(true)}
        />
      )}

      {/* ── Delete Confirmation Modal ── */}
      {showDeleteModal && currentWord && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in"
          onClick={() => !deleting && setShowDeleteModal(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-base-900 border border-white/10 p-6 shadow-2xl space-y-4 text-center animate-scale-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-full bg-red-500/15 text-red-400 flex items-center justify-center mx-auto text-xl border border-red-500/20">
              🗑️
            </div>
            <div>
              <h3 className="text-lg font-bold text-white mb-1.5">Kelimeyi Sil</h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                <strong className="text-white font-semibold">"{currentWord.english_word}"</strong> kelimesini silmek istediğine emin misin?
              </p>
              <p className="text-xs text-slate-500 mt-2">
                Bu kelime kütüphanenden kalıcı olarak silinecektir.
              </p>
            </div>
            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-white/10 text-slate-300 hover:text-white hover:bg-white/5 font-semibold text-sm transition-colors disabled:opacity-50"
              >
                Vazgeç
              </button>
              <button
                type="button"
                id="btn-confirm-delete-flashcard"
                disabled={deleting}
                onClick={handleDeleteCurrentWord}
                className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 active:scale-95 text-white font-semibold text-sm transition-all shadow-lg shadow-red-500/20 disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {deleting ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Siliniyor...</span>
                  </>
                ) : (
                  <span>Evet, Sil</span>
                )}
              </button>
            </div>
          </div>
        </div>
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
