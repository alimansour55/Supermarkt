import mongoose from 'mongoose';
import { afterAll, afterEach, beforeAll } from 'vitest';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_jwt_secret_at_least_32_characters_long';

beforeAll(async () => {
  mongoose.set('strictQuery', true);
  await mongoose.connect(process.env.MONGODB_URI);
});

afterEach(async () => {
  delete process.env.MONGODB_TRANSACTIONS;
  const collections = await mongoose.connection.db.collections();
  await Promise.all(collections.map((c) => c.deleteMany({})));
});

afterAll(async () => {
  await mongoose.disconnect();
});
