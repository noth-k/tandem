export function notFoundHandler(req, res) {
  res.status(404).json({
    error: 'not_found',
    message: `No route found for ${req.method} ${req.originalUrl}`
  })
}

export function errorHandler(err, _req, res, _next) {
  const status = err.statusCode ?? 500

  if (status >= 500) {
    console.error(err)
  }

  res.status(status).json({
    error: err.code ?? 'internal_error',
    message: err.message ?? 'Unexpected server error'
  })
}
