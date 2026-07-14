export type SocketSelector<Get, State> = (data: Get | undefined) => State;
