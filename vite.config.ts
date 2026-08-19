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
      registerType: "autoUpdate",
      includeAssets: ["vault.svg"],
      manifest: {
        name: "Mi bóveda",
        short_name: "Bóveda",
        description: "Gestor personal de contraseñas local y privado",
        theme_color: "#171329",
        background_color: "#0e0b18",
        display: "standalone",
        start_url: "/",
        icons: [
          {
            src: "vault.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any maskable",
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
