/** @type { import('@storybook/react-vite').StorybookConfig } */
const config = {
  stories: ["../src/**/*.stories.@(js|jsx)"],
  staticDirs: ["../public"],
  addons: ["@storybook/addon-docs", "@storybook/addon-vitest", "@storybook/addon-a11y", "@chromatic-com/storybook"],
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
  viteFinal: (config) => ({
    ...config,
    resolve: {
      ...config.resolve,
      alias: [
        { find: /^\.\.\/store(?:\.jsx)?$/, replacement: fileURLToPath(new URL("./StoryStore.jsx", import.meta.url)) },
        ...(Array.isArray(config.resolve?.alias) ? config.resolve.alias : Object.entries(config.resolve?.alias || {}).map(([find, replacement]) => ({ find, replacement }))),
      ],
    },
  }),
};

export default config;
import { fileURLToPath } from "node:url";
