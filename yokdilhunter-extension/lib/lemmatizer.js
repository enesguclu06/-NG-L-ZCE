/**
 * YOKDILHUNTER Extension Lemmatizer & Root Variation Engine
 * Fast in-memory English root & inflection matching.
 * Handles irregular verbs (V1, V2, V3), irregular nouns, and all regular tense/plural suffixes.
 */

const IRREGULAR_VERBS = [
  ['be', 'was', 'were', 'been', 'is', 'am', 'are', 'being'],
  ['run', 'ran', 'running', 'runs'],
  ['go', 'went', 'gone', 'going', 'goes'],
  ['do', 'did', 'done', 'doing', 'does'],
  ['have', 'had', 'having', 'has'],
  ['see', 'saw', 'seen', 'seeing', 'sees'],
  ['say', 'said', 'saying', 'says'],
  ['get', 'got', 'gotten', 'getting', 'gets'],
  ['make', 'made', 'making', 'makes'],
  ['know', 'knew', 'known', 'knowing', 'knows'],
  ['think', 'thought', 'thinking', 'thinks'],
  ['take', 'took', 'taken', 'taking', 'takes'],
  ['come', 'came', 'coming', 'comes'],
  ['give', 'gave', 'given', 'giving', 'gives'],
  ['find', 'found', 'finding', 'finds'],
  ['tell', 'told', 'telling', 'tells'],
  ['become', 'became', 'becoming', 'becomes'],
  ['show', 'showed', 'shown', 'showing', 'shows'],
  ['leave', 'left', 'leaving', 'leaves'],
  ['feel', 'felt', 'feeling', 'feels'],
  ['put', 'putting', 'puts'],
  ['bring', 'brought', 'bringing', 'brings'],
  ['begin', 'began', 'begun', 'beginning', 'begins'],
  ['keep', 'kept', 'keeping', 'keeps'],
  ['hold', 'held', 'holding', 'holds'],
  ['write', 'wrote', 'written', 'writing', 'writes'],
  ['stand', 'stood', 'standing', 'stands'],
  ['hear', 'heard', 'hearing', 'hears'],
  ['let', 'letting', 'lets'],
  ['mean', 'meant', 'meaning', 'means'],
  ['set', 'setting', 'sets'],
  ['meet', 'met', 'meeting', 'meets'],
  ['pay', 'paid', 'paying', 'pays'],
  ['sit', 'sat', 'sitting', 'sits'],
  ['speak', 'spoke', 'spoken', 'speaking', 'speaks'],
  ['lie', 'lay', 'lain', 'lying', 'lies'],
  ['lead', 'led', 'leading', 'leads'],
  ['read', 'reading', 'reads'],
  ['grow', 'grew', 'grown', 'growing', 'grows'],
  ['lose', 'lost', 'losing', 'loses'],
  ['fall', 'fell', 'fallen', 'falling', 'falls'],
  ['send', 'sent', 'sending', 'sends'],
  ['build', 'built', 'building', 'builds'],
  ['understand', 'understood', 'understanding', 'understands'],
  ['draw', 'drew', 'drawn', 'drawing', 'draws'],
  ['break', 'broke', 'broken', 'breaking', 'breaks'],
  ['spend', 'spent', 'spending', 'spends'],
  ['cut', 'cutting', 'cuts'],
  ['rise', 'rose', 'risen', 'rising', 'rises'],
  ['drive', 'drove', 'driven', 'driving', 'drives'],
  ['buy', 'bought', 'buying', 'buys'],
  ['wear', 'wore', 'worn', 'wearing', 'wears'],
  ['choose', 'chose', 'chosen', 'choosing', 'chooses'],
  ['seek', 'sought', 'seeking', 'seeks'],
  ['throw', 'threw', 'thrown', 'throwing', 'throws'],
  ['catch', 'caught', 'catching', 'catches'],
  ['deal', 'dealt', 'dealing', 'deals'],
  ['win', 'won', 'winning', 'wins'],
  ['forget', 'forgot', 'forgotten', 'forgetting', 'forgets'],
  ['sell', 'sold', 'selling', 'sells'],
  ['fight', 'fought', 'fighting', 'fights'],
  ['bear', 'bore', 'born', 'borne', 'bearing', 'bears'],
  ['teach', 'taught', 'teaching', 'teaches'],
  ['eat', 'ate', 'eaten', 'eating', 'eats'],
  ['sing', 'sang', 'sung', 'singing', 'sings'],
  ['fly', 'flew', 'flown', 'flying', 'flies'],
  ['drink', 'drank', 'drunk', 'drinking', 'drinks'],
  ['swim', 'swam', 'swum', 'swimming', 'swims'],
  ['sleep', 'slept', 'sleeping', 'sleeps'],
  ['wake', 'woke', 'woken', 'waking', 'wakes'],
  ['ride', 'rode', 'ridden', 'riding', 'rides'],
  ['freeze', 'froze', 'frozen', 'freezing', 'freezes'],
  ['hide', 'hid', 'hidden', 'hiding', 'hides'],
  ['strike', 'struck', 'striking', 'strikes'],
  ['bind', 'bound', 'binding', 'binds'],
  ['bite', 'bit', 'bitten', 'biting', 'bites'],
  ['blow', 'blew', 'blown', 'blowing', 'blows'],
  ['forgive', 'forgave', 'forgiven', 'forgiving', 'forgives'],
  ['hang', 'hung', 'hanging', 'hangs'],
  ['shake', 'shook', 'shaken', 'shaking', 'shakes'],
  ['shine', 'shone', 'shining', 'shines'],
  ['shoot', 'shot', 'shooting', 'shoots'],
  ['shut', 'shutting', 'shuts'],
  ['sink', 'sank', 'sunk', 'sinking', 'sinks'],
  ['steal', 'stole', 'stolen', 'stealing', 'steals'],
  ['sweep', 'swept', 'sweeping', 'sweeps'],
  ['tear', 'tore', 'torn', 'tearing', 'tears'],
  ['wind', 'wound', 'winding', 'winds']
]

const IRREGULAR_NOUNS = [
  ['child', 'children'],
  ['person', 'people'],
  ['man', 'men'],
  ['woman', 'women'],
  ['tooth', 'teeth'],
  ['foot', 'feet'],
  ['mouse', 'mice'],
  ['goose', 'geese'],
  ['ox', 'oxen'],
  ['crisis', 'crises'],
  ['analysis', 'analyses'],
  ['criterion', 'criteria'],
  ['phenomenon', 'phenomena'],
  ['datum', 'data']
]

const BASE_MAP = new Map()
const FORMS_MAP = new Map()

function register(group) {
  const base = group[0].toLowerCase()
  const allSet = new Set(group.map(w => w.toLowerCase()))
  for (const w of allSet) {
    BASE_MAP.set(w, base)
    if (!FORMS_MAP.has(w)) FORMS_MAP.set(w, new Set())
    const target = FORMS_MAP.get(w)
    for (const item of allSet) target.add(item)
  }
}
IRREGULAR_VERBS.forEach(register)
IRREGULAR_NOUNS.forEach(register)

export function findBaseLemma(word) {
  if (!word || typeof word !== 'string') return ''
  const w = word.toLowerCase().trim()
  if (BASE_MAP.has(w)) return BASE_MAP.get(w)

  if (w.endsWith('ies') && w.length > 4) return w.slice(0, -3) + 'y'
  if (w.endsWith('ves') && w.length > 4) return w.slice(0, -3) + 'f'
  if (w.endsWith('es') && w.length > 3) {
    if (/(?:ches|shes|sses|xes|zes)$/i.test(w)) return w.slice(0, -2)
    return w.slice(0, -1)
  }
  if (w.endsWith('s') && !w.endsWith('ss') && w.length > 3) return w.slice(0, -1)

  if (w.endsWith('ied') && w.length > 4) return w.slice(0, -3) + 'y'
  if (w.endsWith('ed') && w.length > 4) {
    if (w.length > 5 && w[w.length - 3] === w[w.length - 4]) {
      return w.slice(0, -3)
    }
    return w.slice(0, -2)
  }

  if (w.endsWith('ying') && w.length > 5) return w.slice(0, -4) + 'ie'
  if (w.endsWith('ing') && w.length > 5) {
    if (w.length > 6 && w[w.length - 4] === w[w.length - 5]) {
      return w.slice(0, -4)
    }
    return w.slice(0, -3)
  }

  return w
}

export function getWordVariations(rawWord) {
  if (!rawWord || typeof rawWord !== 'string') return []
  const w = rawWord.toLowerCase().trim()
  if (!w) return []

  const variations = new Set([w])

  if (FORMS_MAP.has(w)) {
    for (const f of FORMS_MAP.get(w)) variations.add(f)
  }

  const base = findBaseLemma(w)
  if (base && base !== w) {
    variations.add(base)
    if (FORMS_MAP.has(base)) {
      for (const f of FORMS_MAP.get(base)) variations.add(f)
    }
  }

  const roots = [w, base]
  for (const r of roots) {
    if (r.length < 3) continue
    variations.add(r + 's')
    variations.add(r + 'es')
    variations.add(r + 'ed')
    variations.add(r + 'ing')
    if (r.endsWith('e')) {
      variations.add(r + 'd')
      variations.add(r.slice(0, -1) + 'ing')
    }
    if (r.endsWith('y') && !/[aeiou]y$/i.test(r)) {
      variations.add(r.slice(0, -1) + 'ies')
      variations.add(r.slice(0, -1) + 'ied')
    }
    if (r.length >= 3 && /[^aeiou][aeiou][b-df-hj-np-tv-z]$/i.test(r)) {
      const last = r[r.length - 1]
      variations.add(r + last + 'ing')
      variations.add(r + last + 'ed')
    }
  }

  return Array.from(variations).filter(v => v.length >= 2)
}
