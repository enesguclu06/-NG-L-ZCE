import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useWords } from '../hooks/useWords'
import { useStreak } from '../hooks/useStreak'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { playAudio } from '../lib/audio'

export default function DashboardPage() {
  const { words, fetchWords, loading, error } = useWords()
  const streak = useStreak()
  const [activityView, setActivityView] = useState('bars') // 'bars' | 'matrix'
  const [selectedHeatmapDay, setSelectedHeatmapDay] = useState(null)

  useEffect(() => {
    fetchWords()
  }, [fetchWords])

  // ── Stats Calculations ──
  const stats = useMemo(() => {
    if (!words || words.length === 0) return null

    const total = words.length

    // Due for review today (excluding mastered)
    const now = new Date()
    const toReview = words.filter(w =>
      w.difficulty !== 'mastered' && (!w.next_review_at || new Date(w.next_review_at) <= now)
    ).length

    // Added in last 7 days
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const weeklyAdded = words.filter(w => new Date(w.created_at) >= sevenDaysAgo).length

    // Mastered count
    const masteredCount = words.filter(w => w.difficulty === 'mastered').length

    // Difficulty breakdown for chart
    const diffCount = { unrated: 0, easy: 0, medium: 0, hard: 0, mastered: 0 }
    words.forEach(w => {
      const d = w.difficulty || 'unrated'
      if (diffCount[d] !== undefined) diffCount[d]++
    })

    const chartData = [
      { name: 'Ezberlendi', value: diffCount.mastered, color: '#38BDF8', label: '🎓 Ezberlendi' },
      { name: 'Kolay', value: diffCount.easy, color: '#34D399', label: '🟢 Kolay' },
      { name: 'Orta', value: diffCount.medium, color: '#FBBF24', label: '🟡 Orta' },
      { name: 'Zor', value: diffCount.hard, color: '#F87171', label: '🔴 Zor' },
      { name: 'Yeni', value: diffCount.unrated, color: '#94A3B8', label: '⚪ Yeni' },
    ].filter(d => d.value > 0)

    // Hardest Words (most reviewed but still hard or medium)
    const hardestWords = [...words]
      .filter(w => w.difficulty === 'hard' || w.difficulty === 'medium')
      .sort((a, b) => (b.review_count || 0) - (a.review_count || 0))
      .slice(0, 4)

    // Recent 5 words
    const recentWords = words.slice(0, 5)

    // ── Activity Data Aggregation ──
    const today = new Date()
    const todayStr = today.toISOString().slice(0, 10)
    const activityMap = {}

    // Aggregate word creations and reviews
    words.forEach(w => {
      if (w.created_at) {
        const dStr = w.created_at.slice(0, 10)
        activityMap[dStr] = (activityMap[dStr] || 0) + 1
      }
      if (w.last_reviewed_at) {
        const dStr = w.last_reviewed_at.slice(0, 10)
        activityMap[dStr] = (activityMap[dStr] || 0) + 1
      }
    })

    // Ensure today reflects streak count if higher
    if (streak?.todayCount) {
      activityMap[todayStr] = Math.max(activityMap[todayStr] || 0, streak.todayCount)
    }

    // ── 1. Last 7 Days for Bar Chart ──
    const last7Days = []
    const dayNames = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt']
    const fullDayNames = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi']
    let weeklyTotalWords = 0
    let mostActiveDay = { dayName: '—', count: 0 }

    for (let i = 6; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      const dStr = d.toISOString().slice(0, 10)
      const count = activityMap[dStr] || 0
      const dName = dayNames[d.getDay()]
      const fullDName = fullDayNames[d.getDay()]

      weeklyTotalWords += count
      if (count > mostActiveDay.count) {
        mostActiveDay = { dayName: fullDName, count }
      }

      last7Days.push({
        date: dStr,
        dayName: dName,
        fullDayName: fullDName,
        displayDate: d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }),
        count,
        isToday: i === 0,
        metTarget: count >= 10,
      })
    }

    // ── 2. 7-Week Matrix (7 weeks x 7 days Mon-Sun) ──
    const heatmapWeeks = []
    // 7 weeks = 49 days ending on current week's Sunday
    // Find current week's Monday
    const currentDayOfWeek = (today.getDay() + 6) % 7 // 0=Mon, 6=Sun
    const startOfCurrentWeek = new Date(today)
    startOfCurrentWeek.setDate(today.getDate() - currentDayOfWeek)

    // Start 6 weeks before startOfCurrentWeek (total 7 weeks)
    const startDate = new Date(startOfCurrentWeek)
    startDate.setDate(startOfCurrentWeek.getDate() - (6 * 7))

    for (let w = 0; w < 7; w++) {
      const weekDays = []
      for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
        const d = new Date(startDate)
        d.setDate(startDate.getDate() + (w * 7) + dayIdx)
        const dStr = d.toISOString().slice(0, 10)
        const isFuture = d > today
        const count = isFuture ? 0 : (activityMap[dStr] || 0)

        weekDays.push({
          date: dStr,
          count,
          isFuture,
          isToday: dStr === todayStr,
          dayOfWeek: dayIdx, // 0=Mon, 6=Sun
          dayName: dayNames[d.getDay()],
          displayDate: d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }),
        })
      }

      let weekLabel = `${6 - w} hf. önce`
      if (w === 6) weekLabel = 'Bu Hafta'
      else if (w === 5) weekLabel = 'Geçen Hf.'

      heatmapWeeks.push({
        weekIdx: w,
        weekLabel,
        days: weekDays,
      })
    }

    const dailyAverage = Math.round((weeklyTotalWords / 7) * 10) / 10

    return {
      total,
      toReview,
      weeklyAdded,
      masteredCount,
      chartData,
      hardestWords,
      recentWords,
      last7Days,
      heatmapWeeks,
      weeklyTotalWords,
      mostActiveDay,
      dailyAverage,
    }
  }, [words, streak?.todayCount])

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/50 rounded-2xl p-4 text-red-400 text-center">
        Veriler yüklenirken hata oluştu: {error}
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 sm:space-y-8 animate-fade-in px-2 sm:px-0 pb-12">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black bg-gradient-to-r from-primary-400 via-accent-300 to-primary-300 bg-clip-text text-transparent">
            Dashboard
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm mt-0.5">
            Öğrenme istatistiklerin, hafıza grafiğin ve günlük hedefin
          </p>
        </div>

        {/* Quick Review / Quiz CTA Buttons */}
        <div className="flex items-center gap-2">
          <Link
            to="/quiz"
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-glow-primary transition-all hover:scale-105 flex items-center gap-1.5"
          >
            <span>🎯</span>
            <span>Quiz Başlat</span>
          </Link>
          <Link
            to="/review"
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 transition-all hover:scale-105 flex items-center gap-1.5"
          >
            <span>🔥</span>
            <span>Tekrar ({stats?.toReview || 0})</span>
          </Link>
        </div>
      </div>

      {/* ── Daily Streak & Shield Highlight Card ── */}
      <div className="glass rounded-3xl p-5 sm:p-6 border border-white/10 bg-gradient-to-r from-amber-500/10 via-base-800 to-primary-500/10 shadow-card relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-3xl shadow-glow-orange border border-white/20 shrink-0">
              {streak.isCompletedToday ? '🎉' : '🔥'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-2xl sm:text-3xl font-black text-white">
                  {streak.currentStreak} Günlük Seri
                </span>
                {streak.isCompletedToday && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    Tamamlandı ✓
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-300 mt-1">
                Bugün <strong className="text-white">{streak.todayCount}/10</strong> kelime tekrar ettin.
                {streak.isCompletedToday
                  ? ' Harika iş, serin güvende!'
                  : ' Seriyi korumak için 10 kelimeyi tamamla.'}
              </p>
            </div>
          </div>

          {/* Target Progress Bar */}
          <div className="w-full md:w-56 space-y-2">
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-slate-400">Günlük Hedef</span>
              <span className="text-amber-300">%{Math.min(100, Math.round((streak.todayCount / 10) * 100))}</span>
            </div>
            <div className="h-2.5 bg-base-950 rounded-full overflow-hidden border border-white/10">
              <div
                className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, (streak.todayCount / 10) * 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-slate-500">
              <span>En iyi: {streak.bestStreak || streak.currentStreak} gün ⭐</span>
              <span>14G Kalkan: {streak.freezeAvailable ? 'Aktif 🛡️' : 'Kullanıldı ⏳'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── 4 Key Metric Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Words */}
        <div className="glass rounded-2xl p-4 sm:p-5 border border-white/5 relative overflow-hidden group hover:border-primary-500/30 transition-colors">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium mb-1">
            <span>Toplam Kelime</span>
            <span className="text-lg">📚</span>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-white">{stats?.total || 0}</div>
          <p className="text-[10px] text-slate-500 mt-1">Kütüphanendeki kelimeler</p>
        </div>

        {/* To Review */}
        <div className="glass rounded-2xl p-4 sm:p-5 border border-white/5 relative overflow-hidden group hover:border-amber-500/30 transition-colors">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium mb-1">
            <span>Tekrar Bekleyen</span>
            <span className="text-lg">⏰</span>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-amber-300">{stats?.toReview || 0}</div>
          <p className="text-[10px] text-slate-500 mt-1">SM-2 algoritması vakti gelenler</p>
        </div>

        {/* Weekly Added */}
        <div className="glass rounded-2xl p-4 sm:p-5 border border-white/5 relative overflow-hidden group hover:border-emerald-500/30 transition-colors">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium mb-1">
            <span>Bu Hafta</span>
            <span className="text-lg">📈</span>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-emerald-400">+{stats?.weeklyAdded || 0}</div>
          <p className="text-[10px] text-slate-500 mt-1">Son 7 günde eklenen</p>
        </div>

        {/* Mastered */}
        <div className="glass rounded-2xl p-4 sm:p-5 border border-white/5 relative overflow-hidden group hover:border-sky-500/30 transition-colors">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium mb-1">
            <span>Ezberlenen</span>
            <span className="text-lg">🎓</span>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-sky-400">{stats?.masteredCount || 0}</div>
          <p className="text-[10px] text-slate-500 mt-1">Hafızaya tam kazınanlar</p>
        </div>
      </div>

      {/* ── Activity Tracker & Calendar Section ── */}
      {stats && (
        <div className="glass rounded-3xl p-5 sm:p-6 border border-white/10 space-y-5 shadow-card">
          {/* Header & View Switcher */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/5 pb-4">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <span>📊</span>
                <span>Çalışma & Aktivite Takibi</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Günlük kelime tekrar ve ekleme performansın
              </p>
            </div>

            {/* View Switcher Tabs */}
            <div className="flex bg-base-950 rounded-xl p-1 border border-white/5 self-start sm:self-auto">
              <button
                onClick={() => setActivityView('bars')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  activityView === 'bars'
                    ? 'bg-primary-500 text-white shadow-glow-primary'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>📊</span>
                <span>Son 7 Gün (Çubuk)</span>
              </button>
              <button
                onClick={() => setActivityView('matrix')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  activityView === 'matrix'
                    ? 'bg-primary-500 text-white shadow-glow-primary'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>📅</span>
                <span>7 Haftalık (GitHub)</span>
              </button>
            </div>
          </div>

          {/* Activity Quick Stats Summary Row */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3 text-center">
            <div className="p-3 rounded-2xl bg-base-950/70 border border-white/5">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">Bu Hafta</span>
              <span className="text-lg sm:text-xl font-black text-emerald-400">{stats.weeklyTotalWords}</span>
              <span className="text-[10px] text-slate-500 block">kelime çalışıldı</span>
            </div>
            <div className="p-3 rounded-2xl bg-base-950/70 border border-white/5">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">En Aktif Gün</span>
              <span className="text-lg sm:text-xl font-black text-amber-300 truncate block">
                {stats.mostActiveDay.dayName}
              </span>
              <span className="text-[10px] text-slate-500 block">{stats.mostActiveDay.count} kelime</span>
            </div>
            <div className="p-3 rounded-2xl bg-base-950/70 border border-white/5">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">Günlük Ortalama</span>
              <span className="text-lg sm:text-xl font-black text-primary-300">{stats.dailyAverage}</span>
              <span className="text-[10px] text-slate-500 block">kelime / gün</span>
            </div>
          </div>

          {/* VIEW 1: High-Impact Daily Bar Chart (Last 7 Days) */}
          {activityView === 'bars' && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium px-1">
                <span>🎯 Hedef: Günde en az 10 kelime</span>
                <span className="text-emerald-400 font-semibold">Yeşil = Hedef Tamamlandı ✓</span>
              </div>

              {/* Bars Grid */}
              <div className="grid grid-cols-7 gap-2 sm:gap-3 items-end h-44 bg-base-950/50 rounded-2xl p-3 border border-white/5 relative">
                {/* 10-Word Goal Guideline */}
                <div
                  className="absolute left-0 right-0 border-b border-dashed border-emerald-500/30 pointer-events-none z-0"
                  style={{ bottom: '65%' }}
                >
                  <span className="absolute right-2 -top-4 text-[9px] font-mono text-emerald-400/70">
                    Hedef: 10
                  </span>
                </div>

                {stats.last7Days.map((d) => {
                  const maxVal = Math.max(15, ...stats.last7Days.map(x => x.count))
                  const heightPct = d.count > 0 ? Math.max(15, Math.min(100, Math.round((d.count / maxVal) * 100))) : 6

                  return (
                    <div key={d.date} className="flex flex-col items-center justify-end h-full relative z-10 group">
                      {/* Top number */}
                      <span className={`text-xs font-black mb-1 transition-all ${
                        d.count >= 10
                          ? 'text-emerald-400 scale-110 drop-shadow-[0_0_8px_rgba(52,211,153,0.6)]'
                          : d.count > 0
                            ? 'text-amber-300'
                            : 'text-slate-600'
                      }`}>
                        {d.count > 0 ? d.count : '0'}
                      </span>

                      {/* Bar Pillar */}
                      <div className="w-full max-w-[42px] bg-base-900 rounded-xl overflow-hidden h-28 flex items-end p-1 border border-white/5">
                        <div
                          className={`w-full rounded-lg transition-all duration-500 ${
                            d.count >= 10
                              ? 'bg-gradient-to-t from-emerald-600 to-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.5)]'
                              : d.count > 0
                                ? 'bg-gradient-to-t from-amber-600 to-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.4)]'
                                : 'bg-white/5'
                          }`}
                          style={{ height: `${heightPct}%` }}
                        />
                      </div>

                      {/* Day Label & Date */}
                      <div className="text-center mt-2">
                        <span className={`block text-xs font-bold leading-tight ${
                          d.isToday ? 'text-primary-300 font-black' : 'text-slate-200'
                        }`}>
                          {d.isToday ? 'Bugün' : d.dayName}
                        </span>
                        <span className="block text-[9px] text-slate-500 font-mono mt-0.5">
                          {d.displayDate}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* VIEW 2: GitHub-Style 7-Week Calendar Matrix */}
          {activityView === 'matrix' && (
            <div className="space-y-4 pt-2">
              <div className="overflow-x-auto pb-2">
                <div className="min-w-[460px] space-y-2">
                  {/* Week Column Labels */}
                  <div className="grid grid-cols-[40px_repeat(7,1fr)] gap-2 text-center text-[10px] text-slate-400 font-semibold">
                    <span />
                    {stats.heatmapWeeks.map(w => (
                      <span key={w.weekIdx} className="truncate">{w.weekLabel}</span>
                    ))}
                  </div>

                  {/* Matrix: Days of Week (Rows) x Weeks (Cols) */}
                  <div className="grid grid-cols-[40px_repeat(7,1fr)] gap-2 items-center">
                    {/* Day row labels on left */}
                    <div className="grid grid-rows-7 gap-1.5 text-[10px] text-slate-500 font-bold text-right pr-2">
                      <span className="h-6 flex items-center justify-end">Pzt</span>
                      <span className="h-6 flex items-center justify-end opacity-50">Sal</span>
                      <span className="h-6 flex items-center justify-end">Çar</span>
                      <span className="h-6 flex items-center justify-end opacity-50">Per</span>
                      <span className="h-6 flex items-center justify-end">Cum</span>
                      <span className="h-6 flex items-center justify-end opacity-50">Cmt</span>
                      <span className="h-6 flex items-center justify-end text-amber-400">Paz</span>
                    </div>

                    {/* 7 Week Columns */}
                    {stats.heatmapWeeks.map(week => (
                      <div key={week.weekIdx} className="grid grid-rows-7 gap-1.5">
                        {week.days.map(day => {
                          let colorCls = 'bg-white/5 border border-white/5 text-slate-600'
                          if (day.isFuture) colorCls = 'bg-transparent border border-dashed border-white/5 opacity-20 cursor-not-allowed'
                          else if (day.count >= 10) colorCls = 'bg-emerald-400 border border-emerald-300 text-base-950 font-black shadow-[0_0_8px_rgba(52,211,153,0.6)]'
                          else if (day.count >= 5) colorCls = 'bg-emerald-600 border border-emerald-500/50 text-white font-bold'
                          else if (day.count >= 1) colorCls = 'bg-emerald-800/80 border border-emerald-700/50 text-emerald-200'

                          return (
                            <button
                              key={day.date}
                              disabled={day.isFuture}
                              onClick={() => setSelectedHeatmapDay(day)}
                              className={`h-6 rounded-lg text-[9px] flex items-center justify-center transition-all hover:scale-110 ${colorCls} ${
                                day.isToday ? 'ring-2 ring-primary-400 ring-offset-1 ring-offset-base-900' : ''
                              }`}
                              title={`${day.displayDate}: ${day.count} kelime`}
                            >
                              {day.count > 0 ? day.count : ''}
                            </button>
                          )
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Selected Day Info Banner */}
              {selectedHeatmapDay && (
                <div className="p-3 rounded-2xl bg-base-950 border border-primary-500/30 flex items-center justify-between text-xs animate-fade-in">
                  <div>
                    <span className="font-bold text-white">
                      📅 {selectedHeatmapDay.displayDate} ({selectedHeatmapDay.dayName})
                    </span>
                    <span className="text-slate-400 ml-2">
                      {selectedHeatmapDay.count > 0
                        ? `${selectedHeatmapDay.count} kelime tekrar / ekleme yapıldı`
                        : 'Bu tarihte kelime çalışması yapılmadı'}
                    </span>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    selectedHeatmapDay.count >= 10
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : selectedHeatmapDay.count > 0
                        ? 'bg-amber-500/20 text-amber-300'
                        : 'bg-white/5 text-slate-500'
                  }`}>
                    {selectedHeatmapDay.count >= 10 ? '✓ Hedef Tamamlandı' : `${selectedHeatmapDay.count}/10 Hedef`}
                  </span>
                </div>
              )}

              {/* Heatmap Legend */}
              <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-white/5">
                <span>Karelere tıklayarak o günün detayını inceleyebilirsin</span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-500">Az</span>
                  <span className="w-3 h-3 rounded bg-white/5 border border-white/10" title="0" />
                  <span className="w-3 h-3 rounded bg-emerald-800/80" title="1-4" />
                  <span className="w-3 h-3 rounded bg-emerald-600" title="5-9" />
                  <span className="w-3 h-3 rounded bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]" title="10+" />
                  <span className="text-[10px] text-slate-500">Çok</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Quick Navigation Hub ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Link
          to="/quiz"
          className="p-4 rounded-2xl glass border border-violet-500/30 hover:border-violet-500/60 bg-gradient-to-br from-violet-600/20 to-base-800 transition-all hover:scale-[1.02] text-left group"
        >
          <div className="text-2xl mb-2 group-hover:scale-110 transition-transform">🎯</div>
          <p className="font-bold text-white text-sm">Quiz Sınavı</p>
          <p className="text-[11px] text-slate-400 mt-0.5">4 şıklı test modu</p>
        </Link>

        <Link
          to="/leaderboard"
          className="p-4 rounded-2xl glass border border-amber-500/30 hover:border-amber-500/60 bg-gradient-to-br from-amber-500/20 to-base-800 transition-all hover:scale-[1.02] text-left group"
        >
          <div className="text-2xl mb-2 group-hover:scale-110 transition-transform">🏆</div>
          <p className="font-bold text-white text-sm">Liderlik Tablosu</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Global sıralama</p>
        </Link>

        <Link
          to="/library"
          className="p-4 rounded-2xl glass border border-primary-500/30 hover:border-primary-500/60 bg-gradient-to-br from-primary-500/20 to-base-800 transition-all hover:scale-[1.02] text-left group"
        >
          <div className="text-2xl mb-2 group-hover:scale-110 transition-transform">📂</div>
          <p className="font-bold text-white text-sm">Kütüphane</p>
          <p className="text-[11px] text-slate-400 mt-0.5">CSV İçe / Dışa Aktar</p>
        </Link>

        <Link
          to="/add"
          className="p-4 rounded-2xl glass border border-emerald-500/30 hover:border-emerald-500/60 bg-gradient-to-br from-emerald-500/20 to-base-800 transition-all hover:scale-[1.02] text-left group"
        >
          <div className="text-2xl mb-2 group-hover:scale-110 transition-transform">➕</div>
          <p className="font-bold text-white text-sm">Kelime Ekle</p>
          <p className="text-[11px] text-slate-400 mt-0.5">AI cümle & eşanlam</p>
        </Link>
      </div>

      {/* ── Main Dashboard Content Grid: Chart + Hardest Words / Recent ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Donut Chart */}
        <div className="glass rounded-3xl p-5 sm:p-6 border border-white/10 shadow-card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <span>🧠</span>
              <span>Hafıza & Zorluk Dağılımı</span>
            </h2>
          </div>

          {stats?.chartData && stats.chartData.length > 0 ? (
            <div className="space-y-4">
              <div className="h-56 relative flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={stats.chartData}
                      innerRadius={65}
                      outerRadius={92}
                      paddingAngle={4}
                      dataKey="value"
                      stroke="none"
                    >
                      {stats.chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#07071a',
                        border: '1px solid rgba(255,255,255,0.15)',
                        borderRadius: '12px',
                        color: '#F8FAFC',
                        fontSize: '12px'
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                {/* Center Badge */}
                <div className="absolute text-center pointer-events-none">
                  <span className="text-2xl font-black text-white">{stats.total}</span>
                  <span className="block text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Kelime</span>
                </div>
              </div>

              {/* Legend Badges */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2">
                {stats.chartData.map(item => (
                  <div key={item.name} className="flex items-center gap-2 p-2 rounded-xl bg-white/5 border border-white/5 text-xs">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-slate-300 truncate">{item.name}</span>
                    <span className="ml-auto font-bold text-white">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-slate-500 text-xs">
              Henüz grafik için yeterli veri yok.
            </div>
          )}
        </div>

        {/* Hardest Words & Recent Words */}
        <div className="space-y-6">
          {/* Hardest Words Widget */}
          {stats?.hardestWords && stats.hardestWords.length > 0 && (
            <div className="glass rounded-3xl p-5 sm:p-6 border border-red-500/20 bg-gradient-to-br from-red-500/10 via-base-900 to-base-950 shadow-card">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <span>⚠️</span>
                  <span>En Çok Zorlandığın Kelimeler</span>
                </h3>
                <Link to="/review" className="text-xs text-red-400 hover:text-red-300 font-semibold">
                  Tekrar Et ➔
                </Link>
              </div>

              <div className="space-y-2">
                {stats.hardestWords.map(w => (
                  <div key={w.id} className="flex items-center justify-between p-2.5 rounded-xl bg-black/40 border border-white/5">
                    <div className="flex items-center gap-2 min-w-0">
                      <button
                        onClick={() => playAudio(w.english_word)}
                        className="text-xs text-slate-400 hover:text-white p-1 rounded hover:bg-white/10"
                        title="Dinle"
                      >
                        🔊
                      </button>
                      <span className="font-bold text-white text-xs truncate">{w.english_word}</span>
                      <span className="text-[11px] text-slate-400 truncate hidden xs:inline">
                        — {w.turkish_translation}
                      </span>
                    </div>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/30 shrink-0">
                      {w.review_count || 0} tekrar
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent Words List */}
          <div className="glass rounded-3xl p-5 sm:p-6 border border-white/10 shadow-card">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>✨</span>
                <span>Son Eklenen Kelimeler</span>
              </h3>
              <Link to="/library" className="text-xs text-primary-400 hover:text-primary-300 font-semibold">
                Tümü ➔
              </Link>
            </div>

            <div className="space-y-2">
              {stats?.recentWords.map(word => (
                <div key={word.id} className="flex justify-between items-center p-2.5 rounded-xl bg-base-900 border border-white/5">
                  <div className="min-w-0 pr-2">
                    <div className="font-bold text-white text-xs truncate">{word.english_word}</div>
                    <div className="text-[11px] text-slate-400 truncate">
                      {word.turkish_translation || 'Çeviri yok'}
                    </div>
                  </div>
                  <div className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider shrink-0
                    ${word.difficulty === 'mastered' ? 'bg-sky-500/20 text-sky-400' :
                      word.difficulty === 'hard' ? 'bg-red-500/20 text-red-400' :
                      word.difficulty === 'medium' ? 'bg-amber-500/20 text-amber-400' :
                      word.difficulty === 'easy' ? 'bg-green-500/20 text-green-400' :
                      'bg-slate-500/20 text-slate-400'}`}
                  >
                    {word.difficulty === 'mastered' ? 'Ezberlendi' : word.difficulty === 'unrated' ? 'Yeni' : word.difficulty}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
