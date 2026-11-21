import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://vovqngmllgbbfziarmqd.supabase.co'
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || 'sb_publishable_FzjhHyDUlzp_sHnlHxYvGg_lVk20xxp'
const VAPID_PUBLIC_KEY = process.env.VITE_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY || 'BE7AhbJfl8S5A11XPA3Ck8tYMjsuNrvPSPB7IOceRoHh9S7XuFKGVpF9jmuFc_Mk4Bcfk18eMJ6RL-ZVX3s5Fw8'
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || 'Xf5NG8UfoANqMBYtk2IUyMkP2nOU_JovYR3TupkVp50'
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@yokdilhunter.app'

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
})

export default async function handler(req, res) {
  // Allow GET and POST
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Security secret check
  const reqSecret = req.query?.secret || req.headers?.['x-cron-secret'] || req.headers?.['authorization']?.replace('Bearer ', '')
  const cronSecret = process.env.CRON_SECRET || 'yokdilhunter'
  
  if (cronSecret && reqSecret && reqSecret !== cronSecret) {
    return res.status(401).json({ error: 'Unauthorized: Invalid secret' })
  }

  try {
    // 1. Calculate Turkey local time (Europe/Istanbul - UTC+3)
    const now = new Date()
    const trDateFormatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Istanbul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
    const todayTrDate = trDateFormatter.format(now) // "YYYY-MM-DD"

    const trTimeFormatter = new Intl.DateTimeFormat('tr-TR', {
      timeZone: 'Europe/Istanbul',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
    const trTimeStr = trTimeFormatter.format(now)
    const [trHour, trMin] = trTimeStr.split(':').map(Number)

    const isForced = req.query?.force === 'true' || req.query?.force === '1'
    const queryType = (req.query?.type || req.query?.mode || '').toLowerCase()

    // Determine Mode:
    // If query specifies 'streak-warning' / 'streak' OR it's 23:00-23:45 Turkey time without explicit type,
    // activate streak warning mode (only sends to users who haven't completed their daily review).
    const isStreakWarning =
      queryType === 'streak-warning' ||
      queryType === 'streak' ||
      (!queryType && trHour === 23)

    // Quiet Hours Guard:
    // Do not send notifications in the dead of night (23:45 - 08:30 TR) unless forced.
    const isQuietHours = (trHour === 23 && trMin >= 45) || (trHour >= 0 && trHour < 8) || (trHour === 8 && trMin < 30)
    if (isQuietHours && !isForced) {
      return res.status(200).json({
        skipped: true,
        reason: 'Quiet hours (23:45 - 08:30 TR)',
        trTime: trTimeStr,
        timestamp: now.toISOString(),
      })
    }

    // 2. Fetch subscriptions (try streak-aware RPC first)
    let subscriptions = null
    let fetchError = null
    let hasStreakRPC = false

    try {
      const { data: rpcData, error: rpcErr } = await supabase.rpc('get_all_push_subscriptions_with_streak', {
        p_today: todayTrDate,
      })
      if (!rpcErr && Array.isArray(rpcData)) {
        subscriptions = rpcData
        hasStreakRPC = true
      }
    } catch (_) {}

    if (!subscriptions) {
      try {
        const { data: rpcData, error: rpcErr } = await supabase.rpc('get_all_push_subscriptions')
        if (!rpcErr && Array.isArray(rpcData)) {
          subscriptions = rpcData
        }
      } catch (_) {}
    }

    if (!subscriptions) {
      const { data: tableData, error: tableErr } = await supabase
        .from('push_subscriptions')
        .select('*')
      subscriptions = tableData
      fetchError = tableErr
    }

    if (fetchError && !subscriptions) {
      return res.status(500).json({ error: 'Subscriptions could not be fetched', details: fetchError.message })
    }

    if (!subscriptions || subscriptions.length === 0) {
      return res.status(200).json({ message: 'No active subscriptions found', sent: 0 })
    }

    // 3. If in Streak Warning mode, filter ONLY users who haven't completed their review today
    let targetSubscriptions = subscriptions
    let skippedCompletedCount = 0

    if (isStreakWarning) {
      if (hasStreakRPC) {
        targetSubscriptions = subscriptions.filter(sub => {
          if (sub.completed_today) {
            skippedCompletedCount++
            return false
          }
          return true
        })
      } else {
        // Fallback: If service role key is available, check auth metadata directly
        const isServiceRole = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY)
        if (isServiceRole && supabase.auth?.admin?.getUserById) {
          const filtered = []
          for (const sub of subscriptions) {
            try {
              const { data: userData } = await supabase.auth.admin.getUserById(sub.user_id)
              const streakData = userData?.user?.user_metadata?.streak_data
              const isCompleted =
                streakData &&
                (streakData.lastCompletedDate === todayTrDate || Number(streakData.todayCount) >= 10)

              if (isCompleted) {
                skippedCompletedCount++
              } else {
                filtered.push(sub)
              }
            } catch (_) {
              filtered.push(sub)
            }
          }
          targetSubscriptions = filtered
        }
      }

      // If all subscribed users have already completed their review today, don't disturb anyone!
      if (targetSubscriptions.length === 0) {
        return res.status(200).json({
          success: true,
          mode: 'streak-warning',
          today: todayTrDate,
          trTime: trTimeStr,
          message: 'Tüm kullanıcılar bugünkü tekrarını tamamlamış! Acil bildirim gönderilmedi.',
          totalSubscribers: subscriptions.length,
          skippedCompletedCount,
          sent: 0,
        })
      }
    }

    // 4. Construct payload based on mode
    let payload
    if (isStreakWarning) {
      payload = JSON.stringify({
        title: '🔥 Serini Kaybetmek Üzeresin!',
        body: 'Bugünkü 10 kelimelik tekrar hedefini henüz tamamlamadın. Gece bitmeden tekrarını yap ve serini koru! ⏳',
        icon: '/favicon.svg',
        badge: '/favicon.svg',
        tag: 'enesglish-streak-warning',
        data: { url: '/review' },
      })
    } else {
      payload = JSON.stringify({
        title: 'Enesglish 🎯',
        body: trHour < 12
          ? 'Günaydın! Sabah 10 kelimelik tekrarını yaparak güne harika başla 📚'
          : 'Kelime ezberleme vakti! Bugün tekrar etmen gereken kelimeleri unutma 📚',
        icon: '/favicon.svg',
        badge: '/favicon.svg',
        tag: 'enesglish-daily-reminder',
        data: { url: '/review' },
      })
    }

    let successCount = 0
    let failedCount = 0
    const expiredEndpoints = []

    for (const sub of targetSubscriptions) {
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth,
        },
      }

      try {
        await webpush.sendNotification(pushSubscription, payload)
        successCount++
      } catch (err) {
        failedCount++
        if (err.statusCode === 404 || err.statusCode === 410) {
          expiredEndpoints.push(sub.endpoint)
        }
      }
    }

    // Cleanup expired subscriptions
    if (expiredEndpoints.length > 0) {
      try {
        await supabase.rpc('delete_expired_push_subscriptions', { endpoints: expiredEndpoints })
      } catch (_) {
        await supabase.from('push_subscriptions').delete().in('endpoint', expiredEndpoints)
      }
    }

    return res.status(200).json({
      success: true,
      mode: isStreakWarning ? 'streak-warning' : 'regular',
      today: todayTrDate,
      trTime: trTimeStr,
      totalSubscribers: subscriptions.length,
      skippedCompletedCount,
      sent: successCount,
      failed: failedCount,
      cleaned: expiredEndpoints.length,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    return res.status(500).json({ error: 'Server error', message: error.message })
  }
}
