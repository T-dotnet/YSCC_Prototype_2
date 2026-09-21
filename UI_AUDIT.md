# UI/UX Audit & Improvement Roadmap: YSCC Clinical Workspace

This document tracks the current state of the application's visual design and lists prioritized improvements to ensure a professional, consistent, and accessible clinical experience.

## ✅ Current Strengths (Preserve)
- **Atmospheric Warmth**: Warm canvas (`#fbfbf9`) and Orygen Forest (`#1e3510`) brand colors are working well to reduce clinical coldness.
- **Typographic Hierarchy**: The pairing of **Outfit** (Display) and **Plus Jakarta Sans** (Body) establishes clear information priority.
- **Anti-Slop Design**: No unnecessary nested cards, glowing shadows, or gradient text. Hierarchy is achieved through whitespace and subtle dividers.
- **Mobile Adaptability**: Distinct card-based views for mobile ensure data density on desktop doesn't break the small-screen experience.

---

## 🛠️ Improvement Roadmap (Work through one-by-one)

### Phase 1: High-Priority UX & Accessibility
- [x] **1. Return-To Route State**:
    - **Issue**: Clicking a patient from the Queue and then navigating back resets temporary toolbar searches/filters.
    - **Goal**: Persist filter queries in URL parameters (`?q=...&status=...`) so search context is maintained upon return.
- [x] **2. Empty State CTA Guidance**:
    - **Issue**: When filters yield zero results, users are left with "No matching work" but no immediate recovery path.
    - **Goal**: Add a "Reset all filters" button inside the `Empty` component to simplify recovery.
- [x] **3. Accessible Motion**:
    - **Issue**: Pulsing animations (like the green status indicator) can be distracting for motion-sensitive users.
    - **Goal**: Add `@media (prefers-reduced-motion)` overrides to disable non-critical animations.

### Phase 2: Visual Refinement & Consistency
- [x] **4. Filter Chip Contrast**:
    - **Issue**: Active filter chips currently blend slightly too much into the off-white canvas.
    - **Goal**: Increase background contrast for active filter chips (`.active-filters-row`) and add a subtle border.
- [x] **5. Nested Border Radius Correction**:
    - **Issue**: Some internal elements might not perfectly match the mathematical corner nesting rule.
    - **Goal**: Audit and update CSS variables to ensure `Inner Radius = Outer Radius - Padding`.
- [x] **6. Touch Target Audit**:
    - **Issue**: Secondary actions (sort indicators, "Clear all" buttons) may be smaller than the 44px recommended touch target.
    - **Goal**: Increase hit-areas for interactive elements without significantly increasing visual size.

### Phase 3: Brand & Aesthetic Polish
- [x] **7. Contextual Empty State Visuals**:
    - **Issue**: Empty states are functional but generic.
    - **Goal**: Integrate subtle botanical or brand-aligned illustrations to make empty queues feel less "empty" and more calm.
- [x] **8. Data Density Calibration**:
    - **Issue**: Certain tables (Worklist) may feel slightly cramped on 13" laptop screens.
    - **Goal**: Implement subtle horizontal scrolling or dynamic column hiding for medium-sized viewports.

### Phase 4: Typographic & Neutral Refinement
- [x] **9. Sophisticated Neutrals**:
    - **Action**: Replaced pure `#ffffff` surfaces with a subtle "Paper White" (`#fdfdfb`) and removed hardcoded fallback grays in favor of the Sage design system.
- [x] **10. Readable Type Scale**:
    - **Action**: Increased baseline body size to 16px and adopted a 1.25 (Major Second) typographic scale for better readability and professional hierarchy.
- [x] **11. Optical Polish**:
    - **Action**: Refined `line-height` (1.6) and `letter-spacing` (-0.011em) to improve scanning of dense clinical records.

---

## 📈 Audit Completed
*Date: 21 September 2026*
*Status: Finalized*
