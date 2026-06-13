// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  enqueueAction,
  getQueue,
  replayQueue,
  type QueuedAction,
} from "@/lib/offline-queue";

const sample = (over: Partial<QueuedAction> = {}): Omit<QueuedAction, "id"> => ({
  type: "check-in",
  lat: 12.9153,
  lng: 77.6428,
  accuracy: 10,
  capturedAt: "2026-06-13T09:00:00.000Z",
  deviceId: "dev-1",
  ...over,
});

const resp = (status: number, body: unknown) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }) as Response;

beforeEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("offline queue storage", () => {
  it("enqueues and reads back an action with a generated id", () => {
    const item = enqueueAction(sample());
    expect(item.id).toBeTruthy();
    expect(getQueue()).toHaveLength(1);
    expect(getQueue()[0].type).toBe("check-in");
  });

  it("returns items sorted oldest-first by capturedAt", () => {
    enqueueAction(sample({ capturedAt: "2026-06-13T12:00:00.000Z" }));
    enqueueAction(sample({ capturedAt: "2026-06-13T08:00:00.000Z" }));
    enqueueAction(sample({ capturedAt: "2026-06-13T10:00:00.000Z" }));
    const order = getQueue().map((q) => q.capturedAt);
    expect(order).toEqual([
      "2026-06-13T08:00:00.000Z",
      "2026-06-13T10:00:00.000Z",
      "2026-06-13T12:00:00.000Z",
    ]);
  });
});

describe("replayQueue", () => {
  it("removes actions the server accepts and posts the captured time", async () => {
    enqueueAction(sample());
    const fetchMock = vi.fn().mockResolvedValue(resp(200, { ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    const synced = await replayQueue();

    expect(synced).toBe(1);
    expect(getQueue()).toHaveLength(0);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/attendance/check-in");
    const sent = JSON.parse((init as RequestInit).body as string);
    expect(sent.capturedAt).toBe("2026-06-13T09:00:00.000Z");
  });

  it("DROPS an action the server rejects with 4xx (idempotency: already_checked_in)", async () => {
    enqueueAction(sample());
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(resp(400, { ok: false, error: "already_checked_in" }))
    );

    const synced = await replayQueue();

    expect(synced).toBe(0);
    expect(getQueue()).toHaveLength(0); // dropped, won't retry forever
  });

  it("KEEPS an action on a 5xx server error to retry later", async () => {
    enqueueAction(sample());
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(resp(500, { ok: false })));

    const synced = await replayQueue();

    expect(synced).toBe(0);
    expect(getQueue()).toHaveLength(1); // still queued
  });

  it("stops and keeps everything when the network is still down", async () => {
    enqueueAction(sample({ capturedAt: "2026-06-13T08:00:00.000Z" }));
    enqueueAction(sample({ capturedAt: "2026-06-13T09:00:00.000Z" }));
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Failed to fetch")));

    const synced = await replayQueue();

    expect(synced).toBe(0);
    expect(getQueue()).toHaveLength(2);
  });

  it("routes a check-out action to the check-out endpoint", async () => {
    enqueueAction(sample({ type: "check-out" }));
    const fetchMock = vi.fn().mockResolvedValue(resp(200, { ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    await replayQueue();

    expect(fetchMock.mock.calls[0][0]).toBe("/api/attendance/check-out");
  });
});
