import { TextLink } from "../components/UI";
import RecordItem from "../components/RecordItem";
import AssessmentCollectionCard from "../components/AssessmentCollectionCard";
import { linkedAssessmentScore } from "../assessmentGroups";
import { createSeed, formatDate } from "../model";

const person = createSeed().people.find((item) => item.id === "YS-1024");
const episode = person.episodes[0];
const currentCollection = episode.collections.find((item) => item.id === "A-0-current");
const historicalCollection = episode.collections.find((item) => item.id === "A-0-baseline");
const directContact = episode.appointments.find((item) => item.attendance === "Attended");

const contactFacts = [
  { label: "Actual date", value: formatDate(directContact.actualDate) },
  { label: "Delivery mode", value: directContact.deliveryMode },
  { label: "Care worker", value: directContact.practitionerService },
  { label: "Outcome notes", value: directContact.outcomeNotes, wide: true },
];

export default {
  title: "04 Records/Record item",
  component: RecordItem,
  tags: ["autodocs"],
  args: {
    collapsible: false,
    initiallyExpanded: false,
    selected: false,
    tableRow: false,
    headingLevel: 3,
  },
  argTypes: {
    title: { control: "text" },
    subtitle: { control: "text" },
    status: { control: "text" },
    note: { control: "text" },
    collapsible: { control: "boolean" },
    initiallyExpanded: { control: "boolean" },
    selected: { control: "boolean" },
    tableRow: { control: "boolean" },
    summaryMeta: { control: "text" },
    eyebrow: { control: "text" },
    headingLevel: { control: "select", options: [2, 3, 4] },
    actions: { table: { disable: true } },
    lead: { table: { disable: true } },
    secondary: { table: { disable: true } },
    facts: { table: { disable: true } },
    className: { table: { disable: true } },
    id: { table: { disable: true } },
  },
  parameters: {
    docs: {
      description: {
        component:
          "Shared outer anatomy for record cards: heading, state, facts, secondary content, notes, and actions. The first three examples use current sample records; the source comparison is an illustrative anatomy study. Clinical contacts, indirect activity, contextual events, assessments, and audit changes retain separate meanings.",
      },
    },
  },
};

export const DirectServiceContact = {
  args: {
    title: directContact.appointmentType,
    subtitle: directContact.practitionerService,
    status: directContact.attendance,
    facts: contactFacts,
    actions: <TextLink type="button">View details</TextLink>,
  },
  decorators: [(Story) => <div className="ds-story"><div className="ds-record-list"><Story /></div></div>],
};

export const AssessmentCollection = {
  render: () => <div className="ds-story"><div className="ds-record-list"><AssessmentCollectionCard collection={currentCollection} person={person} score={linkedAssessmentScore(episode, currentCollection)} selectedId={currentCollection.id} onViewDetails={() => {}} onReview={() => {}} onCollect={() => {}} /></div></div>,
};

export const CollapsibleHistoricalRecord = {
  render: () => <div className="ds-story"><div className="ds-record-list"><AssessmentCollectionCard collection={historicalCollection} person={person} score={linkedAssessmentScore(episode, historicalCollection)} selectedId={currentCollection.id} onViewDetails={() => {}} onReview={() => {}} onCollect={() => {}} /></div></div>,
};

export const SourceTypeComparison = {
  render: () => (
    <div className="ds-story">
      <h2>Record source anatomy</h2>
      <p>Illustrative content shows common shell slots. The Care events story shows the current route and type-specific presentation.</p>
      <div className="ds-record-list">
        <RecordItem title="Care team coordination" subtitle="Indirect activity" status="Recorded" facts={[{ label: "Activity", value: "Interagency planning" }, { label: "Worker", value: "Jess Taylor" }]} note="Does not count as direct service contact" />
        <RecordItem title="School timetable changed" subtitle="Contextual Care event · 3 September 2026" status="Recorded" facts={[{ label: "Source", value: "Kai (self-report)" }, { label: "Context", value: "Education" }]} note="Context for care; not a service contact" />
        <RecordItem title="Assessment participation" subtitle="Consent v1.0 · This care episode" status="Accepted" facts={[{ label: "Decision maker", value: person.name }, { label: "Scope", value: "This care episode" }]} />
      </div>
    </div>
  ),
};

export const ConsolidatedCareEventRow = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const row = canvas.getByText(directContact.appointmentType).closest("summary");
    await userEvent.click(row);
    await expect(canvas.getByText(directContact.outcomeNotes)).toBeVisible();
    await userEvent.click(row);
    await expect(canvas.getByText(directContact.outcomeNotes)).not.toBeVisible();
  },
  args: {
    tableRow: true,
    collapsible: true,
    eyebrow: "Service contact",
    title: directContact.appointmentType,
    status: directContact.attendance,
    facts: contactFacts,
    actions: <TextLink type="button">View details</TextLink>,
  },
  decorators: [(Story) => <div className="ds-story"><section id="clinical-history-timeline">
    <div className="record-log-columns care-event-log-columns"><span>Type</span><span>Event</span><span>Status</span><span>Details</span></div>
    <Story />
  </section></div>],
};

export const ConsolidatedChangeRow = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByText("Care owner updated"));
    await expect(canvas.getByText("Alex Morgan → Jess Taylor")).toBeVisible();
  },
  args: {
    tableRow: true,
    collapsible: true,
    eyebrow: "Care episode",
    title: "Care owner updated",
    summaryMeta: "Jess Taylor",
    status: "1 field",
    facts: [{ label: "Care owner", value: "Alex Morgan → Jess Taylor", wide: true }],
  },
  decorators: [(Story) => <div className="ds-story"><section id="change-log-timeline">
    <div className="record-log-columns change-log-columns"><span>Scope</span><span>Change</span><span>Changed by</span><span>Fields</span><span>Details</span></div>
    <Story />
  </section><p className="ds-caption">Illustrative field change; expand the row to see the retained detail.</p></div>],
};

export const CompactAssessmentStates = {
  render: () => <div className="ds-story"><h2>Compact assessment records</h2>
    <p>Created, Draft and Completed share the same production component. Scheduling is off.</p>
    <div className="ds-record-list assessment-simple-group"><div className="assessment-simple-group-records">
      {["Created", "Draft", "Submitted"].map((response) => <AssessmentCollectionCard
        key={response}
        collection={{ ...historicalCollection, id: `story-${response}`, response, submittedAt: response === "Submitted" ? historicalCollection.submittedAt : undefined }}
        person={person}
        score={response === "Submitted" ? linkedAssessmentScore(episode, historicalCollection) : null}
        compactGrouped simpleAssessments scheduleAssessments={false} linkAssessmentAppointments={false}
        onCollect={() => {}} onViewDetails={() => {}} onReview={() => {}}
      />)}
    </div></div><p className="ds-caption">Response actions are visual examples; collection workflows remain in the app.</p>
  </div>,
};
import { expect, userEvent, within } from "storybook/test";
