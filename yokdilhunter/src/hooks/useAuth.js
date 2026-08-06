import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'

/**
 * Auth hook — exposes signUp, signIn, signOut helpers.
 * State (user, loading) is read from the global authStore.
 */
export function useAuth() {
  const { user, loading } = useAuthStore()

  async function signUp(email, password) {
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) throw error
    return data
  }

  async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }

  return { user, loading, signUp, signIn, signOut }
}
