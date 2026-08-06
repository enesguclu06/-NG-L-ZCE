import { useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useWords } from '../hooks/useWords'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'

export default function DashboardPage() {
  const { words, fetchWords, loading, error } = useWords()

  useEffect(() => {
    fetchWords()
  }, [fetchWords])

  const stats = useMemo(() => {
    if (!words || words.length === 0) return null

    // Total words
    const total = words.length

    // To Review Today (next_review_date <= now)
    const now = new Date().toISOString()
    const toReview = words.filter(w => w.next_review_date && w.next_review_date <= now).length

    // Weekly added (last 7 days)
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const weeklyAdded = words.filter(w => new Date(w.created_at) >= sevenDaysAgo).length

    // Difficulty breakdown
    const diffCount = { unrated: 0, easy: 0, medium: 0, hard: 0 }
    words.forEach(w => {
      const d = w.difficulty || 'unrated'
      if (diffCount[d] !== undefined) diffCount[d]++
    })

    const chartData = [
      { name: 'Öğrenilmedi', value: diffCount.unrated, color: '#94A3B8' }, // slate-400
      { name: 'Zor', value: diffCount.hard, color: '#F87171' }, // red-400
      { name: 'Orta', value: diffCount.medium, color: '#FBBF24' }, // amber-400
      { name: 'Kolay', value: diffCount.easy, color: '#4ADE80' }, // green-400
    ].filter(d => d.value > 0)

    // Recent 5 words
    const recentWords = words.slice(0, 5)

    return { total, toReview, weeklyAdded, chartData, recentWords }
  }, [words])

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/50 rounded-xl p-4 text-red-500 text-center">
        Veriler yüklenirken hata oluştu: {error}
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
      <header>
        <h1 className="text-2xl font-bold bg-gradient-to-r from-primary-400 to-accent-400 bg-clip-text text-transparent">
          Dashboard
        </h1>
        <p className="text-slate-400 mt-1">Öğrenme istatistiklerin ve kütüphane özetin</p>
      </header>

      {/* Top Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-base-800 rounded-2xl p-6 border border-white/5 shadow-xl relative overflow-hidden group hover:border-primary-500/30 transition-colors">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-primary-500/10 rounded-full blur-xl group-hover:bg-primary-500/20 transition-colors"></div>
          <p className="text-slate-400 text-sm font-medium mb-1">Toplam Kelime</p>
          <div className="text-4xl font-black text-white">{stats?.total || 0}</div>
        </div>

        <div className="bg-base-800 rounded-2xl p-6 border border-white/5 shadow-xl relative overflow-hidden group hover:border-accent-500/30 transition-colors">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-accent-500/10 rounded-full blur-xl group-hover:bg-accent-500/20 transition-colors"></div>
          <p className="text-slate-400 text-sm font-medium mb-1">Son 7 Günde Eklenen</p>
          <div className="text-4xl font-black text-white">{stats?.weeklyAdded || 0}</div>
        </div>

        <div className="bg-base-800 rounded-2xl p-6 border border-white/5 shadow-xl relative overflow-hidden group hover:border-amber-500/30 transition-colors">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-amber-500/10 rounded-full blur-xl group-hover:bg-amber-500/20 transition-colors"></div>
          <p className="text-slate-400 text-sm font-medium mb-1">Tekrar Bekleyen</p>
          <div className="text-4xl font-black text-white">{stats?.toReview || 0}</div>
        </div>
      </div>

      {!stats ? (
        <div className="text-center py-12 bg-base-800 rounded-2xl border border-white/5">
          <p className="text-slate-400 mb-4">Henüz hiç kelime eklemedin.</p>
          <Link to="/add" className="btn-primary">Kelime Avla</Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Chart */}
          <div className="bg-base-800 rounded-2xl p-6 border border-white/5 shadow-xl">
            <h2 className="text-lg font-semibold text-white mb-4">Öğrenme Durumu</h2>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.chartData}
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={5}
                    dataKey="value"
                    stroke="none"
                  >
                    {stats.chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1E293B', border: 'none', borderRadius: '8px', color: '#F8FAFC' }}
                    itemStyle={{ color: '#F8FAFC' }}
                  />
                  <Legend verticalAlign="bottom" height={36} wrapperStyle={{ paddingTop: '20px' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Recent Words */}
          <div className="bg-base-800 rounded-2xl p-6 border border-white/5 shadow-xl flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-white">Son Eklenenler</h2>
              <Link to="/library" className="text-sm text-primary-400 hover:text-primary-300">Tümü ➔</Link>
            </div>
            
            <div className="flex-1 space-y-3">
              {stats.recentWords.map(word => (
                <div key={word.id} className="flex justify-between items-center p-3 rounded-xl bg-base-900 border border-white/5">
                  <div>
                    <div className="font-medium text-white">{word.english_word}</div>
                    <div className="text-xs text-slate-400 truncate max-w-[150px] sm:max-w-[200px]">
                      {word.turkish_translation || 'Çeviri yok'}
                    </div>
                  </div>
                  <div className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider
                    ${word.difficulty === 'hard' ? 'bg-red-500/20 text-red-400' :
                      word.difficulty === 'medium' ? 'bg-amber-500/20 text-amber-400' :
                      word.difficulty === 'easy' ? 'bg-green-500/20 text-green-400' :
                      'bg-slate-500/20 text-slate-400'}`}
                  >
                    {word.difficulty === 'unrated' ? 'Yeni' : word.difficulty}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
