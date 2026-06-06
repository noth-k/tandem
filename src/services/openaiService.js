const OPENAI_API_BASE = 'https://api.openai.com/v1'

export async function createRealtimeTranscriptionCall({ sdp }) {
  assertApiKey()

  const controller = new AbortController()
  const timeoutMs = Number.parseInt(process.env.REALTIME_SDP_TIMEOUT_MS ?? '45000', 10)
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  const formData = new FormData()
  formData.set('sdp', sdp)
  formData.set('session', JSON.stringify({
    type: 'transcription',
    audio: {
      input: {
        transcription: {
          model: process.env.REALTIME_TRANSCRIPTION_MODEL ?? 'gpt-realtime-whisper',
          language: 'en',
          delay: process.env.REALTIME_TRANSCRIPTION_DELAY ?? 'low'
        },
        turn_detection: null
      }
    }
  }))

  let response
  try {
    response = await fetch(`${OPENAI_API_BASE}/realtime/calls`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: formData,
      signal: controller.signal
    })
  } catch (error) {
    const err = new Error(error.name === 'AbortError'
      ? `OpenAI realtime SDP exchange timed out after ${Math.round(timeoutMs / 1000)}s`
      : `OpenAI realtime SDP exchange failed: ${error.message}`)
    err.statusCode = 504
    err.code = 'openai_realtime_timeout'
    throw err
  } finally {
    clearTimeout(timeout)
  }

  const body = await response.text()
  if (!response.ok) {
    const err = new Error(`OpenAI realtime call failed: ${summarizeOpenAIError(body)}`)
    err.statusCode = response.status
    err.code = 'openai_realtime_error'
    throw err
  }

  return body
}

export async function createRealtimeClientSecret() {
  assertApiKey()

  const response = await fetch(`${OPENAI_API_BASE}/realtime/client_secrets`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      session: {
        type: 'transcription',
        audio: {
          input: {
            transcription: {
              model: process.env.REALTIME_TRANSCRIPTION_MODEL ?? 'gpt-realtime-whisper',
              language: 'en',
              delay: process.env.REALTIME_TRANSCRIPTION_DELAY ?? 'low'
            },
            turn_detection: null
          }
        }
      }
    })
  })

  const data = await response.json()
  if (!response.ok) {
    const err = new Error(`OpenAI realtime client secret failed: ${JSON.stringify(data)}`)
    err.statusCode = response.status
    err.code = 'openai_realtime_secret_error'
    throw err
  }

  return data
}

function summarizeOpenAIError(body) {
  if (!body) return 'empty response body'

  try {
    const parsed = JSON.parse(body)
    return parsed.error?.message ?? JSON.stringify(parsed)
  } catch {
    const title = body.match(/<title>(.*?)<\/title>/is)?.[1]
    return title ? title.replace(/\s+/g, ' ').trim() : body.slice(0, 300)
  }
}

export async function extractAudioIntent({ transcript, products, activeProductId }) {
  assertApiKey()

  const response = await fetch(`${OPENAI_API_BASE}/responses`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: process.env.INTENT_MODEL ?? 'gpt-5-mini',
      input: [
        {
          role: 'system',
          content: [
            {
              type: 'input_text',
              text: [
                'You classify live-commerce seller speech.',
                'Return change_product only when the seller wants to switch the displayed product.',
                'Return apply_discount only when the seller wants to create a discount/coupon/price drop.',
                'Return spam for greetings, filler, product descriptions, jokes, and anything else.',
                'Use only the provided catalog to identify products.',
                'For change_product and apply_discount, productId and productName must exactly match one product from the catalog.',
                'For ambiguous "this product" or "this one" discounts, use activeProductId when present.',
                'If no product can be resolved from the catalog or activeProductId, return spam.',
                'The productId must be one of the provided productIds or null.'
              ].join(' ')
            }
          ]
        },
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: JSON.stringify({
                transcript,
                activeProductId,
                productCatalog: products.map((product) => ({
                  productId: product.productId,
                  productName: product.name,
                  sku: product.sku,
                  price: product.price,
                  currency: product.currency,
                  tags: product.tags ?? []
                }))
              })
            }
          ]
        }
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'audio_intent',
          strict: true,
          schema: audioIntentSchema
        }
      }
    })
  })

  const data = await response.json()
  if (!response.ok) {
    const err = new Error(`OpenAI intent extraction failed: ${JSON.stringify(data)}`)
    err.statusCode = response.status
    err.code = 'openai_intent_error'
    throw err
  }

  const outputText = data.output_text ?? data.output?.flatMap((item) => item.content ?? [])
    .find((content) => content.type === 'output_text')?.text

  if (!outputText) {
    const err = new Error('OpenAI intent extraction returned no output text')
    err.statusCode = 502
    err.code = 'openai_intent_empty'
    throw err
  }

  return JSON.parse(outputText)
}

function assertApiKey() {
  if (process.env.OPENAI_API_KEY) return

  const err = new Error('OPENAI_API_KEY is required for realtime audio')
  err.statusCode = 500
  err.code = 'missing_openai_api_key'
  throw err
}

const audioIntentSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    intent: {
      type: 'string',
      enum: ['change_product', 'apply_discount', 'spam']
    },
    productId: {
      type: ['string', 'null']
    },
    productName: {
      type: ['string', 'null']
    },
    discountType: {
      type: ['string', 'null'],
      enum: ['percent', 'fixed', null]
    },
    discountAmount: {
      type: ['number', 'null']
    },
    currency: {
      type: ['string', 'null']
    },
    durationSeconds: {
      type: ['number', 'null']
    },
    confidence: {
      type: 'number'
    },
    rawText: {
      type: 'string'
    }
  },
  required: [
    'intent',
    'productId',
    'productName',
    'discountType',
    'discountAmount',
    'currency',
    'durationSeconds',
    'confidence',
    'rawText'
  ]
}
