import "@fontsource-variable/inter/index.css";
import "@fontsource-variable/outfit/index.css";
import "../src/styles.css";
import "./storybook.css";
import ysccTheme from "./ysccTheme";
import { DEFAULT_UI_COLOR_SETUP } from "../src/uiColorSetups";

function StoryEnvironment({ children, setup, settings }) {
  useLayoutEffect(() => {
    const previous = document.documentElement.dataset.uiSetup;
    document.documentElement.dataset.uiSetup = String(setup || DEFAULT_UI_COLOR_SETUP);
    return () => {
      if (previous === undefined) delete document.documentElement.dataset.uiSetup;
      else document.documentElement.dataset.uiSetup = previous;
    };
  }, [setup]);
  return <StoreProvider settings={settings}>{children}</StoreProvider>;
}

export default {
  initialGlobals: { uiSetup: DEFAULT_UI_COLOR_SETUP },
  globalTypes: {
    uiSetup: {
      description: "Brand UI color setup",
      toolbar: {
        title: "Color setup",
        icon: "paintbrush",
        dynamicTitle: true,
        items: [
          { value: 1, title: "Setup 1 · Original" },
          { value: 5, title: "Yonder · Grove" },
          { value: 6, title: "Yonder · Ember" },
          { value: 7, title: "Yonder · Coral & Sage" },
          { value: 8, title: "Yonder · Orchard" },
          { value: 9, title: "Setup 1 · Yonder (default)" },
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
