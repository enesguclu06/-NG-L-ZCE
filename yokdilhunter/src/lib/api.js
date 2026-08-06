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
  let definition = null
  let dictSynonyms = []

  if (dictResult.status === 'fulfilled') {
    phonetic     = dictResult.value.phonetic   ?? null
    // Prefer Wiktionary Turkish phonetic over raw IPA from dict API
    definition   = dictResult.value.definition ?? null
    dictSynonyms = dictResult.value.synonyms   ?? []
  }
  // Note: dict API errors are reported below, only if data is missing

  // Wiktionary Turkish phonetic — use as phonetic if dict API gave nothing
  if (!phonetic && phoneticResult.status === 'fulfilled' && phoneticResult.value) {
    phonetic = phoneticResult.value
  } else if (phonetic && phoneticResult.status === 'fulfilled' && phoneticResult.value) {
    // Also prefer the converted Turkish phonetic over raw IPA
    phonetic = phoneticResult.value
  }

  // Wiktionary fallback for definition
  if (!definition && wiktResult.status === 'fulfilled' && wiktResult.value) {
    definition = wiktResult.value
  }

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

  // Only warn about dict API if definition is still missing (not filled by fallbacks)
  if (dictResult.status !== 'fulfilled' && !definition) {
    errors.push(`Dictionary API: ${dictResult.reason?.message ?? 'Bulunamadı'}`)
  }

  return { english_word: word.trim(), phonetic, definition, synonyms, turkish_translation, errors }
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

  // Scan ALL meanings for best definition + synonyms
  let definition = null
  const synSet = new Set()

  for (const meaning of (entry.meanings ?? [])) {
    for (const def of (meaning.definitions ?? [])) {
      if (!definition && def.definition?.trim().length > 5) {
        definition = stripHtml(def.definition.trim())
      }
      for (const s of (def.synonyms ?? [])) synSet.add(s)
    }
    for (const s of (meaning.synonyms ?? [])) synSet.add(s)
  }

  return { phonetic, definition, synonyms: [...synSet].slice(0, 8) }
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
        if (text.length > 5) return text
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
  const collected = new Set()

  // All 3 in parallel
  const [googleResult, wiktTrResult, myMemoryResult] = await Promise.allSettled([
    fetchGoogleTranslate(word),
    fetchWiktionaryTurkish(word),
    fetchMyMemory(word),
  ])

  // 1. Google Translate (primary + alternates)
  if (googleResult.status === 'fulfilled') {
    for (const t of googleResult.value) collected.add(t)
  }

  // 2. Wiktionary Turkish (usually best quality for common words)
  if (wiktTrResult.status === 'fulfilled') {
    for (const t of wiktTrResult.value) collected.add(t)
  }

  // 3. MyMemory as additional source (now returns array)
  if (myMemoryResult.status === 'fulfilled' && Array.isArray(myMemoryResult.value)) {
    for (const t of myMemoryResult.value) collected.add(t)
  }

  const results = [...collected]
    .filter(t => t && t.toLowerCase() !== word.toLowerCase() && !isTransliteration(word, t))
    .slice(0, 4)

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

// dict-chrome-ex: returns a proper dictionary response with terms[] per pos
// Response: [ [{trans:"geniş",...}], "en", 1, [{pos:"adj",terms:["geniş","engin",...],...}] ]
async function fetchGoogleDictClient(word) {
  const translations = []
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=dict-chrome-ex&sl=en&tl=tr&dt=t&dt=bd&q=${encodeURIComponent(word)}`
    const res = await fetchWithTimeout(url, 5000)
    if (!res.ok) return translations

    const data = await res.json()

    // Primary: data[0][0].trans (dict-chrome-ex format uses objects, not arrays)
    const primaryTrans = data?.[0]?.[0]?.trans
    if (primaryTrans && typeof primaryTrans === 'string' && primaryTrans.trim().length > 0) {
      translations.push(primaryTrans.trim())
    }

    // Dictionary section: data[3] = [ { pos:"adjective", terms:["geniş","engin",...] }, ... ]
    const dictSection = data?.[3]
    if (Array.isArray(dictSection)) {
      for (const posEntry of dictSection) {
        if (Array.isArray(posEntry?.terms)) {
          for (const term of posEntry.terms) {
            if (typeof term === 'string' && term.trim().length > 0 && !translations.includes(term.trim())) {
              translations.push(term.trim())
            }
            if (translations.length >= 8) break
          }
        }
        if (translations.length >= 8) break
      }
    }
  } catch { /* silent */ }
  return translations
}

// gtx client with dt=at: alternates at data[5]
// Response: [ [["geniş","vast",...]], null, "en", null, null, [[posGroup, [[alt,...],...]],...] ]
async function fetchGoogleGtxClient(word) {
  const translations = []
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=tr&dt=t&dt=at&q=${encodeURIComponent(word)}`
    const res = await fetchWithTimeout(url, 5000)
    if (!res.ok) return translations

    const data = await res.json()

    // Primary at data[0][0][0]
    const primary = data?.[0]?.[0]?.[0]
    if (primary && typeof primary === 'string' && primary.trim().length > 0) {
      translations.push(primary.trim())
    }

    // Alternates at data[5]: [ [posOfSpeech, [[altWord, backTrans,...], ...], ...], ... ]
    const altSection = data?.[5]
    if (Array.isArray(altSection)) {
      for (const posGroup of altSection) {
        if (!Array.isArray(posGroup) || !Array.isArray(posGroup[1])) continue
        for (const altEntry of posGroup[1]) {
          const altWord = altEntry?.[0]
          if (typeof altWord === 'string' && altWord.trim().length > 0 && !translations.includes(altWord.trim())) {
            translations.push(altWord.trim())
          }
          if (translations.length >= 8) break
        }
        if (translations.length >= 8) break
      }
    }
  } catch { /* silent */ }
  return translations
}

// ── MyMemory API ─────────────────────────────────────────────────────────────
// Returns an array of translations found in matches[] (multiple sources)
async function fetchMyMemory(word) {
  try {
    const res = await fetchWithTimeout(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(word)}&langpair=en|tr`,
      5000
    )
    if (!res.ok) return []
    const data = await res.json()
    if (data.responseStatus !== 200 && data.responseStatus !== '200') return []

    const results = []

    // Primary result
    const primary = data.responseData?.translatedText
    if (primary && primary.toLowerCase() !== word.toLowerCase()) {
      results.push(primary.trim())
    }

    // Additional unique translations from the matches array
    if (Array.isArray(data.matches)) {
      for (const match of data.matches) {
        const t = match?.translation?.trim()
        if (t && t.toLowerCase() !== word.toLowerCase() && !results.includes(t)) {
          results.push(t)
        }
        if (results.length >= 4) break
      }
    }

    return results
  } catch {
    return []
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

    // Find the Translations section (between ====Translations==== and the next ====)
    const transMatch = wikitext.match(/={3,4}Translations={3,4}([\s\S]*?)(?====[^=]|$)/)
    if (!transMatch) return []

    const translationsBlock = transMatch[1]

    // Find the Turkish line: "* Turkish: {{t+|tr|geniş}}, {{t|tr|engin}}, ..."
    const turkishLine = translationsBlock.match(/\* Turkish:([^\n]+)/)
    if (!turkishLine) return []

    // Extract all {{t|tr|word}} and {{t+|tr|word}} templates
    // Template format: {{t+|tr|geniş}} or {{t+|tr|geniş|alt=...}} or {{t|tr|uçsuz bucaksız}}
    const results = []
    const templateRegex = /\{\{t\+?\|tr\|([^|}\]]+)/g
    let match
    while ((match = templateRegex.exec(turkishLine[1])) !== null) {
      const term = match[1].trim()
      if (term && term.length > 0 && !results.includes(term)) {
        results.push(term)
      }
      if (results.length >= 5) break
    }

    return results
  } catch {
    return []  // Silent failure — this is an optional enhancement
  }
}

