import { useState, useEffect } from 'react'
import { fetchWordData } from '../lib/api'
import { playAudio } from '../lib/audio'
import { useWords } from '../hooks/useWords'
import { useDecks } from '../hooks/useDecks'
import { Toast, useToast } from '../components/Toast'

const EMPTY_FORM = {
  english_word: '',
  phonetic: '',
  definition: '',
  turkish_translation: '',
  example_sentence: '',
  deck_id: '',
}

export default function AddWordPage() {
  const [searchWord, setSearchWord] = useState('')
  const [fetching, setFetching] = useState(false)
  const [preview, setPreview] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [apiErrors, setApiErrors] = useState([])
  const [saving, setSaving] = useState(false)

  const { addWord } = useWords()
  const { decks, fetchDecks } = useDecks()
  const { toast, showToast, clearToast } = useToast()

  useEffect(() => {
    fetchDecks()
  }, [fetchDecks])

  // ── Fetch word data from APIs ──────────────────────────────────
  async function handleSearch(e) {
    e.preventDefault()
    const word = searchWord.trim()
    if (!word) return

    setFetching(true)
    setPreview(null)
    setApiErrors([])

    try {
      const result = await fetchWordData(word)
      setPreview(result)
      setForm({
        english_word: result.english_word,
        phonetic: result.phonetic ?? '',
        definition: result.definition ?? '',
        synonyms: result.synonyms ?? [],
        turkish_translation: result.turkish_translation ?? '',
        example_sentence: result.example_sentence ?? '',
        deck_id: '',
      })
      setApiErrors(result.errors ?? [])
    } catch (err) {
      setApiErrors([err.message])
      // Still allow manual entry
      setPreview({ english_word: word, phonetic: '', definition: '', synonyms: [], turkish_translation: '' })
      setForm({ ...EMPTY_FORM, english_word: word })
    } finally {
      setFetching(false)
    }
  }

  // ── Save word to Supabase ──────────────────────────────────────
  async function handleSave() {
    if (!form.english_word.trim()) return
    setSaving(true)
    try {
      await addWord({
        ...form,
        synonyms: typeof form.synonyms === 'string'
          ? form.synonyms.split(',').map(s => s.trim()).filter(Boolean)
          : form.synonyms,
      })
      showToast(`"${form.english_word}" kaydedildi! 🎉`, 'success')
      setPreview(null)
      setForm(EMPTY_FORM)
      setSearchWord('')
      setApiErrors([])
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  function handleDiscard() {
    setPreview(null)
    setForm(EMPTY_FORM)
    setSearchWord('')
    setApiErrors([])
  }

  const synonymsDisplay = Array.isArray(form.synonyms) ? form.synonyms.join(', ') : form.synonyms

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <Toast {...toast} onClose={clearToast} />

      {/* ── Header ── */}
      <div className="mb-6 animate-fade-up">
        <h2 className="text-2xl font-black text-white">Kelime Ekle</h2>
        <p className="text-slate-400 text-sm mt-1">İngilizce kelimeyi yaz, otomatik çevirisini getir</p>
      </div>

      {/* ── Search Box ── */}
      <form onSubmit={handleSearch} className="flex gap-3 mb-6 animate-fade-up">
        <input
          id="input-search-word"
          type="text"
          value={searchWord}
          onChange={e => setSearchWord(e.target.value)}
          className="input-base flex-1"
          placeholder="Kelime veya ifade yaz (örn. ephemeral)"
          disabled={fetching}
        />
        <button
          id="btn-search-word"
          type="submit"
          disabled={fetching || !searchWord.trim()}
          className="btn-primary shrink-0 px-5"
        >
          {fetching ? (
            <LoadingSpinner />
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
          )}
        </button>
      </form>

      {/* ── Loading State ── */}
      {fetching && (
        <div className="glass rounded-2xl p-8 text-center animate-fade-up">
          <LoadingSpinner size="lg" />
          <p className="text-slate-400 mt-3 text-sm animate-pulse-soft">API'lerden veri alınıyor...</p>
        </div>
      )}

      {/* ── API Warnings ── */}
      {!fetching && apiErrors.length > 0 && (
        <div className="mb-4 p-4 rounded-xl bg-hard/10 border border-hard/20 animate-fade-up">
          <p className="text-hard text-xs font-semibold mb-1">⚠ Bazı veriler alınamadı — lütfen manuel doldur:</p>
          {apiErrors.map((err, i) => (
            <p key={i} className="text-slate-400 text-xs">{err}</p>
          ))}
        </div>
      )}

      {/* ── Preview / Edit Card ── */}
      {preview && !fetching && (
        <div className="glass rounded-3xl p-6 shadow-card animate-card-appear space-y-5">
          {/* Word + phonetic header */}
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2 py-0.5 rounded-lg bg-primary-500/20 text-primary-300 text-xs font-semibold uppercase tracking-wider">
                  Preview
                </span>
              </div>
              <div className="flex items-center gap-3">
                <h3 className="text-3xl font-black text-white leading-tight">{form.english_word}</h3>
                <button
                  onClick={() => playAudio(form.english_word)}
                  className="text-primary-400 hover:text-primary-300 p-1.5 rounded-lg hover:bg-primary-500/20 transition-all shrink-0 active:scale-95"
                  title="Dinle"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                    <path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.318.664-2.66 1.905A9.76 9.76 0 0 0 1.5 12c0 .898.121 1.768.35 2.595.341 1.24 1.518 1.905 2.659 1.905h1.93l4.5 4.5c.945.945 2.561.276 2.561-1.06V4.06ZM18.584 5.106a.75.75 0 0 1 1.06 0c3.808 3.807 3.808 9.98 0 13.788a.75.75 0 0 1-1.06-1.06 8.25 8.25 0 0 0 0-11.668.75.75 0 0 1 0-1.06Z" />
                    <path d="M15.932 7.757a.75.75 0 0 1 1.061 0 4.5 4.5 0 0 1 0 6.364.75.75 0 0 1-1.06-1.06 3 3 0 0 0 0-4.243.75.75 0 0 1 0-1.061Z" />
                  </svg>
                </button>
              </div>
              {form.phonetic && (
                <p className="text-slate-400 text-sm mt-0.5 font-mono">{form.phonetic}</p>
              )}
            </div>
            <button
              id="btn-discard-preview"
              onClick={handleDiscard}
              className="text-slate-500 hover:text-slate-300 p-2 hover:bg-white/5 rounded-xl transition-colors"
              title="İptal"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="h-px bg-white/[0.06]" />

          {/* Editable fields */}
          <div className="space-y-4">
            <Field label="Türkçe Çeviri" id="field-translation">
              <input
                id="input-translation"
                className="input-base"
                value={form.turkish_translation}
                onChange={e => setForm(f => ({ ...f, turkish_translation: e.target.value }))}
                placeholder="Türkçe karşılığı..."
              />
            </Field>

            <Field label="Tanım / Definition" id="field-definition">
              <textarea
                id="input-definition"
                className="input-base resize-none min-h-[80px]"
                value={form.definition}
                onChange={e => setForm(f => ({ ...f, definition: e.target.value }))}
                placeholder="İngilizce tanım..."
              />
            </Field>

            <Field label="Örnek Cümle" id="field-example">
              <textarea
                id="input-example"
                className="input-base resize-none min-h-[60px]"
                value={form.example_sentence}
                onChange={e => setForm(f => ({ ...f, example_sentence: e.target.value }))}
                placeholder="She flashed a quick, ephemeral smile."
              />
            </Field>

            <Field label="Eş Anlamlılar (virgülle ayır)" id="field-synonyms">
              <input
                id="input-synonyms"
                className="input-base"
                value={synonymsDisplay}
                onChange={e => setForm(f => ({ ...f, synonyms: e.target.value.split(',').map(s => s.trim()).filter(Boolean) }))}
                placeholder="brief, fleeting, transient..."
              />
            </Field>

            <Field label="Fonetik" id="field-phonetic">
              <input
                id="input-phonetic"
                className="input-base"
                value={form.phonetic}
                onChange={e => setForm(f => ({ ...f, phonetic: e.target.value }))}
                placeholder="/ɪˈfem.ər.əl/"
              />
            </Field>

            <Field label="Kategori / Liste" id="field-category">
              <select
                id="input-category"
                className="input-base cursor-pointer appearance-none"
                value={form.deck_id}
                onChange={e => setForm(f => ({ ...f, deck_id: e.target.value }))}
              >
                <option value="">Tüm Kelimeler (Genel)</option>
                {decks.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </Field>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              id="btn-discard"
              onClick={handleDiscard}
              className="btn-ghost flex-1"
            >
              İptal
            </button>
            <button
              id="btn-save-word"
              onClick={handleSave}
              disabled={saving || !form.english_word.trim()}
              className="btn-primary flex-1"
            >
              {saving ? (
                <span className="flex items-center justify-center gap-2">
                  <LoadingSpinner size="sm" /> Kaydediliyor...
                </span>
              ) : (
                '💾 Kaydet'
              )}
            </button>
          </div>
        </div>
      )}

      {/* ── Empty State ── */}
      {!preview && !fetching && (
        <div className="text-center py-16 animate-fade-up">
          <div className="w-20 h-20 mx-auto mb-4 rounded-3xl bg-primary-500/10 border border-primary-500/20 flex items-center justify-center">
            <span className="text-4xl">🔍</span>
          </div>
          <p className="text-slate-400 font-medium">Bir kelime ara ve çevirisiyle kaydet</p>
          <p className="text-slate-600 text-sm mt-1">Ücretsiz API'ler otomatik çeviri + tanım getirir</p>
        </div>
      )}
    </div>
  )
}

function Field({ label, id, children }) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
        {label}
      </label>
      {children}
    </div>
  )
}

function LoadingSpinner({ size = 'md' }) {
  const sz = size === 'sm' ? 'w-4 h-4' : size === 'lg' ? 'w-8 h-8' : 'w-5 h-5'
  return (
    <svg className={`animate-spin ${sz} mx-auto`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}
