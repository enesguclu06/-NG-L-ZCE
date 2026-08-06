import { create } from 'zustand'
import { supabase } from '../lib/supabase'

/**
 * Global auth store using Zustand.
 * Subscribes to Supabase auth state changes and exposes user + loading state.
 */
export const useAuthStore = create((set) => ({
  user: null,
  session: null,
  loading: true,

  // Called once on app mount to initialize auth state
  init: async () => {
    // Get current session
    const { data: { session } } = await supabase.auth.getSession()
    set({ user: session?.user ?? null, session, loading: false })

    // Listen for future auth changes
    supabase.auth.onAuthStateChange((_event, session) => {
      set({ user: session?.user ?? null, session, loading: false })
    })
  },

  setUser: (user, session) => set({ user, session }),
  clearUser: () => set({ user: null, session: null }),
}))
