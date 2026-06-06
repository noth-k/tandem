export const demoSeller = {
  id: 'seller_001',
  handle: '@tandem-live',
  platform: 'demo',
  streamId: 'stream_demo_001'
}

export const demoProducts = [
  {
    id: 'lip_tint',
    name: 'Velvet Lip Tint',
    price: 1490,
    currency: 'USD',
    stockQty: 82
  },
  {
    id: 'cleanser',
    name: 'Rice Cloud Cleanser',
    price: 2200,
    currency: 'USD',
    stockQty: 44
  },
  {
    id: 'serum',
    name: 'Barrier Repair Serum',
    price: 3400,
    currency: 'USD',
    stockQty: 19
  }
]

export const demoEvents = [
  {
    id: 'evt_001',
    type: 'chat',
    at: 1200,
    buyer: 'mia',
    message: 'Is the lip tint transfer proof?',
    product: 'lip_tint'
  },
  {
    id: 'evt_002',
    type: 'speech',
    at: 3600,
    transcript: 'For the next five minutes, take ten percent off the cleanser.'
  },
  {
    id: 'evt_003',
    type: 'chat',
    at: 5200,
    buyer: 'jo',
    message: 'I want two serums if you still have stock',
    product: 'serum'
  }
]
