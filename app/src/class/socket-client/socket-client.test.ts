import { server } from "@/mocks/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { SocketClient } from "./index";

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("socket-client", () => {
  it("socket-client", async () => {
    const client = new SocketClient({
      url: "ws://localhost:3000",
    });

    client.open();
    client.waitUntil("open");
    expect(client.isConnected).toBe(true);
  });
});
