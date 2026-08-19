import { fileURLToPath, URL } from "node:url";

import vue from "@vitejs/plugin-vue";
import { VitePWA } from "vite-plugin-pwa";
import { defineConfig } from "vite";

export default defineConfig({
  server: {
    allowedHosts: [".trycloudflare.com"],
  },
  plugins: [
    vue(),
    VitePWA({
      registerType: "prompt",
      includeAssets: [
        "vault-icon-180.png",
        "vault-icon-192.png",
        "vault-icon-512.png",
        "vault-icon-maskable-512.png",
      ],
      manifest: {
        id: "/",
        name: "Mi bóveda",
        short_name: "Bóveda",
        description: "Gestor personal de contraseñas local y privado",
        lang: "es",
        theme_color: "#171329",
        background_color: "#0e0b18",
        display: "standalone",
        orientation: "portrait-primary",
        scope: "/",
        start_url: "/",
        icons: [
          {
            src: "vault-icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "vault-icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "vault-icon-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        navigateFallback: "index.html",
      },
    }),
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
