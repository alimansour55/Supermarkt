import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { asyncHandler, errorHandler } from '../src/middleware/errorHandler.js';
import { requestId } from '../src/middleware/requestId.js';
import { AppError } from '../src/utils/AppError.js';

function appThrowing(err) {
  const app = express();
  app.use(requestId);
  app.get('/boom', asyncHandler(async () => { throw err; }));
  app.use(errorHandler);
  return app;
}

describe('errorHandler', () => {
  const env = process.env.NODE_ENV;
  afterEach(() => { process.env.NODE_ENV = env; });

  it('hides unexpected 500 details in production and returns a request id', async () => {
    process.env.NODE_ENV = 'production';

    const res = await request(appThrowing(new Error('E11000 internal driver detail'))).get('/boom');

    expect(res.status).toBe(500);
    expect(res.body.message).not.toContain('E11000');
    expect(res.body.requestId).toBe(res.headers['x-request-id']);
  });

  it('keeps the message of an intentional AppError', async () => {
    process.env.NODE_ENV = 'production';

    const res = await request(appThrowing(new AppError('Stripe is not configured', 503))).get('/boom');

    expect(res.status).toBe(503);
    expect(res.body.message).toBe('Stripe is not configured');
  });

  it('honours an upstream X-Request-Id', async () => {
    const res = await request(appThrowing(new AppError('nope', 400))).get('/boom').set('X-Request-Id', 'abc-123');

    expect(res.headers['x-request-id']).toBe('abc-123');
  });
});
