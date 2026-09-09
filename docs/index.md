---
layout: HomeLayout

title: "@ibnlanre/socket"
titleTemplate: JSON WebSockets, cache-first

hero:
  name: "@ibnlanre/socket"
  text: JSON WebSockets, cache-first
  tagline: A fast, lightweight, type-safe WebSocket client for React. Reuse sockets across components, validate messages with any Standard Schema library, and recover cleanly from disconnects — with Server-Sent Events support built in.
  image:
    src: /socket-mark.svg
    alt: "@ibnlanre/socket"
  actions:
    - theme: brand
      text: Get Started
      link: /guide/introduction
    - theme: alt
      text: View on GitHub
      link: https://github.com/ibnlanre/socket

features:
  - icon: ⚡
    title: Cache-first state
    details: Surfaces previously received data instantly while fresh messages keep streaming in. Cache lives in the Cache API and expires after a configurable age.
  - icon: 🧩
    title: One client per endpoint
    details: Define one SocketClient per endpoint. Identical params reuse the same underlying socket, so every component shares a single connection.
  - icon: 🛡️
    title: Runtime-safe messaging
    details: Plug in any Standard Schema-compatible validator (Zod, Valibot, ArkType…) for params, outgoing payloads, and incoming messages.
  - icon: 🔁
    title: Built-in reconnection
    details: Retry with delays, backoff, jitter, and custom close-condition logic. Reconnects on network restore, window focus, and bfcache restores.
  - icon: 📡
    title: Server-Sent Events
    details: An EventSourceClient for one-way streams — native EventSource for GET and fetch-based streaming for any HTTP method.
  - icon: 🎯
    title: Predictable lifecycle
    details: Clear statuses (idle, loading, success, error, stale) and connection flags make connection state easy to render and reason about.
---
