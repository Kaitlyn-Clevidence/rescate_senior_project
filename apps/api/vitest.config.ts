// Author(s): Kaitlyn Clevidence
// Start date: 2026-11-07
// Last updated: 2026-11-07
// P4: Prototype 
// Purpose: configures Vitest for the API app; 
// sets up environment variables for testing

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/main.ts", "src/db/**"],
      reporter: ["text", "html", "lcov"],
      thresholds: { lines: 70, functions: 70, branches: 70, statements: 70 },
    },
    env: {
      DB_HOST: process.env.DB_HOST ?? "127.0.0.1",
      DB_PORT: process.env.DB_PORT ?? "3306",
      DB_USER: process.env.DB_USER ?? "test",
      DB_PASSWORD: process.env.DB_PASSWORD ?? "test",
      DB_NAME: process.env.DB_NAME ?? "test",
      CORS_ORIGIN: "http://localhost:5173",
    },
  },
});