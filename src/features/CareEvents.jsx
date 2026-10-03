import { useEffect } from "react";
import { Button, SplitButton } from "../components/UI";
import SectionActionHeader from "../components/SectionActionHeader";
import { NEW_RECORD_TYPES, recordCategoryLabel } from "../components/CareTimelineEntryForm";
import { ClinicalHistory } from "../components/ActivityTimeline";
import { careEventEntries } from "../activity";
import { assessmentSchedulingEnabled } from "../assessmentFeatures";
import { canAssess } from "../intake";
import { useStore } from "../store";
import { TODAY } from "../model";
import { appTerm } from "../terminology.js";

export default function CareEvents({ episode, person, audit = [], openModal, onCollectAssessmentResponse, eventId, attentionIds = [], attentionOnly = false, onClearAttention }) {
  const { state } = useStore();
  const phase2Mvp = !!state.settings?.phase2CareActivity;
  useEffect(() => {
    if (attentionOnly && attentionIds.length > 0)
      document.getElementById("care-event-results")?.scrollIntoView({ behavior: "auto", block: "start" });
  }, [attentionOnly, attentionIds.length]);

  return (
    <div className="stack care-events">
      <SectionActionHeader
        title={appTerm("contacts")}
        description={phase2Mvp
          ? `${appTerm("measures", "singular")} activity and ${appTerm("contacts").toLowerCase()} from this care period.`
          : `${appTerm("contacts")}, ${appTerm("measures").toLowerCase()}, contextual events and structured care records from this care period.`}
        action={phase2Mvp ? <Button type="button" variant="primary" onClick={() => openModal({ type: "appointment", episodeId: episode.id })}>Add contact</Button> : <SplitButton
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
        />}
      />
      <ClinicalHistory
        quickFilters
        episode={episode}
        person={person}
        audit={audit}
        entries={careEventEntries(person, episode, audit, { simpleAssessments: !!state.settings?.simpleAssessments, scheduleAssessments: assessmentSchedulingEnabled(state.settings), phase2Mvp, today: TODAY })}
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
        onCollectAssessmentResponse={(collectionId) => onCollectAssessmentResponse?.(episode.collections.find(collection => collection.id === collectionId))}
        canCollectAssessment={canAssess(person, episode)}
      />
    </div>
  );
}
