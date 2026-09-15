import { TrendingUp, Tag, Clock } from 'lucide-react'

/**
 * Unified alert feed merging reorder and discount events, newest-first.
 */
export default function AlertFeed({ alerts = [], loading = false }) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-20 rounded-xl bg-surface-700 animate-pulse" />
        ))}
      </div>
    )
  }

  if (!alerts.length) {
    return (
      <div className="text-center py-12 text-gray-500">
        No alerts yet. Recommendations will appear after the first engine cycle.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {alerts.map((alert, idx) => (
        <AlertItem key={idx} alert={alert} idx={idx} />
      ))}
    </div>
  )
}

function AlertItem({ alert, idx }) {
  const isReorder = alert.alert_type === 'reorder'

  return (
    <div
      className={`card flex items-start gap-4 animate-slide-up transition-all duration-200 ${
        isReorder ? 'hover:border-brand-500/40' : 'hover:border-amber-500/40'
      }`}
      style={{ animationDelay: `${idx * 60}ms` }}
    >
      {/* Icon */}
      <div
        className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
          isReorder
            ? 'bg-brand-500/20 border border-brand-500/30'
            : 'bg-amber-500/20 border border-amber-500/30'
        }`}
      >
        {isReorder
          ? <TrendingUp size={16} className="text-brand-400" />
          : <Tag size={16} className="text-amber-400" />
        }
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className="font-semibold text-gray-100 text-sm">{alert.title}</p>
          <div className="flex items-center gap-1.5 text-xs text-gray-500 shrink-0">
            <Clock size={12} />
            {new Date(alert.timestamp).toLocaleString('en-US', {
              month: 'short', day: 'numeric',
              hour: '2-digit', minute: '2-digit',
            })}
          </div>
        </div>
        <p className="mt-1 text-sm text-gray-400 leading-relaxed">{alert.reasoning_text}</p>

        {/* Type badge */}
        <div className="mt-2">
          <span className={isReorder ? 'badge-blue' : 'badge-yellow'}>
            {isReorder ? 'Reorder' : 'Discount'}
          </span>
        </div>
      </div>
    </div>
  )
}
