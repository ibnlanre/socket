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
  it,
  vi,
} from "vitest";
import { createSocketClient } from "./index";

// Create MSW WebSocket handlers for testing
const testWsHandler = ws.link("wss://test.example.com/ws/test");
const testWsHandlerWithParams = ws.link("wss://test.example.com/ws/test*");

const server = setupServer(
  testWsHandler.addEventListener("connection", ({ client, info }) => {
    // Send initial message
    client.send(
      JSON.stringify({
        message: "Connected to test server",
        timestamp: Date.now(),
      })
    );

    // Echo back any messages received
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

  testWsHandlerWithParams.addEventListener("connection", ({ client, info }) => {
    // Handle parameterized connections
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

  let client: ReturnType<typeof createSocketClient<TestData, TestParams>>;

  beforeAll(() => {
    server.listen();
  });

  afterAll(() => {
    server.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    server.resetHandlers();
    client = createSocketClient<TestData, TestParams>(mockConfig);
  });

  afterEach(() => {
    client.cleanupAll();
  });

  describe("initialize", () => {
    it("should create a new socket instance", () => {
      const socket = client.initialize({ userId: "123" });
      expect(socket).toBeDefined();
    });

    it("should reuse existing socket for same parameters", () => {
      const params = { userId: "123", room: "chat" };
      const socket1 = client.initialize(params);
      const socket2 = client.initialize(params);

      expect(socket1).toBe(socket2);
    });

    it("should create different sockets for different parameters", () => {
      const socket1 = client.initialize({ userId: "123" });
      const socket2 = client.initialize({ userId: "456" });

      // Should create different socket instances for different parameters
      expect(socket1).not.toBe(socket2);
      expect(client.sockets.size).toBe(2);
    });

    it("should store sockets in the sockets map", () => {
      const params = { userId: "123" };
      client.initialize(params);

      expect(client.sockets.size).toBe(1);
    });
  });

  describe("cleanup", () => {
    it("should remove and close specific socket", async () => {
      const params = { userId: "123" };
      const socket = client.initialize(params);

      // Wait for socket to be initialized
      await new Promise((resolve) => setTimeout(resolve, 100));

      const result = client.cleanup(params);

      expect(result).toBe(true);
      expect(client.sockets.size).toBe(0);
    });

    it("should return false for non-existent socket", () => {
      const result = client.cleanup({ userId: "nonexistent" });
      expect(result).toBe(false);
    });
  });

  describe("cleanupAll", () => {
    it("should close all sockets and clear the map", async () => {
      const socket1 = client.initialize({ userId: "123" });
      const socket2 = client.initialize({ userId: "456" });

      // Wait for sockets to be initialized
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(client.sockets.size).toBe(2);

      client.cleanupAll();

      expect(client.sockets.size).toBe(0);
    });
  });

  describe("use hook", () => {
    it("should return socket state with transformed data", async () => {
      const { result } = renderHook(() =>
        client.use({
          params: { userId: "123" },
          select: (data) => data?.message || "default",
        })
      );

      expect(result.current).toBeDefined();

      // Wait for the socket to connect and receive data
      await waitFor(
        () => {
          expect(result.current.data).toBeDefined();
        },
        { timeout: 5000 }
      );
    });

    // it("should open socket by default when enabled is true", async () => {
    //   const { result } = renderHook(() =>
    //     client.use({
    //       params: { userId: "123" },
    //       enabled: true,
    //     })
    //   );

    //   // Wait for connection to be established
    //   await waitFor(
    //     () => {
    //       expect(result.current.fetchStatus).toBe("connected");
    //     },
    //     { timeout: 5000 }
    //   );
    // });

    // it("should close socket when enabled is false", async () => {
    //   const { result } = renderHook(() =>
    //     client.use({
    //       params: { userId: "123" },
    //       enabled: false,
    //     })
    //   );

    //   // Should not attempt to connect
    //   expect(result.current.fetchStatus).toBe("idle");
    // });

    it("should subscribe to socket updates", async () => {
      const { result } = renderHook(() =>
        client.use({ params: { userId: "123" } })
      );

      // Wait for initial connection and data
      await waitFor(
        () => {
          expect(result.current.value).toBeDefined();
        },
        { timeout: 5000 }
      );

      expect(result.current.value).toEqual(
        expect.objectContaining({
          message: expect.stringContaining("Connected user 123"),
          userId: "123",
        })
      );
    });

    it("should handle parameter changes correctly", async () => {
      let params = { userId: "123" };
      const { result, rerender } = renderHook(() => client.use({ params }));

      // Wait for first connection
      await waitFor(
        () => {
          expect(result.current.value).toBeDefined();
        },
        { timeout: 5000 }
      );

      expect(client.sockets.size).toBe(1);

      // Change params
      params = { userId: "456" };
      act(() => {
        rerender();
      });

      // Should create a new socket for different params
      await waitFor(
        () => {
          expect(client.sockets.size).toBe(2);
        },
        { timeout: 5000 }
      );
    });

    it("should apply selector transformation", async () => {
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

    it("should handle default parameters", async () => {
      const { result } = renderHook(() => client.use());

      expect(result.current).toBeDefined();

      // Wait for connection
      await waitFor(
        () => {
          expect(result.current.value).toBeDefined();
        },
        { timeout: 5000 }
      );

      expect(client.sockets.size).toBe(1);
    });
  });

  describe("socket reuse optimization", () => {
    it("should reuse socket when params haven't changed", async () => {
      const params = { userId: "123" };

      const { result: result1 } = renderHook(() => client.use({ params }));

      const { result: result2 } = renderHook(() => client.use({ params }));

      // Should reuse the same socket for identical params
      expect(client.sockets.size).toBe(1);

      // Wait for connection
      await waitFor(
        () => {
          expect(result1.current.value).toBeDefined();
          expect(result2.current.value).toBeDefined();
        },
        { timeout: 5000 }
      );
    });
  });

  describe("error handling", () => {
    it("should handle empty params gracefully", () => {
      expect(() => client.initialize()).not.toThrow();
      expect(() => {
        renderHook(() => client.use());
      }).not.toThrow();
    });

    it("should handle connection failures", async () => {
      // Create a client with invalid URL to test error handling
      const errorClient = createSocketClient({
        baseURL: "wss://invalid.nonexistent.com",
        url: "/ws/test",
      });

      const { result } = renderHook(() => errorClient.use());

      expect(result.current).toBeDefined();

      // Clean up
      errorClient.cleanupAll();
    });
  });
});
