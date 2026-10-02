import { useState } from 'react';
import useQueueView from '../useQueueView';
import AppearanceSampleSettings from '../components/AppearanceSampleSettings';
import { COLLECTION_METHOD_SETTING_LABEL, appTerm } from "../terminology.js";
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
import { Button, PageHeading, Panel, Switch, Tabs } from "../components/UI";
import { mvpAssessmentMode, mvpPathwayEnabled, mvpClinicianCreationEnabled, mvpBundleEditingEnabled } from '../mvpAssessmentPathway';
import { phase2MvpPresetActive } from '../featurePresets.js';

export default function AssessmentFeatures({navigate,openModal}) {
  const { state, commit } = useStore();
  const view=useQueueView();
  const [tab,setTab]=useState(() => view.params.get('tab') === 'preferences' ? 'preferences' : 'assessments');
  const tabs=[{value:'assessments',label:appTerm("measures")},{value:'preferences',label:'Appearance & sample data'}];
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
      <Panel title="Feature preset" className="admin-panel">
        <div className="admin-row">
          <span className="admin-icon"><SlidersHorizontal size={24} /></span>
          <div>
            <h3>Phase 2 MVP</h3>
            <p>Turn on Assessment SMS flow, Phase 2 care activity MVP, Keep measures and contacts separate, MVP assessment pathway, and General report. Turn off all other feature switches, including Stage 2 assessment flexibility.</p>
            {phase2MvpPresetActive(settings) && <p role="status">Preset applied</p>}
          </div>
          <Button type="button" disabled={phase2MvpPresetActive(settings)}
            onClick={() => commit({ type: 'APPLY_PHASE_2_MVP_PRESET' })}>Apply preset</Button>
        </div>
      </Panel>
      <Panel title="Workspace features" className="admin-panel">
        <div className="admin-row">
          <span className="admin-icon"><SlidersHorizontal size={24} /></span>
          <div>
            <h3>General report</h3>
            <p>Show or hide the General report link in the sidebar. The page currently shows illustrative REMIT year and comparison views.</p>
          </div>
          <Switch label="Show General report in sidebar"
            checked={settings.showGeneralReport !== false}
            onChange={(event) => commit({ type: 'SET_GENERAL_REPORT_VISIBILITY', enabled: event.target.checked })} />
        </div>
      </Panel>
      <Panel title={appTerm("measures")} className="admin-panel">
        <div className="admin-row">
          <span className="admin-icon"><SlidersHorizontal size={24} /></span>
          <div>
            <h3>Stage 2 assessment flexibility</h3>
            <p>When off, use the fixed MVP pathway: scheduled 90-day reviews with patient and clinician measures.</p>
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
          <div><h3>Phase 2 care activity MVP</h3><p>Show {appTerm("measures", "singular").toLowerCase()} activity and contacts in {appTerm("contacts")}. Hide contextual events and make Add event open the contact form.</p></div>
          <Switch label="Phase 2 care activity MVP" checked={!!settings.phase2CareActivity}
            onChange={(event) => commit({ type: "SET_PHASE2_CARE_ACTIVITY", enabled: event.target.checked })} />
        </div>
        <div className="admin-row">
          <span className="admin-icon"><SlidersHorizontal size={24} /></span>
          <div><h3>Keep measures and contacts separate</h3><p>Hide contact links in measure details and instrument links in contacts. Save responses and drafts without asking for contact links or completion details.</p></div>
          <Switch label="Keep measures and contacts separate" checked={!!settings.mvpSeparateMeasuresContacts}
            onChange={(event) => commit({ type: "SET_MVP_SEPARATE_MEASURES_CONTACTS", enabled: event.target.checked })} />
        </div>
          <div className="admin-row">
            <span className="admin-icon"><SlidersHorizontal size={24} /></span>
            <div><h3>Clinician-created assessments</h3><p>Show New assessment in the {appTerm("measures")} tab and user-created sample assessments.</p></div>
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
              <p>Every 90 days · the General and Psychosis patient bundles follow Batch 3 Data item instruments. Other streams use prototype questionnaires, and the clinician review uses a fictional staff-completed instrument. Each respondent has a separate bundle and collection method. Scheduled review reminders appear in Notifications.</p>
              <p>Batch 2 and 3 instruments capture codebook fields; they are not approved clinical questionnaire reproductions.</p>
              <p>When off, no new pathway assessments are prepared. Existing assessments and responses stay in the ledger.</p>
            </div>
            <Switch label="MVP assessment pathway" checked={mvpPathwayEnabled(settings)}
              onChange={event => commit({type:'SET_MVP_ASSESSMENT_PATHWAY',enabled:event.target.checked})} />
          </div>
          <div className="admin-row">
            <span className="admin-icon"><SlidersHorizontal size={24} /></span>
            <div><h3>Profile tab</h3><p>Show Profile as a person record tab. When off, show More info in the person header with a profile summary and an Edit action.</p></div>
            <Switch label="Show Profile tab" checked={settings.mvpProfileTab !== false}
              onChange={event => commit({ type: 'SET_MVP_PROFILE_TAB', enabled: event.target.checked })} />
          </div>
          {mvpPathwayEnabled(settings) && <div className="admin-row">
            <span className="admin-icon"><SlidersHorizontal size={24} /></span>
            <div><h3>New-profile Measures view</h3><p>Show the Collect response workspace in new MVP profiles. Turn off to show the normal Measures ledger.</p></div>
            <Switch label="Collect response view for new profiles" checked={settings.mvpNewProfileCollectWorkspace !== false}
              onChange={event => commit({ type: 'SET_MVP_NEW_PROFILE_COLLECT_WORKSPACE', enabled: event.target.checked })} />
          </div>}
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
