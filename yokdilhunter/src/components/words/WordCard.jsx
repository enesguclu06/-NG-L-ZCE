import { useState } from 'react'
import { playAudio } from '../../lib/audio'

const DIFFICULTY_CONFIG = {
  unrated: { label: 'Değerlendirilmemiş', cls: 'badge-unrated', dot: '⬤' },
  easy:    { label: 'Kolay',              cls: 'badge-easy',    dot: '⬤' },
  medium:  { label: 'Orta',               cls: 'badge-medium',  dot: '⬤' },
  hard:    { label: 'Zor',                cls: 'badge-hard',    dot: '⬤' },
}

/**
 * WordCard — displays a saved word in the Library view.
 * Supports edit mode (inline form) and delete confirmation.
 */
export function WordCard({ word, onDelete, onUpdate, decks = [] }) {
  const [showDelete, setShowDelete] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({
    turkish_translation: word.turkish_translation ?? '',
    definition: word.definition ?? '',
    synonyms: (word.synonyms ?? []).join(', '),
    phonetic: word.phonetic ?? '',
    example_sentence: word.example_sentence ?? '',
    deck_id: word.deck_id ?? '',
  })
  const [saving, setSaving] = useState(false)

  const diff = DIFFICULTY_CONFIG[word.difficulty] ?? DIFFICULTY_CONFIG.unrated

  const synonymsArr = Array.isArray(word.synonyms) ? word.synonyms : []
  const createdDate = new Date(word.created_at).toLocaleDateString('tr-TR', {
    day: 'numeric', month: 'short', year: 'numeric'
  })
  const lastReviewed = word.last_reviewed_at
    ? new Date(word.last_reviewed_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })
    : null

  async function handleSaveEdit() {
    setSaving(true)
    try {
      await onUpdate(word.id, {
        turkish_translation: editForm.turkish_translation,
        definition: editForm.definition,
        synonyms: editForm.synonyms.split(',').map(s => s.trim()).filter(Boolean),
        phonetic: editForm.phonetic,
        example_sentence: editForm.example_sentence,
        deck_id: editForm.deck_id || null,
      })
      setEditing(false)
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  async function handleQuickRate(newDiff) {
    try {
      await onUpdate(word.id, { difficulty: newDiff })
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <div className="group glass rounded-2xl p-4 shadow-card hover:shadow-card-hover transition-shadow duration-300 animate-card-appear relative">
      {/* ── Header row ── */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h3 className="text-lg font-bold text-white truncate">{word.english_word}</h3>
            {word.phonetic && (
              <span className="text-slate-500 text-xs font-mono shrink-0">{word.phonetic}</span>
            )}
            <button 
              onClick={() => playAudio(word.english_word)}
              className="text-slate-400 hover:text-primary-300 p-1 rounded-md hover:bg-primary-500/10 transition-colors shrink-0"
              title="Dinle"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                <path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.318.664-2.66 1.905A9.76 9.76 0 0 0 1.5 12c0 .898.121 1.768.35 2.595.341 1.24 1.518 1.905 2.659 1.905h1.93l4.5 4.5c.945.945 2.561.276 2.561-1.06V4.06ZM18.584 5.106a.75.75 0 0 1 1.06 0c3.808 3.807 3.808 9.98 0 13.788a.75.75 0 0 1-1.06-1.06 8.25 8.25 0 0 0 0-11.668.75.75 0 0 1 0-1.06Z" />
                <path d="M15.932 7.757a.75.75 0 0 1 1.061 0 4.5 4.5 0 0 1 0 6.364.75.75 0 0 1-1.06-1.06 3 3 0 0 0 0-4.243.75.75 0 0 1 0-1.061Z" />
              </svg>
            </button>
          </div>
          <div className="flex gap-2">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${diff.cls}`}>
              <span className="text-[8px]">⬤</span> {diff.label}
            </span>
            {word.decks?.name && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-accent-500/15 text-accent-300 border border-accent-500/30">
                🏷️ {word.decks.name}
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          
          {/* Quick Rate */}
          <div className="flex opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity gap-1 mr-1">
            <button onClick={() => handleQuickRate('easy')} className="w-6 h-6 flex items-center justify-center text-[10px] font-bold rounded bg-easy/10 text-easy hover:bg-easy/20 transition-colors" title="Kolay Yap">K</button>
            <button onClick={() => handleQuickRate('medium')} className="w-6 h-6 flex items-center justify-center text-[10px] font-bold rounded bg-medium/10 text-medium hover:bg-medium/20 transition-colors" title="Orta Yap">O</button>
            <button onClick={() => handleQuickRate('hard')} className="w-6 h-6 flex items-center justify-center text-[10px] font-bold rounded bg-hard/10 text-hard hover:bg-hard/20 transition-colors" title="Zor Yap">Z</button>
          </div>

          <button
            id={`btn-edit-${word.id}`}
            onClick={() => { setEditing(e => !e); setShowDelete(false) }}
            className="text-slate-500 hover:text-primary-300 p-1.5 rounded-lg hover:bg-primary-500/10 transition-colors"
            title="Düzenle"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
            </svg>
          </button>
          <button
            id={`btn-delete-${word.id}`}
            onClick={() => { setShowDelete(d => !d); setEditing(false) }}
            className="text-slate-500 hover:text-hard p-1.5 rounded-lg hover:bg-hard/10 transition-colors"
            title="Sil"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Delete Confirmation ── */}
      {showDelete && (
        <div className="mb-3 p-3 rounded-xl bg-hard/10 border border-hard/20 flex items-center justify-between gap-3 animate-fade-up">
          <span className="text-hard text-sm font-medium">Bu kelimeyi silmek istiyor musun?</span>
          <div className="flex gap-2">
            <button onClick={() => setShowDelete(false)} className="text-slate-400 hover:text-white text-sm px-3 py-1 rounded-lg hover:bg-white/5 transition-colors">
              İptal
            </button>
            <button
              id={`btn-confirm-delete-${word.id}`}
              onClick={() => { onDelete(word.id); setShowDelete(false) }}
              className="btn-danger text-sm py-1 px-3"
            >
              Sil
            </button>
          </div>
        </div>
      )}

      {/* ── Edit Form ── */}
      {editing ? (
        <div className="space-y-3 animate-fade-up">
          <input
            id={`edit-translation-${word.id}`}
            className="input-base text-sm"
            value={editForm.turkish_translation}
            onChange={e => setEditForm(f => ({ ...f, turkish_translation: e.target.value }))}
            placeholder="Türkçe çeviri"
          />
          <textarea
            id={`edit-definition-${word.id}`}
            className="input-base text-sm resize-none min-h-[64px]"
            value={editForm.definition}
            onChange={e => setEditForm(f => ({ ...f, definition: e.target.value }))}
            placeholder="Tanım"
          />
          <textarea
            id={`edit-example-${word.id}`}
            className="input-base text-sm resize-none min-h-[48px]"
            value={editForm.example_sentence}
            onChange={e => setEditForm(f => ({ ...f, example_sentence: e.target.value }))}
            placeholder="Örnek Cümle"
          />
          <input
            id={`edit-synonyms-${word.id}`}
            className="input-base text-sm"
            value={editForm.synonyms}
            onChange={e => setEditForm(f => ({ ...f, synonyms: e.target.value }))}
            placeholder="Eş anlamlılar (virgülle)"
          />
          <select
            className="input-base text-sm cursor-pointer appearance-none"
            value={editForm.deck_id}
            onChange={e => setEditForm(f => ({ ...f, deck_id: e.target.value }))}
          >
            <option value="">Genel (Kategorisiz)</option>
            {decks.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
          <div className="flex gap-2">
            <button onClick={() => setEditing(false)} className="btn-ghost flex-1 py-2 text-sm">İptal</button>
            <button
              id={`btn-save-edit-${word.id}`}
              onClick={handleSaveEdit}
              disabled={saving}
              className="btn-primary flex-1 py-2 text-sm"
            >
              {saving ? 'Kaydediliyor...' : 'Kaydet'}
            </button>
          </div>
        </div>
      ) : (
        /* ── Word Details ── */
        <div className="space-y-2">
          {word.turkish_translation && (
            <p className="text-primary-300 font-semibold text-base">{word.turkish_translation}</p>
          )}
          {word.definition && (
            <p className="text-slate-400 text-sm leading-relaxed line-clamp-2">{word.definition}</p>
          )}
          {word.example_sentence && (
            <p className="text-slate-300 italic text-sm border-l-2 border-white/10 pl-3 py-0.5 mt-2">
              "{word.example_sentence}"
            </p>
          )}
          {synonymsArr.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {synonymsArr.slice(0, 5).map((syn, i) => (
                <span key={i} className="px-2 py-0.5 rounded-full bg-base-700 text-slate-400 text-xs font-medium border border-white/[0.05]">
                  {syn}
                </span>
              ))}
              {synonymsArr.length > 5 && (
                <span className="px-2 py-0.5 rounded-full bg-base-700 text-slate-500 text-xs">
                  +{synonymsArr.length - 5}
                </span>
              )}
            </div>
          )}

          {/* Footer stats */}
          <div className="flex items-center gap-3 pt-2 text-slate-600 text-xs border-t border-white/[0.04]">
            <span>{createdDate}</span>
            <span>·</span>
            <span>{word.review_count ?? 0} tekrar</span>
            {lastReviewed && (
              <>
                <span>·</span>
                <span>Son: {lastReviewed}</span>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
