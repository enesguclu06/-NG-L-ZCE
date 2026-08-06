import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// Register PWA service worker
if ('serviceWorker' in navigator) {
  // vite-plugin-pwa handles this automatically in production builds
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
