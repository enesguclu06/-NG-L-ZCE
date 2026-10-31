import { useState, useEffect, useMemo } from 'react'
import { playAudio } from '../../lib/audio'
import { fetchCompletedSessions } from '../../lib/reviewSessions'

const DIFFICULTY_CONFIG = {
  unrated:  { label: 'Yeni',        cls: 'badge-unrated',  dot: '⚪' },
  hard:     { label: 'Zor',         cls: 'badge-hard',     dot: '🔴' },
  medium:   { label: 'Orta',        cls: 'badge-medium',   dot: '🟡' },
  easy:     { label: 'Kolay',       cls: 'badge-easy',     dot: '🟢' },
  mastered: { label: 'Ezberlendi',  cls: 'badge-mastered', dot: '🎓' },
}

function formatSessionDate(isoStr) {
  if (!isoStr) return ''
  const d = new Date(isoStr)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleString('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function CompletedSessionsView({
  userId,
  liveWords = [],
  onStartSession,
  onUpdateWord,
  showToast,
}) {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandedSessionId, setExpandedSessionId] = useState(null)
  const [updatingId, setUpdatingId] = useState(null)
  const [search, setSearch] = useState('')

  // Map of live words for quick lookup & live difficulty
  const liveWordsMap = useMemo(() => {
    return new Map(liveWords.map(w => [w.id, w]))
  }, [liveWords])

  async function loadSessions() {
    setLoading(true)
    try {
      const data = await fetchCompletedSessions(userId, liveWords)
      setSessions(data)
      if (data.length > 0 && !expandedSessionId) {
        setExpandedSessionId(data[0].id) // expand newest session by default
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSessions()
  }, [userId, liveWords.length])

  // Filter sessions by search text if user typed
  const filteredSessions = useMemo(() => {
    if (!search.trim()) return sessions
    const q = search.trim().toLowerCase()
    return sessions.filter(sess => {
      if ((sess.title || '').toLowerCase().includes(q)) return true
      return (sess.words || []).some(w =>
        (w.english_word || '').toLowerCase().includes(q) ||
        (w.turkish_translation || '').toLowerCase().includes(q)
      )
    })
  }, [sessions, search])

  // Launch flashcard review with all words in this session
  function handleRepeatSession(sess, onlyHardMedium = false) {
    if (!sess.words || sess.words.length === 0) return

    let selectedList = sess.words.map(sw => {
      return liveWordsMap.get(sw.id || sw.word_id) || sw
    })

    if (onlyHardMedium) {
      selectedList = selectedList.filter(w => {
        const diff = w.difficulty || w.new_difficulty || 'medium'
        return diff === 'hard' || diff === 'medium'
      })
    }

    if (selectedList.length === 0) {
      if (showToast) showToast('Bu oturumda seçilen kritere uygun kelime kalmadı.', 'info')
      return
    }

    const titleSuffix = onlyHardMedium ? ' (Sadece Zor + Orta)' : ''
    onStartSession(selectedList, {
      title: `Oturum Tekrarı: ${sess.title}${titleSuffix}`,
      mode: 'session_repeat',
    })
  }

  // Change word difficulty directly
  async function handleChangeDifficulty(wordId, newDiff, englishWord) {
    if (updatingId || !onUpdateWord) return
    setUpdatingId(wordId)
    try {
      const nowIso = new Date().toISOString()
      const updates = { difficulty: newDiff, last_reviewed_at: nowIso }
      if (newDiff === 'mastered') {
        const next = new Date()
        next.setDate(next.getDate() + 365)
        updates.next_review_at = next.toISOString()
        updates.interval_days = 365
      }
      await onUpdateWord(wordId, updates)
      if (showToast) {
        const label = DIFFICULTY_CONFIG[newDiff]?.label || newDiff
        showToast(`"${englishWord}" zorluğu "${label}" yapıldı!`, 'success')
      }
    } catch (e) {
      if (showToast) showToast('Güncelleme hatası: ' + e.message, 'error')
    } finally {
      setUpdatingId(null)
    }
  }

  if (loading) {
    return (
      <div className="text-center py-12 text-slate-400 animate-fade-in">
        <span className="text-3xl animate-spin inline-block">⏳</span>
        <p className="text-xs mt-2 font-medium">Oturum geçmişi yükleniyor...</p>
      </div>
    )
  }

  return (
    <div className="space-y-4 animate-fade-up">
      {/* ── Top Header & Stats ── */}
      <div className="bg-base-800 rounded-2xl p-4 sm:p-5 border border-white/[0.06] space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
              <span>🗂️</span>
              <span>Tamamlanan Tekrar Oturumları</span>
              <span className="px-2 py-0.5 rounded-full text-xs bg-primary-500/20 text-primary-300 font-bold border border-primary-500/30">
                {sessions.length} Oturum
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Her flashcard çalışması bittiğinde ayrı bir oturum olarak saklanır. İstediğin oturumu yeniden çalışabilirsin!
            </p>
          </div>

          {/* Quick Refresh */}
          <button
            type="button"
            onClick={loadSessions}
            className="self-start sm:self-center px-3 py-1.5 rounded-xl bg-base-900/80 hover:bg-base-700 text-slate-300 border border-white/10 text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <span>🔄</span>
            <span>Yenile</span>
          </button>
        </div>

        {/* Search inside sessions */}
        {sessions.length > 0 && (
          <div className="relative pt-1">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔍</span>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Oturum başlığı veya kelime ara..."
              className="input-base text-xs pl-10 w-full"
            />
          </div>
        )}
      </div>

      {/* ── Sessions List ── */}
      {filteredSessions.length === 0 ? (
        <div className="text-center py-12 px-4 rounded-2xl bg-base-800/50 border border-white/[0.04]">
          <span className="text-4xl">📭</span>
          <h4 className="text-base font-bold text-white mt-3">Kayıtlı Oturum Bulunamadı</h4>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            {search
              ? 'Aramanıza uygun oturum veya kelime bulunamadı.'
              : 'Henüz flashcard ile bir oturumu sonuna kadar tamamlamadınız. Bir oturumu bitirdiğinizde tebrik ekranıyla birlikte buraya kaydedilecektir.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3.5">
          {filteredSessions.map((sess, idx) => {
            const isExpanded = expandedSessionId === sess.id
            const res = sess.results || { hard: 0, medium: 0, easy: 0, mastered: 0 }
            const total = sess.total_reviewed || (sess.words ? sess.words.length : 0)

            return (
              <div
                key={sess.id || idx}
                className={`bg-base-800/90 rounded-2xl border transition-all duration-200 overflow-hidden shadow-sm ${
                  isExpanded ? 'border-primary-500/50 shadow-glow-primary/10' : 'border-white/[0.06] hover:border-white/15'
                }`}
              >
                {/* ── Session Header Card (Duolingo / Result Summary Style) ── */}
                <div
                  onClick={() => setExpandedSessionId(isExpanded ? null : sess.id)}
                  className="p-4 sm:p-5 cursor-pointer select-none space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary-500/20 to-accent-500/20 border border-primary-500/30 flex items-center justify-center text-xl shrink-0">
                        🎉
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm sm:text-base font-black text-white truncate">
                            {sess.title || 'Tekrar Oturumu'}
                          </h4>
                          {sess.is_synthesized && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] bg-slate-700 text-slate-300">
                              Geçmiş Senkronu
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1.5 flex-wrap">
                          <span>📅 {formatSessionDate(sess.created_at)}</span>
                          <span>•</span>
                          <span className="font-bold text-primary-300">{total} kelime tekrar edildi</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
                      <span className="text-xs text-primary-400 font-semibold hidden xs:inline">
                        {isExpanded ? 'Kelimeleri Gizle ▲' : 'Kelimeleri Gör ▼'}
                      </span>
                    </div>
                  </div>

                  {/* 4 Score Badges (Ekran görüntündeki kutular gibi) */}
                  <div className="grid grid-cols-4 gap-1.5 sm:gap-2 pt-1">
                    <div className="bg-hard/10 border border-hard/20 rounded-xl p-2 text-center">
                      <div className="text-sm sm:text-base font-black text-hard flex items-center justify-center gap-1">
                        <span>😰</span>
                        <span>{res.hard ?? 0}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-semibold block mt-0.5">Zor</span>
                    </div>
                    <div className="bg-medium/10 border border-medium/20 rounded-xl p-2 text-center">
                      <div className="text-sm sm:text-base font-black text-medium flex items-center justify-center gap-1">
                        <span>🤔</span>
                        <span>{res.medium ?? 0}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-semibold block mt-0.5">Orta</span>
                    </div>
                    <div className="bg-easy/10 border border-easy/20 rounded-xl p-2 text-center">
                      <div className="text-sm sm:text-base font-black text-easy flex items-center justify-center gap-1">
                        <span>😊</span>
                        <span>{res.easy ?? 0}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-semibold block mt-0.5">Kolay</span>
                    </div>
                    <div className="bg-sky-500/10 border border-sky-500/20 rounded-xl p-2 text-center">
                      <div className="text-sm sm:text-base font-black text-sky-400 flex items-center justify-center gap-1">
                        <span>🎓</span>
                        <span>{res.mastered ?? 0}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-semibold block mt-0.5">Ezberledim</span>
                    </div>
                  </div>

                  {/* ── Repeat Actions ── */}
                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/[0.05]" onClick={e => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => handleRepeatSession(sess, false)}
                      className="btn-primary py-2 px-3.5 text-xs font-bold flex items-center gap-1.5"
                    >
                      <span>🔄</span>
                      <span>Bu Oturumu Tekrar Et ({total})</span>
                    </button>

                    {(res.hard > 0 || res.medium > 0) && (
                      <button
                        type="button"
                        onClick={() => handleRepeatSession(sess, true)}
                        className="py-2 px-3.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-xs font-bold flex items-center gap-1.5 transition-colors"
                      >
                        <span>🔴🟡</span>
                        <span>Sadece Zor + Ortaları Çalış ({(res.hard ?? 0) + (res.medium ?? 0)})</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* ── Words Detail Accordion ── */}
                {isExpanded && (
                  <div className="border-t border-white/[0.08] bg-base-900/60 p-4 space-y-2.5 animate-fade-in">
                    <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                      <span className="font-semibold text-slate-300">
                        📋 Bu Oturumda Çalışılan Kelimeler ({sess.words?.length || 0}):
                      </span>
                      <span>Sağdan zorluğunu değiştirebilirsin</span>
                    </div>

                    <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                      {(sess.words || []).map((w, wIdx) => {
                        const liveWord = liveWordsMap.get(w.id || w.word_id) || w
                        const currDiff = liveWord.difficulty || w.new_difficulty || 'medium'
                        const prevDiff = w.previous_difficulty || 'unrated'
                        const currCfg = DIFFICULTY_CONFIG[currDiff] || DIFFICULTY_CONFIG.medium
                        const prevCfg = DIFFICULTY_CONFIG[prevDiff] || DIFFICULTY_CONFIG.unrated

                        return (
                          <div
                            key={w.id || w.word_id || wIdx}
                            className="bg-base-800/80 p-3 rounded-xl border border-white/[0.05] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs"
                          >
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <button
                                type="button"
                                onClick={() => playAudio(w.english_word)}
                                className="text-slate-400 hover:text-primary-300 p-1 rounded-md hover:bg-primary-500/10 shrink-0"
                                title="Dinle"
                              >
                                🔊
                              </button>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-baseline gap-2 flex-wrap">
                                  <span className="font-bold text-white text-sm">{w.english_word}</span>
                                  <span className="text-slate-400 text-xs truncate">— {w.turkish_translation}</span>
                                </div>
                                <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-1">
                                  <span className="opacity-70">Oturum Değişimi:</span>
                                  {prevDiff !== currDiff && prevDiff !== 'unrated' ? (
                                    <>
                                      <span className="line-through text-slate-500">{prevCfg.dot} {prevCfg.label}</span>
                                      <span>➔</span>
                                      <span className="font-bold text-white">{currCfg.dot} {currCfg.label}</span>
                                    </>
                                  ) : (
                                    <span className="font-semibold text-white">{currCfg.dot} {currCfg.label}</span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Inline difficulty switcher */}
                            <div className="shrink-0 flex items-center gap-1 self-end sm:self-center bg-base-900/90 p-1 rounded-lg border border-white/5">
                              {['hard', 'medium', 'easy', 'mastered'].map(dKey => {
                                const c = DIFFICULTY_CONFIG[dKey]
                                const isSelected = currDiff === dKey
                                return (
                                  <button
                                    key={dKey}
                                    type="button"
                                    disabled={updatingId === (w.id || w.word_id)}
                                    onClick={() => handleChangeDifficulty(w.id || w.word_id, dKey, w.english_word)}
                                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-all ${
                                      isSelected
                                        ? dKey === 'hard' ? 'bg-red-500 text-white' :
                                          dKey === 'medium' ? 'bg-amber-500 text-white' :
                                          dKey === 'easy' ? 'bg-emerald-500 text-white' : 'bg-purple-600 text-white'
                                        : 'text-slate-400 hover:text-white'
                                    }`}
                                  >
                                    {c.dot} {c.label}
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
