import { useState, useCallback, useRef } from 'react'
import { isDueToday } from '../lib/spaced'

/**
 * Manages a flashcard review session.
 * Builds a queue from words, tracks progress, handles difficulty selection.
 *
 * @param {object[]} allWords - Full list of words from useWords
 * @param {'default'|'due'|'easy'|'medium'|'hard'|'unrated'} mode
 *   'default' = exclude 'easy' words (show unrated+medium+hard)
 *   'due'     = only words due today (SM-2 spaced repetition filter)
 *   any other value = filter to that specific difficulty
 * @param {string} category - Category to filter by ('all', 'none', or specific deck_id)
 * @param {function} updateAfterReview - SM-2 update function from useWords hook
 */
export function useReview(allWords, mode = 'default', category = 'all', updateAfterReview) {
  const [queue, setQueue] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isFlipped, setIsFlipped] = useState(false)
  const [sessionResults, setSessionResults] = useState({ easy: 0, medium: 0, hard: 0 })
  const [isComplete, setIsComplete] = useState(false)
  const [isStarted, setIsStarted] = useState(false)
  const lastCustomWordsRef = useRef(null)

  // ── Build & shuffle the review queue ─────────────────────────
  const startSession = useCallback((customWordsList = null) => {
    let filtered

    if (customWordsList && Array.isArray(customWordsList)) {
      filtered = customWordsList
      lastCustomWordsRef.current = customWordsList
    } else {
      lastCustomWordsRef.current = null
      if (mode === 'today') {
        // Words added today (since midnight local time)
        const todayStart = new Date()
        todayStart.setHours(0, 0, 0, 0)
        filtered = allWords.filter(w => new Date(w.created_at) >= todayStart)
      } else if (mode === 'due') {
        // SM-2: only words whose next_review_at <= now (or never reviewed)
        filtered = allWords.filter(isDueToday)
      } else if (mode === 'default') {
        filtered = allWords.filter(w => w.difficulty !== 'easy')
      } else if (mode === 'hard_medium') {
        filtered = allWords.filter(w => w.difficulty === 'hard' || w.difficulty === 'medium')
      } else if (mode === 'focus') {
        filtered = allWords // already pre-filtered by FocusReviewPage
      } else {
        filtered = allWords.filter(w => w.difficulty === mode)
      }

      if (category !== 'all') {
        if (category === 'none') {
          filtered = filtered.filter(w => !w.deck_id)
        } else {
          filtered = filtered.filter(w => w.deck_id === category)
        }
      }
    }

    // Shuffle
    const shuffled = [...filtered].sort(() => Math.random() - 0.5)
    setQueue(shuffled)
    setCurrentIndex(0)
    setIsFlipped(false)
    setSessionResults({ easy: 0, medium: 0, hard: 0 })
    setIsComplete(false)
    setIsStarted(true)
  }, [allWords, mode, category])

  const exitSession = useCallback(() => {
    setIsStarted(false)
    setIsComplete(false)
    setQueue([])
    setCurrentIndex(0)
    setIsFlipped(false)
  }, [])

  const currentWord = queue[currentIndex] ?? null

  const flip = useCallback(() => {
    setIsFlipped(true)
  }, [])

  // ── Called when user selects Kolay/Orta/Zor ──────────────────
  const rateDifficulty = useCallback(async (difficulty) => {
    if (!currentWord) return

    // Pass full word object so SM-2 can use accumulated state
    await updateAfterReview(currentWord.id, difficulty, currentWord)

    // Update session results
    setSessionResults(prev => ({
      ...prev,
      [difficulty]: (prev[difficulty] ?? 0) + 1,
    }))

    // Advance to next card
    const nextIndex = currentIndex + 1
    if (nextIndex >= queue.length) {
      setIsComplete(true)
    } else {
      setCurrentIndex(nextIndex)
      setIsFlipped(false)
    }
  }, [currentWord, currentIndex, queue.length, updateAfterReview])

  // ── Skip — advance without touching the DB ────────────────────
  const skip = useCallback(() => {
    if (!currentWord) return
    const nextIndex = currentIndex + 1
    if (nextIndex >= queue.length) {
      setIsComplete(true)
    } else {
      setCurrentIndex(nextIndex)
      setIsFlipped(false)
    }
  }, [currentWord, currentIndex, queue.length])

  const restartSession = useCallback(() => {
    if (lastCustomWordsRef.current) {
      startSession(lastCustomWordsRef.current)
    } else {
      startSession()
    }
  }, [startSession])

  return {
    queue,
    currentIndex,
    currentWord,
    isFlipped,
    isComplete,
    isStarted,
    sessionResults,
    startSession,
    exitSession,
    flip,
    rateDifficulty,
    skip,
    restartSession,
    total: queue.length,
    progress: queue.length > 0 ? currentIndex / queue.length : 0,
  }
}
