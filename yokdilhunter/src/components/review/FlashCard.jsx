import { playAudio } from '../../lib/audio'

/**
 * FlashCard — 3D flip card for review mode.
 *
 * Front: English word + phonetic + tap prompt
 * Back:  Turkish translation + definition + synonyms + difficulty buttons
 */
export function FlashCard({ word, isFlipped, onFlip, onRate }) {
  const synonymsArr = Array.isArray(word.synonyms) ? word.synonyms : []

  return (
    <div
      className="flip-card w-full"
      style={{ height: 'min(480px, 60dvh)' }}
      onClick={!isFlipped ? onFlip : undefined}
    >
      <div className={`flip-card-inner ${isFlipped ? 'flipped' : ''}`}>
        {/* ── Front ── */}
        <div className="flip-card-front glass flex flex-col items-center justify-center p-8 cursor-pointer select-none group">
          {/* Subtle glow on hover */}
          <div className="absolute inset-0 rounded-[1.25rem] bg-primary-500/0 group-hover:bg-primary-500/[0.03] transition-colors duration-300" />

          <div className="text-center relative z-10">
            {/* Word */}
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
            {word.example_sentence && (
              <p className="text-slate-300 italic text-base px-6 mb-6">
                "{word.example_sentence}"
              </p>
            )}

            {/* Tap hint */}
            <div className="flex items-center justify-center gap-2 mt-6">
              <div className="w-8 h-1 rounded-full bg-primary-500/40" />
              <span className="text-slate-500 text-xs font-medium">Çeviriyi görmek için dokun</span>
              <div className="w-8 h-1 rounded-full bg-primary-500/40" />
            </div>
          </div>
        </div>

        {/* ── Back ── */}
        <div className="flip-card-back glass flex flex-col p-6 overflow-auto">
          {/* Word header */}
          <div className="text-center mb-4">
            <p className="text-slate-500 text-xs font-semibold uppercase tracking-widest mb-2">Çeviri</p>
            <div className="flex items-center justify-center gap-2 mb-1">
              <h2 className="text-3xl font-black text-white break-words">{word.english_word}</h2>
              <button
                onClick={(e) => { e.stopPropagation(); playAudio(word.english_word) }}
                className="text-primary-400 hover:text-primary-300 p-1.5 rounded-full hover:bg-primary-500/20 transition-all shrink-0 active:scale-95"
                title="Dinle"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                  <path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.318.664-2.66 1.905A9.76 9.76 0 0 0 1.5 12c0 .898.121 1.768.35 2.595.341 1.24 1.518 1.905 2.659 1.905h1.93l4.5 4.5c.945.945 2.561.276 2.561-1.06V4.06ZM18.584 5.106a.75.75 0 0 1 1.06 0c3.808 3.807 3.808 9.98 0 13.788a.75.75 0 0 1-1.06-1.06 8.25 8.25 0 0 0 0-11.668.75.75 0 0 1 0-1.06Z" />
                  <path d="M15.932 7.757a.75.75 0 0 1 1.061 0 4.5 4.5 0 0 1 0 6.364.75.75 0 0 1-1.06-1.06 3 3 0 0 0 0-4.243.75.75 0 0 1 0-1.061Z" />
                </svg>
              </button>
            </div>
            {word.phonetic && (
              <p className="text-slate-500 font-mono text-sm">{word.phonetic}</p>
            )}
          </div>

          <div className="h-px bg-white/[0.06] mb-4" />

          {/* Turkish translation */}
          {word.turkish_translation && (
            <div className="mb-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Türkçe</p>
              <p className="text-primary-300 text-2xl font-bold">{word.turkish_translation}</p>
            </div>
          )}

          {/* Example Sentence */}
          {word.example_sentence && (
            <div className="mb-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Örnek</p>
              <p className="text-slate-300 text-sm italic leading-relaxed">"{word.example_sentence}"</p>
            </div>
          )}

          {/* Definition */}
          {word.definition && (
            <div className="mb-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Tanım</p>
              <p className="text-slate-300 text-sm leading-relaxed">{word.definition}</p>
            </div>
          )}

          {/* Synonyms */}
          {synonymsArr.length > 0 && (
            <div className="mb-4">
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

          {/* ── Difficulty Buttons ── */}
          <div className="mt-auto pt-2">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider text-center mb-3">
              Bu kelimeyi nasıl buldun?
            </p>
            <div className="grid grid-cols-3 gap-2">
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
          </div>
        </div>
      </div>
    </div>
  )
}
