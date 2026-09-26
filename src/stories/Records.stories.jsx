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
