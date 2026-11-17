import type { FastifyError, FastifyInstance } from 'fastify';

export interface ErrorResponse {
  error: {
    code: string;
    message: string;
  };
}

const INTERNAL_ERROR: ErrorResponse = {
  error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
};

function clientErrorCode(statusCode: number): string {
  switch (statusCode) {
    case 400:
      return 'VALIDATION_ERROR';
    case 401:
      return 'UNAUTHORIZED';
    case 403:
      return 'FORBIDDEN';
    case 404:
      return 'NOT_FOUND';
    case 409:
      return 'CONFLICT';
    case 422:
      return 'UNPROCESSABLE_ENTITY';
    case 429:
      return 'RATE_LIMITED';
    default:
      return 'REQUEST_ERROR';
  }
}

export function registerErrorHandlers(app: FastifyInstance): void {
  app.setNotFoundHandler((_request, reply) => {
    return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Route not found' } });
  });

  app.setErrorHandler((error: FastifyError, request, reply) => {
    const statusCode = error.statusCode ?? 500;

    if (statusCode >= 500) {
      request.log.error({ err: error }, 'request failed');
      return reply.code(500).send(INTERNAL_ERROR);
    }

    request.log.warn({ err: error }, 'request rejected');

    if (statusCode === 400) {
      return reply
        .code(400)
        .send({ error: { code: 'VALIDATION_ERROR', message: 'Request validation failed' } });
    }

    return reply
      .code(statusCode)
      .send({ error: { code: clientErrorCode(statusCode), message: error.message } });
  });
}
