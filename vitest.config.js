import { defineConfig } from "vitest/config";
import { playwright } from "@vitest/browser-playwright";
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import { fileURLToPath } from "node:url";

// Storybook's generated browser guard leaves the curly apostrophe in this
// checkout path URL-encoded. Decode its URL path before matching the test file.
const decodeStorybookTestPath = {
  name: "decode-storybook-test-path",
  enforce: "post",
  transform(code, id) {
    if (!id.includes(".stories.")) return;
    const guard = "convertToFilePath(import.meta.url).includes(";
    if (code.includes(guard)) {
      return code.replace(guard, "decodeURI(convertToFilePath(import.meta.url)).includes(");
    }
  },
};

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
      }), decodeStorybookTestPath],
      test: {
        name: "storybook",
        browser: {
          enabled: true,
          headless: true,
          provider: playwright({ launchOptions: { channel: "chromium" } }),
          instances: [{ browser: "chromium" }],
        },
        testTimeout: 20000,
      },
    }],
  },
});
