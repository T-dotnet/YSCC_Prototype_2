import "@fontsource-variable/inter/index.css";
import "@fontsource-variable/outfit/index.css";
import "../src/styles.css";
import "./storybook.css";
import ysccTheme from "./ysccTheme";

function StoryEnvironment({ children, setup, settings }) {
  useLayoutEffect(() => {
    const previous = document.documentElement.dataset.uiSetup;
    document.documentElement.dataset.uiSetup = String(setup || 1);
    return () => {
      if (previous === undefined) delete document.documentElement.dataset.uiSetup;
      else document.documentElement.dataset.uiSetup = previous;
    };
  }, [setup]);
  return <StoreProvider settings={settings}>{children}</StoreProvider>;
}

export default {
  initialGlobals: { uiSetup: 1 },
  globalTypes: {
    uiSetup: {
      description: "Brand UI color setup",
      toolbar: {
        title: "Color setup",
        icon: "paintbrush",
        dynamicTitle: true,
        items: [
          { value: 1, title: "Setup 1 · Current" },
          { value: 2, title: "Setup 2 · Forest" },
          { value: 3, title: "Setup 3 · Forest + lime" },
          { value: 4, title: "Setup 4 · Forest + cyan" },
        ],
      },
    },
  },
  decorators: [(Story, context) => (
    <StoryEnvironment key={context.id} setup={context.globals.uiSetup} settings={context.parameters.settings}>
      <Story />
    </StoryEnvironment>
  )],
  parameters: {
    a11y: { test: "error" },
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
import { useLayoutEffect } from "react";
import { StoreProvider } from "./StoryStore";
