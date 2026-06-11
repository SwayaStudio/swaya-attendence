/**
 * MongoDB connection via Mongoose with a global cache.
 * Survives Next.js hot reload in dev.
 */
import mongoose, { type Mongoose } from "mongoose";
import { env, isMongoConfigured } from "./env";

declare global {
  // eslint-disable-next-line no-var
  var __mongooseCache: { conn?: Mongoose; promise?: Promise<Mongoose> } | undefined;
}

const cache = globalThis.__mongooseCache ?? (globalThis.__mongooseCache = {});

export async function connectDB(): Promise<Mongoose> {
  if (!isMongoConfigured) {
    throw new Error(
      "MONGODB_URI is not set. Add it to .env.local before calling DB code."
    );
  }
  if (cache.conn) return cache.conn;
  if (!cache.promise) {
    mongoose.set("strictQuery", true);
    cache.promise = mongoose.connect(env.MONGODB_URI, {
      dbName: env.MONGODB_DB_NAME,
      bufferCommands: false,
      serverSelectionTimeoutMS: 30_000,
    });
  }
  cache.conn = await cache.promise;
  return cache.conn;
}

/**
 * Disconnect (used in tests and scripts).
 */
export async function disconnectDB(): Promise<void> {
  if (cache.conn) {
    await cache.conn.disconnect();
    cache.conn = undefined;
    cache.promise = undefined;
  }
}
