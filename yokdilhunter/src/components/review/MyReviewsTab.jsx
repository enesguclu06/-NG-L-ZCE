import { useState, useMemo } from 'react'
import { playAudio } from '../../lib/audio'
import { recordReviewLog } from '../../lib/reviewHistory'

const DIFFICULTY_MAP = {
  unrated:  { label: 'Yeni',        cls: 'badge-unrated',  dot: '⚪' },
  hard:     { label: 'Zor',         cls: 'badge-hard',     dot: '🔴' },
  medium:   { label: 'Orta',        cls: 'badge-medium',   dot: '🟡' },
  easy:     { label: 'Kolay',       cls: 'badge-easy',     dot: '🟢' },
  mastered: { label: 'Ezberlendi',  cls: 'badge-mastered', dot: '🎓' },
}

function formatDateDisplay(isoStr) {
  if (!isoStr) return ''
  const d = new Date(isoStr)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleString('tr-TR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function MyReviewsTab({ words = [], userId, onUpdateWord, showToast }) {
  const [search, setSearch] = useState('')
  const [filterDiff, setFilterDiff] = useState('all') // 'all' | difficulty
  const [sortOrder, setSortOrder] = useState('latest') // 'latest' | 'count_desc' | 'alphabetical'
  const [updatingId, setUpdatingId] = useState(null)

  // 1. Get raw logs from localStorage
  const logs = useMemo(() => {
    try {
      const storageKey = `yokdil_review_logs_${userId || 'guest'}`
      const raw = localStorage.getItem(storageKey)
      return raw ? JSON.parse(raw) : []
    } catch {
      return []
    }
  }, [userId])

  // 2. Build map of words for quick lookup & synthesize logs if local logs are empty
  const wordMap = useMemo(() => {
    const map = new Map()
    for (const w of words) {
      map.set(w.id, w)
    }
    return map
  }, [words])

  // 3. Aggregate review stats per word
  const reviewStats = useMemo(() => {
    const statsByWordId = new Map()

    // Process stored log events
    for (const entry of logs) {
      if (!entry.word_id) continue
      if (!statsByWordId.has(entry.word_id)) {
        statsByWordId.set(entry.word_id, {
          word_id: entry.word_id,
          english_word: entry.english_word,
          turkish_translation: entry.turkish_translation,
          history: [],
          localCount: 0,
        })
      }
      const st = statsByWordId.get(entry.word_id)
      st.history.push(entry)
      st.localCount++
    }

    // Process all current words: if a word has review_count > 0 or last_reviewed_at, ensure it appears
    for (const w of words) {
      if (!statsByWordId.has(w.id)) {
        if ((w.review_count && w.review_count > 0) || w.last_reviewed_at) {
          statsByWordId.set(w.id, {
            word_id: w.id,
            english_word: w.english_word,
            turkish_translation: w.turkish_translation,
            history: [],
            localCount: 0,
          })
        }
      }
    }

    const items = []
    for (const [wordId, st] of statsByWordId.entries()) {
      const liveWord = wordMap.get(wordId)
      // If deleted from live database, skip
      if (!liveWord) continue

      // Calculate total review count: prefer max of live review_count and local logged events
      const totalReviews = Math.max(liveWord.review_count || 0, st.localCount || 1)
      
      // Determine transitions: latest logged event
      const latestLog = st.history[0] || null
      const secondLatestLog = st.history[1] || null

      let prevDiff = 'unrated'
      let currentDiff = liveWord.difficulty || 'unrated'

      if (latestLog?.previous_difficulty) {
        prevDiff = latestLog.previous_difficulty
      } else if (secondLatestLog?.difficulty) {
        prevDiff = secondLatestLog.difficulty
      } else if (liveWord.difficulty && totalReviews > 0) {
        // Fallback reasonable previous state
        prevDiff = 'unrated'
      }

      // Latest reviewed timestamp
      const lastReviewedAt = latestLog?.reviewed_at || liveWord.last_reviewed_at || liveWord.created_at

      items.push({
        word: liveWord,
        word_id: wordId,
        english_word: liveWord.english_word,
        turkish_translation: liveWord.turkish_translation,
        previous_difficulty: prevDiff,
        current_difficulty: currentDiff,
        review_count: totalReviews,
        last_reviewed_at: lastReviewedAt,
        history: st.history,
      })
    }

    return items
  }, [logs, words, wordMap])

  // 4. Filtering & Searching
  const filteredItems = useMemo(() => {
    return reviewStats.filter(item => {
      // Diff filter
      if (filterDiff !== 'all' && item.current_difficulty !== filterDiff) {
        return false
      }
      // Search filter
      if (search.trim()) {
        const q = search.trim().toLowerCase()
        const eng = (item.english_word || '').toLowerCase()
        const tr = (item.turkish_translation || '').toLowerCase()
        if (!eng.includes(q) && !tr.includes(q)) return false
      }
      return true
    })
  }, [reviewStats, filterDiff, search])

  // 5. Sorting
  const sortedItems = useMemo(() => {
    const list = [...filteredItems]
    if (sortOrder === 'latest') {
      list.sort((a, b) => new Date(b.last_reviewed_at || 0) - new Date(a.last_reviewed_at || 0))
    } else if (sortOrder === 'count_desc') {
      list.sort((a, b) => b.review_count - a.review_count)
    } else if (sortOrder === 'alphabetical') {
      list.sort((a, b) => (a.english_word || '').localeCompare(b.english_word || ''))
    }
    return list
  }, [filteredItems, sortOrder])

  // Quick difficulty change directly from MyReviewsTab
  async function handleChangeDifficulty(item, newDiff) {
    if (item.current_difficulty === newDiff || updatingId) return
    setUpdatingId(item.word_id)
    try {
      const oldDiff = item.current_difficulty
      const nowIso = new Date().toISOString()
      const updates = {
        difficulty: newDiff,
        last_reviewed_at: nowIso,
      }
      if (newDiff === 'mastered') {
        const next = new Date()
        next.setDate(next.getDate() + 365)
        updates.next_review_at = next.toISOString()
        updates.interval_days = 365
      }

      await onUpdateWord(item.word_id, updates)
      recordReviewLog(userId, item.word, newDiff, oldDiff)
      if (showToast) {
        const targetLabel = DIFFICULTY_MAP[newDiff]?.label || newDiff
        showToast(`"${item.english_word}" zorluğu "${targetLabel}" olarak güncellendi!`, 'success')
      }
    } catch (err) {
      if (showToast) showToast('Güncelleme hatası: ' + err.message, 'error')
    } finally {
      setUpdatingId(null)
    }
  }

  return (
    <div className="space-y-4 animate-fade-up">
      {/* ── Top Summary Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="bg-base-800/80 border border-white/[0.06] rounded-2xl p-3.5 text-center">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Tekrar Edilen</p>
          <p className="text-2xl font-black text-white mt-1">{reviewStats.length} <span className="text-xs font-normal text-slate-400">kelime</span></p>
        </div>
        <div className="bg-base-800/80 border border-white/[0.06] rounded-2xl p-3.5 text-center">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Toplam Tekrar</p>
          <p className="text-2xl font-black text-primary-400 mt-1">
            {reviewStats.reduce((sum, item) => sum + item.review_count, 0)} <span className="text-xs font-normal text-slate-400">kez</span>
          </p>
        </div>
        <div className="bg-base-800/80 border border-white/[0.06] rounded-2xl p-3.5 text-center">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Ezberlenen</p>
          <p className="text-2xl font-black text-emerald-400 mt-1">
            {reviewStats.filter(i => i.current_difficulty === 'mastered').length} <span className="text-xs font-normal text-slate-400">kelime</span>
          </p>
        </div>
        <div className="bg-base-800/80 border border-white/[0.06] rounded-2xl p-3.5 text-center">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Çalışılan Zor/Orta</p>
          <p className="text-2xl font-black text-amber-400 mt-1">
            {reviewStats.filter(i => i.current_difficulty === 'hard' || i.current_difficulty === 'medium').length} <span className="text-xs font-normal text-slate-400">kelime</span>
          </p>
        </div>
      </div>

      {/* ── Controls: Search, Difficulty Filter & Sort ── */}
      <div className="bg-base-800 rounded-2xl p-4 border border-white/[0.06] space-y-3">
        {/* Search Input */}
        <div className="relative">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔍</span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tekrarlanan kelimelerde ara..."
            className="input-base text-sm pl-10 w-full"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs px-1.5 py-0.5 rounded"
            >
              Temizle
            </button>
          )}
        </div>

        {/* Filters and Sorting */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          {/* Difficulty pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setFilterDiff('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                filterDiff === 'all'
                  ? 'bg-primary-500 text-white shadow-glow-primary'
                  : 'bg-base-900/60 text-slate-400 hover:text-white border border-white/5'
              }`}
            >
              Tümü ({reviewStats.length})
            </button>
            {['hard', 'medium', 'easy', 'mastered'].map(dKey => {
              const cfg = DIFFICULTY_MAP[dKey]
              const count = reviewStats.filter(i => i.current_difficulty === dKey).length
              return (
                <button
                  key={dKey}
                  onClick={() => setFilterDiff(dKey)}
                  className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
                    filterDiff === dKey
                      ? 'bg-white/20 text-white border border-white/30'
                      : 'bg-base-900/60 text-slate-400 hover:text-white border border-white/5'
                  }`}
                >
                  <span>{cfg.dot}</span>
                  <span>{cfg.label}</span>
                  <span className="opacity-60 text-[10px]">({count})</span>
                </button>
              )
            })}
          </div>

          {/* Sort Selector */}
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <span>Sırala:</span>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              className="bg-base-900 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 border border-white/10 focus:outline-none focus:border-primary-500"
            >
              <option value="latest">En Son Tekrar Edilen</option>
              <option value="count_desc">En Çok Tekrar Edilen</option>
              <option value="alphabetical">Alfabetik (A-Z)</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── Word List ── */}
      {sortedItems.length === 0 ? (
        <div className="text-center py-12 px-4 rounded-2xl bg-base-800/50 border border-white/[0.04]">
          <span className="text-4xl">📚</span>
          <h4 className="text-base font-bold text-white mt-3">Kayıt Bulunamadı</h4>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            {search || filterDiff !== 'all'
              ? 'Seçtiğiniz filtrelere uygun tekrar kaydı bulunamadı.'
              : 'Henüz flashcard ile tekrar yapmadınız. "Akıllı Modlar"dan bir oturum başlatıp kelimeleri çalıştığınızda tüm geçmişiniz burada listelenecek.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between text-xs text-slate-400 px-1">
            <span>{sortedItems.length} kelime listeleniyor</span>
            <span>Sağdaki butonlarla anında zorluk değiştirebilirsin</span>
          </div>

          {sortedItems.map((item) => {
            const prevCfg = DIFFICULTY_MAP[item.previous_difficulty] || DIFFICULTY_MAP.unrated
            const currCfg = DIFFICULTY_MAP[item.current_difficulty] || DIFFICULTY_MAP.unrated
            const isChanged = item.previous_difficulty !== item.current_difficulty && item.previous_difficulty !== 'unrated'

            return (
              <div
                key={item.word_id}
                className="bg-base-800/90 hover:bg-base-800 border border-white/[0.06] hover:border-white/15 rounded-2xl p-4 transition-all shadow-sm group"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  {/* Left: Word Info & Transition info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-base sm:text-lg font-black text-white tracking-wide">
                        {item.english_word}
                      </span>
                      <button
                        onClick={() => playAudio(item.english_word)}
                        className="text-slate-400 hover:text-primary-300 p-1 rounded-md hover:bg-primary-500/10 transition-colors"
                        title="Dinle"
                      >
                        🔊
                      </button>
                      <span className="text-slate-400 text-sm font-medium">
                        — {item.turkish_translation}
                      </span>
                    </div>

                    {/* Metadata & Status transition */}
                    <div className="flex items-center gap-2 flex-wrap text-xs text-slate-400 mt-2">
                      {/* Repeat badge */}
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-primary-500/15 text-primary-300 font-bold border border-primary-500/25">
                        <span>🔄</span>
                        <span>{item.review_count} tekrar</span>
                      </span>

                      {/* Difficulty Transition Badge */}
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-base-900/80 border border-white/10 text-slate-300">
                        <span className="opacity-60 text-[11px]">Durum:</span>
                        {item.previous_difficulty && item.previous_difficulty !== item.current_difficulty ? (
                          <>
                            <span className="text-slate-400 line-through text-[11px]">
                              {prevCfg.dot} {prevCfg.label}
                            </span>
                            <span className="text-primary-400 font-bold">➔</span>
                            <span className="font-bold text-white">
                              {currCfg.dot} {currCfg.label}
                            </span>
                          </>
                        ) : (
                          <span className="font-semibold text-white">
                            {currCfg.dot} {currCfg.label}
                          </span>
                        )}
                      </div>

                      {/* Date */}
                      {item.last_reviewed_at && (
                        <span className="text-[11px] text-slate-500 ml-auto sm:ml-0">
                          🕒 {formatDateDisplay(item.last_reviewed_at)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right: Quick Difficulty Switcher Buttons */}
                  <div className="shrink-0 flex items-center gap-1 self-start sm:self-center bg-base-900/90 p-1 rounded-xl border border-white/10">
                    <span className="text-[10px] text-slate-400 font-semibold px-1.5 hidden md:inline">
                      Zorluk:
                    </span>
                    <button
                      type="button"
                      disabled={updatingId === item.word_id}
                      onClick={() => handleChangeDifficulty(item, 'hard')}
                      className={`px-2 py-1 rounded-lg text-xs font-bold transition-all ${
                        item.current_difficulty === 'hard'
                          ? 'bg-red-500 text-white shadow-sm'
                          : 'text-slate-400 hover:text-red-300 hover:bg-red-500/10'
                      }`}
                      title="Zor olarak ayarla"
                    >
                      🔴 Zor
                    </button>
                    <button
                      type="button"
                      disabled={updatingId === item.word_id}
                      onClick={() => handleChangeDifficulty(item, 'medium')}
                      className={`px-2 py-1 rounded-lg text-xs font-bold transition-all ${
                        item.current_difficulty === 'medium'
                          ? 'bg-amber-500 text-white shadow-sm'
                          : 'text-slate-400 hover:text-amber-300 hover:bg-amber-500/10'
                      }`}
                      title="Orta olarak ayarla"
                    >
                      🟡 Orta
                    </button>
                    <button
                      type="button"
                      disabled={updatingId === item.word_id}
                      onClick={() => handleChangeDifficulty(item, 'easy')}
                      className={`px-2 py-1 rounded-lg text-xs font-bold transition-all ${
                        item.current_difficulty === 'easy'
                          ? 'bg-emerald-500 text-white shadow-sm'
                          : 'text-slate-400 hover:text-emerald-300 hover:bg-emerald-500/10'
                      }`}
                      title="Kolay olarak ayarla"
                    >
                      🟢 Kolay
                    </button>
                    <button
                      type="button"
                      disabled={updatingId === item.word_id}
                      onClick={() => handleChangeDifficulty(item, 'mastered')}
                      className={`px-2 py-1 rounded-lg text-xs font-bold transition-all ${
                        item.current_difficulty === 'mastered'
                          ? 'bg-purple-600 text-white shadow-sm'
                          : 'text-slate-400 hover:text-purple-300 hover:bg-purple-500/10'
                      }`}
                      title="Ezberlendi olarak ayarla"
                    >
                      🎓 Ezberlendi
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
