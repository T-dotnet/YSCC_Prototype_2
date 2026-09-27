import { createSeed } from "./model.js";

// Action tests start with an empty draft so they can assert exactly which
// answers each test session supplied. The app seed retains Kai's saved draft.
export function emptyDraftSeed() {
  const state = createSeed();
  // These action tests exercise the original scheduled, linked, SMS-capable
  // workflow; select it explicitly so product defaults can change independently.
  state.settings = {
    ...state.settings,
    scheduleAssessments: true,
    linkAssessmentAppointments: true,
    assessmentSms: true,
  };
  const collection = state.people.find((person) => person.id === "YS-1024")
    .episodes.find((episode) => episode.id === "EP-1024-01")
    .collections.find((item) => item.id === "A-0-current");
  collection.draftAnswers = [];
  collection.draftAnswerSources = {};
  return state;
}
