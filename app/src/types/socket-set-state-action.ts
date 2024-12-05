export type SocketSetStateAction<Get = unknown> = (
  prevState: Get | undefined,
  action: Get
) => Get;
