import { demoSeller } from './demoData.js'

const states = new Map()

export function getStreamState(streamId = demoSeller.streamId) {
  if (!states.has(streamId)) {
    states.set(streamId, {
      streamId,
      activeProductId: null,
      activeDiscounts: [],
      updatedAt: new Date().toISOString()
    })
  }

  return states.get(streamId)
}

export function setActiveProduct(productId, streamId = demoSeller.streamId) {
  const state = getStreamState(streamId)
  state.activeProductId = productId
  state.updatedAt = new Date().toISOString()
  return state
}

export function addActiveDiscount(discount, streamId = demoSeller.streamId) {
  const state = getStreamState(streamId)
  const next = {
    ...discount,
    id: discount.id ?? `discount_${Date.now()}`,
    appliedAt: discount.appliedAt ?? new Date().toISOString()
  }

  state.activeDiscounts = [
    ...state.activeDiscounts.filter((item) => item.id !== next.id),
    next
  ]
  state.updatedAt = new Date().toISOString()
  return { state, discount: next }
}
