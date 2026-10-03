import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";
import { ChevronRight, Plus, Upload } from "lucide-react";
import AssessmentCollectionCard from "../components/AssessmentCollectionCard";
import DiscardChanges from "../components/DiscardChanges";
import ListFilterBar from "../components/ListFilterBar";
import StandardTable from "../components/StandardTable";
import { QueueCell, QueueRow } from "../components/QueueRow";
import { linkedAssessmentScore } from "../assessmentGroups";
import { recordCompleteness } from "../dataQuality";
import { age, createDefaultWorkspace, createSeed, formatDate, TODAY } from "../model";
import { episodeDisplayStatus, peopleForList } from "../people";
import {
  Button,
  Badge,
  Empty,
  Field,
  Modal,
  Notice,
  PageHeading,
  Panel,
  ProgressBar,
  Select,
  Success,
} from "../components/UI";

const seed = createSeed();
const peopleSeed = createDefaultWorkspace();
const person = seed.people.find((item) => item.id === "YS-1024");
const episode = person.episodes[0];
const currentCollection = episode.collections.find((item) => item.id === "A-0-current");

export default {
  title: "05 Compositions/Surfaces and flows",
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Compositions use the production components and current sample records. Page excerpts document the visible arrangement; the complete workflows remain in the app.",
      },
    },
  },
};

export const PageHeadingAndPanel = {
  render: () => {
    const [status, setStatus] = useState("All episodes");
    const [query, setQuery] = useState("");
    const [assessment, setAssessment] = useState("All statuses");
    const rows = peopleForList(peopleSeed.people, status, query);
    const visible = rows.filter((row) => assessment === "All statuses" || row.status === assessment);
    const episodeFilters = ["All episodes", "Profiling", "Assessment", "Ongoing review", "Closed"];
    const clear = () => { setStatus("All episodes"); setQuery(""); setAssessment("All statuses"); };
    return <div className="ds-story">
      <PageHeading title="People" subtitle="See who needs attention and where they are in their care." meta={`Today · ${formatDate(TODAY)} · Fictional sample data`}>
        <Button variant="primary"><Plus size={18} aria-hidden="true" /> New person</Button>
        <Button variant="secondary" className="people-import-button"><Upload size={18} aria-hidden="true" /> Import</Button>
      </PageHeading>
      <Panel className="people-panel queue-list-panel" title="People at Northside Centre" action={<span className="muted">{visible.length} people</span>}>
        <ListFilterBar
          id="story-people-filters"
          label="Care episode status"
          items={episodeFilters.map((value) => ({ value, label: value === "All episodes" ? "All" : value, verbatim: true, count: peopleForList(peopleSeed.people, value).length }))}
          value={status}
          onChange={setStatus}
          query={query}
          onQueryChange={setQuery}
          placeholder="Search people"
          shown={visible.length}
          total={peopleForList(peopleSeed.people, status).length}
          noun="people"
          activeAdvancedCount={Number(assessment !== "All statuses")}
          onClear={clear}
          advanced={
            <Select label="Assessment status" value={assessment} onChange={(event) => setAssessment(event.target.value)}>
              <option value="All statuses">All statuses</option>
              {[...new Set(rows.map((row) => row.status))].map((value) => <option key={value} value={value}>{value}</option>)}
            </Select>
          }
        />
        <StandardTable className="people-table" scrollClassName="people-table-scroll" label="People and assessment status">
            <thead><tr><th>Person</th><th>Next / latest assessment</th><th>Status</th><th>Required data</th><th>Care owner</th><th>Episode</th><th><span className="sr-only">Open</span></th></tr></thead>
            <tbody>{visible.slice(0, 3).map((row) => {
              const p = row.person;
              const completeness = recordCompleteness(p, TODAY).requiredPercentage;
              return <QueueRow key={p.id}>
                <QueueCell label="Person" slot="subject" className="people-identity"><div className="person-cell"><span className="people-identity-copy"><button className="name-link" type="button">{p.name}</button><span className="people-identity-meta"><small className="people-id">{p.id}</small><small>{p.dob ? `${age(p.dob)} years` : "Age unknown"}</small></span></span></div></QueueCell>
                <QueueCell label="Next / latest assessment" slot="summary" className="people-assessment"><span>{row.stage ? `Intake - ${row.stage}` : row.label}</span><small className={row.status === "Overdue" ? "people-overdue" : ""}>{row.detail}</small></QueueCell>
                <QueueCell label="Status" slot="state" className="people-status"><Badge>{row.status}</Badge></QueueCell>
                <QueueCell label="Required data" slot="metric" className="people-completeness"><div className="people-completeness-summary"><strong>{completeness}%</strong><ProgressBar className="people-completeness-bar" value={completeness} label={`${completeness}% of required data complete`} /></div></QueueCell>
                <QueueCell label="Care owner" slot="owner" className="people-owner">{row.episode?.owner || p.owner || "Unassigned"}</QueueCell>
                <QueueCell label="Episode" slot="date" className="people-episode" verbatim><span>{episodeDisplayStatus(row.episode)}</span><small>{row.episode ? `Started ${formatDate(row.episode.start)}` : "Not started"}</small></QueueCell>
                <QueueCell label="Open" slot="action" className="people-open"><ChevronRight size={18} aria-hidden="true" /></QueueCell>
              </QueueRow>;
            })}</tbody>
        </StandardTable>
      </Panel>
      <div className="ds-note">This page excerpt shows three sample rows. The app includes sorting, pagination, and record navigation.</div>
    </div>;
  },
};

export const RecordSection = {
  render: () => (
    <div className="ds-story">
      <h2>Assessment collection card</h2>
      <p>The production card from Kai Thompson’s fictional assessment history, shown in the ungrouped view.</p>
      <div className="ds-record-list assessment-list">
        {episode.collections.map((collection) => (
          <AssessmentCollectionCard
            key={collection.id}
            collection={collection}
            person={person}
            score={linkedAssessmentScore(episode, collection)}
            selectedId={currentCollection.id}
            onViewDetails={() => {}}
            onReview={() => {}}
            onCollect={() => {}}
          />
        ))}
      </div>
      <div className="ds-note">The app defaults to grouped assessment rows. This card is visible when the grouped view is turned off or a full timeline is expanded.</div>
    </div>
  ),
};

export const DialogAndForm = {
  render: () => {
    const [open, setOpen] = useState(false);
    const [saved, setSaved] = useState(false);
    return (
      <div className="ds-story">
        <h2>Dialog and form</h2>
        <Button variant="primary" onClick={() => { setOpen(true); setSaved(false); }}>Add contact</Button>
        {saved && <p className="ds-caption" role="status" style={{ marginTop: "var(--space-4)" }}>Example contact recorded in this story.</p>}
        {open && (
          <Modal title="Add direct service contact" subtitle="Record work done with the young person." onClose={() => setOpen(false)}>
            <form onSubmit={(event) => { event.preventDefault(); setOpen(false); setSaved(true); }}>
              <div className="form-body">
                <Field label="Contact date"><input type="date" required defaultValue="2026-09-26" /></Field>
                <Field label="Summary"><textarea required rows="3" placeholder="Briefly describe the contact" /></Field>
                <Notice tone="amber">Direct service contacts and indirect activity are recorded separately.</Notice>
              </div>
              <div className="modal-footer">
                <Button type="submit" variant="primary">Record contact</Button>
                <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              </div>
            </form>
          </Modal>
        )}
      </div>
    );
  },
};

export const DiscardConfirmation = {
  parameters: { docs: { description: { story: "The production unsaved-changes prompt uses the shared primary button and modal footer. Keep editing receives focus when the prompt opens." } } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const keep = canvas.getByRole("button", { name: "Keep editing" });
    await expect(keep).toHaveFocus();
    await userEvent.click(keep);
    await expect(canvas.getByRole("status")).toHaveTextContent("Editing continues");
    await userEvent.click(canvas.getByRole("button", { name: "Edit record" }));
    await userEvent.click(canvas.getByRole("button", { name: "Discard changes" }));
    await expect(canvas.getByRole("status")).toHaveTextContent("Changes discarded");
    await userEvent.click(canvas.getByRole("button", { name: "Edit record" }));
    await expect(canvas.getByRole("button", { name: "Keep editing" })).toHaveFocus();
  },
  render: () => {
    const [open, setOpen] = useState(true);
    const [decision, setDecision] = useState("");
    return <div className="ds-story ds-stack">
      <Button type="button" onClick={() => { setDecision(""); setOpen(true); }}>Edit record</Button>
      {open && <DiscardChanges onKeepEditing={() => { setOpen(false); setDecision("Editing continues"); }}
        onDiscard={() => { setOpen(false); setDecision("Changes discarded"); }} />}
      <p role="status">{decision}</p>
    </div>;
  },
};

export const EmptyAndCompletion = {
  render: () => (
    <div className="ds-story ds-grid">
      <div className="ds-example">
        <Empty title="No matching people" action={<Button variant="secondary">Clear filters</Button>}>
          Try another name or adjust your filters.
        </Empty>
      </div>
      <div className="ds-example">
        <Success title="Review recorded" action={<Button variant="primary">Return to assessment</Button>}>
          The review is now part of the connected care record.
        </Success>
      </div>
    </div>
  ),
};
