import { addons } from "storybook/manager-api";
import ysccTheme from "./ysccTheme";

addons.setConfig({
  theme: ysccTheme,
  navSize: 260,
  bottomPanelHeight: 240,
  showPanel: false,
});
