/**
 * A listener for any SSE event dispatched by an `EventSourceClient`.
 *
 * Named events and the default `"message"` event carry the same payload — the
 * raw string, or the `Data` value produced by `messageSchema` validation when
 * one is configured — so every handler receives a `MessageEvent<Data>`.
 */
export type EventSourceListener<Data> = (event: MessageEvent<Data>) => void;
