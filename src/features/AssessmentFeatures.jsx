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
import { mvpPresetActive } from '../featurePresets.js';

export default function AssessmentFeatures({navigate,openModal}) {
  const { state, commit } = useStore();
  const view=useQueueView();
  const [tab,setTab]=useState(() => view.params.get('tab') === 'preferences' ? 'preferences' : 'assessments');
  const tabs=[{value:'assessments',label:'Assessment Pack'},{value:'preferences',label:'Appearance & sample data'}];
  const settings = state.settings || {};
  const mvp = mvpAssessmentMode(settings);
  const features = [
    ["groupAssessmentsByBundle", "Group measures into Collection Occasions", "Show measures together by Collection Occasion. Use New Collection Occasion to choose an Assessment Pack or create one from selected measures.", assessmentBundleGroupingEnabled(settings)],
    ["bundleAccordions", "Assessment accordions", "Expand assessment details inside the assessment ledger. When off, assessment details open in a dialog. Applies when Group measures into assessments is on.", assessmentBundleAccordionsEnabled(settings)],
    ["showAssessmentDueDates", "Assessment due dates", "Show due dates for assessments and measures, with Due today and Past due labels. Show one upcoming measure per type while a response is in progress.", assessmentDueDatesEnabled(settings)],
    ["scheduleAssessments", "Schedule assessments", "Allow future assessment due dates and planned contacts. When off, assessments start immediately, planned contacts are hidden, and contacts can only be recorded.", assessmentSchedulingEnabled(settings)],
    ["linkAssessmentAppointments", "Link service contacts and assessments", "Choose related contacts during assessment and appointment work, and show their links in both records.", assessmentContactLinkingEnabled(settings)],
    ["assessmentModality", COLLECTION_METHOD_SETTING_LABEL, "Choose Clinician entry, Clinic tablet, or SMS link when starting a Collection Occasion. SMS is available only when SMS link collection is on. When off, collection opens on the tablet path.", assessmentModalityEnabled(settings)],
  ];

  return (
    <>
      <PageHeading title="Settings" subtitle="Manage assessment features, appearance, and sample data." />
      <Tabs id="settings" label="Settings sections" items={tabs} value={tab} onChange={value=>{setTab(value);view.set('tab',value,'assessments');}} />
      <div role="tabpanel" id="settings-panel" aria-labelledby={`settings-tab-${tab === 'preferences' ? 1 : 0}`}>
      {tab === 'preferences' ? <AppearanceSampleSettings navigate={navigate} openModal={openModal} /> : <>
      <Panel title="Assessment pathway" className="admin-panel">
        <div className="admin-row">
          <span className="admin-icon"><SlidersHorizontal size={24} /></span>
          <div>
            <h3>Stage 2 assessment flexibility</h3>
            <p>When off, use the fixed MVP pathway: scheduled 90-day reviews with patient and clinician measures.</p>
          </div>
          <Switch label="Stage 2 assessment flexibility" checked={!mvp}
            onChange={(event) => commit({ type: 'SET_ADVANCED_ASSESSMENT_OPTIONS', enabled: event.target.checked })} />
        </div>
      </Panel>
      <Panel title="Feature preset" className="admin-panel">
        <div className="admin-row">
          <span className="admin-icon"><SlidersHorizontal size={24} /></span>
          <div>
            <h3>MVP preset</h3>
            <p>Turn on General report, SMS link collection, Show measure activity in Contacts, MVP schedule presets, Care point heading, Place Record outcome below the table, Separate measures and contacts, Create initial and 90-day assessments, and Record assessment outcome. Turn off the other feature switches, including Stage 2 assessment flexibility.</p>
            {mvpPresetActive(settings) && <p role="status">Preset applied</p>}
          </div>
          <Button type="button" disabled={mvpPresetActive(settings)}
            onClick={() => commit({ type: 'APPLY_MVP_PRESET' })}>Apply preset</Button>
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
      <Panel title="Assessment Pack" className="admin-panel">
        {mvp ? <>
        <div className="admin-row">
          <span className="admin-icon"><SlidersHorizontal size={24} /></span>
          <div><h3>Show measure activity in Contacts</h3><p>Show {appTerm("measures", "singular").toLowerCase()} activity alongside contacts. Hide contextual events; Add event opens the contact form.</p></div>
          <Switch label="Show measure activity in Contacts" checked={!!settings.phase2CareActivity}
            onChange={(event) => commit({ type: "SET_PHASE2_CARE_ACTIVITY", enabled: event.target.checked })} />
        </div>
        <div className="admin-row">
          <span className="admin-icon"><SlidersHorizontal size={24} /></span>
          <div><h3>Separate measures and contacts</h3><p>Hide links between measures and contacts. Staff can save responses and drafts without linking a contact or adding completion details.</p></div>
          <Switch label="Separate measures and contacts" checked={!!settings.mvpSeparateMeasuresContacts}
            onChange={(event) => commit({ type: "SET_MVP_SEPARATE_MEASURES_CONTACTS", enabled: event.target.checked })} />
        </div>
          <div className="admin-row">
            <span className="admin-icon"><SlidersHorizontal size={24} /></span>
            <div>
              <h3>Create initial and 90-day assessments</h3>
              <p>Prepare an initial assessment and scheduled 90-day reviews for each program stream. Review reminders appear in Notifications.</p>
              <p>Psychosis reviews use codebook data item measures. Other streams use fictional staff-completed reviews until approved measures are available. These measures are codebook fields, not approved clinical questionnaires.</p>
              <p>When off, no new pathway assessments are prepared. Existing assessments and responses remain available.</p>
            </div>
            <Switch label="Create initial and 90-day assessments" checked={mvpPathwayEnabled(settings)}
              onChange={event => commit({type:'SET_MVP_ASSESSMENT_PATHWAY',enabled:event.target.checked})} />
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
      {mvp && settings.phase2CareActivity && <Panel title="MVP schedule presets" className="admin-panel">
        <div className="admin-row">
          <span className="admin-icon"><SlidersHorizontal size={24} /></span>
          <div><h3>MVP schedule presets</h3><p>Replace detailed schedules with care point presets for new profiles, assessments, 90-day reviews, discharge, and existing referral or status events. Only 90-day reviews repeat.</p></div>
          <Switch label="MVP schedule presets" checked={settings.mvpSchedulePresets !== false}
            onChange={event => commit({ type: 'SET_MVP_SCHEDULE_PRESETS', enabled: event.target.checked })} />
        </div>
      </Panel>}
      {mvp && <Panel title="Assessment display and outcomes" className="admin-panel">
        {settings.phase2CareActivity && <div className="admin-row">
          <span className="admin-icon"><SlidersHorizontal size={24} /></span>
          <div><h3>Care point heading</h3><p>Show the selected care point name, such as Initial assessment, as the heading in the person Assessment tab.</p></div>
          <Switch label="Care point heading" checked={settings.mvpCarePointHeading === true}
            onChange={event => commit({ type: 'SET_MVP_CARE_POINT_HEADING', enabled: event.target.checked })} />
        </div>}
        {settings.phase2CareActivity && settings.mvpCarePointHeading === true && <div className="admin-row admin-row-subsetting">
          <span className="admin-icon"><SlidersHorizontal size={24} /></span>
          <div><h3>Place Record outcome below the table</h3><p>Show the Record outcome action below the active Assessment table. When off, show it beside the care point heading.</p></div>
          <Switch label="Place Record outcome below the table" checked={settings.mvpOutcomeBelowTable !== false}
            onChange={event => commit({ type: 'SET_MVP_OUTCOME_BELOW_TABLE', enabled: event.target.checked })} />
        </div>}
        {mvpPathwayEnabled(settings) && <div className="admin-row">
          <span className="admin-icon"><SlidersHorizontal size={24} /></span>
          <div><h3>Record assessment outcome</h3><p>Show Record outcome beside the response action at every stage of an initial assessment configured to change status to Ongoing review. An assessment outcome is required before that status change.</p></div>
          <Switch label="Record assessment outcome" checked={settings.mvpRecordAssessmentOutcome !== false}
            onChange={event => commit({type:'SET_MVP_RECORD_ASSESSMENT_OUTCOME',enabled:event.target.checked})} />
        </div>}
      </Panel>}
      <Panel title="Other features" className="admin-panel">
        <div className="admin-row">
          <span className="admin-icon"><SlidersHorizontal size={24} /></span>
          <div><h3>SMS link collection</h3><p>Let staff choose an SMS link when collecting measure responses. When off, existing SMS measures wait until this is turned back on.</p></div>
          <Switch label="SMS link collection" checked={assessmentSmsEnabled(settings)}
            onChange={(event) => commit({ type: 'SET_ASSESSMENT_FEATURE', feature: 'assessmentSms', enabled: event.target.checked })} />
        </div>
        {mvp && <div className="admin-row">
          <span className="admin-icon"><SlidersHorizontal size={24} /></span>
          <div><h3>Tags on person records</h3><p>Show each person's tags and the Add tag action beside their name.</p></div>
          <Switch label="Tags on person records" checked={settings.mvpShowPersonTags === true}
            onChange={event => commit({ type: 'SET_MVP_SHOW_PERSON_TAGS', enabled: event.target.checked })} />
        </div>}
      </Panel>
      {mvp && <Panel title="Collection and person record options" className="admin-panel">
        <div className="admin-row">
          <span className="admin-icon"><SlidersHorizontal size={24} /></span>
          <div><h3>Clinician-created Collection Occasions</h3><p>Show New Collection Occasion in the Assessment Pack tab and user-created sample collections.</p></div>
          <Switch label="Clinician-created assessments" checked={mvpClinicianCreationEnabled(settings)}
            onChange={event => commit({type:'SET_MVP_CLINICIAN_CREATION',enabled:event.target.checked})} />
        </div>
        <div className="admin-row">
          <span className="admin-icon"><SlidersHorizontal size={24} /></span>
          <div><h3>Edit system-generated bundles</h3><p>Allow staff to add or remove untouched measures for one person. All included measures remain mandatory.</p></div>
          <Switch label="Edit system-generated bundles" checked={mvpBundleEditingEnabled(settings)}
            onChange={event => commit({type:'SET_MVP_BUNDLE_EDITING',enabled:event.target.checked})} />
        </div>
        <div className="admin-row">
          <span className="admin-icon"><SlidersHorizontal size={24} /></span>
          <div><h3>Profile tab</h3><p>Show Profile as a person record tab. When off, show More info in the person header with a profile summary and an Edit action.</p></div>
          <Switch label="Show Profile tab" checked={settings.mvpProfileTab !== false}
            onChange={event => commit({ type: 'SET_MVP_PROFILE_TAB', enabled: event.target.checked })} />
        </div>
        {mvpPathwayEnabled(settings) && <div className="admin-row">
          <span className="admin-icon"><SlidersHorizontal size={24} /></span>
          <div><h3>New-profile Assessment Pack view</h3><p>Show the Collect response workspace in new MVP profiles. Turn off to show the normal Assessment Pack ledger.</p></div>
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
      </Panel>}
      </>}
      </div>
    </>
  );
}
