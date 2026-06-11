/* eslint-disable */
/**
 * Service Worker for offline ping queueing + Background Sync.
 *
 * The employee page registers this worker. When the page is hidden or
 * offline, pings are queued in IndexedDB. When the network is back
 * (or a sync event fires), we POST them in batches to /api/pings.
 *
 * Caveat: Background Sync and Periodic Background Sync are only
 * available in Chrome/Edge. iOS Safari does not support them — there
 * the foreground Page Visibility loop is the fallback.
 */
const DB_NAME = "geo-attendance";
const STORE = "pings";
const SYNC_TAG = "ping-sync";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function putPing(ping) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).add({ ping, queuedAt: Date.now() });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getAllPings() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

async function deletePings(ids) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    for (const id of ids) store.delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function flushQueue() {
  const items = await getAllPings();
  if (items.length === 0) return { flushed: 0 };
  try {
    const pings = items.map((i) => i.ping);
    const res = await fetch("/api/pings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ pings }),
    });
    if (!res.ok) throw new Error("flush failed: " + res.status);
    await deletePings(items.map((i) => i.id));
    const clients = await self.clients.matchAll();
    clients.forEach((c) => c.postMessage({ type: "pings-flushed", count: items.length }));
    return { flushed: items.length };
  } catch (err) {
    // leave them in the queue
    return { flushed: 0, error: String(err) };
  }
}

self.addEventListener("message", (event) => {
  if (event.data?.type === "enqueue-ping") {
    event.waitUntil(putPing(event.data.ping).then(() => trySync()));
  } else if (event.data?.type === "flush-now") {
    event.waitUntil(flushQueue());
  }
});

async function trySync() {
  if ("sync" in self.registration) {
    try {
      await self.registration.sync.register(SYNC_TAG);
    } catch (e) {
      // fallback: best-effort fetch
      await flushQueue();
    }
  } else {
    await flushQueue();
  }
}

self.addEventListener("sync", (event) => {
  if (event.tag === SYNC_TAG) {
    event.waitUntil(flushQueue());
  }
});

// Periodic Sync is opt-in and rarely granted, but we try.
self.addEventListener("periodicsync", (event) => {
  if (event.tag === "ping-periodic") {
    event.waitUntil(flushQueue());
  }
});
