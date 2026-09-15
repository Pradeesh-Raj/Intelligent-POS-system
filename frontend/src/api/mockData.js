/**
 * Standalone Mock Data & In-Browser Database for IntelliPOS
 * Persists changes to localStorage so user actions (sales, inventory additions, returns) work dynamically.
 */

const STORAGE_KEY = 'intellipos_mock_db_v1'

const initialSeed = {
  products: [
    {
      product_id: 1,
      name: 'Fresh Whole Milk 1L',
      sku: 'FM-001',
      category: 'perishable',
      unit_price: 3.50,
      cost_price: 2.10,
      min_stock_level: 15,
      batches: [
        { batch_id: 101, product_id: 1, batch_code: 'B-FM-001', quantity: 12, expiry_days_offset: 3, current_discount_pct: 20 },
        { batch_id: 102, product_id: 1, batch_code: 'B-FM-002', quantity: 35, expiry_days_offset: 10, current_discount_pct: 0 }
      ]
    },
    {
      product_id: 2,
      name: 'Greek Yogurt 500g',
      sku: 'FM-002',
      category: 'perishable',
      unit_price: 4.20,
      cost_price: 2.50,
      min_stock_level: 10,
      batches: [
        { batch_id: 201, product_id: 2, batch_code: 'B-GY-001', quantity: 8, expiry_days_offset: 2, current_discount_pct: 30 },
        { batch_id: 202, product_id: 2, batch_code: 'B-GY-002', quantity: 20, expiry_days_offset: 14, current_discount_pct: 0 }
      ]
    },
    {
      product_id: 3,
      name: 'Whole Wheat Bread 400g',
      sku: 'PR-001',
      category: 'fast_moving',
      unit_price: 2.80,
      cost_price: 1.60,
      min_stock_level: 20,
      batches: [
        { batch_id: 301, product_id: 3, batch_code: 'B-WB-001', quantity: 15, expiry_days_offset: 5, current_discount_pct: 15 },
        { batch_id: 302, product_id: 3, batch_code: 'B-WB-002', quantity: 30, expiry_days_offset: 12, current_discount_pct: 0 }
      ]
    },
    {
      product_id: 4,
      name: 'Organic Free-Range Eggs 12pk',
      sku: 'PR-002',
      category: 'fast_moving',
      unit_price: 5.50,
      cost_price: 3.40,
      min_stock_level: 12,
      batches: [
        { batch_id: 401, product_id: 4, batch_code: 'B-EG-001', quantity: 5, expiry_days_offset: 4, current_discount_pct: 10 },
        { batch_id: 402, product_id: 4, batch_code: 'B-EG-002', quantity: 25, expiry_days_offset: 18, current_discount_pct: 0 }
      ]
    },
    {
      product_id: 5,
      name: 'Classic Potato Chips 150g',
      sku: 'SM-001',
      category: 'slow_moving',
      unit_price: 1.99,
      cost_price: 1.10,
      min_stock_level: 8,
      batches: [
        { batch_id: 501, product_id: 5, batch_code: 'B-PC-001', quantity: 6, expiry_days_offset: 45, current_discount_pct: 0 }
      ]
    },
    {
      product_id: 6,
      name: 'Dark Chocolate Bar 70% 100g',
      sku: 'SM-002',
      category: 'slow_moving',
      unit_price: 3.00,
      cost_price: 1.70,
      min_stock_level: 10,
      batches: [
        { batch_id: 601, product_id: 6, batch_code: 'B-DC-001', quantity: 4, expiry_days_offset: 60, current_discount_pct: 0 }
      ]
    }
  ],
  sales: [
    { id: 104, product_id: 4, sku: 'PR-002', quantity: 2, unit_price_at_sale: 5.50, timestamp: new Date(Date.now() - 7200000).toISOString() },
    { id: 103, product_id: 2, sku: 'FM-002', quantity: 3, unit_price_at_sale: 4.20, timestamp: new Date(Date.now() - 3600000).toISOString() },
    { id: 102, product_id: 3, sku: 'PR-001', quantity: 1, unit_price_at_sale: 2.80, timestamp: new Date(Date.now() - 1500000).toISOString() },
    { id: 101, product_id: 1, sku: 'FM-001', quantity: 2, unit_price_at_sale: 3.50, timestamp: new Date(Date.now() - 600000).toISOString() }
  ],
  returns: []
}

function loadDB() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch (e) {
    console.warn('Failed to load mock DB from localStorage:', e)
  }
  saveDB(initialSeed)
  return initialSeed
}

function saveDB(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch (e) {
    console.error('Failed to save mock DB to localStorage:', e)
  }
}

export function resetMockData() {
  saveDB(initialSeed)
  return initialSeed
}

// Helper: Calculate enriched inventory structure matching FastAPI schema
export function mockGetInventory() {
  const db = loadDB()
  const today = new Date()

  return db.products.map(p => {
    // Calculate days to expiry dynamically from offset
    const enrichedBatches = (p.batches || []).map(b => {
      const days = b.expiry_days_offset != null ? b.expiry_days_offset : null
      const expDate = days != null ? new Date(today.getTime() + days * 86400000).toISOString().split('T')[0] : null
      return {
        batch_id: b.batch_id,
        product_id: p.product_id,
        batch_code: b.batch_code,
        quantity: b.quantity,
        expiry_date: expDate,
        days_to_expiry: days,
        current_discount_pct: b.current_discount_pct || 0
      }
    })

    const total_quantity = enrichedBatches.reduce((acc, b) => acc + b.quantity, 0)

    return {
      product_id: p.product_id,
      name: p.name,
      sku: p.sku,
      category: p.category,
      unit_price: p.unit_price,
      cost_price: p.cost_price,
      min_stock_level: p.min_stock_level,
      total_quantity,
      batches: enrichedBatches
    }
  })
}

export function mockGetProducts() {
  return mockGetInventory()
}

export function mockCreateProduct(productData) {
  const db = loadDB()
  const newId = db.products.length ? Math.max(...db.products.map(p => p.product_id)) + 1 : 1
  const newProduct = {
    product_id: newId,
    name: productData.name,
    sku: productData.sku.toUpperCase(),
    category: productData.category || 'fast_moving',
    unit_price: parseFloat(productData.unit_price) || 0,
    cost_price: parseFloat(productData.cost_price) || 0,
    min_stock_level: parseInt(productData.min_stock_level) || 10,
    batches: []
  }
  db.products.push(newProduct)
  saveDB(db)
  return newProduct
}

export function mockCreateBatch(batchData) {
  const db = loadDB()
  const product = db.products.find(p => p.product_id === parseInt(batchData.product_id))
  if (!product) throw new Error('Product not found')

  const newBatchId = Math.floor(Math.random() * 9000) + 1000
  const daysOffset = batchData.expiry_date 
    ? Math.round((new Date(batchData.expiry_date) - new Date()) / 86400000)
    : 30

  const newBatch = {
    batch_id: newBatchId,
    product_id: product.product_id,
    batch_code: batchData.batch_code || `B-${product.sku}-${newBatchId}`,
    quantity: parseInt(batchData.quantity) || 0,
    expiry_days_offset: daysOffset,
    current_discount_pct: 0
  }

  product.batches.push(newBatch)
  saveDB(db)
  return newBatch
}

export function mockLogReturn(returnData) {
  const db = loadDB()
  db.returns.push({
    ...returnData,
    timestamp: new Date().toISOString()
  })

  if (returnData.batch_id) {
    for (const p of db.products) {
      const b = p.batches.find(b => b.batch_id === parseInt(returnData.batch_id))
      if (b) {
        b.quantity = Math.max(0, b.quantity - (parseInt(returnData.quantity) || 1))
        break
      }
    }
  }
  saveDB(db)
  return { status: 'logged', return: returnData }
}

export function mockRecordSale(sku, qty) {
  const db = loadDB()
  const product = db.products.find(p => p.sku.toUpperCase() === sku.toUpperCase())

  if (!product) {
    throw { response: { data: { detail: `Product with SKU '${sku}' not found.` } } }
  }

  const totalStock = product.batches.reduce((sum, b) => sum + b.quantity, 0)
  if (totalStock < qty) {
    throw { response: { data: { detail: `Insufficient stock for ${product.name} (SKU: ${product.sku}). Available: ${totalStock}, Requested: ${qty}` } } }
  }

  // FEFO Sorting
  const availableBatches = [...product.batches]
    .filter(b => b.quantity > 0)
    .sort((a, b) => (a.expiry_days_offset ?? 999) - (b.expiry_days_offset ?? 999))

  let remainingToDeduct = qty
  for (const batch of availableBatches) {
    if (remainingToDeduct <= 0) break
    const deduct = Math.min(batch.quantity, remainingToDeduct)
    batch.quantity -= deduct
    remainingToDeduct -= deduct
  }

  const newSaleId = db.sales.length ? Math.max(...db.sales.map(s => s.id)) + 1 : 101
  const saleRecord = {
    id: newSaleId,
    product_id: product.product_id,
    sku: product.sku,
    quantity: qty,
    unit_price_at_sale: product.unit_price,
    timestamp: new Date().toISOString()
  }

  db.sales.unshift(saleRecord)
  saveDB(db)

  return [saleRecord]
}

export function mockGetSales(limit = 100) {
  const db = loadDB()
  return db.sales.slice(0, limit)
}

export function mockGetRecommendations() {
  const inventory = mockGetInventory()
  const todayIso = new Date().toISOString()

  // Reorders
  const reorders = inventory.map(p => {
    const isLow = p.total_quantity < p.min_stock_level
    const predicted = isLow ? Math.max(20, p.min_stock_level * 2) : Math.round(p.total_quantity * 0.4)
    const recQty = isLow ? Math.max(10, p.min_stock_level * 2 - p.total_quantity) : 0

    let reason = ''
    if (isLow) {
      reason = `Current stock (${p.total_quantity} units) is below safety threshold (${p.min_stock_level} units). Reorder ${recQty} units to prevent stockout.`
    } else {
      reason = `Stock level (${p.total_quantity} units) is optimal. Predicted 7-day demand is ${predicted} units.`
    }

    return {
      id: `rec-reorder-${p.product_id}`,
      product_id: p.product_id,
      name: p.name,
      sku: p.sku,
      current_stock: p.total_quantity,
      recommended_qty: recQty,
      predicted_demand_7d: predicted,
      reasoning_text: reason,
      generated_at: todayIso
    }
  })

  // Discounts
  const discounts = []
  inventory.forEach(p => {
    p.batches.forEach(b => {
      if (b.days_to_expiry != null && b.days_to_expiry <= 7 && b.quantity > 0) {
        let recPct = 20
        if (b.days_to_expiry <= 2) recPct = 40
        else if (b.days_to_expiry <= 4) recPct = 30

        discounts.push({
          id: `rec-disc-${b.batch_id}`,
          batch_id: b.batch_id,
          product_id: p.product_id,
          product_name: p.name,
          sku: p.sku,
          quantity: b.quantity,
          days_to_expiry: b.days_to_expiry,
          old_discount_pct: b.current_discount_pct || 0,
          new_discount_pct: recPct,
          reasoning_text: `Batch #${b.batch_id} (${b.quantity} units) expires in ${b.days_to_expiry} day(s). Recommended ${recPct}% discount via contextual bandit to clear stock before expiration.`,
          timestamp: todayIso
        })
      }
    })
  })

  return {
    reorder: reorders,
    discounts: discounts
  }
}

export function mockGetReorders() {
  return mockGetRecommendations().reorder
}

export function mockGetDiscounts() {
  return mockGetRecommendations().discounts
}

export function mockGetAlerts(limit = 50) {
  const recs = mockGetRecommendations()
  const alerts = []

  recs.reorder.filter(r => r.recommended_qty > 0).forEach(r => {
    alerts.push({
      id: `alert-${r.id}`,
      alert_type: 'reorder',
      title: `Low Stock Reorder Alert: ${r.name}`,
      reasoning_text: r.reasoning_text,
      timestamp: r.generated_at
    })
  })

  recs.discounts.forEach(d => {
    alerts.push({
      id: `alert-${d.id}`,
      alert_type: 'discount',
      title: `${d.new_discount_pct}% Expiry Discount: ${d.product_name}`,
      reasoning_text: d.reasoning_text,
      timestamp: d.timestamp
    })
  })

  return alerts.slice(0, limit)
}
