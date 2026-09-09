<script setup lang="ts">
import { useRouter } from "vitepress";
import { onBeforeUnmount, onMounted, ref } from "vue";
import PlugIcon from "./PlugIcon.vue";

const router = useRouter();
function go(path: string) {
  router.go(path);
}

/* ---- scroll reveal ------------------------------------------------ */
const root = ref<HTMLElement | null>(null);
let io: IntersectionObserver | null = null;
let revealTimer: number | null = null;

onMounted(() => {
  const els = root.value
    ? Array.from<HTMLElement>(root.value.querySelectorAll(".reveal"))
    : [];

  const revealAll = () => els.forEach((el) => el.classList.add("is-in"));

  // Failsafe: whatever the observer couldn't reveal (throttled tabs, exotic
  // environments), surface after a short delay so content is never left hidden.
  revealTimer = window.setTimeout(revealAll, 1100);

  if (!("IntersectionObserver" in window)) {
    revealAll();
    return;
  }

  io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-in");
          io?.unobserve(entry.target);
        }
      }
    },
    { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
  );

  // Reveal anything already inside the viewport immediately (don't wait for the
  // first observer callback, so above-the-fold content is never stuck hidden).
  const viewportBottom = window.innerHeight;
  els.forEach((el) => {
    const rect = el.getBoundingClientRect();
    if (rect.top < viewportBottom * 0.92 && rect.bottom > 0) {
      el.classList.add("is-in");
    } else {
      io?.observe(el);
    }
  });
});

onBeforeUnmount(() => {
  io?.disconnect();
  if (revealTimer !== null) window.clearTimeout(revealTimer);
});

/* ---- copy-to-clipboard on the install pill ------------------------ */
const copied = ref(false);

async function copyInstall() {
  const text = "pnpm add @ibnlanre/socket";
  copied.value = true;
  window.setTimeout(() => (copied.value = false), 1600);
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    /* clipboard unavailable in some contexts — feedback already shown */
  }
}
</script>

<template>
  <main ref="root" class="home">
    <!-- ================= HERO ================= -->
    <section class="hero">
      <div class="grid-bg" aria-hidden="true"></div>
      <div class="wrap hero-inner">
        <div class="hero-copy">
          <p class="eyebrow">
            <span class="eyebrow-dot"></span>
            <span>@ibnlanre/socket</span>
            <span class="eyebrow-slash">/</span>
            <span>JSON WebSocket client for React</span>
          </p>

          <h1 class="title">
            Live data,<br />
            <span class="accent">
              plugged in.
              <PlugIcon class="title-plug" :size="44" />
            </span>
          </h1>

          <p class="lead">
            A cache-first, type-safe client for WebSockets &amp; Server-Sent
            Events. Reuse one connection across your whole app, validate every
            message with your favorite Standard Schema library, and recover
            cleanly from disconnects — without the wiring.
          </p>

          <div class="actions">
            <a
              class="btn btn-primary"
              href="/guide/getting-started"
              @click.prevent="go('/guide/getting-started')"
            >
              Get started
              <svg
                class="arr"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <path d="M5 12h14" />
                <path d="m12 5 7 7-7 7" />
              </svg>
            </a>
            <a
              class="btn btn-ghost"
              href="/guide/introduction"
              @click.prevent="go('/guide/introduction')"
            >
              Why @ibnlanre/socket
            </a>
          </div>

          <button
            type="button"
            class="install reveal"
            @click="copyInstall"
            aria-live="polite"
          >
            <span class="prompt">$</span>
            <code>pnpm add @ibnlanre/socket</code>
            <span class="copy-state">{{ copied ? "copied ✓" : "copy" }}</span>
          </button>

          <p class="trust">
            Runtime validation via
            <a href="https://standardschema.dev" target="_blank" rel="noopener"
              >Standard Schema</a
            >
            —
            <span class="trust-chips">
              <span>Zod</span><i>·</i><span>Valibot</span><i>·</i
              ><span>ArkType</span><i>·</i><span>+</span>
            </span>
          </p>
        </div>

        <!-- Live console visual -->
        <div class="hero-visual">
          <div class="console-glow" aria-hidden="true"></div>
          <div class="console">
            <div class="console-head">
              <span class="led led-r"></span>
              <span class="led led-y"></span>
              <span class="led led-g"></span>
              <span class="console-title">Ticker.tsx</span>
              <span class="live-badge"><span class="pulse"></span>live</span>
            </div>
            <div class="console-body">
              <pre><code><span class="tk-c">// one client per endpoint</span>
<span class="tk-k">const</span> prices = <span class="tk-k">new</span> <span class="tk-t">SocketClient</span><span class="tk-p">({</span>
  <span class="tk-a">baseURL</span><span class="tk-p">:</span> <span class="tk-s">"wss://api.example.com"</span><span class="tk-p">,</span>
  <span class="tk-a">url</span><span class="tk-p">:</span> <span class="tk-s">"/prices"</span><span class="tk-p">,</span>
  <span class="tk-a">retry</span><span class="tk-p">:</span> <span class="tk-b">true</span><span class="tk-p">,</span>
<span class="tk-p">});</span>

<span class="tk-k">function</span> <span class="tk-t">Ticker</span><span class="tk-p">() {</span>
  <span class="tk-k">const</span> <span class="tk-p">{</span> data, isConnected <span class="tk-p">} =</span> prices<span class="tk-p">.</span><span class="tk-t">useSocket</span><span class="tk-p">({</span>
    <span class="tk-a">select</span><span class="tk-p">:</span> <span class="tk-p">(</span>m<span class="tk-p">) =&gt;</span> m<span class="tk-p">?.</span><span class="tk-a">price</span><span class="tk-p">,</span>
  <span class="tk-p">});</span>

  <span class="tk-k">return</span> <span class="tk-p">&lt;</span><span class="tk-t">p</span><span class="tk-p">&gt;{</span>isConnected <span class="tk-p">?</span> <span class="tk-s">"● live"</span> <span class="tk-p">:</span> <span class="tk-s">"○ …"</span><span class="tk-p">} {</span>data<span class="tk-p">}&lt;/</span><span class="tk-t">p</span><span class="tk-p">&gt;;</span>
<span class="tk-p">}</span><span class="caret"></span></code></pre>
            </div>
            <div class="console-foot">
              <span class="foot-left"
                ><span class="dot volt-dot"></span>connected · cache hit · 2
                sockets pooled</span
              >
              <span class="foot-right">wss://</span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ================= MARQUEE ================= -->
    <div class="marquee" aria-hidden="true">
      <div class="marquee-track">
        <div class="marquee-row">
          <span>cache-first</span><PlugIcon class="m-plug" :size="14" />
          <span>one connection per endpoint</span
          ><PlugIcon class="m-plug" :size="14" />
          <span>schema-safe messaging</span
          ><PlugIcon class="m-plug" :size="14" /> <span>clean reconnection</span
          ><PlugIcon class="m-plug" :size="14" /> <span>bfcache ready</span
          ><PlugIcon class="m-plug" :size="14" /> <span>server-sent events</span
          ><PlugIcon class="m-plug" :size="14" />
        </div>
        <div class="marquee-row">
          <span>cache-first</span><PlugIcon class="m-plug" :size="14" />
          <span>one connection per endpoint</span
          ><PlugIcon class="m-plug" :size="14" />
          <span>schema-safe messaging</span
          ><PlugIcon class="m-plug" :size="14" /> <span>clean reconnection</span
          ><PlugIcon class="m-plug" :size="14" /> <span>bfcache ready</span
          ><PlugIcon class="m-plug" :size="14" /> <span>server-sent events</span
          ><PlugIcon class="m-plug" :size="14" />
        </div>
      </div>
    </div>

    <!-- ================= FEATURES ================= -->
    <section class="features">
      <div class="wrap">
        <header class="section-head reveal">
          <p class="kicker">What you get</p>
          <h2>One client.<br />Everything <em>wired up</em>.</h2>
        </header>

        <div class="features-grid">
          <article class="feature span-7 f-accent reveal">
            <header class="feature-head">
              <span class="idx">01</span>
              <span class="ic"
                ><svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
                  <polyline points="2 12 12 17 22 12"></polyline>
                  <polyline points="2 17 12 22 22 17"></polyline></svg
              ></span>
            </header>
            <h3>Cache-first state</h3>
            <p>
              Previously received data renders instantly from the browser Cache
              API while fresh messages keep streaming in. Stale-while-reconnect
              means your UI never flashes empty.
            </p>
            <footer class="feature-foot">
              Cache API · max-age · placeholder data
            </footer>
          </article>

          <article class="feature span-5 reveal">
            <header class="feature-head">
              <span class="idx">02</span>
              <span class="ic"
                ><svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <circle cx="18" cy="5" r="3"></circle>
                  <circle cx="6" cy="12" r="3"></circle>
                  <circle cx="18" cy="19" r="3"></circle>
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                  <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg
              ></span>
            </header>
            <h3>One connection per endpoint</h3>
            <p>
              Identical params reuse the same pooled <code>Socket</code>, so
              twenty components in a room share a single live connection — not
              twenty.
            </p>
            <footer class="feature-foot">socket pooling · zero config</footer>
          </article>

          <article class="feature span-5 reveal">
            <header class="feature-head">
              <span class="idx">03</span>
              <span class="ic"
                ><svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path
                    d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"
                  ></path>
                  <path d="m9 12 2 2 4-4"></path></svg
              ></span>
            </header>
            <h3>Schema-safe messaging</h3>
            <p>
              Validate params, outgoing payloads, and incoming messages with any
              Standard Schema–compatible validator — Zod, Valibot, ArkType — and
              get the types for free.
            </p>
            <footer class="feature-foot">
              params · send · message schemas
            </footer>
          </article>

          <article class="feature span-7 reveal">
            <header class="feature-head">
              <span class="idx">04</span>
              <span class="ic"
                ><svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path
                    d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"
                  ></path>
                  <path d="M21 3v5h-5"></path>
                  <path
                    d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"
                  ></path>
                  <path d="M8 16H3v5"></path></svg
              ></span>
            </header>
            <h3>Clean reconnection</h3>
            <p>
              Exponential backoff with jitter, custom retry conditions, and
              recovery on network restore, window focus, and bfcache page
              restore. Your listeners survive every retry.
            </p>
            <footer class="feature-foot">
              backoff · jitter · retry codes · idle timeout
            </footer>
          </article>

          <article class="feature span-7 f-accent reveal">
            <header class="feature-head">
              <span class="idx">05</span>
              <span class="ic"
                ><svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <polyline
                    points="22 12 18 12 15 21 9 3 6 12 2 12"
                  ></polyline></svg
              ></span>
            </header>
            <h3>Reactive by design</h3>
            <p>
              <code>useSocket</code> returns a read-only snapshot plus commands
              — status, connection flags, timestamps, <code>send</code>,
              <code>on</code>, <code>waitUntil</code>. Reach for
              <code>client.get()</code> when you need the imperative socket.
            </p>
            <footer class="feature-foot">useSocket · select · enabled</footer>
          </article>

          <article class="feature span-5 reveal">
            <header class="feature-head">
              <span class="idx">06</span>
              <span class="ic"
                ><svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <circle cx="12" cy="12" r="2"></circle>
                  <path d="M4.93 19.07a10 10 0 0 1 0-14.14"></path>
                  <path d="M7.76 16.24a6 6 0 0 1 0-8.49"></path>
                  <path d="M16.24 7.76a6 6 0 0 1 0 8.49"></path>
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path></svg
              ></span>
            </header>
            <h3>Server-Sent Events</h3>
            <p>
              An <code>EventSourceClient</code> for one-way streams — native
              <code>EventSource</code>
              for GET and fetch streaming for any method, with named events and
              async iteration.
            </p>
            <footer class="feature-foot">native · fetch · named events</footer>
          </article>
        </div>
      </div>
    </section>

    <!-- ================= CODE / INSTALL SPLIT ================= -->
    <section class="code-split">
      <div class="wrap split">
        <div class="split-copy reveal">
          <p class="kicker">In practice</p>
          <h2>Define one client.<br />React everywhere else.</h2>
          <ul class="mini-list">
            <li>
              <span class="mini-ic"><PlugIcon :size="16" /></span>
              <div>
                <strong>Client</strong>
                <p>owns the endpoint, schemas, cache &amp; retry policy.</p>
              </div>
            </li>
            <li>
              <span class="mini-ic"><PlugIcon :size="16" /></span>
              <div>
                <strong>Hook</strong>
                <p>
                  subscribes to a pooled socket &amp; returns reactive state.
                </p>
              </div>
            </li>
            <li>
              <span class="mini-ic"><PlugIcon :size="16" /></span>
              <div>
                <strong>Socket</strong>
                <p>the managed connection behind <code>client.get()</code>.</p>
              </div>
            </li>
          </ul>
          <a
            class="text-link"
            href="/guide/getting-started"
            @click.prevent="go('/guide/getting-started')"
          >
            Read the getting-started guide →
          </a>
        </div>

        <pre
          class="editor reveal"
        ><code><span class="win"><span class="win-dots"><i></i><i></i><i></i></span><span>quick-start.tsx</span></span>
<span class="ln">1</span>  <span class="tk-k">import</span> <span class="tk-p">{</span> SocketClient <span class="tk-p">}</span> <span class="tk-k">from</span> <span class="tk-s">"@ibnlanre/socket"</span><span class="tk-p">;</span>
<span class="ln">2</span>  <span class="tk-k">import</span> <span class="tk-p">{</span> z <span class="tk-p">}</span> <span class="tk-k">from</span> <span class="tk-s">"zod"</span><span class="tk-p">;</span>
<span class="ln">3</span>
<span class="ln">4</span>  <span class="tk-k">const</span> chat <span class="tk-p">=</span> <span class="tk-k">new</span> <span class="tk-t">SocketClient</span><span class="tk-p">({</span>
<span class="ln">5</span>    <span class="tk-a">baseURL</span><span class="tk-p">:</span> <span class="tk-s">"wss://chat.example.com"</span><span class="tk-p">,</span>
<span class="ln">6</span>    <span class="tk-a">url</span><span class="tk-p">:</span> <span class="tk-s">"/ws"</span><span class="tk-p">,</span>
<span class="ln">7</span>    <span class="tk-a">messageSchema</span><span class="tk-p">:</span> z<span class="tk-p">.</span><span class="tk-t">object</span><span class="tk-p">({</span> <span class="tk-a">content</span><span class="tk-p">:</span> z<span class="tk-p">.</span><span class="tk-t">string</span><span class="tk-p">() }),</span>
<span class="ln">8</span>    <span class="tk-a">retry</span><span class="tk-p">:</span> <span class="tk-b">true</span><span class="tk-p">,</span>
<span class="ln">9</span>  <span class="tk-p">});</span>
<span class="ln">10</span>
<span class="ln">11</span> <span class="tk-k">function</span> <span class="tk-t">Chat</span><span class="tk-p">() {</span>
<span class="ln">12</span>   <span class="tk-k">const</span> socket <span class="tk-p">=</span> chat<span class="tk-p">.</span><span class="tk-t">useSocket</span><span class="tk-p">();</span>
<span class="ln">13</span>   <span class="tk-k">return</span> <span class="tk-p">&lt;</span><span class="tk-t">p</span><span class="tk-p">&gt;{</span>socket<span class="tk-p">.</span><span class="tk-t">data</span><span class="tk-p">?.</span><span class="tk-a">content</span><span class="tk-p">}&lt;/</span><span class="tk-t">p</span><span class="tk-p">&gt;;</span>
<span class="ln">14</span> <span class="tk-p">}</span></code></pre>
      </div>
    </section>

    <!-- ================= CTA ================= -->
    <section class="cta">
      <div class="wrap">
        <div class="cta-band reveal">
          <PlugIcon class="cta-plug" :size="34" />
          <div class="cta-copy">
            <h2>Ready to plug in?</h2>
            <p>Spin up your first cache-first socket in about two minutes.</p>
          </div>
          <div class="cta-actions">
            <a
              class="btn btn-primary"
              href="/guide/getting-started"
              @click.prevent="go('/guide/getting-started')"
            >
              Get started
            </a>
            <a
              class="btn btn-ghost-invert"
              href="/api/socket-client"
              @click.prevent="go('/api/socket-client')"
            >
              API reference
            </a>
          </div>
        </div>
      </div>
    </section>
  </main>
</template>

<style scoped>
/* ------------------------------------------------------------------ *
 *  Base + layout rhythm
 * ------------------------------------------------------------------ */
.home {
  background: var(--home-paper);
  color: var(--home-ink);
  overflow: clip;
}

.wrap {
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  padding-inline: 24px;
}

.reveal {
  opacity: 0;
  transform: translateY(18px);
  transition: transform 0.6s cubic-bezier(0.22, 1, 0.36, 1);
}
.reveal.is-in {
  opacity: 1;
  transform: none;
}

/* Hero entrance — transform only, so content is visible even if CSS motion is
 * paused (e.g. background tabs, reduced environments). */
.hero-copy > *,
.hero-inner > .hero-visual {
  transform: translateY(14px);
  animation: hero-rise 0.7s cubic-bezier(0.22, 1, 0.36, 1) forwards;
}
.hero-copy > *:nth-child(1) {
  animation-delay: 0.02s;
}
.hero-copy > *:nth-child(2) {
  animation-delay: 0.08s;
}
.hero-copy > *:nth-child(3) {
  animation-delay: 0.14s;
}
.hero-copy > *:nth-child(4) {
  animation-delay: 0.2s;
}
.hero-copy > *:nth-child(5) {
  animation-delay: 0.26s;
}
.hero-copy > *:nth-child(6) {
  animation-delay: 0.32s;
}
.hero-inner > .hero-visual {
  animation-delay: 0.18s;
}

/* ------------------------------------------------------------------ *
 *  Hero
 * ------------------------------------------------------------------ */
.hero {
  position: relative;
  padding: clamp(72px, 11vh, 128px) 0 96px;
  overflow: hidden;
}

.grid-bg {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(var(--home-line) 1px, transparent 1px),
    linear-gradient(90deg, var(--home-line) 1px, transparent 1px);
  background-size: 56px 56px;
  -webkit-mask-image: radial-gradient(
    ellipse 90% 80% at 50% 0%,
    #000 30%,
    transparent 78%
  );
  mask-image: radial-gradient(
    ellipse 90% 80% at 50% 0%,
    #000 30%,
    transparent 78%
  );
  pointer-events: none;
}

.hero-inner {
  position: relative;
  display: grid;
  grid-template-columns: 1.04fr 0.96fr;
  gap: clamp(32px, 5vw, 72px);
  align-items: center;
}

.eyebrow {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin: 0 0 22px;
  font-family: var(--vp-font-family-mono);
  font-size: 12.5px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--home-muted);
}

.eyebrow-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--home-volt);
  box-shadow: 0 0 0 4px var(--home-volt-soft);
}

.eyebrow-slash {
  color: var(--home-volt);
}

.title {
  margin: 0 0 24px;
  font-size: clamp(2.75rem, 6.2vw, 5.25rem);
  line-height: 0.98;
  letter-spacing: -0.03em;
  font-weight: 900;
  color: var(--home-ink);
}

.title .accent {
  position: relative;
  color: var(--home-volt);
  white-space: nowrap;
}

.title-plug {
  display: inline-block;
  vertical-align: -8px;
  margin-left: 6px;
  transform: rotate(-12deg);
  filter: drop-shadow(0 6px 18px var(--home-volt-soft));
}

.lead {
  max-width: 54ch;
  margin: 0 0 30px;
  font-size: clamp(1.02rem, 1.3vw, 1.18rem);
  line-height: 1.65;
  color: var(--home-ink-soft);
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 22px;
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 12px 22px;
  border-radius: 10px;
  font-weight: 700;
  font-size: 0.98rem;
  text-decoration: none;
  transition:
    transform 0.18s ease,
    box-shadow 0.18s ease,
    background 0.18s ease,
    border-color 0.18s ease;
}
.btn:active {
  transform: translateY(1px);
}

.btn-primary {
  background: var(--home-volt);
  color: #fff;
  box-shadow: 0 12px 28px -12px var(--home-volt);
}
.btn-primary:hover {
  background: var(--home-volt-deep);
  transform: translateY(-1px);
}
.btn .arr {
  width: 16px;
  height: 16px;
  transition: transform 0.18s ease;
}
.btn:hover .arr {
  transform: translateX(3px);
}

.btn-ghost {
  background: transparent;
  color: var(--home-ink);
  border: 1px solid var(--home-line);
}
.btn-ghost:hover {
  border-color: var(--home-ink-soft);
  background: var(--home-paper-deep);
}

.install {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  margin-bottom: 20px;
  font-family: var(--vp-font-family-mono);
  font-size: 13.5px;
  color: var(--home-ink);
  background: var(--home-paper-deep);
  border: 1px solid var(--home-line);
  border-radius: 10px;
  cursor: pointer;
  transition:
    border-color 0.18s ease,
    background 0.18s ease;
}
.install:hover {
  border-color: var(--home-volt);
}
.install .prompt {
  color: var(--home-volt);
  font-weight: 600;
}
.install code {
  font-family: inherit;
  color: inherit;
}
.copy-state {
  margin-left: auto;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--home-muted);
  border: 1px solid var(--home-line);
  padding: 3px 8px;
  border-radius: 999px;
}

.trust {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 0.9rem;
  color: var(--home-muted);
}
.trust a {
  color: var(--home-ink-soft);
  font-weight: 600;
}
.trust-chips {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-family: var(--vp-font-family-mono);
  font-size: 12px;
}
.trust-chips i {
  font-style: normal;
  color: var(--home-volt);
}

/* ---- console visual ---- */
.hero-visual {
  position: relative;
}

.console-glow {
  position: absolute;
  inset: -8% -10%;
  background:
    radial-gradient(
      ellipse 60% 60% at 60% 20%,
      var(--home-volt-soft),
      transparent 70%
    ),
    radial-gradient(
      ellipse 50% 50% at 20% 90%,
      rgba(255, 255, 255, 0.08),
      transparent 70%
    );
  filter: blur(6px);
  pointer-events: none;
}

.console {
  position: relative;
  background: linear-gradient(
    180deg,
    var(--home-console) 0%,
    var(--home-console-deep) 100%
  );
  color: var(--home-console-ink);
  border: 1px solid var(--home-console-line);
  border-radius: 16px;
  box-shadow: var(--home-shadow);
  font-family: var(--vp-font-family-mono);
  overflow: hidden;
  transform: rotate(0.6deg);
  transition: transform 0.4s cubic-bezier(0.22, 1, 0.36, 1);
}
.hero-visual:hover .console {
  transform: rotate(0deg) translateY(-4px);
}

.console-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 13px 16px;
  border-bottom: 1px solid var(--home-console-line);
}

.led {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}
.led-r {
  background: #ff5f57;
}
.led-y {
  background: #febc2e;
}
.led-g {
  background: #28c840;
}

.console-title {
  margin-left: 10px;
  font-size: 12px;
  color: var(--home-console-muted);
}

.live-badge {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-size: 10.5px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #7be089;
}
.pulse {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #28c840;
  box-shadow: 0 0 0 0 rgba(40, 200, 64, 0.55);
  animation: pulse 1.8s ease-out infinite;
}

.console-body {
  padding: 18px 18px 20px;
  font-size: 12.6px;
  line-height: 1.75;
  overflow-x: auto;
}
.console-body pre {
  margin: 0;
  white-space: pre;
}
.console-body code {
  font-family: inherit;
  font-size: inherit;
  color: inherit;
}

.console-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 11px 16px;
  border-top: 1px solid var(--home-console-line);
  font-size: 10.5px;
  letter-spacing: 0.06em;
  color: var(--home-console-muted);
}
.foot-left {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}
.volt-dot {
  background: var(--home-volt);
}
.foot-right {
  font-size: 11px;
  color: #7be089;
}

/* token colors */
.tk-c {
  color: var(--home-console-muted);
  font-style: italic;
}
.tk-k {
  color: #ff8a4c;
}
.tk-t {
  color: #ffd166;
}
.tk-a {
  color: #7ee0c6;
}
.tk-s {
  color: #b9f27c;
}
.tk-b {
  color: #ff8a4c;
}
.tk-p {
  color: #9d9789;
}

.caret {
  display: inline-block;
  width: 8px;
  height: 1.1em;
  margin-left: 4px;
  vertical-align: text-bottom;
  background: var(--home-volt);
  animation: blink 1.1s steps(2, start) infinite;
}

/* ------------------------------------------------------------------ *
 *  Marquee strip
 * ------------------------------------------------------------------ */
.marquee {
  background: var(--home-ink);
  color: var(--home-paper);
  overflow: hidden;
  padding: 14px 0;
  border-block: 1px solid var(--home-line);
}
.marquee-track {
  display: flex;
  width: max-content;
  animation: marquee 30s linear infinite;
}
.marquee-row {
  display: flex;
  align-items: center;
  gap: 34px;
  padding-right: 34px;
  font-family: var(--vp-font-family-mono);
  font-size: 12.5px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--home-ink-soft);
  white-space: nowrap;
}
.marquee:hover .marquee-track {
  animation-play-state: paused;
}
.m-plug {
  color: var(--home-volt);
  opacity: 0.9;
}

/* ------------------------------------------------------------------ *
 *  Features
 * ------------------------------------------------------------------ */
.features {
  padding: clamp(80px, 10vw, 130px) 0;
}

.section-head {
  margin-bottom: clamp(36px, 5vw, 56px);
  max-width: 620px;
}

.kicker {
  margin: 0 0 14px;
  font-family: var(--vp-font-family-mono);
  font-size: 12px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--home-volt);
}

.section-head h2,
.split h2 {
  margin: 0;
  font-size: clamp(2rem, 3.6vw, 3rem);
  line-height: 1.05;
  letter-spacing: -0.02em;
  font-weight: 800;
  color: var(--home-ink);
}
.section-head h2 em,
.split h2 em {
  font-style: italic;
  color: var(--home-volt);
}

.features-grid {
  display: grid;
  gap: 20px;
}

.feature {
  position: relative;
  display: flex;
  flex-direction: column;
  padding: 26px 26px 22px;
  background: var(--home-paper-deep);
  border: 1px solid var(--home-line);
  border-radius: 18px;
  overflow: hidden;
  transition:
    transform 0.25s cubic-bezier(0.22, 1, 0.36, 1),
    border-color 0.25s ease,
    box-shadow 0.25s ease;
}
.feature::before {
  content: "";
  position: absolute;
  inset: 0 auto auto 0;
  width: 100%;
  height: 3px;
  background: linear-gradient(90deg, var(--home-volt), transparent 70%);
  opacity: 0;
  transition: opacity 0.25s ease;
}
.feature:hover {
  transform: translateY(-4px);
  border-color: var(--home-volt);
  box-shadow: 0 24px 48px -28px var(--home-volt-soft);
}
.feature:hover::before {
  opacity: 1;
}

.f-accent {
  background:
    radial-gradient(
      120% 140% at 100% 0%,
      var(--home-volt-soft),
      transparent 55%
    ),
    var(--home-paper-deep);
}

.feature-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 18px;
}
.idx {
  font-family: var(--vp-font-family-mono);
  font-size: 12px;
  letter-spacing: 0.14em;
  color: var(--home-muted);
}
.ic {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: var(--home-volt-soft);
  color: var(--home-volt);
}
.ic svg {
  width: 19px;
  height: 19px;
}

.feature h3 {
  margin: 0 0 10px;
  font-size: 1.22rem;
  letter-spacing: -0.01em;
  font-weight: 800;
  color: var(--home-ink);
}
.feature p {
  margin: 0 0 20px;
  font-size: 0.97rem;
  line-height: 1.65;
  color: var(--home-ink-soft);
}
.feature code {
  font-family: var(--vp-font-family-mono);
  font-size: 0.86em;
  background: var(--home-volt-soft);
  color: var(--home-ink);
  border-radius: 5px;
  padding: 1px 5px;
}
.feature-foot {
  margin-top: auto;
  padding-top: 14px;
  border-top: 1px dashed var(--home-line);
  font-family: var(--vp-font-family-mono);
  font-size: 11.5px;
  letter-spacing: 0.04em;
  color: var(--home-muted);
}

/* ------------------------------------------------------------------ *
 *  Code / install split
 * ------------------------------------------------------------------ */
.code-split {
  padding: clamp(72px, 9vw, 120px) 0;
  background: var(--home-paper-deep);
  border-block: 1px solid var(--home-line);
}

.split {
  display: grid;
  grid-template-columns: 0.92fr 1.08fr;
  gap: clamp(32px, 5vw, 72px);
  align-items: center;
}

.mini-list {
  list-style: none;
  margin: 28px 0 26px;
  padding: 0;
  display: grid;
  gap: 18px;
}
.mini-list li {
  display: flex;
  gap: 14px;
  align-items: flex-start;
}
.mini-ic {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  margin-top: 2px;
  border-radius: 10px;
  background: var(--home-volt-soft);
  color: var(--home-volt);
}
.mini-list strong {
  font-size: 1rem;
  font-weight: 800;
  color: var(--home-ink);
}
.mini-list p {
  margin: 3px 0 0;
  font-size: 0.93rem;
  line-height: 1.55;
  color: var(--home-ink-soft);
}
.mini-list code {
  font-family: var(--vp-font-family-mono);
  font-size: 0.86em;
}

.text-link {
  color: var(--home-volt);
  font-weight: 700;
  text-decoration: none;
  border-bottom: 2px solid var(--home-volt-soft);
}
.text-link:hover {
  border-bottom-color: var(--home-volt);
}

.editor {
  margin: 0;
  padding: 0;
  border-radius: 16px;
  background: var(--home-console);
  color: var(--home-console-ink);
  border: 1px solid var(--home-console-line);
  box-shadow: var(--home-shadow);
  font-family: var(--vp-font-family-mono);
  font-size: 12.8px;
  line-height: 1.8;
  overflow: auto;
  transform: rotate(-0.5deg);
}
.editor:hover {
  transform: rotate(0deg);
}
.editor code {
  display: block;
  font-family: inherit;
  padding: 0 0 20px;
  color: var(--home-console-ink);
}
.win {
  display: flex;
  align-items: center;
  gap: 8px;
  position: sticky;
  top: 0;
  padding: 12px 16px;
  margin-bottom: 10px;
  background: var(--home-console);
  border-bottom: 1px solid var(--home-console-line);
  font-size: 12px;
  color: var(--home-console-muted);
}
.win-dots {
  display: inline-flex;
  gap: 6px;
}
.win-dots i {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #2b2a27;
}
.win-dots i:nth-child(1) {
  background: #ff5f57;
}
.win-dots i:nth-child(2) {
  background: #febc2e;
}
.win-dots i:nth-child(3) {
  background: #28c840;
}
.ln {
  display: inline-block;
  width: 2.6em;
  text-align: right;
  padding-right: 1.2em;
  user-select: none;
  color: rgba(233, 230, 222, 0.22);
}

/* ------------------------------------------------------------------ *
 *  CTA
 * ------------------------------------------------------------------ */
.cta {
  padding: clamp(72px, 9vw, 120px) 0;
}

.cta-band {
  position: relative;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 22px 32px;
  padding: clamp(28px, 4vw, 44px);
  background:
    radial-gradient(90% 140% at 0% 0%, var(--home-volt-soft), transparent 55%),
    var(--home-ink);
  color: var(--home-paper);
  border-radius: 22px;
  overflow: hidden;
}

.cta-plug {
  flex: 0 0 auto;
  color: var(--home-volt);
  transform: rotate(-12deg);
}

.cta-copy {
  flex: 1 1 300px;
  min-width: 220px;
}
.cta-copy h2 {
  margin: 0 0 6px;
  font-size: clamp(1.5rem, 2.6vw, 2.2rem);
  letter-spacing: -0.02em;
  font-weight: 800;
  color: var(--home-paper);
}
.cta-copy p {
  margin: 0;
  color: var(--home-muted);
}

.cta-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.btn-ghost-invert {
  background: transparent;
  color: var(--home-paper);
  border: 1px solid rgba(244, 241, 234, 0.28);
}
.btn-ghost-invert:hover {
  border-color: rgba(244, 241, 234, 0.6);
}

/* ------------------------------------------------------------------ *
 *  Responsive
 * ------------------------------------------------------------------ */
@media (max-width: 960px) {
  .hero-inner,
  .split {
    grid-template-columns: 1fr;
  }
  .hero-visual {
    max-width: 560px;
  }
}

@media (min-width: 961px) {
  .features-grid {
    grid-template-columns: repeat(12, 1fr);
  }
  .span-7 {
    grid-column: span 7;
  }
  .span-5 {
    grid-column: span 5;
  }
}

@media (max-width: 700px) {
  .feature-foot {
    display: none;
  }
  .lead {
    font-size: 1rem;
  }
  .marquee-row {
    font-size: 11px;
    gap: 24px;
    padding-right: 24px;
  }
}

/* ------------------------------------------------------------------ *
 *  Keyframes
 * ------------------------------------------------------------------ */
@keyframes blink {
  0%,
  50% {
    opacity: 1;
  }
  50.01%,
  100% {
    opacity: 0;
  }
}
@keyframes pulse {
  0% {
    box-shadow: 0 0 0 0 rgba(40, 200, 64, 0.5);
  }
  70% {
    box-shadow: 0 0 0 7px rgba(40, 200, 64, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(40, 200, 64, 0);
  }
}
@keyframes marquee {
  from {
    transform: translateX(0);
  }
  to {
    transform: translateX(-50%);
  }
}
@keyframes reveal-up {
  from {
    opacity: 0;
    transform: translateY(18px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
@keyframes hero-rise {
  from {
    transform: translateY(14px);
  }
  to {
    transform: none;
  }
}
</style>
