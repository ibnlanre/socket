import { createServer, type IncomingMessage, type Server } from "node:http";
import type { Duplex } from "node:stream";

import { WebSocketServer, type RawData, type WebSocket } from "ws";

export type TestWebSocketServer = {
  url: string;
  close: () => Promise<void>;
  getUpgradeAttempts: (socketUrl: string) => number;
};

export async function createTestWebSocketServer(): Promise<TestWebSocketServer> {
  const server = createServer();
  const sockets = new Set<WebSocket>();
  const websocketServer = new WebSocketServer({ noServer: true });
  const attempts = new Map<string, number>();
  const upgradeAttempts = new Map<string, number>();

  websocketServer.on(
    "connection",
    (socket: WebSocket, request: IncomingMessage) => {
      sockets.add(socket);

      const target = new URL(request.url ?? "/", "http://127.0.0.1");
      const attemptKey = `${target.pathname}${target.search}`;
      const attempt = (attempts.get(attemptKey) ?? 0) + 1;

      attempts.set(attemptKey, attempt);

      const sendConnection = () => {
        socket.send(
          JSON.stringify({
            type: "connection",
            attempt,
            path: target.pathname,
            search: target.search,
          })
        );
      };

      if (target.searchParams.get("mode") === "delayed-connection") {
        setTimeout(sendConnection, 150);
      } else {
        sendConnection();
      }

      if (target.searchParams.get("mode") === "reconnect" && attempt === 1) {
        setTimeout(() => {
          socket.terminate();
        }, 25);
      }

      if (target.searchParams.get("mode") === "clean-close" && attempt === 1) {
        setTimeout(() => {
          socket.close(1000, "clean shutdown");
        }, 25);
      }

      if (target.searchParams.get("mode") === "invalid-message") {
        setTimeout(() => {
          socket.send(
            JSON.stringify({
              invalid: true,
            })
          );
        }, 25);
      }

      if (target.searchParams.get("mode") === "invalid-json") {
        setTimeout(() => {
          socket.send("{invalid json");
        }, 25);
      }

      if (target.searchParams.get("mode") === "binary") {
        setTimeout(() => {
          socket.send(
            Buffer.from(
              JSON.stringify({
                type: "binary",
                mode: target.searchParams.get("binaryType") ?? "blob",
                payload: {
                  type: "ping",
                  message: "binary from server",
                },
              })
            )
          );
        }, 25);
      }

      if (target.searchParams.get("mode") === "invalid-binary") {
        setTimeout(() => {
          socket.send(Buffer.from("{invalid json"));
        }, 25);
      }

      let messageCount = 0;

      socket.on("message", (raw: RawData) => {
        const payload = JSON.parse(raw.toString()) as {
          type: string;
          message: string;
        };
        messageCount += 1;

        socket.send(
          JSON.stringify({
            type: "echo",
            count: messageCount,
            payload,
          })
        );
      });

      socket.once("close", () => {
        sockets.delete(socket);
      });
    }
  );

  server.on(
    "upgrade",
    (
      request: IncomingMessage,
      socket: Duplex,
      head: Buffer<ArrayBufferLike>
    ) => {
      if (!request.url?.startsWith("/ws")) {
        socket.destroy();
        return;
      }

      const target = new URL(request.url, "http://127.0.0.1");
      const attemptKey = `${target.pathname}${target.search}`;
      const count = (upgradeAttempts.get(attemptKey) ?? 0) + 1;

      upgradeAttempts.set(attemptKey, count);

      if (
        target.searchParams.get("mode") === "retry-exhaustion" &&
        count <= 3
      ) {
        socket.destroy();
        return;
      }

      websocketServer.handleUpgrade(
        request,
        socket,
        head,
        (client: WebSocket) => {
          websocketServer.emit("connection", client, request);
        }
      );
    }
  );

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });

  const address = server.address();

  if (!address || typeof address === "string") {
    throw new Error("Unable to determine test WebSocket server address.");
  }

  return {
    url: `ws://127.0.0.1:${address.port}/ws?channel=prices`,
    getUpgradeAttempts: (socketUrl: string) => {
      const target = new URL(socketUrl);
      const attemptKey = `${target.pathname}${target.search}`;
      return upgradeAttempts.get(attemptKey) ?? 0;
    },
    close: async () => {
      sockets.forEach((socket) => socket.close());

      await Promise.all([
        new Promise<void>((resolve, reject) => {
          websocketServer.close((error?: Error) => {
            if (error) {
              reject(error);
              return;
            }

            resolve();
          });
        }),
        closeServer(server),
      ]);
    },
  };
}

function closeServer(server: Server) {
  return new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}
