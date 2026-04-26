import { server } from "@/mocks/node";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { z } from "zod";
import { SocketClient } from "./index";

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("SocketClient", () => {
  describe("initialization", () => {
    it("should create a new instance", () => {
      const client = new SocketClient({
        url: "wss://echo.websocket.org",
      });

      expect(client).toBeDefined();
    });

    it("should have correct initial state before opening", () => {
      const client = new SocketClient({
        url: "wss://echo.websocket.org",
      });

      expect(client.isIdle).toBe(true);
      expect(client.isConnected).toBe(false);
      expect(client.fetchStatus).toBe("idle");
      expect(client.status).toBe("loading");
      expect(client.ws).toBeNull();
      expect(client.value).toBeUndefined();
      expect(client.failureCount).toBe(0);
      expect(client.error).toBeNull();
    });

    it("should apply placeholderData before connecting", () => {
      const placeholder = { message: "loading…" };
      const client = new SocketClient({
        url: "wss://echo.websocket.org",
        placeholderData: placeholder,
      });

      expect(client.value).toEqual(placeholder);
      expect(client.isPlaceholderData).toBe(true);
      expect(client.isPending).toBe(true);
    });
  });

  describe("connection", () => {
    it("should connect to the server", async () => {
      const client = new SocketClient({
        url: "wss://echo.websocket.org",
      });

      client.open();
      await client.waitUntil("open");
      expect(client.isConnected).toBe(true);
      expect(client.fetchStatus).toBe("connected");
      expect(client.ws).not.toBeNull();

      client.close();
    });

    it("should receive the initial server message", async () => {
      const client = new SocketClient({
        url: "wss://echo.websocket.org",
      });

      client.open();
      await client.waitUntil("message");

      expect(client.isSuccess).toBe(true);
      expect(client.value).toEqual({ message: "Hello!" });
      expect(client.dataUpdatedAt).toBeGreaterThan(0);

      client.close();
    });

    it("should transition to idle after a clean close", async () => {
      const client = new SocketClient({
        url: "wss://echo.websocket.org",
      });

      client.open();
      await client.waitUntil("open");

      client.close();
      await client.waitUntil("close");

      expect(client.isIdle).toBe(true);
      expect(client.ws).toBeNull();
      expect(client.fetchStatus).toBe("idle");
    });

    it("should not open a second connection when already open", async () => {
      const client = new SocketClient({
        url: "wss://echo.websocket.org",
      });

      client.open();
      await client.waitUntil("open");
      const firstWs = client.ws;

      client.open(); // second call should be a no-op
      expect(client.ws).toBe(firstWs);

      client.close();
    });
  });

  describe("retry", () => {
    it("should transition to idle after a clean close with a specific code", async () => {
      const client = new SocketClient({
        url: "wss://echo.websocket.org",
        retry: true,
        retryCount: 2,
        retryOnSpecificCloseCodes: [3000],
      });

      client.open();
      await client.waitUntil("open");

      client.ws?.close(3000);
      await client.waitUntil("close");
      expect(client.isIdle).toBe(true);
    });

    it("should increment failureCount and enter disconnected state on an unclean close", async () => {
      const client = new SocketClient({
        url: "wss://echo.websocket.org",
        retry: true,
        retryCount: 3,
        retryOnSpecificCloseCodes: [3001],
      });

      client.open();
      await client.waitUntil("open");

      // Dispatch a synthetic unclean close — MSW's server-side close always sets wasClean=true
      client.ws?.dispatchEvent(
        new CloseEvent("close", {
          code: 3001,
          reason: "Service restart",
          wasClean: false,
        })
      );

      await vi.waitFor(() => {
        expect(client.failureCount).toBeGreaterThan(0);
      });

      expect(client.isDisconnected).toBe(true);
      expect(client.failureReason).toBeTruthy();

      client.close();
    });

    it("should not retry when retry is disabled", async () => {
      const client = new SocketClient({
        url: "wss://echo.websocket.org",
        retry: false,
      });

      client.open();
      await client.waitUntil("open");

      client.ws?.dispatchEvent(
        new CloseEvent("close", {
          code: 3001,
          reason: "Service restart",
          wasClean: false,
        })
      );

      await client.waitUntil("close");

      expect(client.failureCount).toBe(0);
      expect(client.isIdle).toBe(true);
    });
  });

  describe("send — queue and flush", () => {
    it("should flush multiple distinct queued payloads in insertion order", async () => {
      const received: string[] = [];
      let lastValueStr = "";

      const client = new SocketClient({
        url: "wss://echo.websocket.org",
        sendSchema: z.object({ event: z.string() }),
      });

      // Queue three payloads before the socket opens
      client.send({ event: "first" });
      client.send({ event: "second" });
      client.send({ event: "third" });

      const unsub = client.subscribe((state) => {
        const str = JSON.stringify(state.value);
        if (str === lastValueStr) return;
        lastValueStr = str;
        if (state.value && typeof state.value === "object") {
          const echo = (state.value as Record<string, unknown>).echo;
          if (echo && typeof echo === "object") {
            const event = (echo as Record<string, string>).event;
            if (event) received.push(event);
          }
        }
      }, false);

      client.open();
      await client.waitUntil("open");

      await vi.waitFor(
        () => {
          expect(received).toEqual(["first", "second", "third"]);
        },
        { timeout: 8000 }
      );

      unsub();
      client.close();
    }, 10000);

    it("should only dispatch once when the same payload is queued multiple times before open", async () => {
      let echoCount = 0;
      let lastValueStr = "";

      const client = new SocketClient({
        url: "wss://echo.websocket.org",
        sendSchema: z.object({ event: z.string() }),
      });

      const unsub = client.subscribe((state) => {
        const str = JSON.stringify(state.value);
        if (str === lastValueStr) return;
        lastValueStr = str;
        if (
          state.value &&
          typeof state.value === "object" &&
          "echo" in (state.value as object)
        ) {
          echoCount++;
        }
      }, false);

      // Queue the same payload three times — map key deduplication means only one entry
      expect(client.send({ event: "ping" })).toBe(true);
      expect(client.send({ event: "ping" })).toBe(true);
      expect(client.send({ event: "ping" })).toBe(true);

      client.open();
      await client.waitUntil("open");

      // Give time for any extra echoes to arrive
      await new Promise((resolve) => setTimeout(resolve, 300));

      expect(echoCount).toBe(1);
      unsub();
      client.close();
    }, 10000);

    it("should dedup within the window after a queued payload is flushed on open", async () => {
      const client = new SocketClient({
        url: "wss://echo.websocket.org",
        deduplicationWindow: 200,
        sendSchema: z.object({ event: z.string() }),
      });

      // Queue before open — sentAt will be recorded during flush
      client.send({ event: "ping" });

      client.open();
      await client.waitUntil("open");
      // Immediately try again — must be within the dedup window
      expect(client.send({ event: "ping" })).toBe(false);

      client.close();
    });

    it("should accept deduplicationWindow as a UnitValue string", async () => {
      const client = new SocketClient({
        url: "wss://echo.websocket.org",
        deduplicationWindow: "50 milliseconds",
        sendSchema: z.object({ event: z.string() }),
      });

      client.open();
      await client.waitUntil("open");

      client.send({ event: "ping" });
      expect(client.send({ event: "ping" })).toBe(false);

      await new Promise((resolve) => setTimeout(resolve, 60));
      expect(client.send({ event: "ping" })).toBe(true);

      client.close();
    });

    it("should re-queue an expired entry at the end of the map", async () => {
      const received: string[] = [];
      let lastValueStr = "";

      const client = new SocketClient({
        url: "wss://echo.websocket.org",
        deduplicationWindow: 50,
        sendSchema: z.object({ event: z.string() }),
      });

      const trackEcho = (state: typeof client) => {
        const str = JSON.stringify(state.value);
        if (str === lastValueStr) return;
        lastValueStr = str;
        if (state.value && typeof state.value === "object") {
          const echo = (state.value as Record<string, unknown>).echo;
          if (echo && typeof echo === "object") {
            const event = (echo as Record<string, string>).event;
            if (event) received.push(event);
          }
        }
      };

      // 1. Open and dispatch alpha + beta — both get sentAt timestamps
      const unsub1 = client.subscribe(trackEcho, false);
      client.open();
      await client.waitUntil("open");
      client.send({ event: "alpha" });
      client.send({ event: "beta" });

      // 2. Wait for echoes then close — #sends retains both entries with sentAt > 0
      await vi.waitFor(() => expect(received).toEqual(["alpha", "beta"]), {
        timeout: 5000,
      });
      client.close();
      unsub1();

      // 3. Wait for both windows to expire
      await new Promise((resolve) => setTimeout(resolve, 60));

      // 4. Queue gamma (new, appended at end)
      client.send({ event: "gamma" });
      // 5. Re-send alpha — sentAt > 0 and expired → deleted then re-inserted at end
      client.send({ event: "alpha" });
      // Map order: beta (sentAt>0, skipped on flush), gamma (sentAt=0), alpha (sentAt=0)

      const unsub2 = client.subscribe(trackEcho, false);
      client.open();
      await client.waitUntil("open");

      await vi.waitFor(
        () => {
          expect(received).toEqual(["alpha", "beta", "gamma", "alpha"]);
        },
        { timeout: 8000 }
      );

      unsub2();
      client.close();
    }, 10000);
  });
});
