# Installation

## Install the package

::: code-group

```bash [npm]
npm install @ibnlanre/socket
```

```bash [pnpm]
pnpm add @ibnlanre/socket
```

```bash [yarn]
yarn add @ibnlanre/socket
```

:::

## Bring your own validator

The library uses **Standard Schema** under the hood, so it works with any Standard Schema–compatible validator. Runtime validation is optional, but when you add schemas they validate data at runtime **and** drive TypeScript inference.

::: code-group

```bash [Zod]
pnpm add @ibnlanre/socket zod
```

```bash [Valibot]
pnpm add @ibnlanre/socket valibot
```

```bash [ArkType]
pnpm add @ibnlanre/socket arktype
```

:::

Standard Schema V1 is implemented by Zod 3.24+, Zod 4, Valibot, ArkType, and others. If you skip schemas entirely, `SocketClient` still works — you just opt out of runtime validation.

## Peer requirements

- **React `>= 16.8`** and **react-dom `>= 16.8`** are peer dependencies — required only when you use `useSocket`.
- The library targets modern browsers that support `WebSocket`, the **Cache API**, and `crypto.subtle` (for encryption). It runs on **Node 22+** for server-side use of `Socket`/`EventSourceClient` where those globals are polyfilled.

## Node usage

The framework-free classes (`Socket`, `SocketCache`, `EventSourceClient`) don't import React. They only need the platform globals they touch (`WebSocket`, `caches`, `EventSource`, `fetch`), which you can polyfill in non-browser environments.
