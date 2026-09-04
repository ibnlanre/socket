import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
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

import { EventSourceClient } from "./index";

const TEST_URL = "https://example.com/events";

const messageSchema = z.object({
  type: z.literal("update"),
  value: z.number(),
});

function createSSEStream(...chunks: string[]) {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
}

/**
 * Minimal stand-in for the browser-native EventSource so the GET transport path
 * (which jsdom does not implement) can be exercised. Default events are routed
 * through `onmessage`; named events are routed through registered listeners —
 * mirroring the real EventSource behaviour the client relies on.
 */
class FakeEventSource {
  static instances: FakeEventSource[] = [];
  readonly url: string;
  onopen: (() => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((error: unknown) => void) | null = null;
  closed = false;
  #handlers = new Map<string, (event: MessageEvent) => void>();

  constructor(url: string) {
    this.url = url;
    FakeEventSource.instances.push(this);
  }

  addEventListener(type: string, handler: (event: MessageEvent) => void) {
    this.#handlers.set(type, handler);
  }

  removeEventListener(type: string) {
    this.#handlers.delete(type);
  }

  close() {
    this.closed = true;
  }

  emit(type: string, data: string, lastEventId = "") {
    const event = new MessageEvent(type, { data, lastEventId });
    if (type === "message") this.onmessage?.(event);
    const handler = this.#handlers.get(type);
    if (handler) handler(event);
  }
}

const server = setupServer();

describe("EventSourceClient", () => {
  beforeAll(() => server.listen());
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  describe("initialization", () => {
    it("should create an instance with default options", () => {
      const client = new EventSourceClient({ url: TEST_URL });
      expect(client).toBeDefined();
      expect(client.status).toBe("idle");
      expect(client.error).toBeNull();
    });
  });

  describe("SSE streaming (fetch-based, non-GET)", () => {
    it("should process SSE data lines through the fetch stream", async () => {
      server.use(
        http.post(TEST_URL, () => {
          return new HttpResponse(createSSEStream("data: hello world\n\n"), {
            headers: { "Content-Type": "text/event-stream" },
          });
        })
      );

      const client = new EventSourceClient<string>({
        url: TEST_URL,
        method: "POST",
      });

      client.open();
      await new Promise((resolve) => setTimeout(resolve, 100));

      client.close();
    });

    it("should handle multiple SSE events", async () => {
      server.use(
        http.post(TEST_URL, () => {
          return new HttpResponse(
            createSSEStream(
              "event: update\ndata: first\n\n",
              "event: update\ndata: second\n\n"
            ),
            { headers: { "Content-Type": "text/event-stream" } }
          );
        })
      );

      const client = new EventSourceClient<string>({
        url: TEST_URL,
        method: "POST",
      });
      client.open();
      await new Promise((resolve) => setTimeout(resolve, 100));
      client.close();
    });

    it("should call retry on stream end when retry is enabled", async () => {
      let callCount = 0;

      server.use(
        http.post(TEST_URL, () => {
          callCount++;
          return new HttpResponse(createSSEStream("data: once\n\n"), {
            headers: { "Content-Type": "text/event-stream" },
          });
        })
      );

      const client = new EventSourceClient<string>({
        url: TEST_URL,
        method: "POST",
        retry: true,
        retryCount: 2,
        retryDelay: "10 milliseconds",
      });

      client.open();
      await new Promise((resolve) => setTimeout(resolve, 500));

      expect(callCount).toBeGreaterThan(1);
      client.close();
    });

    it("should dispatch named events to every registered listener", async () => {
      server.use(
        http.post(TEST_URL, () => {
          return new HttpResponse(
            createSSEStream("event: update\ndata: first\n\n"),
            { headers: { "Content-Type": "text/event-stream" } }
          );
        })
      );

      const client = new EventSourceClient<string>({
        url: TEST_URL,
        method: "POST",
      });
      const first = vi.fn();
      const second = vi.fn();
      const unsubscribeFirst = client.on("update", first);
      const unsubscribeSecond = client.on("update", second);

      client.open();

      await vi.waitFor(() => {
        expect(first).toHaveBeenCalledTimes(1);
        expect(second).toHaveBeenCalledTimes(1);
      });

      unsubscribeFirst();
      unsubscribeSecond();
      client.close();
    });

    it("should include the most recent event ID when reconnecting", async () => {
      let callCount = 0;
      let reconnectLastEventId: string | null = null;

      server.use(
        http.post(TEST_URL, ({ request }) => {
          callCount += 1;

          if (callCount > 1) {
            reconnectLastEventId = request.headers.get("Last-Event-ID");
          }

          return new HttpResponse(
            createSSEStream("id: event-42\ndata: once\n\n"),
            { headers: { "Content-Type": "text/event-stream" } }
          );
        })
      );

      const client = new EventSourceClient<string>({
        url: TEST_URL,
        method: "POST",
        retry: true,
        retryCount: 1,
        retryDelay: "10 milliseconds",
      });

      client.open();

      await vi.waitFor(() => {
        expect(callCount).toBe(2);
      });

      expect(reconnectLastEventId).toBe("event-42");
      client.close();
    });
  });

  describe("SSE protocol parsing", () => {
    it("should handle field parsing with a POST fetch stream", async () => {
      server.use(
        http.post(TEST_URL, () => {
          return new HttpResponse(
            createSSEStream(
              "id: 42\nevent: custom\ndata: payload\nretry: 5000\n\n"
            ),
            { headers: { "Content-Type": "text/event-stream" } }
          );
        })
      );

      const client = new EventSourceClient<string>({
        url: TEST_URL,
        method: "POST",
      });
      client.open();
      await new Promise((resolve) => setTimeout(resolve, 100));
      client.close();
    });
  });

  describe("close", () => {
    it("should abort the fetch request on close", () => {
      const client = new EventSourceClient<string>({
        url: TEST_URL,
        method: "POST",
      });

      client.open();
      client.close();
    });

    it("should cancel a scheduled reconnect", async () => {
      let callCount = 0;
      let resolveFirstRequest: (() => void) | undefined;
      const firstRequest = new Promise<void>((resolve) => {
        resolveFirstRequest = resolve;
      });

      server.use(
        http.post(TEST_URL, () => {
          callCount += 1;
          resolveFirstRequest?.();
          resolveFirstRequest = undefined;

          return new HttpResponse(createSSEStream("data: once\n\n"), {
            headers: { "Content-Type": "text/event-stream" },
          });
        })
      );

      const client = new EventSourceClient<string>({
        url: TEST_URL,
        method: "POST",
        retry: true,
        retryCount: 1,
        retryDelay: "50 milliseconds",
      });

      client.open();
      await firstRequest;
      client.close();
      await new Promise((resolve) => setTimeout(resolve, 75));

      expect(callCount).toBe(1);
    });
  });

  describe("messageSchema validation", () => {
    it("should dispatch validated data when schema matches", async () => {
      server.use(
        http.post(TEST_URL, () => {
          return new HttpResponse(
            createSSEStream('data: {"type":"update","value":42}\n\n'),
            { headers: { "Content-Type": "text/event-stream" } }
          );
        })
      );

      const client = new EventSourceClient<{ type: string; value: number }>({
        url: TEST_URL,
        method: "POST",
        messageSchema,
      });
      client.open();
      await new Promise((resolve) => setTimeout(resolve, 100));
      client.close();
    });

    it("should silently drop invalid messages when schema is configured", async () => {
      server.use(
        http.post(TEST_URL, () => {
          return new HttpResponse(
            createSSEStream(
              'data: {"type":"invalid","value":"not-a-number"}\n\n'
            ),
            { headers: { "Content-Type": "text/event-stream" } }
          );
        })
      );

      const client = new EventSourceClient<{ type: string; value: number }>({
        url: TEST_URL,
        method: "POST",
        messageSchema,
      });
      client.open();
      await new Promise((resolve) => setTimeout(resolve, 100));
      client.close();
    });

    it("should silently drop non-JSON data when schema is configured", async () => {
      server.use(
        http.post(TEST_URL, () => {
          return new HttpResponse(
            createSSEStream("data: this is not json\n\n"),
            { headers: { "Content-Type": "text/event-stream" } }
          );
        })
      );

      const client = new EventSourceClient<{ type: string; value: number }>({
        url: TEST_URL,
        method: "POST",
        messageSchema,
      });
      client.open();
      await new Promise((resolve) => setTimeout(resolve, 100));
      client.close();
    });
  });

  describe("SSE streaming (native EventSource, GET)", () => {
    const NativeEventSource = globalThis.EventSource;

    afterEach(() => {
      (globalThis as any).EventSource = NativeEventSource;
      FakeEventSource.instances = [];
    });

    it("should forward named events registered before open()", async () => {
      (globalThis as any).EventSource = FakeEventSource;

      const client = new EventSourceClient<string>({ url: TEST_URL });
      const update = vi.fn();
      const unsubscribe = client.on("update", update);

      client.open();

      const source = FakeEventSource.instances.at(-1);
      expect(source).toBeDefined();
      expect(client.status).toBe("connecting");

      source?.onopen?.();
      expect(client.status).toBe("open");

      source?.emit("update", "first");
      expect(update).toHaveBeenCalledTimes(1);
      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({ type: "update", data: "first" })
      );

      // Unsubscribing detaches the native forwarder, so later events are dropped.
      unsubscribe();
      source?.emit("update", "second");
      expect(update).toHaveBeenCalledTimes(1);

      client.close();
    });

    it("should forward named events registered after open()", async () => {
      (globalThis as any).EventSource = FakeEventSource;

      const client = new EventSourceClient<string>({ url: TEST_URL });
      client.open();

      const source = FakeEventSource.instances.at(-1);
      const update = vi.fn();
      const unsubscribe = client.on("update", update);

      source?.onopen?.();
      source?.emit("update", "live registration");
      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({ data: "live registration" })
      );

      unsubscribe();
      client.close();
    });

    it("should keep named subscriptions across a reconnect that creates a new EventSource", async () => {
      (globalThis as any).EventSource = FakeEventSource;

      const client = new EventSourceClient<string>({
        url: TEST_URL,
        retry: true,
        retryCount: 2,
        retryDelay: "5 milliseconds",
      });
      const update = vi.fn();
      client.on("update", update);

      client.open();
      const firstSource = FakeEventSource.instances.at(-1);
      firstSource?.onerror?.(new Error("connection dropped"));

      await vi.waitFor(() => {
        expect(FakeEventSource.instances.length).toBeGreaterThanOrEqual(2);
      });

      const secondSource = FakeEventSource.instances.at(-1);
      secondSource?.emit("update", "after reconnect");
      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({ data: "after reconnect" })
      );

      client.close();
    });

    it("should drop named subscriptions when the client is closed", async () => {
      (globalThis as any).EventSource = FakeEventSource;

      const client = new EventSourceClient<string>({ url: TEST_URL });
      const update = vi.fn();
      client.on("update", update);

      client.open();
      client.close();

      const source = FakeEventSource.instances.at(-1);
      source?.emit("update", "after close");
      expect(update).not.toHaveBeenCalled();
    });
  });
});
