import { fetchTurkishPhonetic } from './phonetic.js'
import { GEMINI_API_KEY } from '../config.js'

/**
 * Fetches word data from multiple free APIs in parallel:
 *   1. dictionaryapi.dev → phonetic + definition + some synonyms
 *      (all proxy fallbacks raced in parallel — much faster than sequential)
 *   2. Wiktionary REST API → definition fallback
 *   3. Datamuse API        → richer synonyms
 *   4. MyMemory + Google Translate informal API → Turkish translation
 */
export async function getTranslationMode() {
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    try {
      const data = await chrome.storage.local.get(['translation_mode'])
      if (data?.translation_mode) return data.translation_mode
    } catch {}
  }
  return 'ai'
}

export async function setTranslationMode(mode) {
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    try {
      await chrome.storage.local.set({ translation_mode: mode === 'classic' ? 'classic' : 'ai' })
    } catch {}
  }
}

export async function fetchWordData(word, contextSentence = null, mode = null) {
  const selectedMode = mode || await getTranslationMode()
  const trimmed = word.trim().toLowerCase()
  const errors = []

  // If a context sentence was captured directly from the page, prioritize it
  const hasValidContext = contextSentence && typeof contextSentence === 'string' && contextSentence.trim().length >= 10
  const pageSentence = hasValidContext ? contextSentence.trim() : null

  const [dictResult, wiktResult, datumuseResult, translationResult, phoneticResult] = await Promise.allSettled([
    fetchDictionaryData(trimmed),
    fetchWiktionaryDefinition(trimmed),
    fetchDatamuseSynonyms(trimmed),
    fetchTranslation(trimmed),
    fetchTurkishPhonetic(trimmed),
  ])

  let phonetic = null
  let dictDefinition = null
  let dictExample = null
  let dictSynonyms = []

  if (dictResult.status === 'fulfilled') {
    phonetic       = dictResult.value.phonetic         ?? null
    dictDefinition = dictResult.value.definition      ?? null
    dictExample    = dictResult.value.example_sentence ?? null
    dictSynonyms   = dictResult.value.synonyms         ?? []
  }

  if (phoneticResult.status === 'fulfilled' && phoneticResult.value) {
    phonetic = phoneticResult.value
  }

  let wiktDefinition = null
  let wiktExample = null
  if (wiktResult.status === 'fulfilled' && wiktResult.value) {
    wiktDefinition = wiktResult.value.definition ?? null
    wiktExample    = wiktResult.value.example_sentence ?? null
  }

  let definition = pickBestDefinition(dictDefinition, wiktDefinition)
  let example_sentence = dictExample ?? wiktExample ?? null

  // Check if definition is a grammatical inflection pointer (e.g. "third-person singular simple present indicative of presume")
  const formRegex = /\b(?:third-person|simple past|past participle|present participle|plural|comparative|superlative|indicative|inflection|form) of (?:the )?(?:verb )?(?:noun )?(?:adjective )?([a-zA-Z-]+)/i
  const isGrammaticalForm = definition && formRegex.test(definition)

  let lemma = null
  if (isGrammaticalForm) {
    const m = definition.match(formRegex)
    if (m && m[1] && m[1].toLowerCase() !== trimmed) {
      lemma = m[1].toLowerCase()
    }
  }
  if (!lemma && (!example_sentence || isGrammaticalForm)) {
    lemma = detectLemma(trimmed)
  }

  // If an inflection lemma exists, query it to get base definition & example!
  if (lemma && lemma !== trimmed) {
    try {
      const [lemmaDict, lemmaWikt] = await Promise.allSettled([
        fetchDictionaryData(lemma),
        fetchWiktionaryDefinition(lemma)
      ])

      const lDictDef = lemmaDict.status === 'fulfilled' ? lemmaDict.value?.definition : null
      const lDictEx  = lemmaDict.status === 'fulfilled' ? lemmaDict.value?.example_sentence : null
      const lWiktDef = lemmaWikt.status === 'fulfilled' ? lemmaWikt.value?.definition : null
      const lWiktEx  = lemmaWikt.status === 'fulfilled' ? lemmaWikt.value?.example_sentence : null

      if (isGrammaticalForm) {
        const betterDef = pickBestDefinition(lDictDef, lWiktDef)
        if (betterDef) definition = betterDef
      }

      if (!example_sentence) {
        example_sentence = lDictEx ?? lWiktEx ?? null
      }
    } catch { /* silent */ }
  }

  // Resolve highest-quality example sentence:
  // (Gemini AI -> Dictionary -> Wiktionary Wikitext -> Wikipedia -> Tatoeba -> MyMemory -> Dynamic Fallback)
  example_sentence = await resolveBestSentence(trimmed, lemma, example_sentence)

  const datumuseSynonyms = datumuseResult.status === 'fulfilled' ? (datumuseResult.value ?? []) : []
  const synonyms = [...new Set([...datumuseSynonyms, ...dictSynonyms])].slice(0, 10)

  // Translation: Use AI top 4 meanings if selectedMode === 'ai', otherwise classic dictionary
  let turkish_translation = null
  if (selectedMode === 'ai') {
    try {
      const aiTrans = await fetchGeminiTranslation(trimmed)
      if (aiTrans) {
        turkish_translation = aiTrans
      }
    } catch { /* fallback to classic */ }
  }

  if (!turkish_translation) {
    if (translationResult.status === 'fulfilled') {
      turkish_translation = translationResult.value
    } else {
      errors.push(`Translation API: ${translationResult.reason?.message ?? 'Başarısız'}`)
    }
  }

  if (dictResult.status !== 'fulfilled' && !definition) {
    errors.push(`Dictionary API: ${dictResult.reason?.message ?? 'Bulunamadı'}`)
  }

  return { english_word: word.trim(), phonetic, definition, example_sentence, synonyms, turkish_translation, errors }
}

function pickBestDefinition(a, b) {
  const isJunk = (s) => !s || /\b(?:ISO\s*639|language code)\b/i.test(s)
  if (isJunk(a) && isJunk(b)) return null
  if (isJunk(a)) return b
  if (isJunk(b)) return a
  const clean = (s) => s.replace(/^[a-z]/, c => c.toUpperCase()).trim()
  const scoreA = a.length + (a.match(/;|\(|\[/) ? 30 : 0)
  const scoreB = b.length + (b.match(/;|\(|\[/) ? 30 : 0)
  return clean(scoreA <= scoreB ? a : b)
}

// ── Fetch with timeout ────────────────────────────────────────────────────────
async function fetchWithTimeout(url, timeoutMs = 5000, options = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('Bağlantı zaman aşımına uğradı')
    throw err
  } finally {
    clearTimeout(timer)
  }
}

// ── Free Dictionary API — race all proxies in parallel ────────────────────────
async function fetchDictionaryData(word) {
  const encoded = encodeURIComponent(word)
  const BASE = `https://api.dictionaryapi.dev/api/v2/entries/en/${encoded}`

  const urls = [
    BASE,
    `https://corsproxy.io/?${encodeURIComponent(BASE)}`,
    `https://api.allorigins.win/raw?url=${encodeURIComponent(BASE)}`,
  ]

  // Race all three — first successful one wins; use 2s timeout since blocked networks fail fast
  let data
  try {
    data = await Promise.any(
      urls.map(url =>
        fetchWithTimeout(url, 2000).then(async res => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          const json = await res.json()
          if (!Array.isArray(json) || json.length === 0) throw new Error('Boş yanıt')
          return json
        })
      )
    )
  } catch {
    throw new Error('Sözlük servisi kullanılamıyor')
  }

  const entry = data[0]

  // Phonetic
  let phonetic = entry.phonetic ?? null
  if (!phonetic && Array.isArray(entry.phonetics)) {
    phonetic = entry.phonetics.find(p => p.text)?.text ?? null
  }

  // Collect ALL definitions across all meanings, then pick the best one
  const candidates = []
  const synSet = new Set()

  for (const meaning of (entry.meanings ?? [])) {
    const pos = meaning.partOfSpeech ?? ''
    for (const def of (meaning.definitions ?? [])) {
      const text = def.definition?.trim()
      if (text && text.length > 10) {
        candidates.push({
          text: stripHtml(text),
          pos,
          example: def.example?.trim() ?? null
        })
      }
      for (const s of (def.synonyms ?? [])) synSet.add(s)
    }
    for (const s of (meaning.synonyms ?? [])) synSet.add(s)
  }

  // Score each candidate — prefer verb/adj, medium length, penalise short noun-list style
  const scored = candidates.map(c => {
    let score = 0
    if (c.pos === 'verb')      score += 30
    if (c.pos === 'adjective') score += 10
    if (c.text.length >= 30 && c.text.length <= 200) score += 20
    if (c.text.length < 20)   score -= 30
    if (/;/.test(c.text))     score -= 15
    if (/^[A-Z]/.test(c.text) && /[.!?]$/.test(c.text)) score += 10
    return { ...c, score }
  })
  scored.sort((a, b) => b.score - a.score)

  const best = scored[0] ?? null
  const definition       = best?.text ?? null
  // If the best-scoring definition has no example, fall back to the first candidate that does
  const exampleRaw = best?.example
    ?? scored.find(c => c.example)?.example
    ?? null
  const example_sentence = exampleRaw ? stripHtml(exampleRaw) : null

  return { phonetic, definition, example_sentence, synonyms: [...synSet].slice(0, 8) }
}

// ── Wiktionary REST API — definition fallback ─────────────────────────────────
async function fetchWiktionaryDefinition(word) {
  try {
    const res = await fetchWithTimeout(
      `https://en.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(word)}`,
      5000
    )
    if (!res.ok) return null

    const data = await res.json()
    let firstDefinition = null
    let fallbackExample = null

    for (const entry of (data?.en ?? [])) {
      for (const def of (entry.definitions ?? [])) {
        const text = stripHtml(def.definition ?? '')
        let example = null
        if (def.examples && def.examples.length > 0) {
          example = stripHtml(def.examples[0] ?? '')
        }

        // Reject language codes, ISO codes, abbreviations
        if (/\b(?:ISO\s*639|language code|initialism of|abbreviation of)\b/i.test(text)) continue

        if (text.length > 5) {
          if (!firstDefinition) firstDefinition = text
          if (example && !fallbackExample) fallbackExample = example
        }
      }
    }
    
    if (firstDefinition) {
      return { definition: firstDefinition, example_sentence: fallbackExample }
    }
    return null
  } catch {
    return null
  }
}

// ── Datamuse API — synonyms ────────────────────────────────────────────────────
async function fetchDatamuseSynonyms(word) {
  const [synRes, mlRes] = await Promise.allSettled([
    fetchWithTimeout(`https://api.datamuse.com/words?rel_syn=${encodeURIComponent(word)}&max=8`, 5000),
    fetchWithTimeout(`https://api.datamuse.com/words?ml=${encodeURIComponent(word)}&max=5`, 5000),
  ])

  const results = []
  if (synRes.status === 'fulfilled' && synRes.value.ok) {
    const d = await synRes.value.json()
    if (Array.isArray(d)) results.push(...d.map(x => x.word).filter(Boolean))
  }
  if (mlRes.status === 'fulfilled' && mlRes.value.ok) {
    const d = await mlRes.value.json()
    if (Array.isArray(d)) {
      for (const x of d.slice(0, 4)) {
        if (x.word && !results.includes(x.word)) results.push(x.word)
      }
    }
  }
  return results.slice(0, 10)
}

// ── Transliteration detector ──────────────────────────────────────────────────
// Rejects phonetic transcriptions like "ubikuitöz" for "ubiquitous"
function isTransliteration(original, translated) {
  if (!translated || translated.length < 2) return false

  const normalize = s => s.toLowerCase()
    .replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's')
    .replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ç/g, 'c')
    .replace(/[^a-z]/g, '')

  const a = normalize(original)
  const b = normalize(translated)

  const dp = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0))
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1] + 1
        : Math.max(dp[i - 1][j], dp[i][j - 1])
    }
  }
  const ratio = dp[a.length][b.length] / Math.max(a.length, b.length, 1)
  return ratio >= 0.62
}

// ── Turkish Translation ───────────────────────────────────────────────────────────────
// Runs 3 sources in parallel:
//   1. Google Translate (dict-chrome-ex + gtx clients)
//   2. Wiktionary Turkish translations (community-curated, high quality)
//   3. MyMemory
// Returns up to 4 meanings as a comma-separated string.
export async function fetchTranslation(word) {
  const collected = []

  // All 3 in parallel
  const [googleResult, wiktTrResult, myMemoryResult] = await Promise.allSettled([
    fetchGoogleTranslate(word),
    fetchWiktionaryTurkish(word),
    fetchMyMemory(word),
  ])

  // Helper: only short word/phrase translations (not sentences or verb conjugations)
  const isValidTranslation = (t) => {
    if (!t || typeof t !== 'string') return false
    const trimmed = t.trim()
    if (trimmed.length === 0 || trimmed.length > 50) return false
    if (trimmed.split(/\s+/).length > 5) return false
    if (trimmed.toLowerCase() === word.toLowerCase()) return false
    if (isTransliteration(word, trimmed)) return false
    // Reject Turkish conjugated verb forms with personal suffixes (sentence fragments)
    // Note: base infinitive (-mak/-mek) and simple -yor are NOT rejected
    if (/(?:sam|sem|s[ae]n|yorum|yorsun|yoruz|yorlar|d[ıi](?:m|n|k|lar)|m[ıi]?y[ıi]m|ince|[ae]lim)$/i.test(trimmed.split(/\s+/).pop() ?? '')) return false
    return true
  }

  const addUnique = (t) => {
    const trimmed = t?.trim()
    if (!trimmed) return
    const lower = trimmed.toLowerCase()
    if (!collected.some(c => c.toLowerCase() === lower)) {
      collected.push(trimmed)
    }
  }

  // 1. Google Translate (primary + alternates) — highest priority
  if (googleResult.status === 'fulfilled') {
    for (const t of googleResult.value) {
      if (isValidTranslation(t)) addUnique(t)
    }
  }

  // 2. Wiktionary Turkish (community-curated, high quality)
  if (wiktTrResult.status === 'fulfilled') {
    for (const t of wiktTrResult.value) {
      if (isValidTranslation(t)) addUnique(t)
    }
  }

  // 3. MyMemory — only primary translation, not matches (matches often contain sentences)
  if (myMemoryResult.status === 'fulfilled' && typeof myMemoryResult.value === 'string') {
    if (isValidTranslation(myMemoryResult.value)) addUnique(myMemoryResult.value)
  }

  const results = collected.slice(0, 3)

  if (results.length === 0) {
    throw new Error('Otomatik çeviri bulunamadı — lütfen Türkçe karşılığını kendin gir')
  }

  return results.join(', ')
}

// ── Google Translate — two clients in parallel for maximum coverage ────────────
async function fetchGoogleTranslate(word) {
  const [dictResult, gtxResult] = await Promise.allSettled([
    fetchGoogleDictClient(word),  // dict-chrome-ex: returns terms[] array
    fetchGoogleGtxClient(word),   // gtx + dt=at: returns alt translations
  ])

  const all = []
  if (dictResult.status === 'fulfilled') {
    for (const t of dictResult.value) all.push(t)
  }
  if (gtxResult.status === 'fulfilled') {
    for (const t of gtxResult.value) {
      if (!all.includes(t)) all.push(t)
    }
  }
  return all
}

// dict-chrome-ex: primary + dict section (data[3]), filtered to short phrases only
async function fetchGoogleDictClient(word) {
  const translations = []
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=dict-chrome-ex&sl=en&tl=tr&dt=t&dt=bd&q=${encodeURIComponent(word)}`
    const res = await fetchWithTimeout(url, 5000)
    if (!res.ok) return translations

    const data = await res.json()

    // Primary: data[0][0].trans
    const primaryTrans = data?.[0]?.[0]?.trans
    if (primaryTrans && typeof primaryTrans === 'string' && primaryTrans.trim().length > 0) {
      translations.push(primaryTrans.trim())
    }

    // Dictionary section: data[3] — sentence fragments filtered by isValidTranslation
    const dictSection = data?.[3]
    if (Array.isArray(dictSection)) {
      for (const posEntry of dictSection) {
        if (Array.isArray(posEntry?.terms)) {
          for (const term of posEntry.terms) {
            if (typeof term === 'string' && term.trim().length > 0 && !translations.includes(term.trim())) {
              translations.push(term.trim())
            }
            if (translations.length >= 6) break
          }
        }
        if (translations.length >= 6) break
      }
    }
  } catch { /* silent */ }
  return translations
}

// gtx client: primary + alternates for single words only
async function fetchGoogleGtxClient(word) {
  const translations = []
  try {
    const isPhrase = word.includes(' ')
    const url = isPhrase
      ? `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=tr&dt=t&q=${encodeURIComponent(word)}`
      : `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=tr&dt=t&dt=at&q=${encodeURIComponent(word)}`
    const res = await fetchWithTimeout(url, 5000)
    if (!res.ok) return translations
    const data = await res.json()
    const primary = data?.[0]?.[0]?.[0]
    if (primary && typeof primary === 'string' && primary.trim().length > 0) {
      translations.push(primary.trim())
    }
    if (!isPhrase) {
      const altSection = data?.[5]
      if (Array.isArray(altSection)) {
        for (const posGroup of altSection) {
          const alts = posGroup?.[2]
          if (!Array.isArray(alts)) continue
          for (const altEntry of alts) {
            const altWord = altEntry?.[0]
            if (typeof altWord === 'string' && altWord.trim().length > 0 && !translations.includes(altWord.trim())) {
              translations.push(altWord.trim())
            }
            if (translations.length >= 6) break
          }
          if (translations.length >= 6) break
        }
      }
    }
  } catch { /* silent */ }
  return translations
}

// ── MyMemory API ─────────────────────────────────────────────────────────────
// Returns only the primary translation (matches[] often contains full sentences, skip them)
async function fetchMyMemory(word) {
  try {
    const res = await fetchWithTimeout(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(word)}&langpair=en|tr`,
      5000
    )
    if (!res.ok) return ''
    const data = await res.json()
    if (data.responseStatus !== 200 && data.responseStatus !== '200') return ''

    // Only use the primary translation — matches[] contains example sentence translations
    const primary = data.responseData?.translatedText?.trim() ?? ''
    return primary
  } catch {
    return ''
  }
}

// ── Strip HTML tags ───────────────────────────────────────────────────────────
function stripHtml(html) {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// ── Wiktionary Turkish Translations ──────────────────────────────────────────
// Fetches the English Wiktionary page wikitext and extracts Turkish translations
// from the "Translations" section using {{t|tr|...}} and {{t+|tr|...}} templates.
//
// Example for "vast":
//   * Turkish: {{t+|tr|geniş}}, {{t+|tr|engin}}, {{t|tr|uçsuz bucaksız}}
//   → ["geniş", "engin", "uçsuz bucaksız"]
async function fetchWiktionaryTurkish(word) {
  try {
    const url = `https://en.wiktionary.org/w/api.php?action=parse&page=${encodeURIComponent(word)}&prop=wikitext&format=json&origin=*`
    const res = await fetchWithTimeout(url, 6000)
    if (!res.ok) return []

    const data = await res.json()
    const wikitext = data?.parse?.wikitext?.['*'] ?? ''

    if (!wikitext) return []

    // Scan the ENTIRE wikitext for ALL {{t|tr|...}} and {{t+|tr|...}} templates.
    // Handles polysemous words like "run" with many {{trans-top}} blocks.
    const results = []
    const templateRegex = /\{\{t\+?\|tr\|([^|}\]]+)/g
    let match
    while ((match = templateRegex.exec(wikitext)) !== null) {
      const term = match[1].trim()
      if (term && term.length > 0 && !results.includes(term)) {
        results.push(term)
      }
      if (results.length >= 8) break
    }

    return results
  } catch {
    return []  // Silent failure
  }
}

// ── Sentence Quality & Modernity Validator ──────────────────────────────────
export function isCleanModernSentence(text) {
  if (!text || typeof text !== 'string') return false
  const clean = text.trim()
  if (clean.length < 12 || clean.length > 160) return false
  if (!/^[A-Z]/.test(clean)) return false
  if (!/[.!?]$/.test(clean)) return false

  // Reject archaic / Shakespearean / biblical English words
  const archaicRegex = /\b(thou|thee|thy|thine|ye|didst|doth|dost|hath|art|wast|spake|unto|wherefore|whilst|thither|hither|saith|nay|prithee|thence|henceforth)\b/i
  if (archaicRegex.test(clean)) return false

  // Reject dictionary markup or non-English characters/codes
  if (/[{}[\]<>]/.test(clean)) return false

  // Word count constraint: keep it short & easy to memorize (4 to 16 words max)
  const wordCount = clean.split(/\s+/).length
  if (wordCount < 4 || wordCount > 16) return false

  return true
}

// ── Gemini AI Sentence Generator ──────────────────────────────────────────────
async function fetchGeminiSentence(word) {
  let key = typeof GEMINI_API_KEY === 'string' ? GEMINI_API_KEY.trim() : ''
  if (!key && typeof chrome !== 'undefined' && chrome.storage?.local) {
    try {
      const stored = await chrome.storage.local.get(['gemini_api_key'])
      if (stored?.gemini_api_key) key = stored.gemini_api_key.trim()
    } catch {}
  }
  if (!key || key.length < 8) return null

  // Short, clear, simple, easy-to-memorize sentence prompt
  const prompt = `Write a short, simple, modern English example sentence (maximum 10 to 14 words) clearly using the word "${word}". Keep it natural and very easy to memorize for English learners. Do NOT write long or complex academic sentences. Do NOT use archaic words (like thou, didst, etc.). Return ONLY the sentence itself, without quotation marks, translation, markdown, or extra explanations.`

  const models = ['gemini-3.5-flash', 'gemini-3.8-flash', 'gemini-flash-latest', 'gemini-3.7-flash', 'gemini-2.5-flash']
  for (const model of models) {
    try {
      const res = await fetchWithTimeout(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`,
        5000,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.3,
              maxOutputTokens: 200
            }
          })
        }
      )
      if (!res.ok) continue
      const data = await res.json()
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
      if (text && text.length >= 10 && text.length <= 180) {
        const clean = text.replace(/^["'`]+|["'`]+$/g, '').trim()
        if (isCleanModernSentence(clean)) {
          return clean
        }
        if (/^[A-Z]/.test(clean) && !/\b(thou|thee|thy|thine|didst|doth|hath)\b/i.test(clean)) {
          return clean
        }
      }
    } catch {
      continue
    }
  }
  return null
}

// ── Gemini AI Translation Generator (Top 4 Meanings) ─────────────────────────
export async function fetchGeminiTranslation(word) {
  let key = typeof GEMINI_API_KEY === 'string' ? GEMINI_API_KEY.trim() : ''
  if (!key && typeof chrome !== 'undefined' && chrome.storage?.local) {
    try {
      const stored = await chrome.storage.local.get(['gemini_api_key'])
      if (stored?.gemini_api_key) key = stored.gemini_api_key.trim()
    } catch {}
  }
  if (!key || key.length < 8) return null

  const prompt = `İngilizce "${word}" kelimesinin Türkçe'de en sık kullanılan ve en yaygın 4 temel karşılığını yaz.
SADECE Türkçe karşılıkları aralarına virgül koyarak yaz.
Format örneği: anlam1, anlam2, anlam3, anlam4
Asla başlık, selamlama, numara veya İngilizce açıklama yazma.`

  const models = ['gemini-3-flash-preview', 'gemini-2.5-flash', 'gemini-flash-latest', 'gemini-3.5-flash', 'gemini-3.8-flash']
  for (const model of models) {
    try {
      const res = await fetchWithTimeout(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`,
        6000,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 1000
            }
          })
        }
      )
      if (!res.ok) continue
      const data = await res.json()
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
      if (text) {
        let clean = text.replace(/```[a-z]*\n?/gi, '').replace(/```/g, '').trim()
        if (clean.includes(':')) {
          clean = clean.slice(clean.lastIndexOf(':') + 1).trim()
        }
        clean = clean.replace(/^(top\s*\d+|here\s+are|turkish\s+meanings?|anlamlar|türkçe|karşılıklar)[^\n,;]*/gi, '').trim()

        const parts = clean
          .split(/[,;\n\r]+/)
          .map(p => p.replace(/^\d+[\.\)\-:]\s*/, '').replace(/^[•\-\*]\s*/, '').replace(/^["'`]+|["'`]+$/g, '').trim())
          .filter(p => {
            if (!p || p.length < 2 || p.length > 40) return false
            if (/^(top\s*\d|meaning|turkish|translation|words?|here\s+are|anlam|kelime)/i.test(p)) return false
            if (/^(the|a|an|is|are|of|in|to)\b/i.test(p)) return false
            return true
          })

        if (parts.length > 0) {
          return parts.slice(0, 4).join(', ')
        }
      }
    } catch {
      continue
    }
  }
  return null
}

// ── Wiktionary Wikitext Usage Examples ────────────────────────────────────────
async function fetchWiktionaryExample(word) {
  try {
    const url = `https://en.wiktionary.org/w/api.php?action=parse&page=${encodeURIComponent(word)}&prop=wikitext&format=json&origin=*`
    const res = await fetchWithTimeout(url, 4000)
    if (!res.ok) return null
    const data = await res.json()
    const wikitext = data?.parse?.wikitext?.['*'] ?? ''
    if (!wikitext) return null

    // 1. Look for {{ux|en|...}} usage examples
    const uxRegex = /\{\{ux\|en\|([^|}]+)/g
    let match
    while ((match = uxRegex.exec(wikitext)) !== null) {
      const clean = match[1]
        .replace(/'''?/g, '')
        .replace(/\[\[(?:[^|\]]*\|)?([^\]]+)\]\]/g, '$1')
        .replace(/<[^>]+>/g, '')
        .trim()
      if (isCleanModernSentence(clean)) {
        return clean
      }
    }

    // 2. Look for passage=... quotations (strictly filter out archaic citations!)
    const passageRegex = /passage=([^|}]+)/g
    const wordRe = new RegExp(`\\b${word}\\b`, 'i')
    while ((match = passageRegex.exec(wikitext)) !== null) {
      const rawPassage = match[1]
        .replace(/'''?/g, '')
        .replace(/\[\[(?:[^|\]]*\|)?([^\]]+)\]\]/g, '$1')
        .replace(/<[^>]+>/g, '')
        .trim()
      
      const sentences = rawPassage.match(/[^.!?]+[.!?]+/g) || [rawPassage]
      for (const s of sentences) {
        const clean = s.trim()
        if (wordRe.test(clean) && isCleanModernSentence(clean)) {
          return clean
        }
      }
    }
    return null
  } catch {
    return null
  }
}

// ── Wikipedia Context Sentence Extractor ──────────────────────────────────────
async function fetchWikipediaSentence(word) {
  try {
    const q = String.fromCharCode(34) + word + String.fromCharCode(34)
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(q)}&srlimit=3&format=json&origin=*`
    const searchRes = await fetchWithTimeout(searchUrl, 3500)
    if (!searchRes.ok) return null
    const searchData = await searchRes.json()
    const titles = (searchData?.query?.search || [])
      .map(x => x.title)
      .filter(t => t && !t.includes('(disambiguation)'))
      .slice(0, 3)

    if (titles.length === 0) return null

    const extUrl = `https://en.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&exintro=1&titles=${encodeURIComponent(titles.join('|'))}&format=json&origin=*`
    const extRes = await fetchWithTimeout(extUrl, 4000)
    if (!extRes.ok) return null
    const extData = await extRes.json()
    const pages = Object.values(extData?.query?.pages || {})
    const wordRe = new RegExp(`\\b${word}\\b`, 'i')

    for (const p of pages) {
      const text = p.extract || ''
      const sentences = text.match(/[^.!?]+[.!?]+/g) || []
      for (const s of sentences) {
        const clean = s.replace(/\[\d+\]/g, '').replace(/\s+/g, ' ').trim()
        if (wordRe.test(clean) && clean.length >= 25 && clean.length <= 210 && /^[A-Z]/.test(clean)) {
          return clean
        }
      }
    }
    return null
  } catch {
    return null
  }
}

// ── Tatoeba Sentence Search ──────────────────────────────────────────────────
async function fetchTatoebaSentence(word, lemma = null) {
  const queries = [word]
  if (lemma && lemma !== word) queries.push(lemma)

  for (const q of queries) {
    try {
      const res = await fetchWithTimeout(
        `https://tatoeba.org/en/api_v0/search?from=eng&query=${encodeURIComponent(q)}`,
        3500
      )
      if (!res.ok) continue
      const data = await res.json()
      const results = data?.results || []
      const re = new RegExp(`\\b${q}\\b`, 'i')

      const cleanMatch = results.find(r => {
        const t = r.text?.trim() || ''
        return re.test(t) && t.length >= 15 && t.length <= 220 && /^[A-Z]/.test(t) && /[.!?]$/.test(t)
      }) || results.find(r => {
        const t = r.text?.trim() || ''
        return t.length >= 15 && t.length <= 220 && /^[A-Z]/.test(t) && /[.!?]$/.test(t)
      })

      if (cleanMatch?.text) return cleanMatch.text.trim()
    } catch {
      continue
    }
  }
  return null
}

// ── MyMemory Translation Memory Example Sentence ──────────────────────────────
async function fetchMyMemorySentence(word, lemma = null) {
  const queries = [word]
  if (lemma && lemma !== word) queries.push(lemma)

  for (const q of queries) {
    try {
      const res = await fetchWithTimeout(
        `https://api.mymemory.translated.net/get?q=${encodeURIComponent(q)}&langpair=en|tr`,
        3500
      )
      if (!res.ok) continue
      const data = await res.json()
      const matches = data?.matches || []
      const re = new RegExp(`\\b${q}\\b`, 'i')

      for (const m of matches) {
        const seg = m.segment?.trim()
        if (seg && re.test(seg) && seg.length >= 18 && seg.length <= 250 && /^[A-Z]/.test(seg) && /[.!?]$/.test(seg)) {
          return seg
        }
      }
    } catch {
      continue
    }
  }
  return null
}

// ── Simple Lemma Detection ────────────────────────────────────────────────────
function detectLemma(word) {
  if (word.endsWith('ies') && word.length > 4) return word.slice(0, -3) + 'y'
  if (word.endsWith('ves') && word.length > 4) return word.slice(0, -3) + 'f'
  if (word.endsWith('ses') || word.endsWith('zes') || word.endsWith('ches') || word.endsWith('shes') || word.endsWith('xes')) {
    return word.slice(0, -2)
  }
  if (word.endsWith('s') && !word.endsWith('ss') && word.length > 3) return word.slice(0, -1)
  if (word.endsWith('ed') && word.length > 4) {
    return word.endsWith('eed') ? word.slice(0, -1) : word.slice(0, -2)
  }
  if (word.endsWith('ing') && word.length > 5) return word.slice(0, -3)
  if (word.endsWith('er') && word.length > 4) return word.slice(0, -2)
  if (word.endsWith('est') && word.length > 5) return word.slice(0, -3)
  return null
}

// ── Dynamic Contextual Fallback Generator ──────────────────────────────────────
function generateFallbackSentence(word) {
  const templates = [
    `Daily practice makes it easy to remember the word "${word}".`,
    `Students often encounter the word "${word}" in English exams.`,
    `The teacher explained how to use "${word}" correctly in conversation.`,
    `Learning "${word}" in context helps you expand your vocabulary.`
  ]
  const sum = [...word].reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return templates[Math.abs(sum) % templates.length]
}

// ── Universal Sentence Resolver ───────────────────────────────────────────────
async function resolveBestSentence(word, lemma = null, initialExample = null) {
  // 1. Gemini AI (Primary source: always generates short, clean, memorable learner sentences)
  const aiSentence = await fetchGeminiSentence(word)
  if (aiSentence) return aiSentence

  // 2. Initial example (from dictionary) if valid, modern and not generic
  if (initialExample && typeof initialExample === 'string' && isCleanModernSentence(initialExample)) {
    if (!initialExample.includes('is frequently used in academic and general contexts')) {
      return initialExample.trim()
    }
  }

  // 3. Wiktionary Wikitext usage examples
  const wiktUx = await fetchWiktionaryExample(word)
  if (wiktUx) return wiktUx

  // 4. Wikipedia real context sentences
  const wikiSentence = await fetchWikipediaSentence(word)
  if (wikiSentence) return wikiSentence

  // 5. Try lemma on Wiktionary / Wikipedia if word is inflected
  if (lemma && lemma !== word) {
    const lemmaWikt = await fetchWiktionaryExample(lemma)
    if (lemmaWikt) return lemmaWikt
    const lemmaWiki = await fetchWikipediaSentence(lemma)
    if (lemmaWiki) return lemmaWiki
  }

  // 6. Tatoeba & MyMemory
  const tat = await fetchTatoebaSentence(word, lemma)
  if (tat) return tat

  const mym = await fetchMyMemorySentence(word, lemma)
  if (mym) return mym

  // 7. Dynamic contextual fallback
  return generateFallbackSentence(word)
}

// ── Standalone Example Sentence Getter (for auto-healing / regenerating) ───────
export async function fetchExampleSentence(word) {
  const trimmed = word.trim().toLowerCase()

  // 1. Check Gemini first
  const aiSentence = await fetchGeminiSentence(trimmed)
  if (aiSentence) return aiSentence

  // 2. Standard Dictionary data
  const [wikt, dict] = await Promise.allSettled([
    fetchWiktionaryDefinition(trimmed),
    fetchDictionaryData(trimmed)
  ])

  const dictEx = dict.status === 'fulfilled' ? dict.value?.example_sentence : null
  const wiktEx = wikt.status === 'fulfilled' ? wikt.value?.example_sentence : null
  if (dictEx && dictEx.length >= 15) return dictEx
  if (wiktEx && wiktEx.length >= 15) return wiktEx

  // 3. Extract lemma
  const wiktDef = wikt.status === 'fulfilled' ? wikt.value?.definition : ''
  const formRegex = /\b(?:third-person|simple past|past participle|present participle|plural|comparative|superlative|indicative|inflection|form) of (?:the )?(?:verb )?(?:noun )?(?:adjective )?([a-zA-Z-]+)/i
  let lemma = null
  if (wiktDef && formRegex.test(wiktDef)) {
    const m = wiktDef.match(formRegex)
    if (m && m[1] && m[1].toLowerCase() !== trimmed) lemma = m[1].toLowerCase()
  }
  if (!lemma) lemma = detectLemma(trimmed)

  if (lemma && lemma !== trimmed) {
    const [lWikt, lDict] = await Promise.allSettled([
      fetchWiktionaryDefinition(lemma),
      fetchDictionaryData(lemma)
    ])
    const lDictEx = lDict.status === 'fulfilled' ? lDict.value?.example_sentence : null
    const lWiktEx = lWikt.status === 'fulfilled' ? lWikt.value?.example_sentence : null
    if (lDictEx && lDictEx.length >= 15) return lDictEx
    if (lWiktEx && lWiktEx.length >= 15) return lWiktEx
  }

  return await resolveBestSentence(trimmed, lemma, null)
}
