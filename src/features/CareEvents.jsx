import { useEffect } from "react";
import { Plus } from "lucide-react";
import { Button } from "../components/UI";
import { ClinicalHistory } from "../components/ActivityTimeline";
import { careEventEntries } from "../activity";
import { canAssess } from "../intake";

export default function CareEvents({ episode, person, audit = [], openModal, eventId, attentionIds = [], attentionOnly = false, onClearAttention }) {
  useEffect(() => {
    if (attentionOnly && attentionIds.length > 0)
      document.getElementById("care-event-results")?.scrollIntoView({ behavior: "auto", block: "start" });
  }, [attentionOnly, attentionIds.length]);

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
        quickFilters
        episode={episode}
        person={person}
        audit={audit}
        entries={careEventEntries(person, episode, audit)}
        selectedEventId={eventId}
        attentionIds={attentionIds}
        attentionOnly={attentionOnly}
        onClearAttention={onClearAttention}
        onCorrectEvent={(selectedId) => openModal({
          type: "correct-care-event",
          episodeId: episode.id,
          eventId: selectedId,
        })}
        onRecordAppointmentOutcome={(appointmentId) => openModal({
          type: "appointment-outcome",
          personId: person.id,
          episodeId: episode.id,
          appointmentId,
        })}
        onCollectAssessmentResponse={(collectionId) => openModal({
          type: "collection",
          personId: person.id,
          episodeId: episode.id,
          collectionId,
          channel: "Clinic tablet",
          collectResponse: true,
        })}
        canCollectAssessment={canAssess(person, episode)}
      />
    </div>
  );
}
