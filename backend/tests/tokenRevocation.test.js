import mongoose from 'mongoose';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import app from '../src/app.js';
import User from '../src/models/User.js';
import { generateToken } from '../src/utils/generateToken.js';

async function insertUser(fields = {}) {
  const _id = new mongoose.Types.ObjectId();
  await User.collection.insertOne({
    _id, name: 'Test', phone: '01000000002', role: 'customer', isActive: true, tokenVersion: 0, ...fields,
  });
  return _id;
}

const me = (token) => request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);

describe('token revocation', () => {
  it('logout-all invalidates every previously issued token', async () => {
    const id = await insertUser();
    const phone = generateToken(id, 0);
    const laptop = generateToken(id, 0);

    expect((await request(app).post('/api/auth/logout-all').set('Authorization', `Bearer ${phone}`)).status).toBe(200);

    expect((await me(phone)).status).toBe(401);
    expect((await me(laptop)).status).toBe(401);
    expect((await me(generateToken(id, 1))).status).toBe(200);
  });

  it('keeps tokens issued before tokenVersion existed working', async () => {
    const id = await insertUser();
    await User.collection.updateOne({ _id: id }, { $unset: { tokenVersion: '' } });
    const legacy = generateToken(id, undefined);

    expect((await me(legacy)).status).toBe(200);
  });

  it('a password change signs out existing sessions', async () => {
    const id = await insertUser({ role: 'admin', username: 'boss' });
    const before = generateToken(id, 0);

    const user = await User.findById(id);
    user.password = 'new-password-123';
    await user.save({ validateBeforeSave: false });

    expect(user.tokenVersion).toBe(1);
    expect((await me(before)).status).toBe(401);
    expect((await me(generateToken(id, user.tokenVersion))).status).toBe(200);
  });
});
