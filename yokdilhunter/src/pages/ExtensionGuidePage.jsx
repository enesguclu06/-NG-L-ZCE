import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'

const EXT_ZIP_URL = '/enesglish-extension.zip'

function ChromeExtLink() {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    navigator.clipboard.writeText('chrome://extensions/').then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="space-y-3">
      <p className="text-slate-300 text-sm leading-relaxed">
        Web sayfalarından <code className="bg-white/10 px-1.5 py-0.5 rounded text-primary-300 text-xs">chrome://</code> adresleri güvenlik gereği direkt açılamaz.
        Aşağıdaki butona tıkla, adres çubuğuna yapıştır ve Enter'a bas — 2 saniyen dahi tutmaz!
      </p>

      {/* Big prominent copy button */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="flex-1 flex items-center gap-3 bg-base-950 border border-white/15 rounded-xl px-4 py-3">
          <span className="text-primary-300 font-mono text-sm flex-1 select-all">chrome://extensions/</span>
        </div>
        <button
          onClick={handleCopy}
          className={`flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-bold text-sm transition-all hover:scale-[1.02] ${
            copied
              ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300'
              : 'bg-violet-600 hover:bg-violet-500 text-white shadow-[0_0_20px_rgba(124,58,237,0.4)]'
          }`}
        >
          {copied ? (
            <><span>✓</span><span>Kopyalandı!</span></>
          ) : (
            <><span>📋</span><span>Kopyala</span></>
          )}
        </button>
      </div>

      {/* Visual step */}
      <div className="bg-base-950 border border-white/10 rounded-2xl p-4 space-y-2">
        <p className="text-xs text-slate-500 font-mono uppercase tracking-wider mb-3">Nasıl açılır?</p>
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 rounded-full bg-violet-500/20 border border-violet-500/40 flex items-center justify-center text-violet-300 text-xs font-bold flex-shrink-0">1</div>
          <p className="text-xs text-slate-300">Yukarıdaki <strong className="text-white">"Kopyala"</strong> butonuna tıkla</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 rounded-full bg-violet-500/20 border border-violet-500/40 flex items-center justify-center text-violet-300 text-xs font-bold flex-shrink-0">2</div>
          <p className="text-xs text-slate-300">Chrome'un adres çubuğuna tıkla</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 rounded-full bg-violet-500/20 border border-violet-500/40 flex items-center justify-center text-violet-300 text-xs font-bold flex-shrink-0">3</div>
          <p className="text-xs text-slate-300"><kbd className="bg-base-700 border border-white/10 px-1.5 py-0.5 rounded text-xs">Ctrl+V</kbd> ile yapıştır ve <kbd className="bg-base-700 border border-white/10 px-1.5 py-0.5 rounded text-xs">Enter</kbd></p>
        </div>
      </div>

      <p className="text-xs text-slate-500">
        Ya da Chrome menüsünden: <span className="text-slate-300 font-medium">⋮ → Diğer Araçlar → Uzantılar</span>
      </p>
    </div>
  )
}

const steps = [
  {
    id: 1,
    icon: '📥',
    color: 'from-blue-600 to-cyan-500',
    glow: 'shadow-[0_0_20px_rgba(59,130,246,0.4)]',
    border: 'border-blue-500/30',
    badge: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    title: 'Eklenti Dosyalarını İndir',
    desc: 'Enesglish Chrome eklentisini bilgisayarına indirip çıkart.',
    details: (
      <div className="space-y-3">
        <p className="text-slate-300 text-sm leading-relaxed">
          Aşağıdaki butona tıklayarak eklenti ZIP dosyasını indir. İndirdikten sonra masaüstüne ya da istediğin bir klasöre çıkart.
        </p>

        {/* Download card */}
        <div className="bg-base-950 border border-blue-500/20 rounded-2xl p-4 flex flex-col sm:flex-row items-center gap-4">
          <div className="w-14 h-14 flex-shrink-0 rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center text-2xl shadow-[0_0_20px_rgba(59,130,246,0.4)]">
            🧩
          </div>
          <div className="flex-1 text-center sm:text-left">
            <p className="font-bold text-white text-sm">enesglish-extension.zip</p>
            <p className="text-xs text-slate-400 mt-0.5">Chrome Eklentisi — Tüm dosyalar dahil</p>
          </div>
          <a
            href={EXT_ZIP_URL}
            download="enesglish-extension.zip"
            className="flex-shrink-0 inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm transition-all hover:scale-[1.02] shadow-[0_0_20px_rgba(59,130,246,0.4)]"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <span>İndir</span>
          </a>
        </div>

        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 flex gap-2">
          <span className="text-amber-400 text-lg flex-shrink-0">⚠️</span>
          <div className="text-amber-200 text-xs leading-relaxed space-y-1">
            <p><strong>İndirdikten sonra ZIP'i çıkart:</strong> Dosyaya sağ tıkla → <strong>"Tümünü Çıkart"</strong></p>
            <p>Çıkarttığın klasörü <strong>silme veya taşıma!</strong> Chrome eklentiyi o konumdan yükler, silersen çalışmaz.</p>
          </div>
        </div>

        <p className="text-xs text-slate-500">
          Çıkarttıktan sonra içinde <code className="bg-white/10 px-1.5 py-0.5 rounded text-primary-300 text-[11px]">manifest.json</code> dosyası olan
          <code className="bg-white/10 px-1.5 py-0.5 rounded text-primary-300 text-[11px] ml-1">yokdilhunter-extension</code> klasörünü bul. Bir sonraki adımda onu seçeceksin.
        </p>
      </div>
    ),
  },
  {
    id: 2,
    icon: '⚙️',
    color: 'from-violet-600 to-purple-500',
    glow: 'shadow-[0_0_20px_rgba(124,58,237,0.4)]',
    border: 'border-violet-500/30',
    badge: 'bg-violet-500/20 text-violet-300 border-violet-500/30',
    title: 'Chrome Eklentiler Sayfasını Aç',
    desc: 'Adresi kopyala, Chrome\'un adres çubuğuna yapıştır, Enter\'a bas.',
    details: <ChromeExtLink />,
  },
  {
    id: 3,
    icon: '🔓',
    color: 'from-orange-500 to-amber-500',
    glow: 'shadow-[0_0_20px_rgba(249,115,22,0.4)]',
    border: 'border-orange-500/30',
    badge: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
    title: 'Geliştirici Modunu Aç',
    desc: 'Sağ üst köşedeki "Geliştirici modu" anahtarını aç (mavi olmalı).',
    details: (
      <div className="space-y-3">
        <p className="text-slate-300 text-sm leading-relaxed">
          Uzantılar sayfasının <strong>sağ üst köşesinde</strong> "Geliştirici modu" yazısını ve yanındaki toggle'ı görürsün.
          Bu toggle'a tıklayarak aktif et.
        </p>
        {/* Visual mockup of the toggle */}
        <div className="bg-base-950 border border-white/10 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-white/5">
            <span className="text-xs text-slate-400 font-mono">chrome://extensions/</span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-300 font-semibold">Geliştirici modu</span>
              {/* Mockup toggle ON */}
              <div className="w-10 h-5 rounded-full bg-blue-500 relative flex items-center px-0.5 shadow-[0_0_8px_rgba(59,130,246,0.5)]">
                <div className="w-4 h-4 rounded-full bg-white ml-auto shadow-sm" />
              </div>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <div className="px-3 py-1.5 rounded-lg bg-blue-600/80 text-white text-xs font-semibold">Paketlenmemiş öğe yükle</div>
            <div className="px-3 py-1.5 rounded-lg bg-white/5 text-slate-400 text-xs">Paketle</div>
            <div className="px-3 py-1.5 rounded-lg bg-white/5 text-slate-400 text-xs">Güncelle</div>
          </div>
        </div>
        <p className="text-xs text-emerald-400">
          ✓ Geliştirici modu açıldıktan sonra sol üste 3 yeni buton gelir. Şimdi bir sonraki adıma geç!
        </p>
      </div>
    ),
  },
  {
    id: 4,
    icon: '📂',
    color: 'from-emerald-600 to-teal-500',
    glow: 'shadow-[0_0_20px_rgba(16,185,129,0.4)]',
    border: 'border-emerald-500/30',
    badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    title: '"Paketlenmemiş öğe yükle"ye Tıkla',
    desc: 'Sol üstteki butona tıkla ve klasör seçme penceresinden yokdilhunter-extension klasörünü seç.',
    details: (
      <div className="space-y-3">
        <p className="text-slate-300 text-sm leading-relaxed">
          Sol üstte beliren <strong className="text-white">"Paketlenmemiş öğe yükle"</strong> butonuna tıkla.
          Açılan klasör seçme penceresinde ZIP'ten çıkarttığın klasörü bul ve
          <strong className="text-primary-300"> yokdilhunter-extension </strong> klasörünü seç.
        </p>
        <div className="bg-base-950 border border-white/10 rounded-2xl p-4 space-y-2">
          <div className="text-[11px] text-slate-500 font-mono mb-2">📁 Klasör seçme penceresi</div>
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary-500/20 border border-primary-500/40 text-primary-200 text-xs font-semibold">
            <span>📂</span>
            <span>yokdilhunter-extension</span>
            <span className="ml-auto text-primary-400">← BU KLASÖRÜ SEÇ</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/3 text-slate-500 text-xs opacity-50">
            <span>📂</span>
            <span>yokdilhunter (web sitesi — bunu seçme)</span>
          </div>
        </div>
        <p className="text-xs text-slate-400">
          İçinde <code className="bg-white/10 px-1 rounded text-xs text-primary-300">manifest.json</code> dosyası olan klasörü seçmen gerekiyor.
        </p>
      </div>
    ),
  },
  {
    id: 5,
    icon: '🔑',
    color: 'from-pink-600 to-rose-500',
    glow: 'shadow-[0_0_20px_rgba(236,72,153,0.4)]',
    border: 'border-pink-500/30',
    badge: 'bg-pink-500/20 text-pink-300 border-pink-500/30',
    title: 'Eklentiye Hesabınla Giriş Yap',
    desc: 'Eklenti ikonuna tıkla ve Enesglish hesabınla giriş yap.',
    details: (
      <div className="space-y-3">
        <p className="text-slate-300 text-sm leading-relaxed">
          Eklenti başarıyla yüklenince Chrome araç çubuğunda Enesglish logosu belirir.
          Puzzle (🧩) ikonuna tıklayıp <strong className="text-white">Enesglish</strong>'i sabitle.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="bg-base-950 border border-white/10 rounded-xl p-3 text-center space-y-1">
            <div className="text-2xl">🧩</div>
            <p className="text-xs text-slate-400">Chrome'da sağ üstteki<br/>puzzle ikonuna tıkla</p>
            <p className="text-xs text-primary-300 font-semibold">→ Enesglish'i sabitle</p>
          </div>
          <div className="bg-base-950 border border-white/10 rounded-xl p-3 text-center space-y-1">
            <div className="text-2xl">🔑</div>
            <p className="text-xs text-slate-400">Enesglish ikonuna tıkla<br/>ve e-posta + şifrenle</p>
            <p className="text-xs text-emerald-300 font-semibold">→ Giriş Yap</p>
          </div>
        </div>
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 flex gap-2">
          <span className="text-emerald-400 text-lg flex-shrink-0">🎉</span>
          <p className="text-emerald-200 text-xs leading-relaxed">
            Hepsi bu kadar! Artık Amazon Prime Video, YouTube ve Netflix'te altyazılar interaktif hale gelir.
            Kelimeye tıklayarak anında kütüphanene ekleyebilirsin.
          </p>
        </div>
      </div>
    ),
  },
]

export default function ExtensionGuidePage() {
  const [activeStep, setActiveStep] = useState(1) // 1. adım default açık

  // Sayfaya girilince en üstten başla
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [])

  return (
    <div className="min-h-dvh flex flex-col bg-base-950 text-slate-100 relative overflow-x-hidden">
      {/* Ambient bg */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute -top-32 -right-32 w-[400px] h-[400px] bg-blue-600/10 rounded-full blur-[120px]" />
        <div className="absolute top-1/2 -left-32 w-[350px] h-[350px] bg-violet-600/10 rounded-full blur-[120px]" />
        <div className="absolute -bottom-32 left-1/3 w-[400px] h-[400px] bg-emerald-600/10 rounded-full blur-[130px]" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-40 bg-base-950/80 backdrop-blur-md border-b border-white/[0.08] safe-top">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-1.5 text-slate-400 hover:text-white transition-colors text-sm font-medium group">
              <span className="transition-transform group-hover:-translate-x-1">←</span>
              <span>Ana Sayfa</span>
            </Link>
            <span className="text-white/20">/</span>
            <span className="text-sm font-semibold text-slate-200 hidden sm:block">Chrome Eklenti Kurulum Rehberi</span>
          </div>
          <a
            href={EXT_ZIP_URL}
            download="enesglish-extension.zip"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600/80 hover:bg-blue-500 border border-blue-500/30 text-white text-xs font-bold transition-all hover:scale-[1.02]"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Eklentiyi İndir
          </a>
        </div>
      </header>

      <main className="flex-1 relative z-10 max-w-4xl mx-auto w-full px-4 py-10 sm:py-16 pb-24 space-y-12">

        {/* Hero */}
        <div className="text-center space-y-5">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-200 text-xs font-semibold">
            <span>🧩</span>
            <span>Chrome Eklentisi — Geliştirici Modu Kurulumu</span>
          </div>

          <div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-br from-violet-600 via-indigo-600 to-fuchsia-500 flex items-center justify-center shadow-[0_0_40px_rgba(124,58,237,0.5)] border border-white/20">
            <span className="text-white text-3xl font-black tracking-tight">EG</span>
          </div>

          <div>
            <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white mb-3">
              Chrome Eklentisini Kur
            </h1>
            <p className="max-w-2xl mx-auto text-sm sm:text-base text-slate-300 leading-relaxed">
              Enesglish eklentisi Chrome Web Mağazası yerine <strong className="text-white">Geliştirici Modu</strong> ile yüklenir.
              Tamamen <span className="text-emerald-400 font-semibold">ücretsiz</span> ve güvenli — 5 adımda kurulum tamamlanıyor.
            </p>
          </div>

          {/* Supported platforms */}
          <div className="flex flex-wrap items-center justify-center gap-3">
            {[
              { icon: '🎬', name: 'Amazon Prime Video' },
              { icon: '▶️', name: 'YouTube' },
              { icon: '🍿', name: 'Netflix' },
            ].map(p => (
              <div key={p.name} className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-slate-300 font-medium">
                <span>{p.icon}</span>
                <span>{p.name}</span>
              </div>
            ))}
          </div>

          {/* Quick Download CTA */}
          <a
            href={EXT_ZIP_URL}
            download="enesglish-extension.zip"
            className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm transition-all hover:scale-[1.02] shadow-[0_0_24px_rgba(59,130,246,0.45)]"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <span>Eklentiyi İndir (ZIP)</span>
          </a>
        </div>

        {/* Steps */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-white text-center">Adım Adım Kurulum</h2>

          {steps.map((step) => {
            const isOpen = activeStep === step.id

            return (
              <div
                key={step.id}
                className={`rounded-2xl border transition-all duration-300 overflow-hidden ${
                  isOpen
                    ? `border-white/20 bg-base-800 ${step.glow}`
                    : 'border-white/[0.07] bg-base-900/60 hover:border-white/15 hover:bg-base-800/60'
                }`}
              >
                {/* Step header / toggle */}
                <button
                  onClick={() => setActiveStep(isOpen ? null : step.id)}
                  className="w-full flex items-center gap-4 px-5 py-4 text-left"
                >
                  <div className={`w-12 h-12 flex-shrink-0 rounded-2xl bg-gradient-to-br ${step.color} flex items-center justify-center text-xl ${isOpen ? step.glow : ''} transition-shadow`}>
                    {step.icon}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${step.badge}`}>
                        Adım {step.id}
                      </span>
                    </div>
                    <h3 className="font-bold text-white text-sm sm:text-base leading-tight">{step.title}</h3>
                    {!isOpen && (
                      <p className="text-slate-400 text-xs mt-0.5 truncate">{step.desc}</p>
                    )}
                  </div>

                  <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-all border ${
                    isOpen ? 'bg-white/10 border-white/20 rotate-180' : 'bg-white/5 border-white/10'
                  }`}>
                    <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>

                {/* Detail content */}
                {isOpen && (
                  <div className="px-5 pb-5 border-t border-white/[0.06] pt-4">
                    {step.details}

                    {/* Next step button */}
                    {step.id < steps.length && (
                      <button
                        onClick={() => setActiveStep(step.id + 1)}
                        className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white text-xs font-semibold transition-all"
                      >
                        <span>Devam Et: {steps[step.id].title}</span>
                        <span>→</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Quick Reference — shortcuts */}
        <div className="glass rounded-3xl p-6 sm:p-8 border border-white/10 space-y-5">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span>⌨️</span> Klavye Kısayolları & İpuçları
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { key: 'Ctrl + Shift + S', desc: 'Seçili kelimeyi hızla kaydet', mac: 'Cmd + Shift + S' },
              { key: 'Sağ Tıkla → Kaydet', desc: 'Herhangi bir web sayfasında kelimeye sağ tıkla', mac: null },
              { key: 'A / D tuşları', desc: 'Altyazılar arası önceki / sonraki cümle', mac: null },
              { key: 'S tuşu', desc: 'Videoyu duraklat / devam ettir', mac: null },
              { key: 'Kelimeye Tıkla', desc: 'Altyazıdaki renkli kelimeye tıklayarak kelime kartını aç', mac: null },
              { key: 'Hover (üzerine gel)', desc: 'Altyazıda kelimenin Türkçe çevirisini anında gör', mac: null },
            ].map(({ key, desc, mac }) => (
              <div key={key} className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/5">
                <div className="flex-shrink-0 mt-0.5 space-x-1">
                  <kbd className="px-2 py-0.5 rounded-lg bg-base-700 border border-white/15 text-xs text-primary-300 font-mono font-bold whitespace-nowrap">
                    {key}
                  </kbd>
                  {mac && (
                    <kbd className="px-2 py-0.5 rounded-lg bg-base-700 border border-white/15 text-xs text-slate-400 font-mono whitespace-nowrap">
                      {mac}
                    </kbd>
                  )}
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* FAQ */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span>❓</span> Sık Sorulan Sorular
          </h2>
          {[
            {
              q: 'Bu eklenti güvenli mi? Verilerimi çalıyor mu?',
              a: 'Eklenti tamamen açık kaynaklıdır. Yalnızca Enesglish Supabase veritabanına bağlanır. Verileriniz sadece sizin hesabınıza yazılır, hiçbir 3. tarafa gönderilmez.',
            },
            {
              q: 'Chrome Web Mağazasında neden yok?',
              a: 'Kişisel kullanım için tasarlandığından mağaza yayın sürecine gerek duymadık. Geliştirici modu ile yükleme tamamen güvenli ve resmi bir Chrome özelliğidir.',
            },
            {
              q: 'Eklenti güncellenince ne yapacağım?',
              a: 'Yeni ZIP\'i indirip aynı klasörün üzerine çıkart. Ardından chrome://extensions/ sayfasında Enesglish kartındaki 🔄 ikonuna tıklayarak güncelle.',
            },
            {
              q: 'Altyazılar renkli görünmüyor, ne yapmalıyım?',
              a: 'Eklentiye Enesglish hesabınla giriş yaptığından emin ol. Kütüphanende en az 1 kelime olması gerekiyor. Sayfayı yeniledikten sonra altyazılar aktif hale gelir.',
            },
          ].map(({ q, a }) => (
            <details key={q} className="group rounded-2xl border border-white/[0.07] bg-base-900/60 overflow-hidden hover:border-white/15 transition-colors">
              <summary className="flex items-center justify-between gap-3 px-5 py-4 cursor-pointer list-none">
                <span className="font-semibold text-white text-sm">{q}</span>
                <span className="flex-shrink-0 w-6 h-6 rounded-full border border-white/15 flex items-center justify-center text-slate-400 group-open:rotate-45 transition-transform">
                  +
                </span>
              </summary>
              <div className="px-5 pb-4 text-slate-400 text-sm leading-relaxed border-t border-white/[0.06] pt-3">
                {a}
              </div>
            </details>
          ))}
        </div>

        {/* Bottom CTA */}
        <div className="glass rounded-3xl p-7 sm:p-10 border border-primary-500/25 bg-gradient-to-b from-primary-950/40 via-base-900 to-base-950 text-center space-y-5">
          <div className="text-4xl">🚀</div>
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Eklenti Kuruldu mu?
          </h2>
          <p className="text-slate-300 text-sm max-w-sm mx-auto">
            Harika! Şimdi Enesglish uygulamasına giriş yap ve kelimelerini eklemeye başla. Altyazılarda renkli kelimeler seni bekliyor.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              to="/auth?mode=login"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl bg-primary-500 hover:bg-primary-400 text-white font-bold text-sm shadow-[0_0_24px_rgba(124,58,237,0.4)] transition-all hover:scale-[1.02]"
            >
              <span>Uygulamaya Giriş Yap</span>
              <span>🔑</span>
            </Link>
            <Link
              to="/"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-slate-200 font-bold text-sm transition-all"
            >
              ← Tanıtım Sayfasına Dön
            </Link>
          </div>
        </div>

      </main>

      {/* Footer */}
      <footer className="border-t border-white/[0.06] py-6 text-center text-xs text-slate-500 relative z-10">
        © {new Date().getFullYear()} Enesglish · Dil öğrenenler için sevgiyle geliştirildi.
      </footer>
    </div>
  )
}
