import { expect, userEvent, within } from "storybook/test";
import AdminInstrumentsTable from "../components/AdminInstrumentsTable";
import AssessmentScheduleSettings from "../components/AssessmentScheduleSettings";
import AdminOutcomeOptions from "../components/AdminOutcomeOptions";
import { INSTRUMENTS } from "../instruments";

const pathwaySettings = { advancedAssessmentOptions: false, mvpAssessmentPathway: true };

export default {
  title: "05 Compositions/Administration",
  tags: ["autodocs"],
  parameters: {
    settings: pathwaySettings,
    docs: { description: { component:
      "Production Administration surfaces for the current codebook pathway. Measures, Assessment Packs, and record outcome options use the isolated Storybook store; edits remain in this story session."
    } },
  },
};

export const Measures = {
  render: () => <div className="ds-story"><AdminInstrumentsTable settings={pathwaySettings} /></div>,
  parameters: { docs: { description: { story:
    "The production Measures table shows question counts, availability, Assessment Pack associations, and a working preview. Adding and editing a measure are currently unavailable in the app."
  } } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const firstMeasure = INSTRUMENTS[0];
    await expect(canvas.getByRole("table", { name: "Measure catalogue" })).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: `Preview ${firstMeasure.name}` }));
    const dialog = within(canvasElement.ownerDocument.body).getByRole("dialog", { name: "Measure preview" });
    await expect(within(dialog).getByText("Practice only.", { exact: false })).toBeVisible();
    await userEvent.click(within(dialog).getByRole("button", { name: "Close preview" }));
    await expect(dialog).not.toBeInTheDocument();
  },
};

export const AssessmentPacks = {
  render: () => <div className="ds-story"><AssessmentScheduleSettings /></div>,
  parameters: { docs: { description: { story:
    "The production Assessment Packs list includes Client profile, program stream initial assessments, 90 Day Review packs, filters, and the pack editors. Open a pack to inspect its collection methods, schedule, measures, and status change."
  } } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("heading", { name: "Assessment Packs" })).toBeVisible();
    await expect(canvas.getByText("Client profile", { exact: true })).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Edit Client profile" }));
    const dialog = within(canvasElement.ownerDocument.body).getByRole("dialog", { name: "Edit Client profile Assessment Pack" });
    await expect(within(dialog).getByRole("heading", { name: "Profile items in this Assessment Pack" })).toBeVisible();
    await userEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await expect(dialog).not.toBeInTheDocument();
  },
};

export const RecordOutcomes = {
  render: () => <div className="ds-story"><AdminOutcomeOptions /></div>,
  parameters: { docs: { description: { story:
    "The production outcome settings for status changes. The Batch 2 assessment rule can be expanded and edited here; story changes stay in memory."
  } } },
};
