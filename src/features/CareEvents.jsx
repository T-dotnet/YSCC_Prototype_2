import { Plus } from "lucide-react";
import { Button } from "../components/UI";
import { ClinicalHistory } from "../components/ActivityTimeline";
import { careEventEntries } from "../activity";

export default function CareEvents({ episode, person, audit = [], openModal, eventId }) {
  return (
    <div className="stack care-events">
      <div className="section-toolbar">
        <div>
          <h2>Care events</h2>
          <p>Appointments, assessments, contextual events and structured care records from this care period.</p>
        </div>
        <Button variant="primary" onClick={() => openModal({ type: "care-timeline-entry", episodeId: episode.id })}>
          <Plus size={17} aria-hidden="true" /> Add event
        </Button>
      </div>
      <ClinicalHistory
        episode={episode}
        person={person}
        audit={audit}
        entries={careEventEntries(person, episode, audit)}
        selectedEventId={eventId}
        onCorrectEvent={(selectedId) => openModal({
          type: "correct-care-event",
          episodeId: episode.id,
          eventId: selectedId,
        })}
      />
    </div>
  );
}
