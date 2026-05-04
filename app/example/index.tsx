import { useEffect, useLayoutEffect, useMemo, useState } from "react";

import { z } from "zod";

import {
  createSocketClient,
  type SocketMessageFailureAction,
  type SocketMessageFailurePolicy,
  type UseSocketResult,
} from "../src";

const messageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("connection"),
    attempt: z.number(),
    path: z.string(),
    search: z.string(),
  }),
  z.object({
    type: z.literal("echo"),
    count: z.number(),
    payload: z.object({
      type: z.literal("ping"),
      message: z.string(),
    }),
  }),
  z.object({
    type: z.literal("binary"),
    mode: z.enum(["blob", "arraybuffer"]),
    payload: z.object({
      type: z.literal("ping"),
      message: z.string(),
    }),
  }),
  z.object({
    type: z.literal("error"),
    message: z.string(),
  }),
]);

const sendSchema = z.object({
  type: z.literal("ping"),
  message: z.string(),
});

const paramsSchema = z.record(z.string(), z.string());

type ExampleMessage = z.infer<typeof messageSchema>;
type ExampleParams = z.infer<typeof paramsSchema>;
type ExampleSend = z.infer<typeof sendSchema>;
type ExampleSocket = UseSocketResult<
  ExampleMessage,
  ExampleSend,
  ExampleParams,
  string
>;

function readSocketUrl() {
  const url = new URL(window.location.href);
  return url.searchParams.get("ws") ?? "ws://127.0.0.1:8080/ws";
}

function readRetry() {
  const url = new URL(window.location.href);
  return url.searchParams.get("retry") === "true";
}

function readRetryDelay() {
  const url = new URL(window.location.href);
  return Number(url.searchParams.get("retryDelay") ?? "5000");
}

function readRetryCount() {
  const url = new URL(window.location.href);
  return Number(url.searchParams.get("retryCount") ?? "3");
}

function readMessageFailureAction(
  key: string
): SocketMessageFailureAction | undefined {
  const url = new URL(window.location.href);
  const value = url.searchParams.get(key);

  if (value === "close") return "close";
  if (value === "recover") return "recover";
  return undefined;
}

function readMessageFailurePolicy(): SocketMessageFailurePolicy | undefined {
  const decode = readMessageFailureAction("decodeFailureAction");
  const parse = readMessageFailureAction("parseFailureAction");
  const validation = readMessageFailureAction("validationFailureAction");

  if (!decode && !parse && !validation) return undefined;

  return {
    decode,
    parse,
    validation,
  };
}

function readDeduplicationWindow() {
  const url = new URL(window.location.href);
  return Number(url.searchParams.get("deduplicationWindow") ?? "0");
}

function readSendOnMount() {
  const url = new URL(window.location.href);
  return url.searchParams.get("sendOnMount") === "true";
}

function readMessage() {
  const url = new URL(window.location.href);
  return url.searchParams.get("message") ?? "hello from playwright";
}

function readCacheMessage() {
  const url = new URL(window.location.href);
  return url.searchParams.get("cacheMessage");
}

function readPlaceholderMessage() {
  const url = new URL(window.location.href);
  return url.searchParams.get("placeholderMessage");
}

function readBinaryType() {
  const url = new URL(window.location.href);
  const value = url.searchParams.get("binaryType");
  return value === "arraybuffer" ? "arraybuffer" : "blob";
}

function readSecondSubscriber() {
  const url = new URL(window.location.href);
  return url.searchParams.get("secondSubscriber") === "true";
}

function readIdleConnectionTimeout() {
  const url = new URL(window.location.href);
  return Number(url.searchParams.get("idleConnectionTimeout") ?? "300000");
}

function splitSocketUrl(socketUrl: string) {
  const target = new URL(socketUrl);
  const params = Object.fromEntries(target.searchParams.entries());

  return {
    baseURL: `${target.protocol}//${target.host}`,
    params,
    url: target.pathname || "/",
  };
}

type SubscriberProps = {
  client: ReturnType<
    typeof createSocketClient<ExampleMessage, ExampleSend, ExampleParams>
  >;
  onSocketChange: (socket: ExampleSocket | null) => void;
  params: ExampleParams;
  renderState?: boolean;
};

function Subscriber({
  client,
  onSocketChange,
  params,
  renderState = false,
}: SubscriberProps) {
  const socket = client.use({
    initialData: "waiting",
    params,
    select(message: ExampleMessage | undefined) {
      if (!message) return "waiting";
      return JSON.stringify(message);
    },
  });

  useEffect(() => {
    onSocketChange(socket);

    return () => {
      onSocketChange(null);
    };
  }, [onSocketChange, socket]);

  if (!renderState) return null;

  return (
    <>
      <p data-testid="fetch-status">{socket.fetchStatus}</p>
      <p data-testid="socket-status">{socket.status}</p>
      <p data-testid="stale-indicator">
        {socket.status === "stale" ? "stale" : "live"}
      </p>
      <p data-testid="failure-count">{socket.failureCount}</p>
      <p data-testid="failure-reason">{socket.failureReason ?? "none"}</p>
      <p data-testid="error-message">{socket.error?.message ?? "none"}</p>
      <p data-testid="is-placeholder-data">
        {String(socket.isPlaceholderData)}
      </p>
      <pre data-testid="message-output">{socket.data}</pre>
    </>
  );
}

export function App() {
  const binaryType = readBinaryType();
  const cacheMessage = readCacheMessage();
  const socketUrl = readSocketUrl();
  const deduplicationWindow = readDeduplicationWindow();
  const idleConnectionTimeout = readIdleConnectionTimeout();
  const message = readMessage();
  const messageFailurePolicy = readMessageFailurePolicy();
  const placeholderMessage = readPlaceholderMessage();
  const retry = readRetry();
  const retryDelay = readRetryDelay();
  const retryCount = readRetryCount();
  const secondSubscriber = readSecondSubscriber();
  const sendOnMount = readSendOnMount();
  const connection = useMemo(() => splitSocketUrl(socketUrl), [socketUrl]);
  const [firstMounted, setFirstMounted] = useState(true);
  const [secondMounted, setSecondMounted] = useState(secondSubscriber);
  const [managedFetchStatus, setManagedFetchStatus] = useState("idle");
  const [primarySocket, setPrimarySocket] = useState<ExampleSocket | null>(
    null
  );
  const [secondarySocket, setSecondarySocket] = useState<ExampleSocket | null>(
    null
  );
  const [sendResult, setSendResult] = useState("none");
  const [sendError, setSendError] = useState("none");
  const [cacheReady, setCacheReady] = useState(!cacheMessage);

  const client = useMemo(() => {
    return createSocketClient({
      baseURL: connection.baseURL,
      binaryType,
      deduplicationWindow,
      idleConnectionTimeout,
      messageFailurePolicy,
      messageSchema,
      paramsSchema,
      placeholderData: placeholderMessage
        ? {
            message: placeholderMessage,
            type: "error",
          }
        : undefined,
      sendSchema,
      retry,
      retryDelay,
      retryCount,
      url: connection.url,
    });
  }, [
    binaryType,
    connection.baseURL,
    connection.url,
    deduplicationWindow,
    idleConnectionTimeout,
    messageFailurePolicy,
    retry,
    retryDelay,
    retryCount,
  ]);

  useEffect(() => {
    if (!cacheMessage) {
      setCacheReady(true);
      return;
    }

    let active = true;

    setCacheReady(false);

    void (async () => {
      const target = new URL(socketUrl);
      const body = JSON.stringify({
        count: 0,
        payload: {
          message: cacheMessage,
          type: "ping",
        },
        type: "echo",
      } satisfies ExampleMessage);
      const cache = await caches.open(target.origin);
      const expiresAt = new Date(Date.now() + 60_000).toUTCString();

      await cache.put(
        `${target.pathname}${target.search}${target.hash}`,
        new Response(body, {
          headers: {
            "Cache-Control": "private",
            "Content-Length": new TextEncoder().encode(body).length.toString(),
            "Content-Type": "application/json",
            Expires: expiresAt,
          },
        })
      );

      if (active) {
        setCacheReady(true);
      }
    })();

    return () => {
      active = false;
    };
  }, [cacheMessage, socketUrl]);

  useEffect(() => {
    const managedSocket = client.get({ params: connection.params });
    const timerId = window.setInterval(() => {
      setManagedFetchStatus(managedSocket.fetchStatus);
    }, 20);

    setManagedFetchStatus(managedSocket.fetchStatus);

    return () => {
      window.clearInterval(timerId);
    };
  }, [client, connection.params]);

  useLayoutEffect(() => {
    if (!sendOnMount) return;

    const marker = `__socketAutoSend:${window.location.href}`;
    const store = window as unknown as Record<string, boolean>;

    if (store[marker]) return;
    store[marker] = true;

    try {
      const accepted = client.get({ params: connection.params }).send({
        type: "ping",
        message,
      });

      setSendResult(String(accepted));
      setSendError("none");
    } catch (error) {
      setSendResult("false");
      setSendError(error instanceof Error ? error.message : String(error));
    }
  }, [client, connection.params, message, sendOnMount]);

  const sendPing = () => {
    if (!primarySocket) return;

    try {
      const accepted = primarySocket.send({
        type: "ping",
        message,
      });

      setSendResult(String(accepted));
      setSendError("none");
    } catch (error) {
      setSendResult("false");
      setSendError(error instanceof Error ? error.message : String(error));
    }
  };

  const sendInvalid = () => {
    if (!primarySocket) return;

    try {
      const accepted = primarySocket.send({
        type: "pong",
        message,
      } as never);

      setSendResult(String(accepted));
      setSendError("none");
    } catch (error) {
      setSendResult("false");
      setSendError(error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <main>
      <h1>Socket Library Example</h1>
      <p data-testid="socket-url">{socketUrl}</p>
      <p data-testid="managed-fetch-status">{managedFetchStatus}</p>
      <p data-testid="send-result">{sendResult}</p>
      <p data-testid="send-error">{sendError}</p>
      <p data-testid="shared-socket">
        {primarySocket && secondarySocket
          ? String(primarySocket.ws === secondarySocket.ws)
          : "n/a"}
      </p>
      {cacheReady && firstMounted ? (
        <Subscriber
          client={client}
          onSocketChange={setPrimarySocket}
          params={connection.params}
          renderState
        />
      ) : (
        <>
          <p data-testid="fetch-status">idle</p>
          <p data-testid="socket-status">idle</p>
          <p data-testid="failure-count">0</p>
          <p data-testid="failure-reason">none</p>
          <p data-testid="error-message">none</p>
          <p data-testid="is-placeholder-data">false</p>
          <pre data-testid="message-output">waiting</pre>
        </>
      )}
      {secondMounted ? (
        <Subscriber
          client={client}
          onSocketChange={setSecondarySocket}
          params={connection.params}
        />
      ) : null}
      <button data-testid="send-button" type="button" onClick={sendPing}>
        Send Ping
      </button>
      <button
        data-testid="send-invalid-button"
        type="button"
        onClick={sendInvalid}
      >
        Send Invalid
      </button>
      <button
        data-testid="toggle-first-button"
        type="button"
        onClick={() => setFirstMounted((value) => !value)}
      >
        Toggle First
      </button>
      <button
        data-testid="toggle-second-button"
        type="button"
        onClick={() => setSecondMounted((value) => !value)}
      >
        Toggle Second
      </button>
    </main>
  );
}
