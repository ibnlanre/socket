import { act, renderHook, waitFor } from "@testing-library/react";
import { ws } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi, } from "vitest";
import { z } from "zod";
import { SocketClient } from "./index";
const testWsHandler = ws.link("wss://test.example.com/ws/test");
const testWsHandlerWithParams = ws.link("wss://test.example.com/ws/test*");
const server = setupServer(testWsHandler.addEventListener("connection", ({ client }) => {
    client.send(JSON.stringify({
        message: "Connected to test server",
        timestamp: Date.now(),
    }));
    client.addEventListener("message", (event) => {
        try {
            const data = JSON.parse(event.data as string);
            client.send(JSON.stringify({
                echo: data,
                timestamp: Date.now(),
            }));
        }
        catch {
            client.send(JSON.stringify({
                error: "Invalid JSON",
                timestamp: Date.now(),
            }));
        }
    });
}), testWsHandlerWithParams.addEventListener("connection", ({ client }) => {
    const url = new URL(client.url);
    const userId = url.searchParams.get("userId");
    const room = url.searchParams.get("room");
    client.send(JSON.stringify({
        message: `Connected user ${userId} to room ${room}`,
        userId,
        room,
        timestamp: Date.now(),
    }));
    client.addEventListener("message", (event) => {
        try {
            const data = JSON.parse(event.data as string);
            client.send(JSON.stringify({
                userId,
                room,
                echo: data,
                timestamp: Date.now(),
            }));
        }
        catch {
            client.send(JSON.stringify({
                error: "Invalid JSON",
                userId,
                room,
                timestamp: Date.now(),
            }));
        }
    });
}));
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
async function connectManagedSocket<TGet, TPost, TParams extends object>(socket: {
    open: () => void;
    subscribe: (listener: (state: {
        fetchStatus: string;
    }) => void, immediate?: boolean) => () => void;
    fetchStatus: string;
}) {
    let resolveConnected: (() => void) | null = null;
    const connected = new Promise<void>((resolve) => {
        resolveConnected = resolve;
    });
    const unsubscribe = socket.subscribe((state) => {
        if (state.fetchStatus === "connected") {
            resolveConnected?.();
            resolveConnected = null;
        }
    }, false);
    socket.open();
    if (socket.fetchStatus !== "connected") {
        await connected;
    }
    return unsubscribe;
}
describe("SocketClient", () => {
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
    let client = new SocketClient<TestData, never, TestParams>(mockConfig);
    beforeAll(() => {
        server.listen();
    });
    afterAll(() => {
        server.close();
    });
    beforeEach(() => {
        vi.clearAllMocks();
        server.resetHandlers();
        client = new SocketClient<TestData, never, TestParams>(mockConfig);
    });
    afterEach(() => {
        vi.useRealTimers();
        client.clear();
    });
    describe("get", () => {
        it("should create a new socket instance", async () => {
            expect(await client.get()).toBeDefined();
        });
        it("should reuse the same socket for the same params", async () => {
            const params = { userId: "123", room: "chat" };
            const socket1 = await client.get(params);
            const socket2 = await client.get(params);
            expect(socket1).toBe(socket2);
        });
        it("should create different sockets for different params", async () => {
            const socket1 = await client.get({ userId: "123" });
            const socket2 = await client.get({ userId: "456" });
            expect(socket1).not.toBe(socket2);
        });
    });
    describe("close", () => {
        it("should close a specific socket", async () => {
            const params = { userId: "123" };
            const socket = await client.get(params);
            await new Promise((resolve) => setTimeout(resolve, 100));
            expect(await client.evict(params)).toBe(true);
            expect(await client.get(params)).not.toBe(socket);
        });
        it("should not throw for a non-existent socket", async () => {
            expect(await client.evict({ userId: "missing" })).toBe(false);
        });
    });
    describe("clear", () => {
        it("should close all managed sockets", async () => {
            const socket1 = await client.get({ userId: "123" });
            const socket2 = await client.get({ userId: "456" });
            await new Promise((resolve) => setTimeout(resolve, 100));
            client.clear();
            expect(await client.get({ userId: "123" })).not.toBe(socket1);
            expect(await client.get({ userId: "456" })).not.toBe(socket2);
        });
    });
    describe("useSocket hook", () => {
        it("should expose a read-only result through useSocket", async () => {
            const { result } = renderHook(() => client.useSocket());
            await waitFor(() => {
                expect(result.current.isConnected).toBe(true);
            });
            expect(result.current).not.toHaveProperty("ws");
            expect(result.current).not.toHaveProperty("cache");
            expect(typeof result.current.send).toBe("function");
        });
        it("should return transformed data", async () => {
            const { result } = renderHook(() => client.useSocket({
                select: (data) => data?.message || "default",
            }));
            await waitFor(() => {
                expect(result.current.data).toBeDefined();
            }, { timeout: 5000 });
        });
        it("should stay idle when disabled", () => {
            const binaryTypeClient = new SocketClient<TestData, never, TestParams>({
                ...mockConfig,
                binaryType: "arraybuffer",
            });
            const { result } = renderHook(() => binaryTypeClient.useSocket({
                params: { userId: "123" },
                enabled: false,
                select: (data) => {
                    if (!data)
                        return "waiting";
                    return data;
                },
            }));
            expect(result.current.data).toBe("waiting");
            expect(result.current.binaryType).toBe("arraybuffer");
            expect(result.current.fetchStatus).toBe("idle");
            expect(result.current.status).toBe("idle");
            binaryTypeClient.clear();
        });
        it("should open once enabled becomes true", async () => {
            let enabled = false;
            const { result, rerender } = renderHook(() => client.useSocket({
                params: { userId: "123" },
                enabled,
            }));
            expect(result.current.fetchStatus).toBe("idle");
            enabled = true;
            rerender();
            await waitFor(() => {
                expect(result.current.fetchStatus).toBe("connected");
            }, { timeout: 5000 });
        });
        it("should subscribe to socket updates", async () => {
            const { result } = renderHook(() => client.useSocket({ params: { userId: "123" } }));
            await waitFor(() => {
                expect(result.current.data).toEqual(expect.objectContaining({
                    message: expect.stringContaining("Connected user 123"),
                    userId: "123",
                }));
            }, { timeout: 5000 });
        });
        it("should handle param changes correctly", async () => {
            let params = { userId: "123" };
            const { result, rerender } = renderHook(() => client.useSocket({ params }));
            const firstSocket = await client.get(params);
            await waitFor(() => {
                expect(result.current.data).toBeDefined();
            }, { timeout: 5000 });
            params = { userId: "456" };
            act(() => {
                rerender();
            });
            await waitFor(() => {
                expect(result.current.data).toEqual(expect.objectContaining({
                    message: expect.stringContaining("Connected user 456"),
                    userId: "456",
                }));
            }, { timeout: 5000 });
            expect(await client.get(params)).not.toBe(firstSocket);
        });
        it("should apply selector transformations", async () => {
            const { result } = renderHook(() => client.useSocket({
                params: { userId: "123", room: "chat" },
                select: (data) => data?.message?.toUpperCase() || "",
            }));
            await waitFor(() => {
                expect(result.current.data).toBeDefined();
                expect(typeof result.current.data).toBe("string");
            }, { timeout: 5000 });
        });
        it("should handle default params", async () => {
            const { result } = renderHook(() => client.useSocket());
            await waitFor(() => {
                expect(result.current.data).toBeDefined();
            }, { timeout: 5000 });
        });
        it("should allow initialData before the first message arrives", () => {
            const { result } = renderHook(() => client.useSocket({
                select: (data) => {
                    if (!data)
                        return "Message not received yet";
                    return data;
                },
            }));
            expect(result.current.data).toBe("Message not received yet");
        });
        it("should apply the selector to constructor placeholderData", () => {
            const placeholderClient = new SocketClient<TestData, never, TestParams>({
                ...mockConfig,
                placeholderData: {
                    message: "Waiting for live update",
                    timestamp: 0,
                },
            });
            const { result } = renderHook(() => placeholderClient.useSocket({
                select: (data) => data?.message,
            }));
            expect(result.current.data).toBe("Waiting for live update");
            placeholderClient.clear();
        });
        it("should expose a live state snapshot once connected", async () => {
            const { result } = renderHook(() => client.useSocket({
                params: { userId: "123" },
            }));
            await waitFor(() => {
                expect(result.current.fetchStatus).toBe("connected");
                expect(result.current.status).toBe("success");
            }, { timeout: 5000 });
        });
    });
    describe("error handling", () => {
        it("should handle empty params gracefully", async () => {
            await expect(client.get()).resolves.toBeDefined();
            expect(() => renderHook(() => client.useSocket())).not.toThrow();
        });
        it("should validate params with zod", async () => {
            const schemaClient = new SocketClient({
                ...mockConfig,
                paramsSchema: z.object({
                    userId: z.string(),
                }),
            });
            await expect(schemaClient.get({ userId: 123 } as never)).rejects.toThrow();
            schemaClient.clear();
        });
        it("should resolve async params schemas", async () => {
            const schemaClient = new SocketClient({
                ...mockConfig,
                paramsSchema: {
                    "~standard": {
                        version: 1,
                        vendor: "test",
                        validate: () => Promise.resolve({ value: {} }),
                    },
                } as never,
            });
            await expect(schemaClient.get({ userId: "123" } as never)).resolves.toBeDefined();
            schemaClient.clear();
        });
        it("should validate incoming messages with zod", async () => {
            const schemaClient = new SocketClient({
                ...mockConfig,
                paramsSchema,
                messageSchema: z.object({
                    message: z.string(),
                    timestamp: z.number(),
                }),
            });
            const { result } = renderHook(() => schemaClient.useSocket({ params: { userId: "123" } }));
            await waitFor(() => {
                expect(result.current.data).toEqual(expect.objectContaining({
                    message: expect.any(String),
                    timestamp: expect.any(Number),
                }));
            }, { timeout: 5000 });
            expect(result.current.data).not.toHaveProperty("userId");
            schemaClient.clear();
        });
        it("should validate send payloads with zod", async () => {
            const schemaClient = new SocketClient({
                ...mockConfig,
                sendSchema: z.object({
                    event: z.string().min(1),
                }),
            });
            const socket = await schemaClient.get();
            const unsubscribe = await connectManagedSocket(socket);
            await expect(socket.send({ event: "" })).rejects.toThrow();
            unsubscribe();
            schemaClient.clear();
        });
        it("should infer params, message, and send types from schemas", async () => {
            const schemaClient = new SocketClient({
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
            await schemaClient.get({ userId: "123" });
            renderHook(() => schemaClient.useSocket({
                params: { room: "chat" },
                select(message) {
                    return message?.message;
                },
            }));
            schemaClient.clear();
        });
        it("should queue sends made before the socket opens", async () => {
            const schemaClient = new SocketClient({
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
            const socket = await schemaClient.get();
            await socket.send({ event: "subscribe" });
            const unsubscribe = await connectManagedSocket(socket);
            await waitFor(() => {
                expect(socket.value).toEqual(expect.objectContaining({
                    echo: expect.objectContaining({ event: "subscribe" }),
                }));
            }, { timeout: 5000 });
            unsubscribe();
            schemaClient.clear();
        });
        it("should expose imperative actions on the hook result", async () => {
            const params = { userId: "123", room: "chat" };
            const { result } = renderHook(() => client.useSocket({ params }));
            await waitFor(() => {
                expect(result.current.fetchStatus).toBe("connected");
            }, { timeout: 5000 });
            result.current.send({ event: "subscribe" } as never);
            await waitFor(() => {
                expect(result.current.data).toBeDefined();
            }, { timeout: 5000 });
        });
        it("should handle connection failures", () => {
            const errorClient = new SocketClient({
                baseURL: "wss://invalid.nonexistent.com",
                url: "/ws/test",
            });
            expect(() => renderHook(() => errorClient.useSocket())).not.toThrow();
            errorClient.clear();
        });
    });
    describe("send (deduplication)", () => {
        const sendConfig = {
            ...mockConfig,
            deduplicationWindow: 100,
            sendSchema: z.object({ event: z.string() }),
            messageSchema: z.object({
                timestamp: z.number(),
                message: z.string().optional(),
                error: z.string().optional(),
                echo: z.object({ event: z.string() }).optional(),
            }),
        };
        it("should send the payload and return true on first call", async () => {
            const schemaClient = new SocketClient(sendConfig);
            const socket = await schemaClient.get();
            const unsubscribe = await connectManagedSocket(socket);
            expect(await socket.send({ event: "ping" })).toBe(true);
            unsubscribe();
            schemaClient.clear();
        });
        it("should deduplicate identical payloads within the configured window", async () => {
            const schemaClient = new SocketClient(sendConfig);
            const socket = await schemaClient.get();
            const unsubscribe = await connectManagedSocket(socket);
            await socket.send({ event: "ping" });
            expect(await socket.send({ event: "ping" })).toBe(false);
            unsubscribe();
            schemaClient.clear();
        });
        it("should not deduplicate when deduplicationWindow is 0", async () => {
            const schemaClient = new SocketClient({
                ...sendConfig,
                deduplicationWindow: 0,
            });
            const socket = await schemaClient.get();
            const unsubscribe = await connectManagedSocket(socket);
            expect(await socket.send({ event: "ping" })).toBe(true);
            expect(await socket.send({ event: "ping" })).toBe(true);
            unsubscribe();
            schemaClient.clear();
        });
        it("should send distinct payloads independently", async () => {
            const schemaClient = new SocketClient(sendConfig);
            const socket = await schemaClient.get();
            const unsubscribe = await connectManagedSocket(socket);
            expect(await socket.send({ event: "ping" })).toBe(true);
            expect(await socket.send({ event: "pong" })).toBe(true);
            unsubscribe();
            schemaClient.clear();
        });
        it("should re-send after the deduplication window expires", async () => {
            const schemaClient = new SocketClient({
                ...sendConfig,
                deduplicationWindow: 50,
            });
            const socket = await schemaClient.get();
            const unsubscribe = await connectManagedSocket(socket);
            vi.useFakeTimers();
            await socket.send({ event: "ping" });
            await vi.advanceTimersByTimeAsync(60);
            expect(await socket.send({ event: "ping" })).toBe(true);
            unsubscribe();
            schemaClient.clear();
        });
        it("should maintain separate dedup registries per socket instance", async () => {
            const schemaClient = new SocketClient({
                ...sendConfig,
                paramsSchema: z.object({ userId: z.string().optional() }),
            });
            const socketA = await schemaClient.get({ userId: "a" });
            const socketB = await schemaClient.get({ userId: "b" });
            const [unsubscribeA, unsubscribeB] = await Promise.all([
                connectManagedSocket(socketA),
                connectManagedSocket(socketB),
            ]);
            expect(await socketA.send({ event: "ping" })).toBe(true);
            expect(await socketB.send({ event: "ping" })).toBe(true);
            unsubscribeA();
            unsubscribeB();
            schemaClient.clear();
        });
        it("should reset dedup state for a new socket after close", async () => {
            const schemaClient = new SocketClient(sendConfig);
            const socket = await schemaClient.get();
            const unsubscribe = await connectManagedSocket(socket);
            await socket.send({ event: "ping" });
            expect(await socket.send({ event: "ping" })).toBe(false);
            unsubscribe();
            await schemaClient.evict();
            const newSocket = await schemaClient.get();
            const newUnsubscribe = await connectManagedSocket(newSocket);
            expect(await newSocket.send({ event: "ping" })).toBe(true);
            newUnsubscribe();
            schemaClient.clear();
        });
        it("should dedup a queued payload within the window after the socket opens and flushes", async () => {
            const schemaClient = new SocketClient(sendConfig);
            const socket = await schemaClient.get();
            vi.useFakeTimers({ toFake: ["Date"] });
            vi.setSystemTime(new Date(1000));
            // Queue before open — flush will record sentAt on the entry
            await socket.send({ event: "ping" });
            const unsubscribe = await connectManagedSocket(socket);
            // Immediately after flush, the same payload is within the dedup window
            expect(await socket.send({ event: "ping" })).toBe(false);
            unsubscribe();
            schemaClient.clear();
        });
        it("should allow the same payload to be re-sent after the window expires post-flush", async () => {
            const schemaClient = new SocketClient({
                ...sendConfig,
                deduplicationWindow: 50,
            });
            const socket = await schemaClient.get();
            vi.useFakeTimers({ toFake: ["Date"] });
            vi.setSystemTime(new Date(1000));
            await socket.send({ event: "ping" });
            const unsubscribe = await connectManagedSocket(socket);
            expect(await socket.send({ event: "ping" })).toBe(false);
            vi.setSystemTime(new Date(1061));
            expect(await socket.send({ event: "ping" })).toBe(true);
            unsubscribe();
            schemaClient.clear();
        });
        it("should queue multiple identical sends before open and dispatch only one wire message", async () => {
            const schemaClient = new SocketClient(sendConfig);
            const socket = await schemaClient.get();
            // Pending duplicates are explicitly reported when deduplication is enabled.
            expect(await socket.send({ event: "ping" })).toBe(true);
            expect(await socket.send({ event: "ping" })).toBe(false);
            expect(await socket.send({ event: "ping" })).toBe(false);
            const unsubscribe = await connectManagedSocket(socket);
            // The single flushed message should trigger exactly one echo
            await waitFor(() => {
                expect(socket.value).toEqual(expect.objectContaining({
                    echo: expect.objectContaining({ event: "ping" }),
                }));
            }, { timeout: 5000 });
            unsubscribe();
            schemaClient.clear();
        });
        it("should accept deduplicationWindow as a UnitValue string", async () => {
            const schemaClient = new SocketClient({
                ...sendConfig,
                deduplicationWindow: "50 milliseconds",
            });
            const socket = await schemaClient.get();
            const unsubscribe = await connectManagedSocket(socket);
            vi.useFakeTimers();
            await socket.send({ event: "ping" });
            expect(await socket.send({ event: "ping" })).toBe(false);
            await vi.advanceTimersByTimeAsync(60);
            expect(await socket.send({ event: "ping" })).toBe(true);
            unsubscribe();
            schemaClient.clear();
        });
    });
});
