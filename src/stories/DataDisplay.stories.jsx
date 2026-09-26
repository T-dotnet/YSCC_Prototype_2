import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { ActiveFilters, SortableHeader, useQueueSort } from "../components/QueueControls";
import { QueueCell, QueueRow } from "../components/QueueRow";
import ReportEvidenceCard from "../components/ReportEvidenceCard";
import { Badge, Button, PersonIdentity } from "../components/UI";
import { collectionStatus, createSeed, formatDate } from "../model";

const people = createSeed().people.slice(0, 3).map((person) => {
  const collection = person.episodes[0].collections.at(-1);
  return {
    id: person.id,
    name: person.name,
    item: collection.label,
    due: formatDate(collection.due),
    status: collectionStatus(collection),
  };
});

export default {
  title: "04 Records/Queues and evidence",
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Shared queue row, sortable header, active filters, and report evidence card as rendered in the prototype. The queue table includes the responsive labelled-cell contract.",
      },
    },
  },
};

export const ResponsiveQueue = {
  render: () => {
    const { sort, toggleSort } = useQueueSort({ key: "name", direction: "asc" });
    const sorted = [...people].sort((a, b) => {
      const comparison = a[sort.key].localeCompare(b[sort.key]);
      return sort.direction === "asc" ? comparison : -comparison;
    });
    return (
      <div className="ds-story" style={{ containerType: "inline-size" }}>
        <h2>Responsive queue</h2>
        <p>Use the viewport toolbar to inspect the 390 px labelled-row treatment.</p>
        <div className="table-scroll">
          <table className="work-table responsive-queue-table ds-queue-table" aria-label="Example work items">
            <thead><tr>
              <SortableHeader label="Person" sortKey="name" sort={sort} onSort={toggleSort} />
              <SortableHeader label="Work item" sortKey="item" sort={sort} onSort={toggleSort} />
              <SortableHeader label="Due" sortKey="due" sort={sort} onSort={toggleSort} />
              <SortableHeader label="Status" sortKey="status" sort={sort} onSort={toggleSort} />
              <th>Next action</th>
            </tr></thead>
            <tbody>{sorted.map((person) => (
              <QueueRow key={person.id}>
                <QueueCell label="Person" slot="subject"><PersonIdentity name={person.name} descriptor={person.id} /></QueueCell>
                <QueueCell label="Work item" slot="summary">{person.item}</QueueCell>
                <QueueCell label="Due" slot="date">{person.due}</QueueCell>
                <QueueCell label="Status" slot="state"><Badge>{person.status}</Badge></QueueCell>
                <QueueCell label="Next action" slot="action"><Button className="task-action">Open <ArrowRight size={16} aria-hidden="true" /></Button></QueueCell>
              </QueueRow>
            ))}</tbody>
          </table>
        </div>
      </div>
    );
  },
};

export const AppliedFilterChips = {
  render: () => {
    const [filters, setFilters] = useState(["Ready for review", "Alex"]);
    return (
      <div className="ds-story">
        <h2>Applied filters</h2>
        <ActiveFilters
          items={filters.map((label) => ({ id: label, label, onRemove: () => setFilters((current) => current.filter((item) => item !== label)) }))}
          onClear={() => setFilters([])}
        />
        {filters.length === 0 && <p className="ds-caption">All filters cleared.</p>}
      </div>
    );
  },
};

export const ReportEvidence = {
  render: () => (
    <div className="ds-story">
      <h2>Report evidence cards</h2>
      <div className="ds-stack">
        <ReportEvidenceCard
          variant="score"
          title="K10 self-report"
          metric={<div className="report-evidence-metric score"><strong>26</strong><span>/ 50</span></div>}
        >Collected 24 September 2026. The value is presented as a raw score with its scale.</ReportEvidenceCard>
        <ReportEvidenceCard
          variant="qualitative"
          title="Care observation"
          metric={<div className="report-evidence-metric qualitative"><strong>2</strong><span>notes</span></div>}
        >Qualitative observations are kept separate from scored measures.</ReportEvidenceCard>
      </div>
    </div>
  ),
};
