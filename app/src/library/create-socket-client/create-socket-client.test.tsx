import { act, renderHook, waitFor } from "@testing-library/react";
import { ws } from "msw";
import { setupServer } from "msw/node";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  expectTypeOf,
  it,
  vi,
} from "vitest";

import { z } from "zod";

import { createSocketClient } from "./index";

const testWsHandler = ws.link("wss://test.example.com/ws/test");
const testWsHandlerWithParams = ws.link("wss://test.example.com/ws/test*");

const server = setupServer(
  testWsHandler.addEventListener("connection", ({ client }) => {
    client.send(
      JSON.stringify({
        message: "Connected to test server",
        timestamp: Date.now(),
      })
    );

    client.addEventListener("message", (event) => {
      try {
        const data = JSON.parse(event.data as string);
        client.send(
          JSON.stringify({
            echo: data,
            timestamp: Date.now(),
          })
        );
      } catch {
        client.send(
          JSON.stringify({
            error: "Invalid JSON",
            timestamp: Date.now(),
          })
        );
      }
    });
  }),

  testWsHandlerWithParams.addEventListener("connection", ({ client }) => {
    const url = new URL(client.url);
    const userId = url.searchParams.get("userId");
    const room = url.searchParams.get("room");

    client.send(
      JSON.stringify({
        message: `Connected user ${userId} to room ${room}`,
        userId,
        room,
        timestamp: Date.now(),
      })
    );

    client.addEventListener("message", (event) => {
      try {
        const data = JSON.parse(event.data as string);
        client.send(
          JSON.stringify({
            userId,
            room,
            echo: data,
            timestamp: Date.now(),
          })
        );
      } catch {
        client.send(
          JSON.stringify({
            error: "Invalid JSON",
            userId,
            room,
            timestamp: Date.now(),
          })
        );
      }
    });
  })
);

type TestData = {
  message: string;
  timestamp: number;
  echo?: {
    event: string;
  };
  userId?: string | null;
  room?: string | null;
};

type TestParams = {
  userId?: string;
  room?: string;
};

describe("createSocketClient", () => {
  const mockConfig = {
    baseURL: "wss://test.example.com",
    url: "/ws/test",
    retry: true,
    retryCount: 3,
  };

  const paramsSchema = z.object({
    userId: z.string().optional(),
    room: z.string().optional(),
  });

  let client = createSocketClient<TestData, never, TestParams>(mockConfig);

  beforeAll(() => {
    server.listen();
  });

  afterAll(() => {
    server.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    server.resetHandlers();
    client = createSocketClient<TestData, never, TestParams>(mockConfig);
  });

  afterEach(() => {
    client.closeAll();
  });

  describe("get", () => {
    it("should create a new socket instance", () => {
      expect(client.get()).toBeDefined();
    });

    it("should reuse the same socket for the same params", () => {
      const params = { userId: "123", room: "chat" };
      const socket1 = client.get({ params });
      const socket2 = client.get({ params });

      expect(socket1).toBe(socket2);
    });

    it("should create different sockets for different params", () => {
      const socket1 = client.get({ params: { userId: "123" } });
      const socket2 = client.get({ params: { userId: "456" } });

      expect(socket1).not.toBe(socket2);
    });
  });

  describe("close", () => {
    it("should close a specific socket", async () => {
      const params = { userId: "123" };
      const socket = client.get({ params });

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(client.close({ params })).toBe(true);
      expect(client.get({ params })).not.toBe(socket);
    });

    it("should return false for a non-existent socket", () => {
      expect(client.close({ params: { userId: "missing" } })).toBe(false);
    });
  });

  describe("closeAll", () => {
    it("should close all managed sockets", async () => {
      const socket1 = client.get({ params: { userId: "123" } });
      const socket2 = client.get({ params: { userId: "456" } });

      await new Promise((resolve) => setTimeout(resolve, 100));

      client.closeAll();

      expect(client.get({ params: { userId: "123" } })).not.toBe(socket1);
      expect(client.get({ params: { userId: "456" } })).not.toBe(socket2);
    });
  });

  describe("use hook", () => {
    it("should return transformed data", async () => {
      const { result } = renderHook(() =>
        client.use({
          select: (data) => data?.message || "default",
        })
      );

      await waitFor(
        () => {
          expect(result.current.data).toBeDefined();
        },
        { timeout: 5000 }
      );
    });

    it("should stay idle when disabled", () => {
      const { result } = renderHook(() =>
        client.use({
          params: { userId: "123" },
          enabled: false,
          initialData: "waiting",
          select: (data) => data?.message,
        })
      );

      expect(result.current.data).toBe("waiting");
      expect(result.current.fetchStatus).toBe("idle");
    });

    it("should open once enabled becomes true", async () => {
      let enabled = false;

      const { result, rerender } = renderHook(() =>
        client.use({
          params: { userId: "123" },
          enabled,
          initialData: "waiting",
          select: (data) => data?.message,
        })
      );

      expect(result.current.data).toBe("waiting");
      expect(result.current.fetchStatus).toBe("idle");

      enabled = true;
      rerender();

      await waitFor(
        () => {
          expect(result.current.data).toContain("Connected user 123");
        },
        { timeout: 5000 }
      );
    });

    it("should subscribe to socket updates", async () => {
      const { result } = renderHook(() =>
        client.use({ params: { userId: "123" } })
      );

      await waitFor(
        () => {
          expect(result.current.data).toEqual(
            expect.objectContaining({
              message: expect.stringContaining("Connected user 123"),
              userId: "123",
            })
          );
        },
        { timeout: 5000 }
      );
    });

    it("should handle param changes correctly", async () => {
      let params = { userId: "123" };
      const { result, rerender } = renderHook(() => client.use({ params }));
      const firstSocket = client.get({ params });

      await waitFor(
        () => {
          expect(result.current.data).toBeDefined();
        },
        { timeout: 5000 }
      );

      params = { userId: "456" };
      act(() => {
        rerender();
      });

      await waitFor(
        () => {
          expect(result.current.data).toEqual(
            expect.objectContaining({
              message: expect.stringContaining("Connected user 456"),
              userId: "456",
            })
          );
        },
        { timeout: 5000 }
      );

      expect(client.get({ params })).not.toBe(firstSocket);
    });

    it("should apply selector transformations", async () => {
      const { result } = renderHook(() =>
        client.use({
          params: { userId: "123", room: "chat" },
          select: (data) => data?.message?.toUpperCase() || "",
        })
      );

      await waitFor(
        () => {
          expect(result.current.data).toBeDefined();
          expect(typeof result.current.data).toBe("string");
        },
        { timeout: 5000 }
      );
    });

    it("should handle default params", async () => {
      const { result } = renderHook(() => client.use());

      await waitFor(
        () => {
          expect(result.current.data).toBeDefined();
        },
        { timeout: 5000 }
      );
    });

    it("should allow initialData before the first message arrives", () => {
      const { result } = renderHook(() =>
        client.use({
          initialData: "Message not received yet",
          select: (data) => data?.message,
        })
      );

      expect(result.current.data).toBe("Message not received yet");
    });

    it("should apply the selector to constructor placeholderData", () => {
      const placeholderClient = createSocketClient<TestData, never, TestParams>(
        {
          ...mockConfig,
          placeholderData: {
            message: "Waiting for live update",
            timestamp: 0,
          },
        }
      );

      const { result } = renderHook(() =>
        placeholderClient.use({
          select: (data) => data?.message,
        })
      );

      expect(result.current.data).toBe("Waiting for live update");

      placeholderClient.closeAll();
    });
  });

  describe("error handling", () => {
    it("should handle empty params gracefully", () => {
      expect(() => client.get()).not.toThrow();
      expect(() => renderHook(() => client.use())).not.toThrow();
    });

    it("should validate params with zod", () => {
      const schemaClient = createSocketClient({
        ...mockConfig,
        paramsSchema: z.object({
          userId: z.string(),
        }),
      });

      expect(() =>
        schemaClient.get({ params: { userId: 123 } as never })
      ).toThrow();

      schemaClient.closeAll();
    });

    it("should validate incoming messages with zod", async () => {
      const schemaClient = createSocketClient({
        ...mockConfig,
        paramsSchema,
        messageSchema: z.object({
          message: z.string(),
          timestamp: z.number(),
        }),
      });

      const { result } = renderHook(() =>
        schemaClient.use({ params: { userId: "123" } })
      );

      await waitFor(
        () => {
          expect(result.current.data).toEqual(
            expect.objectContaining({
              message: expect.any(String),
              timestamp: expect.any(Number),
            })
          );
        },
        { timeout: 5000 }
      );

      expect(result.current.data).not.toHaveProperty("userId");

      schemaClient.closeAll();
    });

    it("should validate send payloads with zod", async () => {
      const schemaClient = createSocketClient({
        ...mockConfig,
        sendSchema: z.object({
          event: z.string().min(1),
        }),
      });

      const socket = schemaClient.get();
      socket.open();
      await socket.waitUntil("open");

      expect(() => socket.send({ event: "" })).toThrow();

      schemaClient.closeAll();
    });

    it("should infer params, message, and send types from schemas", () => {
      const schemaClient = createSocketClient({
        ...mockConfig,
        paramsSchema: z.object({
          userId: z.string().optional(),
          room: z.string().optional(),
        }),
        sendSchema: z.object({
          event: z.string(),
        }),
        messageSchema: z.object({
          message: z.string(),
          timestamp: z.number(),
        }),
      });

      schemaClient.get({ params: { userId: "123" } });

      renderHook(() =>
        schemaClient.use({
          params: { room: "chat" },
          select(message) {
            return message?.message;
          },
        })
      );

      schemaClient.closeAll();
    });

    it("should queue sends made before the socket opens", async () => {
      const schemaClient = createSocketClient({
        ...mockConfig,
        sendSchema: z.object({
          event: z.string(),
        }),
        messageSchema: z.object({
          timestamp: z.number(),
          message: z.string().optional(),
          error: z.string().optional(),
          echo: z
            .object({
              event: z.string(),
            })
            .optional(),
        }),
      });

      const socket = schemaClient.get();
      socket.send({ event: "subscribe" });
      socket.open();

      await waitFor(
        () => {
          expect(socket.value).toEqual(
            expect.objectContaining({
              echo: expect.objectContaining({ event: "subscribe" }),
            })
          );
        },
        { timeout: 5000 }
      );

      schemaClient.closeAll();
    });

    it("should expose imperative actions on the hook result", async () => {
      const params = { userId: "123", room: "chat" };

      const { result } = renderHook(() => client.use({ params }));

      await result.current.waitUntil("open");
      result.current.send({ event: "subscribe" } as never);

      await waitFor(
        () => {
          expect(result.current.data).toBeDefined();
        },
        { timeout: 5000 }
      );
    });

    it("should preserve typed preset options", () => {
      const options = client.preset({
        params: { userId: "123" },
        enabled: true,
        initialData: "waiting",
        select: (data) => data?.message ?? "",
      });

      expectTypeOf(options.params).toMatchTypeOf<TestParams | undefined>();
      expectTypeOf(options.initialData).toEqualTypeOf<string | undefined>();
      expectTypeOf(options.enabled).toEqualTypeOf<boolean | undefined>();
    });

    it("should handle connection failures", () => {
      const errorClient = createSocketClient({
        baseURL: "wss://invalid.nonexistent.com",
        url: "/ws/test",
      });

      expect(() => renderHook(() => errorClient.use())).not.toThrow();

      errorClient.closeAll();
    });
  });
});
