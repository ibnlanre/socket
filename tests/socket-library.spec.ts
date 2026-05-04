import { expect, test } from "@playwright/test";

import {
  createTestWebSocketServer,
  type TestWebSocketServer,
} from "./helpers/ws-test-server";

test.describe("socket library example", () => {
  let server: TestWebSocketServer;

  test.beforeEach(async () => {
    server = await createTestWebSocketServer();
  });

  test.afterEach(async () => {
    await server.close();
  });

  test("connects and sends through createSocketClient", async ({ page }) => {
    await page.goto(`/?ws=${encodeURIComponent(server.url)}`);

    await expect(page.getByTestId("socket-url")).toHaveText(server.url);
    await expect(page.getByTestId("fetch-status")).toHaveText("connected");
    await expect(page.getByTestId("message-output")).toContainText(
      '"type":"connection"'
    );

    await page.getByTestId("send-button").click();

    await expect(page.getByTestId("message-output")).toContainText(
      '"type":"echo"'
    );
    await expect(page.getByTestId("message-output")).toContainText(
      '"message":"hello from playwright"'
    );
  });

  test("reconnects after an abnormal close when retry is enabled", async ({
    page,
  }) => {
    const reconnectUrl = `${server.url}&mode=reconnect`;

    await page.goto(
      `/?ws=${encodeURIComponent(reconnectUrl)}&retry=true&retryDelay=20`
    );

    await expect(page.getByTestId("message-output")).toContainText(
      '"attempt":2'
    );
    await expect(page.getByTestId("fetch-status")).toHaveText("connected");
    await expect(page.getByTestId("socket-status")).toHaveText("success");
  });

  test("does not retry after a clean close even when retry is enabled", async ({
    page,
  }) => {
    const cleanCloseUrl = `${server.url}&mode=clean-close`;

    await page.goto(
      `/?ws=${encodeURIComponent(cleanCloseUrl)}&retry=true&retryDelay=20`
    );

    await expect(page.getByTestId("message-output")).toContainText(
      '"attempt":1'
    );
    await expect(page.getByTestId("fetch-status")).toHaveText("idle");
    await expect(page.getByTestId("failure-count")).toHaveText("0");
    expect(server.getUpgradeAttempts(cleanCloseUrl)).toBe(1);
  });

  test("reconnects on window focus after settling idle", async ({ page }) => {
    const focusUrl = `${server.url}&mode=clean-close`;

    await page.goto(`/?ws=${encodeURIComponent(focusUrl)}`);

    await expect(page.getByTestId("fetch-status")).toHaveText("idle");

    await page.evaluate(() => {
      window.dispatchEvent(new Event("focus"));
    });

    await expect(page.getByTestId("message-output")).toContainText(
      '"attempt":2'
    );
    await expect(page.getByTestId("fetch-status")).toHaveText("connected");
  });

  test("reconnects on network restore after settling idle", async ({
    page,
  }) => {
    const onlineUrl = `${server.url}&mode=clean-close`;

    await page.goto(`/?ws=${encodeURIComponent(onlineUrl)}`);

    await expect(page.getByTestId("fetch-status")).toHaveText("idle");

    await page.evaluate(() => {
      window.dispatchEvent(new Event("online"));
    });

    await expect(page.getByTestId("message-output")).toContainText(
      '"attempt":2'
    );
    await expect(page.getByTestId("fetch-status")).toHaveText("connected");
  });

  test("stops retrying after retry exhaustion", async ({ page }) => {
    const exhaustionUrl = `${server.url}&mode=retry-exhaustion`;

    await page.goto(
      `/?ws=${encodeURIComponent(exhaustionUrl)}&retry=true&retryDelay=20&retryCount=2`
    );

    await expect.poll(() => server.getUpgradeAttempts(exhaustionUrl)).toBe(3);
    await expect(page.getByTestId("fetch-status")).toHaveText("idle");
    await expect(page.getByTestId("message-output")).toHaveText("waiting");
    await expect(page.getByTestId("socket-status")).toHaveText("error");
    await expect(page.getByTestId("failure-count")).toHaveText("3");
    await expect(page.getByTestId("failure-reason")).not.toHaveText("none");
    await expect(page.getByTestId("error-message")).not.toHaveText("none");
  });

  test("flushes a queued send issued before the socket opens", async ({
    page,
  }) => {
    const queuedUrl = `${server.url}&mode=queue`;

    await page.goto(
      `/?ws=${encodeURIComponent(queuedUrl)}&sendOnMount=true&message=${encodeURIComponent("queued from playwright")}`
    );

    await expect(page.getByTestId("send-result")).toHaveText("true");
    await expect(page.getByTestId("message-output")).toContainText(
      '"type":"echo"'
    );
    await expect(page.getByTestId("message-output")).toContainText(
      '"message":"queued from playwright"'
    );
  });

  test("surfaces invalid inbound messages and recovers on the next valid one", async ({
    page,
  }) => {
    const invalidUrl = `${server.url}&mode=invalid-message`;

    await page.goto(`/?ws=${encodeURIComponent(invalidUrl)}`);

    await expect(page.getByTestId("socket-status")).toHaveText("error");
    await expect(page.getByTestId("error-message")).toContainText(
      "Invalid input"
    );
    await expect(page.getByTestId("message-output")).toContainText(
      '"type":"connection"'
    );

    await page.getByTestId("send-button").click();

    await expect(page.getByTestId("socket-status")).toHaveText("success");
    await expect(page.getByTestId("error-message")).toHaveText("none");
    await expect(page.getByTestId("message-output")).toContainText(
      '"type":"echo"'
    );
    await expect(page.getByTestId("message-output")).toContainText('"count":1');
  });

  test("closes the socket when parse failures are configured as fatal", async ({
    page,
  }) => {
    const invalidJsonUrl = `${server.url}&mode=invalid-json`;

    await page.goto(
      `/?ws=${encodeURIComponent(invalidJsonUrl)}&parseFailureAction=close`
    );

    await expect(page.getByTestId("message-output")).toContainText(
      '"type":"connection"'
    );
    await expect(page.getByTestId("socket-status")).toHaveText("error");
    await expect(page.getByTestId("fetch-status")).toHaveText("idle");
    await expect(page.getByTestId("failure-reason")).not.toHaveText("none");
    await expect(page.getByTestId("error-message")).not.toHaveText("none");
    expect(server.getUpgradeAttempts(invalidJsonUrl)).toBe(1);
  });

  test("surfaces outbound schema validation errors before sending", async ({
    page,
  }) => {
    await page.goto(`/?ws=${encodeURIComponent(server.url)}`);

    await page.getByTestId("send-invalid-button").click();

    await expect(page.getByTestId("send-result")).toHaveText("false");
    await expect(page.getByTestId("send-error")).toContainText("Invalid input");
    await expect(page.getByTestId("message-output")).toContainText(
      '"type":"connection"'
    );
  });

  test("shows placeholder data before the first live message and clears the placeholder flag after recovery", async ({
    page,
  }) => {
    const delayedUrl = `${server.url}&mode=delayed-connection`;

    await page.goto(
      `/?ws=${encodeURIComponent(delayedUrl)}&placeholderMessage=${encodeURIComponent("waiting for socket")}`
    );

    await expect(page.getByTestId("message-output")).toContainText(
      '"message":"waiting for socket"'
    );
    await expect(page.getByTestId("is-placeholder-data")).toHaveText("true");

    await expect(page.getByTestId("message-output")).toContainText(
      '"type":"connection"'
    );
    await expect(page.getByTestId("is-placeholder-data")).toHaveText("false");
  });

  test("shows stale cached data before the first live message and clears the stale state after reconnect", async ({
    page,
  }) => {
    const delayedUrl = `${server.url}&mode=delayed-connection`;

    await page.goto(
      `/?ws=${encodeURIComponent(delayedUrl)}&cacheMessage=${encodeURIComponent("cached before reconnect")}`
    );

    await expect(page.getByTestId("socket-status")).toHaveText("stale");
    await expect(page.getByTestId("stale-indicator")).toHaveText("stale");
    await expect(page.getByTestId("message-output")).toContainText(
      '"message":"cached before reconnect"'
    );

    await expect(page.getByTestId("message-output")).toContainText(
      '"type":"connection"'
    );
    await expect(page.getByTestId("socket-status")).toHaveText("success");
    await expect(page.getByTestId("stale-indicator")).toHaveText("live");
  });
  test("handles binary inbound messages when binaryType is blob", async ({
    page,
  }) => {
    const binaryUrl = `${server.url}&mode=binary&binaryType=blob`;

    await page.goto(`/?ws=${encodeURIComponent(binaryUrl)}&binaryType=blob`);

    await expect(page.getByTestId("message-output")).toContainText(
      '"type":"binary"'
    );
    await expect(page.getByTestId("message-output")).toContainText(
      '"message":"binary from server"'
    );
  });

  test("surfaces malformed binary json as an error", async ({ page }) => {
    const invalidBinaryUrl = `${server.url}&mode=invalid-binary&binaryType=arraybuffer`;

    await page.goto(
      `/?ws=${encodeURIComponent(invalidBinaryUrl)}&binaryType=arraybuffer`
    );

    await expect(page.getByTestId("socket-status")).toHaveText("error");
    await expect(page.getByTestId("error-message")).toContainText(
      "Expected property name"
    );
  });

  test("handles binary inbound messages when binaryType is arraybuffer", async ({
    page,
  }) => {
    const binaryUrl = `${server.url}&mode=binary&binaryType=arraybuffer`;

    await page.goto(
      `/?ws=${encodeURIComponent(binaryUrl)}&binaryType=arraybuffer`
    );

    await expect(page.getByTestId("message-output")).toContainText(
      '"type":"binary"'
    );
    await expect(page.getByTestId("message-output")).toContainText(
      '"message":"binary from server"'
    );
  });

  test("reuses the same socket across subscribers and closes after idle timeout", async ({
    page,
  }) => {
    await page.goto(
      `/?ws=${encodeURIComponent(server.url)}&secondSubscriber=true&idleConnectionTimeout=50`
    );

    await expect(page.getByTestId("shared-socket")).toHaveText("true");
    await expect(page.getByTestId("managed-fetch-status")).toHaveText(
      "connected"
    );

    await page.getByTestId("toggle-first-button").click();
    await page.getByTestId("toggle-second-button").click();

    await expect(page.getByTestId("managed-fetch-status")).toHaveText("idle");
  });

  test("deduplicates repeated payloads inside the configured window", async ({
    page,
  }) => {
    await page.goto(
      `/?ws=${encodeURIComponent(server.url)}&deduplicationWindow=1000`
    );

    await page.getByTestId("send-button").click();
    await expect(page.getByTestId("send-result")).toHaveText("true");
    await expect(page.getByTestId("message-output")).toContainText('"count":1');

    await page.getByTestId("send-button").click();
    await expect(page.getByTestId("send-result")).toHaveText("false");
    await expect(page.getByTestId("message-output")).toContainText('"count":1');
  });
});
