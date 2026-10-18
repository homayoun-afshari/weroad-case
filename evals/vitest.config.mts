import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

const root = fileURLToPath(new URL("..", import.meta.url));

/** The live eval: its own run, apart from `npm test`, because it calls the real model. */
export default defineConfig({
  root,
  resolve: { alias: { "@": root } },
  test: {
    include: ["evals/*.eval.ts"],
    // The key and the model come from .env.local, as they do for the app
    env: loadEnv("", root, ""),
    testTimeout: 1_800_000,
  },
});
