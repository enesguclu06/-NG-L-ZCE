import { fetchTurkishPhonetic } from './phonetic.js'

/**
 * Fetches word data from multiple free APIs in parallel:
 *   1. dictionaryapi.dev → phonetic + definition + some synonyms
 *      (all proxy fallbacks raced in parallel — much faster than sequential)
 *   2. Wiktionary REST API → definition fallback
 *   3. Datamuse API        → richer synonyms
 *   4. MyMemory + Google Translate informal API → Turkish translation
 */
export async function fetchWordData(word) {
  const trimmed = word.trim().toLowerCase()
  const errors = []

  const [dictResult, wiktResult, datumuseResult, translationResult, phoneticResult] = await Promise.allSettled([
    fetchDictionaryData(trimmed),
    fetchWiktionaryDefinition(trimmed),
    fetchDatamuseSynonyms(trimmed),
    fetchTranslation(trimmed),
    fetchTurkishPhonetic(trimmed),
  ])

  // Dictionary API
  let phonetic = null
  let dictDefinition = null
  let dictExample = null
  let dictSynonyms = []

  if (dictResult.status === 'fulfilled') {
    phonetic      = dictResult.value.phonetic         ?? null
    dictDefinition = dictResult.value.definition      ?? null
    dictExample   = dictResult.value.example_sentence ?? null
    dictSynonyms  = dictResult.value.synonyms         ?? []
  }

  // Wiktionary Turkish phonetic
  if (phoneticResult.status === 'fulfilled' && phoneticResult.value) {
    phonetic = phoneticResult.value
  }

  // Pick best definition: prefer shorter & simpler between dict and wikt
  let wiktDefinition = null
  let wiktExample = null
  if (wiktResult.status === 'fulfilled' && wiktResult.value) {
    wiktDefinition = wiktResult.value.definition ?? null
    wiktExample    = wiktResult.value.example_sentence ?? null
  }

  const definition    = pickBestDefinition(dictDefinition, wiktDefinition)
  const example_sentence = dictExample ?? wiktExample ?? null

  // Synonyms: Datamuse + dict merged
  const datumuseSynonyms = datumuseResult.status === 'fulfilled' ? (datumuseResult.value ?? []) : []
  const synonyms = [...new Set([...datumuseSynonyms, ...dictSynonyms])].slice(0, 10)

  // Translation
  let turkish_translation = null
  if (translationResult.status === 'fulfilled') {
    turkish_translation = translationResult.value
  } else {
    errors.push(`Translation API: ${translationResult.reason?.message ?? 'Başarısız'}`)
  }

  if (dictResult.status !== 'fulfilled' && !definition) {
    errors.push(`Dictionary API: ${dictResult.reason?.message ?? 'Bulunamadı'}`)
  }

  return { english_word: word.trim(), phonetic, definition, example_sentence, synonyms, turkish_translation, errors }
}

// Pick the cleaner/shorter definition between two sources
function pickBestDefinition(a, b) {
  if (!a && !b) return null
  if (!a) return b
  if (!b) return a
  // Prefer the one that is shorter and doesn't start with a lowercase letter (avoids mid-sentence snippets)
  const clean = (s) => s.replace(/^[a-z]/, c => c.toUpperCase()).trim()
  const scoreA = a.length + (a.match(/;|\(|\[/) ? 30 : 0)  // penalise complex punctuation
  const scoreB = b.length + (b.match(/;|\(|\[/) ? 30 : 0)
  return clean(scoreA <= scoreB ? a : b)
}

// ── Fetch with timeout ────────────────────────────────────────────────────────
async function fetchWithTimeout(url, timeoutMs = 5000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { signal: controller.signal })
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

  // Score each candidate — prefer verb/adj, medium length (30-200), penalise noun-list style
  const scored = candidates.map(c => {
    let score = 0
    if (c.pos === 'verb')      score += 30
    if (c.pos === 'adjective') score += 10
    if (c.text.length >= 30 && c.text.length <= 200) score += 20
    if (c.text.length < 20)   score -= 30   // too short = probably a noun label
    if (/;/.test(c.text))     score -= 15   // semicolon-list definitions are less useful
    if (/^[A-Z]/.test(c.text) && /[.!?]$/.test(c.text)) score += 10  // full sentence
    return { ...c, score }
  })
  scored.sort((a, b) => b.score - a.score)

  const best = scored[0] ?? null
  const definition      = best?.text ?? null
  const example_sentence = best?.example ? stripHtml(best.example) : null

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
    for (const entry of (data?.en ?? [])) {
      for (const def of (entry.definitions ?? [])) {
        const text = stripHtml(def.definition ?? '')
        let example_sentence = null
        if (def.examples && def.examples.length > 0) {
          example_sentence = stripHtml(def.examples[0] ?? '')
        }
        if (text.length > 5) {
          return { definition: text, example_sentence }
        }
      }
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
async function fetchTranslation(word) {
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
    if (trimmed.split(/\s+/).length > 5) return false              // more than 5 words = too long
    if (trimmed.toLowerCase() === word.toLowerCase()) return false  // same as input
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

  // 1. Google Translate — highest priority
  if (googleResult.status === 'fulfilled') {
    for (const t of googleResult.value) {
      if (isValidTranslation(t)) addUnique(t)
    }
  }

  // 2. Wiktionary Turkish — community-curated
  if (wiktTrResult.status === 'fulfilled') {
    for (const t of wiktTrResult.value) {
      if (isValidTranslation(t)) addUnique(t)
    }
  }

  // 3. MyMemory — only primary (matches[] contains full sentences)
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
// data[3] entries like "o kadar", "olduğu kadar" are valid; sentence fragments are filtered in fetchTranslation
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

    // Dictionary section: data[3] = [ { pos:"conjunction", terms:["kadar","o kadar",...] }, ... ]
    // Sentence fragments get filtered by isValidTranslation in fetchTranslation
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
// For phrases, dt=at alternates tend to contain conjugated sentence fragments
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

    // Primary at data[0][0][0]
    const primary = data?.[0]?.[0]?.[0]
    if (primary && typeof primary === 'string' && primary.trim().length > 0) {
      translations.push(primary.trim())
    }

    // Alternates at data[5] (single words only): [[pos, [[alt, score,...], ...], original], ...]
    if (!isPhrase) {
      const altSection = data?.[5]
      if (Array.isArray(altSection)) {
        for (const posGroup of altSection) {
          const alts = posGroup?.[2]  // array of [word, null, bool, bool, [score]]
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
// Returns only the primary translation (matches[] contains full sentences — skip)
async function fetchMyMemory(word) {
  try {
    const res = await fetchWithTimeout(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(word)}&langpair=en|tr`,
      5000
    )
    if (!res.ok) return ''
    const data = await res.json()
    if (data.responseStatus !== 200 && data.responseStatus !== '200') return ''

    // Only primary — matches[] contains example sentence translations
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
    // This handles polysemous words like "run" which have many {{trans-top}} blocks,
    // each with its own "* Turkish:" line.
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

