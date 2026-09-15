import { ShoppingBag, Tag, AlertCircle, TrendingUp } from 'lucide-react'

/**
 * Displays a single recommendation card — either a reorder or a discount.
 * The `reasoning_text` (the "why") is prominently displayed as the main content.
 */
export default function RecommendationCard({ rec, type }) {
  if (type === 'reorder') {
    return (
      <div className="card hover:border-brand-500/40 animate-slide-up group relative overflow-hidden">
        {/* Subtle gradient accent */}
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-brand-500 to-purple-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-brand-500/20 border border-brand-500/30 flex items-center justify-center shrink-0">
              <TrendingUp size={18} className="text-brand-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-gray-100">{rec.name}</span>
                <code className="text-brand-400 font-mono text-xs bg-brand-500/10 px-2 py-0.5 rounded">
                  {rec.sku}
                </code>
              </div>
              {/* "Why" text — the key differentiator */}
              <p className="mt-2 text-sm text-gray-300 leading-relaxed bg-surface-700/50 rounded-lg px-3 py-2 border-l-2 border-brand-500/50">
                {rec.reasoning_text}
              </p>
            </div>
          </div>

          {/* Recommended quantity highlight */}
          <div className="shrink-0 text-right">
            {rec.recommended_qty > 0 ? (
              <div className="bg-brand-500/20 border border-brand-500/30 rounded-xl px-4 py-2">
                <div className="text-2xl font-bold text-brand-300">{rec.recommended_qty}</div>
                <div className="text-xs text-gray-400 mt-0.5">units to order</div>
              </div>
            ) : (
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-4 py-2">
                <div className="text-sm font-semibold text-emerald-400">Well stocked</div>
                <div className="text-xs text-gray-400 mt-0.5">No action needed</div>
              </div>
            )}
          </div>
        </div>

        {/* Metadata footer */}
        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-surface-700 text-xs text-gray-500">
          <span>7d forecast: <span className="text-gray-300 font-medium">{rec.predicted_demand_7d.toFixed(0)} units</span></span>
          <span>•</span>
          <span>Generated: <span className="text-gray-300">{new Date(rec.generated_at).toLocaleTimeString()}</span></span>
        </div>
      </div>
    )
  }

  // Discount card
  const discountColor = rec.new_discount_pct >= 30
    ? 'text-red-400 border-red-500/30 bg-red-500/10'
    : rec.new_discount_pct >= 20
    ? 'text-amber-400 border-amber-500/30 bg-amber-500/10'
    : 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'

  return (
    <div className="card hover:border-amber-500/40 animate-slide-up group relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-amber-500 to-orange-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center shrink-0">
            <Tag size={18} className="text-amber-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-gray-100">{rec.product_name}</span>
              <code className="text-amber-400 font-mono text-xs bg-amber-500/10 px-2 py-0.5 rounded">
                {rec.sku}
              </code>
              {rec.old_discount_pct !== rec.new_discount_pct && (
                <span className="text-xs text-gray-500 line-through">{rec.old_discount_pct}%</span>
              )}
            </div>
            {/* "Why" text */}
            <p className="mt-2 text-sm text-gray-300 leading-relaxed bg-surface-700/50 rounded-lg px-3 py-2 border-l-2 border-amber-500/50">
              {rec.reasoning_text}
            </p>
          </div>
        </div>

        {/* Discount highlight */}
        <div className={`shrink-0 border rounded-xl px-4 py-2 text-right ${discountColor}`}>
          <div className="text-2xl font-bold">{rec.new_discount_pct}%</div>
          <div className="text-xs opacity-70 mt-0.5">discount</div>
        </div>
      </div>

      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-surface-700 text-xs text-gray-500">
        <span>Batch: <span className="text-gray-300 font-mono">#{rec.batch_id}</span></span>
        <span>•</span>
        <span>Applied: <span className="text-gray-300">{new Date(rec.timestamp).toLocaleTimeString()}</span></span>
      </div>
    </div>
  )
}
