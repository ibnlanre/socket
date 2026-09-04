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

const server = setupServer();

describe("EventSourceClient", () => {
  beforeAll(() => server.listen());
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  describe("initialization", () => {
    it("should create an instance with default options", () => {
      const client = new EventSourceClient({ url: TEST_URL });
      expect(client).toBeDefined();
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
});
