/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Dark navy base
        base: {
          950: '#07071a',
          900: '#0f0f1a',
          800: '#16162a',
          700: '#1e1e38',
          600: '#272745',
        },
        // Electric indigo primary
        primary: {
          300: '#a78bfa',
          400: '#8b5cf6',
          500: '#7c3aed',
          600: '#6d28d9',
        },
        // Amber accent
        accent: {
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
        },
        // Difficulty colors
        easy:   '#34d399',   // emerald
        medium: '#fbbf24',   // amber
        hard:   '#f87171',   // red
        unrated:'#94a3b8',   // slate
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'flip-in':  'flipIn 0.4s ease forwards',
        'fade-up':  'fadeUp 0.3s ease forwards',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
        'slide-up': 'slideUp 0.3s cubic-bezier(0.16,1,0.3,1) forwards',
        'card-appear': 'cardAppear 0.4s cubic-bezier(0.16,1,0.3,1) forwards',
      },
      keyframes: {
        flipIn: {
          '0%':   { transform: 'rotateY(90deg)', opacity: '0' },
          '100%': { transform: 'rotateY(0deg)',  opacity: '1' },
        },
        fadeUp: {
          '0%':   { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0.6' },
        },
        slideUp: {
          '0%':   { opacity: '0', transform: 'translateY(24px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        cardAppear: {
          '0%':   { opacity: '0', transform: 'scale(0.95) translateY(8px)' },
          '100%': { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
      },
      backdropBlur: {
        xs: '2px',
      },
      boxShadow: {
        'glow-primary': '0 0 24px rgba(124, 58, 237, 0.35)',
        'glow-accent':  '0 0 24px rgba(251, 191, 36, 0.35)',
        'card': '0 4px 24px rgba(0,0,0,0.4)',
        'card-hover': '0 8px 40px rgba(0,0,0,0.5)',
      },
    },
  },
  plugins: [],
}
