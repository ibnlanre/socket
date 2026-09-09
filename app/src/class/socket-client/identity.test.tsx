import { Socket } from "@/class/socket";
import type { StandardSchemaV1 } from "@standard-schema/spec";
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, expectTypeOf, it, vi } from "vitest";
import { z } from "zod";
import { StrictMode } from "react";
import { SocketClient } from ".";

const configuration = {
  baseURL: "wss://example.com",
  url: "/ws",
  disableCache: true,
};

describe("connection identity", () => {
  it("uses normalized output for both pooling and the connection URL", async () => {
    const client = new SocketClient({
      ...configuration,
      paramsSchema: z.object({ room: z.string().toLowerCase() }),
    });
    const first = await client.get({ room: "GENERAL" });
    expect(first.path).toBe("/ws?room=general");
    expect(await client.get({ room: "general" })).toBe(first);
    client.dispose();
  });

  it("ignores object order and encodes query values exactly once", async () => {
    const client = new SocketClient<unknown, never, { a: string; b: string }>(
      configuration
    );
    const socket = await client.get({ a: "hello world", b: "&+/é" });
    expect(await client.get({ b: "&+/é", a: "hello world" })).toBe(socket);
    expect(
      new URL(socket.path, configuration.baseURL).searchParams.get("b")
    ).toBe("&+/é");
    client.dispose();
  });

  it("deduplicates resolution while cancelling callers independently", async () => {
    let resolve!: () => void;
    const validate = vi.fn(async (value: unknown) => {
      await new Promise<void>((done) => {
        resolve = done;
      });
      return { value: { room: String(value).toLowerCase() } };
    });
    const paramsSchema: StandardSchemaV1<string, { room: string }> = {
      "~standard": { version: 1, vendor: "test", validate },
    };
    const client = new SocketClient({ ...configuration, paramsSchema });
    const controller = new AbortController();
    const cancelled = client.get("GENERAL", { signal: controller.signal });
    const rejection = expect(cancelled).rejects.toMatchObject({
      name: "AbortError",
    });
    const pending = client.get("GENERAL");
    await Promise.resolve();
    controller.abort();
    await rejection;
    resolve();
    const socket = await pending;
    expect(validate).toHaveBeenCalledTimes(1);
    expect(socket.path).toBe("/ws?room=general");
    client.dispose();
  });

  it("infers schema input and output independently", async () => {
    const client = new SocketClient({
      ...configuration,
      paramsSchema: z.string().transform((room) => ({ room })),
      sendSchema: z.string().transform((content) => ({ content })),
      messageSchema: z.string().transform(Number),
    });
    const socket = await client.get("general");
    expectTypeOf(socket.value).toEqualTypeOf<number | undefined>();
    expectTypeOf(socket.send).parameter(0).toEqualTypeOf<string>();
    expectTypeOf(socket.send).returns.toEqualTypeOf<Promise<boolean>>();
    client.dispose();
  });

  it("surfaces asynchronous parameter errors through the subscription", async () => {
    const client = new SocketClient({
      ...configuration,
      paramsSchema: z
        .string()
        .refine(async () => false)
        .transform((room) => ({ room })),
    });
    const hook = renderHook(() => client.useSocket({ params: "bad" }));
    expect(hook.result.current.isPreparing).toBe(true);
    await waitFor(() => expect(hook.result.current.isError).toBe(true));
    expect(hook.result.current.error).toBeInstanceOf(Error);
    expect(hook.result.current.isPreparing).toBe(false);
    hook.unmount();
    client.dispose();
  });

  it("does not validate disabled subscriptions and still selects placeholder data", () => {
    const validate = vi.fn(() => ({ issues: [{ message: "unused" }] }));
    const client = new SocketClient({
      ...configuration,
      placeholderData: 2,
      paramsSchema: { "~standard": { version: 1, vendor: "test", validate } },
    });
    const hook = renderHook(() =>
      client.useSocket({ enabled: false, select: (value) => (value ?? 0) * 2 })
    );
    expect(hook.result.current.data).toBe(4);
    expect(hook.result.current.isIdle).toBe(true);
    expect(validate).not.toHaveBeenCalled();
    hook.unmount();
    client.dispose();
  });

  it("invalidates pending resolution when cleared and remains reusable", async () => {
    let resolve!: (value: { value: { room: string } }) => void;
    const client = new SocketClient({
      ...configuration,
      paramsSchema: {
        "~standard": {
          version: 1,
          vendor: "test",
          validate: () =>
            new Promise<{ value: { room: string } }>((done) => {
              resolve = done;
            }),
        },
      },
    });
    const pending = client.get();
    const rejection = expect(pending).rejects.toMatchObject({
      name: "AbortError",
    });
    await Promise.resolve();
    client.clear();
    resolve({ value: { room: "old" } });
    await rejection;
    const next = client.get();
    await Promise.resolve();
    resolve({ value: { room: "new" } });
    expect((await next).path).toContain("new");
    client.dispose();
    await expect(client.get()).rejects.toThrow("disposed");
  });

  it("cancels pending sends and ignores resolution from previous parameters", async () => {
    const client = new SocketClient<unknown, string, { room: string }>(
      configuration
    );
    const first = new Socket<unknown, string>(configuration);
    const second = new Socket<unknown, string>(configuration);
    const firstOpen = vi.spyOn(first, "open").mockImplementation(() => {});
    const secondOpen = vi.spyOn(second, "open").mockImplementation(() => {});
    const firstSend = vi.spyOn(first, "send");
    const secondSend = vi.spyOn(second, "send").mockResolvedValue(true);
    let resolveFirst!: (socket: typeof first) => void;
    let resolveSecond!: (socket: typeof second) => void;
    vi.spyOn(client, "get")
      .mockImplementationOnce(
        () =>
          new Promise((done) => {
            resolveFirst = done;
          })
      )
      .mockImplementationOnce(
        () =>
          new Promise((done) => {
            resolveSecond = done;
          })
      );
    const hook = renderHook(
      ({ room }) => client.useSocket({ params: { room } }),
      {
        initialProps: { room: "first" },
      }
    );
    const pending = hook.result.current.send("old");
    const rejected = expect(pending).rejects.toMatchObject({
      name: "AbortError",
    });
    hook.rerender({ room: "second" });
    await rejected;
    const next = hook.result.current.send("new");
    await act(async () => {
      resolveSecond(second);
      await next;
    });
    await waitFor(() => expect(secondOpen).toHaveBeenCalledOnce());
    await act(async () => {
      resolveFirst(first);
    });
    expect(firstOpen).not.toHaveBeenCalled();
    expect(firstSend).not.toHaveBeenCalled();
    expect(secondSend).toHaveBeenCalledWith("new", expect.any(Object));
    hook.unmount();
    first.dispose();
    second.dispose();
    client.dispose();
  });

  it("cancels a pending subscription send on unmount", async () => {
    const client = new SocketClient<unknown, string>(configuration);
    vi.spyOn(client, "get").mockImplementation(() => new Promise(() => {}));
    const hook = renderHook(() => client.useSocket());
    const pending = hook.result.current.send("message");
    const rejection = expect(pending).rejects.toMatchObject({
      name: "AbortError",
    });
    hook.unmount();
    await rejection;
    client.dispose();
  });

  it("owns the live resolution after Strict Mode replays effects", async () => {
    const client = new SocketClient<unknown, string>(configuration);
    const socket = new Socket<unknown, string>(configuration);
    vi.spyOn(socket, "open").mockImplementation(() => {});
    const send = vi.spyOn(socket, "send").mockResolvedValue(true);
    const get = vi.spyOn(client, "get").mockResolvedValue(socket);
    const hook = renderHook(() => client.useSocket(), { wrapper: StrictMode });
    await waitFor(() => expect(hook.result.current.isPreparing).toBe(false));
    expect(get).toHaveBeenCalledTimes(2);
    expect(get.mock.calls[0][1]?.signal?.aborted).toBe(true);
    await expect(hook.result.current.send("message")).resolves.toBe(true);
    expect(send).toHaveBeenCalledOnce();
    hook.unmount();
    socket.dispose();
    client.dispose();
  });

  it("changes clients without reusing the previous subscription", async () => {
    const first = new SocketClient<unknown, string>(configuration);
    const second = new SocketClient<unknown, string>(configuration);
    vi.spyOn(first, "get").mockImplementation(() => new Promise(() => {}));
    const socket = new Socket<unknown, string>(configuration);
    vi.spyOn(socket, "open").mockImplementation(() => {});
    const send = vi.spyOn(socket, "send").mockResolvedValue(true);
    vi.spyOn(second, "get").mockResolvedValue(socket);
    const hook = renderHook(({ client }) => client.useSocket(), {
      initialProps: { client: first },
    });
    const oldSend = hook.result.current.send;
    hook.rerender({ client: second });
    await expect(oldSend("old")).rejects.toThrow("disabled");
    await act(async () => {
      await hook.result.current.send("new");
    });
    expect(send).toHaveBeenCalledWith("new", expect.any(Object));
    hook.unmount();
    socket.dispose();
    first.dispose();
    second.dispose();
  });

  it("bounds retained identities without evicting a shared socket implicitly", async () => {
    const client = new SocketClient<unknown, never, { room: string }>({
      ...configuration,
      maxPoolSize: 1,
    });
    const first = await client.get({ room: "first" });
    await expect(client.get({ room: "second" })).rejects.toThrow(
      "pool is full"
    );
    expect(await client.get({ room: "first" })).toBe(first);
    await client.evict({ room: "first" });
    expect(() => first.open()).toThrow("disposed");
    expect((await client.get({ room: "second" })).path).toContain("second");
    client.dispose();
  });
});
