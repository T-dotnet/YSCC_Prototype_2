import { questionnaireState } from "./instruments.js";

// An answer keeps the session that last supplied its current value. A later
// session can complete the questionnaire without taking credit for unchanged
// answers from an earlier session.
export function mergeAnswerSources(instrument, previousAnswers = [], previousSources = {}, answers = [], attemptId) {
  const normalized = questionnaireState(instrument, answers).answers;
  const sources = {};
  instrument.questions.forEach((question, index) => {
    if (!normalized[index]) return;
    if (normalized[index] === previousAnswers[index] && previousSources[question.id]) {
      sources[question.id] = previousSources[question.id];
    } else if (attemptId) {
      sources[question.id] = attemptId;
    }
  });
  return { answers: normalized, sources };
}

export function answerSession(collection, questionId, draft = false) {
  const sourceId = (draft ? collection.draftAnswerSources : collection.answerSources)?.[questionId]
    || (!draft && collection.submittedAttemptId);
  return collection.attempts?.find((attempt) => attempt.id === sourceId) || null;
}

export function sessionAnswerCounts(collection, instrument, draft = false) {
  const answers = draft ? collection.draftAnswers : collection.answers;
  const counts = new Map();
  if (!instrument) return counts;
  questionnaireState(instrument, answers || []).entries.forEach((entry) => {
    if (!entry.answer) return;
    const attempt = answerSession(collection, entry.question.id, draft);
    if (attempt) counts.set(attempt.id, (counts.get(attempt.id) || 0) + 1);
  });
  return counts;
}

export function sessionContribution(collection, attempt, counts) {
  const answerCount = counts.get(attempt.id) || 0;
  return {
    answerCount,
    status: collection.response === "Submitted" && attempt.id === collection.submittedAttemptId
      ? "Completed"
      : answerCount > 0 ? "Partial" : "None",
  };
}

export function contactContribution(collection, contactId, instrument) {
  const draft = collection.response === "Draft";
  const counts = sessionAnswerCounts(collection, instrument, draft);
  const attempts = (collection.attempts || []).filter((attempt) =>
    attempt.appointmentId === contactId ||
    (!attempt.appointmentId && attempt.id === collection.submittedAttemptId &&
      collection.submittedAppointmentId === contactId));
  const answerCount = attempts.reduce((total, attempt) =>
    total + (counts.get(attempt.id) || 0), 0);
  const methods = [...new Set(attempts.map((attempt) => attempt.channel).filter(Boolean))];
  return {
    answerCount,
    totalAnswers: questionnaireState(instrument, draft ? collection.draftAnswers : collection.answers).total,
    methods,
    status: collection.response === "Submitted" &&
      attempts.some((attempt) => attempt.id === collection.submittedAttemptId)
      ? "Completed"
      : answerCount > 0 ? "Partial" : "None",
  };
}
