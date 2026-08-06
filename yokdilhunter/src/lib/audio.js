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

