import { WebSocketHandler, ws } from "msw";

const echo = ws.link("wss://echo.websocket.org");
const testServer = ws.link("wss://test.example.com/ws/test*");

export const handlers: Array<WebSocketHandler> = [
  echo.addEventListener("connection", ({ client }) => {
    client.send(JSON.stringify({ message: "Hello!" }));

    client.addEventListener("message", (event) => {
      try {
        const data = JSON.parse(event.data as string);
        client.send(JSON.stringify({ echo: data, timestamp: Date.now() }));
      } catch {
        client.send(JSON.stringify({ error: "Invalid JSON" }));
      }
    });
  }),

  testServer.addEventListener("connection", ({ client }) => {
    // Extract parameters from URL
    const url = new URL(client.url);
    const userId = url.searchParams.get("userId");
    const room = url.searchParams.get("room");

    // Send initial connection message
    client.send(
      JSON.stringify({
        message: `Connected to test server`,
        room,
        timestamp: Date.now(),
        type: "connection",
        userId,
      })
    );

    // Handle incoming messages
    client.addEventListener("message", (event) => {
      try {
        const data = JSON.parse(event.data as string);
        client.send(
          JSON.stringify({
            data,
            room,
            timestamp: Date.now(),
            type: "echo",
            userId,
          })
        );
      } catch {
        client.send(
          JSON.stringify({
            message: "Invalid JSON",
            timestamp: Date.now(),
            type: "error",
          })
        );
      }
    });
  }),
];
