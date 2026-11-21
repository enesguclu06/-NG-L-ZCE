import { useState, useEffect, useMemo, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { supabase } from '../lib/supabase'
import { playAudio } from '../lib/audio'

export default function QuizPage() {
  const userId = useAuthStore(s => s.user?.id)

  // Loading & Word Pool
  const [loading, setLoading] = useState(true)
  const [wordPool, setWordPool] = useState([])

  // Quiz Setup States
  const [quizState, setQuizState] = useState('setup') // 'setup' | 'playing' | 'ended'
  const [questionCount, setQuestionCount] = useState(10)
  const [filterMode, setFilterMode] = useState('all') // 'all' | 'difficult' | 'review'

  // Game States
  const [questions, setQuestions] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState(null)
  const [isAnswerLocked, setIsAnswerLocked] = useState(false)
  const [score, setScore] = useState(0)
  const [startTime, setStartTime] = useState(null)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const timerRef = useRef(null)

  // Fetch Words on mount
  useEffect(() => {
    async function fetchQuizPool() {
      if (!userId) return
      setLoading(true)
      try {
        const { data, error } = await supabase
          .from('words')
          .select('*')
          .eq('user_id', userId)

        if (error) throw error
        setWordPool(data || [])
      } catch (err) {
        console.error('Quiz words fetch error:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchQuizPool()
  }, [userId])

  // Timer Effect
  useEffect(() => {
    if (quizState === 'playing') {
      timerRef.current = setInterval(() => {
        setElapsedSeconds(s => s + 1)
      }, 1000)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [quizState])

  // Keyboard navigation (1, 2, 3, 4 keys)
  useEffect(() => {
    function handleKeyDown(e) {
      if (quizState !== 'playing' || isAnswerLocked) return
      const currentQ = questions[currentIndex]
      if (!currentQ) return

      if (['1', '2', '3', '4'].includes(e.key)) {
        const optIdx = parseInt(e.key) - 1
        if (currentQ.options[optIdx]) {
          handleSelectOption(currentQ.options[optIdx])
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [quizState, isAnswerLocked, questions, currentIndex])

  // ── Quiz Question Generator ──
  function startQuiz() {
    let pool = [...wordPool]
    if (pool.length < 4) return

    // Apply Filter
    if (filterMode === 'difficult') {
      const filtered = pool.filter(w => w.difficulty === 'hard' || w.difficulty === 'medium')
      if (filtered.length >= 4) pool = filtered
    } else if (filterMode === 'review') {
      const now = new Date()
      const filtered = pool.filter(w => !w.next_review_at || new Date(w.next_review_at) <= now)
      if (filtered.length >= 4) pool = filtered
    }

    // Shuffle pool
    const shuffled = [...pool].sort(() => 0.5 - Math.random())
    const selected = shuffled.slice(0, Math.min(questionCount, shuffled.length))

    // Build question list
    const generated = selected.map((targetWord, idx) => {
      // Pick 3 distinct wrong options from pool
      const otherWords = pool.filter(w => w.id !== targetWord.id)
      const wrongRandom = [...otherWords].sort(() => 0.5 - Math.random()).slice(0, 3)

      // Question Type: 0 = EN -> TR, 1 = TR -> EN, 2 = Sentence Fill
      let qType = idx % 3
      if (qType === 2 && !targetWord.example_sentence) {
        qType = idx % 2
      }

      let questionText = ''
      let questionSubtitle = ''
      let correctAnswer = ''
      let wrongAnswers = []

      if (qType === 0) {
        // EN -> TR
        questionText = targetWord.english_word
        questionSubtitle = 'Bu kelimenin Türkçe karşılığı nedir?'
        correctAnswer = targetWord.turkish_translation || 'Tanım yok'
        wrongAnswers = wrongRandom.map(w => w.turkish_translation || w.english_word)
      } else if (qType === 1) {
        // TR -> EN
        questionText = targetWord.turkish_translation || targetWord.english_word
        questionSubtitle = 'Bu anlamı taşıyan İngilizce kelime hangisidir?'
        correctAnswer = targetWord.english_word
        wrongAnswers = wrongRandom.map(w => w.english_word)
      } else {
        // Fill Blank in Sentence
        const regex = new RegExp(`\\b${targetWord.english_word}\\b`, 'gi')
        questionText = targetWord.example_sentence.replace(regex, '_________')
        questionSubtitle = 'Boşluğa en uygun kelimeyi seçiniz:'
        correctAnswer = targetWord.english_word
        wrongAnswers = wrongRandom.map(w => w.english_word)
      }

      // Ensure 4 unique options and shuffle them
      const options = Array.from(new Set([correctAnswer, ...wrongAnswers]))
      while (options.length < 4 && pool.length >= 4) {
        const filler = pool[Math.floor(Math.random() * pool.length)].english_word
        if (!options.includes(filler)) options.push(filler)
      }
      options.sort(() => 0.5 - Math.random())

      return {
        id: targetWord.id,
        targetWord,
        qType,
        questionText,
        questionSubtitle,
        correctAnswer,
        options,
      }
    })

    setQuestions(generated)
    setCurrentIndex(0)
    setScore(0)
    setSelectedAnswer(null)
    setIsAnswerLocked(false)
    setElapsedSeconds(0)
    setStartTime(Date.now())
    setQuizState('playing')
  }

  function handleSelectOption(option) {
    if (isAnswerLocked) return
    setIsAnswerLocked(true)
    setSelectedAnswer(option)

    const currentQ = questions[currentIndex]
    const isCorrect = option === currentQ.correctAnswer

    if (isCorrect) {
      setScore(s => s + 1)
    }

    // Auto advance after 1.2s
    setTimeout(() => {
      if (currentIndex + 1 < questions.length) {
        setCurrentIndex(i => i + 1)
        setSelectedAnswer(null)
        setIsAnswerLocked(false)
      } else {
        setQuizState('ended')
      }
    }, 1200)
  }

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${m}:${s < 10 ? '0' : ''}${s}`
  }

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
      </div>
    )
  }

  // Not enough words view
  if (wordPool.length < 4) {
    return (
      <div className="max-w-md mx-auto text-center py-16 px-4 space-y-4">
        <div className="w-16 h-16 mx-auto rounded-3xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-3xl">
          🎯
        </div>
        <h2 className="text-xl font-bold text-white">Quiz İçin En Az 4 Kelime Gereklidir</h2>
        <p className="text-sm text-slate-400">
          Kütüphanende şu an {wordPool.length} kelime bulunuyor. 4 şıklı sorular üretebilmek için lütfen birkaç kelime daha ekle.
        </p>
        <Link to="/add" className="btn-primary inline-flex items-center gap-2">
          <span>Kelime Ekle</span>
          <span>➔</span>
        </Link>
      </div>
    )
  }

  // ── 1. SETUP SCREEN ──
  if (quizState === 'setup') {
    return (
      <div className="max-w-lg mx-auto py-8 px-4 space-y-6 animate-fade-in">
        <div className="text-center space-y-2">
          <div className="w-16 h-16 mx-auto rounded-3xl bg-gradient-to-br from-violet-600 via-indigo-600 to-fuchsia-500 flex items-center justify-center shadow-glow-primary text-3xl">
            🎯
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white">Quiz Sınav Modu</h1>
          <p className="text-xs sm:text-sm text-slate-400">
            Hafızandaki kelimeleri 4 şıklı çoktan seçmeli sınavla test et
          </p>
        </div>

        <div className="glass rounded-3xl p-6 border border-white/10 space-y-5 shadow-card">
          {/* Question Count Selection */}
          <div>
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block mb-2">
              Soru Sayısı
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[5, 10, 20].map(cnt => (
                <button
                  key={cnt}
                  onClick={() => setQuestionCount(cnt)}
                  className={`py-3 rounded-xl text-xs font-bold transition-all border ${
                    questionCount === cnt
                      ? 'bg-primary-500 border-primary-400 text-white shadow-glow-primary'
                      : 'bg-white/5 border-white/5 text-slate-400 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {cnt} Soru
                </button>
              ))}
            </div>
          </div>

          {/* Word Category Filter */}
          <div>
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block mb-2">
              Kelime Filtresi
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'all', label: 'Tüm Kelimeler' },
                { id: 'difficult', label: 'Zor & Orta' },
                { id: 'review', label: 'Tekrar Zamanı' },
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setFilterMode(f.id)}
                  className={`py-3 px-2 rounded-xl text-[11px] font-bold transition-all border truncate ${
                    filterMode === f.id
                      ? 'bg-accent-500/20 border-accent-400/50 text-accent-300'
                      : 'bg-white/5 border-white/5 text-slate-400 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Info pill */}
          <div className="p-3.5 rounded-2xl bg-base-950/80 border border-white/5 text-xs text-slate-400 space-y-1">
            <p>💡 <strong>3 Farklı Soru Tipi:</strong> İngilizce ➔ Türkçe, Türkçe ➔ İngilizce ve Cümlede Boşluk Doldurma.</p>
            <p>⌨️ Bilgisayarda klavyedeki <kbd className="bg-base-700 px-1 rounded text-primary-300">1</kbd>, <kbd className="bg-base-700 px-1 rounded text-primary-300">2</kbd>, <kbd className="bg-base-700 px-1 rounded text-primary-300">3</kbd>, <kbd className="bg-base-700 px-1 rounded text-primary-300">4</kbd> tuşlarıyla hızlıca işaretleyebilirsin.</p>
          </div>

          {/* Start CTA */}
          <button
            onClick={startQuiz}
            className="btn-primary w-full py-4 text-sm font-bold shadow-glow-primary flex items-center justify-center gap-2"
          >
            <span>Sınavı Başlat</span>
            <span>🚀</span>
          </button>
        </div>
      </div>
    )
  }

  // ── 2. PLAYING SCREEN ──
  const currentQ = questions[currentIndex]

  if (quizState === 'playing' && currentQ) {
    const progress = Math.round(((currentIndex + 1) / questions.length) * 100)

    return (
      <div className="max-w-xl mx-auto py-6 px-4 space-y-6 animate-fade-in">
        {/* Top Status Bar */}
        <div className="flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="font-bold text-white text-sm">
              Soru {currentIndex + 1} / {questions.length}
            </span>
            <span className="px-2 py-0.5 rounded-full bg-primary-500/20 text-primary-300 text-[10px] font-bold">
              {currentQ.qType === 0 ? 'EN ➔ TR' : currentQ.qType === 1 ? 'TR ➔ EN' : 'Cümle Boşluk'}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-amber-300">⏱️ {formatTime(elapsedSeconds)}</span>
            <span className="font-bold text-emerald-400">✓ {score}</span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="h-2 bg-base-950 rounded-full overflow-hidden border border-white/10">
          <div
            className="h-full bg-gradient-to-r from-primary-500 via-accent-400 to-emerald-400 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Question Card */}
        <div className="glass rounded-3xl p-6 sm:p-8 border border-white/15 text-center space-y-4 shadow-card">
          <p className="text-xs font-semibold text-primary-300 uppercase tracking-wider">
            {currentQ.questionSubtitle}
          </p>

          <div className="flex items-center justify-center gap-3">
            <h2 className="text-2xl sm:text-3xl font-black text-white leading-snug">
              {currentQ.questionText}
            </h2>
            {currentQ.qType === 0 && (
              <button
                onClick={() => playAudio(currentQ.targetWord.english_word)}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                title="Dinle"
              >
                🔊
              </button>
            )}
          </div>

          {currentQ.targetWord.phonetic && currentQ.qType === 0 && (
            <p className="text-xs font-mono text-slate-500">{currentQ.targetWord.phonetic}</p>
          )}
        </div>

        {/* 4 Options Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {currentQ.options.map((option, idx) => {
            const isSelected = selectedAnswer === option
            const isCorrect = option === currentQ.correctAnswer

            let btnCls = 'bg-base-800/80 hover:bg-base-700/80 border-white/10 text-slate-200 hover:border-white/20'

            if (isAnswerLocked) {
              if (isCorrect) {
                btnCls = 'bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-[0_0_15px_rgba(52,211,153,0.4)] scale-[1.02]'
              } else if (isSelected && !isCorrect) {
                btnCls = 'bg-red-500/20 border-red-500 text-red-300 shadow-[0_0_15px_rgba(239,68,68,0.4)]'
              } else {
                btnCls = 'bg-white/5 border-white/5 text-slate-500 opacity-50'
              }
            }

            return (
              <button
                key={option}
                disabled={isAnswerLocked}
                onClick={() => handleSelectOption(option)}
                className={`p-4 rounded-2xl border text-left font-semibold text-sm transition-all flex items-center justify-between ${btnCls}`}
              >
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-lg bg-base-950 flex items-center justify-center text-xs font-mono font-bold text-slate-400 shrink-0">
                    {idx + 1}
                  </span>
                  <span>{option}</span>
                </div>
                {isAnswerLocked && isCorrect && <span className="text-emerald-400 text-lg">✓</span>}
                {isAnswerLocked && isSelected && !isCorrect && <span className="text-red-400 text-lg">✕</span>}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  // ── 3. RESULTS / SCORE SCREEN ──
  const accuracy = Math.round((score / questions.length) * 100) || 0

  return (
    <div className="max-w-md mx-auto py-10 px-4 space-y-6 text-center animate-card-appear">
      <div className="glass rounded-3xl p-8 border border-white/15 space-y-6 shadow-2xl relative overflow-hidden">
        {/* Confetti or Trophy */}
        <div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-br from-violet-600 via-indigo-600 to-fuchsia-500 flex items-center justify-center shadow-glow-primary text-4xl">
          {accuracy >= 80 ? '🏆' : accuracy >= 50 ? '🌟' : '📚'}
        </div>

        <div>
          <h2 className="text-2xl sm:text-3xl font-black text-white">Sınav Tamamlandı!</h2>
          <p className="text-xs text-slate-400 mt-1">
            {accuracy >= 80
              ? 'Harika bir hafıza! Kelimeleri çok iyi kavramışsın.'
              : accuracy >= 50
                ? 'İyi iş çıkardın, biraz daha pratikle kusursuz olacak.'
                : 'Öğrenme sürecinin bir parçası. Aralıklı tekrara devam!'}
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-2">
          <div className="p-3 rounded-2xl bg-base-950/80 border border-white/5">
            <span className="text-xs text-slate-500 block">Doğruluk</span>
            <span className="text-xl font-black text-emerald-400">%{accuracy}</span>
          </div>
          <div className="p-3 rounded-2xl bg-base-950/80 border border-white/5">
            <span className="text-xs text-slate-500 block">Skor</span>
            <span className="text-xl font-black text-white">{score}/{questions.length}</span>
          </div>
          <div className="p-3 rounded-2xl bg-base-950/80 border border-white/5">
            <span className="text-xs text-slate-500 block">Süre</span>
            <span className="text-xl font-black text-amber-300">{formatTime(elapsedSeconds)}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2 pt-2">
          <button
            onClick={() => setQuizState('setup')}
            className="btn-primary w-full py-3.5 text-xs sm:text-sm font-bold shadow-glow-primary flex items-center justify-center gap-2"
          >
            <span>Yeniden Oyna</span>
            <span>🔄</span>
          </button>
          <Link
            to="/library"
            className="w-full py-3 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/10 text-slate-300 transition-colors block text-center"
          >
            Kütüphaneye Dön
          </Link>
        </div>
      </div>
    </div>
  )
}
