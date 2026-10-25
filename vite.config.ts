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
  // Hosting target: Vercel exports VERCEL during its builds; otherwise Cloudflare.
  const isVercel = !!process.env["VERCEL"];
  return {
    server: { host: "0.0.0.0", port: 8080, strictPort: true },
    resolve: { dedupe: ["react", "react-dom", "@tanstack/react-router"] },
    plugins: [
      tsconfigPaths(),
      tailwindcss(),
      tanstackStart({ server: { entry: "server" } }),
      react(),
      ...(command === "build" ? [nitro({
        preset: isVercel ? "vercel" : "cloudflare-module",
        // The Vercel preset writes the Build Output API (.vercel/output) on its own.
        output: isVercel
          ? {}
          : { dir: "dist", publicDir: "dist/client", serverDir: "dist/server" },
        ...(isVercel ? {} : { cloudflare: { nodeCompat: true } }),
      })] : []),
    ],
  };
});
