import { useState } from 'react'

export function DeckManagerModal({ isOpen, onClose, decks = [], words = [], onCreateDeck, onDeleteDeck }) {
  const [deckName, setDeckName] = useState('')
  const [creating, setCreating] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  if (!isOpen) return null

  // Word counts per deck
  const deckWordCounts = decks.reduce((acc, d) => {
    acc[d.id] = words.filter(w => w.deck_id === d.id).length
    return acc
  }, {})

  async function handleCreate(e) {
    e.preventDefault()
    if (!deckName.trim()) return
    setCreating(true)
    setErrorMsg('')
    try {
      await onCreateDeck(deckName.trim())
      setDeckName('')
    } catch (err) {
      setErrorMsg(err.message || 'Deste oluşturulamadı.')
    } finally {
      setCreating(false)
    }
  }

  async function handleDelete(deckId) {
    if (!confirm('Bu desteyi silmek istediğine emin misin? Destedeki kelimeler silinmez, Genel kategorisine geçer.')) {
      return
    }
    try {
      await onDeleteDeck(deckId)
    } catch (err) {
      alert(err.message || 'Deste silinemedi.')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-base-950/80 backdrop-blur-md animate-fade-in">
      <div className="glass rounded-3xl p-6 max-w-md w-full shadow-2xl border border-white/15 relative overflow-hidden animate-card-appear">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 transition-colors"
        >
          ✕
        </button>

        <div className="flex items-center gap-2 mb-4">
          <span className="text-2xl">🏷️</span>
          <div>
            <h3 className="text-base font-bold text-white">Desteleri Yönet</h3>
            <p className="text-xs text-slate-400">Kelimelerini konularına veya dizilere göre grupla</p>
          </div>
        </div>

        {/* Create Deck Form */}
        <form onSubmit={handleCreate} className="space-y-2 mb-5">
          <div className="flex gap-2">
            <input
              type="text"
              value={deckName}
              onChange={e => setDeckName(e.target.value)}
              placeholder="Yeni deste adı (örn: YÖKDİL Sağlık, The Boys)"
              className="input-base text-xs py-2.5 flex-1"
            />
            <button
              type="submit"
              disabled={creating || !deckName.trim()}
              className="btn-primary text-xs py-2.5 px-4 font-bold shrink-0 disabled:opacity-50"
            >
              {creating ? '...' : '+ Oluştur'}
            </button>
          </div>
          {errorMsg && <p className="text-[11px] text-red-400">{errorMsg}</p>}
        </form>

        {/* Existing Decks List */}
        <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
            Mevcut Destelerin ({decks.length})
          </div>

          {decks.length === 0 ? (
            <p className="text-xs text-slate-500 py-4 text-center">
              Henüz özel deste oluşturmadın. Yukarıdan ilk desteni ekle!
            </p>
          ) : (
            decks.map(deck => (
              <div
                key={deck.id}
                className="flex items-center justify-between p-3 rounded-2xl bg-base-950/80 border border-white/5 text-xs"
              >
                <div className="flex items-center gap-2">
                  <span>🏷️</span>
                  <span className="font-bold text-white">{deck.name}</span>
                  <span className="px-1.5 py-0.5 rounded-full bg-white/5 text-[10px] text-slate-400">
                    {deckWordCounts[deck.id] || 0} kelime
                  </span>
                </div>
                <button
                  onClick={() => handleDelete(deck.id)}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                  title="Desteyi Sil"
                >
                  🗑️
                </button>
              </div>
            ))
          )}
        </div>

        <div className="mt-5 pt-3 border-t border-white/5">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/10 text-slate-300 transition-colors"
          >
            Tamam
          </button>
        </div>
      </div>
    </div>
  )
}
