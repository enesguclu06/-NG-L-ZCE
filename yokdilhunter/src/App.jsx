import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import { useAuthStore } from './store/authStore'
import { Layout } from './components/layout/Layout'
import LandingPage from './pages/LandingPage'
import AuthPage from './pages/AuthPage'
import AddWordPage from './pages/AddWordPage'
import LibraryPage from './pages/LibraryPage'
import ReviewPage from './pages/ReviewPage'
import DashboardPage from './pages/DashboardPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import ExtensionGuidePage from './pages/ExtensionGuidePage'
import QuizPage from './pages/QuizPage'
import LeaderboardPage from './pages/LeaderboardPage'

/**
 * Listens for Supabase auth events (like PASSWORD_RECOVERY) and handles routing.
 */
function AuthRedirector() {
  const navigate = useNavigate()

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        navigate('/reset-password')
      }
    })

    // Fallback check on load
    if (window.location.hash.includes('type=recovery')) {
      navigate('/reset-password')
    }

    return () => subscription?.unsubscribe()
  }, [navigate])

  return null
}

/**
 * Protected route — redirects to /auth if user is not logged in.
 * Shows a loading spinner while auth state is being determined.
 */
function ProtectedRoute({ children }) {
  const user = useAuthStore(s => s.user)
  const loading = useAuthStore(s => s.loading)

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-base-900">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-primary-500 to-accent-400 flex items-center justify-center shadow-glow-primary animate-pulse-soft">
            <span className="text-white text-lg font-black">Y</span>
          </div>
          <svg className="animate-spin w-5 h-5 mx-auto text-primary-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/auth" replace />
  }

  return <Layout>{children}</Layout>
}

export default function App() {
  const init = useAuthStore(s => s.init)

  // Initialize auth state on mount
  useEffect(() => {
    init()
  }, [init])

  return (
    <BrowserRouter>
      <AuthRedirector />
      <Routes>
        {/* Public Landing & Showcase */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/welcome" element={<LandingPage />} />
        <Route path="/tanitim" element={<LandingPage />} />
        <Route path="/eklenti" element={<ExtensionGuidePage />} />
        <Route path="/extension" element={<ExtensionGuidePage />} />

        {/* Auth */}
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />

        {/* Protected */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/add"
          element={
            <ProtectedRoute>
              <AddWordPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/library"
          element={
            <ProtectedRoute>
              <LibraryPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/review"
          element={
            <ProtectedRoute>
              <ReviewPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/quiz"
          element={
            <ProtectedRoute>
              <QuizPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/leaderboard"
          element={
            <ProtectedRoute>
              <LeaderboardPage />
            </ProtectedRoute>
          }
        />

        {/* Fallback route */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
