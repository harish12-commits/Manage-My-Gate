/**
 * Direct read access to the E2E database, used to assert what the backend persisted.
 * Uses the backend's own MongoDB driver so the mobile app needs no extra dependency.
 */
import path from 'path';

const E2E = require('../setup/constants');
const { MongoClient, ObjectId } = require(path.join(E2E.backendDir, 'node_modules', 'mongodb'));

let client: any = null;

export const db = async () => {
  if (!client) {
    client = new MongoClient(E2E.mongoUri);
    await client.connect();
  }
  return client.db();
};

export const closeDb = async () => {
  if (client) {
    await client.close();
    client = null;
  }
};

export const oid = (id: string) => new ObjectId(id);

export const collection = async (name: string) => (await db()).collection(name);
