import type { WebSocketConstructor } from "@/types/runtime";

import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SocketClient } from "@/class/socket-client";

import { useExhaustedSockets } from ".";
import { reconnectExhausted } from "../reconnect-exhausted";

/** A transport the test opens and drops by hand. */
class Transport extends EventTarget {
  static instances: Transport[] = [];
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
  drop() {
    this.readyState = 3;
    this.onclose?.(new CloseEvent("close", { code: 1006, wasClean: false }));
  }
}

const clients: SocketClient<unknown, never, { room: string }>[] = [];

/** A client whose sockets give up at their first failure. */
function client(name: string) {
  const created = new SocketClient<unknown, never, { room: string }>({
    disableCache: true,
    log: [],
    retry: true,
    retryCount: 0,
    runtime: { webSocket: Transport as unknown as WebSocketConstructor },
    url: `wss://example.com/${name}`,
  });
  clients.push(created);
  return created;
}

/** Subscribe to a room's socket, open it, connect it, then drop it for good. */
async function stopped(from: SocketClient<unknown, never, { room: string }>, room: string) {
  const socket = await from.get({ room });
  const unsubscribe = socket.subscribe(() => {}, false);
  socket.open();
  await waitFor(() => expect(socket.ws).not.toBeNull());
  const transport = socket.ws as unknown as Transport;
  transport.connect();
  transport.drop();
  return { socket, transport, unsubscribe };
}

beforeEach(() => {
  Transport.instances = [];
});

afterEach(() => {
  cleanup();
  clients.splice(0).forEach((each) => each.dispose());
});

/** Connect every transport created from `from` on. */
function connectFrom(from: number) {
  Transport.instances.slice(from).forEach((transport) => transport.connect());
}

describe("SocketClient: stopped sockets", () => {
  it("lists the sockets that stopped, until nothing reads them", async () => {
    const chat = client("chat");
    const { socket, unsubscribe } = await stopped(chat, "a");
    expect(chat.exhausted()).toEqual([socket]);

    // Nothing reads it any more: nothing waits for it to be reopened.
    unsubscribe();
    expect(socket.isExhausted).toBe(false);
    expect(chat.exhausted()).toEqual([]);
  });

  it("lists a stopped socket opened without subscribers", async () => {
    const chat = client("chat");
    const socket = await chat.get({ room: "a" });
    socket.open();
    await waitFor(() => expect(socket.ws).not.toBeNull());
    (socket.ws as unknown as Transport).drop();
    expect(chat.exhausted()).toEqual([socket]);
  });

  it("tells its observers when a socket stops", async () => {
    const chat = client("chat");
    const listener = vi.fn();
    chat.observe(listener);
    await stopped(chat, "a");
    expect(listener).toHaveBeenCalled();
  });

  it("reopens its stopped sockets, and resolves once they connect", async () => {
    const chat = client("chat");
    const first = await stopped(chat, "a");
    const second = await stopped(chat, "b");
    const opened = Transport.instances.length;

    const pending = chat.reconnect({ stagger: 5 });
    await waitFor(() => expect(Transport.instances.length).toBe(opened + 2));
    connectFrom(opened);

    await expect(pending).resolves.toBe(2);
    expect(first.socket.isExhausted).toBe(false);
    expect(second.socket.isExhausted).toBe(false);
    expect(chat.exhausted()).toEqual([]);
  });

  it("counts only those that connect; one that fails again stops again", async () => {
    const chat = client("chat");
    await stopped(chat, "a");
    const failing = await stopped(chat, "b");
    const opened = Transport.instances.length;

    const pending = chat.reconnect();
    await waitFor(() => expect(Transport.instances.length).toBe(opened + 2));
    Transport.instances[opened].connect();
    Transport.instances[opened + 1].drop();

    await expect(pending).resolves.toBe(1);
    expect(chat.exhausted()).toEqual([failing.socket]);
  });

  it("still reopens the rest when one is disposed meanwhile", async () => {
    const chat = client("chat");
    const gone = await stopped(chat, "a");
    await stopped(chat, "b");
    const opened = Transport.instances.length;
    const sockets = chat.exhausted();
    gone.socket.dispose();

    const pending = reconnectExhausted([{ exhausted: () => sockets }]);
    await waitFor(() => expect(Transport.instances.length).toBe(opened + 1));
    connectFrom(opened);
    await expect(pending).resolves.toBe(1);
  });
});

/** A stand-in stopped socket that records when it was opened, and connects at once. */
function stand(name: string, order: string[]) {
  const observers = new Set<() => void>();
  const socket = {
    isConnected: false,
    isExhausted: true,
    isIdle: true,
    observe: (listener: () => void) => {
      observers.add(listener);
      return () => observers.delete(listener);
    },
    open: () => {
      order.push(`${name}@${Date.now()}`);
      Object.assign(socket, { isConnected: true, isExhausted: false, isIdle: false });
      observers.forEach((listener) => listener());
    },
  };
  return socket;
}

describe("reconnectExhausted", () => {
  it("waits stagger between one socket and the next, across clients", async () => {
    const order: string[] = [];
    vi.useFakeTimers();
    const pending = reconnectExhausted(
      [{ exhausted: () => [stand("a", order), stand("b", order)] }, { exhausted: () => [stand("c", order)] }],
      { stagger: 100 }
    );
    expect(order).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(100);
    expect(order).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(100);
    await expect(pending).resolves.toBe(3);
    vi.useRealTimers();
  });
});

describe("useExhaustedSockets", () => {
  it("counts the stopped sockets across clients, and reconnects them", async () => {
    const chat = client("chat");
    const prices = client("prices");
    const { result } = renderHook(() => useExhaustedSockets([chat, prices]));
    expect(result.current.count).toBe(0);

    await act(async () => {
      await stopped(chat, "a");
      await stopped(prices, "b");
    });
    expect(result.current.count).toBe(2);

    const opened = Transport.instances.length;
    let pending!: Promise<number>;
    act(() => {
      pending = result.current.reconnect();
    });
    await waitFor(() => expect(Transport.instances.length).toBe(opened + 2));
    // Still reconnecting until the handshakes end.
    expect(result.current.isReconnecting).toBe(true);

    await act(async () => {
      connectFrom(opened);
      await pending;
    });
    expect(result.current.count).toBe(0);
    expect(result.current.isReconnecting).toBe(false);
  });

  it("keeps watching when given a fresh array of the same clients", async () => {
    const chat = client("chat");
    const { rerender, result } = renderHook(() => useExhaustedSockets([chat]));
    rerender();
    await act(async () => {
      await stopped(chat, "a");
    });
    expect(result.current.count).toBe(1);
  });
});
