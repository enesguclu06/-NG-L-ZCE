/**
 * YOKDILHUNTER — Web Push Reminder Dispatcher
 * Can be run manually or via cron (GitHub Actions, Supabase, cron-job.org).
 * Sends reminder notifications to all active subscribed devices.
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
  console.log('--- YOKDILHUNTER Hatırlatıcı Gönderimi Başlatılıyor ---')
  console.log(`Zaman: ${new Date().toISOString()}`)
  console.log(`Yetki Tipi: ${isServiceRole ? 'Service Role (Admin - RLS Devre Dışı) ✅' : 'Anon Key (RLS Devrede) ⚠️'}`)

  // 1. Fetch all push subscriptions
  const { data: subscriptions, error } = await supabase
    .from('push_subscriptions')
    .select('*')

  if (error) {
    console.error('Abonelikler çekilemedi:', error.message)
    if (error.message.includes('permission denied')) {
      console.error('⚠️ İpucu: push_subscriptions tablosunda RLS aktif. GitHub Secrets içinde SUPABASE_SERVICE_KEY anahtarı tanımlı olmalıdır.')
    }
    process.exit(1)
  }

  if (!subscriptions || subscriptions.length === 0) {
    console.log('Kayıtlı aktif bildirim abonesi bulunamadı.')
    return

  }

  console.log(`Toplam ${subscriptions.length} cihaza bildirim gönderilecek.`)

  const payload = JSON.stringify({
    title: 'YOKDILHUNTER 🎯',
    body: 'Kelime ezberleme vakti! Bugün tekrar etmen gereken kelimeleri unutma 📚',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
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
      console.log(`✓ Gönderildi: ${sub.id} (${sub.user_agent?.substring(0, 30) || 'Bilinmeyen'})`)
    } catch (err) {
      failedCount++
      console.warn(`✗ Hata (${sub.id}):`, err.statusCode || err.message)

      // 404 or 410 means subscription is expired or unsubscribed on device
      if (err.statusCode === 404 || err.statusCode === 410) {
        expiredEndpoints.push(sub.endpoint)
      }
    }
  }

  // Cleanup expired subscriptions
  if (expiredEndpoints.length > 0) {
    console.log(`${expiredEndpoints.length} adet süresi dolmuş abonelik veritabanından temizleniyor...`)
    await supabase
      .from('push_subscriptions')
      .delete()
      .in('endpoint', expiredEndpoints)
  }

  console.log('--- Gönderim Tamamlandı ---')
  console.log(`Başarılı: ${successCount}, Başarısız: ${failedCount}, Temizlenen: ${expiredEndpoints.length}`)
}

sendReminders().catch(err => {
  console.error('Kritik Hata:', err)
  process.exit(1)
})
