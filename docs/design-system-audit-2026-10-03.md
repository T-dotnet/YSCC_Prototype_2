# Design token and component audit — 3 October 2026

## Scope and result

Audited the active `YSCC_Prototype_2` checkout: all five production CSS files under `src`, shared controls in `src/components/UI.jsx`, Assessment Pack forms, radio choices, and the rendered Administration route. The checkout had substantial uncommitted work before this audit; fixes were made in place without resetting it.

**Result: the identified hardcoded interface colors and duplicated controls are resolved.** A declaration scan now finds zero direct hex, RGB, HSL, or RGBA colors outside CSS custom-property definitions in the five production stylesheets. The remaining literal SVG colors in `UI.jsx` draw the logo artwork.

## Corrections

- Defined missing tokens and consolidated 245 direct color uses into the existing surface, brand, status, category, and data palette, with a small set of new semantic tokens for distinct roles. Alpha shadows and overlays derive from those tokens using `color-mix`.
- Reused shared `Checkbox` and `Switch` controls throughout the inspected flows. Added `RadioInput` and `RadioCard`; the 14 previously native radio controls now use shared primitives. Their groups retain native `fieldset` or labelled `radiogroup` semantics.
- Added `FieldInput` and `FieldSelect` wrappers and migrated the Assessment scheduling and Pack editors. The duplicated input/select styling and fixed-color select arrow were removed. A `verbatim` option preserves coded measure and questionnaire wording.
- Replaced recurring spacing and radius literals in the main stylesheet and modern shell with scale tokens. The remaining values serve geometry such as pill shapes, chart axes, fixed column alignment, and deliberately small icon radii.
- Removed static JSX style objects from system status, logout confirmation, and timeline empty actions. Runtime chart positions, progress widths, popup placement, and token swatches remain computed inline.

## Verification

- `npm run lint`, `npm run build`, and `git diff --check` passed. Vite reported existing config and chunk-size warnings.
- The CSS declaration scan found zero direct colors outside custom-property definitions across `styles.css`, `shell.css`, `tabs.css`, `index.css`, and `SampleClientPreview.css`.
- The native radio/checkbox scan found only the implementations in `UI.jsx`.
- The rendered Assessment Pack editors showed labelled shared inputs/selects and the default appearance rendered without visible control regressions. The editors were cancelled; no sample configuration was saved.

The four appearance setups still override a small set of semantic tokens in CSS. This pass checked those declarations in source; only the currently selected setup was reviewed visually.
