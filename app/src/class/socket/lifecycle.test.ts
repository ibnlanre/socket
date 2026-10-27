import type { WebSocketConstructor } from "@/types/runtime";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Socket, readSocketSnapshot } from ".";
class Transport extends EventTarget {
  static OPEN = 1;
  static CLOSED = 3;
  static instances: Transport[] = [];
  readyState = 0;
  bufferedAmount = 0;
  binaryType = "blob";
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  send = vi.fn();
  readonly url: string;
  constructor(url: string) {
    super();
    this.url = url;
    Transport.instances.push(this);
  }
  connect() {
    this.readyState = 1;
    this.onopen?.(new Event("open"));
  }
  message(data: unknown) {
    this.onmessage?.(
      new MessageEvent("message", { data: JSON.stringify(data) })
    );
  }
  close() {
    this.readyState = 3;
  }
}
const sockets: Socket<unknown, unknown>[] = [];
function create(options: object = {}) {
  const socket = new Socket<unknown, unknown>({
    url: "wss://example.com/ws",
    disableCache: true,
    log: [],
    ...options,
  });
  sockets.push(socket);
  return socket;
}
async function connect(socket: Socket<unknown, unknown>) {
  socket.open();
  await vi.waitFor(() => expect(socket.ws).not.toBeNull());
  const transport = socket.ws as unknown as Transport;
  transport.connect();
  return transport;
}
beforeEach(() => {
  Transport.instances = [];
  vi.stubGlobal("WebSocket", Transport);
});
afterEach(() => {
  sockets.splice(0).forEach((socket) => socket.dispose());
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
describe("connection lifecycle", () => {
  it("commits asynchronous messages in arrival order", async () => {
    let release!: () => void;
    const validate = vi.fn(async (value: unknown) => {
      if (value === 1)
        await new Promise<void>((resolve) => {
          release = resolve;
        });
      return { value };
    });
    const socket = create({
      messageSchema: { "~standard": { version: 1, vendor: "test", validate } },
    });
    const transport = await connect(socket);
    const values: unknown[] = [];
    socket.subscribe((state) => {
      if (values.at(-1) !== state.value && state.value !== undefined)
        values.push(state.value);
    });
    transport.message(1);
    transport.message(2);
    await vi.waitFor(() => expect(validate).toHaveBeenCalledTimes(1));
    release();
    await vi.waitFor(() => expect(socket.value).toBe(2));
    expect(values).toEqual([1, 2]);
  });
  it("ignores validation and transport callbacks from a closed connection", async () => {
    let release!: () => void;
    const socket = create({
      messageSchema: {
        "~standard": {
          version: 1,
          vendor: "test",
          validate: async (value: unknown) => {
            if (value === "old")
              await new Promise<void>((resolve) => {
                release = resolve;
              });
            return { value };
          },
        },
      },
    });
    const old = await connect(socket);
    old.message("old");
    await vi.waitFor(() => expect(release).toBeTypeOf("function"));
    socket.close();
    const fresh = await connect(socket);
    fresh.message("new");
    await vi.waitFor(() => expect(socket.value).toBe("new"));
    release();
    await Promise.resolve();
    await Promise.resolve();
    old.onclose?.(new CloseEvent("close"));
    expect(socket.ws).toBe(fresh);
    expect(socket.value).toBe("new");
  });
  it("preserves snapshots and subscriptions across close/reopen, but disposal is final", async () => {
    const socket = create();
    const listener = vi.fn();
    socket.subscribe(listener);
    const first = readSocketSnapshot(socket);
    expect(readSocketSnapshot(socket)).toBe(first);
    await connect(socket);
    socket.close();
    const next = await connect(socket);
    next.message(42);
    await vi.waitFor(() => expect(socket.value).toBe(42));
    expect(listener).toHaveBeenLastCalledWith(
      expect.objectContaining({ value: 42 })
    );
    socket.dispose();
    expect(() => socket.open()).toThrow("disposed");
  });
  it("prepares each transport independently and cancels stale authentication", async () => {
    let release!: (value: { url: string }) => void;
    const prepareConnection = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            release = resolve;
          })
      )
      .mockResolvedValue({ url: "wss://example.com/ws?token=fresh" });
    const socket = create({ prepareConnection });
    socket.open();
    await vi.waitFor(() => expect(prepareConnection).toHaveBeenCalledTimes(1));
    const signal = prepareConnection.mock.calls[0][0].signal;
    socket.close();
    expect(signal.aborted).toBe(true);
    const fresh = await connect(socket);
    release({ url: "wss://example.com/ws?token=old" });
    await Promise.resolve();
    expect(Transport.instances).toHaveLength(1);
    expect(fresh.url).toContain("fresh");
    expect(socket.path).toBe("/ws");
  });
  it("waits for browser buffers and emits diagnostics without exposing payloads", async () => {
    const diagnostic = vi.fn();
    const socket = create({ onDiagnostic: diagnostic, maxBufferedAmount: 10 });
    const transport = await connect(socket);
    transport.bufferedAmount = 11;
    await socket.send({ token: "private" });
    expect(transport.send).not.toHaveBeenCalled();
    transport.bufferedAmount = 0;
    await vi.waitFor(() => expect(transport.send).toHaveBeenCalledTimes(1));
    expect(JSON.stringify(diagnostic.mock.calls)).not.toContain("private");
  });
});
describe("reconnection backoff", () => {
  const drop = (transport: Transport) => {
    transport.readyState = 3;
    transport.onclose?.(
      new CloseEvent("close", { code: 1006, wasClean: false })
    );
  };
  const reconnect = async (previous: Transport) => {
    await vi.waitFor(() =>
      expect(Transport.instances.at(-1)).not.toBe(previous)
    );
    const transport = Transport.instances.at(-1)!;
    transport.connect();
    return transport;
  };
  const backoff = {
    retry: true,
    retryCount: 10,
    retryDelay: 5,
    minJitterValue: 1,
    maxJitterValue: 1,
  };

  it("keeps counting failures while a server accepts and then drops each connection", async () => {
    const socket = create({ ...backoff, maxRetryDelay: "10 seconds" });
    let transport = await connect(socket);
    drop(transport);
    expect(socket.failureCount).toBe(1);

    transport = await reconnect(transport);
    expect(socket.failureCount).toBe(1);
    drop(transport);
    expect(socket.failureCount).toBe(2);

    transport = await reconnect(transport);
    drop(transport);
    expect(socket.failureCount).toBe(3);
  });

  it("gives up after retryCount even when every attempt opens", async () => {
    const socket = create({ ...backoff, retryCount: 2, maxRetryDelay: "10 seconds" });
    let transport = await connect(socket);
    drop(transport);
    transport = await reconnect(transport);
    drop(transport);
    transport = await reconnect(transport);
    drop(transport);
    expect(socket.failureCount).toBe(3);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(Transport.instances.at(-1)).toBe(transport);
  });

  it("resets the count once a connection delivers a message", async () => {
    const socket = create({ ...backoff, maxRetryDelay: "10 seconds" });
    let transport = await connect(socket);
    drop(transport);
    transport = await reconnect(transport);
    expect(socket.failureCount).toBe(1);
    transport.message({ ok: true });
    await vi.waitFor(() => expect(socket.failureCount).toBe(0));
  });

  it("resets the count once a connection stays open for maxRetryDelay", async () => {
    const socket = create({ ...backoff, maxRetryDelay: 30 });
    const transport = await connect(socket);
    drop(transport);
    await reconnect(transport);
    expect(socket.failureCount).toBe(1);
    await vi.waitFor(() => expect(socket.failureCount).toBe(0));
  });
});

it("rejects pending waits on cancellation and disconnection", async () => {
  const socket = create();
  const controller = new AbortController();
  const cancelled = expect(
    socket.waitUntil("open", "5 seconds", { signal: controller.signal })
  ).rejects.toMatchObject({ name: "AbortError" });
  controller.abort();
  await cancelled;
  const pending = expect(socket.waitUntil("message")).rejects.toMatchObject({
    name: "AbortError",
  });
  socket.close();
  await pending;
});
it("bounds incoming validation while preserving the overflow error", async () => {
  const socket = create({
    maxPendingMessages: 1,
    messageSchema: {
      "~standard": {
        version: 1,
        vendor: "test",
        validate: () => new Promise(() => {}),
      },
    },
  });
  const transport = await connect(socket);
  transport.message(1);
  transport.message(2);
  expect(socket.ws).toBeNull();
  expect(socket.error?.message).toContain("queue is full");
});
it.each(["focus", "online"])(
  "reconnects on %s after an established transport closes cleanly",
  async (event) => {
    const socket = create();
    const first = await connect(socket);
    first.onclose?.(new CloseEvent("close", { wasClean: true }));
    expect(socket.isIdle).toBe(true);
    window.dispatchEvent(new Event(event));
    await vi.waitFor(() => expect(Transport.instances).toHaveLength(2));
  }
);

describe("runtime without a WebSocket global", () => {
  // Regression: `WebSocket.OPEN` and `WebSocket.CLOSED` were read from the
  // global constructor, so optional chaining on `this.ws` never protected the
  // right-hand operand. In a runtime with no `WebSocket` global, dispatch and
  // teardown threw even when there was no connection to act on.
  beforeEach(() => {
    // Remove the global outright. `vi.stubGlobal("WebSocket", undefined)` would
    // leave the property defined, reproducing a TypeError instead of the
    // ReferenceError that Node 18/20 raise for a genuinely absent `WebSocket`.
    Reflect.deleteProperty(globalThis, "WebSocket");
  });

  it("closes without throwing when there is no connection", () => {
    const socket = create();
    expect(typeof WebSocket).toBe("undefined");
    expect(socket.ws).toBeNull();
    expect(() => socket.close()).not.toThrow();
  });

  it("disposes without throwing when there is no connection", () => {
    const socket = create();
    expect(typeof WebSocket).toBe("undefined");
    expect(() => socket.dispose()).not.toThrow();
  });

  it("leaves a queued send pending instead of failing during dispatch", async () => {
    const socket = create();
    expect(typeof WebSocket).toBe("undefined");
    expect(socket.ws).toBeNull();

    // `true` means accepted into the ordered queue. With no transport there is
    // nothing to dispatch to, so the frame must stay queued rather than surface
    // a runtime error from the dispatch attempt.
    await expect(socket.send({ hello: "world" })).resolves.toBe(true);
  });
});

describe("injected runtime", () => {
  it("uses runtime.webSocket when no WebSocket global is available", async () => {
    Reflect.deleteProperty(globalThis, "WebSocket");

    const socket = create({
      runtime: { webSocket: Transport as unknown as WebSocketConstructor },
    });

    socket.open();

    await vi.waitFor(() => expect(Transport.instances).toHaveLength(1));
    expect(socket.ws).not.toBeNull();
  });

  it("reports an actionable error when no implementation is available", async () => {
    Reflect.deleteProperty(globalThis, "WebSocket");

    const socket = create();
    socket.open();

    await vi.waitFor(() =>
      expect(socket.error?.message).toContain("runtime.webSocket")
    );
    expect(socket.ws).toBeNull();
  });
});
