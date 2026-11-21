import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useStreak } from '../hooks/useStreak'
import { TutorialModal } from '../components/tutorial/TutorialModal'

export default function LandingPage() {
  const navigate = useNavigate()
  const user = useAuthStore(s => s.user)
  const streak = useStreak()
  const [showTutorial, setShowTutorial] = useState(false)

  // Interactive Demo States
  const [demoHoverWord, setDemoHoverWord] = useState(null)
  const [cardFlipped, setCardFlipped] = useState(false)
  const [selectedRating, setSelectedRating] = useState(null)

  function handleStartAuth(mode = 'signup') {
    navigate(`/auth?mode=${mode}`)
  }

  return (
    <div className="min-h-dvh flex flex-col bg-base-950 text-slate-100 selection:bg-primary-500 selection:text-white relative overflow-x-hidden">
      {/* ── Ambient Background Lighting ── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-40 -right-40 w-[550px] h-[550px] bg-primary-600/15 rounded-full blur-[130px]" />
        <div className="absolute top-1/3 -left-40 w-[500px] h-[500px] bg-accent-500/10 rounded-full blur-[140px]" />
        <div className="absolute -bottom-40 left-1/3 w-[600px] h-[600px] bg-indigo-600/15 rounded-full blur-[150px]" />
      </div>

      {/* ── Top Navigation Bar ── */}
      <header className="sticky top-0 z-40 bg-base-950/80 backdrop-blur-md border-b border-white/[0.08] safe-top">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-violet-600 via-indigo-600 to-fuchsia-500 flex items-center justify-center shadow-glow-primary border border-white/20 transition-transform group-hover:scale-105">
              <span className="text-white text-sm font-black tracking-tighter drop-shadow-sm">EG</span>
            </div>
            <div className="flex flex-col">
              <span className="font-black text-lg tracking-tight gradient-text">Enesglish</span>
              <span className="text-[10px] text-slate-400 font-medium -mt-1 hidden sm:block">Kelime Avcısı & SM-2</span>
            </div>
          </Link>

          {/* Quick Nav Anchor Links */}
          <nav className="hidden md:flex items-center gap-6 text-xs font-semibold text-slate-300">
            <a href="#ozellikler" className="hover:text-primary-300 transition-colors">Özellikler</a>
            <a href="#nasil-calisir" className="hover:text-primary-300 transition-colors">Nasıl Çalışır?</a>
            <a href="#eklenti" className="hover:text-primary-300 transition-colors">Chrome Eklentisi</a>
            <button
              onClick={() => setShowTutorial(true)}
              className="flex items-center gap-1 text-accent-300 hover:text-accent-200 transition-colors"
            >
              <span>💡</span>
              <span>Canlı Öğretici</span>
            </button>
          </nav>

          {/* Auth Action Buttons */}
          <div className="flex items-center gap-2.5">
            {user ? (
              <Link
                to="/dashboard"
                className="btn-primary text-xs py-2 px-4 flex items-center gap-1.5 shadow-glow-primary"
              >
                <span>🚀 Uygulamaya Git</span>
                {streak.currentStreak > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-black/20 text-amber-300 text-[11px] font-bold">
                    🔥 {streak.currentStreak}
                  </span>
                )}
              </Link>
            ) : (
              <>
                <button
                  onClick={() => handleStartAuth('login')}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-all"
                >
                  Giriş Yap
                </button>
                <button
                  onClick={() => handleStartAuth('signup')}
                  className="btn-primary text-xs py-2 px-4 shadow-glow-primary"
                >
                  Kayıt Ol ✨
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ── Main Landing Body ── */}
      <main className="flex-1 relative z-10 space-y-24 sm:space-y-32 pb-24">
        {/* ── Hero Section ── */}
        <section className="pt-12 sm:pt-20 px-4 sm:px-6 max-w-5xl mx-auto text-center space-y-6">
          {/* Top Pill Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-primary-500/20 via-accent-500/15 to-primary-500/20 border border-primary-500/30 text-xs font-semibold text-primary-200 shadow-glow-primary animate-fade-up">
            <span className="text-sm">⚡</span>
            <span>YÖKDİL, YDS ve Genel İngilizce İçin Yeni Nesil Hafıza Sistemi</span>
          </div>

          {/* Main Headline */}
          <h1 className="text-3xl sm:text-5xl md:text-6xl font-black tracking-tight leading-[1.15] text-white">
            Film & Dizi İzlerken İngilizce Kelimeleri{' '}
            <span className="gradient-text">Hafızana Kazı</span>
          </h1>

          {/* Subtitle */}
          <p className="max-w-2xl mx-auto text-sm sm:text-base md:text-lg text-slate-300 leading-relaxed font-normal">
            Amazon Prime Video, YouTube ve Netflix altyazılarında bilmediğin kelimeleri tek tıkla yakala.
            Bilimsel <strong>SM-2 aralıklı tekrar algoritması</strong> ve <strong>Google Gemini AI</strong> desteğiyle kelimeleri bir daha asla unutma.
          </p>

          {/* Call to Actions */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 max-w-md mx-auto">
            {user ? (
              <button
                onClick={() => navigate('/dashboard')}
                className="w-full sm:w-auto btn-primary text-sm sm:text-base py-3.5 px-8 shadow-glow-primary font-bold flex items-center justify-center gap-2"
              >
                <span>Uygulamaya Git (Dashboard)</span>
                <span className="text-lg">🚀</span>
              </button>
            ) : (
              <button
                onClick={() => handleStartAuth('signup')}
                className="w-full sm:w-auto btn-primary text-sm sm:text-base py-3.5 px-8 shadow-glow-primary font-bold flex items-center justify-center gap-2"
              >
                <span>Hemen Ücretsiz Başla</span>
                <span className="text-lg">🚀</span>
              </button>
            )}

            <button
              onClick={() => setShowTutorial(true)}
              className="w-full sm:w-auto px-6 py-3.5 rounded-xl text-sm sm:text-base font-bold bg-white/5 hover:bg-white/10 active:bg-white/[0.03] border border-white/15 text-slate-200 hover:text-white transition-all flex items-center justify-center gap-2"
            >
              <span>💡 Nasıl Çalışır?</span>
            </button>
          </div>

          {/* Trust Highlights */}
          <div className="pt-4 flex items-center justify-center gap-4 sm:gap-8 flex-wrap text-xs text-slate-400 font-medium">
            <div className="flex items-center gap-1.5">
              <span className="text-emerald-400 font-bold">✓</span> %100 Ücretsiz & Reklamsız
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-emerald-400 font-bold">✓</span> Chrome Eklentisi Entegre
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-emerald-400 font-bold">✓</span> Telefon & PC Senkronize
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-emerald-400 font-bold">✓</span> 14 Günlük Kurtarma Kalkanı
            </div>
          </div>

          {/* ── Interactive Live Simulation Widget ── */}
          <div className="pt-8 max-w-3xl mx-auto">
            <div className="glass rounded-3xl p-5 sm:p-7 border border-white/15 shadow-2xl relative overflow-hidden text-left">
              <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-3">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-red-500/80"></span>
                  <span className="w-3 h-3 rounded-full bg-yellow-500/80"></span>
                  <span className="w-3 h-3 rounded-full bg-green-500/80"></span>
                  <span className="text-xs font-semibold text-slate-400 ml-2 font-mono">
                    Canlı Önizleme: Sinematik Altyazı & Kart Motoru
                  </span>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Canlı Demo
                </span>
              </div>

              {/* Simulated Subtitle Bar */}
              <div className="bg-black/80 rounded-2xl p-5 border border-white/10 text-center relative mb-6 shadow-inner">
                <div className="text-[11px] text-slate-500 mb-2 font-mono uppercase tracking-wider">
                  🎬 Video Oynatıcı Altyazısı (Kelimelerin üzerine gelmeyi dene!)
                </div>
                <p className="text-base sm:text-xl font-medium text-slate-200 leading-relaxed">
                  "The government took{' '}
                  <span
                    onMouseEnter={() => setDemoHoverWord('drastic')}
                    onMouseLeave={() => setDemoHoverWord(null)}
                    className="relative inline-block px-1.5 py-0.5 rounded font-bold text-red-400 bg-red-500/20 border-b-2 border-red-500 cursor-pointer shadow-[0_0_15px_rgba(239,68,68,0.6)] transition-all hover:scale-105"
                  >
                    drastic
                    {demoHoverWord === 'drastic' && (
                      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 rounded-xl bg-base-950 border border-white/25 text-xs text-white whitespace-nowrap shadow-2xl z-30 animate-fade-up">
                        drastic: köklü, sert, şiddetli [🔴 Zor]
                      </span>
                    )}
                  </span>{' '}
                  measures to{' '}
                  <span
                    onMouseEnter={() => setDemoHoverWord('curb')}
                    onMouseLeave={() => setDemoHoverWord(null)}
                    className="relative inline-block px-1.5 py-0.5 rounded font-bold text-amber-300 bg-amber-500/20 border-b-2 border-amber-500 cursor-pointer shadow-[0_0_15px_rgba(245,158,11,0.6)] transition-all hover:scale-105"
                  >
                    curb
                    {demoHoverWord === 'curb' && (
                      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 rounded-xl bg-base-950 border border-white/25 text-xs text-white whitespace-nowrap shadow-2xl z-30 animate-fade-up">
                        curb: dizginlemek, frenlemek [🟡 Orta]
                      </span>
                    )}
                  </span>{' '}
                  the{' '}
                  <span
                    onMouseEnter={() => setDemoHoverWord('inflation')}
                    onMouseLeave={() => setDemoHoverWord(null)}
                    className="relative inline-block px-1.5 py-0.5 rounded font-bold text-green-400 bg-green-500/20 border-b-2 border-green-500 cursor-pointer shadow-[0_0_15px_rgba(34,197,94,0.6)] transition-all hover:scale-105"
                  >
                    inflation
                    {demoHoverWord === 'inflation' && (
                      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 rounded-xl bg-base-950 border border-white/25 text-xs text-white whitespace-nowrap shadow-2xl z-30 animate-fade-up">
                        inflation: enflasyon, fiyat artışı [🟢 Kolay]
                      </span>
                    )}
                  </span>{' '}
                  rate."
                </p>
              </div>

              {/* Interactive Flashcard Preview */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                <div
                  onClick={() => setCardFlipped(!cardFlipped)}
                  className="cursor-pointer select-none h-32 rounded-2xl border p-4 flex flex-col justify-center items-center text-center transition-all duration-300 shadow-lg hover:border-primary-500/60 bg-gradient-to-br from-base-900 to-base-950 border-white/10"
                >
                  <span className="text-[10px] text-primary-400 uppercase tracking-widest font-bold mb-1">
                    {cardFlipped ? 'Türkçe Karşılığı (Çevrildi 🔄)' : 'İngilizce Kart (Çevirmek İçin Tıkla 🔄)'}
                  </span>
                  <p className="text-xl font-black text-white">
                    {cardFlipped ? 'dizginlemek, kontrol altına almak' : 'curb'}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    {cardFlipped ? '"Efforts to curb pollution"' : '/kɜːrb/ • Fiil'}
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-semibold text-slate-300 mb-1 flex items-center justify-between">
                    <span>🧠 SM-2 Algoritması ile Puanla:</span>
                    {selectedRating && (
                      <span className="text-[11px] text-emerald-400 font-bold">Puanlandı! ✓</span>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => setSelectedRating('hard')}
                      className={`p-2 rounded-xl text-xs font-bold border transition-all ${
                        selectedRating === 'hard'
                          ? 'bg-red-500/30 border-red-500 text-red-300 scale-105'
                          : 'bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20'
                      }`}
                    >
                      🔴 Zor
                      <span className="block text-[9px] font-normal opacity-75">1 gün sonra</span>
                    </button>
                    <button
                      onClick={() => setSelectedRating('medium')}
                      className={`p-2 rounded-xl text-xs font-bold border transition-all ${
                        selectedRating === 'medium'
                          ? 'bg-amber-500/30 border-amber-500 text-amber-200 scale-105'
                          : 'bg-amber-500/10 border-amber-500/20 text-amber-300 hover:bg-amber-500/20'
                      }`}
                    >
                      🟡 Orta
                      <span className="block text-[9px] font-normal opacity-75">3 gün sonra</span>
                    </button>
                    <button
                      onClick={() => setSelectedRating('easy')}
                      className={`p-2 rounded-xl text-xs font-bold border transition-all ${
                        selectedRating === 'easy'
                          ? 'bg-green-500/30 border-green-500 text-green-200 scale-105'
                          : 'bg-green-500/10 border-green-500/20 text-green-400 hover:bg-green-500/20'
                      }`}
                    >
                      🟢 Kolay
                      <span className="block text-[9px] font-normal opacity-75">6 gün sonra</span>
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-2">
                    Algoritma kelimenin unutulma eğrisini hesaplar ve tam unutacağın anda karşına çıkarır.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Feature Grid Section ("Tüm Özellikler, Çok Sıkmadan") ── */}
        <section id="ozellikler" className="px-4 sm:px-6 max-w-6xl mx-auto space-y-12">
          <div className="text-center space-y-3 max-w-2xl mx-auto">
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-primary-500/20 text-primary-300 border border-primary-500/30 uppercase tracking-wider">
              Benzersiz Yetenekler
            </span>
            <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
              Sıradan Kelime Ezberlemeyi Unut,{' '}
              <span className="gradient-text">Akıllıca Öğren</span>
            </h2>
            <p className="text-sm text-slate-400">
              Enesglish, geleneksel sözlük veya flashcard uygulamalarından farklı olarak eğlenceyle bilimsel tekrarı birleştirir.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Feature 1 */}
            <div className="glass rounded-3xl p-6 sm:p-7 border border-white/10 hover:border-primary-500/40 transition-all duration-300 group hover:-translate-y-1 shadow-card">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center text-2xl shadow-glow-primary mb-5 group-hover:scale-110 transition-transform">
                🎬
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Akıllı Altyazı Eklentisi</h3>
              <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">
                Prime Video, YouTube ve Netflix izlerken altyazıda geçen kaydettiğin kelimeler renk renk parlar. Tek tıkla videoyu durdurup çevirisini gör.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="glass rounded-3xl p-6 sm:p-7 border border-white/10 hover:border-accent-500/40 transition-all duration-300 group hover:-translate-y-1 shadow-card">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center text-2xl shadow-glow-accent mb-5 group-hover:scale-110 transition-transform">
                🧠
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Bilimsel SM-2 Algoritması</h3>
              <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">
                Ebbinghaus unutma eğrisine meydan oku. Kolay kelimeler seyrek, zor kelimeler sık tekrar edilir. Kelimeler kalıcı belleğine işlenir.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="glass rounded-3xl p-6 sm:p-7 border border-white/10 hover:border-emerald-500/40 transition-all duration-300 group hover:-translate-y-1 shadow-card">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-2xl shadow-[0_0_20px_rgba(16,185,129,0.3)] mb-5 group-hover:scale-110 transition-transform">
                🔥
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Günlük Seri & Kurtarma Kalkanı</h3>
              <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">
                Günde 10 kelime tekrarla, serini katla. Yoğun bir gününde çalışmayı kaçırsan bile 14 günlük Kurtarma Kalkanın serini korur.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="glass rounded-3xl p-6 sm:p-7 border border-white/10 hover:border-purple-500/40 transition-all duration-300 group hover:-translate-y-1 shadow-card">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-fuchsia-500 to-purple-600 flex items-center justify-center text-2xl shadow-[0_0_20px_rgba(217,70,239,0.3)] mb-5 group-hover:scale-110 transition-transform">
                ✨
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Google Gemini AI Sihirbazı</h3>
              <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">
                Sadece bir kelime yaz; yapay zeka Türkçe karşılığını, seviyesini (B1/C1), örnek cümlelerini, telaffuzunu ve eş anlamlılarını anında tamamlasın.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="glass rounded-3xl p-6 sm:p-7 border border-white/10 hover:border-sky-500/40 transition-all duration-300 group hover:-translate-y-1 shadow-card">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center text-2xl shadow-[0_0_20px_rgba(56,189,248,0.3)] mb-5 group-hover:scale-110 transition-transform">
                📱
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Kusursuz Çoklu Cihaz Senkronizasyonu</h3>
              <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">
                İster telefonda metrodayken tekrar yap, ister evde bilgisayarda video izle. Bütün verilerin ve serin anında buluta senkronize olur.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="glass rounded-3xl p-6 sm:p-7 border border-white/10 hover:border-rose-500/40 transition-all duration-300 group hover:-translate-y-1 shadow-card">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center text-2xl shadow-[0_0_20px_rgba(244,63,94,0.3)] mb-5 group-hover:scale-110 transition-transform">
                🗂️
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Özel Desteler & İlerleme Grafikleri</h3>
              <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">
                YÖKDİL Sağlık, Sosyal, Fen veya YDS desteleri oluştur. Kolay, orta, zor kelimelerinin dağılımını renkli grafiklerle takip et.
              </p>
            </div>
          </div>
        </section>

        {/* ── How It Works (4 Kolay Adım) ── */}
        <section id="nasil-calisir" className="px-4 sm:px-6 max-w-5xl mx-auto space-y-12">
          <div className="text-center space-y-3">
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-accent-500/20 text-accent-300 border border-accent-500/30 uppercase tracking-wider">
              Adım Adım Başarı
            </span>
            <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
              Nasıl Çalışır?
            </h2>
            <p className="text-sm text-slate-400">
              Günde sadece 5 dakikanı ayırarak ayda 300+ kalıcı kelime haznesi kazan.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-base-900/60 rounded-2xl p-5 border border-white/10 relative">
              <span className="text-3xl font-black text-primary-400/40 absolute top-3 right-4">01</span>
              <div className="text-2xl mb-3">🎬</div>
              <h4 className="font-bold text-white text-base mb-1">Kelime Avla</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Film veya dizi izlerken ya da web sitesinde okurken bilmediğin kelimeyi tek tıkla kaydet.
              </p>
            </div>

            <div className="bg-base-900/60 rounded-2xl p-5 border border-white/10 relative">
              <span className="text-3xl font-black text-primary-400/40 absolute top-3 right-4">02</span>
              <div className="text-2xl mb-3">✨</div>
              <h4 className="font-bold text-white text-base mb-1">AI ile Zenginleştir</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Google Gemini AI tek tıkla kelimene doğal örnek cümle, telaffuz ve eş anlamlı eklesin.
              </p>
            </div>

            <div className="bg-base-900/60 rounded-2xl p-5 border border-white/10 relative">
              <span className="text-3xl font-black text-primary-400/40 absolute top-3 right-4">03</span>
              <div className="text-2xl mb-3">🧠</div>
              <h4 className="font-bold text-white text-base mb-1">Aralıklı Tekrar Yap</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Flashcard kartlarını çevir ve kendini puanla. SM-2 algoritması unutmanı engellesin.
              </p>
            </div>

            <div className="bg-base-900/60 rounded-2xl p-5 border border-white/10 relative">
              <span className="text-3xl font-black text-primary-400/40 absolute top-3 right-4">04</span>
              <div className="text-2xl mb-3">🔥</div>
              <h4 className="font-bold text-white text-base mb-1">Serini Büyüt</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Günde 10 kelime hedefini tamamla, streak alevini büyüt ve kalkanınla serini garantiye al.
              </p>
            </div>
          </div>
        </section>

        {/* ── Interactive Tutorial Callout Banner ── */}
        <section className="px-4 sm:px-6 max-w-4xl mx-auto">
          <div className="glass rounded-3xl p-6 sm:p-10 border border-primary-500/30 bg-gradient-to-r from-primary-950/60 via-base-900 to-accent-950/30 flex flex-col md:flex-row items-center justify-between gap-6 shadow-2xl relative overflow-hidden">
            <div className="space-y-2 text-center md:text-left">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-accent-500/20 text-accent-300 border border-accent-500/30">
                💡 Canlı Etkileşimli Rehber
              </span>
              <h3 className="text-xl sm:text-2xl font-black text-white">
                Sistemi 1 Dakikada Canlı Keşfetmek İster misin?
              </h3>
              <p className="text-xs sm:text-sm text-slate-300 max-w-md">
                Altyazı eklentisinden SM-2 motoruna kadar tüm adımları görsel ve etkileşimli öğreticimizle incele.
              </p>
            </div>

            <button
              onClick={() => setShowTutorial(true)}
              className="px-6 py-3 rounded-2xl text-sm font-bold bg-gradient-to-r from-accent-400 to-amber-500 hover:from-accent-300 hover:to-amber-400 text-base-950 shadow-glow-accent transition-all hover:scale-105 active:scale-95 flex items-center gap-2 whitespace-nowrap"
            >
              <span>Öğreticiyi Başlat</span>
              <span className="text-base">✨</span>
            </button>
          </div>
        </section>

        {/* ── Chrome Extension Highlight Section ── */}
        <section id="eklenti" className="px-4 sm:px-6 max-w-5xl mx-auto">
          <div className="glass rounded-3xl p-7 sm:p-12 border border-white/10 relative overflow-hidden">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
              <div className="space-y-4">
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-primary-500/20 text-primary-300 border border-primary-500/30 uppercase tracking-wider">
                  🎬 Enesglish Chrome Extension
                </span>
                <h3 className="text-2xl sm:text-3xl font-black text-white leading-snug">
                  Video İzleme Deneyimini Dil Öğrenme Sınıfına Dönüştür
                </h3>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                  İngilizce dizi veya YouTube belgeselleri izlerken sözlük karıştırma devri bitti. Eklenti, altyazıları doğrudan senin kütüphanenle senkronize eder.
                </p>
                <ul className="space-y-2 text-xs text-slate-300">
                  <li className="flex items-center gap-2">
                    <span className="text-emerald-400 font-bold">✓</span>
                    <span><strong>A / S / D / W</strong> tuşlarıyla altyazılar arasında tek tuşla gezin & tekrarla.</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-emerald-400 font-bold">✓</span>
                    <span>W3C CSS Custom Highlight mimarisiyle sıfır donma, 60 FPS sinematik akıcılık.</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-emerald-400 font-bold">✓</span>
                    <span>Resmi Türkçe altyazı akışını otomatik yakalama desteği.</span>
                  </li>
                </ul>
              </div>

              <div className="bg-base-950/90 rounded-2xl p-5 border border-white/10 text-center space-y-4 shadow-xl">
                <div className="flex items-center justify-between text-xs text-slate-400 border-b border-white/10 pb-3">
                  <span className="font-semibold text-white">Desteklenen Platformlar:</span>
                  <span className="text-emerald-400 font-mono">100% Uyumlu</span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 rounded-xl bg-white/5 border border-white/5 flex flex-col items-center">
                    <span className="text-2xl mb-1">📦</span>
                    <span className="text-[11px] font-bold text-slate-200">Prime Video</span>
                  </div>
                  <div className="p-3 rounded-xl bg-white/5 border border-white/5 flex flex-col items-center">
                    <span className="text-2xl mb-1">▶️</span>
                    <span className="text-[11px] font-bold text-slate-200">YouTube</span>
                  </div>
                  <div className="p-3 rounded-xl bg-white/5 border border-white/5 flex flex-col items-center">
                    <span className="text-2xl mb-1">🍿</span>
                    <span className="text-[11px] font-bold text-slate-200">Netflix</span>
                  </div>
                </div>
                <p className="text-[11px] text-slate-400">
                  Kayıt olduktan sonra eklentiyi Chrome tarayıcına yükleyip saniyeler içinde kullanmaya başlayabilirsin.
                </p>
                <div className="mt-3">
                  <Link
                    to="/eklenti"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm transition-all hover:scale-[1.02] shadow-[0_0_20px_rgba(59,130,246,0.35)]"
                  >
                    <span>🧩</span>
                    <span>Eklenti Kurulum Rehberi</span>
                    <span className="text-blue-200">→</span>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Bottom Call To Action Banner ── */}
        <section className="px-4 sm:px-6 max-w-4xl mx-auto text-center">
          <div className="glass rounded-3xl p-8 sm:p-14 border border-primary-500/30 bg-gradient-to-b from-primary-950/40 via-base-900 to-base-950 shadow-2xl relative overflow-hidden space-y-6">
            <div className="w-16 h-16 mx-auto rounded-3xl bg-gradient-to-br from-violet-600 via-indigo-600 to-fuchsia-500 flex items-center justify-center shadow-glow-primary text-3xl">
              🎯
            </div>

            <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
              Kelime Dağarcığını Katlamaya Hazır mısın?
            </h2>

            <p className="max-w-lg mx-auto text-xs sm:text-sm text-slate-300">
              YÖKDİL, YDS veya günlük İngilizce... İhtiyacın olan tüm araçlar tek bir yerde, tamamen ücretsiz.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              {user ? (
                <button
                  onClick={() => navigate('/dashboard')}
                  className="w-full sm:w-auto btn-primary text-base py-3.5 px-8 shadow-glow-primary font-bold"
                >
                  Uygulamaya Git (Dashboard) 🚀
                </button>
              ) : (
                <>
                  <button
                    onClick={() => handleStartAuth('signup')}
                    className="w-full sm:w-auto btn-primary text-base py-3.5 px-8 shadow-glow-primary font-bold"
                  >
                    Hemen Ücretsiz Kayıt Ol 🚀
                  </button>
                  <button
                    onClick={() => handleStartAuth('login')}
                    className="w-full sm:w-auto px-6 py-3.5 rounded-xl text-sm font-bold bg-white/5 hover:bg-white/10 text-slate-200 border border-white/15 transition-all"
                  >
                    Zaten Hesabım Var (Giriş Yap) 🔑
                  </button>
                </>
              )}
            </div>
          </div>
        </section>
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-white/[0.08] bg-base-950 py-8 px-4 text-center text-xs text-slate-500 space-y-2 relative z-10">
        <div className="flex items-center justify-center gap-2">
          <div className="w-5 h-5 rounded-lg bg-gradient-to-br from-primary-500 to-accent-400 flex items-center justify-center text-[10px] text-white font-bold">
            EG
          </div>
          <span className="font-bold text-slate-300">Enesglish</span>
          <span>• Akıllı İngilizce & YÖKDİL Asistanı</span>
        </div>
        <p>© {new Date().getFullYear()} Enesglish. Dil öğrenenler için sevgiyle geliştirildi.</p>
      </footer>

      {/* ── Step-by-Step Interactive Tutorial Modal ── */}
      <TutorialModal
        isOpen={showTutorial}
        onClose={() => setShowTutorial(false)}
        onStartAuth={() => handleStartAuth('signup')}
      />
    </div>
  )
}
