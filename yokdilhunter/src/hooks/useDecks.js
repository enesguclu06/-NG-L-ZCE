import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'

export function useDecks() {
  const userId = useAuthStore(s => s.user?.id ?? null)
  const [decks, setDecks] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const fetchDecks = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    setError(null)
    try {
      const { data, error: err } = await supabase
        .from('decks')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (err) throw err
      setDecks(data || [])
    } catch (err) {
      console.error('fetchDecks error:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [userId])

  const createDeck = async (name) => {
    if (!userId) throw new Error('Oturum açmalısınız')
    try {
      const { data, error: err } = await supabase
        .from('decks')
        .insert([{ user_id: userId, name }])
        .select()
        .single()

      if (err) throw err
      setDecks(prev => [data, ...prev])
      return data
    } catch (err) {
      console.error('createDeck error:', err)
      throw err
    }
  }

  const deleteDeck = async (id) => {
    if (!userId) return
    try {
      // First set deck_id to null for words in this deck (Supabase should ideally do this with ON DELETE SET NULL)
      // but we do it manually just in case to avoid constraint errors if no cascade is set.
      await supabase
        .from('words')
        .update({ deck_id: null })
        .eq('deck_id', id)
        .eq('user_id', userId)

      const { error: err } = await supabase
        .from('decks')
        .delete()
        .eq('id', id)
        .eq('user_id', userId)

      if (err) throw err
      setDecks(prev => prev.filter(d => d.id !== id))
    } catch (err) {
      console.error('deleteDeck error:', err)
      throw err
    }
  }

  return {
    decks,
    loading,
    error,
    fetchDecks,
    createDeck,
    deleteDeck,
  }
}
