import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuthStore } from '../store/authStore'
import { supabase } from '../lib/supabase'
import {
  getStreakData,
  recordReviewForStreak,
  dismissFreezeNotice,
  mergeCloudStreak,
  syncStreakToCloud,
  syncStreakWithWords,
  DAILY_STREAK_TARGET
} from '../lib/streak'

export function useStreak() {
  const userId = useAuthStore(s => s.user?.id ?? null)
  const initialCloudStreak = useAuthStore(s => s.user?.user_metadata?.streak_data ?? null)

  const [streak, setStreak] = useState(() => getStreakData(userId))
  const [justCompletedModal, setJustCompletedModal] = useState(false)
  const syncedUserIdRef = useRef(null)

  const refreshStreak = useCallback(() => {
    setStreak(getStreakData(userId))
  }, [userId])

  // ── Sync with Supabase Account on mount / user change ─────────
  useEffect(() => {
    if (!userId) {
      syncedUserIdRef.current = null
      return
    }

    // Only run cloud sync once per user session to prevent re-render loops
    if (syncedUserIdRef.current === userId) {
      return
    }
    syncedUserIdRef.current = userId

    let isMounted = true

    async function syncFromAccount() {
      // 1. Check if user in auth store already has streak_data
      if (initialCloudStreak) {
        mergeCloudStreak(userId, initialCloudStreak)
        if (isMounted) refreshStreak()
      }

      // 2. Fetch fresh user data from Supabase to guarantee cross-device sync (e.g. phone vs desktop)
      try {
        const { data: { user: freshUser } } = await supabase.auth.getUser()
        if (freshUser?.user_metadata?.streak_data) {
          mergeCloudStreak(userId, freshUser.user_metadata.streak_data)
          if (isMounted) refreshStreak()
        } else {
          // If cloud has no streak yet but local has one, push to cloud
          const local = getStreakData(userId)
          if (local.currentStreak > 0 || local.todayCount > 0) {
            syncStreakToCloud(userId, local)
          }
        }
      } catch (err) {
        console.warn('Cross-device streak sync failed:', err)
      }

      // 3. Directly verify with database words reviewed by user
      // Even if localStorage is completely empty (new phone login), this guarantees correct streak!
      try {
        const { data: wordsData } = await supabase
          .from('words')
          .select('id, last_reviewed_at')
          .eq('user_id', userId)
          .not('last_reviewed_at', 'is', null)

        if (wordsData && wordsData.length > 0) {
          syncStreakWithWords(userId, wordsData)
          if (isMounted) refreshStreak()
        }
      } catch (e) {
        console.warn('Could not sync streak from words DB:', e)
      }
    }

    syncFromAccount()

    return () => { isMounted = false }
  }, [userId, refreshStreak])

  useEffect(() => {
    refreshStreak()

    function handleStreakUpdate(e) {
      if (e.detail?.justCompletedToday) {
        setJustCompletedModal(true)
      }
      refreshStreak()
    }

    function handleReviewLogged(e) {
      const wordId = e.detail?.word_id
      recordReviewForStreak(userId, wordId)
    }

    window.addEventListener('yokdil_streak_updated', handleStreakUpdate)
    window.addEventListener('yokdil_review_logged', handleReviewLogged)

    return () => {
      window.removeEventListener('yokdil_streak_updated', handleStreakUpdate)
      window.removeEventListener('yokdil_review_logged', handleReviewLogged)
    }
  }, [userId, refreshStreak])

  const dismissNotice = useCallback(() => {
    dismissFreezeNotice(userId)
    refreshStreak()
  }, [userId, refreshStreak])

  const closeCelebration = useCallback(() => {
    setJustCompletedModal(false)
  }, [])

  return {
    ...streak,
    target: DAILY_STREAK_TARGET,
    refreshStreak,
    dismissNotice,
    justCompletedModal,
    closeCelebration,
  }
}
