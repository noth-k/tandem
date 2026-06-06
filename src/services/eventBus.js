const clients = new Set()
const latestEventsByType = new Map()
const replayEventTypes = new Set(['productChanged', 'discountChanged'])

export function addEventClient(res) {
  clients.add(res)
  res.write(`event: connected\ndata: ${JSON.stringify({ ok: true })}\n\n`)
  for (const type of replayEventTypes) {
    const event = latestEventsByType.get(type)
    if (event) {
      res.write(`event: ${type}\ndata: ${JSON.stringify(event)}\n\n`)
    }
  }

  return () => {
    clients.delete(res)
  }
}

export function publishEvent(type, payload) {
  const event = {
    type,
    payload,
    timestamp: new Date().toISOString()
  }

  if (replayEventTypes.has(type)) {
    latestEventsByType.set(type, event)
  }

  for (const client of clients) {
    client.write(`event: ${type}\ndata: ${JSON.stringify(event)}\n\n`)
  }
}
