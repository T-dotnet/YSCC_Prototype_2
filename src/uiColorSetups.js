export const UI_COLOR_SETUPS = [
  {
    id: 1,
    name: "Setup 1",
    description: "Current palette · coral actions and warm neutrals",
    swatches: ["--action-coral", "--orygen-forest", "--surface-warm"],
  },
  {
    id: 2,
    name: "Setup 2",
    description: "Add forest green to actions and selection",
    swatches: ["--orygen-forest", "--action-coral", "--surface-warm"],
  },
  {
    id: 3,
    name: "Setup 3",
    description: "Forest and lime greens with the current coral",
    swatches: ["--orygen-forest", "--orygen-lime", "--action-coral"],
  },
  {
    id: 4,
    name: "Setup 4",
    description: "Forest green and brand cyan with the current coral",
    swatches: ["--orygen-forest", "--orygen-cyan", "--action-coral"],
  },
];

export const uiColorSetup = (value) =>
  UI_COLOR_SETUPS.some((setup) => setup.id === value) ? value : 1;
