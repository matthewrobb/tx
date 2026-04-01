import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["build/__tests__/**/*.test.ts"],
    environment: "node",
  },
});
