/** What reconnecting needs of a client: the sockets that have stopped. */
export interface ExhaustedSource {
  exhausted: () => { open: () => void }[];
}
