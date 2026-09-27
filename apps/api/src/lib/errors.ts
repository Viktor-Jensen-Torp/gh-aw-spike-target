import type { FastifyInstance } from 'fastify';
import type { ErrorResponse } from '@tempo/shared/errors';

/** An error with an HTTP status and a message safe to show to a person. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

/** Every error leaves the API in one shape: `{ error: { code, message } }` (api.md). */
export function registerErrorHandling(app: FastifyInstance): void {
  app.setNotFoundHandler((_request, reply) => {
    const body: ErrorResponse = {
      error: { code: 'not_found', message: 'Not found.' },
    };
    void reply.status(404).send(body);
  });
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ApiError) {
      const body: ErrorResponse = {
        error: { code: error.code, message: error.message },
      };
      return reply.status(error.status).send(body);
    }
    if (isValidationError(error)) {
      const body: ErrorResponse = {
        error: { code: 'invalid', message: error.message },
      };
      return reply.status(400).send(body);
    }
    app.log.error(error);
    const body: ErrorResponse = {
      error: { code: 'internal', message: 'Something went wrong.' },
    };
    return reply.status(500).send(body);
  });
}

function isValidationError(
  error: unknown,
): error is Error & { validation: unknown } {
  return (
    error instanceof Error && 'validation' in error && Boolean(error.validation)
  );
}
