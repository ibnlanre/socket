import type { WebSocketConstructor } from "@/types/runtime";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { readSocketSnapshot, Socket } from ".";

class Transport extends EventTarget {
  static CLOSED = 3;
  static instances: Transport[] = [];
  static OPEN = 1;
  binaryType = "blob";
  bufferedAmount = 0;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onopen: ((event: Event) => void) | null = null;
  readyState = 0;
  send = vi.fn();
  readonly url: string;
  constructor(url: string) {
    super();
    this.url = url;
    Transport.instances.push(this);
  }
  close() {
    this.readyState = 3;
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
}
const sockets: Socket<unknown, unknown>[] = [];
async function connect(socket: Socket<unknown, unknown>) {
  socket.open();
  await vi.waitFor(() => expect(socket.ws).not.toBeNull());
  const transport = socket.ws as unknown as Transport;
  transport.connect();
  return transport;
}
function create(options: object = {}) {
  const socket = new Socket<unknown, unknown>({
    disableCache: true,
    log: [],
    url: "wss://example.com/ws",
    ...options,
  });
  sockets.push(socket);
  return socket;
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
      messageSchema: { "~standard": { validate, vendor: "test", version: 1 } },
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
          validate: async (value: unknown) => {
            if (value === "old")
              await new Promise<void>((resolve) => {
                release = resolve;
              });
            return { value };
          },
          vendor: "test",
          version: 1,
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
    const socket = create({ maxBufferedAmount: 10, onDiagnostic: diagnostic });
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
    maxJitterValue: 1,
    minJitterValue: 1,
    retry: true,
    retryCount: 10,
    retryDelay: 5,
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
    const socket = create({
      ...backoff,
      maxRetryDelay: "10 seconds",
      retryCount: 2,
    });
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

  it("marks a socket that gave up as exhausted, and open() starts it again", async () => {
    const socket = create({
      ...backoff,
      maxRetryDelay: "10 seconds",
      retryCount: 1,
    });
    let transport = await connect(socket);
    drop(transport);
    transport = await reconnect(transport);
    expect(socket.isExhausted).toBe(false);
    drop(transport);

    expect(socket.isExhausted).toBe(true);
    expect(readSocketSnapshot(socket).isExhausted).toBe(true);
    expect(socket.ws).toBeNull();
    expect(socket.isError).toBe(true);

    socket.open();
    await vi.waitFor(() =>
      expect(Transport.instances.at(-1)).not.toBe(transport)
    );
    expect(socket.isExhausted).toBe(false);
    expect(socket.failureCount).toBe(0);
  });

  it("stops being exhausted once closed on purpose", async () => {
    const socket = create({
      ...backoff,
      maxRetryDelay: "10 seconds",
      retryCount: 0,
    });
    drop(await connect(socket));
    expect(socket.isExhausted).toBe(true);
    socket.close();
    expect(socket.isExhausted).toBe(false);
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

describe("observers", () => {
  it("hear every change of state, and of subscribers", async () => {
    const socket = create();
    const observer = vi.fn();
    socket.observe(observer);
    const unsubscribe = socket.subscribe(() => {}, false);
    expect(observer).toHaveBeenCalledTimes(1);
    expect(socket.hasSubscribers()).toBe(true);

    observer.mockClear();
    const transport = await connect(socket);
    transport.message({ ok: true });
    await vi.waitFor(() => expect(observer).toHaveBeenCalled());

    observer.mockClear();
    unsubscribe();
    expect(observer).toHaveBeenCalledTimes(1);
    expect(socket.hasSubscribers()).toBe(false);
  });

  it("do not keep an idle socket open", async () => {
    const socket = create({ idleConnectionTimeout: 20 });
    socket.observe(() => {});
    const unsubscribe = socket.subscribe(() => {}, false);
    const transport = await connect(socket);
    const close = vi.spyOn(transport, "close");
    unsubscribe();
    await vi.waitFor(() => expect(close).toHaveBeenCalled());
  });

  it("stop hearing once they stop watching", () => {
    const socket = create();
    const observer = vi.fn();
    socket.observe(observer)();
    socket.subscribe(() => {}, false);
    expect(observer).not.toHaveBeenCalled();
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
        validate: () => new Promise(() => {}),
        vendor: "test",
        version: 1,
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
    first.onclose?.(new CloseEvent("close", { code: 1000, wasClean: true }));
    expect(socket.isIdle).toBe(true);
    window.dispatchEvent(new Event(event));
    await vi.waitFor(() => expect(Transport.instances).toHaveLength(2));
  }
);

it("reconnects on the window's focus, not when an element inside the page takes it", async () => {
  const socket = create();
  const first = await connect(socket);
  first.onclose?.(new CloseEvent("close", { code: 1000, wasClean: true }));
  const button = document.body.appendChild(document.createElement("button"));
  button.focus();
  button.dispatchEvent(new FocusEvent("focus"));
  await new Promise((resolve) => setTimeout(resolve, 20));
  expect(Transport.instances).toHaveLength(1);
  button.remove();

  window.dispatchEvent(new FocusEvent("focus"));
  await vi.waitFor(() => expect(Transport.instances).toHaveLength(2));
});

it.each([1000, 1001, 1005])("ends quietly on a clean close with code %i", async (code) => {
  const socket = create({ retry: true, retryCount: 2 });
  const transport = await connect(socket);
  transport.onclose?.(new CloseEvent("close", { code, wasClean: true }));
  expect(socket.isIdle).toBe(true);
  expect(socket.isError).toBe(false);
  expect(socket.isExhausted).toBe(false);
});

it("treats a clean close reporting a server error as a failure: retried, then stopped", async () => {
  const socket = create({
    maxJitterValue: 1,
    minJitterValue: 1,
    retry: true,
    retryCount: 1,
    retryDelay: 5,
    retryOnSpecificCloseCodes: [1011],
  });
  const first = await connect(socket);
  first.onclose?.(new CloseEvent("close", { code: 1011, wasClean: true }));
  expect(socket.failureCount).toBe(1);
  await vi.waitFor(() => expect(Transport.instances).toHaveLength(2));
  Transport.instances[1].onclose?.(new CloseEvent("close", { code: 1011, wasClean: true }));
  expect(socket.isExhausted).toBe(true);
  expect(socket.isError).toBe(true);
});

it("stops on a clean close reporting a fault it is not told to retry, counting it once", async () => {
  const socket = create({ retry: true, retryCount: 3 });
  const transport = await connect(socket);
  transport.onclose?.(new CloseEvent("close", { code: 1011, wasClean: true }));
  expect(socket.isExhausted).toBe(true);
  expect(socket.isError).toBe(true);
  expect(socket.failureCount).toBe(1);
});

it("counts an unclean close it will not retry once", async () => {
  const socket = create({ retry: true, retryCount: 3 });
  const transport = await connect(socket);
  transport.onclose?.(new CloseEvent("close", { code: 3001, wasClean: false }));
  expect(socket.isExhausted).toBe(true);
  expect(socket.failureCount).toBe(1);
});

it("ends quietly on a fault close with retrying off, for the environment to revive", async () => {
  const socket = create({ retry: false });
  const transport = await connect(socket);
  transport.onclose?.(new CloseEvent("close", { code: 1011, wasClean: true }));
  expect(socket.isIdle).toBe(true);
  expect(socket.isExhausted).toBe(false);
  expect(socket.failureCount).toBe(0);
  window.dispatchEvent(new Event("online"));
  await vi.waitFor(() => expect(Transport.instances).toHaveLength(2));
});

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
