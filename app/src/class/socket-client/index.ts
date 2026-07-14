import type { ConnectionParams } from "@/types/connection-params";
import type { SocketConstructor } from "@/types/socket/constructor";
import type { UseSocketOptions } from "@/types/socket/options";
import type { UseSocketResult } from "@/types/use-socket-result";

import { useEffect, useMemo, useState } from "react";

import { Socket } from "@/class/socket";
import { shallowMerge } from "@/functions/shallow-merge";
import { getUri } from "@/library/get-uri";

export class SocketClient<
  Get = unknown,
  Post = never,
  Params extends ConnectionParams = never,
> {
  #pool = new Map<string, Socket<Get, Post, Params>>();
  #configuration: SocketConstructor<Get, Post, Params>;

  constructor(configuration: SocketConstructor<Get, Post, Params>) {
    this.#configuration = configuration;
  }

  #destroy = (socket: Socket<Get, Post, Params>) => {
    socket.close();
    socket.cache.clear();
  };

  #parse = (params: Params) => {
    const parser = this.#configuration.paramsSchema;
    if (!parser) return params;

    const result = parser["~standard"].validate(params);
    if (result instanceof Promise) return params;

    if (result.issues) {
      const message = "SocketClient: params schema validation failed";
      throw new Error(message, { cause: result.issues });
    }

    return result.value;
  };

  #stringify = (params: Params = {} as Params) => {
    return getUri({ ...this.#configuration, params: this.#parse(params) });
  };

  close = (params?: Params): void => {
    const key = this.#stringify(params);
    const socket = this.#pool.get(key);

    if (socket) {
      this.#destroy(socket);
      this.#pool.delete(key);
    }
  };

  closeAll = (): void => {
    this.#pool.forEach(this.#destroy);
    this.#pool.clear();
  };

  /**
   * Retrieves an existing Socket instance or creates a new one
   * under this pool instance.
   */
  get = (params?: Params) => {
    const key = this.#stringify(params);
    return this.#pool.getOrInsertComputed(key, () => {
      return new Socket(this.#configuration, params);
    });
  };

  use = <State = Get>({
    enabled = true,
    params,
    select = (data) => data as unknown as State,
  }: UseSocketOptions<Get, State, Params> = {}): UseSocketResult<
    Get,
    Post,
    Params,
    State
  > => {
    const key = this.#stringify(params);
    const socket = useMemo(() => this.get(params), [key]);
    const [{ value }, setClient] = useState(socket);

    useEffect(() => socket.subscribe(setClient), [socket]);
    useEffect(() => socket.open(enabled), [socket, enabled]);

    const data = select(value);
    return shallowMerge(socket, { data });
  };
}
