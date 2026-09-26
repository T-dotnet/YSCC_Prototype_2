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
import { contactsForAssessment } from "../assessmentContacts";
import ContactFields from "./ContactFields";

const formValues = (event) =>
  Object.fromEntries(new FormData(event.currentTarget));

export default function AppointmentForm({
  episode,
  people,
  person,
  recordTypes,
  onChangeEventType,
  error,
  canCreateAssessment,
  onClose,
  onSave,
}) {
  const [attendance, setAttendance] = useState("Planned");
  const [contactDate, setContactDate] = useState("");
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
    plannedDate: contactDate,
    actualDate: attendance === "Attended" ? contactDate : null,
  };
  const hasContactDate = Boolean(contactDate);
  const assessmentAvailability = (collection) => {
    if (["Cancelled", "Paused"].includes(collection.assignment)) return "Unavailable";
    if (!hasContactDate) return "Choose a contact date";
    return appointmentMatchesCollectionDate(contactDates, collection)
      ? "Matches contact date" : "Due on a different date";
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
      title="Add contact"
      subtitle={`Care episode ${episode.number} · ${formatDate(episode.start)}–${episode.end ? formatDate(episode.end) : "present"}`}
      onClose={onClose}
    >
      <ValidatedForm
        onSubmit={(event) => {
          event.preventDefault();
          const values = formValues(event);
          onSave({
            type: "ADD_APPOINTMENT",
            ...values,
            ...(attendance === "Attended" ? {
              actualDate: values.plannedDate,
              actualTime: values.plannedTime,
              actualDurationMinutes: values.plannedDurationMinutes,
            } : {}),
            collectionIds,
            newAssessmentVersions,
          });
        }}
      >
        <div className="form-body appointment-form">
          <Notice>
            Prototype operational record only. This does not book an external
            contact or submit an approved PMHC-MDS record.
          </Notice>
          <Field label="Record category">
            <select value="appointment" onChange={(event) => onChangeEventType(event.target.value)}>
              {recordTypes.map((type) => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </Field>
          <div className="form-grid">
            <Field label="Contact status">
              <select
                name="attendance"
                value={attendance}
                onChange={(event) => setAttendance(event.target.value)}
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
            <Field label="Date">
              <input name="plannedDate" type="date" min={episode.start} max={attendance === "Attended" ? actualLatestDate : undefined} value={contactDate} onChange={(event) => setContactDate(event.target.value)} required />
            </Field>
            <Field label="Time">
              <input name="plannedTime" type="time" required />
            </Field>
            <Field label="Duration">
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
                  <h3>Existing assessments</h3>
                  {visibleDueAssessments.length ? visibleDueAssessments.map((collection) => {
                    const availability = assessmentAvailability(collection);
                    const relatedCount = contactsForAssessment(episode, collection.id).length;
                    const selected = collectionIds.includes(collection.id);
                    return (
                      <label className="appointment-assessment-option" key={collection.id}>
                        <input
                          type="checkbox"
                          checked={selected}
                          disabled={availability === "Unavailable"}
                          onChange={(event) => {
                            setCollectionIds((current) => event.target.checked
                              ? [...current, collection.id]
                              : current.filter((id) => id !== collection.id));
                          }}
                        />
                        <span>
                          <strong>{collection.label}</strong>
                          <small>Due {formatDate(collection.due)} · {availability}{relatedCount ? ` · ${relatedCount} related ${relatedCount === 1 ? "contact" : "contacts"}` : ""}</small>
                        </span>
                      </label>
                    );
                  }) : <p>{searchTerm ? "No matching assessments." : "No assessments with a due date are in this care episode."}</p>}
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
