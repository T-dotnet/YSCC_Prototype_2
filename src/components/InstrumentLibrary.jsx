import { displayMeasureVersion } from '../terminology.js';
import { useRef, useState } from "react";
import { ArrowRight, Eye } from "lucide-react";
import { INSTRUMENTS, STANDARD_INSTRUMENTS } from "../instruments";
import { mvpAssessmentMode } from "../mvpAssessmentPathway";
import { useStore } from "../store";
import { ActionGroup, Button, Empty, Modal, Notice, SearchInput } from "./UI";
import InstrumentPreview from "./InstrumentPreview";

export default function InstrumentLibrary({ onClose }) {
  const { state } = useStore();
  const catalog = mvpAssessmentMode(state.settings) ? INSTRUMENTS : STANDARD_INSTRUMENTS;
  const [search, setSearch] = useState("");
  const [preview, setPreview] = useState(null);
  const [pendingFeature, setPendingFeature] = useState(null);
  const previewTrigger = useRef(null);
  const query = search.trim().toLowerCase();
  const instruments = catalog.filter((instrument) =>
    `${instrument.name} ${instrument.description} ${instrument.sections.map((section) => section.title).join(" ")}`
      .toLowerCase()
      .includes(query),
  );
  const backToLibrary = () => {
    setPreview(null);
    requestAnimationFrame(() => previewTrigger.current?.focus());
  };
  return (
    <>
    <Modal
      title={preview ? "Measure preview" : "Measure library"}
      subtitle={
        preview
          ? preview.version
          : `${catalog.length} codebook measures`
      }
      onClose={preview ? backToLibrary : onClose}
      closeLabel={preview ? "Close preview" : "Close dialog"}
      className={
        preview ? "questionnaire-preview-modal" : "instrument-library-modal"
      }
    >
      <div className="form-body instrument-library" hidden={!!preview}>
        <Notice>
          These measures capture coded fields from the headspace EP 2025
          extract. Use the approved assessment protocol for clinical collection.
        </Notice>
        <ActionGroup className="instrument-library-actions">
          <Button type="button" variant="primary" onClick={()=>setPendingFeature("Create measure")}>Create measure</Button>
          <Button type="button" variant="secondary" onClick={()=>setPendingFeature("Import measure")}>Import</Button>
        </ActionGroup>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search measures"
        />
        <p className="muted" role="status">
          {instruments.length} of {catalog.length} measures
        </p>
        <div className="instrument-list">
          {instruments.map((instrument) => (
            <article className="instrument-list-item" key={instrument.version}>
              <div>
                <h3>{instrument.name}</h3>
                <p>{instrument.description}</p>
                <small>
                  {displayMeasureVersion(instrument.version)} · Up to {instrument.questions.length}{" "}
                  questions · {instrument.sections.length} sections
                </small>
                {instrument.responseFormat && (
                  <small>{instrument.responseFormat}</small>
                )}
                <small>
                  {instrument.respondents.includes("Clinician")
                    ? "Clinician entry"
                    : "Patient response · clinician entry available"}
                </small>
              </div>
              <Button
                type="button"
                aria-label={`Preview ${instrument.name}`}
                onClick={(event) => {
                  previewTrigger.current = event.currentTarget;
                  setPreview(instrument);
                }}
              >
                <Eye size={16} aria-hidden="true" /> Preview
                <ArrowRight size={16} aria-hidden="true" />
              </Button>
            </article>
          ))}
          {!instruments.length && (
            <Empty title="No matching measures">
              Try a different name or topic.
            </Empty>
          )}
        </div>
      </div>
      {preview ? (
        <InstrumentPreview
          key={preview.version}
          instrument={preview}
          respondent="Person"
          onBack={backToLibrary}
          backLabel="Back to library"
        />
      ) : (
        <ActionGroup className="modal-footer">
          <Button type="button" onClick={onClose}>
            Done
          </Button>
        </ActionGroup>
      )}
    </Modal>
    {pendingFeature && <Modal title={pendingFeature} onClose={()=>setPendingFeature(null)}>
      <div className="form-body"><p>Feature is TBD.</p></div>
      <ActionGroup className="modal-footer"><Button onClick={()=>setPendingFeature(null)}>Done</Button></ActionGroup>
    </Modal>}
    </>
  );
}
