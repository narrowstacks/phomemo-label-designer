import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["__tests__/**/*.test.ts"],
    passWithNoTests: true,
  },
  resolve: { alias: { "@": path.resolve(__dirname, ".") } },
});
