import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    fileParallelism: false,
    poolOptions: {
      threads: {
        singleThread: true,
      },
    },
    hookTimeout: 30000,
    testTimeout: 15000,
  },
});
