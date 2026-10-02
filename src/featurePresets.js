// Settings shown in the Measures and Workspace features sections. Keep the
// inactive pathway's switches explicit so returning to it does not revive old choices.
export const PHASE_2_MVP_PRESET = Object.freeze({
  showGeneralReport: true,
  advancedAssessmentOptions: false,
  assessmentSms: true,
  phase2CareActivity: true,
  mvpSeparateMeasuresContacts: true,
  mvpAssessmentPathway: true,
  mvpClinicianCreation: false,
  mvpBundleEditing: false,
  mvpProfileTab: false,
  mvpNewProfileCollectWorkspace: false,
  mvpReviewHighlight: false,
  simpleAssessments: false,
  scheduleAssessments: false,
  showAssessmentDueDates: false,
  linkAssessmentAppointments: false,
  assessmentModality: false,
  groupAssessmentsByBundle: false,
  bundleAccordions: false,
  automaticAssessmentDueDates: false,
});

export const phase2MvpPresetActive = settings =>
  Object.entries(PHASE_2_MVP_PRESET).every(([key, value]) => settings?.[key] === value);
