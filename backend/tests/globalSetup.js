import { MongoMemoryReplSet } from 'mongodb-memory-server';

let replSet;

/** Single-node replica set, so multi-document transactions work like on Atlas. */
export async function setup() {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
  process.env.MONGODB_URI = replSet.getUri('marketplus-test');
}

export async function teardown() {
  await replSet?.stop();
}
