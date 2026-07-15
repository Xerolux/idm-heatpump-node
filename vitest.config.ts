import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Git/Python parity files create and verify exact checkouts. Running them
    // concurrently causes I/O starvation and risks overlapping fixture gates.
    fileParallelism: false,
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/index.ts", "src/web/index.ts"],
      thresholds: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80,
      },
    },
  },
});
