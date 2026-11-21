import { useState, useEffect, useRef, useCallback } from 'react'
import { playSuccessChime } from '../../lib/audio'

/**
 * Levenshtein distance based string similarity (0.0 to 1.0)
 */
function getSimilarity(s1, s2) {
  const str1 = s1.toLowerCase().trim().replace(/[^a-z0-9]/g, '')
  const str2 = s2.toLowerCase().trim().replace(/[^a-z0-9]/g, '')

  if (!str1 || !str2) return 0
  if (str1 === str2) return 1

  const m = str1.length
  const n = str2.length
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0))

  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1]
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
      }
    }
  }

  const distance = dp[m][n]
  const maxLen = Math.max(m, n)
  return Math.max(0, 1 - distance / maxLen)
}

export function PronunciationModal({ isOpen, onClose, word }) {
  const [listening, setListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [score, setScore] = useState(null)
  const [errorMsg, setErrorMsg] = useState('')
  const recognitionRef = useRef(null)

  const isSpeechSupported = typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)

  const targetWord = word?.english_word || ''

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop()
      } catch {}
      recognitionRef.current = null
    }
    setListening(false)
  }, [])

  const startListening = useCallback(() => {
    if (!isSpeechSupported) {
      setErrorMsg('Tarayıcınız ses tanımayı desteklemiyor. Chrome veya Edge kullanabilirsiniz.')
      return
    }

    try {
      window.speechSynthesis?.cancel()
      stopListening()

      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
      const recognition = new SpeechRecognition()
      recognition.lang = 'en-US'
      recognition.interimResults = false
      recognition.maxAlternatives = 1
      recognitionRef.current = recognition

      recognition.onstart = () => {
        setListening(true)
        setErrorMsg('')
        setTranscript('')
        setScore(null)
      }

      recognition.onresult = (event) => {
        const result = event.results[0][0].transcript
        setTranscript(result)
        const sim = getSimilarity(targetWord, result)
        const percentage = Math.round(sim * 100)
        setScore(percentage)

        // 🔔 Play Duolingo-style "dı-dıng!" chime if correct (>=80% or exact match)
        if (percentage >= 80 || sim >= 0.8) {
          playSuccessChime()
        }
      }

      recognition.onerror = (e) => {
        console.warn('Speech recognition error:', e)
        if (e.error === 'not-allowed') {
          setErrorMsg('Mikrofon izni verilmedi. Lütfen tarayıcı ayarlarından mikrofona izin verin.')
        } else if (e.error === 'no-speech') {
          setErrorMsg('Ses algılanamadı. Mikrofona biraz daha yakın konuşmayı deneyin.')
        } else {
          setErrorMsg('Ses algılanamadı. "Tekrar Söyle"ye basıp konuşun.')
        }
        setListening(false)
      }

      recognition.onend = () => {
        setListening(false)
      }

      recognition.start()
    } catch (err) {
      console.error(err)
      setListening(false)
      setErrorMsg('Mikrofon başlatılamadı.')
    }
  }, [isSpeechSupported, targetWord, stopListening])

  // 🚀 Auto-start listening on modal open!
  useEffect(() => {
    if (isOpen && word) {
      setTranscript('')
      setScore(null)
      setErrorMsg('')

      // Start listening automatically after modal opens
      const timer = setTimeout(() => {
        startListening()
      }, 300)

      return () => {
        clearTimeout(timer)
        stopListening()
      }
    } else {
      stopListening()
      setTranscript('')
      setScore(null)
      setErrorMsg('')
    }
  }, [isOpen, word?.id, startListening, stopListening])

  useEffect(() => {
    function handleKeyDown(e) {
      if (!isOpen) return
      if (e.key === 'Escape') onClose?.()
      if (e.key === ' ' && !listening) {
        e.preventDefault()
        startListening()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose, listening, startListening])

  if (!isOpen || !word) return null

  function playNativeAudio() {
    if (!window.speechSynthesis) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(targetWord)
    utterance.lang = 'en-US'
    utterance.rate = 0.85
    window.speechSynthesis.speak(utterance)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-base-950/80 backdrop-blur-md animate-fade-in">
      <div className="glass rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-white/15 relative overflow-hidden animate-card-appear text-center">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 transition-colors"
        >
          ✕
        </button>

        {/* Badge */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary-500/15 border border-primary-500/30 text-primary-300 text-xs font-semibold mb-3">
          <span>🎙️</span>
          <span>Sesli Telaffuz Modu</span>
        </div>

        {/* Target Word */}
        <div className="mb-2">
          <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">{targetWord}</h2>
          {word.phonetic && (
            <p className="text-sm font-mono text-primary-400 mt-1">{word.phonetic}</p>
          )}
          {word.turkish_translation && (
            <p className="text-xs text-slate-400 mt-1 font-medium">{word.turkish_translation}</p>
          )}
        </div>

        {/* Listen Native Audio button */}
        <button
          onClick={playNativeAudio}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-slate-200 hover:text-white border border-white/10 transition-all mb-4"
        >
          <span>🔊</span>
          <span>Doğru Okunuşu Dinle</span>
        </button>

        {/* Dynamic Mic Circle */}
        <div className="flex flex-col items-center justify-center py-2">
          <div className="relative">
            {listening && (
              <div className="absolute inset-0 rounded-full bg-red-500/30 animate-ping pointer-events-none scale-150" />
            )}
            <button
              onClick={listening ? stopListening : startListening}
              className={`w-24 h-24 rounded-full flex flex-col items-center justify-center transition-all duration-300 relative z-10 shadow-2xl ${
                listening
                  ? 'bg-red-500 hover:bg-red-600 text-white scale-110 shadow-[0_0_30px_rgba(239,68,68,0.7)] animate-pulse'
                  : score >= 80
                    ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-[0_0_30px_rgba(52,211,153,0.6)]'
                    : 'bg-gradient-to-br from-primary-500 to-indigo-600 hover:scale-105 text-white shadow-glow-primary'
              }`}
            >
              <span className="text-3xl">
                {listening ? '⏹️' : score >= 80 ? '🌟' : '🎙️'}
              </span>
              <span className="text-[10px] font-bold mt-1 uppercase tracking-wider">
                {listening ? 'Dinliyor...' : score !== null ? 'Tekrar' : 'Dinliyor'}
              </span>
            </button>
          </div>

          <p className="text-xs font-semibold text-slate-300 mt-4">
            {listening ? (
              <span className="text-red-400 animate-pulse">
                🎙️ Otomatik dinleme aktif! Şimdi İngilizce söyleyin...
              </span>
            ) : score !== null ? (
              'Sonucu aşağıda görebilirsiniz.'
            ) : (
              'Mikrofon açılıyor...'
            )}
          </p>
        </div>

        {/* Error message */}
        {errorMsg && (
          <div className="p-3 rounded-2xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs my-3">
            {errorMsg}
          </div>
        )}

        {/* Recognition Result with Duolingo Style Success Effect */}
        {score !== null && (
          <div className={`p-4 rounded-2xl border text-left mt-3 transition-all ${
            score >= 80
              ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-300 shadow-[0_0_20px_rgba(52,211,153,0.35)] animate-card-appear'
              : score >= 50
                ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                : 'bg-red-500/15 border-red-500/40 text-red-300'
          }`}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
                {score >= 80 ? '🎉 Dı-Dıng! Mükemmel!' : score >= 50 ? '🟡 Çok Yakın!' : '❌ Tekrar Dene!'}
              </span>
              <span className="text-base font-black font-mono">%{score} Uyum</span>
            </div>
            <p className="text-xs text-slate-300">
              <span className="opacity-75">Duyulan:</span>{' '}
              <strong className="text-white">"{transcript}"</strong>
            </p>
            {score < 80 && (
              <p className="text-[11px] text-slate-400 mt-2">
                İpucu: "Doğru Okunuşu Dinle" butonuna tıklayıp sesi dikkatle tekrar dinleyin.
              </p>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="mt-5 flex gap-2">
          {!listening && (
            <button
              onClick={startListening}
              className="btn-primary flex-1 py-3 text-xs font-bold shadow-glow-primary flex items-center justify-center gap-1.5"
            >
              <span>🎙️</span>
              <span>Tekrar Konuş</span>
            </button>
          )}
          <button
            onClick={onClose}
            className={`py-3 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/10 text-slate-300 transition-colors ${
              listening ? 'w-full' : 'px-5'
            }`}
          >
            Kapat
          </button>
        </div>
      </div>
    </div>
  )
}
