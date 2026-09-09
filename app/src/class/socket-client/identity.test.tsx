import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, expectTypeOf, it, vi } from "vitest";
import { z } from "zod";
import type { StandardSchemaV1 } from "@standard-schema/spec";
import { SocketClient } from ".";
import type { PreparedParams } from "@/types/socket/prepared-params";

const configuration = {
  baseURL: "wss://example.com",
  url: "/ws",
  disableCache: true,
};

describe("connection identity and parameter preparation", () => {
  it("uses normalized output for both pooling and the connection URL", () => {
    const client = new SocketClient({
      ...configuration,
      paramsSchema: z.object({ room: z.string().toLowerCase() }),
    });
    const first = client.get({ room: "GENERAL" });
    expect(first.path).toBe("/ws?room=general");
    expect(client.get({ room: "general" })).toBe(first);
    client.closeAll();
  });

  it("ignores object order and encodes query values exactly once", () => {
    const client = new SocketClient<unknown, never, { a: string; b: string }>({
      ...configuration,
    });
    const socket = client.get({ a: "hello world", b: "&+/é" });
    expect(client.get({ b: "&+/é", a: "hello world" })).toBe(socket);
    expect(
      new URL(socket.path, configuration.baseURL).searchParams.get("b")
    ).toBe("&+/é");
    client.closeAll();
  });

  it("deduplicates preparation while cancelling callers independently", async () => {
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
    const cancelled = client.prepare("GENERAL", { signal: controller.signal });
    const rejection = expect(cancelled).rejects.toMatchObject({
      name: "AbortError",
    });
    const pending = client.prepare("GENERAL");
    await Promise.resolve();
    controller.abort();
    await rejection;
    resolve();
    const prepared = await pending;
    expect(validate).toHaveBeenCalledTimes(1);
    expect(client.get(prepared).path).toBe("/ws?room=general");
    expect(client.get(prepared)).toBe(client.get(prepared));
    const other = new SocketClient(configuration);
    expect(() => other.get(prepared as never)).toThrow("another client");
    client.closeAll();
  });

  it("infers schema input and output independently", async () => {
    const client = new SocketClient({
      ...configuration,
      paramsSchema: z.string().transform((room) => ({ room })),
      sendSchema: z.string().transform((content) => ({ content })),
      messageSchema: z.string().transform(Number),
    });
    const prepared = await client.prepare("general");
    expectTypeOf(prepared).toEqualTypeOf<PreparedParams<{ room: string }>>();
    expectTypeOf(client.get(prepared).value).toEqualTypeOf<
      number | undefined
    >();
    expectTypeOf(client.get(prepared).send)
      .parameter(0)
      .toEqualTypeOf<string>();
    client.closeAll();
  });

  it("exposes pending and error states without starting async work during render", async () => {
    const client = new SocketClient({
      ...configuration,
      paramsSchema: z
        .string()
        .refine(async (room) => room !== "bad")
        .transform((room) => ({ room })),
    });
    const { result, rerender, unmount } = renderHook(
      ({ room }) => client.usePreparedParams(room),
      { initialProps: { room: "first" } }
    );
    expect(result.current.isPending).toBe(true);
    await waitFor(() =>
      expect(result.current.params?.params.room).toBe("first")
    );
    rerender({ room: "bad" });
    expect(result.current.params).toBeUndefined();
    await waitFor(() => expect(result.current.error).toBeInstanceOf(Error));
    unmount();
    client.closeAll();
  });

  it("selects data without rendering for unrelated snapshot changes", () => {
    const client = new SocketClient<number>({
      ...configuration,
      placeholderData: 1,
    });
    let renders = 0;
    const hook = renderHook(() => {
      renders++;
      return client.useValue({ enabled: false });
    });
    const before = renders;
    act(() => client.get().close());
    expect(hook.result.current).toBe(1);
    expect(renders).toBe(before);
    hook.unmount();
    client.closeAll();
  });
});

it("bounds retained identities without evicting a shared socket implicitly", () => {
  const client = new SocketClient<unknown, never, { room: string }>({
    ...configuration,
    maxPoolSize: 1,
  });
  const first = client.get({ room: "first" });
  expect(() => client.get({ room: "second" })).toThrow("pool is full");
  expect(client.get({ room: "first" })).toBe(first);
  client.evict({ room: "first" });
  expect(() => first.open()).toThrow("disposed");
  expect(client.get({ room: "second" }).path).toContain("second");
  client.closeAll();
});
