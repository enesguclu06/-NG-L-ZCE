import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuthStore } from '../store/authStore'
import { supabase } from '../lib/supabase'
import {
  getStreakData,
  recordReviewForStreak,
  dismissFreezeNotice,
  dismissStreakLostNotice,
  manualSetStreak,
  reconcileStreakWithCloud,
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

  // ── Master Cross-Device Cloud Sync on mount / user change ─────
  useEffect(() => {
    if (!userId) {
      syncedUserIdRef.current = null
      return
    }

    if (syncedUserIdRef.current === userId) {
      return
    }
    syncedUserIdRef.current = userId

    let isMounted = true

    async function syncFromAccount() {
      let cloudStreak = initialCloudStreak
      let wordsData = []

      // 1. Fetch fresh user metadata from Supabase
      try {
        const { data: { user: freshUser } } = await supabase.auth.getUser()
        if (freshUser) {
          useAuthStore.getState().setUser(freshUser, useAuthStore.getState().session)
          if (freshUser.user_metadata?.streak_data) {
            cloudStreak = freshUser.user_metadata.streak_data
          }
        }
      } catch (err) {
        console.warn('Cross-device streak sync failed (auth):', err)
      }

      // 2. Fetch reviewed words from DB to detect reviews done on other devices
      try {
        const { data } = await supabase
          .from('words')
          .select('id, last_reviewed_at')
          .eq('user_id', userId)
          .not('last_reviewed_at', 'is', null)
        if (data) wordsData = data
      } catch (err) {
        console.warn('Cross-device streak sync failed (words):', err)
      }

      // 3. Perform master cross-device reconciliation
      reconcileStreakWithCloud(userId, cloudStreak, wordsData)
      if (isMounted) refreshStreak()
    }

    syncFromAccount()

    return () => { isMounted = false }
  }, [userId, initialCloudStreak, refreshStreak])

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

  const dismissLostNotice = useCallback(() => {
    dismissStreakLostNotice(userId)
    refreshStreak()
  }, [userId, refreshStreak])

  const closeCelebration = useCallback(() => {
    setJustCompletedModal(false)
  }, [])

  // Expose global console helper to easily restore or set streak: window.setStreak(10)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.setStreak = async (targetStreak = 1, completedToday = true) => {
        const res = await manualSetStreak(userId, targetStreak, completedToday)
        refreshStreak()
        console.log(`🔥 Seri başarıyla ${targetStreak} gün olarak ayarlandı ve Supabase'e kaydedildi!`, res)
        return res
      }
    }
  }, [userId, refreshStreak])

  return {
    ...streak,
    target: DAILY_STREAK_TARGET,
    refreshStreak,
    dismissNotice,
    dismissLostNotice,
    justCompletedModal,
    closeCelebration,
  }
}
