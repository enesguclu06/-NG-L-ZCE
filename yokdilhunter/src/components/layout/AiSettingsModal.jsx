import { useState } from 'react'
import { getGeminiApiKey, setGeminiApiKey, fetchExampleSentence, getTranslationMode, setTranslationMode, fetchGeminiTranslation } from '../../lib/api'

export function AiSettingsModal({ isOpen, onClose }) {
  const currentKey = getGeminiApiKey()
  const isFromEnv = !!(typeof import.meta !== 'undefined' && import.meta.env?.VITE_GEMINI_API_KEY)
  const [apiKey, setApiKey] = useState(currentKey)
  const [transMode, setTransMode] = useState(getTranslationMode)
  const [showKey, setShowKey] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState(null)
  const [savedSuccess, setSavedSuccess] = useState(false)

  if (!isOpen) return null

  function handleSave(e) {
    e.preventDefault()
    setGeminiApiKey(apiKey.trim())
    setTranslationMode(transMode)
    setSavedSuccess(true)
    setTimeout(() => setSavedSuccess(false), 2500)
  }

  function handleClear() {
    setApiKey('')
    setGeminiApiKey('')
    setTestResult(null)
  }

  async function handleTest() {
    setTesting(true)
    setTestResult(null)
    try {
      // Temporarily set to test
      setGeminiApiKey(apiKey.trim())
      const [sampleSentence, sampleTrans] = await Promise.all([
        fetchExampleSentence('ephemeral'),
        fetchGeminiTranslation('ephemeral', apiKey.trim())
      ])
      setTestResult({
        success: true,
        sentence: sampleSentence,
        meanings: sampleTrans || 'Alınamadı'
      })
    } catch (err) {
      setTestResult({ success: false, text: err.message || 'Bağlantı hatası' })
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div 
        className="w-full max-w-md bg-base-800 border border-white/10 rounded-2xl p-6 shadow-2xl relative overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/[0.08]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-primary-500 to-indigo-500 flex items-center justify-center shadow-glow-primary">
              <span className="text-sm">✨</span>
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Yapay Zeka (Gemini AI) Ayarı</h3>
              <p className="text-xs text-slate-400">YÖKDİL / YDS seviyesinde örnek cümleler</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/5 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Status Badge */}
        <div className="my-4 p-3 rounded-xl bg-base-900/60 border border-white/5 flex items-center justify-between">
          <span className="text-xs text-slate-400">Aktif Cümle Motoru:</span>
          {apiKey.trim() ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              Gemini AI Aktif
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
              Wikipedia & Sözlük Motoru
            </span>
          )}
        </div>

        {/* Description */}
        <p className="text-xs text-slate-300 leading-relaxed mb-4">
          Google AI Studio'dan <b>ücretsiz</b> alacağınız Gemini API anahtarı ile akademik seviyede kusursuz örnek cümleler üretebilirsiniz. Boş bırakırsanız sistem Wikipedia ve açık kaynak sözlüklerden gerçek cümleleri çeker.
        </p>

        {/* Form */}
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-slate-300">
                Gemini API Key
              </label>
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-primary-400 hover:text-primary-300 underline underline-offset-2 flex items-center gap-0.5"
              >
                Ücretsiz Key Al ↗
              </a>
            </div>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="AIzaSy..."
                className="w-full bg-base-900 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-primary-500 transition-colors pr-16"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-slate-400 hover:text-slate-200 px-1.5 py-1"
              >
                {showKey ? 'Gizle' : 'Göster'}
              </button>
            </div>
            {isFromEnv && (
              <span className="text-[10px] text-slate-500 mt-1 block">
                (.env dosyasından da okunabilir)
              </span>
            )}
          </div>

          {/* Translation Mode Choice */}
          <div className="pt-1">
            <label className="text-xs font-medium text-slate-300 block mb-1.5">
              Varsayılan Çeviri & Kayıt Sistemi
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setTransMode('ai')}
                className={`p-2 rounded-xl border text-left transition-all ${
                  transMode === 'ai'
                    ? 'bg-primary-500/15 border-primary-500/50 text-white'
                    : 'bg-base-900/40 border-white/5 text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="text-xs font-bold flex items-center gap-1">
                  <span>✨</span> Yeni Sistem (AI)
                </div>
                <div className="text-[10px] opacity-75 mt-0.5">En çok kullanılan 4 anlam</div>
              </button>

              <button
                type="button"
                onClick={() => setTransMode('classic')}
                className={`p-2 rounded-xl border text-left transition-all ${
                  transMode === 'classic'
                    ? 'bg-amber-500/15 border-amber-500/50 text-white'
                    : 'bg-base-900/40 border-white/5 text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="text-xs font-bold flex items-center gap-1">
                  <span>⚡</span> Eski Sistem
                </div>
                <div className="text-[10px] opacity-75 mt-0.5">Klasik Google & Sözlük</div>
              </button>
            </div>
          </div>

          {/* Test & Status Feedback */}
          {testResult && (
            <div className={`p-3 rounded-xl text-xs border space-y-1.5 ${testResult.success ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200' : 'bg-red-500/10 border-red-500/30 text-red-300'}`}>
              <div className="font-semibold">
                {testResult.success ? '✓ AI Testi Başarılı:' : '✕ Test Başarısız:'}
              </div>
              {testResult.success ? (
                <>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400">4 Anlam: </span>
                    <span className="font-medium text-white">{testResult.meanings}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400">Örnek Cümle: </span>
                    <span className="italic text-slate-300">"{testResult.sentence}"</span>
                  </div>
                </>
              ) : (
                <div className="italic text-[11px] opacity-90">{testResult.text}</div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 pt-2">
            <button
              type="submit"
              className="flex-1 bg-gradient-to-r from-primary-500 to-indigo-600 hover:from-primary-600 hover:to-indigo-700 text-white font-medium text-xs py-2.5 px-4 rounded-xl shadow-glow-primary transition-all active:scale-[0.98]"
            >
              {savedSuccess ? '✓ Kaydedildi' : 'Kaydet'}
            </button>
            
            <button
              type="button"
              disabled={testing}
              onClick={handleTest}
              className="px-3.5 py-2.5 rounded-xl border border-white/10 hover:bg-white/5 text-xs text-slate-300 transition-colors disabled:opacity-50"
            >
              {testing ? 'Test Ediliyor...' : 'Test Et'}
            </button>

            {apiKey && (
              <button
                type="button"
                onClick={handleClear}
                className="px-3 py-2.5 rounded-xl text-xs text-rose-400 hover:bg-rose-500/10 transition-colors"
                title="Anahtarı temizle"
              >
                Sil
              </button>
            )}
          </div>
        </form>

        <div className="mt-4 pt-3 border-t border-white/5 text-[11px] text-slate-500 text-center">
          🔒 API anahtarınız sunucuya gönderilmez, sadece kendi tarayıcınızda saklanır.
        </div>
      </div>
    </div>
  )
}
