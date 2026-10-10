import { useState, useEffect } from 'react'
import { playAudio } from '../../lib/audio'
import { fetchExampleSentence } from '../../lib/api'

/**
 * FlashCard — 3D flip card for review mode.
 *
 * Front: English word + phonetic + tap prompt
 * Back:  Turkish translation + definition + synonyms + difficulty buttons
 */
export function FlashCard({ word, isFlipped, onFlip, onRate, onSkip, onUpdateWord, onDelete }) {
  const synonymsArr = Array.isArray(word.synonyms) ? word.synonyms : []
  const [fetchingExample, setFetchingExample] = useState(false)
  const [currentExample, setCurrentExample] = useState(word.example_sentence ?? '')

  useEffect(() => {
    setCurrentExample(word.example_sentence ?? '')
  }, [word.id, word.example_sentence])

  async function handleFetchExample(e) {
    e?.stopPropagation()
    if (fetchingExample) return
    setFetchingExample(true)
    try {
      const sentence = await fetchExampleSentence(word.english_word)
      if (sentence) {
        setCurrentExample(sentence)
        if (onUpdateWord) {
          await onUpdateWord(word.id, { example_sentence: sentence })
        }
      }
    } catch (err) {
      console.error(err)
    } finally {
      setFetchingExample(false)
    }
  }

  return (
    <div
      className="flip-card w-full"
      style={{
        minHeight: '660px',
        height: 'calc(100dvh - 160px)',
        maxHeight: '850px'
      }}
      onClick={!isFlipped ? onFlip : undefined}
    >
      <div className={`flip-card-inner ${isFlipped ? 'flipped' : ''}`}>
        {/* ── Front ── */}
        <div className="flip-card-front glass flex flex-col items-center justify-center p-8 cursor-pointer select-none group relative">
          {/* Subtle glow on hover */}
          <div className="absolute inset-0 rounded-[1.25rem] bg-primary-500/0 group-hover:bg-primary-500/[0.03] transition-colors duration-300 pointer-events-none" />

          {/* Delete Button (Front) */}
          {onDelete && (
            <button
              type="button"
              id="btn-delete-flashcard-front"
              onClick={(e) => {
                e.stopPropagation()
                onDelete()
              }}
              className="absolute top-4 right-4 p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all z-20"
              title="Kelimeyi Sil"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
              </svg>
            </button>
          )}

          <div className="text-center relative z-10 w-full max-w-lg">
            {/* Word label */}
            <p className="text-slate-500 text-xs font-semibold uppercase tracking-widest mb-4">İngilizce</p>
            
            <div className="flex items-center justify-center gap-3 mb-3">
              <h2 className="text-5xl sm:text-6xl font-black text-white leading-tight break-words hyphens-auto">
                {word.english_word}
              </h2>
              <button
                onClick={(e) => { e.stopPropagation(); playAudio(word.english_word) }}
                className="text-primary-400 hover:text-primary-300 p-2 rounded-full hover:bg-primary-500/20 transition-all shrink-0 active:scale-95"
                title="Dinle"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8">
                  <path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.318.664-2.66 1.905A9.76 9.76 0 0 0 1.5 12c0 .898.121 1.768.35 2.595.341 1.24 1.518 1.905 2.659 1.905h1.93l4.5 4.5c.945.945 2.561.276 2.561-1.06V4.06ZM18.584 5.106a.75.75 0 0 1 1.06 0c3.808 3.807 3.808 9.98 0 13.788a.75.75 0 0 1-1.06-1.06 8.25 8.25 0 0 0 0-11.668.75.75 0 0 1 0-1.06Z" />
                  <path d="M15.932 7.757a.75.75 0 0 1 1.061 0 4.5 4.5 0 0 1 0 6.364.75.75 0 0 1-1.06-1.06 3 3 0 0 0 0-4.243.75.75 0 0 1 0-1.061Z" />
                </svg>
              </button>
            </div>

            {word.phonetic && (
              <p className="text-slate-400 font-mono text-lg mb-6">{word.phonetic}</p>
            )}

            {/* Example sentence on front */}
            {currentExample && (
              <p className="text-slate-300 italic text-base px-6 mb-6">
                "{currentExample}"
              </p>
            )}

            {/* Tap hint + Space hint */}
            <div className="flex items-center justify-center gap-2 mt-8">
              <div className="w-8 h-1 rounded-full bg-primary-500/40" />
              <span className="text-slate-500 text-xs font-medium">Çeviriyi görmek için dokun</span>
              <div className="w-8 h-1 rounded-full bg-primary-500/40" />
            </div>
            <p className="text-slate-600 text-[11px] mt-2 text-center">
              <kbd className="px-1.5 py-0.5 rounded bg-base-700 border border-white/10 font-mono text-[10px]">Space</kbd> ile geç
            </p>
          </div>
        </div>

        {/* ── Back ── */}
        <div className="flip-card-back glass flex flex-col p-6 overflow-y-auto relative">
          {/* Delete Button (Back - top right) */}
          {onDelete && (
            <button
              type="button"
              id="btn-delete-flashcard-back"
              onClick={(e) => {
                e.stopPropagation()
                onDelete()
              }}
              className="absolute top-4 right-4 p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all z-30"
              title="Kelimeyi Sil"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
              </svg>
            </button>
          )}
          {/* Word header — sticky at the top so English word NEVER disappears when scrolling */}
          <div className="sticky top-0 bg-base-800/95 backdrop-blur-md pb-3 pt-1 z-20 border-b border-white/[0.06] -mx-6 px-6 mb-3 text-center">
            <p className="text-slate-500 text-[10px] font-semibold uppercase tracking-widest mb-1">İngilizce</p>
            <div className="flex items-center justify-center gap-2">
              <h2 className="text-2xl sm:text-3xl font-black text-white break-words">{word.english_word}</h2>
              <button
                onClick={(e) => { e.stopPropagation(); playAudio(word.english_word) }}
                className="text-primary-400 hover:text-primary-300 p-1.5 rounded-full hover:bg-primary-500/20 transition-all shrink-0 active:scale-95"
                title="Dinle"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 sm:w-6 sm:h-6">
                  <path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.318.664-2.66 1.905A9.76 9.76 0 0 0 1.5 12c0 .898.121 1.768.35 2.595.341 1.24 1.518 1.905 2.659 1.905h1.93l4.5 4.5c.945.945 2.561.276 2.561-1.06V4.06ZM18.584 5.106a.75.75 0 0 1 1.06 0c3.808 3.807 3.808 9.98 0 13.788a.75.75 0 0 1-1.06-1.06 8.25 8.25 0 0 0 0-11.668.75.75 0 0 1 0-1.06Z" />
                  <path d="M15.932 7.757a.75.75 0 0 1 1.061 0 4.5 4.5 0 0 1 0 6.364.75.75 0 0 1-1.06-1.06 3 3 0 0 0 0-4.243.75.75 0 0 1 0-1.061Z" />
                </svg>
              </button>
            </div>
            {word.phonetic && (
              <p className="text-slate-500 font-mono text-xs">{word.phonetic}</p>
            )}
          </div>

          {/* Turkish translation */}
          {word.turkish_translation && (
            <div className="mb-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Türkçe</p>
              <p className="text-primary-300 text-2xl font-bold">{word.turkish_translation}</p>
            </div>
          )}

          {/* Example Sentence */}
          {currentExample ? (
            <div className="mb-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Örnek</p>
              <p className="text-slate-300 text-sm italic leading-relaxed">"{currentExample}"</p>
            </div>
          ) : (
            <div className="mb-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Örnek</p>
              <button
                type="button"
                onClick={handleFetchExample}
                disabled={fetchingExample}
                className="inline-flex items-center gap-1.5 text-xs text-primary-400 hover:text-primary-300 bg-primary-500/10 hover:bg-primary-500/20 border border-primary-500/25 px-2.5 py-1 rounded-md transition-all shadow-sm"
              >
                {fetchingExample ? '⏳ Cümle aranıyor...' : '✨ Örnek Cümle Ekle'}
              </button>
            </div>
          )}

          {/* Definition */}
          {word.definition && (
            <div className="mb-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Tanım</p>
              <p className="text-slate-300 text-sm leading-relaxed">{word.definition}</p>
            </div>
          )}

          {/* Synonyms */}
          {synonymsArr.length > 0 && (
            <div className="mb-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Eş Anlamlılar</p>
              <div className="flex flex-wrap gap-1.5">
                {synonymsArr.slice(0, 6).map((syn, i) => (
                  <span key={i} className="px-2 py-0.5 rounded-full bg-base-700 text-slate-300 text-xs border border-white/[0.05]">
                    {syn}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* ── Difficulty Buttons + Skip ── */}
          <div className="mt-auto pt-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider text-center mb-2.5">
              Bu kelimeyi nasıl buldun?
            </p>
            <div className="grid grid-cols-3 gap-2.5 mb-2.5">
              <button
                id="btn-rate-hard"
                onClick={(e) => { e.stopPropagation(); onRate('hard') }}
                className="btn-hard text-sm py-3 flex flex-col items-center gap-0.5"
              >
                <span className="text-lg">😰</span>
                <span>Zor</span>
              </button>
              <button
                id="btn-rate-medium"
                onClick={(e) => { e.stopPropagation(); onRate('medium') }}
                className="btn-medium text-sm py-3 flex flex-col items-center gap-0.5"
              >
                <span className="text-lg">🤔</span>
                <span>Orta</span>
              </button>
              <button
                id="btn-rate-easy"
                onClick={(e) => { e.stopPropagation(); onRate('easy') }}
                className="btn-easy text-sm py-3 flex flex-col items-center gap-0.5"
              >
                <span className="text-lg">😊</span>
                <span>Kolay</span>
              </button>
            </div>
            {/* Skip & Delete button */}
            <div className="flex gap-2">
              <button
                id="btn-skip"
                onClick={(e) => { e.stopPropagation(); onSkip() }}
                className="flex-1 py-2.5 rounded-xl border border-white/[0.08] bg-base-800/80 text-slate-400 hover:text-white hover:border-white/20 text-xs font-semibold transition-all shadow-sm"
              >
                ⏭ Geç &nbsp;<span className="opacity-60 font-mono">Space</span>
              </button>
              {onDelete && (
                <button
                  type="button"
                  id="btn-delete-card-action"
                  onClick={(e) => { e.stopPropagation(); onDelete() }}
                  className="px-3.5 py-2.5 rounded-xl border border-red-500/20 bg-red-500/10 text-red-400 hover:text-red-300 hover:bg-red-500/20 text-xs font-semibold transition-all shadow-sm flex items-center justify-center gap-1.5"
                  title="Kelimeyi Sil"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                  </svg>
                  <span>Sil</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
