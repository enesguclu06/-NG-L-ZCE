import { create } from 'zustand'
import { supabase } from '../lib/supabase'

/**
 * Global auth store using Zustand.
 * Subscribes to Supabase auth state changes and exposes user + loading state.
 */
let isAuthListenerSet = false

export const useAuthStore = create((set, get) => ({
  user: null,
  session: null,
  loading: true,
  _initialized: false,

  // Called once on app mount to initialize auth state
  init: async () => {
    if (get()._initialized) return
    set({ _initialized: true })

    try {
      // Get current session
      const { data: { session } } = await supabase.auth.getSession()
      set({ user: session?.user ?? null, session, loading: false })
    } catch (e) {
      console.warn('Failed to get initial session:', e)
      set({ user: null, session: null, loading: false })
    }

    // Listen for future auth changes (singleton)
    if (!isAuthListenerSet) {
      isAuthListenerSet = true
      supabase.auth.onAuthStateChange((_event, session) => {
        const currentUser = get().user
        const newUser = session?.user ?? null
        // Avoid setting state if user is unchanged
        if (!currentUser && !newUser) {
          set({ loading: false })
          return
        }
        set({ user: newUser, session, loading: false })
      })
    }
  },

  setUser: (user, session) => set({ user, session }),
  clearUser: () => set({ user: null, session: null }),
}))
