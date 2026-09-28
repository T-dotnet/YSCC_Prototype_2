import { useEffect } from "react";
import { SplitButton } from "../components/UI";
import { NEW_RECORD_TYPES, recordCategoryLabel } from "../components/CareTimelineEntryForm";
import { ClinicalHistory } from "../components/ActivityTimeline";
import { careEventEntries } from "../activity";
import { assessmentSchedulingEnabled } from "../assessmentFeatures";
import { canAssess } from "../intake";
import { useStore } from "../store";
import { TODAY } from "../model";

export default function CareEvents({ episode, person, audit = [], openModal, eventId, attentionIds = [], attentionOnly = false, onClearAttention }) {
  const { state } = useStore();
  useEffect(() => {
    if (attentionOnly && attentionIds.length > 0)
      document.getElementById("care-event-results")?.scrollIntoView({ behavior: "auto", block: "start" });
  }, [attentionOnly, attentionIds.length]);

  return (
    <div className="stack care-events">
      <div className="section-toolbar">
        <div>
          <h2>Care events</h2>
          <p>Contacts, assessments, contextual events and structured care records from this care period.</p>
        </div>
        <SplitButton
          label="Add event"
          menuLabel="Event categories"
          onClick={() => openModal({ type: "care-timeline-entry", episodeId: episode.id })}
          items={NEW_RECORD_TYPES.map(type => ({
            label: state.settings?.simpleAssessments && type === "outcome" ? "Score collection" : recordCategoryLabel(type),
            onClick: () => openModal({
              type: type === "appointment" ? "appointment" : "care-timeline-entry",
              personId: person.id,
              episodeId: episode.id,
              ...(type !== "appointment" ? { initialType: type } : {}),
            }),
          }))}
        />
      </div>
      <ClinicalHistory
        quickFilters
        episode={episode}
        person={person}
        audit={audit}
        entries={careEventEntries(person, episode, audit, { simpleAssessments: !!state.settings?.simpleAssessments, scheduleAssessments: assessmentSchedulingEnabled(state.settings), today: TODAY })}
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
