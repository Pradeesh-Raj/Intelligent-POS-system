import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, Package, AlertTriangle, Clock, TrendingDown } from 'lucide-react'
import StockTable from '../components/StockTable'
import { getInventory } from '../api/client'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

const REFRESH_INTERVAL = 30_000  // 30 seconds

export default function Dashboard() {
  const [inventory, setInventory] = useState([])
  const [loading, setLoading]     = useState(true)
  const [lastUpdated, setLast]    = useState(null)

  const fetch = useCallback(async () => {
    try {
      const { data } = await getInventory()
      setInventory(data)
      setLast(new Date())
    } catch (e) {
      console.error('Dashboard fetch error:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetch()
    const interval = setInterval(fetch, REFRESH_INTERVAL)
    return () => clearInterval(interval)
  }, [fetch])

  // Derived stats
  const totalProducts   = inventory.length
  const totalUnits      = inventory.reduce((s, p) => s + p.total_quantity, 0)
  const nearExpiry      = inventory.flatMap(p => p.batches).filter(b => b.days_to_expiry != null && b.days_to_expiry <= 7).length
  const criticalExpiry  = inventory.flatMap(p => p.batches).filter(b => b.days_to_expiry != null && b.days_to_expiry <= 3).length
  const lowStock        = inventory.filter(p => p.total_quantity < 10).length

  // Bar chart data — top 10 products by quantity
  const chartData = [...inventory]
    .sort((a, b) => b.total_quantity - a.total_quantity)
    .slice(0, 10)
    .map(p => ({ name: p.name.length > 14 ? p.name.slice(0, 14) + '…' : p.name, qty: p.total_quantity }))

  const CHART_COLORS = ['#3b5bdb', '#4c6ef5', '#5c7cfa', '#74c0fc', '#339af0', '#228be6', '#1c7ed6', '#1971c2', '#1864ab', '#145296']

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="page-header mb-0">
          <h1>Inventory Dashboard</h1>
          <p>Live stock overview with batch-level expiry tracking</p>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-xs text-gray-500 flex items-center gap-1">
              <Clock size={12} />
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

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="stat-card">
          <Package size={20} className="text-brand-400" />
          <div className="stat-value">{totalProducts}</div>
          <div className="stat-label">Products</div>
        </div>

        <div className="stat-card">
          <Package size={20} className="text-gray-400" />
          <div className="stat-value">{totalUnits.toLocaleString()}</div>
          <div className="stat-label">Total Units</div>
        </div>

        <div className={`stat-card ${criticalExpiry > 0 ? 'border-red-500/40' : ''}`}>
          <AlertTriangle size={20} className={criticalExpiry > 0 ? 'text-red-400' : 'text-amber-400'} />
          <div className={`stat-value ${criticalExpiry > 0 ? 'text-red-400' : 'text-amber-400'}`}>
            {nearExpiry}
          </div>
          <div className="stat-label">Near Expiry (7d)</div>
          {criticalExpiry > 0 && (
            <p className="text-xs text-red-400">{criticalExpiry} critical (≤3d)</p>
          )}
        </div>

        <div className={`stat-card ${lowStock > 0 ? 'border-amber-500/40' : ''}`}>
          <TrendingDown size={20} className={lowStock > 0 ? 'text-amber-400' : 'text-gray-400'} />
          <div className={`stat-value ${lowStock > 0 ? 'text-amber-400' : 'text-white'}`}>
            {lowStock}
          </div>
          <div className="stat-label">Low Stock (&lt;10)</div>
        </div>
      </div>

      {/* Stock by Product Bar Chart */}
      <div className="card">
        <h2 className="section-title mb-4">
          <BarChart size={18} /> Stock Levels (Top 10 Products)
        </h2>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData} margin={{ top: 4, right: 4, left: -10, bottom: 4 }}>
            <XAxis
              dataKey="name"
              tick={{ fill: '#768390', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: '#768390', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{ background: '#21262d', border: '1px solid #2d333b', borderRadius: 8, color: '#e6edf3' }}
              cursor={{ fill: 'rgba(255,255,255,0.03)' }}
            />
            <Bar dataKey="qty" radius={[6, 6, 0, 0]}>
              {chartData.map((_, i) => (
                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Inventory Table */}
      <div className="card">
        <h2 className="section-title mb-4">
          <Package size={18} /> Full Inventory
        </h2>
        <StockTable products={inventory} loading={loading} />
      </div>

      {/* Expiry legend */}
      <div className="flex items-center gap-6 text-xs text-gray-500 px-1">
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-400" /> &gt;7 days</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-400" /> 4–7 days</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-400" /> ≤3 days</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-gray-500" /> No expiry</span>
      </div>
    </div>
  )
}
