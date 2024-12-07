import { WebSocketHandler, ws } from "msw";

const echo = ws.link("wss://echo.websocket.org");

export const handlers: Array<WebSocketHandler> = [
  echo.addEventListener("connection", ({ client }) => {
    client.send(JSON.stringify({ message: "Hello!" }));

    client.addEventListener("message", (event) => {});
  }),
];
