const clients = new Set()

export function addEventClient(res) {
  clients.add(res)
  res.write(`event: connected\ndata: ${JSON.stringify({ ok: true })}\n\n`)

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

  for (const client of clients) {
    client.write(`event: ${type}\ndata: ${JSON.stringify(event)}\n\n`)
  }
}
