import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'

export function ImportExportModal({ isOpen, onClose, words = [], decks = [], onRefresh }) {
  const userId = useAuthStore(s => s.user?.id)
  const [tab, setTab] = useState('import') // 'import' | 'export'
  const [inputText, setInputText] = useState('')
  const [selectedDeckId, setSelectedDeckId] = useState('')
  const [parsedList, setParsedList] = useState([])
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState(null)

  if (!isOpen) return null

  // Parse CSV / Text lines
  function handleParse(text) {
    setInputText(text)
    setImportResult(null)

    const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
    const parsed = []

    for (const line of lines) {
      // Split by comma, tab, semicolon or " - "
      let parts = []
      if (line.includes('\t')) parts = line.split('\t')
      else if (line.includes(';')) parts = line.split(';')
      else if (line.includes(' - ')) parts = line.split(' - ')
      else if (line.includes(',')) parts = line.split(',')
      else parts = [line]

      const en = (parts[0] || '').trim().replace(/^["']|["']$/g, '')
      const tr = (parts[1] || '').trim().replace(/^["']|["']$/g, '')

      // Skip CSV header if detected
      if (en.toLowerCase() === 'ingilizce kelime' || en.toLowerCase() === 'english_word') {
        continue
      }

      if (en) {
        parsed.push({ english_word: en, turkish_translation: tr || null })
      }
    }

    setParsedList(parsed)
  }

  function handleFileUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const content = event.target?.result || ''
      handleParse(content)
    }
    reader.readAsText(file, 'UTF-8')
  }

  async function handleImportSubmit() {
    if (!userId || parsedList.length === 0) return
    setImporting(true)
    setImportResult(null)

    let addedCount = 0
    let skippedCount = 0

    // Fetch existing words to avoid duplicate errors
    try {
      const { data: existingWords } = await supabase
        .from('words')
        .select('english_word')
        .eq('user_id', userId)

      const existingSet = new Set((existingWords || []).map(w => w.english_word.toLowerCase().trim()))

      const toInsert = []
      for (const item of parsedList) {
        const lower = item.english_word.toLowerCase().trim()
        if (existingSet.has(lower)) {
          skippedCount++
        } else {
          existingSet.add(lower)
          toInsert.push({
            user_id: userId,
            english_word: item.english_word.trim(),
            turkish_translation: item.turkish_translation ? item.turkish_translation.trim() : null,
            deck_id: selectedDeckId || null,
            difficulty: 'unrated',
            synonyms: [],
          })
          addedCount++
        }
      }

      if (toInsert.length > 0) {
        // Chunk insert in batches of 50
        for (let i = 0; i < toInsert.length; i += 50) {
          const chunk = toInsert.slice(i, i + 50)
          const { error: insErr } = await supabase.from('words').insert(chunk)
          if (insErr) throw insErr
        }
      }

      setImportResult({ added: addedCount, skipped: skippedCount })
      onRefresh?.()
    } catch (err) {
      console.error('Import error:', err)
      setImportResult({ error: err.message })
    } finally {
      setImporting(false)
    }
  }

  function handleExportCSV() {
    if (words.length === 0) return

    const headers = ['İngilizce Kelime', 'Türkçe Çeviri', 'Tanım', 'Eş Anlamlılar', 'Okunuş', 'Zorluk', 'Deste']

    const rows = words.map(w => {
      const escape = (str) => `"${(str || '').toString().replace(/"/g, '""')}"`
      return [
        escape(w.english_word),
        escape(w.turkish_translation),
        escape(w.definition),
        escape((w.synonyms || []).join(', ')),
        escape(w.phonetic),
        escape(w.difficulty),
        escape(w.decks?.name || 'Genel')
      ].join(',')
    })

    const csvContent = "\uFEFF" + [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)

    const link = document.createElement('a')
    link.href = url
    link.download = `enesglish_kelimeler_${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-base-950/80 backdrop-blur-md animate-fade-in">
      <div className="glass rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-white/15 relative overflow-hidden animate-card-appear">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 transition-colors"
        >
          ✕
        </button>

        {/* Tab Toggle */}
        <div className="flex bg-base-950 rounded-2xl p-1 mb-5">
          <button
            onClick={() => setTab('import')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
              tab === 'import' ? 'bg-primary-500 text-white shadow-glow-primary' : 'text-slate-400 hover:text-white'
            }`}
          >
            📥 İçe Aktar (Import)
          </button>
          <button
            onClick={() => setTab('export')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
              tab === 'export' ? 'bg-primary-500 text-white shadow-glow-primary' : 'text-slate-400 hover:text-white'
            }`}
          >
            📤 Dışa Aktar (Export)
          </button>
        </div>

        {tab === 'import' ? (
          <div className="space-y-4">
            <div>
              <h3 className="text-base font-bold text-white mb-1">Toplu Kelime Yükle</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                CSV veya metin dosyasını seçin ya da kelimeleri aşağıya yapıştırın.
                Format: <code className="text-primary-300">İngilizce, Türkçe</code> (her satıra bir kelime).
              </p>
            </div>

            {/* File Upload Input */}
            <div>
              <label className="block p-3 rounded-2xl border border-dashed border-white/20 hover:border-primary-400/50 bg-white/5 cursor-pointer text-center transition-colors">
                <input
                  type="file"
                  accept=".csv,.txt"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <span className="text-xs font-semibold text-primary-300">
                  📁 Bilgisayardan CSV veya TXT Dosyası Seç
                </span>
                <span className="block text-[10px] text-slate-500 mt-0.5">veya metni aşağıya yapıştır</span>
              </label>
            </div>

            {/* Paste Text Area */}
            <div>
              <textarea
                rows={4}
                value={inputText}
                onChange={e => handleParse(e.target.value)}
                placeholder={"ubiquitous, her yerde bulunan\nmeticulous, titiz\nscrutinize, dikkatle incelemek"}
                className="input-base text-xs font-mono"
              />
            </div>

            {/* Assign to Deck selection */}
            {decks.length > 0 && (
              <div>
                <label className="text-[11px] font-semibold text-slate-400 mb-1 block">
                  Kelimeleri Hangi Desteye Ekleyelim?
                </label>
                <select
                  value={selectedDeckId}
                  onChange={e => setSelectedDeckId(e.target.value)}
                  className="input-base text-xs py-2"
                >
                  <option value="">📁 Genel (Destesiz)</option>
                  {decks.map(d => (
                    <option key={d.id} value={d.id}>🏷️ {d.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Preview Section */}
            {parsedList.length > 0 && (
              <div className="p-3 rounded-2xl bg-base-950/80 border border-white/10 text-xs">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-white">Algılanan Kelimeler ({parsedList.length})</span>
                  <span className="text-[10px] text-emerald-400 font-semibold">Hazır ✓</span>
                </div>
                <div className="max-h-24 overflow-y-auto space-y-1 text-slate-300">
                  {parsedList.slice(0, 5).map((w, idx) => (
                    <div key={idx} className="flex justify-between text-[11px] border-b border-white/5 pb-0.5">
                      <span className="font-bold text-white">{w.english_word}</span>
                      <span className="text-slate-400">{w.turkish_translation || '—'}</span>
                    </div>
                  ))}
                  {parsedList.length > 5 && (
                    <p className="text-[10px] text-slate-500 text-center pt-1">
                      ...+{parsedList.length - 5} kelime daha
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Result Report */}
            {importResult && (
              <div className={`p-3 rounded-2xl border text-xs ${
                importResult.error
                  ? 'bg-red-500/15 border-red-500/40 text-red-300'
                  : 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
              }`}>
                {importResult.error ? (
                  <p>Hata: {importResult.error}</p>
                ) : (
                  <p>
                    🎉 <strong>{importResult.added} kelime</strong> başarıyla eklendi!
                    {importResult.skipped > 0 && ` (${importResult.skipped} mükerrer kelime atlandı)`}
                  </p>
                )}
              </div>
            )}

            {/* Action Button */}
            <button
              disabled={importing || parsedList.length === 0}
              onClick={handleImportSubmit}
              className="btn-primary w-full py-3 text-xs font-bold shadow-glow-primary disabled:opacity-50"
            >
              {importing ? 'Yükleniyor...' : `${parsedList.length} Kelimeyi Kütüphaneme Ekle 🚀`}
            </button>
          </div>
        ) : (
          /* Export Tab */
          <div className="space-y-5 text-center py-4">
            <div className="w-16 h-16 mx-auto rounded-3xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-3xl">
              📊
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Kütüphaneni CSV Olarak İndir</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                Kayıtlı <strong className="text-white">{words.length} kelimenin</strong> tümünü Excel, Google E-Tablolar veya Anki'ye aktarabileceğin UTF-8 CSV dosyası olarak dışa aktar.
              </p>
            </div>

            <button
              onClick={handleExportCSV}
              className="btn-primary py-3.5 px-8 text-xs font-bold shadow-glow-primary inline-flex items-center gap-2"
            >
              <span>📥 CSV Dosyasını İndir</span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
