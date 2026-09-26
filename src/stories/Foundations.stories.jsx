const colors = [
  ["Canvas", "--canvas", "Page background"],
  ["Surface", "--surface", "Cards and panels"],
  ["Inset surface", "--surface-inset", "Nested content"],
  ["Ink", "--ink", "Primary text"],
  ["Muted", "--muted", "Supporting text"],
  ["Action coral", "--action-coral", "Primary action"],
  ["Focus", "--focus-ring", "Keyboard focus"],
  ["Attention", "--status-attention-bg", "Needs attention"],
  ["Success", "--status-success-bg", "Completed state"],
  ["Danger", "--status-danger-bg", "Critical state"],
  ["Assessment", "--category-assessment-bg", "Record source category"],
  ["Clinical", "--category-clinical-bg", "Record source category"],
  ["Data blue", "--data-blue", "Report series"],
  ["Data violet", "--data-violet", "Report series"],
];

const spacing = [1, 2, 3, 4, 5, 6, 8, 10];

const typographyRoles = [
  ["Page title", "type-page", "--type-page", "One page heading · Outfit · 700", "A connected care record"],
  ["Featured title", "type-feature", "--type-feature", "Focal content only · Outfit · 700", "Current assessment"],
  ["Section title", "type-section", "--type-section", "Sections and panels · Outfit · 600", "Assessment history"],
  ["Item title", "type-title", "--type-title", "Cards and prominent items · Outfit · 600", "K10 collection"],
  ["Body / value", "type-body", "--type-body", "Reading text and field values · Inter · 400", "One episode, a connected history."],
  ["Control", "type-control", "--type-control", "Secondary actions · Inter · 400", "More filters"],
  ["Table identity", "type-table-title", "--type-body", "Person and assessment names in rows · Inter · 600", "Your preferences and next steps"],
  ["Table value", "type-table-value", "--type-body", "Dates, scores and other values · Inter · 400", "15 Jun 2026"],
  ["Form label", "type-form-label", "--type-form-label", "Input labels · Inter · 600", "Due date"],
  ["Metadata", "type-metadata", "--type-metadata", "Dates and supporting facts · Inter · 400", "Submitted 24 September 2026"],
  ["Data label", "type-data-label", "--type-data-label", "Record fact labels · Inter · 400", "Latest submitted"],
  ["Column label", "type-column-label", "--type-data-label", "Table column headings · Inter · 600", "Next due"],
  ["Status", "type-status", "--type-status-label", "Badges and compact state · Inter · 600", "Reviewed"],
];

export default {
  title: "01 Foundations/Tokens",
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Current tokens from src/styles.css. Action, status, record category, and report series colours have different meanings even where their visual treatments overlap.",
      },
    },
  },
};

export const SemanticColours = {
  render: () => (
    <div className="ds-story">
      <h2>Semantic colours</h2>
      <p>These are live CSS custom properties from the prototype.</p>
      <div className="ds-grid">
        {colors.map(([name, token, use]) => (
          <div className="ds-swatch" key={token} style={{ "--swatch": `var(${token})` }}>
            <div className="ds-swatch-color" />
            <div className="ds-swatch-label">
              <strong>{name}</strong>
              <code>{token}</code>
              <span>{use}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  ),
};

export const Typography = {
  render: () => (
    <div className="ds-story">
      <h2>Typography roles</h2>
      <p>Eight shared sizes. Values and row names use 15px; supporting text uses 14px; data labels use 13px; compact statuses use 12px. Weight distinguishes content, identity, state, and action. Heading level remains a content decision.</p>
      {typographyRoles.map(([role, className, token, use, copy]) => (
        <div className="ds-type-sample" key={className}>
          <div className={className}>{copy}</div>
          <p>{role} · <code>{token}</code> · {use}</p>
        </div>
      ))}
    </div>
  ),
};

export const SpacingAndShape = {
  render: () => (
    <div className="ds-story">
      <h2>Spacing and shape</h2>
      <p>The 4–40 px scale is used in component and layout spacing.</p>
      <div className="ds-stack">
        {spacing.map((step) => (
          <div className="ds-measure" key={step} style={{ "--measure": `var(--space-${step})` }}>
            <code>--space-{step}</code><span /><code>var(--space-{step})</code>
          </div>
        ))}
      </div>
      <div className="ds-row" style={{ marginTop: 32 }}>
        {["--control-radius", "--radius", "--radius-lg"].map((token) => (
          <div key={token} className="ds-example" style={{ borderRadius: `var(${token})` }}>
            <code>{token}</code>
          </div>
        ))}
      </div>
    </div>
  ),
};
