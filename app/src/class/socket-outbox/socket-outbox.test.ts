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
  it("preserves duplicate payloads and primitive identity without deduplication", () => {
    const { box, dispatch } = create(
      {},
      vi.fn(() => false)
    );
    box.send("first");
    box.send("first");
    box.send(2);
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
    const first = box.sendAsync(
      () =>
        new Promise((done) => {
          resolve = done;
        })
    );
    await Promise.resolve();
    const second = box.sendAsync(async () => "second");
    box.send("third");
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
    box.send(1);
    expect(() => box.send(2)).toThrow("full");
    await vi.advanceTimersByTimeAsync(51);
    dispatch.mockReturnValue(true);
    box.flush();
    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({ action: "expired", size: 0 })
    );
    expect(box.send(2)).toBe(true);
  });

  it("cancels pending validation without blocking later sends", async () => {
    const { box, dispatch } = create();
    const controller = new AbortController();
    const pending = box.sendAsync(
      () => new Promise(() => {}),
      controller.signal
    );
    const rejection = expect(pending).rejects.toMatchObject({
      name: "AbortError",
    });
    box.send(2);
    controller.abort();
    await rejection;
    expect(dispatch).toHaveBeenCalledWith(2);
  });

  it("does not poison ordering after invalid JSON or rejected validation", async () => {
    const { box, dispatch } = create();
    await expect(
      box.sendAsync(async () => {
        throw new Error("invalid");
      })
    ).rejects.toThrow("invalid");
    expect(() => box.send(undefined)).toThrow("JSON");
    box.send("valid");
    expect(dispatch).toHaveBeenCalledWith("valid");
  });

  it("uses canonical JSON for deduplication and releases expired history", async () => {
    vi.useFakeTimers();
    const { box } = create({ deduplicationWindow: 50 });
    expect(box.send({ a: 1, b: 2 })).toBe(true);
    expect(box.send({ b: 2, a: 1 })).toBe(false);
    expect(box.send({ nested: { a: 1 } })).toBe(true);
    expect(box.send({ nested: { a: 2 } })).toBe(true);
    await vi.advanceTimersByTimeAsync(51);
    expect(box.send({ b: 2, a: 1 })).toBe(true);
  });

  it("drops the oldest pending send when explicitly configured", () => {
    const { box, dispatch } = create(
      { maxQueueSize: 1, queueOverflow: "drop-oldest" },
      vi.fn(() => false)
    );
    box.send(1);
    box.send(2);
    dispatch.mockClear().mockReturnValue(true);
    box.flush();
    expect(dispatch.mock.calls).toEqual([[2]]);
  });
});
