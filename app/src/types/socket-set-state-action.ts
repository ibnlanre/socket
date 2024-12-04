export type SocketSetStateAction<Get = unknown, Action = never> = (
  state: Get,
  action: Action
) => Get;
