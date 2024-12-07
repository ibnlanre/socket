import { server } from "@/mocks/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { SocketClient } from "./index";

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("SocketClient", () => {
  it("should create a new instance", () => {
    const client = new SocketClient({
      url: "wss://echo.websocket.org",
    });

    expect(client).toBeDefined();
  });

  it("should connect to the server", async () => {
    const client = new SocketClient({
      url: "wss://echo.websocket.org",
    });

    client.open();
    await client.waitUntil("open");
    expect(client.isConnected).toBe(true);
  });

  it("should retry connection on specific close codes", async () => {
    const client = new SocketClient({
      url: "wss://echo.websocket.org",
      retry: true,
      retryCount: 2,
      retryOnSpecificCloseCodes: [3000], // Abnormal Closure
    });

    client.open();
    await client.waitUntil("open");

    client.ws?.close(3000);
    await client.waitUntil("close");
    expect(client.isIdle).toBe(true);
  });
});
