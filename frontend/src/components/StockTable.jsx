import { AlertTriangle, Clock } from 'lucide-react'

/**
 * Renders the inventory table with color-coded expiry dates and batch breakdown.
 * Red   = expires in <= 3 days
 * Amber = expires in <= 7 days
 * Green = expires in > 7 days
 * Gray  = no expiry date
 */
export default function StockTable({ products = [], loading = false }) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="h-16 rounded-xl bg-surface-700 animate-pulse"
            style={{ animationDelay: `${i * 100}ms` }}
          />
        ))}
      </div>
    )
  }

  if (!products.length) {
    return (
      <div className="text-center py-12 text-gray-500">
        No products found. Run the seed script to populate inventory.
      </div>
    )
  }

  const expiryClass = (days) => {
    if (days == null)  return 'expiry-none'
    if (days <= 3)     return 'expiry-critical'
    if (days <= 7)     return 'expiry-warning'
    return 'expiry-ok'
  }

  const expiryBadge = (days) => {
    if (days == null)  return <span className="badge-gray">No expiry</span>
    if (days <= 0)     return <span className="badge-red flex items-center gap-1"><AlertTriangle size={10}/> Expired</span>
    if (days <= 3)     return <span className="badge-red">{days}d left</span>
    if (days <= 7)     return <span className="badge-yellow">{days}d left</span>
    return <span className="badge-green">{days}d left</span>
  }

  const categoryColor = (cat) => ({
    fast_moving: 'badge-blue',
    slow_moving: 'badge-gray',
    perishable:  'badge-yellow',
  }[cat] || 'badge-gray')

  return (
    <div className="overflow-x-auto rounded-xl border border-surface-700">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-surface-700 bg-surface-800">
            <th className="px-4 py-3 text-left text-gray-400 font-medium">Product</th>
            <th className="px-4 py-3 text-left text-gray-400 font-medium">SKU</th>
            <th className="px-4 py-3 text-left text-gray-400 font-medium">Category</th>
            <th className="px-4 py-3 text-right text-gray-400 font-medium">Total Stock</th>
            <th className="px-4 py-3 text-left text-gray-400 font-medium">Batches</th>
          </tr>
        </thead>
        <tbody>
          {products.map((product, idx) => (
            <tr
              key={product.product_id}
              className={`border-b border-surface-700/50 hover:bg-surface-700/30 transition-colors duration-150 animate-fade-in`}
              style={{ animationDelay: `${idx * 40}ms` }}
            >
              <td className="px-4 py-3">
                <span className="font-medium text-gray-100">{product.name}</span>
              </td>
              <td className="px-4 py-3">
                <code className="text-brand-400 font-mono text-xs bg-brand-500/10 px-2 py-0.5 rounded">
                  {product.sku}
                </code>
              </td>
              <td className="px-4 py-3">
                <span className={categoryColor(product.category)}>
                  {product.category.replace('_', ' ')}
                </span>
              </td>
              <td className="px-4 py-3 text-right">
                <span className={`font-bold text-lg ${product.total_quantity < 10 ? 'text-red-400' : 'text-white'}`}>
                  {product.total_quantity}
                </span>
                <span className="text-gray-500 text-xs ml-1">units</span>
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-2">
                  {product.batches.length === 0 ? (
                    <span className="text-gray-500 text-xs">No stock</span>
                  ) : (
                    product.batches.map((batch) => (
                      <div
                        key={batch.batch_id}
                        className="flex items-center gap-2 bg-surface-700/60 border border-surface-600 rounded-lg px-3 py-1.5 text-xs"
                      >
                        <span className="text-gray-300 font-medium">{batch.quantity} units</span>
                        <span className="text-gray-600">•</span>
                        {expiryBadge(batch.days_to_expiry)}
                        {batch.current_discount_pct > 0 && (
                          <>
                            <span className="text-gray-600">•</span>
                            <span className="text-emerald-400 font-semibold">{batch.current_discount_pct}% off</span>
                          </>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
