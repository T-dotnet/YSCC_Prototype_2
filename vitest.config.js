import { defineConfig } from "vitest/config";
import { playwright } from "@vitest/browser-playwright";
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "next/navigation": fileURLToPath(new URL("./src/navigation.jsx", import.meta.url)),
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
  test: {
    coverage: {
      provider: "v8",
      reportOnFailure: true,
      reporter: ["text", "html", "json-summary"],
      include: ["src/components/**/*.{js,jsx}", "src/features/**/*.{js,jsx}"],
      reportsDirectory: "coverage/storybook",
    },
    projects: [{
      extends: true,
      plugins: [storybookTest({
        configDir: fileURLToPath(new URL("./.storybook", import.meta.url)),
        storybookScript: "npm run storybook -- --no-open",
        tags: { include: ["autodocs"] },
      })],
      test: {
        name: "storybook",
        browser: {
          enabled: true,
          headless: true,
          provider: playwright({ launchOptions: { channel: "chromium" } }),
          instances: [{ browser: "chromium" }],
        },
        setupFiles: ["./.storybook/vitest.setup.js"],
        testTimeout: 20000,
      },
    }],
  },
});
