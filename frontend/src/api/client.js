import axios from 'axios'

/**
 * API client.
 *
 * Local dev  : Vite proxies /api/* to http://localhost:8000 (see vite.config.js)
 *              so baseURL = '/api' works out of the box.
 *
 * Production : Set VITE_API_URL in Vercel to your Render backend URL, e.g.:
 *              VITE_API_URL=https://your-pos-backend.onrender.com
 *              The client will use that URL directly (no proxy needed in prod).
 */
const baseURL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}`   // e.g. https://your-backend.onrender.com
  : '/api'                               // local dev via Vite proxy

const api = axios.create({
  baseURL,
  timeout: 30000,   // Render free tier can be slow on cold start
  headers: { 'Content-Type': 'application/json' },
})

// ── Inventory ──────────────────────────────────────────────────────────────────
export const getInventory   = ()         => api.get('/inventory/')
export const getProducts    = ()         => api.get('/inventory/products')
export const createProduct  = (data)     => api.post('/inventory/products', data)
export const createBatch    = (data)     => api.post('/inventory/batches', data)
export const logReturn      = (data)     => api.post('/inventory/returns', data)

// ── Sales ─────────────────────────────────────────────────────────────────────
export const recordSale   = (sku, qty)  => api.post('/sales/', { sku, quantity: qty })
export const getSales     = (limit=100) => api.get(`/sales/?limit=${limit}`)

// ── Recommendations ────────────────────────────────────────────────────────────
export const getRecommendations = () => api.get('/recommendations/')
export const getReorders        = () => api.get('/recommendations/reorder')
export const getDiscounts       = () => api.get('/recommendations/discounts')

// ── Alerts ────────────────────────────────────────────────────────────────────
export const getAlerts = (limit=50) => api.get(`/alerts/?limit=${limit}`)

export default api
