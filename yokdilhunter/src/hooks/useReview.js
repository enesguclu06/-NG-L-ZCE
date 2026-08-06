import { useState, useCallback } from 'react'
import { useWords } from './useWords'

/**
 * Manages a flashcard review session.
 * Builds a queue from words, tracks progress, handles difficulty selection.
 *
 * @param {object[]} allWords - Full list of words from useWords
 * @param {'default'|'easy'|'medium'|'hard'|'unrated'} mode
 *   'default' = exclude 'easy' words (show unrated+medium+hard)
 *   any other value = filter to that specific difficulty
 * @param {string} category - Category to filter by ('all', 'none', or specific category name)
 */
export function useReview(allWords, mode = 'default', category = 'all') {
  const { updateAfterReview } = useWords()

  const [queue, setQueue] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isFlipped, setIsFlipped] = useState(false)
  const [sessionResults, setSessionResults] = useState({ easy: 0, medium: 0, hard: 0 })
  const [isComplete, setIsComplete] = useState(false)
  const [isStarted, setIsStarted] = useState(false)

  // ── Build & shuffle the review queue ─────────────────────────
  const startSession = useCallback(() => {
    let filtered
    if (mode === 'default') {
      filtered = allWords.filter(w => w.difficulty !== 'easy')
    } else {
      filtered = allWords.filter(w => w.difficulty === mode)
    }

    if (category !== 'all') {
      if (category === 'none') {
        filtered = filtered.filter(w => !w.category)
      } else {
        filtered = filtered.filter(w => w.category === category)
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

  const currentWord = queue[currentIndex] ?? null

  const flip = useCallback(() => {
    setIsFlipped(true)
  }, [])

  // ── Called when user selects Kolay/Orta/Zor ──────────────────
  const rateDifficulty = useCallback(async (difficulty) => {
    if (!currentWord) return

    // Update in database
    await updateAfterReview(currentWord.id, difficulty, currentWord.review_count ?? 0)

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

  const restartSession = useCallback(() => {
    startSession()
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
    flip,
    rateDifficulty,
    restartSession,
    total: queue.length,
    progress: queue.length > 0 ? currentIndex / queue.length : 0,
  }
}
