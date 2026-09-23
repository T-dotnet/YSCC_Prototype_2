import {
  DEMO_INSTRUMENT,
  LIKERT_INSTRUMENT,
  questionnaireState,
  setQuestionAnswer,
} from "./instruments.js";
import {
  codedAnswer,
  measureInstrument,
  sampleMeasureTotal,
} from "./measureQuestionnaires.js";

function createAnswers(instrument, overrides = {}) {
  let answers = [];
  instrument.questions.forEach((question, index) => {
    if (
      questionnaireState(instrument, answers).entries[index].status ===
      "visible"
    ) {
      const value = question.options.includes(overrides[question.id])
        ? overrides[question.id]
        : question.options[0];
      answers = setQuestionAnswer(instrument, answers, index, value);
    }
  });
  return answers;
}

// Fictional fixture generation only. Never used to complete participant answers.
export function createSampleAnswers(overrides = {}) {
  return createAnswers(DEMO_INSTRUMENT, overrides);
}

export function createQualitativeSampleAnswers(overrides = {}) {
  return createSampleAnswers(overrides);
}

export function createLikertSampleAnswers(overrides = {}) {
  return createAnswers(LIKERT_INSTRUMENT, overrides);
}

const profiles = [
  {
    participation: "In person",
    pace: "Short sections with breaks",
    support: "A little support",
    "support-kind": "Explaining the answer options",
    activities: "Managing my routine",
    connection: "Yes",
    who: "A family member",
    next: "My next steps",
  },
  {
    participation: "On my own device",
    device: "Sometimes",
    "device-help": "A device at the centre",
    pace: "Short sections with breaks",
    support: "A little support",
    "support-kind": "Reading the questions together",
    activities: "Learning or work",
    connection: "I’m not sure",
    next: "Support available to me",
  },
  {
    participation: "In person",
    support: "I’m comfortable on my own",
    activities: "Nothing for now",
    connection: "Not right now",
    next: "How taking part works",
  },
  {
    participation: "On my own device",
    device: "Yes",
    support: "A little support",
    "support-kind": "Explaining the answer options",
    activities: "Hobbies and free time",
    connection: "Not right now",
    next: "My next steps",
    takeaway: "A summary to look back at",
  },
  {
    participation: "Together with a staff member",
    pace: "Decide as I go",
    support: "I’d like someone alongside me",
    activities: "Managing my routine",
    connection: "Yes",
    who: "A staff member",
    next: "Support available to me",
  },
  {
    participation: "In person",
    pace: "Short sections with breaks",
    support: "Prefer not to answer",
    activities: "Hobbies and free time",
    connection: "I’m not sure",
    next: "How taking part works",
    ending: "Let me ask any final questions",
  },
];

export function sampleAnswersFor(
  personIndex,
  phase = "current",
  legacyAnswers,
) {
  const profile = {
    ...profiles[(personIndex + profiles.length) % profiles.length],
  };
  if (phase === "baseline")
    Object.assign(profile, {
      participation: "In person",
      support: "A little support",
      activities: "Learning or work",
      connection: "Yes",
      who: "A family member",
      next: "How taking part works",
      takeaway: "One clear next step",
    });
  if (legacyAnswers) {
    for (const [index, id] of ["participation", "support", "next"].entries()) {
      if (legacyAnswers[index]) profile[id] = legacyAnswers[index];
    }
  }
  return createSampleAnswers(profile);
}

const k10Answers = {
  baseline: [4, 3, 4, 3, 3, 3, 4, 3, 3, 3],
  review: [3, 2, 3, 2, 3, 2, 3, 3, 2, 3],
  latest: [3, 3, 3, 2, 3, 2, 3, 2, 3, 3],
};
const difficultyAnswers = (total) => {
  const prosocial = new Set([1, 4, 9, 17, 20]);
  const reversed = new Set([7, 11, 14, 21, 25]);
  let remaining = total;
  return Array.from({ length: 25 }, (_, index) => {
    if (prosocial.has(index + 1)) return 1;
    if (!remaining) return reversed.has(index + 1) ? 2 : 0;
    remaining -= 1;
    return 1;
  });
};

export const MEASURE_SAMPLE_VALUES = {
  "k10-plus": {
    baseline: k10Answers.baseline,
    review: k10Answers.review,
    latest: k10Answers.latest,
  },
  k5: {
    baseline: [2, 2, 2, 2, 3],
    review: [3, 3, 3, 2, 3],
    latest: [4, 4, 3, 3, 4],
  },
  sdq: {
    baseline: difficultyAnswers(17),
    review: difficultyAnswers(14),
    latest: difficultyAnswers(12),
  },
  sidas: {
    baseline: [2, 8, 1, 1, 2],
    review: [1, 8, 1, 1, 1],
    latest: [1, 9, 1, 1, 0],
  },
  "who-5": {
    baseline: [2, 2, 2, 2, 1],
    review: [3, 2, 2, 3, 2],
    latest: [3, 3, 3, 3, 2],
  },
};

export const measureSampleCollectionId = (key, phase) =>
  `A-7-measure-${key}-${phase}`;

export function measureSampleAnswers(key, phase) {
  const instrument = measureInstrument(key);
  const values = MEASURE_SAMPLE_VALUES[key]?.[phase];
  if (!instrument || !values) return null;
  return instrument.questions.map((question, index) =>
    codedAnswer(question.options, values[index]),
  );
}

export function measureSampleScore(key, phase) {
  return sampleMeasureTotal(
    measureInstrument(key),
    measureSampleAnswers(key, phase),
  );
}
