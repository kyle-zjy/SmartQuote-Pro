import { Prisma } from '@prisma/client'
import type { ErrorRequestHandler, RequestHandler } from 'express'
import { ApiError } from './apiError.js'

/** Express 4 does not forward rejected async handlers to error middleware. */
export function asyncHandler(handler: RequestHandler): RequestHandler {
  return (req, res, next) => {
    Promise.resolve()
      .then(() => handler(req, res, next))
      .catch(next)
  }
}

export const errorHandler: ErrorRequestHandler = (error: unknown, _req, res, next) => {
  if (res.headersSent) {
    next(error)
    return
  }
  if (error instanceof ApiError) {
    res.status(error.status).json({ error: { code: error.code, message: error.message } })
    return
  }
  if ((error as { type?: string })?.type === 'entity.too.large') {
    res
      .status(413)
      .json({
        error: {
          code: 'TOO_LARGE',
          message: 'This upload is too large. Use smaller images or import fewer quotes at once.',
        },
      })
    return
  }
  if (error instanceof SyntaxError && 'body' in error) {
    res.status(400).json({ error: { code: 'INVALID_JSON', message: 'Invalid JSON request.' } })
    return
  }
  const unavailable =
    error instanceof Prisma.PrismaClientInitializationError ||
    (error instanceof Prisma.PrismaClientKnownRequestError &&
      ['P1001', 'P1002', 'P1008', 'P1017', 'P2024'].includes(error.code))
  // Log the category only: connection errors can contain database connection details.
  console.error('[server] request failed', unavailable ? 'DATABASE_UNAVAILABLE' : 'INTERNAL_ERROR')
  res.status(unavailable ? 503 : 500).json({
    error: {
      code: unavailable ? 'DATABASE_UNAVAILABLE' : 'INTERNAL_ERROR',
      message: unavailable
        ? 'Database is temporarily unavailable. Please try again.'
        : 'The request could not be completed.',
    },
  })
}
