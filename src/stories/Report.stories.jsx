import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";
import RecordTwo from "../features/RecordTwo";
import { CareTimeline } from "../features/LongitudinalReport";
import { createSeed } from "../model";

const person = createSeed().people.find((item) => item.id === "YS-1034");
const episode = person.episodes[0];

function ReportFrame({ children }) {
  return <div className="ds-story ds-record-frame"><main className="main main-internal ds-person-main">
    <div className="person-heading"><h1>{person.id}</h1></div>
    <div className="person-content-surface person-open-surface"><div className="stack record-two">{children}</div></div>
  </main></div>;
}

export default {
  title: "05 Compositions/Consolidated report",
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    settings: { simpleAssessments: true, scheduleAssessments: false },
    docs: { description: { component: "The production report with fictional sample evidence. Measure selection, comparison, timeline filters and disclosure work locally. Source navigation is displayed as feedback rather than leaving Storybook. Use the Color setup toolbar to preview the six visible interface palettes; chart and risk colours keep their semantic roles." } },
  },
};

export const ReportDashboard = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Compare measures" }));
    const dialog = within(canvasElement.ownerDocument.body).getByRole("dialog");
    const modal = within(dialog);
    await expect(modal.getByRole("table")).toBeVisible();
    await expect(modal.queryByText("Completed", { exact: true })).not.toBeInTheDocument();
    await userEvent.click(modal.getByRole("checkbox", { name: "SDQ", exact: true }));
    await expect(modal.getByText("3 of 3 selected")).toBeVisible();
    await expect(modal.getByRole("checkbox", { name: "WHO-5", exact: true })).toBeDisabled();
    // Testing Library's synthetic Escape cannot invoke a native dialog's cancel action.
    await userEvent.click(modal.getByRole("button", { name: "Close dialog" }));
    await expect(dialog).not.toBeInTheDocument();
    await expect(canvas.getByRole("button", { name: "Compare measures" })).toHaveFocus();
  },
  render: () => {
    const [destination, setDestination] = useState("");
    return <ReportFrame><RecordTwo person={person} episode={episode} navigate={setDestination} />
      {destination && <p className="ds-note" role="status">Source route: {destination}</p>}
    </ReportFrame>;
  },
};

export const SemanticCareTimeline = {
  render: () => {
    const [visible, setVisible] = useState(true);
    const [destination, setDestination] = useState("");
    return <ReportFrame><h2 className="sr-only">Care overview</h2><CareTimeline person={person} episode={episode} simpleAssessments scheduleAssessments={false}
      isVisible={visible} onToggle={() => setVisible(!visible)} navigate={setDestination} />
      {destination && <p className="ds-note" role="status">Source route: {destination}</p>}
    </ReportFrame>;
  },
};
