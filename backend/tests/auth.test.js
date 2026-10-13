import mongoose from 'mongoose';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import app from '../src/app.js';
import User from '../src/models/User.js';
import { generateToken } from '../src/utils/generateToken.js';

async function insertCustomer(fields = {}) {
  const _id = new mongoose.Types.ObjectId();
  await User.collection.insertOne({
    _id, name: 'Test', phone: '01000000001', role: 'customer', isActive: true, ...fields,
  });
  return _id;
}

describe('protect middleware', () => {
  it('lets an active user through', async () => {
    const id = await insertCustomer();

    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${generateToken(id)}`);

    expect(res.status).toBe(200);
  });

  it('rejects a deactivated user even with an unexpired token', async () => {
    const id = await insertCustomer();
    const token = generateToken(id);
    await User.updateOne({ _id: id }, { isActive: false });

    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(401);
  });

  it('rejects a request without a token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });
});
