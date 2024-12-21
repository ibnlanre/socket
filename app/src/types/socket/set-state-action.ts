export type SocketSetStateAction<Get = unknown> = (
  nextState: Get,
  currentState?: Get
) => Get;
