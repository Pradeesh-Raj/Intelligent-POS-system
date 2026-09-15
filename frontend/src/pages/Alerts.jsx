import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, Bell } from 'lucide-react'
import AlertFeed from '../components/AlertFeed'
import { getAlerts } from '../api/client'

const REFRESH_INTERVAL = 30_000

export default function Alerts() {
  const [alerts, setAlerts]   = useState([])
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLast]= useState(null)

  const fetch = useCallback(async () => {
    try {
      const { data } = await getAlerts(50)
      setAlerts(data)
      setLast(new Date())
    } catch (e) {
      console.error('Alerts fetch error:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetch()
    const interval = setInterval(fetch, REFRESH_INTERVAL)
    return () => clearInterval(interval)
  }, [fetch])

  const reorderCount  = alerts.filter(a => a.alert_type === 'reorder').length
  const discountCount = alerts.filter(a => a.alert_type === 'discount').length

  return (
    <div className="animate-fade-in max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="page-header mb-0">
          <h1 className="flex items-center gap-3">
            <Bell size={24} className="text-brand-400" />
            Alert Feed
          </h1>
          <p>Unified notification stream — reorder triggers and expiry discount events</p>
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

      {/* Summary badges */}
      {!loading && alerts.length > 0 && (
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-sm text-gray-400">{alerts.length} total alerts:</span>
          <span className="badge-blue">{reorderCount} reorder</span>
          <span className="badge-yellow">{discountCount} discount</span>
        </div>
      )}

      {/* Production note */}
      <div className="glass rounded-xl p-4 text-sm text-gray-400 border border-surface-600">
        <span className="font-semibold text-gray-300">Production upgrade:</span>{' '}
        This feed is in-app only. In production, each alert would trigger a WhatsApp Business API
        message or Twilio SMS to the store owner — see README for integration notes.
      </div>

      <AlertFeed alerts={alerts} loading={loading} />
    </div>
  )
}
