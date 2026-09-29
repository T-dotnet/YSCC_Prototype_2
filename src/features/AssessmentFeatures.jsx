import { useState } from 'react';
import useQueueView from '../useQueueView';
import AppearanceSampleSettings from '../components/AppearanceSampleSettings';
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
  assessmentBundleAccordionsEnabled,
} from "../assessmentFeatures";
import { PageHeading, Panel, Switch, Tabs } from "../components/UI";

export default function AssessmentFeatures({navigate,openModal}) {
  const { state, commit } = useStore();
  const view=useQueueView();
  const [tab,setTab]=useState(() => view.params.get('tab') === 'preferences' ? 'preferences' : 'assessments');
  const tabs=[{value:'assessments',label:'Assessment features'},{value:'preferences',label:'Appearance & sample data'}];
  const settings = state.settings || {};
  const features = [
    ["groupAssessmentsByBundle", "Group instruments into assessments", "Show instruments together in the assessment ledger. Use New assessment to choose an assessment or create one from selected instruments.", assessmentBundleGroupingEnabled(settings)],
    ["bundleAccordions", "Assessment accordions", "Expand assessment details inside the assessment ledger. When off, assessment details open in a dialog. Applies when Group instruments into assessments is on.", assessmentBundleAccordionsEnabled(settings)],
    ["showAssessmentDueDates", "Assessment due dates", "Show due dates for assessments and instruments, with Due today and Past due labels. Show one upcoming instrument per type while a response is in progress.", assessmentDueDatesEnabled(settings)],
    ["scheduleAssessments", "Schedule assessments", "Allow future assessment due dates and planned contacts. When off, assessments start immediately, planned contacts are hidden, and contacts can only be recorded.", assessmentSchedulingEnabled(settings)],
    ["linkAssessmentAppointments", "Link service contacts and assessments", "Choose related contacts during assessment and appointment work, and show their links in both records.", assessmentContactLinkingEnabled(settings)],
    ["assessmentModality", COLLECTION_METHOD_SETTING_LABEL, "Choose Clinician entry, Clinic tablet, or SMS link when starting an assessment. SMS is available only when Assessment SMS flow is on. When off, the assessment opens on the tablet path.", assessmentModalityEnabled(settings)],
    ["assessmentSms", "Assessment SMS flow", "Offer the sample SMS link as a collection method.", assessmentSmsEnabled(settings)],
  ];

  return (
    <>
      <PageHeading title="Settings" subtitle="Manage assessment features, appearance, and sample data." />
      <Tabs id="settings" label="Settings sections" items={tabs} value={tab} onChange={value=>{setTab(value);view.set('tab',value,'assessments');}} />
      <div role="tabpanel" id="settings-panel" aria-labelledby={`settings-tab-${tab === 'preferences' ? 1 : 0}`}>
      {tab === 'preferences' ? <AppearanceSampleSettings navigate={navigate} openModal={openModal} /> : <>
      <Panel title="Assessment settings" className="admin-panel">
        <div className="admin-row">
          <span className="admin-icon"><SlidersHorizontal size={24} /></span>
          <div>
            <h3>Simple assessments</h3>
            <p>Use the compact assessment ledger and response view.</p>
          </div>
          <Switch label="Simple assessments" checked={!!settings.simpleAssessments}
            onChange={(event) => commit({ type: "SET_SIMPLE_ASSESSMENTS", enabled: event.target.checked })} />
        </div>
        {features.map(([feature, title, description, enabled]) => (
          <div className="admin-row" key={feature}>
            <span className="admin-icon"><SlidersHorizontal size={24} /></span>
            <div><h3>{title}</h3><p>{description}</p></div>
            <Switch label={title} checked={enabled}
              onChange={(event) => commit({ type: "SET_ASSESSMENT_FEATURE", feature, enabled: event.target.checked })} />
          </div>
        ))}
      </Panel>
      </>}
      </div>
    </>
  );
}
