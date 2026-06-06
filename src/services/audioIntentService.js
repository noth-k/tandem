import { randomUUID } from 'node:crypto'

import { demoSeller } from './demoData.js'
import { publishEvent } from './eventBus.js'
import { extractAudioIntent } from './openaiService.js'
import {
  findProductById,
  getCurrentProduct,
  getLatestDiscount,
  isDynamoEnabled,
  listProducts
} from './productRepository.js'
import { sendProductDetailsMessageToQueue } from './sqsService.js'
import { getStreamState } from './streamState.js'

export async function getAudioState(streamId = demoSeller.streamId) {
  const memoryState = getStreamState(streamId)
  const currentProduct = await getCurrentProduct()
  const fallbackProduct = memoryState.activeProductId
    ? await findProductById(memoryState.activeProductId)
    : (await listProducts()).find((product) => product.isCurrent) ?? null
  const activeProduct = currentProduct ?? fallbackProduct
  const latestDiscount = await getLatestDiscount()

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
      const message = buildProductDetailsQueueMessage({
        eventType: 'audio.change_product',
        streamId,
        transcript,
        intent,
        product
      })
      const queued = await sendProductDetailsMessageToQueue(message)
      result.action = {
        type: 'productUpdateQueued',
        queued,
        message,
        product,
        requestedAction: 'activeProductChanged'
      }
      publishEvent('productUpdateQueued', result.action)
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
      const message = buildProductDetailsQueueMessage({
        eventType: 'audio.apply_discount',
        streamId,
        transcript,
        intent,
        product,
        discount
      })
      const queued = await sendProductDetailsMessageToQueue(message)
      result.action = {
        type: 'productUpdateQueued',
        queued,
        message,
        product,
        discount,
        requestedAction: 'discountApplied'
      }
      publishEvent('productUpdateQueued', result.action)
    }
  }

  publishEvent('transcriptInterpreted', result)
  return result
}

function buildProductDetailsQueueMessage({
  eventType,
  streamId,
  transcript,
  intent,
  product,
  discount
}) {
  const createdAt = new Date().toISOString()

  return {
    schemaVersion: 1,
    eventId: randomUUID(),
    eventType,
    source: 'tandem-backend.audio-parser',
    streamId,
    createdAt,
    transcript,
    intent,
    product: {
      productId: product.productId,
      productName: product.name,
      sku: product.sku ?? null,
      price: product.price,
      currency: product.currency
    },
    discount: discount ?? null
  }
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
