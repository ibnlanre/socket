/* @vitest-environment node */
import { describe, expect, it, vi } from "vitest";

import { EventSourceClient } from "@/class/event-source-client";
import { Socket } from "@/class/socket";
import { SocketCache } from "@/class/socket-cache";

/**
 * Runs in a genuine Node environment: no `window`, `document`, `EventSource` or
 * `caches`. These assertions are the contract the browser suites cannot make.
 */
describe("node runtime", () => {
  it("has none of the browser globals the library used to require", () => {
    expect(typeof window).toBe("undefined");
    expect(typeof document).toBe("undefined");
    expect(typeof EventSource).toBe("undefined");
    expect(typeof caches).toBe("undefined");
  });

  it("constructs and tears down a socket without a WebSocket implementation", () => {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, "WebSocket");

    // Node >= 22 ships a global WebSocket; remove it to model Node 18/20.
    Reflect.deleteProperty(globalThis, "WebSocket");

    try {
      const socket = new Socket({
        url: "wss://example.com/ws",
        disableCache: true,
        log: [],
      });

      expect(() => socket.close()).not.toThrow();
      expect(() => socket.dispose()).not.toThrow();
    } finally {
      if (descriptor) Object.defineProperty(globalThis, "WebSocket", descriptor);
    }
  });

  it("selects fetch for a default GET SSE connection", () => {
    const fetched = vi.fn<typeof fetch>(() => new Promise<Response>(() => {}));
    const client = new EventSourceClient({
      url: "https://example.com/events",
      retry: false,
      runtime: { fetch: fetched },
    });

    client.open();

    expect(client.transport).toBe("fetch");
    expect(fetched).toHaveBeenCalledOnce();

    client.close();
    expect(client.transport).toBeNull();
  });

  it("caches nothing by default because Cache Storage is absent", async () => {
    const cache = new SocketCache({
      decryptData: true,
      disableCache: false,
      maxCacheAge: 60_000,
      origin: "https://example.com",
    });

    await cache.initialize("/path");

    expect(cache.persistence).toBe("none");
  });

  it("honors an explicit in-memory cache fallback", async () => {
    const cache = new SocketCache({
      decryptData: true,
      disableCache: false,
      fallback: "memory",
      maxCacheAge: 60_000,
      origin: "https://example.com",
    });

    await cache.initialize("/path");
    await cache.set("/path", JSON.stringify({ ok: true }));

    expect(cache.persistence).toBe("memory");
    await expect(cache.get("/path")).resolves.toEqual({ ok: true });
  });
});
