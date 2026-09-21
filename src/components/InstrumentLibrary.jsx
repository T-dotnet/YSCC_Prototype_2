import { useRef, useState } from "react";
import { ArrowRight, Eye } from "lucide-react";
import { INSTRUMENTS } from "../instruments";
import { Button, Empty, Modal, Notice, SearchInput } from "./UI";
import InstrumentPreview from "./InstrumentPreview";

export default function InstrumentLibrary({ onClose }) {
  const [search, setSearch] = useState("");
  const [preview, setPreview] = useState(null);
  const previewTrigger = useRef(null);
  const query = search.trim().toLowerCase();
  const instruments = INSTRUMENTS.filter((instrument) =>
    `${instrument.name} ${instrument.description} ${instrument.sections.map((section) => section.title).join(" ")}`
      .toLowerCase()
      .includes(query),
  );
  const backToLibrary = () => {
    setPreview(null);
    requestAnimationFrame(() => previewTrigger.current?.focus());
  };
  return (
    <Modal
      title={preview ? "Questionnaire preview" : "Instrument library"}
      subtitle={
        preview
          ? preview.version
          : `${INSTRUMENTS.length} sample questionnaires`
      }
      onClose={preview ? backToLibrary : onClose}
      closeLabel={preview ? "Close preview" : "Close dialog"}
      className={
        preview ? "questionnaire-preview-modal" : "instrument-library-modal"
      }
    >
      <div className="form-body instrument-library" hidden={!!preview}>
        <Notice>
          Original sample questionnaires for exploring the workspace. These are
          not validated clinical measures and do not calculate scores.
        </Notice>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search questionnaires"
        />
        <p className="muted" role="status">
          {instruments.length} of {INSTRUMENTS.length} questionnaires
        </p>
        <div className="instrument-list">
          {instruments.map((instrument) => (
            <article className="instrument-list-item" key={instrument.version}>
              <div>
                <h3>{instrument.name}</h3>
                <p>{instrument.description}</p>
                <small>
                  {instrument.version} · Up to {instrument.questions.length}{" "}
                  questions · {instrument.sections.length} sections
                </small>
                {instrument.responseFormat && (
                  <small>{instrument.responseFormat}</small>
                )}
                <small>
                  {instrument.respondents.includes("Family respondent")
                    ? "Person or family contribution"
                    : "Person’s own perspective · assistance available"}
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
            <Empty title="No matching questionnaires">
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
        <div className="modal-footer">
          <Button type="button" onClick={onClose}>
            Done
          </Button>
        </div>
      )}
    </Modal>
  );
}
