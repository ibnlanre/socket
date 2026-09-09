import { defineConfig } from "vitepress";

const repository = "https://github.com/ibnlanre/socket";

export default defineConfig({
  title: "@ibnlanre/socket",
  description:
    "A fast, lightweight, type-safe JSON WebSocket client with cache-first state, built-in reconnection, and React hooks.",
  lang: "en-US",
  cleanUrls: true,
  lastUpdated: true,
  head: [
    ["meta", { name: "theme-color", content: "#f7f7ef" }],
    ["link", { rel: "icon", type: "image/svg+xml", href: "/socket-mark.svg" }],
    ["link", { rel: "preconnect", href: "https://fonts.googleapis.com" }],
    [
      "link",
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossorigin: "" },
    ],
    [
      "link",
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Instrument+Serif:ital@0;1&family=IBM+Plex+Mono:wght@400;500;600&display=swap",
      },
    ],
    [
      "meta",
      {
        name: "og:description",
        content:
          "Cache-first JSON WebSocket & Server-Sent Events client for React with runtime validation and clean reconnection.",
      },
    ],
  ],

  themeConfig: {
    nav: [
      { text: "Guide", link: "/guide/introduction", activeMatch: "/guide/" },
      { text: "Reference", link: "/api/socket-client", activeMatch: "/api/" },
      { text: "Changelog", link: `${repository}/releases` },
    ],

    sidebar: {
      "/guide/": [
        {
          text: "Guide",
          items: [
            { text: "Introduction", link: "/guide/introduction" },
            { text: "Mental model", link: "/guide/mental-model" },
            { text: "Installation", link: "/guide/installation" },
            { text: "Getting started", link: "/guide/getting-started" },
          ],
        },
        {
          text: "Concepts",
          items: [
            { text: "Socket pooling", link: "/guide/socket-pooling" },
            { text: "Validation", link: "/guide/validation" },
            { text: "Caching", link: "/guide/caching" },
            { text: "Reconnection", link: "/guide/reconnection" },
            { text: "Lifecycle & status", link: "/guide/lifecycle" },
            { text: "Listeners", link: "/guide/listeners" },
            { text: "Sending messages", link: "/guide/sending" },
            { text: "Server-Sent Events", link: "/guide/event-source" },
          ],
        },
      ],
      "/api/": [
        {
          text: "Reference",
          items: [
            { text: "SocketClient", link: "/api/socket-client" },
            { text: "Socket", link: "/api/socket" },
            { text: "SocketCache", link: "/api/socket-cache" },
            { text: "EventSourceClient", link: "/api/event-source-client" },
            { text: "Options", link: "/api/options" },
            { text: "Types & constants", link: "/api/types" },
          ],
        },
      ],
    },

    socialLinks: [{ icon: "github", link: repository }],

    footer: {
      message: "Released under the BSD-3-Clause License.",
      copyright: `Copyright © ${new Date().getFullYear()} Ridwan Olanrewaju`,
    },

    outline: { label: "On this page", level: [2, 3] },

    search: {
      provider: "local",
      options: {
        translations: {
          button: { buttonText: "Search docs", buttonAriaLabel: "Search docs" },
        },
      },
    },

    editLink: {
      pattern: `${repository}/edit/main/docs/:path`,
      text: "Edit this page on GitHub",
    },

    docFooter: { prev: "Previous", next: "Next" },

    lastUpdated: {
      text: "Updated at",
      formatOptions: { dateStyle: "short", timeStyle: "short" },
    },
  },
});
