import { supabase } from './supabase'

/**
 * streak.js
 * Duolingo-style Daily Review Streak System.
 * - Daily goal: Minimum 10 words reviewed per day.
 * - 1 missed day resets streak unless Streak Freeze (Recovery Shield) is available.
 * - 1 Streak Freeze granted every 14 days (2 weeks).
 * - Cross-device cloud sync via Supabase user_metadata.
 */

export const DAILY_STREAK_TARGET = 10
export const FREEZE_COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000 // 14 days

export function getLocalDateString(date = new Date()) {
  const d = new Date(date)
  if (isNaN(d.getTime())) return ''
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function getDaysDiff(dateStrA, dateStrB) {
  if (!dateStrA || !dateStrB) return 999
  const a = new Date(dateStrA + 'T00:00:00')
  const b = new Date(dateStrB + 'T00:00:00')
  const diffMs = b.getTime() - a.getTime()
  return Math.round(diffMs / (1000 * 60 * 60 * 24))
}

function getStorageKey(userId) {
  return `yokdil_streak_${userId || 'guest'}`
}

function getInitialState() {
  const today = getLocalDateString(new Date())
  return {
    todayDate: today,
    todayCount: 0,
    todayWordIds: [],
    currentStreak: 0,
    bestStreak: 0,
    lastCompletedDate: null,
    lastFreezeUsedAt: null,
    freezeUsedNotice: false, // Flag to show "Serini kurtardık!" message
  }
}

/**
 * Loads streak state, checks for date transitions, applies streak freeze or reset if needed.
 */
export function getStreakData(userId = null) {
  const key = getStorageKey(userId)
  let state = getInitialState()

  try {
    const raw = localStorage.getItem(key)
    if (raw) {
      const parsed = JSON.parse(raw)
      state = { ...state, ...parsed }
    }
  } catch {
    state = getInitialState()
  }

  const today = getLocalDateString(new Date())
  const yesterdayDate = new Date()
  yesterdayDate.setDate(yesterdayDate.getDate() - 1)
  const yesterday = getLocalDateString(yesterdayDate)

  let stateChanged = false

  // 1. Day transition check
  if (state.todayDate !== today) {
    state.todayDate = today
    state.todayCount = 0
    state.todayWordIds = []
    stateChanged = true
  }

  // 2. Streak evaluation (has user broken the chain?)
  if (state.lastCompletedDate) {
    const daysSinceCompleted = getDaysDiff(state.lastCompletedDate, today)

    // daysSinceCompleted === 0 -> Completed today already!
    // daysSinceCompleted === 1 -> Completed yesterday, today in progress, streak safe!
    if (daysSinceCompleted === 2) {
      // Exactly 1 day was missed (yesterday)!
      const freezeAvailable = isFreezeAvailable(state.lastFreezeUsedAt)

      if (freezeAvailable && state.currentStreak > 0) {
        // Automatically save the streak using the 14-day recovery shield!
        state.lastFreezeUsedAt = Date.now()
        state.lastCompletedDate = yesterday // Treat yesterday as saved
        state.freezeUsedNotice = true
        stateChanged = true
      } else {
        // Freeze not available or streak was 0
        if (state.currentStreak > 0) {
          state.currentStreak = 0
          stateChanged = true
        }
      }
    } else if (daysSinceCompleted > 2) {
      // 2 or more consecutive days missed -> streak lost
      if (state.currentStreak > 0) {
        state.currentStreak = 0
        stateChanged = true
      }
    }
  }

  // 3. Freeze cooldown calculation
  const freezeAvailable = isFreezeAvailable(state.lastFreezeUsedAt)
  const daysUntilFreeze = freezeAvailable
    ? 0
    : Math.max(1, Math.ceil((FREEZE_COOLDOWN_MS - (Date.now() - state.lastFreezeUsedAt)) / (24 * 60 * 60 * 1000)))

  const isCompletedToday = state.lastCompletedDate === today
  const progressPercent = Math.min(100, Math.round((state.todayCount / DAILY_STREAK_TARGET) * 100))

  if (stateChanged) {
    saveStreakState(key, state)
  }

  return {
    ...state,
    freezeAvailable,
    daysUntilFreeze,
    isCompletedToday,
    progressPercent,
    target: DAILY_STREAK_TARGET,
  }
}

function isFreezeAvailable(lastFreezeUsedAt) {
  if (!lastFreezeUsedAt) return true
  return Date.now() - Number(lastFreezeUsedAt) >= FREEZE_COOLDOWN_MS
}

function saveStreakState(key, state) {
  try {
    localStorage.setItem(key, JSON.stringify(state))
  } catch (err) {
    console.warn('Could not save streak state:', err)
  }
}

let lastSyncedJson = null

/**
 * Saves streak state to Supabase account (user_metadata) so all devices sync.
 */
export async function syncStreakToCloud(userId, state) {
  if (!userId || !state) return
  const payload = {
    todayDate: state.todayDate,
    todayCount: state.todayCount,
    todayWordIds: state.todayWordIds || [],
    currentStreak: state.currentStreak || 0,
    bestStreak: state.bestStreak || 0,
    lastCompletedDate: state.lastCompletedDate || null,
    lastFreezeUsedAt: state.lastFreezeUsedAt || null,
  }
  const payloadStr = `${userId}:${JSON.stringify(payload)}`
  if (lastSyncedJson === payloadStr) {
    return // Already synced to cloud, don't spam updateUser and trigger auth state loop!
  }
  try {
    lastSyncedJson = payloadStr
    await supabase.auth.updateUser({
      data: {
        streak_data: payload
      }
    })
  } catch (err) {
    console.warn('Could not sync streak to Supabase:', err)
  }
}

/**
 * Merges cloud streak with local streak and writes back to localStorage.
 */
export function mergeCloudStreak(userId, cloudState) {
  if (!userId || !cloudState) return getStreakData(userId)
  const key = getStorageKey(userId)
  const local = getStreakData(userId)
  const today = getLocalDateString(new Date())

  const merged = { ...local }

  // Best streak: take max
  merged.bestStreak = Math.max(local.bestStreak || 0, cloudState.bestStreak || 0)

  // Current streak & completion
  if (cloudState.lastCompletedDate) {
    if (!local.lastCompletedDate || cloudState.lastCompletedDate > local.lastCompletedDate) {
      merged.lastCompletedDate = cloudState.lastCompletedDate
      merged.currentStreak = cloudState.currentStreak || 0
    } else if (cloudState.lastCompletedDate === local.lastCompletedDate) {
      merged.currentStreak = Math.max(local.currentStreak || 0, cloudState.currentStreak || 0)
    }
  }

  // Today count & words (if same day)
  if (cloudState.todayDate === today && local.todayDate === today) {
    const combinedIds = Array.from(new Set([...(local.todayWordIds || []), ...(cloudState.todayWordIds || [])]))
    merged.todayWordIds = combinedIds
    merged.todayCount = combinedIds.length
    if (merged.todayCount >= DAILY_STREAK_TARGET && merged.lastCompletedDate !== today) {
      merged.lastCompletedDate = today
      merged.currentStreak = (merged.currentStreak || 0) + 1
      merged.bestStreak = Math.max(merged.bestStreak, merged.currentStreak)
    }
  } else if (cloudState.todayDate === today && local.todayDate !== today) {
    merged.todayDate = today
    merged.todayWordIds = cloudState.todayWordIds || []
    merged.todayCount = (cloudState.todayWordIds || []).length
  }

  if (cloudState.lastFreezeUsedAt) {
    merged.lastFreezeUsedAt = Math.max(local.lastFreezeUsedAt || 0, cloudState.lastFreezeUsedAt)
  }

  // Check if anything actually changed before saving and dispatching
  const hasChanged =
    local.todayDate !== merged.todayDate ||
    local.todayCount !== merged.todayCount ||
    local.currentStreak !== merged.currentStreak ||
    local.bestStreak !== merged.bestStreak ||
    local.lastCompletedDate !== merged.lastCompletedDate ||
    local.lastFreezeUsedAt !== merged.lastFreezeUsedAt ||
    (local.todayWordIds || []).length !== (merged.todayWordIds || []).length

  if (!hasChanged) {
    return local
  }

  saveStreakState(key, merged)
  window.dispatchEvent(new CustomEvent('yokdil_streak_updated', { detail: merged }))
  return merged
}

/**
 * Calculates and synchronizes streak directly from Supabase words table.
 * Guarantees that on any new device (mobile, tablet, etc.) streak is immediately accurate.
 */
export function syncStreakWithWords(userId, words = []) {
  if (!userId || !Array.isArray(words) || words.length === 0) return getStreakData(userId)
  const key = getStorageKey(userId)
  const current = getStreakData(userId)
  const today = getLocalDateString(new Date())

  // Kelimeleri tarihlere göre grupla
  const dateMap = new Map() // 'YYYY-MM-DD' => Set(wordId)
  for (const w of words) {
    if (w.last_reviewed_at) {
      const d = getLocalDateString(w.last_reviewed_at)
      if (!dateMap.has(d)) dateMap.set(d, new Set())
      dateMap.get(d).add(w.id)
    }
  }

  const dbTodayWords = dateMap.get(today) ? Array.from(dateMap.get(today)) : []
  // Localde bugün çalışılmış kelimelerle veritabanındaki kelimeleri birleştir
  const combinedTodayWords = Array.from(new Set([...(current.todayWordIds || []), ...dbTodayWords]))
  const todayCount = combinedTodayWords.length
  const isCompletedToday = todayCount >= DAILY_STREAK_TARGET

  // Geriye doğru streak say
  let calculatedStreak = 0
  let checkDate = new Date()

  if (!isCompletedToday) {
    checkDate.setDate(checkDate.getDate() - 1)
  }

  while (true) {
    const keyStr = getLocalDateString(checkDate)
    const count = (keyStr === today ? todayCount : (dateMap.get(keyStr)?.size || 0))
    if (count >= DAILY_STREAK_TARGET) {
      calculatedStreak++
      checkDate.setDate(checkDate.getDate() - 1)
    } else {
      break
    }
  }

  const newCurrentStreak = Math.max(current.currentStreak || 0, calculatedStreak)
  const newBestStreak = Math.max(current.bestStreak || 0, newCurrentStreak)
  const newLastCompletedDate = isCompletedToday ? today : current.lastCompletedDate

  const updated = {
    ...current,
    todayDate: today,
    todayCount,
    todayWordIds: combinedTodayWords,
    currentStreak: newCurrentStreak,
    bestStreak: newBestStreak,
    lastCompletedDate: newLastCompletedDate,
  }

  // Check if anything actually changed before saving and dispatching
  const hasChanged =
    current.todayDate !== updated.todayDate ||
    current.todayCount !== updated.todayCount ||
    current.currentStreak !== updated.currentStreak ||
    current.bestStreak !== updated.bestStreak ||
    current.lastCompletedDate !== updated.lastCompletedDate ||
    (current.todayWordIds || []).length !== (updated.todayWordIds || []).length

  if (!hasChanged) {
    return current
  }

  saveStreakState(key, updated)
  syncStreakToCloud(userId, updated)
  window.dispatchEvent(new CustomEvent('yokdil_streak_updated', { detail: updated }))
  return updated
}

/**
 * Called when a word is reviewed. Increments today's distinct word count.
 * Returns { streakData, justCompletedToday: boolean }
 */
export function recordReviewForStreak(userId = null, wordId = null) {
  const key = getStorageKey(userId)
  const current = getStreakData(userId)
  const today = getLocalDateString(new Date())

  let wordIds = Array.isArray(current.todayWordIds) ? [...current.todayWordIds] : []

  // Ensure unique word count per day
  if (wordId) {
    if (!wordIds.includes(wordId)) {
      wordIds.push(wordId)
    }
  } else {
    // If no wordId provided, increment raw count
    wordIds.push(`count_${Date.now()}`)
  }

  const newCount = wordIds.length
  let newCurrentStreak = current.currentStreak
  let newLastCompletedDate = current.lastCompletedDate
  let justCompletedToday = false

  // If user hits the 10-word target today
  if (newCount >= DAILY_STREAK_TARGET && current.lastCompletedDate !== today) {
    justCompletedToday = true
    newCurrentStreak = (current.currentStreak || 0) + 1
    newLastCompletedDate = today
  }

  const newBestStreak = Math.max(current.bestStreak || 0, newCurrentStreak)

  const updated = {
    ...current,
    todayDate: today,
    todayCount: newCount,
    todayWordIds: wordIds,
    currentStreak: newCurrentStreak,
    bestStreak: newBestStreak,
    lastCompletedDate: newLastCompletedDate,
  }

  saveStreakState(key, updated)

  // Sync to account in cloud if logged in
  if (userId) {
    syncStreakToCloud(userId, updated)
  }

  // Dispatch global event for live reactive UI updates
  window.dispatchEvent(new CustomEvent('yokdil_streak_updated', {
    detail: { ...updated, justCompletedToday }
  }))

  return {
    streakData: getStreakData(userId),
    justCompletedToday,
  }
}

/**
 * Clear the "freeze used" notification banner once user sees it.
 */
export function dismissFreezeNotice(userId = null) {
  const key = getStorageKey(userId)
  const current = getStreakData(userId)
  const updated = { ...current, freezeUsedNotice: false }
  saveStreakState(key, updated)
  if (userId) {
    syncStreakToCloud(userId, updated)
  }
  window.dispatchEvent(new CustomEvent('yokdil_streak_updated', { detail: updated }))
}
