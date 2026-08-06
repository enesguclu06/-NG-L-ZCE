/**
 * phonetic.js
 *
 * Fetches the IPA pronunciation of an English word from Wiktionary,
 * then converts it to a Turkish-readable phonetic string.
 *
 * Example:  "ubiquitous"  →  IPA: /juːˈbɪkwɪtəs/  →  Turkish: "yu-bik-vi-tıs"
 */

// ── Wiktionary IPA fetch ───────────────────────────────────────────────────────
export async function fetchTurkishPhonetic(word) {
  try {
    // Use Wiktionary's parse API to get raw wikitext (has IPA templates)
    const url = `https://en.wiktionary.org/w/api.php?action=parse&page=${encodeURIComponent(word)}&prop=wikitext&format=json&origin=*`
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 6000)

    const res = await fetch(url, { signal: controller.signal })
    clearTimeout(timer)

    if (!res.ok) return null

    const data = await res.json()
    const wikitext = data?.parse?.wikitext?.['*'] ?? ''

    // Extract IPA strings from templates like {{IPA|en|/juːˈbɪkwɪtəs/}}
    // or {{a|US}} {{IPA|en|/foo/}}
    const ipaRegex = /\{\{IPA\|en\|([^}]+)\}\}/g
    let match
    const candidates = []

    while ((match = ipaRegex.exec(wikitext)) !== null) {
      const parts = match[1].split('|')
      for (const part of parts) {
        const cleaned = part.trim()
        if (/^[\/\[]/.test(cleaned)) {
          // Remove the enclosing / / or [ ]
          const raw = cleaned.replace(/^[/[]/, '').replace(/[/\]]$/, '')
          candidates.push(raw)
        }
      }
    }

    if (candidates.length === 0) return null

    // Prefer US pronunciation (usually listed first or labeled "US")
    const ipa = candidates[0]
    const turkish = ipaToTurkish(ipa)
    return turkish || null
  } catch {
    return null
  }
}

// ── IPA → Turkish readable conversion ────────────────────────────────────────
// Maps IPA symbols to approximate Turkish sounds.
// Not perfect — English has sounds with no Turkish equivalent —
// but readable enough for a learner to approximate pronunciation.
export function ipaToTurkish(ipa) {
  if (!ipa) return null

  let s = ipa

  // Multi-symbol sequences first (order matters!)
  const rules = [
    // ── Vowel clusters & diphthongs ──────────────────────
    [/juː/g, 'yu'],    // "you", "use"
    [/jʊ/g, 'yu'],
    [/iː/g, 'i'],      // "see"
    [/uː/g, 'u'],      // "too"
    [/ɑː/g, 'a'],      // "car"
    [/ɔː/g, 'o'],      // "saw"
    [/ɜː/g, 'ör'],     // "bird"
    [/ɛː/g, 'er'],
    [/eɪ/g, 'ey'],     // "day"
    [/aɪ/g, 'ay'],     // "my"
    [/ɔɪ/g, 'oy'],     // "boy"
    [/aʊ/g, 'av'],     // "now"
    [/əʊ/g, 'o'],      // "go" (British)
    [/oʊ/g, 'o'],      // "go" (American)
    [/ɪə/g, 'iye'],    // "ear"
    [/eə/g, 'er'],     // "air"
    [/ʊə/g, 'ue'],     // "cure"
    // ── Consonant clusters ────────────────────────────────
    [/tʃ/g, 'ç'],      // "church"
    [/dʒ/g, 'c'],      // "jump"
    [/ŋg/g, 'ng'],
    // ── Single vowels ─────────────────────────────────────
    [/ɪ/g, 'i'],       // "bit"
    [/ʊ/g, 'u'],       // "foot"
    [/ə/g, 'ı'],       // schwa (most common English vowel)
    [/æ/g, 'e'],       // "cat"
    [/ʌ/g, 'a'],       // "cup"
    [/ɒ/g, 'o'],       // "lot" (British)
    [/e/g, 'e'],
    [/a/g, 'a'],
    [/o/g, 'o'],
    [/i/g, 'i'],
    [/u/g, 'u'],
    // ── Consonants ────────────────────────────────────────
    [/ʃ/g, 'ş'],       // "ship"
    [/ʒ/g, 'j'],       // "measure"
    [/θ/g, 'd'],       // "think" (no Turkish equivalent → closest is d or t)
    [/ð/g, 'd'],       // "the"
    [/ŋ/g, 'ng'],      // "sing"
    [/w/g, 'v'],       // "will"
    [/j/g, 'y'],       // IPA j = English "yes"
    [/x/g, 'h'],       // "loch"
    [/ɹ/g, 'r'],       // American r
    [/r/g, 'r'],
    [/l/g, 'l'],
    [/n/g, 'n'],
    [/m/g, 'm'],
    [/p/g, 'p'],
    [/b/g, 'b'],
    [/t/g, 't'],
    [/d/g, 'd'],
    [/k/g, 'k'],
    [/ɡ/g, 'g'],       // IPA ɡ (different Unicode from ASCII g)
    [/g/g, 'g'],
    [/f/g, 'f'],
    [/v/g, 'v'],
    [/s/g, 's'],
    [/z/g, 'z'],
    [/h/g, 'h'],
    // ── Stress & meta characters (remove) ────────────────
    [/[ˈˌ.]/g, '-'],   // stress/syllable markers → hyphen
    [/[()ː]/g, ''],    // length marker, parens → remove
  ]

  for (const [pattern, replacement] of rules) {
    s = s.replace(pattern, replacement)
  }

  // Clean up: remove duplicate hyphens, leading/trailing hyphens
  s = s
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()

  return s || null
}
