import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

function githubPagesBase() {
  if (!process.env.GITHUB_ACTIONS) return "/";
  const repository = process.env.GITHUB_REPOSITORY?.split("/")[1];
  return repository ? `/${repository}/` : "/lol-card/";
}

export default defineConfig({
  base: githubPagesBase(),
  plugins: [react(), tailwindcss()],
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
