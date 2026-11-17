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
    freezeUsedNotice: false, // Flag to show "Kalkan kullanıldı" modal
    streakLostNotice: false, // Flag to show "Giriş serin sıfırlandı" modal
    lostStreakCount: 0,      // Number of streak days lost
  }
}

/**
 * Loads streak state, checks for date transitions, applies streak freeze or reset if needed.
 * NOTE: For logged-in users, expiration is evaluated by reconcileStreakWithCloud to prevent
 * stale local cache from destroying cloud streak achieved on another device (e.g. phone).
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

  // 1. Day transition check: reset today's counter if a new calendar day has started
  if (state.todayDate !== today) {
    state.todayDate = today
    state.todayCount = 0
    state.todayWordIds = []
    stateChanged = true
  }

  // Safety: If current streak is 0, clear any freeze cooldown so user doesn't waste their 14-day shield
  if ((!state.currentStreak || state.currentStreak === 0) && state.lastFreezeUsedAt) {
    state.lastFreezeUsedAt = null
    stateChanged = true
  }

  // 2. Streak evaluation (has user broken the chain?)
  // For logged-in users: Skip local evaluation here! reconcileStreakWithCloud handles it with full cloud authority.
  // For guest users: Evaluate locally since guest has no cloud account.
  if (!userId && state.lastCompletedDate) {
    const daysSinceCompleted = getDaysDiff(state.lastCompletedDate, today)

    if (daysSinceCompleted === 2) {
      // Exactly 1 day was missed (yesterday)
      const freezeAvailable = isFreezeAvailable(state.lastFreezeUsedAt)

      if (freezeAvailable && state.currentStreak > 0) {
        state.lastFreezeUsedAt = Date.now()
        state.lastCompletedDate = yesterday
        state.freezeUsedNotice = true
        state.streakLostNotice = false
        stateChanged = true
      } else if (state.currentStreak > 0) {
        state.lostStreakCount = state.currentStreak
        state.currentStreak = 0
        state.streakLostNotice = true
        state.freezeUsedNotice = false
        stateChanged = true
      }
    } else if (daysSinceCompleted > 2) {
      // 2 or more consecutive days missed
      if (state.currentStreak > 0) {
        state.lostStreakCount = state.currentStreak
        state.currentStreak = 0
        state.streakLostNotice = true
        state.freezeUsedNotice = false
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
    // NOTE: NEVER trigger network syncStreakToCloud inside a synchronous getter!
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
let lastKnownCloudCompletedDate = null

/**
 * Saves streak state to Supabase account (user_metadata) so all devices sync.
 * Guards against pushing older completion dates over newer cloud completions.
 */
export async function syncStreakToCloud(userId, state) {
  if (!userId || !state) return

  // Strict cross-device safety: never overwrite a newer cloud completion date with an older local date
  if (lastKnownCloudCompletedDate && state.lastCompletedDate && state.lastCompletedDate < lastKnownCloudCompletedDate) {
    console.warn('Rejected stale streak sync to cloud (local date is older than known cloud date):', state.lastCompletedDate, '<', lastKnownCloudCompletedDate)
    return
  }

  const payload = {
    todayDate: state.todayDate,
    todayCount: state.todayCount,
    todayWordIds: state.todayWordIds || [],
    currentStreak: state.currentStreak || 0,
    bestStreak: state.bestStreak || 0,
    lastCompletedDate: state.lastCompletedDate || null,
    lastFreezeUsedAt: state.lastFreezeUsedAt || null,
    freezeUsedNotice: !!state.freezeUsedNotice,
    streakLostNotice: !!state.streakLostNotice,
    lostStreakCount: state.lostStreakCount || 0,
  }

  const payloadStr = `${userId}:${JSON.stringify(payload)}`
  if (lastSyncedJson === payloadStr) {
    return // Already synced to cloud, don't spam updateUser
  }

  try {
    lastSyncedJson = payloadStr
    if (payload.lastCompletedDate) {
      lastKnownCloudCompletedDate = payload.lastCompletedDate
    }
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
 * Master Cross-Device Streak Reconciler.
 * Safely unifies local device storage, Supabase user_metadata cloud state, and words DB.
 * Guarantees phone and PC never overwrite or break each other's streaks!
 */
export function reconcileStreakWithCloud(userId, cloudState, wordsData = []) {
  if (!userId) return getStreakData(null)
  const key = getStorageKey(userId)
  const local = getStreakData(userId)
  const cloud = cloudState || {}

  const today = getLocalDateString(new Date())
  const yesterdayDate = new Date()
  yesterdayDate.setDate(yesterdayDate.getDate() - 1)
  const yesterday = getLocalDateString(yesterdayDate)

  // 1. Authoritative Best Streak (Highest ever achieved across any device)
  const bestStreak = Math.max(local.bestStreak || 0, cloud.bestStreak || 0)

  // 2. Authoritative Recovery Shield (Freeze) Used Timestamp
  const lastFreezeUsedAt = Math.max(
    Number(local.lastFreezeUsedAt) || 0,
    Number(cloud.lastFreezeUsedAt) || 0
  ) || null

  // 3. Authoritative Latest Completed Date & Active Streak
  const cloudCompleted = cloud.lastCompletedDate || ''
  const localCompleted = local.lastCompletedDate || ''
  let latestCompletedDate = null
  let activeStreak = 0

  if (cloudCompleted > localCompleted) {
    // Cloud has more recent completion (e.g. user completed yesterday on phone, PC was unopened)
    latestCompletedDate = cloudCompleted
    activeStreak = cloud.currentStreak || 0
  } else if (localCompleted > cloudCompleted) {
    // Local device has more recent completion
    latestCompletedDate = localCompleted
    activeStreak = local.currentStreak || 0
  } else {
    // Same completion date or both empty
    latestCompletedDate = cloudCompleted || localCompleted || null
    activeStreak = Math.max(local.currentStreak || 0, cloud.currentStreak || 0)
  }

  // 4. Combine today's words across both devices & database
  const dbTodayWords = []
  if (Array.isArray(wordsData) && wordsData.length > 0) {
    for (const w of wordsData) {
      if (w.last_reviewed_at && getLocalDateString(w.last_reviewed_at) === today) {
        dbTodayWords.push(w.id)
      }
    }
  }

  const localTodayWords = (local.todayDate === today && Array.isArray(local.todayWordIds)) ? local.todayWordIds : []
  const cloudTodayWords = (cloud.todayDate === today && Array.isArray(cloud.todayWordIds)) ? cloud.todayWordIds : []
  const combinedTodayWordIds = Array.from(new Set([...localTodayWords, ...cloudTodayWords, ...dbTodayWords]))
  const todayCount = combinedTodayWordIds.length

  // Check if today's 10-word target is newly achieved
  if (todayCount >= DAILY_STREAK_TARGET && latestCompletedDate !== today) {
    latestCompletedDate = today
    activeStreak = (activeStreak || 0) + 1
  }

  // 5. Bug Auto-Rescue:
  // If activeStreak was falsely reset to 0 by the previous PC-open bug, but user completed yesterday or today
  // or has reviews in the database from yesterday or today, auto-restore the streak!
  if (activeStreak === 0 && bestStreak > 0) {
    if (latestCompletedDate === today || latestCompletedDate === yesterday) {
      activeStreak = bestStreak
    } else {
      const hasRecentReviews = Array.isArray(wordsData) && wordsData.some(w => {
        if (!w.last_reviewed_at) return false
        const d = getLocalDateString(w.last_reviewed_at)
        return d === today || d === yesterday
      })
      if (hasRecentReviews) {
        latestCompletedDate = latestCompletedDate || yesterday
        activeStreak = bestStreak
      }
    }
  }

  // 6. Cross-Device Streak Expiration Evaluation
  let freezeUsedNotice = false
  let streakLostNotice = false
  let lostStreakCount = 0

  if (latestCompletedDate) {
    const daysSinceCompleted = getDaysDiff(latestCompletedDate, today)

    if (daysSinceCompleted <= 1) {
      // 0 = completed today, 1 = completed yesterday on phone or PC!
      // Streak is 100% healthy and active!
      freezeUsedNotice = false
      streakLostNotice = false
      lostStreakCount = 0
    } else if (daysSinceCompleted === 2) {
      // Exactly yesterday was missed across ALL devices!
      const freezeAvailable = isFreezeAvailable(lastFreezeUsedAt)
      if (freezeAvailable && activeStreak > 0) {
        // Recovery Shield automatically saves the streak!
        lastFreezeUsedAt = Date.now()
        latestCompletedDate = yesterday
        freezeUsedNotice = true
        streakLostNotice = false
      } else if (activeStreak > 0) {
        // Shield already on cooldown or streak was 0
        lostStreakCount = activeStreak
        activeStreak = 0
        streakLostNotice = true
        freezeUsedNotice = false
      }
    } else if (daysSinceCompleted > 2) {
      // 2 or more consecutive days missed across all devices
      if (activeStreak > 0) {
        lostStreakCount = activeStreak
        activeStreak = 0
        streakLostNotice = true
        freezeUsedNotice = false
      }
    }
  }

  const finalBestStreak = Math.max(bestStreak, activeStreak)

  const reconciled = {
    todayDate: today,
    todayCount,
    todayWordIds: combinedTodayWordIds,
    currentStreak: activeStreak,
    bestStreak: finalBestStreak,
    lastCompletedDate: latestCompletedDate,
    lastFreezeUsedAt,
    freezeUsedNotice,
    streakLostNotice,
    lostStreakCount,
  }

  // Save to local cache
  saveStreakState(key, reconciled)

  // Track latest cloud completed date so stale local pushes are rejected
  if (reconciled.lastCompletedDate) {
    lastKnownCloudCompletedDate = reconciled.lastCompletedDate
  }

  // Push unified state to Supabase cloud
  syncStreakToCloud(userId, reconciled)

  // Reactive UI update
  window.dispatchEvent(new CustomEvent('yokdil_streak_updated', { detail: reconciled }))

  return reconciled
}

/**
 * Backward compatibility aliases.
 */
export function mergeCloudStreak(userId, cloudState) {
  return reconcileStreakWithCloud(userId, cloudState, [])
}

export function syncStreakWithWords(userId, words = []) {
  return reconcileStreakWithCloud(userId, null, words)
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

/**
 * Clear the "streak lost" notification modal once user sees it.
 */
export function dismissStreakLostNotice(userId = null) {
  const key = getStorageKey(userId)
  const current = getStreakData(userId)
  const updated = { ...current, streakLostNotice: false, lostStreakCount: 0 }
  saveStreakState(key, updated)
  if (userId) {
    syncStreakToCloud(userId, updated)
  }
  window.dispatchEvent(new CustomEvent('yokdil_streak_updated', { detail: updated }))
}

/**
 * Manually sets or restores user's streak and syncs to Supabase cloud.
 */
export async function manualSetStreak(userId, targetStreak = 1, completedToday = true) {
  const key = getStorageKey(userId)
  const current = getStreakData(userId)
  const today = getLocalDateString(new Date())
  const numStreak = Math.max(1, parseInt(targetStreak, 10) || 1)

  const updated = {
    ...current,
    todayDate: today,
    todayCount: completedToday ? Math.max(current.todayCount || 0, DAILY_STREAK_TARGET) : (current.todayCount || 0),
    currentStreak: numStreak,
    bestStreak: Math.max(current.bestStreak || 0, numStreak),
    lastCompletedDate: today,
    lastFreezeUsedAt: null, // Kalkanı da sıfırlayıp hemen kullanıma hazır yapar
    freezeUsedNotice: false,
    streakLostNotice: false,
    lostStreakCount: 0,
  }

  saveStreakState(key, updated)
  if (userId) {
    await syncStreakToCloud(userId, updated)
  }
  window.dispatchEvent(new CustomEvent('yokdil_streak_updated', { detail: updated }))
  return updated
}


