import { defineConfig, type Plugin } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

function githubPagesBase() {
  if (!process.env.GITHUB_ACTIONS) return "/";
  const repository = process.env.GITHUB_REPOSITORY?.split("/")[1];
  return repository ? `/${repository}/` : "/lol-card/";
}

function optionalLanPlugin(): Plugin {
  return {
    name: "rift-lan-loader",
    async configureServer(server) {
      if (process.env.RIFT_LAN !== "1") return;
      const { startLanWsServer } = await import("./scripts/lan-plugin");
      await startLanWsServer();
    },
  };
}

export default defineConfig({
  base: githubPagesBase(),
  plugins: [react(), tailwindcss(), optionalLanPlugin()],
  server: {
    port: 5175,
    proxy: {
      "/ddragon": {
        target: "https://ddragon.leagueoflegends.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/ddragon/, ""),
      },
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: "./tests/setup.ts",
    css: true,
  },
});
