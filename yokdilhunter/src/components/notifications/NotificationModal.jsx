import { useState, useEffect } from 'react'
import {
  isPushSupported,
  getNotificationPermission,
  checkIsSubscribed,
  subscribeToPush,
  unsubscribeFromPush,
  sendLocalTestNotification,
} from '../../lib/notifications'
import { useAuth } from '../../hooks/useAuth'

export function NotificationModal({ isOpen, onClose }) {
  const { user } = useAuth()
  const [supported, setSupported] = useState(true)
  const [permission, setPermission] = useState('default')
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [testSent, setTestSent] = useState(false)
  const [errorMsg, setErrorMsg] = useState(null)

  useEffect(() => {
    if (!isOpen) return
    const isSupp = isPushSupported()
    setSupported(isSupp)
    if (!isSupp) return

    setPermission(getNotificationPermission())
    checkIsSubscribed(user?.id).then(sub => setIsSubscribed(sub))
  }, [isOpen, user?.id])

  if (!isOpen) return null

  async function handleToggleSubscription() {
    setLoading(true)
    setErrorMsg(null)
    try {
      if (isSubscribed) {
        await unsubscribeFromPush(user?.id)
        setIsSubscribed(false)
      } else {
        await subscribeToPush(user?.id)
        setIsSubscribed(true)
        setPermission(getNotificationPermission())
        // Send instant test notification on subscribe
        try {
          await sendLocalTestNotification()
          setTestSent(true)
        } catch (_) {}
      }
    } catch (err) {
      setErrorMsg(err.message || 'İşlem sırasında bir hata oluştu.')
    } finally {
      setLoading(false)
    }
  }

  async function handleTestNotification() {
    setErrorMsg(null)
    try {
      if (user?.id) {
        await subscribeToPush(user.id)
      }
      await sendLocalTestNotification()
      setTestSent(true)
      setTimeout(() => setTestSent(false), 4000)
    } catch (err) {
      setErrorMsg(err.message)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-base-800 border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl relative animate-scale-up">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors"
          title="Kapat"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-xl shadow-glow-orange">
            🔔
          </div>
          <div>
            <h3 className="text-lg font-bold text-white leading-tight">Kelime Hatırlatıcı</h3>
            <p className="text-xs text-slate-400">Günde 2 kez telefon bildirimi</p>
          </div>
        </div>

        {/* Schedule Info Box */}
        <div className="p-3.5 rounded-xl bg-base-900/60 border border-white/5 mb-4 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400 flex items-center gap-1.5 font-medium">
              <span>⏰</span> Hatırlatma Saatleri:
            </span>
            <span className="font-bold text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
              10:00 & 22:00
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400 flex items-center gap-1.5 font-medium">
              <span>📱</span> Bildirim Durumu:
            </span>
            <span
              className={`font-semibold px-2 py-0.5 rounded-md text-[11px] ${
                isSubscribed
                  ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                  : permission === 'denied'
                  ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                  : 'bg-white/5 text-slate-400 border border-white/10'
              }`}
            >
              {isSubscribed ? 'Aktif (Açık) ✅' : permission === 'denied' ? 'Engellendi 🚫' : 'Kapalı 🔕'}
            </span>
          </div>
        </div>

        {/* Unsupported Warning */}
        {!supported && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-300 text-xs mb-4">
            Bu tarayıcı veya cihaz Web Push bildirimlerini desteklemiyor. Chrome, Edge veya iOS'ta "Ana Ekrana Ekle" yaparak açabilirsiniz.
          </div>
        )}

        {/* Permission Denied Warning */}
        {permission === 'denied' && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-300 text-xs mb-4 space-y-1">
            <p className="font-semibold">⚠️ Bildirim izni tarayıcıdan engellenmiş.</p>
            <p className="text-[11px] opacity-85">
              Bildirim alabilmek için tarayıcınızın site ayarlarından (adres çubuğundaki kilit simgesinden) bildirim iznini "İzin Ver" olarak değiştirmeniz gerekir.
            </p>
          </div>
        )}

        {/* Error Message */}
        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-300 text-xs mb-4">
            {errorMsg}
          </div>
        )}

        {/* Test Sent Notification */}
        {testSent && (
          <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs mb-4 flex items-center gap-2">
            <span>🎉</span>
            <span>Test bildirimi telefonunuza / tarayıcınıza gönderildi!</span>
          </div>
        )}

        {/* Actions */}
        <div className="space-y-2.5">
          <button
            type="button"
            disabled={!supported || loading || permission === 'denied'}
            onClick={handleToggleSubscription}
            className={`w-full py-2.5 px-4 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-40 disabled:cursor-not-allowed ${
              isSubscribed
                ? 'bg-base-700 hover:bg-base-600 text-slate-200 border border-white/10'
                : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white shadow-amber-500/20 active:scale-98'
            }`}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                İşleniyor...
              </span>
            ) : isSubscribed ? (
              <>
                <span>🔕</span> Bildirimleri Kapat
              </>
            ) : (
              <>
                <span>🔔</span> Bildirimleri Aç (10:00 & 22:00)
              </>
            )}
          </button>

          {isSubscribed && (
            <button
              type="button"
              onClick={handleTestNotification}
              className="w-full py-2 px-4 rounded-xl font-semibold text-xs text-slate-300 bg-white/5 hover:bg-white/10 border border-white/5 transition-all flex items-center justify-center gap-1.5"
            >
              <span>🧪</span> Test Bildirimi Gönder
            </button>
          )}
        </div>

        {/* Device Tips */}
        <div className="mt-5 pt-4 border-t border-white/5 text-[11px] text-slate-400 space-y-1.5">
          <p className="flex items-start gap-1.5">
            <span className="text-xs">📱</span>
            <span>
              <strong className="text-slate-300">iPhone:</strong> Safari'de alt kısımdaki <em>Paylaş</em> butonuna basıp <strong>"Ana Ekrana Ekle"</strong> yaparak uygulamayı açtıktan sonra bildirimlere izin vermelisiniz.
            </span>
          </p>
          <p className="flex items-start gap-1.5">
            <span className="text-xs">🤖</span>
            <span>
              <strong className="text-slate-300">Android:</strong> Chrome veya yüklü PWA üzerinden doğrudan izin vererek bildirimleri alabilirsiniz.
            </span>
          </p>
        </div>
      </div>
    </div>
  )
}
