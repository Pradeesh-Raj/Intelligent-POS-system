import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, Lightbulb, Tag, TrendingUp, Info } from 'lucide-react'
import RecommendationCard from '../components/RecommendationCard'
import { getRecommendations } from '../api/client'

const REFRESH_INTERVAL = 60_000

export default function Recommendations() {
  const [data, setData]       = useState({ reorder: [], discounts: [] })
  const [loading, setLoading] = useState(true)
  const [tab, setTab]         = useState('reorder')  // 'reorder' | 'discounts'
  const [lastUpdated, setLast]= useState(null)

  const fetch = useCallback(async () => {
    setLoading(true)
    try {
      const { data: d } = await getRecommendations()
      setData(d)
      setLast(new Date())
    } catch (e) {
      console.error('Recommendations fetch error:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetch()
    const interval = setInterval(fetch, REFRESH_INTERVAL)
    return () => clearInterval(interval)
  }, [fetch])

  const activeReorders   = data.reorder?.filter(r => r.recommended_qty > 0) ?? []
  const stocedOk         = data.reorder?.filter(r => r.recommended_qty === 0) ?? []
  const activeDiscounts  = data.discounts ?? []

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="page-header mb-0">
          <h1>AI Recommendations</h1>
          <p>Every recommendation includes a plain-language reason — powered by LightGBM + contextual bandit</p>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-xs text-gray-500">
              Updated {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={fetch}
            className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5"
            disabled={loading}
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* AI Explainability banner */}
      <div className="glass rounded-xl p-4 flex items-start gap-3 border border-brand-500/20">
        <Info size={18} className="text-brand-400 shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-semibold text-gray-200 mb-0.5">How this works</p>
          <p className="text-gray-400 leading-relaxed">
            <strong className="text-gray-300">Reorder</strong>: LightGBM predicts next-7-day demand using sales history, day-of-week, and rolling averages.
            Reorder qty = predicted demand − current stock + safety buffer.{' '}
            <strong className="text-gray-300">Discounts</strong>: An epsilon-greedy contextual bandit selects a discount tier based on
            days-to-expiry, current stock, and recent sell velocity — and learns which tier clears stock fastest.
          </p>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-2 border-b border-surface-700 pb-0">
        <button
          onClick={() => setTab('reorder')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-all duration-200 -mb-px ${
            tab === 'reorder'
              ? 'border-brand-500 text-brand-400'
              : 'border-transparent text-gray-400 hover:text-gray-200'
          }`}
        >
          <TrendingUp size={15} />
          Reorder ({activeReorders.length} action needed)
        </button>
        <button
          onClick={() => setTab('discounts')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-all duration-200 -mb-px ${
            tab === 'discounts'
              ? 'border-amber-500 text-amber-400'
              : 'border-transparent text-gray-400 hover:text-gray-200'
          }`}
        >
          <Tag size={15} />
          Expiry Discounts ({activeDiscounts.length})
        </button>
      </div>

      {/* Loading skeleton */}
      {loading ? (
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 rounded-xl bg-surface-700 animate-pulse" style={{ animationDelay: `${i * 100}ms` }} />
          ))}
        </div>
      ) : tab === 'reorder' ? (
        <div className="space-y-4">
          {/* Action needed */}
          {activeReorders.length > 0 && (
            <>
              <p className="text-sm text-gray-400 font-medium flex items-center gap-2">
                <span className="badge-red">{activeReorders.length}</span>
                Products need restocking
              </p>
              {activeReorders.map((rec, idx) => (
                <div key={rec.id} style={{ animationDelay: `${idx * 80}ms` }}>
                  <RecommendationCard rec={rec} type="reorder" />
                </div>
              ))}
            </>
          )}

          {/* Well-stocked */}
          {stocedOk.length > 0 && (
            <>
              <p className="text-sm text-gray-400 font-medium mt-4">
                Well stocked — no action needed ({stocedOk.length})
              </p>
              {stocedOk.map((rec, idx) => (
                <div key={rec.id} style={{ animationDelay: `${(activeReorders.length + idx) * 80}ms` }}>
                  <RecommendationCard rec={rec} type="reorder" />
                </div>
              ))}
            </>
          )}

          {!activeReorders.length && !stocedOk.length && (
            <div className="text-center py-12 text-gray-500">
              No reorder recommendations yet. Hit Refresh to run the engine.
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {activeDiscounts.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              No near-expiry batches found within the 7-day window.
            </div>
          ) : (
            activeDiscounts.map((rec, idx) => (
              <div key={rec.id} style={{ animationDelay: `${idx * 80}ms` }}>
                <RecommendationCard rec={rec} type="discount" />
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
