import { supabase } from './supabase'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || 'BE7AhbJfl8S5A11XPA3Ck8tYMjsuNrvPSPB7IOceRoHh9S7XuFKGVpF9jmuFc_Mk4Bcfk18eMJ6RL-ZVX3s5Fw8'

/**
 * Checks if Push notifications and Service Workers are supported in the current environment.
 */
export function isPushSupported() {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

/**
 * Gets the current notification permission state: 'granted' | 'denied' | 'default' | 'unsupported'
 */
export function getNotificationPermission() {
  if (!isPushSupported()) return 'unsupported'
  return Notification.permission
}

/**
 * Converts a base64 string to a Uint8Array for applicationServerKey.
 */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

/**
 * Checks if the current browser already has an active push subscription in Supabase.
 */
export async function checkIsSubscribed(userId) {
  if (!isPushSupported()) return false

  try {
    const reg = await navigator.serviceWorker.ready
    const subscription = await reg.pushManager.getSubscription()
    if (!subscription) return false

    if (!userId) return true

    // Verify subscription exists in Supabase
    const { data, error } = await supabase
      .from('push_subscriptions')
      .select('id')
      .eq('user_id', userId)
      .eq('endpoint', subscription.endpoint)
      .maybeSingle()

    if (error) {
      console.warn('Subscription check error:', error)
      return true
    }

    return !!data
  } catch (err) {
    console.error('checkIsSubscribed failed:', err)
    return false
  }
}

/**
 * Subscribes the user to Web Push and saves the subscription to Supabase.
 */
export async function subscribeToPush(userId) {
  if (!isPushSupported()) {
    throw new Error('Tarayıcınız veya cihazınız Web Push bildirimlerini desteklemiyor.')
  }

  // 1. Request permission
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    throw new Error('Bildirim izni verilmedi. Tarayıcı ayarlarından izin vermeniz gerekiyor.')
  }

  // 2. Wait for service worker
  const reg = await navigator.serviceWorker.ready

  // 3. Get existing subscription or create new
  let subscription = await reg.pushManager.getSubscription()
  if (!subscription) {
    subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    })
  }

  // 4. Extract keys
  const rawP256dh = subscription.getKey('p256dh')
  const rawAuth = subscription.getKey('auth')

  if (!rawP256dh || !rawAuth) {
    throw new Error('Push abonelik anahtarları alınamadı.')
  }

  const p256dh = btoa(String.fromCharCode.apply(null, new Uint8Array(rawP256dh)))
  const auth = btoa(String.fromCharCode.apply(null, new Uint8Array(rawAuth)))

  // 5. Save to Supabase
  if (userId) {
    const { error: dbErr } = await supabase
      .from('push_subscriptions')
      .upsert({
        user_id: userId,
        endpoint: subscription.endpoint,
        p256dh,
        auth,
        user_agent: navigator.userAgent,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'endpoint' })

    if (dbErr) {
      console.error('Supabase subscription save error:', dbErr)
      throw new Error(`Abonelik kaydedilemedi: ${dbErr.message}`)
    }
  }

  return subscription
}

/**
 * Unsubscribes the user from Web Push and removes it from Supabase.
 */
export async function unsubscribeFromPush(userId) {
  if (!isPushSupported()) return

  try {
    const reg = await navigator.serviceWorker.ready
    const subscription = await reg.pushManager.getSubscription()

    if (subscription) {
      const endpoint = subscription.endpoint
      await subscription.unsubscribe()

      if (userId) {
        await supabase
          .from('push_subscriptions')
          .delete()
          .eq('user_id', userId)
          .eq('endpoint', endpoint)
      }
    }
  } catch (err) {
    console.error('unsubscribeFromPush failed:', err)
    throw err
  }
}

/**
 * Sends an immediate local test notification to demonstrate the banner and sound on the device.
 */
export async function sendLocalTestNotification() {
  if (!isPushSupported()) {
    throw new Error('Cihazınız bildirimleri desteklemiyor.')
  }

  if (Notification.permission !== 'granted') {
    throw new Error('Önce bildirim iznini açmanız gerekiyor.')
  }

  const reg = await navigator.serviceWorker.ready
  await reg.showNotification('YOKDILHUNTER 🎯', {
    body: 'Harika! Telefon bildirimlerin başarıyla açıldı. Her gün 10:00 ve 22:00\'de hatırlatıcı alacaksın. 🎉',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    vibrate: [200, 100, 200],
    tag: 'yokdilhunter-test',
    data: { url: '/review' },
  })
}
