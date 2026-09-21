import test from "node:test";
import assert from "node:assert/strict";
import {
  DEMO_INSTRUMENT as instrument,
  LIKERT_INSTRUMENT,
  LEGACY_INSTRUMENT,
  INSTRUMENTS,
  getInstrument,
  questionnaireState,
  setQuestionAnswer,
} from "./instruments.js";
import { createSeed, reducer, responseEditError } from "./model.js";
import { compareResponses } from "./progress.js";
const index = (id) =>
  instrument.questions.findIndex((question) => question.id === id);
const answer = (answers, id, value) =>
  setQuestionAnswer(instrument, answers, index(id), value);
function completed(overrides = {}) {
  let answers = [];
  for (const question of instrument.questions) {
    const entry = questionnaireState(instrument, answers).entries[
      index(question.id)
    ];
    if (entry.status === "visible")
      answers = answer(
        answers,
        question.id,
        overrides[question.id] || question.options[0],
      );
  }
  return answers;
}
function planned() {
  let state = createSeed();
  const context = {
    personId: state.people[0].id,
    episodeId: state.people[0].episodes[0].id,
  };
  state = reducer(state, {
    type: "PLAN",
    ...context,
    label: "Adaptive test",
    due: "2026-09-15",
  });
  context.collectionId = state.people[0].episodes[0].collections.at(-1).id;
  state = reducer(state, {
    type: "DELIVER",
    ...context,
    channel: "Clinic tablet",
    respondent: "Person",
    assistance: "Independent",
  });
  return { state, context };
}
const collection = (state) => state.people[0].episodes[0].collections.at(-1);

test("versioned definitions have unique stable IDs and valid acyclic conditions", () => {
  for (const definition of [LEGACY_INSTRUMENT, ...INSTRUMENTS]) {
    const seen = new Map();
    const validate = (rule) => {
      if (!rule) return;
      if (rule.any || rule.all) return (rule.any || rule.all).forEach(validate);
      assert.ok(
        seen.has(rule.questionId),
        `Dependency ${rule.questionId} must come first`,
      );
      assert.ok(
        rule.oneOf.every((option) =>
          seen.get(rule.questionId).options.includes(option),
        ),
      );
    };
    for (const question of definition.questions) {
      assert.ok(!seen.has(question.id));
      assert.ok(
        definition.sections.some((section) => section.id === question.section),
      );
      validate(question.when);
      seen.set(question.id, question);
    }
  }
  assert.equal(getInstrument("unknown"), null);
  assert.equal(getInstrument(LEGACY_INSTRUMENT.version).questions.length, 3);
});

test("the youth check-in keeps verbal Likert anchors and nonresponse distinct", () => {
  assert.equal(LIKERT_INSTRUMENT.questions.length, 6);
  assert.equal(
    LIKERT_INSTRUMENT.responseFormat,
    "Two verbal five-point Likert scales",
  );
  for (const question of LIKERT_INSTRUMENT.questions) {
    assert.equal(question.responseType, "likert");
    assert.equal(question.scale.options.length, 5);
    assert.deepEqual(
      question.options.slice(0, question.scale.options.length),
      question.scale.options,
    );
    assert.ok(!question.scale.options.includes("Prefer not to answer"));
    assert.ok(question.nonResponseOptions.includes("Prefer not to answer"));
  }
  const frequency = LIKERT_INSTRUMENT.questions[0].scale.options;
  const agreement = LIKERT_INSTRUMENT.questions.at(-1).scale.options;
  assert.deepEqual(frequency, [
    "Never",
    "Rarely",
    "Sometimes",
    "Often",
    "Always",
  ]);
  assert.deepEqual(agreement, [
    "Strongly disagree",
    "Disagree",
    "Neither agree nor disagree",
    "Agree",
    "Strongly agree",
  ]);
  const declined = LIKERT_INSTRUMENT.questions.map(
    () => "Prefer not to answer",
  );
  assert.equal(questionnaireState(LIKERT_INSTRUMENT, declined).complete, true);
});

test("each selectable questionnaire stays pinned through collection and submission", () => {
  for (const definition of INSTRUMENTS) {
    let state = createSeed();
    const before = structuredClone(state.people[0].episodes[0].collections);
    const context = {
      personId: state.people[0].id,
      episodeId: state.people[0].episodes[0].id,
    };
    state = reducer(state, {
      type: "PLAN",
      ...context,
      label: "Library follow-up",
      due: "2026-09-16",
      version: definition.version,
    });
    context.collectionId = collection(state).id;
    assert.equal(collection(state).version, definition.version);
    state = reducer(state, {
      type: "DELIVER",
      ...context,
      channel: "Clinic tablet",
      respondent: "Person",
      assistance: "Supported",
    });
    assert.equal(collection(state).assignment, "Active");
    let answers = [];
    definition.questions.forEach((question, index) => {
      if (
        questionnaireState(definition, answers).entries[index].status ===
        "visible"
      )
        answers = setQuestionAnswer(
          definition,
          answers,
          index,
          question.options[0],
        );
    });
    assert.equal(
      questionnaireState(definition, answers).complete,
      true,
      definition.name,
    );
    assert.equal(
      reducer(state, { type: "SUBMIT", ...context, answers: [] }),
      state,
    );
    state = reducer(state, { type: "SUBMIT", ...context, answers });
    assert.equal(collection(state).response, "Submitted");
    assert.equal(collection(state).review, "Not required");
    assert.equal(collection(state).version, definition.version);
    assert.deepEqual(collection(state).answers, answers);
    assert.deepEqual(
      state.people[0].episodes[0].collections.slice(0, -1),
      before,
    );
    const restored = reducer(JSON.parse(JSON.stringify(state)), {
      type: "UPGRADE_QUESTIONNAIRE_SAMPLES",
    });
    assert.deepEqual(collection(restored), collection(state));
  }
});

test("planning rejects unavailable and legacy definitions and delivery respects respondent eligibility", () => {
  const state = createSeed();
  const context = {
    personId: state.people[0].id,
    episodeId: state.people[0].episodes[0].id,
  };
  for (const version of ["Unknown v1.0", LEGACY_INSTRUMENT.version, ""]) {
    assert.equal(
      reducer(state, {
        type: "PLAN",
        ...context,
        label: "Invalid",
        due: "2026-09-16",
        version,
      }),
      state,
    );
  }
  const next = reducer(state, {
    type: "PLAN",
    ...context,
    label: "Person perspective",
    due: "2026-09-16",
    version: INSTRUMENTS[1].version,
  });
  assert.equal(
    reducer(next, {
      type: "DELIVER",
      ...context,
      collectionId: collection(next).id,
      channel: "Clinic tablet",
      respondent: "Family respondent",
      assistance: "Supported",
    }),
    next,
  );
});

test("nested conditions expand the path and clearing a parent clears descendants without resurrection", () => {
  let answers = answer([], "participation", "On my own device");
  assert.equal(questionnaireState(instrument, answers).total, 13);
  answers = answer(answers, "device", "Sometimes");
  answers = answer(answers, "device-help", "A device at the centre");
  assert.equal(questionnaireState(instrument, answers).total, 14);
  answers = answer(answers, "participation", "In person");
  assert.equal(answers[index("device")], null);
  assert.equal(answers[index("device-help")], null);
  assert.equal(questionnaireState(instrument, answers).answered, 1);
  answers = answer(answers, "participation", "On my own device");
  assert.equal(answers[index("device")], "");
  assert.equal(answers[index("device-help")], null);
});

test("all/any rules distinguish unresolved, excluded and applicable questions", () => {
  let answers = answer([], "connection", "Yes");
  assert.equal(
    questionnaireState(instrument, answers).entries[index("involvement")]
      .status,
    "pending",
  );
  answers = answer(answers, "who", "A family member");
  assert.equal(
    questionnaireState(instrument, answers).entries[index("involvement")]
      .status,
    "visible",
  );
  answers = answer(answers, "connection", "Not right now");
  assert.equal(
    questionnaireState(instrument, answers).entries[index("involvement")]
      .status,
    "hidden",
  );
  answers = answer(answers, "support", "I’d like someone alongside me");
  assert.equal(
    questionnaireState(instrument, answers).entries[index("next-help")].status,
    "visible",
  );
  answers = answer(answers, "support", "Prefer not to answer");
  assert.equal(
    questionnaireState(instrument, answers).entries[index("next-help")].status,
    "pending",
  );
  answers = answer(answers, "next", "My next steps");
  assert.equal(
    questionnaireState(instrument, answers).entries[index("next-help")].status,
    "hidden",
  );
});

test("completion uses valid applicable answers and excludes hidden or injected branch answers", () => {
  const answers = completed();
  let path = questionnaireState(instrument, answers);
  assert.equal(path.complete, true);
  assert.equal(path.percent, 100);
  assert.ok(path.total < instrument.questions.length);
  const hidden = index("device");
  answers[hidden] = "Sometimes";
  answers[index("device-help")] = "A device at the centre";
  path = questionnaireState(instrument, answers);
  assert.equal(path.answers[hidden], null);
  assert.equal(path.answers[index("device-help")], null);
  answers[index("support")] = "invalid";
  assert.equal(questionnaireState(instrument, answers).complete, false);
  answers[index("support")] = "Prefer not to answer";
  assert.equal(questionnaireState(instrument, answers).complete, true);
});

test("new branching submissions reject missing follow-ups, strip skipped data and submit once", () => {
  const { state, context } = planned();
  const answers = completed({
    participation: "On my own device",
    device: "Sometimes",
  });
  const incomplete = [...answers];
  incomplete[index("device-help")] = "";
  assert.equal(
    reducer(state, { type: "SUBMIT", ...context, answers: incomplete }),
    state,
  );
  const submitted = reducer(state, { type: "SUBMIT", ...context, answers });
  assert.equal(collection(submitted).response, "Submitted");
  assert.equal(collection(submitted).answers.length, 24);
  assert.equal(collection(submitted).answers[index("hobbies")], null);
  assert.equal(
    reducer(submitted, { type: "SUBMIT", ...context, answers }),
    submitted,
  );
});

test("branch corrections preserve original answers, audit cleared answers and require re-review", () => {
  let { state, context } = planned();
  state = reducer(state, {
    type: "SUBMIT",
    ...context,
    answers: completed({
      participation: "On my own device",
      device: "Sometimes",
    }),
  });
  state = reducer(state, { type: "REVIEW", ...context, note: "Sample review" });
  const original = [...collection(state).answers];
  const changed = answer(original, "participation", "In person");
  const action = {
    type: "EDIT_RESPONSE",
    ...context,
    answers: changed,
    expectedRevision: 0,
    reason: "Corrected sample source",
  };
  assert.equal(responseEditError(state, action), null);
  const edited = reducer(state, action);
  assert.deepEqual(collection(edited).originalAnswers, original);
  assert.equal(collection(edited).needsReview, true);
  assert.equal(edited.audit[0].changes.length, 3);
  assert.match(edited.audit[0].changes[1].newDisplay, /Not asked/);
  const expanded = answer(changed, "participation", "On my own device");
  assert.match(
    responseEditError(edited, {
      ...action,
      expectedRevision: 1,
      answers: expanded,
    }),
    /applicable question/,
  );
});

test("longitudinal comparisons never count branches absent on either path as answer changes", () => {
  const person = createSeed().people[0];
  const before = {
    id: "a",
    response: "Submitted",
    version: instrument.version,
    respondent: "Person",
    submittedAt: "2026-09-01",
    answers: completed({
      participation: "On my own device",
      device: "Sometimes",
    }),
  };
  const after = {
    ...before,
    id: "b",
    submittedAt: "2026-09-15",
    answers: completed({ participation: "In person" }),
  };
  const result = compareResponses(person, before, after);
  assert.equal(result.changed, 1);
  assert.equal(result.rows[index("device")].change, "Not comparable");
  assert.equal(result.rows[index("device-help")].change, "Not comparable");
  assert.match(result.rows[index("device")].after, /Not asked/);
  assert.equal(result.rows.length, 24);
});

test("a long questionnaire supports hundreds of questions without fixed navigation limits", () => {
  const definition = {
    version: "Long fixture",
    sections: [{ id: "all", title: "All" }],
    questions: Array.from({ length: 400 }, (_, i) => ({
      id: `q${i}`,
      section: "all",
      title: `Question ${i}`,
      options: ["Yes", "No"],
      ...(i % 2 ? { when: { questionId: `q${i - 1}`, oneOf: ["Yes"] } } : {}),
    })),
  };
  const path = questionnaireState(
    definition,
    definition.questions.map((_, i) => (i % 2 ? "Yes" : "No")),
  );
  assert.equal(path.total, 200);
  assert.equal(path.answered, 200);
  assert.equal(path.hidden, 200);
  assert.equal(path.complete, true);
  assert.equal(path.sections[0].answered, 200);
});

test("every refreshed mock response is complete on its path and fixtures expose varied branching", () => {
  const state = createSeed();
  const paths = [];
  for (const person of state.people)
    for (const episode of person.episodes)
      for (const response of episode.collections) {
        const definition = getInstrument(response.version);
        assert.ok(definition, response.version);
        if (response.response !== "Submitted") continue;
        const path = questionnaireState(definition, response.answers);
        assert.ok(path.complete, response.id);
        assert.deepEqual(response.answers, path.answers, response.id);
        paths.push(path.total);
      }
  assert.ok(new Set(paths).size >= 3);
  const zoe = state.people.find((person) => person.name === "Zoe Patel");
  const comparison = compareResponses(zoe, ...zoe.episodes[0].collections);
  assert.ok(comparison.changed > 0);
  assert.ok(
    comparison.rows.some(
      (row) =>
        row.before.startsWith("Not asked") !==
        row.after.startsWith("Not asked"),
    ),
  );
});

test("old questionnaire fixtures refresh even when another feature has advanced the workspace revision", () => {
  const state = createSeed();
  const collection = state.people[3].episodes[0].collections.at(-1);
  collection.version = LEGACY_INSTRUMENT.version;
  collection.answers = ["In person", "A little support", "My next steps"];
  const updated = reducer(state, { type: "UPGRADE_QUESTIONNAIRE_SAMPLES" });
  const current = updated.people[3].episodes[0].collections.at(-1);
  assert.equal(current.version, instrument.version);
  assert.equal(current.answers.length, 24);
  assert.equal(questionnaireState(instrument, current.answers).complete, true);
  assert.equal(
    reducer(updated, { type: "UPGRADE_QUESTIONNAIRE_SAMPLES" }),
    updated,
  );
});
