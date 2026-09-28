import { beforeAll } from "vitest";
import { setProjectAnnotations } from "@storybook/react-vite";
import * as previewAnnotations from "./preview";
import * as a11yAnnotations from "@storybook/addon-a11y/preview";

const project = setProjectAnnotations([a11yAnnotations, previewAnnotations]);
beforeAll(project.beforeAll);
