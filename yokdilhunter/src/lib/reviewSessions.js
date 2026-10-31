import { supabase } from './supabase'

/**
 * reviewSessions.js
 * Tracks completed review sessions in Supabase database with local fallback.
 * Allows viewing all past sessions (date, title, counts) and restarting reviews from that exact session.
 */

const LOCAL_SESSIONS_PREFIX = 'yokdil_review_sessions_'

function getLocalKey(userId) {
  return `${LOCAL_SESSIONS_PREFIX}${userId || 'guest'}`
}

export function getLocalSessions(userId) {
  try {
    const raw = localStorage.getItem(getLocalKey(userId))
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function saveLocalSession(userId, session) {
  try {
    const key = getLocalKey(userId)
    const list = getLocalSessions(userId)
    list.unshift(session)
    // keep newest 500
    if (list.length > 500) list.length = 500
    localStorage.setItem(key, JSON.stringify(list))
  } catch (e) {
    console.warn('Could not save session locally:', e)
  }
}

/**
 * Saves a completed session to Supabase database (and caches locally)
 */
export async function saveCompletedSession({
  userId,
  title,
  mode,
  words, // array of { id, english_word, turkish_translation, previous_difficulty, new_difficulty }
  results, // { hard: 0, medium: 5, easy: 0, mastered: 1 }
  total,
}) {
  const sessionRecord = {
    id: `sess_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    user_id: userId,
    title: title || 'Tekrar Oturumu',
    mode: mode || 'default',
    total_reviewed: total || (words ? words.length : 0),
    results: results || { hard: 0, medium: 0, easy: 0, mastered: 0 },
    words: (words || []).map(w => ({
      id: w.id,
      word_id: w.id,
      english_word: w.english_word,
      turkish_translation: w.turkish_translation,
      previous_difficulty: w.previous_difficulty || 'unrated',
      new_difficulty: w.new_difficulty || w.difficulty || 'medium',
    })),
    created_at: new Date().toISOString(),
  }

  // Always save locally immediately
  saveLocalSession(userId, sessionRecord)

  // Save to Supabase if table exists
  if (userId) {
    try {
      const { error } = await supabase
        .from('review_sessions')
        .insert([{
          user_id: userId,
          title: sessionRecord.title,
          mode: sessionRecord.mode,
          total_reviewed: sessionRecord.total_reviewed,
          results: sessionRecord.results,
          words: sessionRecord.words,
          created_at: sessionRecord.created_at,
        }])
      if (error) {
        console.warn('Supabase review_sessions insert:', error.message)
      }
    } catch (err) {
      console.warn('Could not save to Supabase review_sessions:', err)
    }
  }

  return sessionRecord
}

/**
 * Fetches all completed sessions: combines Supabase records with local storage records.
 */
export async function fetchCompletedSessions(userId, liveWords = []) {
  const localList = getLocalSessions(userId)
  let dbList = []

  if (userId) {
    try {
      const { data, error } = await supabase
        .from('review_sessions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(100)

      if (!error && Array.isArray(data)) {
        dbList = data
      }
    } catch (e) {
      console.warn('Could not fetch from Supabase review_sessions:', e)
    }
  }

  // Merge unique by created_at or id
  const map = new Map()
  for (const item of localList) {
    const key = item.id || item.created_at
    map.set(key, item)
  }
  for (const item of dbList) {
    const key = item.id || item.created_at
    map.set(key, item)
  }

  const merged = Array.from(map.values())

  // Deduplicate: same title and within 10 seconds of each other
  const deduplicated = []
  for (const s of merged) {
    const isDup = deduplicated.some(existing => {
      if (existing.id === s.id) return true
      const diffTime = Math.abs(new Date(existing.created_at).getTime() - new Date(s.created_at).getTime())
      return existing.title === s.title && existing.total_reviewed === s.total_reviewed && diffTime < 10000
    })
    if (!isDup) {
      deduplicated.push(s)
    }
  }

  // Sort newest first
  deduplicated.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  return deduplicated
}

/**
 * Deletes a session both from local storage and Supabase
 */
export async function deleteCompletedSession(userId, sessionId) {
  if (!sessionId) return

  // 1. Delete from local storage
  try {
    const key = getLocalKey(userId)
    const list = getLocalSessions(userId)
    const updated = list.filter(s => s.id !== sessionId)
    localStorage.setItem(key, JSON.stringify(updated))
  } catch (e) {
    console.warn('Could not delete session from localStorage:', e)
  }

  // 2. Delete from Supabase if not synthesized
  if (userId && !sessionId.startsWith('synth_')) {
    try {
      await supabase
        .from('review_sessions')
        .delete()
        .eq('id', sessionId)
        .eq('user_id', userId)
    } catch (e) {
      console.warn('Could not delete session from Supabase:', e)
    }
  }
}

