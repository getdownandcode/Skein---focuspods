import { randomUUID } from 'node:crypto';
import type { IncomingMessage } from 'node:http';

// Incoming ids are logged and echoed back, so only accept a conservative character set.
const safeRequestId = /^[A-Za-z0-9._-]{1,128}$/;

export function getRequestId(request: IncomingMessage): string {
  const header = request.headers['x-request-id'];
  const value = Array.isArray(header) ? header[0] : header;

  if (typeof value === 'string' && safeRequestId.test(value)) {
    return value;
  }

  return randomUUID();
}
