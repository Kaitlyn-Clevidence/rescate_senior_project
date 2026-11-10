// Author(s): Kaitlyn Clevidence
// Start date: 2026-11-07
// Last updated: 2026-11-07
// P4: Prototype 
// Purpose: tests the config module that reads environment variables 

import { afterEach, describe, expect, it, vi } from "vitest";

// config/index.ts reads the environment when it is first imported,
// so each test resets the module cache and imports it fresh.
afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

async function loadConfig() {
  return (await import("../src/config/index.js")).config;
}

describe("config", () => {
  it("reads the database settings and converts the port to a number", async () => {
    vi.stubEnv("DB_HOST", "db.example");
    vi.stubEnv("DB_PORT", "3307");
    vi.stubEnv("DB_USER", "u");
    vi.stubEnv("DB_PASSWORD", "p");
    vi.stubEnv("DB_NAME", "n");

    const config = await loadConfig();

    expect(config.db).toEqual({
      host: "db.example",
      port: 3307,
      user: "u",
      password: "p",
      database: "n",
    });
  });

  it.each(["DB_HOST", "DB_PORT", "DB_USER", "DB_PASSWORD", "DB_NAME"])(
    "fails at startup and names the missing variable %s",
    async (name) => {
      vi.stubEnv(name, "");

      await expect(loadConfig()).rejects.toThrow(`Missing env var ${name}`);
    },
  );

  it("defaults the API port and CORS origin when they are not set", async () => {
    vi.stubEnv("API_PORT", undefined);
    vi.stubEnv("CORS_ORIGIN", undefined);

    const config = await loadConfig();

    expect(config.port).toBe(3000);
    expect(config.corsOrigin).toBe("http://localhost:5173");
  });

  it("uses API_PORT and CORS_ORIGIN when they are set", async () => {
    vi.stubEnv("API_PORT", "4000");
    vi.stubEnv("CORS_ORIGIN", "http://localhost:9999");

    const config = await loadConfig();

    expect(config.port).toBe(4000);
    expect(config.corsOrigin).toBe("http://localhost:9999");
  });

  it("treats an empty API_PORT or CORS_ORIGIN as not set", async () => {
    // a blank line like API_PORT= in .env must not turn the port into 0
    vi.stubEnv("API_PORT", "");
    vi.stubEnv("CORS_ORIGIN", "");

    const config = await loadConfig();

    expect(config.port).toBe(3000);
    expect(config.corsOrigin).toBe("http://localhost:5173");
  });
});