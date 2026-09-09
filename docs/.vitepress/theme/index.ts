import type { Theme } from "vitepress";
import DefaultTheme from "vitepress/theme";
import { h } from "vue";
import HomeLayout from "./components/HomeLayout.vue";
import PlugIcon from "./components/PlugIcon.vue";
import "./style.css";

export default {
  extends: DefaultTheme,

  enhanceApp({ app }) {
    // Custom page layout used by the landing page (see docs/index.md).
    app.component("HomeLayout", HomeLayout);
    app.component("PlugIcon", PlugIcon);
  },

  // Inject the plug mark into the site navbar (before the wordmark title).
  Layout: () =>
    h(DefaultTheme.Layout, null, {
      "nav-bar-title-before": () =>
        h("span", { class: "nav-plug-wrap" }, [
          h(PlugIcon, { class: "nav-plug", size: 20 }),
        ]),
    }),
} satisfies Theme;
