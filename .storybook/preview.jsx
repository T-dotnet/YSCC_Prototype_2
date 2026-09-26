import "@fontsource-variable/inter/index.css";
import "@fontsource-variable/outfit/index.css";
import "../src/styles.css";
import "./storybook.css";
import ysccTheme from "./ysccTheme";

export default {
  parameters: {
    layout: "padded",
    controls: { expanded: true },
    docs: { theme: ysccTheme },
    options: {
      storySort: {
        order: ["00 Start here", "01 Foundations", "02 Primitives", "03 Navigation", "04 Records", "05 Compositions"],
      },
    },
  },
};
