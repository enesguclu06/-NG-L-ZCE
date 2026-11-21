import { useState, useEffect } from 'react'

export function TutorialModal({ isOpen, onClose, onStartAuth }) {
  const [activeStep, setActiveStep] = useState(0)
  const [demoFlipped, setDemoFlipped] = useState(false)
  const [hoveredDemoWord, setHoveredDemoWord] = useState(null)

  useEffect(() => {
    function handleKeyDown(e) {
      if (!isOpen) return
      if (e.key === 'Escape') onClose?.()
      if (e.key === 'ArrowRight') handleNext()
      if (e.key === 'ArrowLeft') handlePrev()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, activeStep])

  if (!isOpen) return null

  const steps = [
    {
      id: 'extension',
      badge: '🎬 1. Adım: Kelime Avı',
      title: 'Film & Dizi İzlerken Kelimeleri Yakala',
      desc: 'Enesglish Chrome Eklentisi sayesinde Amazon Prime Video, YouTube ve Netflix izlerken altyazılar interaktif hale gelir.',
      bullets: [
        'Kütüphanendeki kelimeler zorluğuna göre altyazıda parlar (🟢 Kolay, 🟡 Orta, 🔴 Zor).',
        'Bilmediğin bir kelimeye tıkladığında video otomatik durur ve detaylı kelime kartı açılır.',
        'A, S, D, W klavye kısayollarıyla altyazı cümleleri arasında ışık hızında gezinebilirsin.'
      ],
      interactive: (
        <div className="bg-black/60 rounded-2xl p-4 border border-white/10 relative overflow-hidden text-center select-none">
          <div className="absolute top-2 left-3 flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500/80"></span>
            <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/80"></span>
            <span className="w-2.5 h-2.5 rounded-full bg-green-500/80"></span>
            <span className="text-[10px] text-slate-400 font-mono ml-2">Prime Video / Netflix Altyazı Simülatörü</span>
          </div>
          <div className="pt-6 pb-2">
            <p className="text-slate-300 text-sm sm:text-base font-medium leading-relaxed">
              "The detective tried to{' '}
              <span
                onMouseEnter={() => setHoveredDemoWord('conceal')}
                onMouseLeave={() => setHoveredDemoWord(null)}
                className="relative inline-block px-1.5 py-0.5 rounded font-bold text-red-400 bg-red-500/20 border-b-2 border-red-500 cursor-pointer shadow-[0_0_12px_rgba(239,68,68,0.5)] transition-all hover:scale-105"
              >
                conceal
                {hoveredDemoWord === 'conceal' && (
                  <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 rounded-lg bg-base-950/95 border border-white/20 text-xs text-white whitespace-nowrap shadow-xl z-30">
                    conceal: gizlemek, örtbas etmek [🔴 Zor]
                  </span>
                )}
              </span>{' '}
              the{' '}
              <span
                onMouseEnter={() => setHoveredDemoWord('crucial')}
                onMouseLeave={() => setHoveredDemoWord(null)}
                className="relative inline-block px-1.5 py-0.5 rounded font-bold text-amber-300 bg-amber-500/20 border-b-2 border-amber-500 cursor-pointer shadow-[0_0_12px_rgba(245,158,11,0.5)] transition-all hover:scale-105"
              >
                crucial
                {hoveredDemoWord === 'crucial' && (
                  <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 rounded-lg bg-base-950/95 border border-white/20 text-xs text-white whitespace-nowrap shadow-xl z-30">
                    crucial: hayati, çok önemli [🟡 Orta]
                  </span>
                )}
              </span>{' '}
              evidence."
            </p>
            <p className="text-[11px] text-slate-400 mt-3">
              👆 <span className="text-primary-300 font-medium">Renkli kelimelerin üzerine gel</span> ve canlı çeviriyi gör!
            </p>
          </div>
        </div>
      )
    },
    {
      id: 'ai-magic',
      badge: '✨ 2. Adım: Yapay Zeka',
      title: 'Google Gemini AI ile Kelimeyi Derinlemesine Öğren',
      desc: 'Sadece bir kelime yaz, gerisini yapay zekaya bırak. Seviyene uygun doğal örnek cümleler ve zengin açıklamalar tek tıkla hazır.',
      bullets: [
        'Doğal İngilizce örnek cümleler ve akıcı Türkçe çevirileri.',
        'Uluslararası Fonetik Alfabe (IPA) telaffuz rehberi ve sesli dinleme.',
        'Sınavlarda en çok çıkan eş anlamlı (synonym) kelime önerileri.'
      ],
      interactive: (
        <div className="bg-base-950/70 rounded-2xl p-4 border border-primary-500/20 text-left">
          <div className="flex items-center justify-between mb-3 border-b border-white/5 pb-2">
            <div>
              <span className="text-lg font-bold text-white">persistent</span>
              <span className="text-xs text-slate-400 ml-2 font-mono">/pərˈsɪstənt/</span>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary-500/20 text-primary-300 border border-primary-500/30">
              B2 • YÖKDİL
            </span>
          </div>
          <p className="text-xs text-emerald-400 font-semibold mb-2">📌 Türkçe: Israrcı, inatçı, sürekli</p>
          <div className="p-2.5 rounded-xl bg-white/5 border border-white/5 text-xs text-slate-300 mb-2">
            <span className="text-primary-300 font-semibold">Örnek:</span> "Persistent effort is the key to mastering English."
            <p className="text-slate-400 text-[11px] mt-0.5">Sürekli çaba, İngilizceyi mükemmelleştirmenin anahtarıdır.</p>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
            <span className="text-slate-400">Eş Anlamlılar:</span>
            <span className="px-1.5 py-0.5 rounded bg-white/5 text-slate-200">tenacious</span>
            <span className="px-1.5 py-0.5 rounded bg-white/5 text-slate-200">determined</span>
            <span className="px-1.5 py-0.5 rounded bg-white/5 text-slate-200">constant</span>
          </div>
        </div>
      )
    },
    {
      id: 'sm2',
      badge: '🧠 3. Adım: SM-2 Algoritması',
      title: 'Aralıklı Tekrar ile Unutma Eğrisine Meydan Oku',
      desc: 'Bilimsel SuperMemo SM-2 algoritması, her kelimenin zorluk katsayısını hesaplar ve kelimeyi tam unutulacağı gün karşına çıkarır.',
      bullets: [
        'Kartı çevir, kelimeyi hatırla ve kendine dürüstçe puan ver.',
        'Kolay dediğin kelimeler daha seyrek, Zor dediklerin sık sık tekrarlanır.',
        'Sadece 5 dakikalık pratikle yüzlerce kelimeyi kalıcı hafızana aktar.'
      ],
      interactive: (
        <div className="text-center">
          <div
            onClick={() => setDemoFlipped(!demoFlipped)}
            className="w-full max-w-xs mx-auto h-36 cursor-pointer select-none relative group"
            style={{ perspective: '1000px' }}
          >
            <div
              className={`w-full h-full rounded-2xl border transition-all duration-500 flex flex-col items-center justify-center p-4 shadow-xl ${
                demoFlipped
                  ? 'bg-gradient-to-br from-emerald-950/80 to-base-900 border-emerald-500/40 text-emerald-200'
                  : 'bg-gradient-to-br from-primary-950/80 to-base-900 border-primary-500/40 text-white'
              }`}
            >
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1">
                {demoFlipped ? 'Türkçe Anlamı & Örnek' : 'İngilizce (Çevirmek için tıkla 🔄)'}
              </span>
              <p className="text-xl font-black">{demoFlipped ? 'kaçınılmaz, çaresiz' : 'inevitable'}</p>
              <p className="text-xs text-slate-400 mt-1">
                {demoFlipped ? '"Change is inevitable." (Değişim kaçınılmazdır)' : '/ɪnˈev.ə.t̬ə.bəl/'}
              </p>
            </div>
          </div>
          <div className="flex items-center justify-center gap-2 mt-3">
            <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-red-500/20 text-red-400 border border-red-500/30">
              🔴 Zor (Yarın)
            </span>
            <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
              🟡 Orta (3 Gün)
            </span>
            <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-green-500/20 text-green-400 border border-green-500/30">
              🟢 Kolay (6 Gün)
            </span>
          </div>
        </div>
      )
    },
    {
      id: 'streak',
      badge: '🔥 4. Adım: Günlük Alışkanlık',
      title: 'Günlük 10 Kelime Hedefi & 14 Günlük Kurtarma Kalkanı',
      desc: 'İngilizce bir gecede değil, her gün düzenli 10 kelime tekrarıyla öğrenilir. Zinciri kırmayanlar hedefine ulaşır!',
      bullets: [
        'Her gün 10 kelime tekrarla veya öğren, serini 1 gün artır.',
        'Yoğun bir gün mü geçirdin? 14 günlük Kurtarma Kalkanın serini otomatik korur.',
        'Hiçbir günün emeği boşa gitmez; streak rozetlerinle motivasyonun tavan yapar.'
      ],
      interactive: (
        <div className="bg-base-950/60 rounded-2xl p-4 border border-amber-500/30 flex items-center justify-around gap-4 text-center">
          <div className="flex flex-col items-center">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-3xl shadow-[0_0_20px_rgba(245,158,11,0.3)] animate-pulse-soft">
              🔥
            </div>
            <span className="text-lg font-black text-amber-300 mt-1">17 Gün</span>
            <span className="text-[10px] text-slate-400">Aktif Seri (Streak)</span>
          </div>
          <div className="h-12 w-px bg-white/10" />
          <div className="flex flex-col items-center">
            <div className="w-14 h-14 rounded-2xl bg-sky-500/20 border border-sky-500/40 flex items-center justify-center text-3xl shadow-[0_0_20px_rgba(56,189,248,0.3)]">
              🛡️
            </div>
            <span className="text-lg font-black text-sky-300 mt-1">Aktif</span>
            <span className="text-[10px] text-slate-400">14 Günlük Kalkan</span>
          </div>
          <div className="h-12 w-px bg-white/10" />
          <div className="flex flex-col items-center">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-3xl shadow-[0_0_20px_rgba(52,211,153,0.3)]">
              🎯
            </div>
            <span className="text-lg font-black text-emerald-300 mt-1">10 / 10</span>
            <span className="text-[10px] text-slate-400">Bugünkü Hedef</span>
          </div>
        </div>
      )
    },
    {
      id: 'cross-device',
      badge: '📱 5. Adım: Çoklu Cihaz',
      title: 'Telefon & Bilgisayar Kusursuz Senkronize',
      desc: 'İster otobüste telefonundan çalış, ister evde bilgisayarından film izle. Tüm verilerin anında buluta eşitlenir.',
      bullets: [
        'Telefonda yaptığın 10 kelime, bilgisayarına geçtiğinde serini anında korur.',
        'Kelimelerin, destelerin ve istatistiklerin Supabase bulutunda güvenle saklanır.',
        'PWA desteğiyle telefonuna uygulama gibi indirebilir, çevrimdışı dahi kullanabilirsin.'
      ],
      interactive: (
        <div className="bg-gradient-to-r from-primary-950/80 via-base-900 to-accent-950/50 rounded-2xl p-5 border border-white/10 text-center">
          <div className="flex items-center justify-center gap-6 mb-3">
            <div className="flex flex-col items-center">
              <span className="text-3xl">📱</span>
              <span className="text-xs text-slate-300 mt-1 font-semibold">Mobil (iOS & Android)</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-primary-400 font-bold text-lg animate-pulse">⇄ ☁️ ⇄</span>
              <span className="text-[10px] text-emerald-400 font-mono font-medium">Anlık Eşitlendi</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-3xl">💻</span>
              <span className="text-xs text-slate-300 mt-1 font-semibold">Masaüstü & Laptop</span>
            </div>
          </div>
          <p className="text-xs text-slate-400">
            Tek hesap, sınırsız cihaz. Asla veri veya seri kaybı yaşamazsın!
          </p>
        </div>
      )
    }
  ]

  const currentStep = steps[activeStep]

  function handleNext() {
    if (activeStep < steps.length - 1) {
      setActiveStep(prev => prev + 1)
      setDemoFlipped(false)
    } else {
      onClose()
      onStartAuth?.()
    }
  }

  function handlePrev() {
    if (activeStep > 0) {
      setActiveStep(prev => prev - 1)
      setDemoFlipped(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div
        className="glass rounded-3xl w-full max-w-lg border border-white/15 p-6 sm:p-8 shadow-2xl relative overflow-hidden flex flex-col max-h-[92vh] animate-card-appear"
        onClick={e => e.stopPropagation()}
      >
        {/* Glow ambient background */}
        <div className="absolute -top-24 -right-24 w-60 h-60 bg-primary-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-60 h-60 bg-accent-500/15 rounded-full blur-3xl pointer-events-none" />

        {/* Top Header */}
        <div className="flex items-center justify-between mb-4 relative z-10">
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-primary-500/20 text-primary-300 border border-primary-500/30">
            {currentStep.badge}
          </span>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400 font-mono font-semibold">
              {activeStep + 1} / {steps.length}
            </span>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/15 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
              title="Kapat (Esc)"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Step Content */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-4 relative z-10">
          <div>
            <h3 className="text-xl font-black text-white tracking-tight mb-1.5">
              {currentStep.title}
            </h3>
            <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
              {currentStep.desc}
            </p>
          </div>

          {/* Interactive Simulation Area */}
          <div className="my-2">
            {currentStep.interactive}
          </div>

          {/* Bullet points */}
          <ul className="space-y-1.5 text-xs text-slate-300">
            {currentStep.bullets.map((bullet, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="text-primary-400 font-bold">✓</span>
                <span>{bullet}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Footer controls & progress dots */}
        <div className="mt-5 pt-4 border-t border-white/10 flex items-center justify-between gap-3 relative z-10">
          {/* Progress dots */}
          <div className="flex items-center gap-1.5">
            {steps.map((_, idx) => (
              <button
                key={idx}
                onClick={() => { setActiveStep(idx); setDemoFlipped(false); }}
                className={`h-2 rounded-full transition-all duration-300 ${
                  idx === activeStep
                    ? 'w-6 bg-primary-400 shadow-glow-primary'
                    : 'w-2 bg-white/20 hover:bg-white/40'
                }`}
                title={`Adım ${idx + 1}`}
              />
            ))}
          </div>

          {/* Navigation Buttons */}
          <div className="flex items-center gap-2">
            {activeStep > 0 && (
              <button
                onClick={handlePrev}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/10 text-slate-300 transition-all"
              >
                ← Geri
              </button>
            )}

            <button
              onClick={handleNext}
              className="btn-primary text-xs px-5 py-2"
            >
              {activeStep === steps.length - 1 ? 'Hemen Başla 🚀' : 'İleri →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
