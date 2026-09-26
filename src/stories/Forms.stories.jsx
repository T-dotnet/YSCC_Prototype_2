import { useState } from "react";
import {
  Button,
  Field,
  FormErrorSummary,
  Notice,
  SearchInput,
  Select,
  StaffPicker,
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
  render: () => {
    const [query, setQuery] = useState("Alex");
    return (
      <div className="ds-story ds-form">
        <h2>Search and clear</h2>
        <SearchInput value={query} onChange={setQuery} placeholder="Search people by name or ID" />
        <p className="ds-caption" style={{ marginTop: 16 }}>Current query: {query || "None"}</p>
      </div>
    );
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
