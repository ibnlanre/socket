import { useState } from "react";
import { z } from "zod";

import { SocketClient } from "../src";

const messageSchema = z.object({
  type: z.enum(["message", "notification"]),
  content: z.string(),
  sender: z.string(),
  timestamp: z.number(),
});

const sendSchema = z.object({
  content: z.string().min(1),
});

const paramsSchema = z.object({
  room: z.string(),
});

const chatClient = new SocketClient({
  baseURL: "wss://chat.example.com",
  url: "/ws",
  messageSchema,
  sendSchema,
  paramsSchema,
  retry: true,
  retryDelay: 1000,
});

interface ChatRoomProps {
  room: string;
}

export function ChatRoom({ room }: ChatRoomProps) {
  const socket = chatClient.useSocket({ params: { room } });

  const [error, setError] = useState<string | null>(null);
  const send = async (content: string) => {
    try {
      await socket.send({ content });
      setError(null);
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <div>
      <h2>Room: {room}</h2>
      {error && <p role="alert">{error}</p>}
      <p data-testid="status">{socket.fetchStatus}</p>
      {socket.data && (
        <div data-testid="message">
          <strong>{socket.data.sender}</strong>: {socket.data.content}
        </div>
      )}
      <button
        data-testid="send"
        onClick={() => send("Hello from the example!")}
        disabled={!socket.isConnected}
      >
        Send
      </button>
    </div>
  );
}
