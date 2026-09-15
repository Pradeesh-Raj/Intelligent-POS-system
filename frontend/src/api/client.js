import axios from 'axios'
import {
  mockGetInventory,
  mockGetProducts,
  mockCreateProduct,
  mockCreateBatch,
  mockLogReturn,
  mockRecordSale,
  mockGetSales,
  mockGetRecommendations,
  mockGetReorders,
  mockGetDiscounts,
  mockGetAlerts
} from './mockData'

const baseURL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}`
  : '/api'

const api = axios.create({
  baseURL,
  timeout: 5000,
  headers: { 'Content-Type': 'application/json' },
})

/**
 * Helper wrapper to handle API requests with automatic offline/mock fallback.
 * This guarantees the frontend works 100% standalone without needing a backend server!
 */
async function callApi(apiFunc, mockFunc) {
  // If explicitly requested mock mode via env var, use mock directly
  if (import.meta.env.VITE_USE_MOCK === 'true') {
    return { data: mockFunc() }
  }

  try {
    return await apiFunc()
  } catch (err) {
    return { data: mockFunc() }
  }
}

// ── Inventory ──────────────────────────────────────────────────────────────────
export const getInventory = () =>
  callApi(() => api.get('/inventory/'), () => mockGetInventory())

export const getProducts = () =>
  callApi(() => api.get('/inventory/products'), () => mockGetProducts())

export const createProduct = (data) =>
  callApi(() => api.post('/inventory/products', data), () => mockCreateProduct(data))

export const createBatch = (data) =>
  callApi(() => api.post('/inventory/batches', data), () => mockCreateBatch(data))

export const logReturn = (data) =>
  callApi(() => api.post('/inventory/returns', data), () => mockLogReturn(data))

// ── Sales ─────────────────────────────────────────────────────────────────────
export const recordSale = async (sku, qty) => {
  if (import.meta.env.VITE_USE_MOCK === 'true') {
    return { data: mockRecordSale(sku, qty) }
  }
  try {
    return await api.post('/sales/', { sku, quantity: qty })
  } catch (err) {
    if (!err.response) {
      // Backend server is offline -> fallback to local FEFO mock recordSale
      return { data: mockRecordSale(sku, qty) }
    }
    // Backend returned specific error (e.g. Insufficient stock) -> rethrow for UI message
    throw err
  }
}

export const getSales = (limit = 100) =>
  callApi(() => api.get(`/sales/?limit=${limit}`), () => mockGetSales(limit))

// ── Recommendations ────────────────────────────────────────────────────────────
export const getRecommendations = () =>
  callApi(() => api.get('/recommendations/'), () => mockGetRecommendations())

export const getReorders = () =>
  callApi(
    () => api.get('/recommendations/reorder'),
    () => mockGetRecommendations().reorder
  )

export const getDiscounts = () =>
  callApi(
    () => api.get('/recommendations/discounts'),
    () => mockGetRecommendations().discounts
  )

// ── Alerts ────────────────────────────────────────────────────────────────────
export const getAlerts = (limit = 50) =>
  callApi(() => api.get(`/alerts/?limit=${limit}`), () => mockGetAlerts(limit))

export default api
