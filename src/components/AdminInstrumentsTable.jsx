import { useState } from "react";
import { Eye } from "lucide-react";
import StandardTable from "./StandardTable";
import { QueueCell, QueueRow } from "./QueueRow";
import { ActionGroup, Badge, Button, Modal, Panel } from "./UI";
import InstrumentPreview from "./InstrumentPreview";
import { INSTRUMENTS, STANDARD_INSTRUMENTS } from "../instruments";
import { measuresByInstrumentVersion } from "../administrationMeasures";
import { formatDate } from "../model";
import { mvpAssessmentMode } from "../mvpAssessmentPathway";

const recordedDate = (date) => date ? formatDate(date.slice(0, 10)) : "Not recorded";

export default function AdminInstrumentsTable({ settings }) {
  const [preview, setPreview] = useState(null);
  const availableVersions = new Set(
    (mvpAssessmentMode(settings) ? INSTRUMENTS : STANDARD_INSTRUMENTS)
      .map((instrument) => instrument.version),
  );
  const associatedMeasures = measuresByInstrumentVersion(settings);

  return (
    <>
    <div className="stack administration-instrument-list">
    <div className="section-toolbar administration-section-heading">
      <div>
        <h2>Instruments</h2>
        <p>Browse sample questions and see which measures use each instrument.</p>
      </div>
      <ActionGroup className="button-row">
        <Button type="button" variant="primary" disabled title="Adding instruments is not available yet" aria-label="Add instrument (not available yet)">
          Add instrument
        </Button>
      </ActionGroup>
    </div>
    <Panel className="admin-panel">
      <StandardTable label="Instrument catalogue">
        <thead>
          <tr>
            <th scope="col">Instrument</th>
            <th scope="col">No. of questions</th>
            <th scope="col">Create date</th>
            <th scope="col">Last modified</th>
            <th scope="col">Status</th>
            <th scope="col">Associated measures</th>
            <th scope="col">Actions</th>
          </tr>
        </thead>
        <tbody>
          {INSTRUMENTS.map((instrument) => {
            const available = availableVersions.has(instrument.version);
            const measures = associatedMeasures.get(instrument.version) || [];
            return (
              <QueueRow key={instrument.version}>
                <QueueCell label="Instrument" slot="subject">
                  <strong>{instrument.name}</strong>
                  <small>ID: {instrument.version}</small>
                </QueueCell>
                <QueueCell label="No. of questions" slot="metric">{instrument.questions.length}</QueueCell>
                <QueueCell label="Create date" slot="owner">{recordedDate(instrument.createdAt)}</QueueCell>
                <QueueCell label="Last modified" slot="date">{recordedDate(instrument.updatedAt)}</QueueCell>
                <QueueCell label="Status" slot="state">
                  <Badge tone={available ? "green" : "neutral"}>
                    {available ? "Available" : "Other pathway"}
                  </Badge>
                </QueueCell>
                <QueueCell label="Associated measures" slot="summary">
                  {measures.length ? measures.map(measure =>
                    <div key={measure.id}>{measure.name}{measure.example ? " · Mock" : ""}</div>) : "None"}
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
    </Panel>
    </div>
    {preview && <Modal title="Instrument preview" subtitle={preview.version} className="questionnaire-preview-modal" closeLabel="Close preview" onClose={() => setPreview(null)}>
      <InstrumentPreview key={preview.version} instrument={preview} respondent={preview.respondents[0]} onBack={() => setPreview(null)} />
    </Modal>}
    </>
  );
}
