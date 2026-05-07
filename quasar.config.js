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
];

const devProxy = {};
for (const p of API_PATH_PREFIXES) {
  devProxy[`/${p}/`] = {
    target: API_PROXY_TARGET,
    changeOrigin: true,
    secure: true,
  };
  // bare path with no trailing slash (e.g. POST /logout)
  devProxy[`/${p}`] = {
    target: API_PROXY_TARGET,
    changeOrigin: true,
    secure: true,
  };
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
        DEV_API: process.env.DEV_URL,
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
