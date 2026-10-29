import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Socket } from "@/class/socket";
import type { WebSocketConstructor } from "@/types/runtime";

import { SocketGate } from ".";

describe("SocketGate", () => {
  afterEach(() => vi.useRealTimers());

  it("lets concurrency turns through to one server, and queues the rest in order", async () => {
    const gate = new SocketGate({ concurrency: 2 });
    const order: string[] = [];
    const first = await gate.acquire("wss://a");
    const second = await gate.acquire("wss://a");
    const third = gate.acquire("wss://a").then((release) => (order.push("third"), release));
    const fourth = gate.acquire("wss://a").then((release) => (order.push("fourth"), release));
    expect(gate.load("wss://a")).toEqual({ active: 2, waiting: 2 });

    first();
    await third;
    expect(order).toEqual(["third"]);
    second();
    await fourth;
    expect(order).toEqual(["third", "fourth"]);
  });

  it("keeps each server's turns apart", async () => {
    const gate = new SocketGate();
    await gate.acquire("wss://a");
    await expect(gate.acquire("wss://b")).resolves.toBeTypeOf("function");
    expect(gate.load("wss://a")).toEqual({ active: 1, waiting: 0 });
    expect(gate.load("wss://b")).toEqual({ active: 1, waiting: 0 });
  });

  it("paces servers mapped to one lane together", async () => {
    const gate = new SocketGate({ lane: () => "proxy" });
    await gate.acquire("wss://prices.example.com/feed");
    const waiting = vi.fn();
    void gate.acquire("wss://orders.example.com/feed").then(waiting);
    await Promise.resolve();
    expect(waiting).not.toHaveBeenCalled();
    expect(gate.load("wss://anything")).toEqual({ active: 1, waiting: 1 });
  });

  it("ends a turn once, however often it is released", async () => {
    const gate = new SocketGate();
    const release = await gate.acquire("wss://a");
    const next = gate.acquire("wss://a");
    release();
    release();
    await next;
    expect(gate.load("wss://a")).toEqual({ active: 1, waiting: 0 });
  });

  it("ends a turn that outlives its timeout, so a silent server cannot hold the queue", async () => {
    vi.useFakeTimers();
    const gate = new SocketGate({ timeout: 1000 });
    await gate.acquire("wss://a");
    const next = vi.fn();
    void gate.acquire("wss://a").then(next);
    await vi.advanceTimersByTimeAsync(999);
    expect(next).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(next).toHaveBeenCalled();
  });

  it("takes an aborted wait out of the queue", async () => {
    const gate = new SocketGate();
    const release = await gate.acquire("wss://a");
    const controller = new AbortController();
    const abandoned = gate.acquire("wss://a", { signal: controller.signal });
    const waiting = gate.acquire("wss://a");
    controller.abort(new Error("gone"));
    await expect(abandoned).rejects.toThrow("gone");
    expect(gate.load("wss://a")).toEqual({ active: 1, waiting: 1 });
    release();
    await expect(waiting).resolves.toBeTypeOf("function");
  });

  it("refuses a concurrency below one", () => {
    expect(() => new SocketGate({ concurrency: 0 })).toThrow(RangeError);
  });
});

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
    const event = new CloseEvent("close", { code: 1006, wasClean: false });
    Object.defineProperty(event, "target", { value: this });
    this.onclose?.(event);
  }
  close() {
    this.readyState = 3;
  }
}

describe("sockets sharing a gate", () => {
  const sockets: Socket<unknown, unknown>[] = [];
  const create = (gate: SocketGate, path: string, options: object = {}) => {
    const socket = new Socket<unknown, unknown>({
      disableCache: true,
      gate,
      log: [],
      runtime: { webSocket: Transport as unknown as WebSocketConstructor },
      url: `wss://example.com/${path}`,
      ...options,
    });
    sockets.push(socket);
    return socket;
  };

  beforeEach(() => {
    Transport.instances = [];
  });
  afterEach(() => {
    sockets.splice(0).forEach((socket) => socket.dispose());
  });

  it("begin their handshakes one after another, each once the last has opened", async () => {
    const gate = new SocketGate();
    const first = create(gate, "a");
    const second = create(gate, "b");
    first.open();
    second.open();
    await vi.waitFor(() => expect(Transport.instances).toHaveLength(1));
    expect(second.isPreparing).toBe(true);

    Transport.instances[0].connect();
    await vi.waitFor(() => expect(Transport.instances).toHaveLength(2));
    expect(Transport.instances[1].url).toContain("/b");
  });

  it("let the next go when a handshake fails", async () => {
    const gate = new SocketGate();
    const first = create(gate, "a", { retry: false });
    const second = create(gate, "b");
    first.open();
    second.open();
    await vi.waitFor(() => expect(Transport.instances).toHaveLength(1));
    Transport.instances[0].drop();
    await vi.waitFor(() => expect(Transport.instances).toHaveLength(2));
  });

  it("give up a waiting turn when closed", async () => {
    const gate = new SocketGate();
    const first = create(gate, "a");
    const second = create(gate, "b");
    first.open();
    second.open();
    await vi.waitFor(() => expect(gate.load("wss://example.com")).toEqual({ active: 1, waiting: 1 }));
    second.close();
    await vi.waitFor(() => expect(gate.load("wss://example.com")).toEqual({ active: 1, waiting: 0 }));
  });

  it("take turns on retries too", async () => {
    const gate = new SocketGate();
    const retrying = create(gate, "a", {
      maxJitterValue: 1,
      minJitterValue: 1,
      retry: true,
      retryCount: 3,
      retryDelay: 5,
    });
    const other = create(gate, "b");
    retrying.open();
    await vi.waitFor(() => expect(Transport.instances).toHaveLength(1));
    other.open();
    Transport.instances[0].drop();
    // The waiting socket goes first; the retry waits behind it.
    await vi.waitFor(() => expect(Transport.instances).toHaveLength(2));
    expect(Transport.instances[1].url).toContain("/b");
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(Transport.instances).toHaveLength(2);
    Transport.instances[1].connect();
    await vi.waitFor(() => expect(Transport.instances).toHaveLength(3));
    expect(Transport.instances[2].url).toContain("/a");
  });
});
