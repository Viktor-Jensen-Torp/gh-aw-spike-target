import { defineConfig } from "vitest/config";

// One run for every workspace: the web app in a browser-like DOM, the rest in Node.
export default defineConfig({
  test: {
    projects: [
      {
        extends: "./apps/web/vite.config.ts",
        test: {
          name: "web",
          root: "./apps/web",
          environment: "jsdom",
          include: ["src/**/*.test.{ts,tsx}"],
          setupFiles: ["./src/test-setup.ts"],
        },
      },
      { test: { name: "api", root: "./apps/api", environment: "node", include: ["src/**/*.test.ts"] } },
      { test: { name: "shared", root: "./packages/shared", environment: "node", include: ["src/**/*.test.ts"] } },
    ],
  },
});
