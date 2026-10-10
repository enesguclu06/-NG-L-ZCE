/**
 * reviewHistory.js
 * Tracks flashcard review events and provides filtering by date & rating.
 * Combines localStorage logs with Supabase words.last_reviewed_at data.
 */

export function getLocalDateKey(dateInput) {
  if (!dateInput) return ''
  const d = new Date(dateInput)
  if (isNaN(d.getTime())) return ''
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getStorageKey(userId) {
  return `yokdil_review_logs_${userId || 'guest'}`
}

/**
 * Persists a review log event to localStorage.
 */
export function recordReviewLog(userId, word, difficulty) {
  if (!word || !word.id) return
  const key = getStorageKey(userId)
  try {
    const raw = localStorage.getItem(key)
    const list = raw ? JSON.parse(raw) : []
    const entry = {
      id: `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      word_id: word.id,
      english_word: word.english_word,
      turkish_translation: word.turkish_translation,
      difficulty, // 'easy' | 'medium' | 'hard'
      reviewed_at: new Date().toISOString(),
    }
    // Keep newest first, cap at 2000 entries
    list.unshift(entry)
    if (list.length > 2000) list.length = 2000
    localStorage.setItem(key, JSON.stringify(list))

    // Notify listeners if any
    window.dispatchEvent(new CustomEvent('yokdil_review_logged', { detail: entry }))
  } catch (err) {
    console.warn('Could not record review log:', err)
  }
}

/**
 * Retrieves all review history by combining localStorage logs with database last_reviewed_at timestamps.
 */
export function getAllReviewHistory(words = [], userId = null) {
  let localLogs = []
  try {
    const raw = localStorage.getItem(getStorageKey(userId))
    if (raw) localLogs = JSON.parse(raw)
  } catch {
    localLogs = []
  }

  // Synthesize entries for words in database that have last_reviewed_at
  const syntheticLogs = []
  const wordMap = new Map()
  for (const w of words) {
    wordMap.set(w.id, w)
    if (w.last_reviewed_at) {
      const dayKey = getLocalDateKey(w.last_reviewed_at)
      const alreadyLogged = localLogs.some(
        log => log.word_id === w.id && getLocalDateKey(log.reviewed_at) === dayKey
      )
      if (!alreadyLogged) {
        syntheticLogs.push({
          id: `db_${w.id}_${w.last_reviewed_at}`,
          word_id: w.id,
          english_word: w.english_word,
          turkish_translation: w.turkish_translation,
          difficulty: w.difficulty || 'medium',
          reviewed_at: w.last_reviewed_at,
          from_db: true,
        })
      }
    }
  }

  const merged = [...localLogs, ...syntheticLogs]
  // Sort descending by reviewed_at
  merged.sort((a, b) => new Date(b.reviewed_at) - new Date(a.reviewed_at))
  return merged
}

/**
 * Groups review history into distinct calendar days with review counts & breakdown.
 */
export function getReviewDaysSummary(reviewHistory = []) {
  const groups = new Map()

  const todayKey = getLocalDateKey(new Date())
  const yDate = new Date()
  yDate.setDate(yDate.getDate() - 1)
  const yesterdayKey = getLocalDateKey(yDate)

  for (const item of reviewHistory) {
    const key = getLocalDateKey(item.reviewed_at)
    if (!key) continue

    if (!groups.has(key)) {
      const d = new Date(item.reviewed_at)
      let label = d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })
      if (key === todayKey) label = 'Bugün'
      else if (key === yesterdayKey) label = 'Dün'

      groups.set(key, {
        dateKey: key,
        date: d,
        label,
        formattedDate: d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', weekday: 'short' }),
        wordsSet: new Set(),
        easy: 0,
        medium: 0,
        hard: 0,
      })
    }

    const g = groups.get(key)
    if (!g.wordsSet.has(item.word_id)) {
      g.wordsSet.add(item.word_id)
      if (item.difficulty === 'easy') g.easy++
      else if (item.difficulty === 'medium') g.medium++
      else if (item.difficulty === 'hard') g.hard++
    }
  }

  return Array.from(groups.values())
    .map(g => ({
      ...g,
      total: g.wordsSet.size,
    }))
    .sort((a, b) => b.dateKey.localeCompare(a.dateKey))
}

/**
 * Checks if a date falls within a given preset range.
 */
export function matchesDatePreset(dateInput, preset, customDateKey = null) {
  const d = new Date(dateInput)
  if (isNaN(d.getTime())) return false

  const targetKey = getLocalDateKey(d)
  const todayKey = getLocalDateKey(new Date())

  if (preset === 'today') {
    return targetKey === todayKey
  }

  if (preset === 'yesterday') {
    const y = new Date()
    y.setDate(y.getDate() - 1)
    return targetKey === getLocalDateKey(y)
  }

  if (preset === 'last7days') {
    const start = new Date()
    start.setDate(start.getDate() - 6)
    start.setHours(0, 0, 0, 0)
    return d >= start
  }

  if (preset === 'prevWeek') {
    const end = new Date()
    end.setDate(end.getDate() - 7)
    end.setHours(23, 59, 59, 999)

    const start = new Date()
    start.setDate(start.getDate() - 13)
    start.setHours(0, 0, 0, 0)
    return d >= start && d <= end
  }

  if (preset === 'custom') {
    return customDateKey ? targetKey === customDateKey : false
  }

  return false
}

/**
 * Filters words for review by date preset and difficulty selection.
 *
 * @param {object[]} reviewHistory - Output of getAllReviewHistory
 * @param {object[]} words - All words from useWords
 * @param {object} options
 *   preset: 'today' | 'yesterday' | 'last7days' | 'prevWeek' | 'custom'
 *   customDateKey: 'YYYY-MM-DD'
 *   difficulties: ['easy', 'medium', 'hard']
 *   deckId: 'all' | 'none' | string
 */
export function filterWordsByHistory(reviewHistory, words, {
  preset = 'today',
  customDateKey = null,
  difficulties = ['easy', 'medium', 'hard'],
  deckId = 'all',
}) {
  const wordMap = new Map(words.map(w => [w.id, w]))
  const diffSet = new Set(difficulties)

  // Map of word_id -> { word, latestReview }
  const matchedWordsMap = new Map()

  for (const entry of reviewHistory) {
    if (!matchesDatePreset(entry.reviewed_at, preset, customDateKey)) {
      continue
    }

    const word = wordMap.get(entry.word_id)
    if (!word) continue

    // Deck filter
    if (deckId !== 'all') {
      if (deckId === 'none' && word.deck_id) continue
      if (deckId !== 'none' && word.deck_id !== deckId) continue
    }

    // Only consider the most recent review for this word in the range
    if (!matchedWordsMap.has(entry.word_id)) {
      matchedWordsMap.set(entry.word_id, {
        word: {
          ...word,
          _historyMeta: {
            reviewed_at: entry.reviewed_at,
            difficulty: entry.difficulty,
          },
        },
        difficulty: entry.difficulty,
      })
    }
  }

  // Filter by selected difficulties
  const results = []
  for (const { word, difficulty } of matchedWordsMap.values()) {
    if (diffSet.has(difficulty)) {
      results.push(word)
    }
  }

  return results
}

/**
 * Calculates difficulty counts for the active date filter.
 */
export function getDifficultyCountsForDate(reviewHistory, words, {
  preset = 'today',
  customDateKey = null,
  deckId = 'all',
}) {
  const wordMap = new Map(words.map(w => [w.id, w]))
  const seenWordIds = new Map()

  for (const entry of reviewHistory) {
    if (!matchesDatePreset(entry.reviewed_at, preset, customDateKey)) {
      continue
    }

    const word = wordMap.get(entry.word_id)
    if (!word) continue

    if (deckId !== 'all') {
      if (deckId === 'none' && word.deck_id) continue
      if (deckId !== 'none' && word.deck_id !== deckId) continue
    }

    if (!seenWordIds.has(entry.word_id)) {
      seenWordIds.set(entry.word_id, entry.difficulty)
    }
  }

  const counts = { easy: 0, medium: 0, hard: 0, total: seenWordIds.size }
  for (const diff of seenWordIds.values()) {
    if (counts[diff] !== undefined) counts[diff]++
  }

  return counts
}
