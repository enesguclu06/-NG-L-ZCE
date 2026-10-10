import { useState, useMemo } from 'react'
import {
  getLocalDateKey,
  getAllReviewHistory,
  getReviewDaysSummary,
  filterWordsByHistory,
  getDifficultyCountsForDate,
} from '../../lib/reviewHistory'
import { playAudio } from '../../lib/audio'

const PRESET_OPTIONS = [
  { key: 'today',      label: '⚡ Bugün',         desc: 'Bugün çalıştıkların' },
  { key: 'yesterday',  label: '⏪ Dün',           desc: 'Dün çalıştıkların' },
  { key: 'last7days',  label: '📅 Son 7 Gün',     desc: 'Son bir haftada çalışılanlar' },
  { key: 'prevWeek',   label: '🗓️ Önceki Hafta',  desc: '7-14 gün önceki tekrarlar' },
  { key: 'custom',     label: '📆 Belirli Gün',   desc: 'Takvimden tarih seç' },
]

export function HistoryReviewPicker({
  words,
  userId,
  selectedCategory,
  onStart,
}) {
  const [preset, setPreset] = useState('today')
  const [customDate, setCustomDate] = useState(() => getLocalDateKey(new Date()))
  // Multi-select for difficulty: default all three active, or user can toggle
  const [selectedDiffs, setSelectedDiffs] = useState(['easy', 'medium', 'hard'])
  const [showWordList, setShowWordList] = useState(false)
  const [searchFilter, setSearchFilter] = useState('')

  // 1. Get merged review history (localStorage + words.last_reviewed_at)
  const reviewHistory = useMemo(() => {
    return getAllReviewHistory(words, userId)
  }, [words, userId])

  // 2. Summary of days that actually have reviews
  const daysSummary = useMemo(() => {
    return getReviewDaysSummary(reviewHistory)
  }, [reviewHistory])

  // 3. Difficulty counts for the active date filter
  const diffCounts = useMemo(() => {
    return getDifficultyCountsForDate(reviewHistory, words, {
      preset,
      customDateKey: customDate,
      deckId: selectedCategory,
    })
  }, [reviewHistory, words, preset, customDate, selectedCategory])

  // 4. Matched words based on date + selected difficulties + deck
  const matchedWords = useMemo(() => {
    return filterWordsByHistory(reviewHistory, words, {
      preset,
      customDateKey: customDate,
      difficulties: selectedDiffs,
      deckId: selectedCategory,
    })
  }, [reviewHistory, words, preset, customDate, selectedDiffs, selectedCategory])

  // Filter preview words by local search query if user types
  const displayWords = useMemo(() => {
    if (!searchFilter.trim()) return matchedWords
    const q = searchFilter.toLowerCase().trim()
    return matchedWords.filter(w =>
      w.english_word?.toLowerCase().includes(q) ||
      w.turkish_translation?.toLowerCase().includes(q)
    )
  }, [matchedWords, searchFilter])

  // Toggle difficulty in array
  function toggleDifficulty(diff) {
    setSelectedDiffs(prev => {
      if (prev.includes(diff)) {
        if (prev.length === 1) return prev // Keep at least one selected
        return prev.filter(d => d !== diff)
      } else {
        return [...prev, diff]
      }
    })
  }

  // Quick preset difficulty helper
  function setDiffPreset(types) {
    setSelectedDiffs(types)
  }

  // Quick day select from summary chips
  function handleSelectDayChip(dateKey) {
    const todayKey = getLocalDateKey(new Date())
    const yDate = new Date()
    yDate.setDate(yDate.getDate() - 1)
    const yesterdayKey = getLocalDateKey(yDate)

    if (dateKey === todayKey) {
      setPreset('today')
    } else if (dateKey === yesterdayKey) {
      setPreset('yesterday')
    } else {
      setPreset('custom')
      setCustomDate(dateKey)
    }
  }

  // Handle start review session
  function handleLaunch() {
    if (matchedWords.length === 0) return

    let dateTitle = 'Bugün'
    if (preset === 'yesterday') dateTitle = 'Dün'
    else if (preset === 'last7days') dateTitle = 'Son 7 Gün'
    else if (preset === 'prevWeek') dateTitle = 'Önceki Hafta'
    else if (preset === 'custom') {
      const d = new Date(customDate)
      dateTitle = isNaN(d.getTime()) ? customDate : d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })
    }

    const diffLabels = []
    if (selectedDiffs.includes('easy')) diffLabels.push('Kolay')
    if (selectedDiffs.includes('medium')) diffLabels.push('Orta')
    if (selectedDiffs.includes('hard')) diffLabels.push('Zor')
    const diffTitle = diffLabels.length === 3 ? 'Tüm Zorluklar' : diffLabels.join(' + ')

    onStart(matchedWords, {
      title: `${dateTitle} (${diffTitle})`,
      preset,
      dateTitle,
      diffTitle,
    })
  }

  const todayStr = getLocalDateKey(new Date())

  return (
    <div className="space-y-5 animate-fade-up">
      {/* ── 1. Date Range Preset Buttons ── */}
      <div className="bg-base-800 rounded-2xl p-5 border border-white/[0.06] space-y-4">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            1. Tekrar Gününü / Aralığını Seç
          </label>
          <span className="text-xs text-primary-400 font-medium">
            Toplam {diffCounts.total} kelime bulundu
          </span>
        </div>

        {/* Preset Tabs */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {PRESET_OPTIONS.map(opt => {
            const isSelected = preset === opt.key
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => setPreset(opt.key)}
                className={`p-3 rounded-xl border text-left transition-all duration-200 ${
                  isSelected
                    ? 'border-primary-500 bg-primary-500/15 text-white shadow-glow-primary'
                    : 'border-white/[0.06] bg-base-900/40 text-slate-300 hover:border-white/20 hover:bg-base-700/50'
                }`}
              >
                <div className="font-bold text-sm flex items-center justify-between">
                  <span>{opt.label}</span>
                  {isSelected && <span className="w-2 h-2 rounded-full bg-primary-400 animate-pulse" />}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5 truncate">{opt.desc}</div>
              </button>
            )
          })}
        </div>

        {/* Custom Date Input (shown when preset === 'custom') */}
        {preset === 'custom' && (
          <div className="pt-2 animate-fade-in">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 bg-base-900/60 p-3.5 rounded-xl border border-white/[0.08]">
              <span className="text-sm text-slate-300 font-medium shrink-0">
                🗓️ Hangi günün tekrarlarını istiyorsun?
              </span>
              <input
                type="date"
                value={customDate}
                max={todayStr}
                onChange={e => setCustomDate(e.target.value)}
                className="input-base py-2 px-3 text-sm flex-1 bg-base-800 border-white/20"
              />
            </div>
          </div>
        )}

        {/* Past Active Review Days Timeline Chips */}
        {daysSummary.length > 0 && (
          <div className="pt-2">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
              💡 Tekrar Kaydı Bulunan Günler (Hızlı Seç):
            </div>
            <div className="flex flex-wrap gap-2">
              {daysSummary.slice(0, 8).map(d => {
                const isActive = (preset === 'today' && d.label === 'Bugün') ||
                  (preset === 'yesterday' && d.label === 'Dün') ||
                  (preset === 'custom' && customDate === d.dateKey)

                return (
                  <button
                    key={d.dateKey}
                    type="button"
                    onClick={() => handleSelectDayChip(d.dateKey)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all flex items-center gap-1.5 ${
                      isActive
                        ? 'bg-primary-500 text-white border-primary-400 shadow-sm'
                        : 'bg-base-900/70 text-slate-300 border-white/10 hover:border-white/30 hover:bg-base-700'
                    }`}
                  >
                    <span>{d.label}</span>
                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                      isActive ? 'bg-white/25 text-white' : 'bg-base-700 text-slate-400'
                    }`}>
                      {d.total}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── 2. Difficulty / Rating Filter ── */}
      <div className="bg-base-800 rounded-2xl p-5 border border-white/[0.06] space-y-4">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            2. Değerlendirme / Zorluk Filtresi
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setDiffPreset(['easy', 'medium'])}
              className="text-[11px] text-primary-400 hover:text-primary-300 underline font-medium"
            >
              Kolay + Orta
            </button>
            <span className="text-slate-600 text-xs">•</span>
            <button
              type="button"
              onClick={() => setDiffPreset(['easy', 'medium', 'hard'])}
              className="text-[11px] text-slate-400 hover:text-slate-200 underline font-medium"
            >
              Tümü
            </button>
          </div>
        </div>

        <p className="text-xs text-slate-400">
          O gün işaretlediğin puanlamalardan hangilerini tekrar etmek istiyorsun? (Çoklu seçim yapabilirsin)
        </p>

        {/* 3 Toggle Pills: Kolay, Orta, Zor */}
        <div className="grid grid-cols-3 gap-3">
          {/* Kolay */}
          <button
            type="button"
            onClick={() => toggleDifficulty('easy')}
            className={`p-3.5 rounded-xl border transition-all flex flex-col items-center justify-center gap-1 ${
              selectedDiffs.includes('easy')
                ? 'bg-easy/15 border-easy/50 text-easy shadow-sm scale-[1.02]'
                : 'bg-base-900/40 border-white/[0.06] text-slate-500 hover:border-white/20'
            }`}
          >
            <div className="flex items-center gap-1.5 font-bold text-sm">
              <span>🟢</span>
              <span>Kolay</span>
            </div>
            <span className={`text-xs font-black px-2 py-0.5 rounded-full ${
              selectedDiffs.includes('easy') ? 'bg-easy/20 text-easy' : 'bg-base-700 text-slate-500'
            }`}>
              {diffCounts.easy} kelime
            </span>
          </button>

          {/* Orta */}
          <button
            type="button"
            onClick={() => toggleDifficulty('medium')}
            className={`p-3.5 rounded-xl border transition-all flex flex-col items-center justify-center gap-1 ${
              selectedDiffs.includes('medium')
                ? 'bg-medium/15 border-medium/50 text-medium shadow-sm scale-[1.02]'
                : 'bg-base-900/40 border-white/[0.06] text-slate-500 hover:border-white/20'
            }`}
          >
            <div className="flex items-center gap-1.5 font-bold text-sm">
              <span>🟡</span>
              <span>Orta</span>
            </div>
            <span className={`text-xs font-black px-2 py-0.5 rounded-full ${
              selectedDiffs.includes('medium') ? 'bg-medium/20 text-medium' : 'bg-base-700 text-slate-500'
            }`}>
              {diffCounts.medium} kelime
            </span>
          </button>

          {/* Zor */}
          <button
            type="button"
            onClick={() => toggleDifficulty('hard')}
            className={`p-3.5 rounded-xl border transition-all flex flex-col items-center justify-center gap-1 ${
              selectedDiffs.includes('hard')
                ? 'bg-hard/15 border-hard/50 text-hard shadow-sm scale-[1.02]'
                : 'bg-base-900/40 border-white/[0.06] text-slate-500 hover:border-white/20'
            }`}
          >
            <div className="flex items-center gap-1.5 font-bold text-sm">
              <span>🔴</span>
              <span>Zor</span>
            </div>
            <span className={`text-xs font-black px-2 py-0.5 rounded-full ${
              selectedDiffs.includes('hard') ? 'bg-hard/20 text-hard' : 'bg-base-700 text-slate-500'
            }`}>
              {diffCounts.hard} kelime
            </span>
          </button>
        </div>
      </div>

      {/* ── 3. Preview Words Accordion ── */}
      {matchedWords.length > 0 && (
        <div className="bg-base-800 rounded-2xl border border-white/[0.06] overflow-hidden">
          <button
            type="button"
            onClick={() => setShowWordList(prev => !prev)}
            className="w-full p-4 flex items-center justify-between text-left hover:bg-white/[0.02] transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="text-base">📋</span>
              <span className="text-sm font-bold text-slate-200">
                Seçilen Kelimeleri İncele ({matchedWords.length})
              </span>
            </div>
            <span className="text-xs text-primary-400 font-semibold flex items-center gap-1">
              {showWordList ? 'Gizle ▲' : 'Listeyi Göster ▼'}
            </span>
          </button>

          {showWordList && (
            <div className="p-4 pt-0 border-t border-white/[0.06] space-y-3">
              <input
                type="text"
                value={searchFilter}
                onChange={e => setSearchFilter(e.target.value)}
                placeholder="Bu kelimeler içinde ara..."
                className="input-base text-xs py-2"
              />

              <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                {displayWords.map(w => {
                  const rating = w._historyMeta?.difficulty || w.difficulty
                  const ratingBadge = rating === 'easy'
                    ? { cls: 'badge-easy', label: 'Kolay', emoji: '🟢' }
                    : rating === 'medium'
                    ? { cls: 'badge-medium', label: 'Orta', emoji: '🟡' }
                    : { cls: 'badge-hard', label: 'Zor', emoji: '🔴' }

                  return (
                    <div
                      key={w.id}
                      className="bg-base-900/60 p-2.5 rounded-xl border border-white/[0.04] flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); playAudio(w.english_word) }}
                          className="text-primary-400 hover:text-primary-300 p-1 rounded-full hover:bg-primary-500/20 shrink-0"
                          title="Dinle"
                        >
                          🔊
                        </button>
                        <div className="truncate">
                          <span className="font-bold text-white text-sm mr-2">{w.english_word}</span>
                          <span className="text-slate-400">{w.turkish_translation}</span>
                        </div>
                      </div>

                      <span className={`px-2 py-0.5 rounded-md font-semibold text-[10px] shrink-0 ${ratingBadge.cls}`}>
                        {ratingBadge.emoji} {ratingBadge.label}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── 4. Launch Review Button ── */}
      <div className="pt-2">
        <button
          id="btn-start-history-review"
          type="button"
          onClick={handleLaunch}
          disabled={matchedWords.length === 0}
          className="btn-primary w-full py-4 text-base flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <span>🚀</span>
          <span>
            {matchedWords.length > 0
              ? `Bu Kelimeleri Tekrar Et (${matchedWords.length} kelime)`
              : 'Seçilen Kriterde Kelime Yok'}
          </span>
        </button>

        {matchedWords.length === 0 && (
          <p className="text-center text-xs text-slate-500 mt-2">
            💡 Seçtiğin gün ve zorluk derecesinde henüz tekrar yapılmış kelime bulunmuyor. Farklı bir gün veya filtre deneyebilirsin.
          </p>
        )}
      </div>
    </div>
  )
}
