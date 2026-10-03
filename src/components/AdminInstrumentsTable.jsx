import { displayMeasureVersion } from '../terminology.js';
import { useState } from "react";
import { Eye } from "lucide-react";
import StandardTable from "./StandardTable";
import ListFilterBar from "./ListFilterBar";
import { QueueCell, QueueRow } from "./QueueRow";
import { ActionGroup, Badge, Button, Empty, Modal, Panel, Select } from "./UI";
import InstrumentPreview from "./InstrumentPreview";
import { INSTRUMENTS, STANDARD_INSTRUMENTS } from "../instruments";
import { measuresByInstrumentVersion } from "../administrationMeasures";
import { formatDate } from "../model";
import { mvpAssessmentMode } from "../mvpAssessmentPathway";

const recordedDate = (date) => date ? formatDate(date.slice(0, 10)) : "Not recorded";

export default function AdminInstrumentsTable({ settings }) {
  const [preview, setPreview] = useState(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All");
  const [packId, setPackId] = useState("");
  const availableVersions = new Set(
    (mvpAssessmentMode(settings) ? INSTRUMENTS : STANDARD_INSTRUMENTS)
      .map((instrument) => instrument.version),
  );
  const associatedPacks = measuresByInstrumentVersion(settings);
  const packs = [...new Map([...associatedPacks.values()].flat().map(pack => [pack.id, pack])).values()]
    .sort((a, b) => a.name.localeCompare(b.name));
  const clearFilters = () => { setQuery(""); setStatus("All"); setPackId(""); };
  const visibleInstruments = INSTRUMENTS.filter(instrument => {
    const available = availableVersions.has(instrument.version);
    const measurePacks = associatedPacks.get(instrument.version) || [];
    const matchesSearch = `${instrument.name} ${displayMeasureVersion(instrument.version)} ${measurePacks.map(pack => pack.name).join(" ")}`
      .toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
    return matchesSearch && (status === "All" || (status === "Available") === available)
      && (!packId || (packId === "none" ? !measurePacks.length : measurePacks.some(pack => pack.id === packId)));
  });

  return (
    <>
    <div className="stack administration-instrument-list">
    <div className="section-toolbar administration-section-heading">
      <div>
        <h2>Measures</h2>
        <p>Browse measures, preview their questions, and see which Assessment Packs include them.</p>
      </div>
      <ActionGroup className="button-row">
        <Button type="button" variant="primary" disabled title="Adding measures is not available yet" aria-label="Add measure (not available yet)">
          Add measure
        </Button>
      </ActionGroup>
    </div>
    <Panel className="admin-panel">
      <ListFilterBar id="admin-measure-filters" label="Measure status" className="administration-filter-bar"
        items={["All", "Available", "Other pathway"].map(value => ({
          value, label: value, count: value === "All" ? INSTRUMENTS.length : INSTRUMENTS.filter(instrument =>
            (availableVersions.has(instrument.version) ? "Available" : "Other pathway") === value).length,
        }))}
        value={status} onChange={setStatus} query={query} onQueryChange={setQuery}
        placeholder="Search measures, IDs or Assessment Packs"
        shown={visibleInstruments.length} total={INSTRUMENTS.length} noun="measures"
        activeAdvancedCount={Number(Boolean(packId))} onClear={clearFilters}
        activeFilters={[
          ...(query ? [{ id: "search", label: `Search: ${query}`, onRemove: () => setQuery("") }] : []),
          ...(status !== "All" ? [{ id: "status", label: `Status: ${status}`, onRemove: () => setStatus("All") }] : []),
          ...(packId ? [{ id: "pack", label: `Assessment Pack: ${packId === "none" ? "None" : packs.find(pack => pack.id === packId)?.name || packId}`, onRemove: () => setPackId("") }] : []),
        ]}
        advanced={<Select label="Assessment Pack" value={packId} onChange={event => setPackId(event.target.value)}>
          <option value="">All Assessment Packs</option>
          {packs.map(pack => <option key={pack.id} value={pack.id}>{pack.name}</option>)}
          <option value="none">No Assessment Pack</option>
        </Select>} />
      {visibleInstruments.length ? (
      <StandardTable label="Measure catalogue">
        <thead>
          <tr>
            <th scope="col">Measure</th>
            <th scope="col">No. of questions</th>
            <th scope="col">Create date</th>
            <th scope="col">Last modified</th>
            <th scope="col">Status</th>
            <th scope="col">Assessment Packs</th>
            <th scope="col">Actions</th>
          </tr>
        </thead>
        <tbody>
          {visibleInstruments.map((instrument) => {
            const available = availableVersions.has(instrument.version);
            const packs = associatedPacks.get(instrument.version) || [];
            return (
              <QueueRow key={instrument.version}>
                <QueueCell label="Measure" slot="subject">
                  <strong>{instrument.name}</strong>
                  <small>ID: {displayMeasureVersion(instrument.version)}</small>
                </QueueCell>
                <QueueCell label="No. of questions" slot="metric">{instrument.questions.length}</QueueCell>
                <QueueCell label="Create date" slot="owner">{recordedDate(instrument.createdAt)}</QueueCell>
                <QueueCell label="Last modified" slot="date">{recordedDate(instrument.updatedAt)}</QueueCell>
                <QueueCell label="Status" slot="state">
                  <Badge tone={available ? "green" : "neutral"}>
                    {available ? "Available" : "Other pathway"}
                  </Badge>
                </QueueCell>
                <QueueCell label="Assessment Packs" slot="summary">
                  {packs.length ? packs.map(pack =>
                    <div key={pack.id}>{pack.name}</div>) : "None"}
                </QueueCell>
                <QueueCell label="Actions" slot="action">
                  <ActionGroup>
                    <Button type="button" aria-label={`Preview ${instrument.name}`} onClick={() => setPreview(instrument)}>
                      <Eye size={16} aria-hidden="true" /> Preview
                    </Button>
                    <Button type="button" variant="secondary" disabled title="Editing is not available yet" aria-label={`Edit ${instrument.name} (not available yet)`}>
                      Edit
                    </Button>
                  </ActionGroup>
                </QueueCell>
              </QueueRow>
            );
          })}
        </tbody>
      </StandardTable>
      ) : <Empty title="No measures match these filters" action={<Button variant="secondary" onClick={clearFilters}>Clear filters</Button>}>
        Try another search or filter.
      </Empty>}
    </Panel>
    </div>
    {preview && <Modal title="Measure preview" subtitle={displayMeasureVersion(preview.version)} className="questionnaire-preview-modal" closeLabel="Close preview" onClose={() => setPreview(null)}>
      <InstrumentPreview key={preview.version} instrument={preview} respondent={preview.respondents[0]} onBack={() => setPreview(null)} />
    </Modal>}
    </>
  );
}
