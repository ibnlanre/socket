import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Socket } from ".";

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
const sockets: Socket<any, any, any>[] = [];
function create(options: object = {}) {
  const socket = new Socket<any, any>({
    url: "wss://example.com/ws",
    disableCache: true,
    log: [],
    ...options,
  });
  sockets.push(socket);
  return socket;
}
async function connect(socket: Socket<any, any, any>) {
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
    const first = socket.getSnapshot();
    expect(socket.getSnapshot()).toBe(first);
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
    socket.send({ token: "private" });
    expect(transport.send).not.toHaveBeenCalled();
    transport.bufferedAmount = 0;
    await vi.waitFor(() => expect(transport.send).toHaveBeenCalledTimes(1));
    expect(JSON.stringify(diagnostic.mock.calls)).not.toContain("private");
  });
});
