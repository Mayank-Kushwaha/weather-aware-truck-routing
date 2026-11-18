import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
import { defineConfig, loadEnv, type HtmlTagDescriptor, type Plugin } from "vite";

const TILES = "https://tiles.openfreemap.org";

/**
 * Resource hints, injected at build time:
 * - preconnect to the tile host and the API host so TLS is done before the first request;
 * - preload the basemap style and its tile index, which MapLibre fetches right after it boots.
 * The API origin comes from VITE_API_URL, so the hint is correct on every deployment.
 */
function resourceHints(apiUrl: string): Plugin {
  return {
    name: "resource-hints",
    transformIndexHtml(): HtmlTagDescriptor[] {
      const api = apiUrl.trim().replace(/\/+$/, "");
      const link = (attrs: Record<string, string>): HtmlTagDescriptor => ({ tag: "link", attrs, injectTo: "head-prepend" });
      return [
        link({ rel: "preconnect", href: TILES, crossorigin: "anonymous" }),
        link({ rel: "preload", as: "fetch", href: `${TILES}/styles/positron`, crossorigin: "anonymous" }),
        link({ rel: "preload", as: "fetch", href: `${TILES}/planet`, crossorigin: "anonymous" }),
        ...(api ? [link({ rel: "preconnect", href: api, crossorigin: "anonymous" })] : []),
      ];
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "VITE_");
  return {
    plugins: [react(), resourceHints(env.VITE_API_URL ?? "")],
    resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
    server: { proxy: { "/api": "http://127.0.0.1:8000" } },
    build: { chunkSizeWarningLimit: 1200 },
  };
});
