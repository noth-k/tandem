import { demoSeller } from './demoData.js'
import { publishEvent } from './eventBus.js'
import { extractAudioIntent } from './openaiService.js'
import {
  findProductById,
  getCurrentProduct,
  getLatestDiscount,
  isDynamoEnabled,
  listProducts,
  saveDiscount,
  setCurrentProduct
} from './productRepository.js'
import { addActiveDiscount, getStreamState, setActiveProduct } from './streamState.js'

export async function getAudioState(streamId = demoSeller.streamId) {
  const memoryState = getStreamState(streamId)
  const currentProduct = await getCurrentProduct()
  const fallbackProduct = memoryState.activeProductId
    ? await findProductById(memoryState.activeProductId)
    : (await listProducts()).find((product) => product.isCurrent) ?? null
  const activeProduct = currentProduct ?? fallbackProduct
  const latestMemoryDiscount = [...memoryState.activeDiscounts]
    .sort((a, b) => getDiscountTimestamp(b) - getDiscountTimestamp(a))[0] ?? null
  const latestDiscount = await getLatestDiscount() ?? latestMemoryDiscount

  return {
    ...memoryState,
    source: isDynamoEnabled() ? 'dynamodb' : 'memory',
    activeProductId: activeProduct?.productId ?? memoryState.activeProductId,
    activeProduct,
    latestDiscount
  }
}

export async function interpretTranscript({ transcript, streamId = demoSeller.streamId }) {
  const state = await getAudioState(streamId)
  const products = await listProducts()
  if (products.length === 0) {
    const err = new Error('No products available for audio intent classification')
    err.statusCode = 502
    err.code = 'products_empty'
    throw err
  }
  const intent = await extractAudioIntent({
    transcript,
    products,
    activeProductId: state.activeProductId
  })
  validateIntentAgainstCatalog(intent, products)

  const result = {
    transcript,
    intent,
    action: null,
    state: await getAudioState(streamId)
  }

  if (intent.intent === 'change_product' && intent.productId) {
    const product = await findProductById(intent.productId)
    if (product) {
      const persistence = await setCurrentProduct(product.productId)
      const state = setActiveProduct(product.productId, streamId)
      const activeProduct = await getCurrentProduct() ?? product
      result.action = {
        type: 'productChanged',
        product,
        activeProduct,
        persistence,
        streamId,
        updatedAt: state.updatedAt,
        requestedAction: 'activeProductChanged'
      }
      result.state = await getAudioState(streamId)
      publishEvent('productChanged', result.action)
    }
  }

  if (intent.intent === 'apply_discount' && intent.productId && intent.discountType && intent.discountAmount != null) {
    const product = await findProductById(intent.productId)
    if (product) {
      const discount = {
        id: `discount_${Date.now()}`,
        productId: product.productId,
        productName: product.name,
        discountType: intent.discountType,
        discountAmount: intent.discountAmount,
        currency: intent.currency ?? product.currency,
        durationSeconds: intent.durationSeconds,
        startAt: Date.now(),
        sellerTranscript: transcript,
        parseConfidence: intent.confidence,
        sourcePlatform: 'browser-demo'
      }
      const persistence = await saveDiscount(discount)
      const { state, discount: activeDiscount } = addActiveDiscount(discount, streamId)
      const latestDiscount = await getLatestDiscount() ?? activeDiscount
      result.action = {
        type: 'discountChanged',
        product,
        discount: activeDiscount,
        latestDiscount,
        persistence,
        streamId,
        updatedAt: state.updatedAt,
        requestedAction: 'discountApplied'
      }
      result.state = await getAudioState(streamId)
      publishEvent('discountChanged', result.action)
    }
  }

  publishEvent('transcriptInterpreted', result)
  return result
}

function getDiscountTimestamp(discount) {
  if (discount.startAt != null) return Number(discount.startAt) || 0
  if (discount.appliedAt) return Date.parse(discount.appliedAt) || 0
  return 0
}

function validateIntentAgainstCatalog(intent, products) {
  if (intent.intent === 'spam') return

  const product = products.find((item) => item.productId === intent.productId)
  if (!product) {
    const err = new Error(`LLM returned unknown productId '${intent.productId}'`)
    err.statusCode = 422
    err.code = 'unknown_product'
    throw err
  }

  intent.productName = product.name

  if (intent.intent === 'apply_discount' && (!intent.discountType || intent.discountAmount == null)) {
    const err = new Error('LLM returned apply_discount without discountType or discountAmount')
    err.statusCode = 422
    err.code = 'invalid_discount_intent'
    throw err
  }
}
