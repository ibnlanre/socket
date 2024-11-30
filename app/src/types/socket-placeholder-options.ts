export type SocketPlaceholderOptions<Get = unknown, Post = never> = {
  /**
   * The data to send to the WebSocket server on connection
   */
  initialPayload?: Post;

  /**
   * The initial state of the WebSocket connection
   */
  placeholderData: Get;
};
