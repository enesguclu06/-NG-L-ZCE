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
    // 1. Fetch subscriptions
    let subscriptions = null
    let fetchError = null

    try {
      const { data: rpcData, error: rpcErr } = await supabase.rpc('get_all_push_subscriptions')
      if (!rpcErr && Array.isArray(rpcData)) {
        subscriptions = rpcData
      }
    } catch (_) {}

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

    const payload = JSON.stringify({
      title: 'Enesglish 🎯',
      body: 'Kelime ezberleme vakti! Bugün tekrar etmen gereken kelimeleri unutma 📚',
      icon: '/favicon.svg',
      badge: '/favicon.svg',
      data: { url: '/review' },
    })

    let successCount = 0
    let failedCount = 0
    const expiredEndpoints = []

    for (const sub of subscriptions) {
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
      sent: successCount,
      failed: failedCount,
      cleaned: expiredEndpoints.length,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    return res.status(500).json({ error: 'Server error', message: error.message })
  }
}

