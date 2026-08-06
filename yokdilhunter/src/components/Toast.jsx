import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

/**
 * Simple toast notification component.
 * Usage: <Toast message="Saved!" type="success" onClose={() => {}} />
 */
export function Toast({ message, type = 'info', onClose, duration = 3000 }) {
  useEffect(() => {
    if (!message) return
    const t = setTimeout(onClose, duration)
    return () => clearTimeout(t)
  }, [message, onClose, duration])

  if (!message) return null

  const cls = type === 'success' ? 'toast-success' : type === 'error' ? 'toast-error' : 'toast-info'

  const icon = type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ'

  return createPortal(
    <div className={`toast ${cls}`} role="alert">
      <span className="mr-2 font-bold">{icon}</span>
      {message}
    </div>,
    document.body
  )
}

/**
 * Hook to manage toast state.
 */
export function useToast() {
  const [toast, setToast] = useState({ message: '', type: 'info' })

  function showToast(message, type = 'info') {
    setToast({ message, type })
  }

  function clearToast() {
    setToast({ message: '', type: 'info' })
  }

  return { toast, showToast, clearToast }
}
