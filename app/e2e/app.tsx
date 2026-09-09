import { useEffect, useLayoutEffect, useMemo, useState } from "react";

import { z } from "zod";

import {
  SocketClient,
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
    payload: z.object({ type: z.literal("ping"), message: z.string() }),
  }),
  z.object({
    type: z.literal("binary"),
    mode: z.enum(["blob", "arraybuffer"]),
    payload: z.object({ type: z.literal("ping"), message: z.string() }),
  }),
  z.object({ type: z.literal("error"), message: z.string() }),
]);

const sendSchema = z.object({ type: z.literal("ping"), message: z.string() });
const paramsSchema = z.record(z.string(), z.string());

type ExampleMessage = z.infer<typeof messageSchema>;
type ExampleParams = z.infer<typeof paramsSchema>;
type ExampleSend = z.infer<typeof sendSchema>;
type ExampleSocket = UseSocketResult<ExampleMessage, ExampleSend, string>;
type ExampleClient = SocketClient<ExampleMessage, ExampleSend, ExampleParams>;

function getSearchParams() {
  return new URL(window.location.href).searchParams;
}

function getSocketUrl() {
  return getSearchParams().get("ws") ?? "ws://127.0.0.1:8080/ws";
}

function getFailureAction(key: string): SocketMessageFailureAction | undefined {
  const value = getSearchParams().get(key);
  return value === "close" || value === "recover" ? value : undefined;
}

function getFailurePolicy(): SocketMessageFailurePolicy | undefined {
  const decode = getFailureAction("decodeFailureAction");
  const parse = getFailureAction("parseFailureAction");
  const validation = getFailureAction("validationFailureAction");
  return decode || parse || validation
    ? { decode, parse, validation }
    : undefined;
}

function numberOption(name: string, fallback: number) {
  return Number(getSearchParams().get(name) ?? fallback);
}

function splitSocketUrl(socketUrl: string) {
  const target = new URL(socketUrl);
  return {
    baseURL: `${target.protocol}//${target.host}`,
    params: Object.fromEntries(target.searchParams.entries()),
    url: target.pathname || "/",
  };
}

type SubscriberProps = {
  client: ExampleClient;
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
  const socket = client.useSocket({
    params,
    select(message) {
      return message ? JSON.stringify(message) : "waiting";
    },
  });

  useEffect(() => {
    onSocketChange(socket);
    return () => onSocketChange(null);
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
  const options = getSearchParams();
  const socketUrl = getSocketUrl();
  const connection = useMemo(() => splitSocketUrl(socketUrl), [socketUrl]);
  const cacheMessage = options.get("cacheMessage");
  const placeholderMessage = options.get("placeholderMessage");
  const message = options.get("message") ?? "hello from playwright";
  const sendOnMount = options.get("sendOnMount") === "true";
  const secondSubscriber = options.get("secondSubscriber") === "true";
  const [firstMounted, setFirstMounted] = useState(true);
  const [secondMounted, setSecondMounted] = useState(secondSubscriber);
  const [primarySocket, setPrimarySocket] = useState<ExampleSocket | null>(
    null
  );
  const [secondarySocket, setSecondarySocket] = useState<ExampleSocket | null>(
    null
  );
  const [managedFetchStatus, setManagedFetchStatus] = useState("idle");
  const [sharedSocket, setSharedSocket] = useState(false);
  const [sendResult, setSendResult] = useState("none");
  const [sendError, setSendError] = useState("none");
  const [cacheReady, setCacheReady] = useState(!cacheMessage);

  const client = useMemo(
    () =>
      new SocketClient<ExampleMessage, ExampleSend, ExampleParams>({
        baseURL: connection.baseURL,
        binaryType:
          options.get("binaryType") === "arraybuffer" ? "arraybuffer" : "blob",
        deduplicationWindow: numberOption("deduplicationWindow", 0),
        idleConnectionTimeout: numberOption("idleConnectionTimeout", 300_000),
        messageFailurePolicy: getFailurePolicy(),
        messageSchema,
        paramsSchema,
        placeholderData: placeholderMessage
          ? { type: "error", message: placeholderMessage }
          : undefined,
        retry: options.get("retry") === "true",
        retryCount: numberOption("retryCount", 3),
        retryDelay: numberOption("retryDelay", 5_000),
        sendSchema,
        url: connection.url,
      }),
    [connection.baseURL, connection.url, socketUrl]
  );

  useEffect(() => {
    if (!cacheMessage) return;

    let active = true;
    setCacheReady(false);

    void (async () => {
      const target = new URL(socketUrl);
      const body = JSON.stringify({
        count: 0,
        payload: { message: cacheMessage, type: "ping" },
        type: "echo",
      } satisfies ExampleMessage);
      const cache = await caches.open(target.origin);
      await cache.put(
        `${target.pathname}${target.search}${target.hash}`,
        new Response(body, {
          headers: {
            "Content-Type": "application/json",
            Expires: new Date(Date.now() + 60_000).toUTCString(),
          },
        })
      );
      if (active) setCacheReady(true);
    })();

    return () => {
      active = false;
    };
  }, [cacheMessage, socketUrl]);

  useEffect(() => {
    const controller = new AbortController();
    let timerId: number | undefined;
    void client
      .get(connection.params, { signal: controller.signal })
      .then(async (socket) => {
        const other = await client.get(connection.params, {
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        setSharedSocket(socket === other);
        timerId = window.setInterval(
          () => setManagedFetchStatus(socket.fetchStatus),
          20
        );
        setManagedFetchStatus(socket.fetchStatus);
      })
      .catch(() => {});
    return () => {
      controller.abort();
      window.clearInterval(timerId);
    };
  }, [client, connection.params]);

  useLayoutEffect(() => {
    if (!sendOnMount) return;
    const controller = new AbortController();
    void (async () => {
      try {
        const socket = await client.get(connection.params, {
          signal: controller.signal,
        });
        const accepted = await socket.send(
          { type: "ping", message },
          { signal: controller.signal }
        );
        if (controller.signal.aborted) return;
        setSendResult(String(accepted));
        setSendError("none");
      } catch (error) {
        if (controller.signal.aborted) return;
        setSendResult("false");
        setSendError(error instanceof Error ? error.message : String(error));
      }
    })();
    return () => controller.abort();
  }, [client, connection.params, message, sendOnMount]);

  const send = async (
    payload: ExampleSend | { type: "pong"; message: string }
  ) => {
    if (!primarySocket) return;
    try {
      setSendResult(String(await primarySocket.send(payload as ExampleSend)));
      setSendError("none");
    } catch (error) {
      setSendResult("false");
      setSendError(error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <main>
      <p data-testid="socket-url">{socketUrl}</p>
      <p data-testid="managed-fetch-status">{managedFetchStatus}</p>
      <p data-testid="send-result">{sendResult}</p>
      <p data-testid="send-error">{sendError}</p>
      <p data-testid="shared-socket">
        {primarySocket && secondarySocket ? String(sharedSocket) : "n/a"}
      </p>
      {cacheReady && firstMounted ? (
        <Subscriber
          client={client}
          onSocketChange={setPrimarySocket}
          params={connection.params}
          renderState
        />
      ) : null}
      {secondMounted ? (
        <Subscriber
          client={client}
          onSocketChange={setSecondarySocket}
          params={connection.params}
        />
      ) : null}
      <button
        data-testid="send-button"
        onClick={() => send({ type: "ping", message })}
      >
        Send Ping
      </button>
      <button
        data-testid="send-invalid-button"
        onClick={() => send({ type: "pong", message })}
      >
        Send Invalid
      </button>
      <button
        data-testid="toggle-first-button"
        onClick={() => setFirstMounted((value) => !value)}
      >
        Toggle First
      </button>
      <button
        data-testid="toggle-second-button"
        onClick={() => setSecondMounted((value) => !value)}
      >
        Toggle Second
      </button>
    </main>
  );
}
