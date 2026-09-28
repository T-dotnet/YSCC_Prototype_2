# Storybook testing audit — 28 September 2026

## Scope and result

Audit only: no app UI fixes were made during this testing work. Testing dependencies, Storybook configuration, and story interaction checks were added. Existing app changes predate this audit.

| Check | Result |
| --- | --- |
| Storybook production build | Passed |
| Chromium story tests | 37 total: 32 passed, 5 failed |
| Interaction assertions | Passed; the five failures are accessibility checks |
| Native Escape and focus restoration | Passed in Compare measures |
| Report browser console | No warning/error entries in the inspected tab |
| Cloud visual regression tests | Not run; Chromatic project/account connection required |

## Findings

### 1. Clear all button contrast — app component candidate

The Applied Filter Chips story fails `color-contrast` on `.text-button-small` (Clear all). Measured contrast is **3.19:1**, below the **4.5:1** requirement for its 13px normal text. Foreground `#fa532c`, background `#fbfbf9`.

Recommendation: review the shared small text-button token and choose a darker accessible brand colour. No colour was changed. Verify all four colour setups before accepting a fix; this run used the default setup.

### 2. Report evidence heading order — composition review

The Report Evidence story places an `h5` (K10 self-report) after its `h2` story heading. Axe flags `heading-order`. The component hardcodes h5; review its intended production parent hierarchy before deciding whether to change the component or story wrapper.

### 3. Contact participant context heading order — standalone story

`#story-consent-context-title` is h3 after the standalone story's h1. Missing h2 in this composition. This is not evidence that the full app route has the same defect.

### 4. Compact assessment states heading order — standalone story

The first created assessment has h4 after the story h2. The story omits the assessment group h3 used by the app. Review the representative story wrapper; no production heading change is proposed without route verification.

### 5. Semantic care timeline heading order — standalone story

`#longitudinal-timeline-heading` is h3 after the standalone frame's h1. The full consolidated report story passes its accessibility check. Review the isolated story's missing section heading.

## Interaction coverage

- Search: type a query, verify feedback, clear it, verify empty state.
- Consolidated care event row: expand and collapse recorded detail.
- Consolidated change row: expand changed-owner detail.
- Compare measures: open dialog, inspect table, confirm redundant Completed labels are absent, select a third measure, verify selection-limit disabling, close dialog and restore focus.
- Native browser keyboard input separately confirmed Escape closes the dialog and restores focus to Compare measures. Synthetic keyboard input alone does not exercise the browser's native dialog cancellation reliably.

## Coverage

Coverage scope includes `src/components` and `src/features`, including code not reached by the current story collection.

| Metric | Covered |
| --- | --- |
| Lines | 12.52% (418 / 3338) |
| Statements | 12.26% (465 / 3790) |
| Functions | 12.58% (187 / 1486) |
| Branches | 11.20% (655 / 5848) |

This measures the current Storybook suite, not complete app workflow coverage. It does not validate every route, responsive state, colour setup, or lifecycle branch. Machine-readable results are in `test-results.json` and `coverage-summary.json`; generated HTML is in `coverage/storybook/index.html` at the repository root.

## Tooling and dependency findings

The original workspace path contains spaces and a curly apostrophe. Vitest failed story registration there with No test suite found. An isolated temporary copy with a plain path and locally cloned dependencies successfully executed all 37 tests. This matches reported [non-ASCII path](https://github.com/storybookjs/storybook/issues/33700) and [space-in-path](https://github.com/storybookjs/storybook/issues/29572) problems. The original checkout was not moved.

`npm audit` reports **one moderate advisory propagated across five Vitest packages**, with zero high/critical findings. Installed Vitest family version: 4.1.10. [GHSA-82fw-gwwq-j7x9](https://github.com/advisories/GHSA-82fw-gwwq-j7x9) describes a mock redirect path traversal/arbitrary-file-read issue; the reported patched version is 4.1.11 or newer. Recommendation: update the matching Vitest dependency family and rerun. No audit fix was applied.

The Visual Tests addon is installed, but cloud visual comparisons need a connected Chromatic project and baseline. No account was created and no stories were uploaded or published.

## Reproduction

In a checkout without the observed path issue:

```sh
npm run build-storybook
npx vitest run --project=storybook --coverage
npm audit
```

Automated accessibility checks identify specific violations; passing stories are not a complete accessibility certification. Findings remain unfixed as requested.
