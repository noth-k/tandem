import { demoSeller } from './demoData.js'
import { publishEvent } from './eventBus.js'
import { extractAudioIntent } from './openaiService.js'
import {
  findProductById,
  getCurrentProduct,
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

  return {
    ...memoryState,
    source: isDynamoEnabled() ? 'dynamodb' : 'memory',
    activeProductId: activeProduct?.productId ?? memoryState.activeProductId,
    activeProduct
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
      const saved = await setCurrentProduct(product.productId)
      setActiveProduct(product.productId, streamId)
      result.state = await getAudioState(streamId)
      result.action = {
        type: 'activeProductChanged',
        product,
        saved
      }
      publishEvent('activeProductChanged', result.action)
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
      const saved = await saveDiscount(discount)
      const active = addActiveDiscount({ ...discount, saved }, streamId)

      result.state = await getAudioState(streamId)
      result.action = {
        type: 'discountApplied',
        product,
        discount: active.discount
      }
      publishEvent('discountApplied', result.action)
    }
  }

  publishEvent('transcriptInterpreted', result)
  return result
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
