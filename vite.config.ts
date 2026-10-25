import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig, loadEnv } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig(({ command, mode }) => {
  // Load private settings for development without exposing them to the browser.
  if (command === "serve") {
    const env = loadEnv(mode, process.cwd(), "GEMINI_");
    for (const [key, value] of Object.entries(env)) process.env[key] ??= value;
  }
  return {
    server: { host: "0.0.0.0", port: 8080, strictPort: true },
    resolve: { dedupe: ["react", "react-dom", "@tanstack/react-router"] },
    plugins: [
      tsconfigPaths(),
      tailwindcss(),
      tanstackStart({ server: { entry: "server" } }),
      react(),
      ...(command === "build" ? [nitro({
        preset: "cloudflare-module",
        output: { dir: "dist", publicDir: "dist/client", serverDir: "dist/server" },
        cloudflare: { nodeCompat: true },
      })] : []),
    ],
  };
});
