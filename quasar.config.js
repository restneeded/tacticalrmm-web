/* eslint-env node */

/*
 * This file runs in a Node context (it's NOT transpiled by Babel), so use only
 * the ES6 features that are supported by your Node version. https://node.green/
 */

// Configuration for your app
// https://v2.quasar.dev/quasar-cli-vite/quasar-config-js

const { mergeConfig } = require("vite");
const { configure } = require("quasar/wrappers");
const path = require("path");
require("dotenv").config();

// Phase A: Vite dev-server proxy. The Vue app is served at rmm-dev.bhsj.org
// while every backend route falls through to the existing prod API at
// rmm-api.bhsj.org via Cloudflare's tunnel. This keeps the dev SPA same-origin
// (no CORS pain) and means we don't have to modify the prod nginx CORS list.
//
// Backend routes (per tacticalrmm/api/.../urls.py): clients, agents, checks,
// services, winupdate, software, core, automation, tasks, logs, scripts,
// alerts, accounts, v2, api/v3, api/v4, reporting, _allauth, logout, logoutall,
// natsws, and the WebSocket prefix /ws/.
const API_PROXY_TARGET = process.env.PROD_URL || "https://rmm-api.bhsj.org";
const API_PATH_PREFIXES = [
  "clients",
  "agents",
  "checks",
  "services",
  "winupdate",
  "software",
  "core",
  "automation",
  "tasks",
  "logs",
  "scripts",
  "alerts",
  "accounts",
  "v2",
  "api",
  "reporting",
  "_allauth",
  "logout",
  "logoutall",
  "natsws",
  // Phase G — fork additions.
  "reports",
  "saved-views",
];

// Phase D: SOME backend-prefixes double as SPA routes (notably "software").
// A naive proxy entry like `/software/` intercepts BROWSER NAVIGATION too,
// not just XHR/fetch — so reloading https://rmm-dev.bhsj.org/software gives
// you a raw JSON 401 instead of the Vue SPA. Vite's http-proxy supports a
// `bypass` hook that returns the original URL to skip proxying and let the
// SPA history-fallback render index.html. We use it on the conflicting
// prefixes only — XHR requests (Accept: application/json or */*) still go
// to the backend; full-page navigations (Accept: text/html) fall through.
// Phase G: /reports also doubles as an SPA route (compliance reports
// area). saved-views does NOT — it's purely a backend prefix.
const SPA_ROUTE_PATHS = new Set(["software", "reports", "clients", "scripts", "checks", "tasks"]);
function bypassForSpa(req /*: http.IncomingMessage */) {
  const accept = (req.headers && req.headers.accept) || "";
  if (accept.includes("text/html")) return req.url; // serve SPA fallback
  return null; // proxy as normal
}

const devProxy = {};
for (const p of API_PATH_PREFIXES) {
  const cfg = {
    target: API_PROXY_TARGET,
    changeOrigin: true,
    secure: true,
  };
  if (SPA_ROUTE_PATHS.has(p)) cfg.bypass = bypassForSpa;
  devProxy[`/${p}/`] = cfg;
  // bare path with no trailing slash (e.g. POST /logout)
  devProxy[`/${p}`] = cfg;
}
// WebSocket proxy — Django channels on /ws/...
devProxy["/ws"] = {
  target: API_PROXY_TARGET,
  changeOrigin: true,
  secure: true,
  ws: true,
};

module.exports = configure(function (/* ctx */) {
  return {
    eslint: {
      fix: true,
      // include = [],
      // exclude = [],
      // rawOptions = {},
      warnings: true,
      errors: true,
    },

    // https://v2.quasar.dev/quasar-cli-vite/prefetch-feature
    // preFetch: true,

    // app boot file (/src/boot)
    // --> boot files are part of "main.js"
    // https://v2.quasar.dev/quasar-cli-vite/boot-files
    boot: ["pinia", "theme", "axios", "monaco", "integrations"],

    // https://v2.quasar.dev/quasar-cli-vite/quasar-config-js#css
    css: ["app.sass"],

    // https://github.com/quasarframework/quasar/tree/dev/extras
    extras: [
      "ionicons-v4",
      "mdi-v7",
      "fontawesome-v6",
      // 'eva-icons',
      // 'themify',
      // 'line-awesome',
      // 'roboto-font-latin-ext', // this or either 'roboto-font', NEVER both!

      "roboto-font", // optional, you are not bound to it
      "material-icons", // optional, you are not bound to it
    ],

    // Full list of options: https://v2.quasar.dev/quasar-cli-vite/quasar-config-js#build
    build: {
      target: {
        browser: ["es2022"],
        node: "node20",
      },

      vueRouterMode: "history", // available values: 'hash', 'history'
      // vueRouterBase,
      // vueDevtools,
      // vueOptionsAPI: false,

      // rebuildCache: true, // rebuilds Vite/linter/etc cache on startup

      // publicPath: '/',
      // analyze: true,
      env: {
        DEV_API: process.env.DEV_API !== undefined ? process.env.DEV_API : process.env.DEV_URL,
        PROD_API: process.env.PROD_URL,
        DOCKER_BUILD: process.env.DOCKER_BUILD,
      },
      alias: {
        ["@"]: path.join(__dirname, "./src"),
      },
      // rawDefine: {}
      // ignorePublicFolder: true,
      // minify: false,
      // polyfillModulePreload: true,
      distDir: "dist/",

      /* eslint-disable quotes */
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      extendViteConf(viteConf, { isServer, isClient }) {
        viteConf.build = mergeConfig(viteConf.build, {
          chunkSizeWarningLimit: 1600,
          rollupOptions: {
            output: {
              entryFileNames: `[hash].js`,
              chunkFileNames: `[hash].js`,
              assetFileNames: `[hash].[ext]`,
            },
          },
        });

        // Phase E render fix: Vite 2.9.18 (pinned by @quasar/app-vite 1.10.2) is
        // prone to optimizer thrashing in dev mode. Boot-file dynamic imports and
        // page-level lazy imports cause Vite to discover deps after the initial
        // cold-bundle, then re-optimize — each rebuild produces a new ?v=<hash>
        // suffix. Modules pinned to OLD hashes keep loading old bundle copies, so
        // a single dev page load can pull 4+ separate Vue runtime instances. Vue's
        // module-local `currentRenderingInstance` is NOT in __VUE_INSTANCE_SETTERS__
        // (only `currentInstance` is), so it never syncs across the duplicates;
        // _resolveComponent("router-view") reads null currentInstance and falls
        // back to the literal HTML tag, leaving <router-view> unrendered.
        //
        // Fix: explicitly enumerate all runtime deps so Vite bundles them in ONE
        // pass during cold-start, before serving any module to the browser. The
        // result is a single stable ?v=<hash> across the page load → single Vue
        // runtime → router-view renders.
        if (isClient) {
          // Stop Vite from telling the browser to cache pre-bundled deps with
          // "max-age=31536000, immutable". When the optimizer re-bundles (and
          // it WILL on every dev-server restart), old ?v=<hash> URLs linger in
          // the browser cache forever, mixing with new chunks → multi-Vue. In
          // dev we just want every fetch to revalidate against the live server.
          viteConf.server = mergeConfig(viteConf.server || {}, {
            headers: {
              "Cache-Control": "no-store, max-age=0",
            },
          });

          // The actual root cause: npm's hoisting installs multiple copies of
          // @vue/shared@3.5.22 (under @vue/reactivity, @vue/runtime-core, vue,
          // and top-level node_modules). Vite bundles each runtime sub-package
          // with its OWN copy of @vue/shared, so the `currentInstance` and
          // `currentRenderingInstance` module-locals exist 3-4 times. Only one
          // is set during render; resolveComponent reads null from another and
          // App.vue's <router-view> falls back to a literal HTML tag.
          //
          // resolve.dedupe forces a single resolution path for these packages
          // regardless of where the import originates in the dep graph.
          viteConf.resolve = mergeConfig(viteConf.resolve || {}, {
            dedupe: [
              "vue",
              "@vue/runtime-core",
              "@vue/runtime-dom",
              "@vue/reactivity",
              "@vue/shared",
              "vue-router",
              "pinia",
            ],
          });

          // Pre-bundle all runtime deps in ONE optimizer pass on cold start so
          // the dev server emits a single stable ?v=<hash> across the page load,
          // instead of lazily re-optimizing as new imports are discovered.
          viteConf.optimizeDeps = mergeConfig(viteConf.optimizeDeps || {}, {
            include: [
              "vue",
              "vue-router",
              "pinia",
              "axios",
              "vuex",
              "@vueuse/core",
              // @vueuse/integrations top-level imports many optional peer deps
              // (async-validator, change-case, drauu, focus-trap, ...) that
              // aren't installed. Pin only the sub-path the app actually uses.
              "@vueuse/integrations/useQRCode",
              "monaco-editor",
              "vue3-apexcharts",
              "apexcharts",
              "dompurify",
              "yaml",
              "qrcode",
              "@xterm/xterm",
              "@xterm/addon-fit",
              "vuedraggable",
            ],
          });
        }
      },
      /* eslint-enable quotes */
      // viteVuePluginOptions: {},
      // vitePlugins: []
    },

    // Full list of options: https://v2.quasar.dev/quasar-cli-vite/quasar-config-js#devServer
    devServer: {
      https: process.env.USE_HTTPS === "true",
      open: false, // opens browser window automatically
      host: process.env.DEV_HOST,
      port: process.env.DEV_PORT ? Number(process.env.DEV_PORT) : undefined,
      // Phase A: HMR client must connect through Cloudflare on 443/wss when
      // VITE_HMR_HOST is set; falls back to the default in plain local dev.
      hmr: process.env.VITE_HMR_HOST
        ? {
            host: process.env.VITE_HMR_HOST,
            protocol: "wss",
            clientPort: 443,
          }
        : undefined,
      // Allow rmm-dev.bhsj.org as a Vite host (Vite ≥4 blocks unknown hosts).
      allowedHosts: process.env.VITE_HMR_HOST
        ? [process.env.VITE_HMR_HOST, "localhost"]
        : true,
      proxy: devProxy,
    },

    // https://v2.quasar.dev/quasar-cli-vite/quasar-config-js#framework
    framework: {
      config: {
        loadingBar: {
          size: "4px",
        },
        notify: {
          position: "top",
          timeout: 2000,
          textColor: "white",
          actions: [{ icon: "close", color: "white" }],
        },
        loading: {
          delay: 50,
        },
      },

      iconSet: "material-icons", // Quasar icon set
      lang: "en-US", // Quasar language pack

      // For special cases outside of where the auto-import strategy can have an impact
      // (like functional components as one of the examples),
      // you can manually specify Quasar components/directives to be available everywhere:
      //
      // components: [],
      // directives: [],

      // Quasar plugins
      plugins: ["Dark", "Dialog", "Loading", "LoadingBar", "Meta", "Notify"],
    },

    // animations: 'all', // --- includes all animations
    // https://v2.quasar.dev/options/animations
    animations: [],

    // https://v2.quasar.dev/quasar-cli-vite/quasar-config-js#sourcefiles
    // sourceFiles: {
    //   rootComponent: 'src/App.vue',
    //   router: 'src/router/index',
    //   store: 'src/store/index',
    //   registerServiceWorker: 'src-pwa/register-service-worker',
    //   serviceWorker: 'src-pwa/custom-service-worker',
    //   pwaManifestFile: 'src-pwa/manifest.json',
    //   electronMain: 'src-electron/electron-main',
    //   electronPreload: 'src-electron/electron-preload'
    // },

    // https://v2.quasar.dev/quasar-cli-vite/developing-ssr/configuring-ssr
    ssr: {
      // ssrPwaHtmlFilename: 'offline.html', // do NOT use index.html as name!
      // will mess up SSR

      // extendSSRWebserverConf (esbuildConf) {},
      // extendPackageJson (json) {},

      pwa: false,

      // manualStoreHydration: true,
      // manualPostHydrationTrigger: true,

      prodPort: 3000, // The default port that the production server should use
      // (gets superseded if process.env.PORT is specified at runtime)

      middlewares: [
        "render", // keep this as last one
      ],
    },

    // https://v2.quasar.dev/quasar-cli-vite/developing-pwa/configuring-pwa
    pwa: {
      workboxMode: "generateSW", // or 'injectManifest'
      injectPwaMetaTags: true,
      swFilename: "sw.js",
      manifestFilename: "manifest.json",
      useCredentialsForManifestTag: false,
      // extendGenerateSWOptions (cfg) {}
      // extendInjectManifestOptions (cfg) {},
      // extendManifestJson (json) {}
      // extendPWACustomSWConf (esbuildConf) {}
    },

    // Full list of options: https://v2.quasar.dev/quasar-cli-vite/developing-cordova-apps/configuring-cordova
    cordova: {
      // noIosLegacyBuildFlag: true, // uncomment only if you know what you are doing
    },

    // Full list of options: https://v2.quasar.dev/quasar-cli-vite/developing-capacitor-apps/configuring-capacitor
    capacitor: {
      hideSplashscreen: true,
    },

    // Full list of options: https://v2.quasar.dev/quasar-cli-vite/developing-electron-apps/configuring-electron
    electron: {
      // extendElectronMainConf (esbuildConf)
      // extendElectronPreloadConf (esbuildConf)

      inspectPort: 5858,

      bundler: "packager", // 'packager' or 'builder'

      packager: {
        // https://github.com/electron-userland/electron-packager/blob/master/docs/api.md#options
        // OS X / Mac App Store
        // appBundleId: '',
        // appCategoryType: '',
        // osxSign: '',
        // protocol: 'myapp://path',
        // Windows only
        // win32metadata: { ... }
      },

      builder: {
        // https://www.electron.build/configuration/configuration

        appId: "quasar-project",
      },
    },

    // Full list of options: https://v2.quasar.dev/quasar-cli-vite/developing-browser-extensions/configuring-bex
    bex: {
      contentScripts: ["my-content-script"],

      // extendBexScriptsConf (esbuildConf) {}
      // extendBexManifestJson (json) {}
    },
  };
});
