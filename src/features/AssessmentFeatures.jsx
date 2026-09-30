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
import { mvpAssessmentMode, mvpPathwayEnabled, mvpClinicianCreationEnabled, mvpBundleEditingEnabled } from '../mvpAssessmentPathway';

export default function AssessmentFeatures({navigate,openModal}) {
  const { state, commit } = useStore();
  const view=useQueueView();
  const [tab,setTab]=useState(() => view.params.get('tab') === 'preferences' ? 'preferences' : 'assessments');
  const tabs=[{value:'assessments',label:'Assessment features'},{value:'preferences',label:'Appearance & sample data'}];
  const settings = state.settings || {};
  const mvp = mvpAssessmentMode(settings);
  const features = [
    ["groupAssessmentsByBundle", "Group instruments into assessments", "Show instruments together in the assessment ledger. Use New assessment to choose an assessment or create one from selected instruments.", assessmentBundleGroupingEnabled(settings)],
    ["bundleAccordions", "Assessment accordions", "Expand assessment details inside the assessment ledger. When off, assessment details open in a dialog. Applies when Group instruments into assessments is on.", assessmentBundleAccordionsEnabled(settings)],
    ["showAssessmentDueDates", "Assessment due dates", "Show due dates for assessments and instruments, with Due today and Past due labels. Show one upcoming instrument per type while a response is in progress.", assessmentDueDatesEnabled(settings)],
    ["scheduleAssessments", "Schedule assessments", "Allow future assessment due dates and planned contacts. When off, assessments start immediately, planned contacts are hidden, and contacts can only be recorded.", assessmentSchedulingEnabled(settings)],
    ["linkAssessmentAppointments", "Link service contacts and assessments", "Choose related contacts during assessment and appointment work, and show their links in both records.", assessmentContactLinkingEnabled(settings)],
    ["assessmentModality", COLLECTION_METHOD_SETTING_LABEL, "Choose Clinician entry, Clinic tablet, or SMS link when starting an assessment. SMS is available only when Assessment SMS flow is on. When off, the assessment opens on the tablet path.", assessmentModalityEnabled(settings)],
  ];

  return (
    <>
      <PageHeading title="Settings" subtitle="Manage assessment features, appearance, and sample data." />
      <Tabs id="settings" label="Settings sections" items={tabs} value={tab} onChange={value=>{setTab(value);view.set('tab',value,'assessments');}} />
      <div role="tabpanel" id="settings-panel" aria-labelledby={`settings-tab-${tab === 'preferences' ? 1 : 0}`}>
      {tab === 'preferences' ? <AppearanceSampleSettings navigate={navigate} openModal={openModal} /> : <>
      <Panel title="Workspace features" className="admin-panel">
        <div className="admin-row">
          <span className="admin-icon"><SlidersHorizontal size={24} /></span>
          <div>
            <h3>General report</h3>
            <p>Show or hide the General report link in the sidebar. The page is a work in progress.</p>
          </div>
          <Switch label="Show General report in sidebar"
            checked={settings.showGeneralReport !== false}
            onChange={(event) => commit({ type: 'SET_GENERAL_REPORT_VISIBILITY', enabled: event.target.checked })} />
        </div>
      </Panel>
      <Panel title="Assessment settings" className="admin-panel">
        <div className="admin-row">
          <span className="admin-icon"><SlidersHorizontal size={24} /></span>
          <div>
            <h3>Stage 2 assessment flexibility</h3>
            <p>When off, use the fixed MVP pathway: a scheduled 90-day review with mandatory core and stream forms in separate young-person and family bundles.</p>
          </div>
          <Switch label="Stage 2 assessment flexibility" checked={!mvp}
            onChange={(event) => commit({ type: 'SET_ADVANCED_ASSESSMENT_OPTIONS', enabled: event.target.checked })} />
        </div>
        <div className="admin-row">
          <span className="admin-icon"><SlidersHorizontal size={24} /></span>
          <div><h3>Assessment SMS flow</h3><p>Offer the sample SMS link as a collection method in either assessment pathway.</p></div>
          <Switch label="Assessment SMS flow" checked={assessmentSmsEnabled(settings)}
            onChange={(event) => commit({ type: 'SET_ASSESSMENT_FEATURE', feature: 'assessmentSms', enabled: event.target.checked })} />
        </div>
        {mvp ? <>
          <div className="admin-row">
            <span className="admin-icon"><SlidersHorizontal size={24} /></span>
            <div><h3>Clinician-created assessments</h3><p>Show New assessment in the Assessment tab and user-created sample assessments.</p></div>
            <Switch label="Clinician-created assessments" checked={mvpClinicianCreationEnabled(settings)}
              onChange={event => commit({type:'SET_MVP_CLINICIAN_CREATION',enabled:event.target.checked})} />
          </div>
          <div className="admin-row">
            <span className="admin-icon"><SlidersHorizontal size={24} /></span>
            <div><h3>Edit system-generated bundles</h3><p>Allow staff to add or remove untouched instruments for one person. All included instruments remain mandatory.</p></div>
            <Switch label="Edit system-generated bundles" checked={mvpBundleEditingEnabled(settings)}
              onChange={event => commit({type:'SET_MVP_BUNDLE_EDITING',enabled:event.target.checked})} />
          </div>
          <div className="admin-row">
            <span className="admin-icon"><SlidersHorizontal size={24} /></span>
            <div>
              <h3>MVP assessment pathway</h3>
              <p>Every 90 days · core plus one stream questionnaire · all forms mandatory. Each respondent has a separate bundle and collection method. Scheduled review reminders appear in Notifications.</p>
              <p>The stream questionnaires are fictional prototype samples pending the approved battery.</p>
              <p>When off, no new pathway assessments are prepared. Existing assessments and responses stay in the ledger.</p>
            </div>
            <Switch label="MVP assessment pathway" checked={mvpPathwayEnabled(settings)}
              onChange={event => commit({type:'SET_MVP_ASSESSMENT_PATHWAY',enabled:event.target.checked})} />
          </div>
          <div className="admin-row">
            <span className="admin-icon"><SlidersHorizontal size={24} /></span>
            <div>
              <h3>Highlight scheduled 90-day review</h3>
              <p>When off, show scheduled reviews alongside user-created assessments in the assessment table.</p>
            </div>
            <Switch label="Highlight scheduled 90-day review" checked={settings.mvpReviewHighlight !== false}
              onChange={(event) => commit({ type: 'SET_MVP_REVIEW_HIGHLIGHT', enabled: event.target.checked })} />
          </div>
        </> : <>
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
        </>}
      </Panel>
      </>}
      </div>
    </>
  );
}
