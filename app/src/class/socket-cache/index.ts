import { isJSON } from "@/functions/is-json";
import type { SocketCipher } from "@/types/socket/cipher";
import type { SocketSetStateAction } from "@/types/socket/set-state-action";

type SocketCacheConstructor<State = unknown> = {
  decrypt?: SocketCipher;
  decryptData: boolean;
  disableCache: boolean;
  encrypt?: SocketCipher;
  maxCacheAge: number;
  origin: string;
  setStateAction?: SocketSetStateAction<State>;
};

export class SocketCache<State = unknown> {
  static isAvailable: boolean = "caches" in globalThis;

  #cache: Cache | undefined;
  #decrypt?: SocketCipher;
  #decryptData: boolean;
  #disableCache: boolean;
  #encrypt?: SocketCipher;
  #maxCacheAge: number;
  #observers: Set<Function> = new Set();
  #origin: string;
  #setStateAction?: SocketSetStateAction<State>;
  #state: State | undefined;

  constructor({
    decrypt,
    decryptData,
    disableCache,
    encrypt,
    maxCacheAge,
    origin,
    setStateAction,
  }: SocketCacheConstructor<State>) {
    this.#decrypt = decrypt;
    this.#decryptData = decryptData;
    this.#disableCache = disableCache;
    this.#encrypt = encrypt;
    this.#maxCacheAge = maxCacheAge;
    this.#origin = origin;
    this.#setStateAction = setStateAction;
  }

  #notifyObservers = (): void => {
    for (const observer of this.#observers) {
      observer(this.#state);
    }
  };

  clear = async (): Promise<void> => {
    if (!this.#cache) return;

    const keys = await this.#cache.keys();
    for (const request of keys) this.#cache.delete(request);
  };

  decrypt = (data: State) => {
    if (this.#decryptData && this.#decrypt) {
      return this.#decrypt(data);
    }
    return data;
  };

  get = async (path: string): Promise<State | undefined> => {
    if (!this.#cache) return;

    const response = await this.#cache.match(path);

    if (response) {
      const timestamp = response.headers.get("Expires") || 0;

      if (new Date(timestamp).getTime() < Date.now()) {
        await this.#cache.delete(path);
        return;
      }

      const data = await response.json();

      if (this.#decryptData && this.#decrypt) {
        return <State>this.#decrypt(data);
      }

      return data;
    }
  };

  has = async (path: string): Promise<boolean> => {
    if (!this.#cache) return false;

    const response = await this.#cache.match(path);
    return response !== undefined;
  };

  initialize = async (path: string): Promise<void> => {
    if (!SocketCache.isAvailable) return;

    this.#cache = await caches.open(this.#origin);
    const cachedData = await this.get(path);

    if (isJSON(cachedData)) {
      this.#state = cachedData;
      this.#notifyObservers();
    }
  };

  subscribe = (observer: Function): void => {
    this.#observers.add(observer);
  };

  remove = async (path: string): Promise<boolean> => {
    if (!this.#cache) return false;

    return await this.#cache.delete(path);
  };

  set = async (path: string, value: string): Promise<void> => {
    let data = <State>JSON.parse(value);

    if (this.#decryptData && this.#decrypt) {
      data = <State>this.#decrypt(data);
    }

    if (this.#setStateAction) {
      data = this.#setStateAction(data, this.#state);

      if (this.#encrypt) {
        data = <State>this.#encrypt(data);
      }

      value = JSON.stringify(data);
    }

    this.#state = data;
    this.#notifyObservers();

    if (this.#disableCache) return;
    if (!this.#cache) return;

    const timestamp = new Date(Date.now() + this.#maxCacheAge);
    const size = new TextEncoder().encode(value).length;
    const headers = new Headers();

    headers.set("Cache-Control", "private");
    headers.set("Content-Type", "application/json");
    headers.set("Expires", timestamp.toUTCString());
    headers.set("Content-Length", size.toString());

    const response = new Response(value, {
      headers,
    });

    await this.#cache.put(path, response);
  };

  get value(): State | undefined {
    return this.#state;
  }
}
