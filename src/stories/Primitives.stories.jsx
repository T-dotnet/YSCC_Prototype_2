import { useState } from "react";
import { ArrowRight, Plus, Trash2 } from "lucide-react";
import { Avatar, Badge, Button, PersonIdentity, TextLink } from "../components/UI";

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
        <p className="ds-caption" aria-live="polite" style={{ marginTop: 20 }}>Add contact clicked {count} times.</p>
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
            <div className="ds-row" style={{ marginTop: 12 }}>
              {values.map((value) => <Badge key={value}>{value}</Badge>)}
            </div>
          </div>
        ))}
      </div>
    </div>
  ),
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
      <div className="ds-row" style={{ marginTop: 24 }}>
        <TextLink type="button">View details</TextLink>
        <Button variant="secondary">Continue <ArrowRight size={16} aria-hidden="true" /></Button>
      </div>
    </div>
  ),
};
