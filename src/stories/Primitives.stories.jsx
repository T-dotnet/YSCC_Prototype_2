import { useState } from "react";
import { ArrowRight, Plus, Trash2 } from "lucide-react";
import { ActionGroup, Checkbox, DeleteAction, EditAction, IconButton, Avatar, Badge, Button, PersonIdentity, ProgressBar, TextLink } from "../components/UI";

export default {
  title: "02 Primitives/Actions and identity",
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Stories render the existing UI.jsx components. A status badge describes state; category labels, removable tags, and counts are separate candidate components in the audit.",
      },
    },
  },
};

export const ButtonPlayground = {
  args: { children: "Save changes", variant: "primary", disabled: false },
  argTypes: {
    children: { control: "text" },
    variant: { control: "select", options: ["", "primary", "secondary", "ghost"] },
    disabled: { control: "boolean" },
  },
  render: (args) => <div className="ds-story"><Button {...args} /></div>,
};

export const ButtonVariants = {
  render: () => (
    <div className="ds-story">
      <h2>Button variants</h2>
      <div className="ds-row">
        <Button variant="primary">New person</Button>
        <Button variant="secondary">Import</Button>
        <Button>Care episode actions</Button>
        <Button variant="ghost">Cancel</Button>
      </div>
      <div className="ds-note">These variants and labels are used in the current app. The default style appears on the person record header.</div>
    </div>
  ),
};

export const ButtonStates = {
  render: () => {
    const [count, setCount] = useState(0);
    return (
      <div className="ds-story">
        <h2>Interaction states</h2>
        <div className="ds-row">
          <Button variant="primary" onClick={() => setCount((value) => value + 1)}>Add contact</Button>
          <Button variant="primary" disabled>Saving…</Button>
          <Button variant="secondary" disabled>Unavailable</Button>
          <Button variant="primary"><Plus size={16} aria-hidden="true" /> Create assessment</Button>
          <Button variant="ghost"><Trash2 size={16} aria-hidden="true" /> Remove</Button>
        </div>
        <p className="ds-caption" aria-live="polite" style={{ marginTop: "var(--space-5)" }}>Add contact clicked {count} times.</p>
      </div>
    );
  },
};

export const BadgePlayground = {
  args: { children: "Ready for review", tone: "" },
  argTypes: {
    children: { control: "text" },
    tone: { control: "select", options: ["", "coral", "amber", "purple", "green", "neutral"] },
  },
  render: (args) => <div className="ds-story"><Badge {...args} /></div>,
};

export const BadgeWithoutStatusMark = {
  parameters: { docs: { description: { story: "Notification categories use shared badge colours without a status mark. Status badges keep the mark by default." } } },
  render: () => <div className="ds-story ds-row">
    <Badge tone="purple" className="notification-category-badge" showMark={false}>Measure ready for review</Badge>
    <Badge tone="purple">Ready for review</Badge>
  </div>,
};

export const StatusBadges = {
  render: () => (
    <div className="ds-story">
      <h2>Status badges</h2>
      <div className="ds-stack">
        {[
          ["Critical and overdue", ["Critical", "High", "Overdue"]],
          ["Attention", ["Medium", "Pending", "Paused", "Expired"]],
          ["Review or preparation", ["Ready for review", "Review pending", "Draft"]],
          ["Completed or active", ["Active", "Accepted", "Reviewed", "Submitted", "Completed"]],
          ["Neutral fallback", ["Open"]],
        ].map(([label, values]) => (
          <div className="ds-example" key={label}>
            <strong>{label}</strong>
            <div className="ds-row" style={{ marginTop: "var(--space-3)" }}>
              {values.map((value) => <Badge key={value}>{value}</Badge>)}
            </div>
          </div>
        ))}
      </div>
    </div>
  ),
};

export const ProgressBars = {
  render: () => <div className="ds-story ds-stack">
    <h2>Progress bars</h2>
    <div className="ds-example">
      <strong>3 of 5 measures completed</strong>
      <ProgressBar value={3} max={5} label="3 of 5 measures completed" />
    </div>
    <div className="ds-example">
      <strong>Required data complete</strong>
      <ProgressBar className="people-completeness-bar" value={100} label="100% of required data complete" />
    </div>
    <div className="ds-example">
      <strong>No measures yet</strong>
      <ProgressBar value={0} max={0} label="0 of 0 measures completed" />
    </div>
  </div>,
};

export const IdentityAndTextAction = {
  render: () => (
    <div className="ds-story">
      <h2>Identity and text action</h2>
      <div className="ds-row">
        <Avatar name="Kai Thompson" />
        <PersonIdentity name="Kai Thompson" descriptor="YS-1024 · Active episode" />
        <Avatar name="Jordan Ellis" tone="lavender" large />
        <PersonIdentity name="Jordan Ellis" descriptor="YS-1034 · Active episode" />
      </div>
      <div className="ds-row" style={{ marginTop: "var(--space-6)" }}>
        <TextLink type="button">View details</TextLink>
        <Button variant="secondary">Continue <ArrowRight size={16} aria-hidden="true" /></Button>
      </div>
    </div>
  ),
};

export const StandardActionSpacing = {
  parameters: { docs: { description: { story: "Use ActionGroup for related controls: 12px between controls, 8px between an icon and its label. Groups wrap when space is limited. Use EditAction and DeleteAction for named actions, and IconButton with an accessible label for compact row actions." } } },
  render: () => <div className="ds-story ds-stack">
    <ActionGroup><Checkbox label="Enabled" defaultChecked /><EditAction>Edit</EditAction><DeleteAction>Delete</DeleteAction><IconButton icon={Trash2} label="Remove item" /></ActionGroup>
    <ActionGroup><span>Assessment name</span><IconButton icon={Trash2} label="Remove assessment" /></ActionGroup>
    <ActionGroup><Button>Cancel</Button><Button variant="primary">Save changes</Button></ActionGroup>
    <div style={{ maxWidth: 240 }}><ActionGroup><EditAction>Edit assessment</EditAction><DeleteAction>Delete assessment</DeleteAction><Button>View details</Button></ActionGroup></div>
  </div>,
};
