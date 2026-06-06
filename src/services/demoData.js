export const demoSeller = {
  id: 'seller_001',
  handle: '@tandem-live',
  platform: 'demo',
  streamId: 'stream_demo_001'
}

export const demoProducts = [
  {
    id: 'serum',
    name: 'Hyaluronic Glow Serum 30ml',
    isCurrent: true,
    price: 12.9,
    currency: 'USD',
    stockQty: 38
  },
  {
    id: 'lip',
    name: 'Velvet Matte Lip Tint — Rosewood',
    isCurrent: false,
    price: 6.5,
    currency: 'USD',
    stockQty: 120
  },
  {
    id: 'shirt',
    name: 'Oversized Linen Shirt — Sand',
    isCurrent: false,
    price: 18,
    currency: 'USD',
    stockQty: 11
  },
  {
    id: 'clip',
    name: 'Ceramic Hair Claw Clip',
    isCurrent: false,
    price: 3.2,
    currency: 'USD',
    stockQty: 240
  },
  {
    id: 'spf',
    name: 'Daily SPF50 Sunscreen Gel',
    isCurrent: false,
    price: 9.9,
    currency: 'USD',
    stockQty: 64
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
