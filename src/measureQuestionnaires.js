// Demonstration item capture for the fictional report. These prompts are
// descriptive stand-ins, not approved copies of the governed instruments.
// A real collection must use the approved version, wording and permissions.
const frequency = [
  "1 · None of the time",
  "2 · A little of the time",
  "3 · Some of the time",
  "4 · Most of the time",
  "5 · All of the time",
];
const wellbeing = [
  "0 · At no time",
  "1 · Some of the time",
  "2 · Less than half the time",
  "3 · More than half the time",
  "4 · Most of the time",
  "5 · All of the time",
];
const difficulties = ["0 · Not true", "1 · Somewhat true", "2 · Certainly true"];
const tenPoint = Array.from({ length: 11 }, (_, value) => String(value));

const item = (section, id, title, options, hint) => ({
  section,
  id,
  title,
  options,
  hint,
  responseType: "coded-measure-item",
});
const measure = (key, name, version, timeframe, sections, questions) => ({
  measureKey: key,
  name,
  version,
  description: `${name} sample item capture. Coded responses support the fictional report; use an approved instrument for real collection.`,
  introduction: `This is a fictional ${name} item-capture demonstration. It is not a clinical assessment.`,
  timeframe,
  respondents: ["Person"],
  sections,
  questions,
});

const k10Topics = [
  "Tired without a clear reason",
  "Nervous",
  "Unable to calm nervousness",
  "Hopeless",
  "Restless or fidgety",
  "Unable to sit still from restlessness",
  "Low in mood",
  "Everything felt like an effort",
  "Unable to feel cheered up",
  "Worthless",
];
const k5Topics = [
  "Nervous",
  "Without hope",
  "Restless or fidgety",
  "Everything felt like an effort",
  "Low in mood",
];
const sdqTopics = [
  "Considerate of other people",
  "Restless or overactive",
  "Physical complaints such as headaches or stomach aches",
  "Willing to share",
  "Temper or frustration",
  "Prefers time alone",
  "Generally follows requests",
  "Often worries",
  "Helpful when someone is upset",
  "Fidgety or easily distracted",
  "Has at least one close friend",
  "Arguments or fights",
  "Often unhappy or tearful",
  "Generally liked by peers",
  "Difficulty concentrating",
  "Uneasy in new situations",
  "Kind to younger children",
  "Dishonesty or cheating",
  "Picked on by others",
  "Offers to help others",
  "Thinks before acting",
  "Takes things without permission",
  "Relates more easily to adults than peers",
  "Many fears or easily scared",
  "Can keep attention on a task",
];
const genericItems = (prefix, section, topics, options, hint) =>
  topics.map((topic, index) =>
    item(section, `${prefix}-${index + 1}`, `${index + 1}. ${topic}`, options, hint),
  );

export const MEASURE_INSTRUMENTS = [
  measure(
    "k10-plus",
    "Kessler 10+ (K10+)",
    "K10+ sample item capture v1.0",
    "Past four weeks",
    [{ id: "k10", title: "K10 core items" }],
    genericItems("k10", "k10", k10Topics, frequency, "Select the coded frequency for this fictional item. The K10+ supplementary items are outside this score demonstration."),
  ),
  measure(
    "k5",
    "Kessler 5 (K5)",
    "K5 sample item capture v1.0",
    "Past four weeks",
    [{ id: "k5", title: "K5 items" }],
    genericItems("k5", "k5", k5Topics, frequency, "Select the coded frequency for this fictional item."),
  ),
  measure(
    "sdq",
    "Strengths and Difficulties Questionnaire (SDQ)",
    "SDQ coded item sample v1.0",
    "Approved version and respondent must be confirmed",
    [{ id: "sdq", title: "SDQ coded items" }],
    sdqTopics.map((topic, index) =>
      item("sdq", `sdq-${index + 1}`, `${index + 1}. ${topic}`, difficulties, "Sample topic only. Use the approved SDQ wording and respondent version for real collection."),
    ),
  ),
  measure(
    "sidas",
    "Suicidal Ideation Attributes Scale (SIDAS)",
    "SIDAS coded item sample v1.0",
    "Past month",
    [{ id: "sidas", title: "SIDAS coded items" }],
    genericItems("sidas", "sidas", ["Frequency", "Controllability", "Closeness to action", "Distress", "Interference"], tenPoint, "Staff demonstration only. Use the approved measure and safety workflow for real collection.").map((question, index) =>
      index === 0
        ? question
        : { ...question, when: { questionId: "sidas-1", oneOf: tenPoint.slice(1) } },
    ),
  ),
  measure(
    "who-5",
    "WHO-5 Well-Being Index",
    "WHO-5 sample item capture v1.0",
    "Past two weeks",
    [{ id: "who-5", title: "Well-being items" }],
    genericItems("who-5", "who-5", ["Cheerful and in good spirits", "Calm and relaxed", "Active and vigorous", "Rested on waking", "Daily life felt interesting"], wellbeing, "Select the coded frequency for this fictional item."),
  ),
];

export const measureInstrument = (key) =>
  MEASURE_INSTRUMENTS.find((instrument) => instrument.measureKey === key) || null;

export const codedAnswer = (options, value) =>
  options.find((option) => Number.parseInt(option, 10) === value) || null;

const codedValues = (instrument, answers) => {
  if (!instrument || answers?.length !== instrument.questions.length) return null;
  if (instrument.measureKey === "sidas" && answers[0] === "0" &&
      answers.slice(1).every((answer) => answer == null || answer === ""))
    return [0, 0, 0, 0, 0];
  const values = instrument.questions.map((question, index) => {
    const answer = answers[index];
    if (!question.options.includes(answer)) return null;
    return Number.parseInt(answer, 10);
  });
  return values.every(Number.isInteger) ? values : null;
};

// Only raw demonstration arithmetic is calculated. No severity category or
// clinically significant change is inferred from these values.
export function sampleMeasureTotal(instrument, answers) {
  const values = codedValues(instrument, answers);
  if (!values) return null;
  switch (instrument.measureKey) {
    case "k10-plus":
    case "k5":
      return values.reduce((sum, value) => sum + value, 0);
    case "who-5":
      return values.reduce((sum, value) => sum + value, 0) * 4;
    case "sidas":
      return values[0] === 0
        ? 0
        : values[0] + (10 - values[1]) + values[2] + values[3] + values[4];
    case "sdq": {
      // Total difficulties excludes prosocial items and reverses the five
      // items specified in the PMHC-MDS scoring reference.
      const prosocial = new Set([1, 4, 9, 17, 20]);
      const reversed = new Set([7, 11, 14, 21, 25]);
      return values.reduce((sum, value, index) =>
        sum + (prosocial.has(index + 1) ? 0 : reversed.has(index + 1) ? 2 - value : value), 0);
    }
    default:
      return null;
  }
}
