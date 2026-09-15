import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, Package, AlertTriangle, Clock, TrendingDown, Plus, X } from 'lucide-react'
import StockTable from '../components/StockTable'
import { getInventory, createProduct, createBatch } from '../api/client'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

const REFRESH_INTERVAL = 30_000  // 30 seconds

export default function Dashboard() {
  const [inventory, setInventory] = useState([])
  const [loading, setLoading]     = useState(true)
  const [lastUpdated, setLast]    = useState(null)
  
  // Modal states
  const [showProductModal, setShowProductModal] = useState(false)
  const [showBatchModal, setShowBatchModal]     = useState(false)
  const [prodForm, setProdForm] = useState({ name: '', sku: '', category: 'fast_moving', unit_price: '', min_stock_level: 10 })
  const [batchForm, setBatchForm] = useState({ product_id: '', quantity: 20, expiry_days: 14 })

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

  const handleCreateProduct = async (e) => {
    e.preventDefault()
    if (!prodForm.name || !prodForm.sku) return
    try {
      await createProduct(prodForm)
      setShowProductModal(false)
      setProdForm({ name: '', sku: '', category: 'fast_moving', unit_price: '', min_stock_level: 10 })
      fetch()
    } catch (err) {
      alert('Failed to add product: ' + (err.message || 'Unknown error'))
    }
  }

  const handleCreateBatch = async (e) => {
    e.preventDefault()
    if (!batchForm.product_id) return
    try {
      const expDate = new Date(Date.now() + (parseInt(batchForm.expiry_days) || 14) * 86400000).toISOString().split('T')[0]
      await createBatch({
        product_id: batchForm.product_id,
        quantity: parseInt(batchForm.quantity),
        expiry_date: expDate
      })
      setShowBatchModal(false)
      fetch()
    } catch (err) {
      alert('Failed to add batch: ' + (err.message || 'Unknown error'))
    }
  }

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
      <div className="flex items-start justify-between flex-wrap gap-4">
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
            onClick={() => setShowProductModal(true)}
            className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5"
          >
            <Plus size={13} /> Add Product
          </button>
          <button
            onClick={() => {
              if (inventory.length) setBatchForm(b => ({ ...b, product_id: inventory[0].product_id }))
              setShowBatchModal(true)
            }}
            className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5"
          >
            <Plus size={13} /> Add Stock Batch
          </button>
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

      {/* Add Product Modal */}
      {showProductModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="card max-w-md w-full animate-slide-up border-brand-500/30">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg text-gray-100 flex items-center gap-2">
                <Package size={18} className="text-brand-400" /> New Product
              </h3>
              <button onClick={() => setShowProductModal(false)} className="text-gray-400 hover:text-white">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateProduct} className="space-y-4">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Product Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Organic Almond Milk 1L"
                  className="input text-sm"
                  value={prodForm.name}
                  onChange={e => setProdForm({ ...prodForm, name: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400 block mb-1">SKU</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. AM-001"
                    className="input text-sm uppercase font-mono"
                    value={prodForm.sku}
                    onChange={e => setProdForm({ ...prodForm, sku: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Category</label>
                  <select
                    className="input text-sm"
                    value={prodForm.category}
                    onChange={e => setProdForm({ ...prodForm, category: e.target.value })}
                  >
                    <option value="perishable">Perishable</option>
                    <option value="fast_moving">Fast Moving</option>
                    <option value="slow_moving">Slow Moving</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Unit Price ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="3.99"
                    className="input text-sm"
                    value={prodForm.unit_price}
                    onChange={e => setProdForm({ ...prodForm, unit_price: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Min Stock Threshold</label>
                  <input
                    type="number"
                    required
                    className="input text-sm"
                    value={prodForm.min_stock_level}
                    onChange={e => setProdForm({ ...prodForm, min_stock_level: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowProductModal(false)} className="btn-secondary flex-1 py-2 text-sm">
                  Cancel
                </button>
                <button type="submit" className="btn-primary flex-1 py-2 text-sm">
                  Save Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Stock Batch Modal */}
      {showBatchModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="card max-w-md w-full animate-slide-up border-brand-500/30">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg text-gray-100 flex items-center gap-2">
                <Plus size={18} className="text-brand-400" /> Add Stock Batch
              </h3>
              <button onClick={() => setShowBatchModal(false)} className="text-gray-400 hover:text-white">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateBatch} className="space-y-4">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Select Product</label>
                <select
                  className="input text-sm"
                  value={batchForm.product_id}
                  onChange={e => setBatchForm({ ...batchForm, product_id: e.target.value })}
                >
                  {inventory.map(p => (
                    <option key={p.product_id} value={p.product_id}>
                      {p.name} ({p.sku})
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Quantity</label>
                  <input
                    type="number"
                    required
                    min="1"
                    className="input text-sm"
                    value={batchForm.quantity}
                    onChange={e => setBatchForm({ ...batchForm, quantity: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Expires in (Days)</label>
                  <input
                    type="number"
                    required
                    min="1"
                    className="input text-sm"
                    value={batchForm.expiry_days}
                    onChange={e => setBatchForm({ ...batchForm, expiry_days: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowBatchModal(false)} className="btn-secondary flex-1 py-2 text-sm">
                  Cancel
                </button>
                <button type="submit" className="btn-primary flex-1 py-2 text-sm">
                  Add Batch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
