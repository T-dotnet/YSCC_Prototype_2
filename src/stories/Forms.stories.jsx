import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";
import {
  Button,
  Checkbox,
  Field,
  FormErrorSummary,
  Notice,
  RadioCard,
  SearchInput,
  Select,
  StaffPicker,
  Switch,
  ValidatedForm,
} from "../components/UI";

export default {
  title: "02 Primitives/Fields and feedback",
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Existing form primitives with editable, required, invalid, and informational states. Stories use fictional examples and avoid saving data.",
      },
    },
  },
};

export const SearchAndClear = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.clear(canvas.getByRole("textbox"));
    await userEvent.type(canvas.getByRole("textbox"), "Samira");
    await expect(canvas.getByText("Current query: Samira")).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: /clear/i }));
    await expect(canvas.getByText("Current query: None")).toBeVisible();
  },
  render: () => {
    const [query, setQuery] = useState("Alex");
    return (
      <div className="ds-story ds-form">
        <h2>Search and clear</h2>
        <SearchInput value={query} onChange={setQuery} placeholder="Search people by name or ID" />
        <p className="ds-caption" style={{ marginTop: "var(--space-4)" }}>Current query: {query || "None"}</p>
      </div>
    );
  },
};

export const Checkboxes = {
  render: () => {
    const [enabled, setEnabled] = useState(true);
    const [repeat, setRepeat] = useState(false);
    return <div className="ds-story ds-form ds-stack">
      <Checkbox label="Enable this bundle" checked={enabled} onChange={event=>setEnabled(event.target.checked)}/>
      <Checkbox label="Repeat" checked={repeat} onChange={event=>setRepeat(event.target.checked)}/>
      <Checkbox label="Mandatory" checked disabled/>
    </div>;
  },
  play: async ({canvasElement}) => {
    const canvas=within(canvasElement);
    await userEvent.click(canvas.getByRole('checkbox',{name:'Enable this bundle'}));
    await expect(canvas.getByRole('checkbox',{name:'Enable this bundle'})).not.toBeChecked();
    await userEvent.click(canvas.getByRole('checkbox',{name:'Repeat'}));
    await expect(canvas.getByRole('checkbox',{name:'Repeat'})).toBeChecked();
    await expect(canvas.getByRole('checkbox',{name:'Mandatory'})).toBeDisabled();
  },
};

export const RadioCardsAndSwitch = {
  render: () => {
    const [method, setMethod] = useState("Clinic tablet");
    const [enabled, setEnabled] = useState(true);
    return <div className="ds-story ds-form ds-stack">
      <fieldset>
        <legend>Collection method</legend>
        <div className="collection-method-cards">
          {["Clinic tablet", "Clinician entry"].map(value => <RadioCard
            key={value} className="collection-method-card" selected={method === value}
            name="story-collection-method" value={value} checked={method === value}
            onChange={() => setMethod(value)}>
            <span><strong>{value}</strong><small>{value === "Clinic tablet" ? "Answers entered on a clinic device" : "Answers entered by the clinician"}</small></span>
          </RadioCard>)}
        </div>
      </fieldset>
      <Switch label="Allow collection" checked={enabled} onChange={event => setEnabled(event.target.checked)} />
      <p role="status">Selected: {method}; collection {enabled ? "on" : "off"}</p>
    </div>;
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("radio", { name: /Clinician entry/ }));
    await expect(canvas.getByRole("radio", { name: /Clinician entry/ })).toBeChecked();
    await userEvent.click(canvas.getByRole("switch", { name: "Allow collection" }));
    await expect(canvas.getByRole("switch", { name: "Allow collection" })).not.toBeChecked();
    await expect(canvas.getByRole("status")).toHaveTextContent("Selected: Clinician entry; collection off");
  },
};

export const FieldsAndPickers = {
  render: () => (
    <div className="ds-story ds-form">
      <h2>Fields and pickers</h2>
      <div className="ds-stack">
        <Field label="Contact subject" hint="Use a short description of the contact.">
          <input type="text" defaultValue="Follow-up call" />
        </Field>
        <Field label="Contact date">
          <input type="date" defaultValue="2026-09-26" />
        </Field>
        <Field label="Category">
          <Select label="Category" defaultValue="direct">
            <option value="direct">Direct service contact</option>
            <option value="indirect">Indirect activity</option>
            <option value="context">Contextual Care event</option>
          </Select>
        </Field>
        <Field label="Care owner">
          <StaffPicker name="owner" />
        </Field>
        <Field label="Notes" hint="Include only relevant detail.">
          <textarea rows="3" defaultValue="Follow-up arranged with the care team." />
        </Field>
      </div>
    </div>
  ),
};

export const ValidationStates = {
  render: () => (
    <div className="ds-story ds-form">
      <h2>Validation</h2>
      <div className="ds-stack">
        <Field label="Contact date" error="Enter a contact date.">
          <input type="date" required />
        </Field>
        <FormErrorSummary
          title="1 field to check"
          description="Correct the highlighted field, then try again."
          items={[]}
        />
        <Notice tone="amber">Review the contact details before recording this event.</Notice>
      </div>
    </div>
  ),
};

export const NativeFormValidation = {
  render: () => (
    <div className="ds-story ds-form">
      <h2>Validated form</h2>
      <p>Submit with the required field empty to see the live error summary.</p>
      <ValidatedForm className="ds-stack" onSubmit={(event) => event.preventDefault()}>
        <Field label="Contact subject">
          <input name="subject" required placeholder="Enter a subject" />
        </Field>
        <Button variant="primary" type="submit">Record contact</Button>
      </ValidatedForm>
    </div>
  ),
};
