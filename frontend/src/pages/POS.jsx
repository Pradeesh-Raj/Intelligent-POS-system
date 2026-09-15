import { useState, useRef, useEffect } from 'react'
import { ScanLine, Keyboard, CheckCircle, AlertCircle, X, ShoppingBag } from 'lucide-react'
import { recordSale, getSales } from '../api/client'

export default function POS() {
  const [sku, setSku]             = useState('')
  const [qty, setQty]             = useState(1)
  const [loading, setLoading]     = useState(false)
  const [message, setMessage]     = useState(null) // {type: 'success'|'error', text}
  const [recentSales, setRecent]  = useState([])
  const [scanMode, setScanMode]   = useState(false)
  const skuRef                    = useRef(null)
  const scannerRef                = useRef(null)

  useEffect(() => {
    fetchRecent()
    skuRef.current?.focus()
  }, [])

  const fetchRecent = async () => {
    try {
      const { data } = await getSales(10)
      setRecent(data)
    } catch {}
  }

  const handleSubmit = async (e) => {
    e?.preventDefault()
    if (!sku.trim()) return
    setLoading(true)
    setMessage(null)
    try {
      const { data } = await recordSale(sku.trim().toUpperCase(), Number(qty))
      setMessage({
        type: 'success',
        text: `Sold ${qty}x ${sku.toUpperCase()} — $${(data[0].unit_price_at_sale * qty).toFixed(2)}`,
      })
      setSku('')
      setQty(1)
      fetchRecent()
      skuRef.current?.focus()
    } catch (err) {
      const detail = err.response?.data?.detail || 'Sale failed. Check SKU and stock.'
      setMessage({ type: 'error', text: detail })
    } finally {
      setLoading(false)
    }
  }

  const startScanner = async () => {
    setScanMode(true)
    // Dynamically import html5-qrcode to avoid SSR issues
    const { Html5Qrcode } = await import('html5-qrcode')
    const scanner = new Html5Qrcode('qr-reader')
    scannerRef.current = scanner

    try {
      const cameras = await Html5Qrcode.getCameras()
      if (!cameras.length) {
        setScanMode(false)
        setMessage({ type: 'error', text: 'No camera found. Use manual entry.' })
        return
      }
      await scanner.start(
        cameras[0].id,
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          setSku(decodedText)
          stopScanner()
          skuRef.current?.focus()
        },
        () => {}
      )
    } catch {
      setScanMode(false)
      setMessage({ type: 'error', text: 'Camera access denied. Use manual entry.' })
    }
  }

  const stopScanner = async () => {
    if (scannerRef.current?.isScanning) {
      await scannerRef.current.stop()
      scannerRef.current.clear()
    }
    setScanMode(false)
  }

  return (
    <div className="animate-fade-in max-w-2xl mx-auto">
      {/* Header */}
      <div className="page-header">
        <h1>Point of Sale</h1>
        <p>Scan a barcode or enter a SKU to record a sale</p>
      </div>

      {/* Message banner */}
      {message && (
        <div className={`mb-4 flex items-center gap-3 px-4 py-3 rounded-xl border animate-slide-up ${
          message.type === 'success'
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
            : 'bg-red-500/10 border-red-500/30 text-red-400'
        }`}>
          {message.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          <span className="flex-1 text-sm font-medium">{message.text}</span>
          <button onClick={() => setMessage(null)} className="opacity-70 hover:opacity-100">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Camera Scanner */}
      {scanMode ? (
        <div className="card mb-4">
          <div className="flex items-center justify-between mb-3">
            <span className="section-title"><ScanLine size={18} /> Camera Scanner</span>
            <button onClick={stopScanner} className="btn-secondary text-xs py-1 px-3">
              <X size={14} className="inline mr-1" /> Close
            </button>
          </div>
          <div id="qr-reader" className="rounded-lg overflow-hidden" />
        </div>
      ) : (
        <div className="card mb-4">
          <h2 className="section-title mb-4">
            <Keyboard size={18} /> Manual Entry
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm text-gray-400 mb-1.5 block">Product SKU</label>
              <div className="flex gap-2">
                <input
                  ref={skuRef}
                  type="text"
                  className="input uppercase font-mono"
                  placeholder="e.g. FM-001"
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={startScanner}
                  className="btn-secondary px-3 shrink-0"
                  title="Open camera scanner"
                >
                  <ScanLine size={18} />
                </button>
              </div>
            </div>

            <div>
              <label className="text-sm text-gray-400 mb-1.5 block">Quantity</label>
              <input
                type="number"
                className="input"
                min={1}
                max={999}
                value={qty}
                onChange={(e) => setQty(Math.max(1, parseInt(e.target.value) || 1))}
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              className="btn-primary w-full py-3 text-base"
              disabled={loading || !sku.trim()}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Processing…
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <ShoppingBag size={18} /> Record Sale
                </span>
              )}
            </button>
          </form>

          {/* Quick-access SKUs */}
          <div className="mt-4 pt-4 border-t border-surface-700">
            <p className="text-xs text-gray-500 mb-2">Quick-fill SKUs:</p>
            <div className="flex flex-wrap gap-2">
              {['FM-001', 'FM-002', 'PR-001', 'PR-002', 'SM-001'].map((s) => (
                <button
                  key={s}
                  onClick={() => setSku(s)}
                  className="text-xs font-mono px-2 py-1 rounded bg-surface-700 text-brand-400 hover:bg-surface-600 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Recent Sales */}
      <div className="card">
        <h2 className="section-title mb-4">Recent Sales</h2>
        {recentSales.length === 0 ? (
          <p className="text-gray-500 text-sm">No sales yet.</p>
        ) : (
          <div className="space-y-2">
            {recentSales.map((sale) => (
              <div
                key={sale.id}
                className="flex items-center justify-between py-2 px-3 rounded-lg bg-surface-700/50 hover:bg-surface-700 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-500 font-mono w-6 text-right">#{sale.id}</span>
                  <span className="text-sm text-gray-300">{sale.quantity}x</span>
                  <span className="text-sm text-gray-100">Product #{sale.product_id}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-emerald-400">
                    ${(sale.quantity * sale.unit_price_at_sale).toFixed(2)}
                  </span>
                  <span className="text-xs text-gray-500">
                    {new Date(sale.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
