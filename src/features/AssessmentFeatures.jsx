import { COLLECTION_METHOD_SETTING_LABEL } from "../terminology.js";
import { SlidersHorizontal } from "lucide-react";
import { useStore } from "../store";
import {
  assessmentSchedulingEnabled,
  assessmentDueDatesEnabled,
  assessmentContactLinkingEnabled,
  assessmentSmsEnabled,
  assessmentModalityEnabled,
  assessmentBundleGroupingEnabled,
} from "../assessmentFeatures";
import { PageHeading, Panel, Notice } from "../components/UI";

export default function AssessmentFeatures() {
  const { state, commit } = useStore();
  const settings = state.settings || {};
  const features = [
    ["groupAssessmentsByBundle", "Group assessments by bundle", "Use bundle accordions in the Assessment tab, with program and care-level conditions or event triggers. Show New bundle to select optional assessments and add extra assessments for a person.", assessmentBundleGroupingEnabled(settings)],
    ["showAssessmentDueDates", "Assessment due dates", "Show due dates with Due today and Past due labels in the Assessment tab. Show one upcoming assessment per type; hide the next one while a response is in progress until its due date is today or earlier. This does not enable future appointment booking.", assessmentDueDatesEnabled(settings)],
    ["scheduleAssessments", "Schedule assessments", "Allow future assessment due dates and planned contacts. When off, assessments start immediately, planned contacts are hidden, and contacts can only be recorded.", assessmentSchedulingEnabled(settings)],
    ["linkAssessmentAppointments", "Link service contacts and assessments", "Choose related contacts during assessment and appointment work, and show their links in both records.", assessmentContactLinkingEnabled(settings)],
    ["assessmentModality", COLLECTION_METHOD_SETTING_LABEL, "Choose Clinician entry, Clinic tablet, or SMS link when starting an assessment. SMS is available only when Assessment SMS flow is on. When off, the assessment opens on the tablet path.", assessmentModalityEnabled(settings)],
    ["assessmentSms", "Assessment SMS flow", "Offer the sample SMS link as a collection method.", assessmentSmsEnabled(settings)],
  ];

  return (
    <>
      <PageHeading title="Assessment features" subtitle="Choose which assessment flows are available in this workspace." />
      <Notice>
        These switches apply to both simplified and full assessment views. When a feature is off, its controls and related history are hidden. Saved records reappear when it is turned on again.
      </Notice>
      <Panel title="Assessment settings" className="admin-panel">
        <div className="admin-row">
          <span className="admin-icon"><SlidersHorizontal size={24} /></span>
          <div>
            <h3>Simple assessments</h3>
            <p>Use the compact assessment ledger and response view.</p>
          </div>
          <label className="admin-setting-toggle">
            <input type="checkbox" role="switch" aria-label="Simple assessments"
              checked={!!settings.simpleAssessments}
              onChange={(event) => commit({ type: "SET_SIMPLE_ASSESSMENTS", enabled: event.target.checked })} />
            <span>{settings.simpleAssessments ? "On" : "Off"}</span>
          </label>
        </div>
        {features.map(([feature, title, description, enabled]) => (
          <div className="admin-row" key={feature}>
            <span className="admin-icon"><SlidersHorizontal size={24} /></span>
            <div><h3>{title}</h3><p>{description}</p></div>
            <label className="admin-setting-toggle">
              <input type="checkbox" role="switch" aria-label={title} checked={enabled}
                onChange={(event) => commit({ type: "SET_ASSESSMENT_FEATURE", feature, enabled: event.target.checked })} />
              <span>{enabled ? "On" : "Off"}</span>
            </label>
          </div>
        ))}
      </Panel>

    </>
  );
}
