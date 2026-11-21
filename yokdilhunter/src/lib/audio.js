/**
 * Plays the pronunciation of a given word using the native SpeechSynthesis API.
 * Forces English language. Waits for voices to load if they aren't ready yet.
 */
function getBestEnglishVoice() {
  const voices = window.speechSynthesis.getVoices()
  // Prefer Google US English, then any US, then any English
  return (
    voices.find(v => v.lang === 'en-US' && v.name.toLowerCase().includes('google')) ||
    voices.find(v => v.lang === 'en-US') ||
    voices.find(v => v.lang === 'en-GB') ||
    voices.find(v => v.lang.startsWith('en'))
  ) ?? null
}

export function playAudio(word) {
  if (!window.speechSynthesis) return

  window.speechSynthesis.cancel()

  function speak() {
    const utterance = new SpeechSynthesisUtterance(word)
    utterance.lang = 'en-US'  // Force English regardless of voice
    utterance.rate = 0.9
    utterance.pitch = 1.0

    const voice = getBestEnglishVoice()
    if (voice) utterance.voice = voice

    window.speechSynthesis.speak(utterance)
  }

  // Voices may not be loaded yet on first call — wait for them
  const voices = window.speechSynthesis.getVoices()
  if (voices.length > 0) {
    speak()
  } else {
    window.speechSynthesis.onvoiceschanged = () => {
      window.speechSynthesis.onvoiceschanged = null
      speak()
    }
  }
}

/**
 * Plays a cheerful Duolingo-style rising "dı-dıng!" chime using Web Audio API.
 * High fidelity, zero external asset dependencies, zero latency.
 */
export function playSuccessChime() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    const now = ctx.currentTime

    // First Ding (D5 - 587.33 Hz)
    const osc1 = ctx.createOscillator()
    const gain1 = ctx.createGain()
    osc1.type = 'sine'
    osc1.frequency.setValueAtTime(587.33, now)
    gain1.gain.setValueAtTime(0, now)
    gain1.gain.linearRampToValueAtTime(0.35, now + 0.015)
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.28)
    osc1.connect(gain1)
    gain1.connect(ctx.destination)
    osc1.start(now)
    osc1.stop(now + 0.28)

    // Second Ding (A5 / C6 high chime - 1046.5 Hz) — The iconic "dı-DIIIING!"
    const osc2 = ctx.createOscillator()
    const gain2 = ctx.createGain()
    osc2.type = 'sine'
    osc2.frequency.setValueAtTime(880, now + 0.1)
    osc2.frequency.exponentialRampToValueAtTime(1046.5, now + 0.16)
    gain2.gain.setValueAtTime(0, now + 0.1)
    gain2.gain.linearRampToValueAtTime(0.4, now + 0.12)
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.65)
    osc2.connect(gain2)
    gain2.connect(ctx.destination)
    osc2.start(now + 0.1)
    osc2.stop(now + 0.65)
  } catch (e) {
    console.warn('Success chime error:', e)
  }
}

