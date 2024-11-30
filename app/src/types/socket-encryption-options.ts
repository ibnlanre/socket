export interface SocketEncryptionOptions<Get = unknown, Post = never> {
  /**
   * A custom function to encrypt the data before sending it
   *
   * @default (payload) => payload
   */
  encryptPayload?: (data: Post) => Post;

  /**
   * A custom function to decrypt the data after receiving it
   *
   * @default (data) => data
   */
  decryptData?: (data: Get) => Get;
}
