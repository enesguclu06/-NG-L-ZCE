import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { getReviewUpdate } from '../lib/spaced'

/**
 * Hook for all word CRUD operations.
 */
export function useWords() {
  const { user } = useAuthStore()
  const [words, setWords] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // ── Fetch all words for current user ──────────────────────────
  const fetchWords = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError(null)
    try {
      const { data, error: err } = await supabase
        .from('words')
        .select('*, decks(name)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (err) throw err
      setWords(data ?? [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [user])

  // ── Insert a new word ─────────────────────────────────────────
  const addWord = useCallback(async (wordData) => {
    if (!user) throw new Error('Not authenticated')

    // ── Duplicate check (case-insensitive) ───────────────────────
    const { data: existing, error: checkErr } = await supabase
      .from('words')
      .select('id, english_word')
      .eq('user_id', user.id)
      .ilike('english_word', wordData.english_word.trim())
      .maybeSingle()

    if (checkErr) throw checkErr

    if (existing) {
      throw new Error(`"${existing.english_word}" zaten kütüphanende kayıtlı! 📚`)
    }

    const payload = {
      user_id: user.id,
      english_word: wordData.english_word.trim(),
      turkish_translation: wordData.turkish_translation ?? null,
      synonyms: wordData.synonyms ?? [],
      definition: wordData.definition ?? null,
      example_sentence: wordData.example_sentence ?? null,
      phonetic: wordData.phonetic ?? null,
      deck_id: wordData.deck_id || null,
      source_url: null, // reserved for Phase 2 extension
      difficulty: 'unrated',
    }

    const { data, error: err } = await supabase
      .from('words')
      .insert(payload)
      .select()
      .single()

    if (err) throw err
    setWords(prev => [data, ...prev])
    return data
  }, [user])


  // ── Update a word (edit) ──────────────────────────────────────
  const updateWord = useCallback(async (id, updates) => {
    const { data, error: err } = await supabase
      .from('words')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (err) throw err
    setWords(prev => prev.map(w => w.id === id ? data : w))
    return data
  }, [])

  // ── Delete a word ─────────────────────────────────────────────
  const deleteWord = useCallback(async (id) => {
    const { error: err } = await supabase
      .from('words')
      .delete()
      .eq('id', id)

    if (err) throw err
    setWords(prev => prev.filter(w => w.id !== id))
  }, [])

  // ── Update difficulty + review metadata after flashcard review ─
  const updateAfterReview = useCallback(async (id, difficulty, currentReviewCount) => {
    const updates = getReviewUpdate(difficulty, currentReviewCount)
    return updateWord(id, updates)
  }, [updateWord])

  return {
    words,
    loading,
    error,
    fetchWords,
    addWord,
    updateWord,
    deleteWord,
    updateAfterReview,
  }
}
