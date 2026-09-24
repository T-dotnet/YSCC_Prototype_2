import { useEffect, useRef, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { Field, Modal, Notice, Button, ValidatedForm } from "./UI";
import {
  APPOINTMENT_ATTENDANCE,
  APPOINTMENT_DELIVERY_MODES,
  appointmentMatchesCollectionDate,
} from "../appointments";
import { formatDate, practitionerServiceOptions, TODAY } from "../model";
import { INSTRUMENTS } from "../instruments";
import ContactFields from "./ContactFields";

const formValues = (event) =>
  Object.fromEntries(new FormData(event.currentTarget));

export default function AppointmentForm({
  episode,
  people,
  person,
  error,
  canCreateAssessment,
  onClose,
  onSave,
}) {
  const [attendance, setAttendance] = useState("Planned");
  const [plannedDate, setPlannedDate] = useState("");
  const [actualDate, setActualDate] = useState("");
  const [collectionIds, setCollectionIds] = useState([]);
  const [newAssessmentVersions, setNewAssessmentVersions] = useState([]);
  const [assessmentMenuOpen, setAssessmentMenuOpen] = useState(false);
  const [assessmentSearch, setAssessmentSearch] = useState("");
  const assessmentPickerRef = useRef(null);
  const assessmentSearchRef = useRef(null);
  useEffect(() => {
    if (!assessmentMenuOpen) return;
    assessmentSearchRef.current?.focus();
    const closeOnOutsideClick = (event) => {
      if (!assessmentPickerRef.current?.contains(event.target))
        setAssessmentMenuOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, [assessmentMenuOpen]);
  const actualLatestDate =
    episode.end && episode.end < TODAY ? episode.end : TODAY;
  const practitionerServices = practitionerServiceOptions(people);
  const assessments = [...(episode.collections || [])].sort((a, b) =>
    (b.due || "").localeCompare(a.due || ""));
  const contactDates = {
    plannedDate,
    actualDate: attendance === "Attended" ? actualDate : null,
  };
  const hasContactDate = Boolean(plannedDate || contactDates.actualDate);
  const assessmentAvailability = (collection) => {
    if (["Cancelled", "Paused"].includes(collection.assignment)) return "Unavailable";
    if (collection.appointmentId || collection.submittedAppointmentId ||
        collection.attempts?.some((attempt) => attempt.appointmentId)) return "Already linked";
    if (!hasContactDate) return "Choose a contact date";
    return appointmentMatchesCollectionDate(contactDates, collection)
      ? "Matches contact date" : "Different date";
  };
  const dueAssessments = assessments.filter((collection) => collection.due);
  const searchTerm = assessmentSearch.trim().toLocaleLowerCase();
  const visibleDueAssessments = dueAssessments.filter((collection) =>
    `${collection.label} ${collection.due} ${formatDate(collection.due)}`.toLocaleLowerCase().includes(searchTerm));
  const visibleInstruments = INSTRUMENTS.filter((instrument) =>
    `${instrument.name} ${instrument.version}`.toLocaleLowerCase().includes(searchTerm));
  const selectedCount = collectionIds.length + newAssessmentVersions.length;

  return (
    <Modal
      title="Add appointment or service contact"
      subtitle={`Care episode ${episode.number} · ${formatDate(episode.start)}–${episode.end ? formatDate(episode.end) : "present"}`}
      onClose={onClose}
    >
      <ValidatedForm
        onSubmit={(event) => {
          event.preventDefault();
          onSave({ type: "ADD_APPOINTMENT", ...formValues(event), collectionIds, newAssessmentVersions });
        }}
      >
        <div className="form-body appointment-form">
          <Notice>
            Prototype operational record only. This is not an appointment-booking
            system or an approved PMHC-MDS submission record.
          </Notice>
          <div className="form-grid">
            <Field label="Contact status">
              <select
                name="attendance"
                value={attendance}
                onChange={(event) => { setAttendance(event.target.value); setCollectionIds([]); }}
              >
                {APPOINTMENT_ATTENDANCE.map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </Field>
            <Field label="Delivery mode">
              <select name="deliveryMode" required defaultValue="In person">
                {APPOINTMENT_DELIVERY_MODES.map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </Field>
            <Field label="Planned date">
              <input name="plannedDate" type="date" min={episode.start} value={plannedDate} onChange={(event) => { setPlannedDate(event.target.value); setCollectionIds([]); }} required />
            </Field>
            <Field label="Planned time">
              <input name="plannedTime" type="time" required />
            </Field>
            <Field label="Planned duration (minutes)">
              <input
                name="plannedDurationMinutes"
                type="number"
                min="1"
                max="600"
                defaultValue="60"
                required
              />
            </Field>
            <Field label="Practitioner or service">
              <select
                name="practitionerService"
                required
                defaultValue=""
              >
                <option value="" disabled>
                  Choose practitioner or service
                </option>
                {practitionerServices.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <ContactFields attended={attendance === "Attended"} person={person} />
          {attendance === "Attended" && (
            <div className="appointment-actual-fields">
              <h3>Actual contact</h3>
              <p>Record what happened, not a planned value.</p>
              <div className="form-grid">
                <Field label="Actual date">
                  <input
                    name="actualDate"
                    type="date"
                    min={episode.start}
                    max={actualLatestDate}
                    value={actualDate}
                    onChange={(event) => { setActualDate(event.target.value); setCollectionIds([]); }}
                    required
                  />
                </Field>
                <Field label="Actual time">
                  <input name="actualTime" type="time" required />
                </Field>
                <Field label="Actual duration (minutes)">
                  <input
                    name="actualDurationMinutes"
                    type="number"
                    min="1"
                    max="600"
                    required
                  />
                </Field>
              </div>
            </div>
          )}
          <div className="appointment-assessment-picker" ref={assessmentPickerRef}
            onKeyDown={(event) => {
              if (event.key === "Escape" && assessmentMenuOpen) {
                event.stopPropagation();
                setAssessmentMenuOpen(false);
              }
            }}>
            <span className="appointment-assessment-label" id="appointment-assessment-label">Associated assessments (optional)</span>
            <button type="button" className="appointment-assessment-trigger"
              aria-labelledby="appointment-assessment-label appointment-assessment-value"
              aria-expanded={assessmentMenuOpen}
              aria-controls="appointment-assessment-options"
              onClick={() => { setAssessmentMenuOpen((open) => !open); setAssessmentSearch(""); }}>
              <span id="appointment-assessment-value">{selectedCount ? `${selectedCount} assessment${selectedCount === 1 ? "" : "s"} selected` : "Choose assessments"}</span>
              <ChevronDown size={18} aria-hidden="true" />
            </button>
            {assessmentMenuOpen && <div className="appointment-assessment-dropdown" id="appointment-assessment-options">
              <div className="appointment-assessment-search">
                <Search size={17} aria-hidden="true" />
                <input ref={assessmentSearchRef} type="search" value={assessmentSearch}
                  onChange={(event) => setAssessmentSearch(event.target.value)}
                  placeholder="Search assessments" aria-label="Search assessments" />
              </div>
              <div className="appointment-assessment-list">
                <div className="appointment-assessment-group">
                  <h3>Due assessments</h3>
                  {visibleDueAssessments.length ? visibleDueAssessments.map((collection) => {
                    const availability = assessmentAvailability(collection);
                    return (
                      <label className="appointment-assessment-option" key={collection.id}>
                        <input
                          type="checkbox"
                          checked={collectionIds.includes(collection.id)}
                          disabled={availability !== "Matches contact date"}
                          onChange={(event) => setCollectionIds((current) => event.target.checked
                            ? [...current, collection.id]
                            : current.filter((id) => id !== collection.id))}
                        />
                        <span>
                          <strong>{collection.label}</strong>
                          <small>Due {formatDate(collection.due)} · {availability}</small>
                        </span>
                      </label>
                    );
                  }) : <p>{searchTerm ? "No matching due assessments." : "No assessments with a due date are in this care episode."}</p>}
                </div>
                <div className="appointment-assessment-group">
                  <h3>New assessment</h3>
                  <p>Selected assessments will be created and linked when you save this contact.</p>
                  {visibleInstruments.map((instrument) => (
                    <label className="appointment-assessment-option" key={instrument.version}>
                      <input
                        type="checkbox"
                        checked={newAssessmentVersions.includes(instrument.version)}
                        disabled={!canCreateAssessment}
                        onChange={(event) => setNewAssessmentVersions((current) => event.target.checked
                          ? [...current, instrument.version]
                          : current.filter((version) => version !== instrument.version))}
                      />
                      <span><strong>{instrument.name}</strong><small>{instrument.version}</small></span>
                    </label>
                  ))}
                  {visibleInstruments.length === 0 && <p>No matching new assessments.</p>}
                  {!canCreateAssessment && <p>Complete intake before planning a new assessment.</p>}
                </div>
              </div>
            </div>}
          </div>
          <Field label="Notes (optional)">
            <textarea
              name="notes"
              rows="3"
              placeholder="Record a factual note about the contact, cancellation or non-attendance…"
            />
          </Field>
          {error && <p className="field-error">{error}</p>}
        </div>
        <div className="modal-footer">
          <Button type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary">
            Save contact record
          </Button>
        </div>
      </ValidatedForm>
    </Modal>
  );
}
