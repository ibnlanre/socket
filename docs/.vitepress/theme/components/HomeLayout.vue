<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue';
const copyState = ref('Copy command');
let timer: ReturnType<typeof setTimeout>;
async function copyInstall() {
  try {
    await navigator.clipboard.writeText('pnpm add @ibnlanre/socket');
    copyState.value = 'Copied!';
  } catch { copyState.value = 'Select command to copy'; }
  clearTimeout(timer);
  timer = setTimeout(() => copyState.value = 'Copy command', 2400);
}
onBeforeUnmount(() => clearTimeout(timer));
const features = [
  ['01', 'A shared connection.', 'Identical parameters reuse the same socket. Every component gets its own view of the same stream.', 'Socket pooling', '/guide/socket-pooling'],
  ['02', 'Something to return to.', 'Read previously received data from the browser cache while fresh messages find their way back.', 'Cache-first state', '/guide/caching'],
  ['03', 'Trust what comes in.', 'Validate messages, payloads, and parameters with your Standard Schema library. Keep the inferred types.', 'Runtime validation', '/guide/validation'],
  ['04', 'Room for interruption.', 'Backoff, jitter, and network recovery handle the gaps. Your listeners survive the reconnect.', 'Reconnection', '/guide/reconnection'],
];
</script>

<template>
  <main class="socket-home">
    <section class="cover shell">
      <div class="edition"><span>A small library for continuous things.</span><span>WebSockets / React / SSE</span></div>
      <div class="cover-grid">
        <div class="cover-copy">
          <p class="overline">@ibnlanre/socket</p>
          <h1>Stay<br /><em>connected.</em></h1>
          <p class="intro">Live data has a life of its own.<br />Give it a place in your React app.</p>
          <p class="description">A type-safe WebSocket and Server-Sent Events client with shared connections, cached state, and a way back when the network drops.</p>
          <a class="primary-link" href="/guide/getting-started">Start building <span aria-hidden="true">↗</span></a>
          <a class="subtle-link" href="/guide/introduction">Meet Socket <span aria-hidden="true">→</span></a>
        </div>
        <figure class="connection-print">
          <div class="print-top"><span>FIG. 01</span><span>THE CONNECTION STUDY</span><span>↗</span></div>
          <svg viewBox="0 0 520 480" role="img" aria-labelledby="diagram-title diagram-desc">
            <title id="diagram-title">One stream. Many places to belong.</title>
            <desc id="diagram-desc">An endpoint connects to a shared Socket, which distributes messages to three React components.</desc>
            <defs><pattern id="rules" width="7" height="7" patternUnits="userSpaceOnUse"><path d="M0 0V7" stroke="currentColor" stroke-width="1" /></pattern></defs>
            <circle cx="260" cy="237" r="172" fill="none" stroke="currentColor" stroke-width="1" stroke-dasharray="2 7" />
            <path d="M260 66V168M260 285V334M260 310H95V354M260 310H425V354" fill="none" stroke="currentColor" stroke-width="2" />
            <circle cx="260" cy="72" r="23" fill="var(--print-paper)" stroke="currentColor" stroke-width="2" />
            <circle cx="260" cy="72" r="8" fill="currentColor" />
            <text x="299" y="77">ENDPOINT</text>
            <rect x="170" y="164" width="180" height="124" rx="62" fill="url(#rules)" stroke="currentColor" stroke-width="2" />
            <rect x="182" y="177" width="156" height="98" rx="49" fill="currentColor" />
            <text x="260" y="221" text-anchor="middle" class="diagram-brand">socket</text>
            <text x="260" y="244" text-anchor="middle" class="diagram-small">ONE SHARED CONNECTION</text>
            <g v-for="(x, i) in [95, 260, 425]" :key="x">
              <rect :x="x - 47" y="353" width="94" height="58" fill="var(--print-paper)" stroke="currentColor" stroke-width="2" />
              <path :d="`M${x - 12} 374l-8 8 8 8m24-16 8 8-8 8m-9-20-6 24`" fill="none" stroke="currentColor" stroke-width="1.5" />
              <text :x="x" y="437" text-anchor="middle">COMPONENT 0{{ i + 1 }}</text>
            </g>
            <circle class="signal" cx="260" cy="126" r="5" fill="currentColor" />
          </svg>
          <figcaption><span>One stream.<br />Many places to belong.</span><span class="print-seal">S<br />↳</span></figcaption>
        </figure>
      </div>
      <div class="install-strip"><span class="overline">Make the connection</span><code>pnpm add @ibnlanre/socket</code><button @click="copyInstall" type="button" aria-live="polite">{{ copyState }} <span aria-hidden="true">⧉</span></button></div>
    </section>

    <section class="principles shell">
      <header class="section-heading"><p class="overline">01 / The essentials</p><h2>Less plumbing.<br /><em>More possibility.</em></h2><p>The connection is only the beginning.<br />Socket takes care of what comes after.</p></header>
      <div class="principle-list"><a v-for="feature in features" :key="feature[0]" :href="feature[4]" class="principle"><span class="number">{{ feature[0] }}</span><h3>{{ feature[1] }}</h3><p>{{ feature[2] }}</p><span class="feature-link">{{ feature[3] }} ↗</span></a></div>
      <div class="footnote"><span>Also in the box</span><a href="/guide/event-source">Server-Sent Events ↗</a><a href="/guide/lifecycle">Reactive lifecycle ↗</a><a href="/guide/listeners">Event listeners ↗</a></div>
    </section>

    <section class="practice">
      <div class="shell practice-grid"><div><p class="overline">02 / In practice</p><h2>One client.<br /><em>Your whole app.</em></h2><p>Define an endpoint. Subscribe in a component.<br />Let the messages come to you.</p><a href="/guide/getting-started" class="primary-link">Walk through the setup <span aria-hidden="true">↗</span></a></div>
      <div class="code-sheet"><div class="code-label"><span>price-ticker.tsx</span><span>REACT + TYPESCRIPT</span></div><pre><code><span class="code-comment">// A client lives outside your components.</span>
<span class="code-keyword">import</span> { SocketClient } <span class="code-keyword">from</span> <span class="code-string">"@ibnlanre/socket"</span>;

<span class="code-keyword">const</span> prices = <span class="code-keyword">new</span> SocketClient&lt;string&gt;({
  baseURL: <span class="code-string">"wss://example.com"</span>,
  url: <span class="code-string">"/prices"</span>,
  retry: <span class="code-keyword">true</span>,
});

<span class="code-comment">// Each component gets a reactive snapshot.</span>
<span class="code-keyword">export function</span> PriceTicker() {
  <span class="code-keyword">const</span> { data } = prices.useSocket();
  <span class="code-keyword">return</span> &lt;p&gt;{data ?? <span class="code-string">"Waiting for price…"</span>}&lt;/p&gt;;
}</code></pre><div class="code-bottom">Shared connection. Individual perspective.</div></div></div>
    </section>
    <section class="closing shell"><p class="overline">The manual is open.</p><a href="/guide/introduction">Find your<br /><em>starting point.</em><span aria-hidden="true">↗</span></a><div><span>Explore the guide, or go straight to the details.</span><a href="/api/socket-client">API reference ↗</a></div></section>
  </main>
</template>
