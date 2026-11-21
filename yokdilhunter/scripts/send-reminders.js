/**
 * YOKDILHUNTER — Web Push Reminder Dispatcher
 * Can be run manually or via cron (GitHub Actions, Supabase, cron-job.org).
 * Sends reminder notifications to active subscribed devices.
 * Supports:
 *   --streak-warning : Only sends to users who have NOT completed their 10-word review today.
 *   --regular        : Sends regular morning/evening reminder.
 *   --force          : Bypasses quiet hours guard for manual testing.
 */

import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import WebSocket from 'ws'

// Polyfill WebSocket for environments where native WebSocket is missing
if (typeof globalThis.WebSocket === 'undefined') {
  globalThis.WebSocket = WebSocket
}

// Load .env if running locally
dotenv.config()

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://vovqngmllgbbfziarmqd.supabase.co'
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
const VAPID_PUBLIC_KEY = process.env.VITE_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY || 'BE7AhbJfl8S5A11XPA3Ck8tYMjsuNrvPSPB7IOceRoHh9S7XuFKGVpF9jmuFc_Mk4Bcfk18eMJ6RL-ZVX3s5Fw8'
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || 'Xf5NG8UfoANqMBYtk2IUyMkP2nOU_JovYR3TupkVp50'
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@yokdilhunter.app'

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Hata: SUPABASE_URL veya SUPABASE_KEY eksik.')
  process.exit(1)
}

const isServiceRole = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY)

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
})

async function sendReminders() {
  console.log('--- Enesglish Hatırlatıcı Gönderimi Başlatılıyor ---')
  console.log(`Zaman (UTC): ${new Date().toISOString()}`)
  console.log(`Yetki Tipi: ${isServiceRole ? 'Service Role (Admin - RLS Devre Dışı) ✅' : 'Anon Key (RLS Devrede) ⚠️'}`)

  const isForced = process.argv.includes('--force')
  const isStreakExplicit = process.argv.includes('--streak') || process.argv.includes('--streak-warning')
  const isRegularExplicit = process.argv.includes('--regular')

  // Calculate local time in Turkey (Europe/Istanbul - UTC+3)
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

  console.log(`Türkiye Tarihi & Saati: ${todayTrDate} ${trTimeStr} (UTC+3)`)

  // Mode resolution:
  // If flagged as --streak-warning OR (not flagged as --regular and Turkey hour is 23), use streak warning mode
  const isStreakWarning = isStreakExplicit || (!isRegularExplicit && trHour === 23)
  console.log(`Gönderim Modu: ${isStreakWarning ? '🔥 Acil Streak Uyarısı (Yalnızca tekrarını yapmayanlara)' : '📚 Standart Hatırlatıcı (10:00 & 22:00)'}`)

  // Quiet Hours Guard:
  // Never send push notifications in the middle of the night (23:45 - 08:30 TR) unless manually forced.
  const isQuietHours = (trHour === 23 && trMin >= 45) || (trHour >= 0 && trHour < 8) || (trHour === 8 && trMin < 30)
  if (isQuietHours && !isForced) {
    console.log('\n🌙 [Gece Rahatsız Etmeme Koruması]')
    console.log(`Şu an Türkiye saatiyle gece ${trTimeStr}. Bildirim gönderimi iptal edildi.`)
    console.log('Kullanıcı uykusunda rahatsız edilmedi. (Manuel test için: node scripts/send-reminders.js --force)\n')
    process.exit(0)
  }

  // 1. Fetch subscriptions (try streak-aware RPC first)
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
      console.log('✓ Abonelikler Streak-RPC fonksiyonu ile çekildi.')
    }
  } catch (_) {}

  if (!subscriptions) {
    try {
      const { data: rpcData, error: rpcErr } = await supabase.rpc('get_all_push_subscriptions')
      if (!rpcErr && Array.isArray(rpcData)) {
        subscriptions = rpcData
        console.log('✓ Abonelikler standart RPC fonksiyonu ile çekildi.')
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
    console.error('Abonelikler çekilemedi:', fetchError.message)
    process.exit(1)
  }

  if (!subscriptions || subscriptions.length === 0) {
    console.log('Kayıtlı aktif bildirim abonesi bulunamadı.')
    return
  }

  console.log(`Veritabanında kayıtlı toplam ${subscriptions.length} cihaz bulundu.`)

  // 2. In streak warning mode, filter out users who already completed their 10-word target today
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
    } else if (isServiceRole && supabase.auth?.admin?.getUserById) {
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

    console.log(`Bugünkü tekrarını tamamlayan ${skippedCompletedCount} cihaz elendi.`)

    if (targetSubscriptions.length === 0) {
      console.log('🎉 Harika! Tüm aboneler bugünkü 10 kelimelik tekrarını tamamlamış. Bildirim gönderilmedi.')
      return
    }
  }

  console.log(`Bildirim gönderilecek hedef cihaz sayısı: ${targetSubscriptions.length}`)

  // 3. Construct payload
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
      console.log(`✓ Gönderildi: ${sub.id} (${sub.user_agent?.substring(0, 30) || 'Bilinmeyen'})`)
    } catch (err) {
      failedCount++
      console.warn(`✗ Hata (${sub.id}):`, err.statusCode || err.message)

      if (err.statusCode === 404 || err.statusCode === 410) {
        expiredEndpoints.push(sub.endpoint)
      }
    }
  }

  // Cleanup expired subscriptions
  if (expiredEndpoints.length > 0) {
    console.log(`${expiredEndpoints.length} adet süresi dolmuş abonelik veritabanından temizleniyor...`)
    try {
      await supabase.rpc('delete_expired_push_subscriptions', { endpoints: expiredEndpoints })
    } catch (_) {
      await supabase.from('push_subscriptions').delete().in('endpoint', expiredEndpoints)
    }
  }

  console.log('--- Gönderim Tamamlandı ---')
  console.log(`Başarılı: ${successCount}, Başarısız: ${failedCount}, Atlanan (tamamlamış): ${skippedCompletedCount}, Temizlenen: ${expiredEndpoints.length}`)
}

sendReminders().catch(err => {
  console.error('Kritik Hata:', err)
  process.exit(1)
})
