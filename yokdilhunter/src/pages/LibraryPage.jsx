import { useState, useEffect, useMemo } from 'react'
import { useWords } from '../hooks/useWords'
import { useDecks } from '../hooks/useDecks'
import { WordCard } from '../components/words/WordCard'
import { Toast, useToast } from '../components/Toast'

const DIFFICULTY_FILTERS = [
  { key: 'all', label: 'Tümü' },
  { key: 'unrated', label: '⬤ Değerlendirilmemiş' },
  { key: 'easy', label: '⬤ Kolay' },
  { key: 'medium', label: '⬤ Orta' },
  { key: 'hard', label: '⬤ Zor' },
  { key: 'mastered', label: '🎓 Ezberledim' },
]

export default function LibraryPage() {
  const { words, loading: wordsLoading, error, fetchWords, deleteWord, updateWord } = useWords()
  const { decks, fetchDecks, loading: decksLoading } = useDecks()
  const [search, setSearch] = useState('')
  const [diffFilter, setDiffFilter] = useState('all')
  const [catFilter, setCatFilter] = useState('all') // Actually deck_id filter
  const [sortBy, setSortBy] = useState(() => {
    try {
      return localStorage.getItem('ydh_library_sort') || 'newest'
    } catch {
      return 'newest'
    }
  })
  const { toast, showToast, clearToast } = useToast()

  const loading = wordsLoading || decksLoading

  useEffect(() => {
    fetchWords()
    fetchDecks()
  }, [fetchWords, fetchDecks])

  const handleSortChange = (newSort) => {
    setSortBy(newSort)
    try {
      localStorage.setItem('ydh_library_sort', newSort)
    } catch { }
  }

  // ── Client-side filtering & sorting ────────────────────────────
  const filtered = useMemo(() => {
    let list = [...words]
    if (diffFilter !== 'all') {
      list = list.filter(w => w.difficulty === diffFilter)
    }
    if (catFilter !== 'all') {
      if (catFilter === 'none') {
        list = list.filter(w => !w.deck_id)
      } else {
        list = list.filter(w => w.deck_id === catFilter)
      }
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(w =>
        w.english_word?.toLowerCase().includes(q) ||
        w.turkish_translation?.toLowerCase().includes(q) ||
        (w.synonyms ?? []).some(s => s.toLowerCase().includes(q))
      )
    }

    const diffWeight = { hard: 4, medium: 3, easy: 2, mastered: 1, unrated: 0 }

    list.sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return new Date(b.created_at || 0) - new Date(a.created_at || 0)
        case 'oldest':
          return new Date(a.created_at || 0) - new Date(b.created_at || 0)
        case 'most_reviewed':
          return ((b.review_count ?? 0) - (a.review_count ?? 0)) ||
            (new Date(b.created_at || 0) - new Date(a.created_at || 0))
        case 'least_reviewed':
          return ((a.review_count ?? 0) - (b.review_count ?? 0)) ||
            (new Date(b.created_at || 0) - new Date(a.created_at || 0))
        case 'alpha_asc':
          return (a.english_word || '').localeCompare(b.english_word || '', 'en', { sensitivity: 'base' })
        case 'alpha_desc':
          return (b.english_word || '').localeCompare(a.english_word || '', 'en', { sensitivity: 'base' })
        case 'difficulty_desc':
          return ((diffWeight[b.difficulty] ?? 0) - (diffWeight[a.difficulty] ?? 0)) ||
            (new Date(b.created_at || 0) - new Date(a.created_at || 0))
        case 'difficulty_asc':
          return ((diffWeight[a.difficulty] ?? 0) - (diffWeight[b.difficulty] ?? 0)) ||
            (new Date(b.created_at || 0) - new Date(a.created_at || 0))
        default:
          return new Date(b.created_at || 0) - new Date(a.created_at || 0)
      }
    })

    return list
  }, [words, search, diffFilter, catFilter, sortBy])

  // We don't need uniqueCategories anymore, we have decks array.

  async function handleDelete(id) {
    try {
      await deleteWord(id)
      showToast('Kelime silindi.', 'info')
    } catch (e) {
      showToast(e.message, 'error')
    }
  }

  async function handleUpdate(id, updates) {
    try {
      await updateWord(id, updates)
      showToast('Kaydedildi!', 'success')
    } catch (e) {
      showToast(e.message, 'error')
      throw e
    }
  }

  // ── CSV Dışa Aktar ─────────────────────────────────────────────
  function handleExportCSV() {
    if (words.length === 0) {
      showToast('Dışa aktarılacak kelime yok.', 'info')
      return
    }

    const headers = ['İngilizce Kelime', 'Türkçe Çeviri', 'Tanım', 'Eş Anlamlılar', 'Okunuş', 'Zorluk', 'Liste']

    const rows = words.map(w => {
      const escape = (str) => `"${(str || '').toString().replace(/"/g, '""')}"`
      return [
        escape(w.english_word),
        escape(w.turkish_translation),
        escape(w.definition),
        escape((w.synonyms || []).join(', ')),
        escape(w.phonetic),
        escape(w.difficulty),
        escape(w.decks?.name || 'Kategorisiz')
      ].join(',')
    })

    const csvContent = "\uFEFF" + [headers.join(','), ...rows].join('\n') // Added BOM for Excel UTF-8 support
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)

    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', `yokdilhunter_kelimeler_${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    showToast('Kelimeler CSV olarak indirildi!', 'success')
  }

  // Counts per difficulty for badges
  const counts = useMemo(() => {
    return words.reduce((acc, w) => {
      acc[w.difficulty] = (acc[w.difficulty] ?? 0) + 1
      return acc
    }, {})
  }, [words])

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <Toast {...toast} onClose={clearToast} />

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-5 animate-fade-up">
        <div>
          <h2 className="text-2xl font-black text-white">Kütüphane</h2>
          <p className="text-slate-400 text-sm mt-0.5">{words.length} kelime kayıtlı</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleExportCSV}
            className="p-2 rounded-xl bg-base-800 border border-white/[0.06] text-slate-400 hover:text-white hover:bg-base-700 transition-colors"
            title="CSV Olarak İndir"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
          </button>
          <div className="text-3xl">📚</div>
        </div>
      </div>

      {/* ── Search ── */}
      <div className="relative mb-4 animate-fade-up">
        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
        </svg>
        <input
          id="input-library-search"
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="input-base !pl-11"
          placeholder="Kelime, çeviri veya eş anlamlı ara..."
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white p-1"
          >
            ✕
          </button>
        )}
      </div>

      {/* ── Controls: Deck Filter & Sort By ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-4 animate-fade-up">
        {/* Category / Deck Filter */}
        <div className="relative">
          <div className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
            📁
          </div>
          <select
            id="select-library-deck"
            value={catFilter}
            onChange={e => setCatFilter(e.target.value)}
            className="input-base cursor-pointer appearance-none text-xs sm:text-sm py-2.5 pl-10 pr-8"
          >
            <option value="all">   Tüm Listeler ({words.length})</option>
            <option value="none">Genel (Kategorisiz)</option>
            {decks.map(deck => (
              <option key={deck.id} value={deck.id}>{deck.name}</option>
            ))}
          </select>
          <div className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 text-xs">
            ▼
          </div>
        </div>

        {/* Sort By Dropdown */}
        <div className="relative">
          <div className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
            ↕️
          </div>
          <select
            id="select-library-sort"
            value={sortBy}
            onChange={e => handleSortChange(e.target.value)}
            className="input-base cursor-pointer appearance-none text-xs sm:text-sm py-2.5 pl-10 pr-8 font-medium text-slate-200"
          >
            <option value="newest">✨ En Yeni Eklenen</option>
            <option value="oldest">⏳ En Eski Eklenen</option>
            <option value="most_reviewed">🔥 En Çok Tekrar Edilen</option>
            <option value="least_reviewed">🌱 En Az Tekrar Edilen</option>
            <option value="alpha_asc">🔤 Alfabetik (A → Z)</option>
            <option value="alpha_desc">🔤 Alfabetik (Z → A)</option>
            <option value="difficulty_desc">⚡ Zorluk (Zor → Kolay)</option>
            <option value="difficulty_asc">🎯 Zorluk (Kolay → Zor)</option>
          </select>
          <div className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 text-xs">
            ▼
          </div>
        </div>
      </div>

      {/* ── Difficulty Filter Tabs ── */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-5 animate-fade-up no-scrollbar">
        {DIFFICULTY_FILTERS.map(({ key, label }) => {
          const count = key === 'all' ? words.length : (counts[key] ?? 0)
          const isActive = diffFilter === key
          const colorCls = key === 'mastered' ? 'text-sky-400' : key === 'easy' ? 'text-easy' : key === 'medium' ? 'text-medium' : key === 'hard' ? 'text-hard' : key === 'unrated' ? 'text-unrated' : ''
          return (
            <button
              key={key}
              id={`filter-${key}`}
              onClick={() => setDiffFilter(key)}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-200
                ${isActive
                  ? 'bg-primary-500 text-white shadow-glow-primary'
                  : 'bg-base-800 text-slate-400 hover:text-slate-200 border border-white/[0.06]'}`}
            >
              {key !== 'all' && (
                <span className={`text-[8px] ${isActive ? 'text-white' : colorCls}`}>⬤</span>
              )}
              {label.replace('⬤ ', '')}
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${isActive ? 'bg-white/20' : 'bg-base-700'}`}>
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="p-4 rounded-xl bg-hard/10 border border-hard/20 text-hard text-sm mb-4">
          Hata: {error}
        </div>
      )}

      {/* ── Loading Skeletons ── */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="glass rounded-2xl p-4 animate-pulse-soft">
              <div className="h-5 bg-base-700 rounded-lg w-1/3 mb-3" />
              <div className="h-4 bg-base-700 rounded-lg w-1/2 mb-2" />
              <div className="h-3 bg-base-700 rounded-lg w-full" />
            </div>
          ))}
        </div>
      )}

      {/* ── Word List ── */}
      {!loading && filtered.length > 0 && (
        <div className="space-y-3">
          {filtered.map(word => (
            <WordCard
              key={word.id}
              word={word}
              onDelete={handleDelete}
              onUpdate={handleUpdate}
              decks={decks}
            />
          ))}
        </div>
      )}

      {/* ── Empty State ── */}
      {!loading && filtered.length === 0 && (
        <div className="text-center py-16 animate-fade-up">
          <div className="w-20 h-20 mx-auto mb-4 rounded-3xl bg-base-800 border border-white/[0.06] flex items-center justify-center">
            <span className="text-4xl">
              {search ? '🔍' : diffFilter !== 'all' ? '📂' : '📭'}
            </span>
          </div>
          <p className="text-slate-400 font-medium">
            {search
              ? `"${search}" için sonuç bulunamadı`
              : words.length === 0
                ? 'Henüz kelime eklemedin'
                : 'Bu filtrede kelime yok'}
          </p>
          <p className="text-slate-600 text-sm mt-1">
            {words.length === 0 ? '"Ekle" sekmesinden başla' : 'Farklı bir filtre dene'}
          </p>
        </div>
      )}
    </div>
  )
}
