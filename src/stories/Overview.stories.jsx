const groups = [
  ["Foundations", "F01–F06", "Live colour, type, space, and shape tokens", "Responsive and focus contracts still need explicit story coverage"],
  ["Primitives", "A01–A12", "Actions, badges, identity, search, fields, pickers, validation", "Icon action, tags, choice controls, and progress need extraction"],
  ["Compositions", "M01–M16", "Headings, panels, tabs, consent and Care events filters, responsive queue, record, dialog, feedback, report evidence", "Popover, grouped assessment summary, and charts remain feature-owned"],
  ["Templates", "O01–O11", "Person record context, People page excerpt, and assessment collection cards", "Full workspace, intake, participant, and report templates need isolated fixtures"],
];

export default {
  title: "00 Start here/Collection map",
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "A living collection linked to the 26 September 2026 visible-app audit. Stories render existing production components and current CSS; they expose reuse and drift without declaring an approved design system.",
      },
    },
  },
};

export const ReadTheCollection = {
  render: () => (
    <div className="ds-story">
      <h2>YSCC component collection</h2>
      <p>This Storybook is the visual companion to the full visible-app inventory. It moves from tokens through controls and records to page compositions. Stories use the app components, styles, and fictional sample records.</p>
      <div className="ds-stack">
        {groups.map(([group, ids, covered, remaining]) => (
          <div className="ds-example" key={group}>
            <h3>{group} <small>{ids}</small></h3>
            <p><strong>Stories:</strong> {covered}.</p>
            <p><strong>Next:</strong> {remaining}.</p>
          </div>
        ))}
      </div>
      <div className="ds-note">
        <strong>First consolidation candidates:</strong> status semantics, filter toolbar anatomy, record item presentations, and dialog form layout. Keep direct contacts, indirect activity, contextual care events, assessment evidence, and audit changes distinct.
      </div>
    </div>
  ),
};
