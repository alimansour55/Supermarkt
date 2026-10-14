import { randomUUID } from 'node:crypto';

/** Tag every request with an id (honouring an upstream X-Request-Id) and echo it back. */
export const requestId = (req, res, next) => {
  const incoming = req.get('x-request-id');
  req.id = incoming && /^[\w.-]{1,128}$/.test(incoming) ? incoming : randomUUID();
  res.set('X-Request-Id', req.id);
  next();
};
