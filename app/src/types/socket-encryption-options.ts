export type SocketEncryption = <Data, Result = Data>(data: Data) => Result;

export interface SocketEncryptionOptions<Get = unknown, Post = never> {
  /**
   * A function that encrypts data.
   */
  encrypt?: SocketEncryption;

  /**
   * Whether to encrypt the payload.
   *
   * @default false
   */
  encryptPayload?: boolean;

  /**
   * A function that decrypts data.
   */
  decrypt?: SocketEncryption;

  /**
   * Whether to decrypt the received data.
   *
   * @default false
   */
  decryptData?: boolean;
}
