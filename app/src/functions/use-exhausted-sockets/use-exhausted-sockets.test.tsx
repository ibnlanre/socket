import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SocketClient } from "@/class/socket-client";
import type { WebSocketConstructor } from "@/types/runtime";

import { reconnectExhausted } from "../reconnect-exhausted";
import { useExhaustedSockets } from ".";

/** A transport the test opens and drops by hand. */
class Transport extends EventTarget {
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
  drop() {
    this.readyState = 3;
    this.onclose?.(new CloseEvent("close", { code: 1006, wasClean: false }));
  }
  close() {
    this.readyState = 3;
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

describe("SocketClient: stopped sockets", () => {
  it("lists the sockets that stopped and are still read", async () => {
    const chat = client("chat");
    const { socket, unsubscribe } = await stopped(chat, "a");
    expect(chat.exhausted()).toEqual([socket]);

    // Nothing reads it any more: nothing to offer to reconnect.
    unsubscribe();
    expect(chat.exhausted()).toEqual([]);
  });

  it("tells its listeners when a socket stops", async () => {
    const chat = client("chat");
    const listener = vi.fn();
    chat.subscribe(listener);
    await stopped(chat, "a");
    expect(listener).toHaveBeenCalled();
  });

  it("reopens its stopped sockets, one after another", async () => {
    const chat = client("chat");
    const first = await stopped(chat, "a");
    const second = await stopped(chat, "b");
    const opened = Transport.instances.length;

    await expect(chat.reconnect({ stagger: 5 })).resolves.toBe(2);
    await waitFor(() => expect(Transport.instances.length).toBe(opened + 2));
    expect(first.socket.isExhausted).toBe(false);
    expect(second.socket.isExhausted).toBe(false);
    expect(chat.exhausted()).toEqual([]);
  });
});

describe("reconnectExhausted", () => {
  it("waits stagger between one socket and the next, across clients", async () => {
    const order: string[] = [];
    const at = (name: string) => ({ open: () => order.push(`${name}@${Date.now()}`) });
    vi.useFakeTimers();
    const pending = reconnectExhausted(
      [{ exhausted: () => [at("a"), at("b")] }, { exhausted: () => [at("c")] }],
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

    await act(async () => {
      await result.current.reconnect();
    });
    await waitFor(() => expect(result.current.count).toBe(0));
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
