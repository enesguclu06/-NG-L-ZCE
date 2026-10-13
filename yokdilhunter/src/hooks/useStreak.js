import { useState, useEffect, useCallback } from 'react'
import { useAuthStore } from '../store/authStore'
import {
  getStreakData,
  recordReviewForStreak,
  dismissFreezeNotice,
  DAILY_STREAK_TARGET
} from '../lib/streak'

export function useStreak() {
  const { user } = useAuthStore()
  const userId = user?.id ?? null

  const [streak, setStreak] = useState(() => getStreakData(userId))
  const [justCompletedModal, setJustCompletedModal] = useState(false)

  const refreshStreak = useCallback(() => {
    setStreak(getStreakData(userId))
  }, [userId])

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
