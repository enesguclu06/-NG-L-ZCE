/**
 * Spaced repetition helper.
 * Maps a user-chosen difficulty label to interval_days and next_review_at.
 *
 * Rules (simple, tunable):
 *   hard   → review again in 1 day
 *   medium → review again in 3 days
 *   easy   → review again in 10 days (likely won't appear in default session)
 *   unrated → treat like hard (1 day)
 */

const INTERVAL_MAP = {
  hard: 1,
  medium: 3,
  easy: 10,
  unrated: 1,
}

/**
 * Returns the updated spaced-repetition fields for a word after a review.
 *
 * @param {'easy'|'medium'|'hard'|'unrated'} difficulty
 * @param {number} currentReviewCount
 * @returns {{ next_review_at: string, interval_days: number, review_count: number, last_reviewed_at: string }}
 */
export function getReviewUpdate(difficulty, currentReviewCount = 0) {
  const interval = INTERVAL_MAP[difficulty] ?? 1
  const now = new Date()
  const next = new Date(now)
  next.setDate(next.getDate() + interval)

  return {
    difficulty,
    interval_days: interval,
    next_review_at: next.toISOString(),
    review_count: currentReviewCount + 1,
    last_reviewed_at: now.toISOString(),
  }
}

/**
 * Returns the interval in days for a given difficulty label.
 * @param {'easy'|'medium'|'hard'|'unrated'} difficulty
 * @returns {number}
 */
export function getIntervalDays(difficulty) {
  return INTERVAL_MAP[difficulty] ?? 1
}
