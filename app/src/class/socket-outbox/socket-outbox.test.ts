import { afterEach, describe, expect, it, vi } from "vitest";
import { SocketOutbox } from ".";

const boxes: SocketOutbox[] = [];
function create(options = {}, dispatch = vi.fn((_: unknown) => true)) {
  const notify = vi.fn();
  const box = new SocketOutbox(options, dispatch, notify);
  boxes.push(box);
  return { box, dispatch, notify };
}
afterEach(() => {
  boxes.splice(0).forEach((box) => box.clear());
  vi.useRealTimers();
});

describe("SocketOutbox", () => {
  it("preserves duplicate payloads and primitive identity without deduplication", async () => {
    const { box, dispatch } = create(
      {},
      vi.fn(() => false)
    );
    await box.send(() => "first");
    await box.send(() => "first");
    await box.send(() => 2);
    dispatch.mockReturnValue(true);
    box.flush();
    expect(dispatch.mock.calls.slice(-3).map(([value]) => value)).toEqual([
      "first",
      "first",
      2,
    ]);
  });

  it("reserves order across asynchronous and synchronous sends", async () => {
    const { box, dispatch } = create();
    let resolve!: (value: string) => void;
    const first = box.send(
      () =>
        new Promise((done) => {
          resolve = done;
        })
    );
    await Promise.resolve();
    const second = box.send(async () => "second");
    await box.send(() => "third");
    await second;
    expect(dispatch).not.toHaveBeenCalled();
    resolve("first");
    await first;
    expect(dispatch.mock.calls.map(([value]) => value)).toEqual([
      "first",
      "second",
      "third",
    ]);
  });

  it("bounds the queue and expires blocked entries", async () => {
    vi.useFakeTimers();
    const { box, dispatch, notify } = create(
      { maxQueueSize: 1, queueMaxAge: 50 },
      vi.fn(() => false)
    );
    await box.send(() => 1);
    await expect(box.send(() => 2)).rejects.toThrow("full");
    await vi.advanceTimersByTimeAsync(51);
    dispatch.mockReturnValue(true);
    box.flush();
    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({ action: "expired", size: 0 })
    );
    expect(await box.send(() => 2)).toBe(true);
  });

  it("cancels pending validation without blocking later sends", async () => {
    const { box, dispatch } = create();
    const controller = new AbortController();
    const pending = box.send(() => new Promise(() => {}), controller.signal);
    const rejection = expect(pending).rejects.toMatchObject({
      name: "AbortError",
    });
    await box.send(() => 2);
    controller.abort();
    await rejection;
    expect(dispatch).toHaveBeenCalledWith(2);
  });

  it("does not poison ordering after invalid JSON or rejected validation", async () => {
    const { box, dispatch } = create();
    await expect(
      box.send(async () => {
        throw new Error("invalid");
      })
    ).rejects.toThrow("invalid");
    await expect(box.send(() => undefined)).rejects.toThrow("JSON");
    await box.send(() => "valid");
    expect(dispatch).toHaveBeenCalledWith("valid");
  });

  it("uses canonical JSON for deduplication and releases expired history", async () => {
    vi.useFakeTimers();
    const { box } = create({ deduplicationWindow: 50 });
    expect(await box.send(() => ({ a: 1, b: 2 }))).toBe(true);
    expect(await box.send(() => ({ b: 2, a: 1 }))).toBe(false);
    expect(await box.send(() => ({ nested: { a: 1 } }))).toBe(true);
    expect(await box.send(() => ({ nested: { a: 2 } }))).toBe(true);
    await vi.advanceTimersByTimeAsync(51);
    expect(await box.send(() => ({ b: 2, a: 1 }))).toBe(true);
  });

  it("drops the oldest pending send when explicitly configured", async () => {
    const { box, dispatch } = create(
      { maxQueueSize: 1, queueOverflow: "drop-oldest" },
      vi.fn(() => false)
    );
    await box.send(() => 1);
    await box.send(() => 2);
    dispatch.mockClear().mockReturnValue(true);
    box.flush();
    expect(dispatch.mock.calls).toEqual([[2]]);
  });
  it("expires pending validation and ignores its eventual result", async () => {
    vi.useFakeTimers();
    const { box, dispatch } = create({ queueMaxAge: 50 });
    let finish!: (value: string) => void;
    const pending = box.send(
      () =>
        new Promise<string>((resolve) => {
          finish = resolve;
        })
    );
    const rejection = expect(pending).rejects.toThrow("expired");
    await vi.advanceTimersByTimeAsync(51);
    await rejection;
    finish("too late");
    await expect(box.send(() => "next")).resolves.toBe(true);
    expect(dispatch.mock.calls).toEqual([["next"]]);
  });

  it("releases cancelled capacity immediately", async () => {
    const { box, dispatch } = create({ maxQueueSize: 1 });
    const controller = new AbortController();
    const pending = box.send(() => new Promise(() => {}), controller.signal);
    const rejection = expect(pending).rejects.toMatchObject({
      name: "AbortError",
    });
    controller.abort();
    const next = box.send(() => "next");
    await rejection;
    await expect(next).resolves.toBe(true);
    expect(dispatch).toHaveBeenCalledWith("next");
  });

  it("rejects pending validation when dropped or cleared", async () => {
    const { box } = create({ maxQueueSize: 1, queueOverflow: "drop-oldest" });
    const first = box.send(() => new Promise(() => {}));
    const dropped = expect(first).rejects.toThrow("dropped");
    const second = box.send(() => new Promise(() => {}));
    const cleared = expect(second).rejects.toMatchObject({
      name: "AbortError",
    });
    await dropped;
    box.clear();
    await cleared;
  });

  it("rejects immediate dispatch failure and permits the next send", async () => {
    const dispatch = vi
      .fn()
      .mockImplementationOnce(() => {
        throw new Error("transport");
      })
      .mockReturnValue(true);
    const { box } = create({}, dispatch);
    await expect(box.send(() => "first")).rejects.toThrow("transport");
    await expect(box.send(() => "second")).resolves.toBe(true);
  });
});
