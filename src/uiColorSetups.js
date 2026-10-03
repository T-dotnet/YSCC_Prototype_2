export const DEFAULT_UI_COLOR_SETUP = 9;

export const UI_COLOR_SETUPS = [
  {
    id: 1,
    name: "Setup 1",
    description: "Original palette · coral actions and warm neutrals",
    swatches: ["--action-coral", "--orygen-forest", "--surface-warm"],
  },
  {
    id: 2,
    hidden: true,
    name: "Setup 2",
    description: "Add forest green to actions and selection",
    swatches: ["--orygen-forest", "--action-coral", "--surface-warm"],
  },
  {
    id: 3,
    hidden: true,
    name: "Setup 3",
    description: "Forest and lime greens with the current coral",
    swatches: ["--orygen-forest", "--orygen-lime", "--action-coral"],
  },
  {
    id: 4,
    hidden: true,
    name: "Setup 4",
    description: "Forest green and brand cyan with the current coral",
    swatches: ["--orygen-forest", "--orygen-cyan", "--action-coral"],
  },
  {
    id: 5,
    name: "Yonder · Grove",
    description: "Deep forest actions, orange accents and soft sage surfaces",
    swatches: ["--orygen-forest", "--yonder-ember", "--yonder-grove-surface"],
  },
  {
    id: 6,
    name: "Yonder · Ember",
    description: "Warm coral actions, forest selection and cream surfaces",
    swatches: ["--yonder-ember", "--orygen-forest", "--yonder-ember-surface"],
  },
  {
    id: 7,
    name: "Yonder · Coral & Sage",
    description: "Red-orange actions, light green highlights and a light green sidebar",
    swatches: ["--yonder-ember", "--yonder-highlight-light", "--yonder-sidebar-light"],
  },
  {
    id: 8,
    name: "Yonder · Orchard",
    description: "Orange actions and accents, richer sage navigation and warm white surfaces",
    swatches: ["--yonder-ember", "--yonder-orchard-sage", "--yonder-orchard-surface"],
  },
  {
    id: 9,
    name: "Setup 1 · Yonder",
    description: "Setup 1's warm neutrals with Yonder orange, forest and sage",
    swatches: ["--yonder-ember", "--orygen-forest", "--yonder-sage"],
  },
];

export const VISIBLE_UI_COLOR_SETUPS = UI_COLOR_SETUPS.filter((setup) => !setup.hidden);

export const uiColorSetup = (value) =>
  VISIBLE_UI_COLOR_SETUPS.some((setup) => setup.id === value) ? value : DEFAULT_UI_COLOR_SETUP;
