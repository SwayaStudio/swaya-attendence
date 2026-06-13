import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    // Default to a Node environment; files that need a DOM opt in per-file with
    //   // @vitest-environment jsdom
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Integration tests that need a real MongoDB are guarded with
    // describe.skipIf(!process.env.MONGODB_URI), so the suite is green without one.
    globals: false,
  },
});
