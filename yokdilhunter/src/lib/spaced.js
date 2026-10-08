/**
 * SM-2 Spaced Repetition Algorithm
 * Based on the SuperMemo-2 algorithm used by Anki.
 *
 * User ratings map to SM-2 quality scores (0-5):
 *   hard   → q = 2  (remembered with serious difficulty)
 *   medium → q = 3  (remembered with some difficulty)
 *   easy   → q = 5  (perfect response)
 *
 * SM-2 Rules:
 *   - If q < 3: reset repetitions to 0, interval to 1 day (relearn)
 *   - If q >= 3:
 *       rep 0  → interval = 1 day
 *       rep 1  → interval = 6 days
 *       rep n  → interval = prev_interval * ease_factor (rounded)
 *   - ease_factor = max(1.3, ease_factor + 0.1 - (5-q)*(0.08+(5-q)*0.02))
 *   - next_review_at = now + interval days
 */

const DEFAULT_EASE_FACTOR = 2.5
const MIN_EASE_FACTOR = 1.3

/** Map difficulty label to SM-2 quality score */
const QUALITY_MAP = {
  hard: 2,
  medium: 3,
  easy: 5,
  unrated: 1,
}

/**
 * Runs one SM-2 iteration and returns the updated word fields.
 *
 * @param {'easy'|'medium'|'hard'|'unrated'} difficulty  - User's rating
 * @param {number} repetitions     - Current consecutive correct repetitions
 * @param {number} easeFactor      - Current ease factor (default 2.5)
 * @param {number} intervalDays    - Current interval in days (default 1)
 * @param {number} currentReviewCount - Current review count
 * @returns {{ difficulty, repetitions, ease_factor, interval_days, next_review_at, review_count, last_reviewed_at }}
 */
export function sm2Update(difficulty, repetitions = 0, easeFactor = DEFAULT_EASE_FACTOR, intervalDays = 1, currentReviewCount = 0) {
  const q = QUALITY_MAP[difficulty] ?? 1
  const now = new Date()

  let newRepetitions
  let newInterval
  let newEaseFactor

  if (q < 3) {
    // Failed — reset to beginning
    newRepetitions = 0
    newInterval = 1
    newEaseFactor = Math.max(MIN_EASE_FACTOR, easeFactor + 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
  } else {
    // Success — advance
    if (repetitions === 0) {
      newInterval = 1
    } else if (repetitions === 1) {
      newInterval = 6
    } else {
      newInterval = Math.round(intervalDays * easeFactor)
    }
    newRepetitions = repetitions + 1
    newEaseFactor = Math.max(MIN_EASE_FACTOR, easeFactor + 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
  }

  const next = new Date(now)
  next.setDate(next.getDate() + newInterval)

  return {
    difficulty,
    repetitions: newRepetitions,
    ease_factor: parseFloat(newEaseFactor.toFixed(4)),
    interval_days: newInterval,
    next_review_at: next.toISOString(),
    review_count: currentReviewCount + 1,
    last_reviewed_at: now.toISOString(),
  }
}

/**
 * Returns true if a word is due for review today (or overdue).
 * Words with no next_review_at (never studied) are always due.
 *
 * @param {object} word - Word object from the database
 * @returns {boolean}
 */
export function isDueToday(word) {
  if (!word.next_review_at) return true
  return new Date(word.next_review_at) <= new Date()
}

/**
 * Returns the number of days until a word is next due.
 * Negative means overdue. 0 means due today.
 *
 * @param {object} word
 * @returns {number}
 */
export function daysUntilDue(word) {
  if (!word.next_review_at) return 0
  const diff = new Date(word.next_review_at) - new Date()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

// ── Legacy shim (kept for backwards-compat) ──────────────────────────
export function getReviewUpdate(difficulty, currentReviewCount = 0) {
  return sm2Update(difficulty, 0, DEFAULT_EASE_FACTOR, 1, currentReviewCount)
}

export function getIntervalDays(difficulty) {
  const q = QUALITY_MAP[difficulty] ?? 1
  return q < 3 ? 1 : difficulty === 'easy' ? 10 : difficulty === 'medium' ? 3 : 1
}
