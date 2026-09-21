import {
  getInstrument,
  questionnaireState,
  answerLabel,
} from "./instruments.js";
import {
  TODAY,
  collectionActor,
  formatDate,
  hasPendingClinicalReview,
} from "./model.js";

// Submission dates are evidence dates. Due dates never stand in for them.
export function responseDate(collection) {
  const date = collection?.submittedAt?.slice(0, 10);
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const parsed = new Date(`${date}T12:00:00Z`);
  return Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== date
    ? null
    : date;
}

function sameRespondent(person, a, b) {
  if (!a.respondent || a.respondent !== b.respondent) return false;
  const aName = collectionActor(person, a, "respondent");
  const bName = collectionActor(person, b, "respondent");
  return (
    aName === bName && !["Name not recorded", "Not recorded"].includes(aName)
  );
}

export function comparisonReason(person, earlier, latest) {
  if (!earlier || !latest || earlier.id === latest.id)
    return "A second submitted response is needed to show change over time.";
  if (earlier.response !== "Submitted" || latest.response !== "Submitted")
    return "Only submitted responses can be compared.";
  if (!responseDate(earlier) || !responseDate(latest))
    return "A submission date is missing. These responses cannot be placed in a reliable time sequence.";
  if (responseDate(earlier) >= responseDate(latest))
    return "Choose a response submitted on an earlier date.";
  if (earlier.version !== latest.version || !getInstrument(latest.version))
    return "Questionnaire versions cannot be compared here. Read each response separately.";
  if (!sameRespondent(person, earlier, latest))
    return "These responses have different or unconfirmed respondents. Read each perspective separately.";
  return null;
}

export function compareResponses(person, earlier, latest) {
  const reason = comparisonReason(person, earlier, latest);
  if (reason) return { reason, rows: [], changed: 0, comparable: 0 };
  const instrument = getInstrument(latest.version);
  const earlierPath = questionnaireState(instrument, earlier.answers);
  const latestPath = questionnaireState(instrument, latest.answers);
  const rows = instrument.questions.map((question, index) => {
    const before = earlier.answers?.[index];
    const after = latest.answers?.[index];
    const hasAnswer = (value) =>
      question.options.includes(value) && value !== "Prefer not to answer";
    const beforeEntry = earlierPath.entries[index],
      afterEntry = latestPath.entries[index];
    const comparable =
      beforeEntry.status === "visible" &&
      afterEntry.status === "visible" &&
      hasAnswer(before) &&
      hasAnswer(after);
    return {
      id: question.id,
      section: question.section,
      question:
        latest.respondent === "Family respondent" && question.family
          ? question.family
          : question.title,
      before:
        beforeEntry.status !== "visible"
          ? answerLabel(beforeEntry)
          : before === "" || before == null
            ? "No answer recorded"
            : before,
      after:
        afterEntry.status !== "visible"
          ? answerLabel(afterEntry)
          : after === "" || after == null
            ? "No answer recorded"
            : after,
      change: comparable
        ? before === after
          ? "Unchanged"
          : "Changed"
        : "Not comparable",
    };
  });
  return {
    reason: null,
    rows,
    changed: rows.filter((r) => r.change === "Changed").length,
    comparable: rows.filter((r) => r.change !== "Not comparable").length,
  };
}

export function patientProgress(person, episode, latestId) {
  const responses = episode.collections.filter(
    (c) => c.response === "Submitted",
  );
  const dated = responses
    .filter(responseDate)
    .sort(
      (a, b) =>
        responseDate(a).localeCompare(responseDate(b)) ||
        (a.submittedAt || "").localeCompare(b.submittedAt || "") ||
        a.id.localeCompare(b.id),
    );
  const requestedLatest = dated.find((c) => c.id === latestId) || null;
  const latest = requestedLatest || dated.at(-1) || null;
  const latestOptions = latest
    ? dated.filter((c) => responseDate(c) === responseDate(latest))
    : [];
  const earlier = latest
    ? dated.filter((c) => responseDate(c) < responseDate(latest))
    : [];
  const baseline =
    earlier.find((c) => !comparisonReason(person, c, latest)) ||
    earlier[0] ||
    null;
  const pendingReviews = responses.filter(hasPendingClinicalReview);
  const open =
    episode.status === "Active"
      ? episode.collections
          .filter(
            (c) =>
              c.response !== "Submitted" &&
              !["Cancelled", "Paused"].includes(c.assignment),
          )
          .sort((a, b) => (a.due || "9999").localeCompare(b.due || "9999"))
      : [];
  const reviews = responses
    .filter((c) => c.review === "Reviewed")
    .sort((a, b) => (b.reviewDate || "").localeCompare(a.reviewDate || ""));
  return {
    responses,
    dated,
    latest,
    latestOptions,
    earlier,
    baseline,
    pendingReviews,
    open,
    latestReview: reviews[0] || null,
    undated: responses.filter((c) => !responseDate(c)),
    overdue: open.filter((c) => c.due && c.due < TODAY),
  };
}

// Questionnaire details only use collections from the selected version.
export function questionnaireProgress(person, episode, version, latestId) {
  const questionnaires = [
    ...new Set(episode.collections.map((c) => c.version || "")),
  ];
  const selectedVersion = questionnaires.includes(version)
    ? version
    : patientProgress(person, episode).latest?.version ||
      questionnaires[0] ||
      "";
  const collections = episode.collections.filter(
    (c) => (c.version || "") === selectedVersion,
  );
  return {
    ...patientProgress(person, { ...episode, collections }, latestId),
    questionnaires,
    version: selectedVersion,
    collections,
  };
}

// Keep each instrument and respondent perspective in its own dated sequence.
export function reportEvidence(person, episode) {
  const progress = patientProgress(person, episode);
  const groups = [];
  for (const c of progress.dated) {
    let group = groups.find(
      (g) =>
        g.version === c.version &&
        getInstrument(c.version) &&
        sameRespondent(person, g.points[0], c),
    );
    if (!group) {
      group = {
        id: c.id,
        version: c.version,
        respondent: collectionActor(person, c, "respondent"),
        role: c.respondent,
        points: [],
      };
      groups.push(group);
    }
    group.points.push(c);
  }
  return {
    ...progress,
    groups: groups.map((group) => {
      const first = group.points[0],
        last = group.points.at(-1);
      const ambiguous =
        group.points.filter((c) => responseDate(c) === responseDate(first))
          .length > 1 ||
        group.points.filter((c) => responseDate(c) === responseDate(last))
          .length > 1;
      const comparison = ambiguous
        ? {
            reason:
              "Several responses share a starting or latest date. Choose a response in the questionnaire details before interpreting change.",
            rows: [],
          }
        : compareResponses(person, first, last);
      const sections = (getInstrument(group.version)?.sections || []).map(
        (section) => {
          const rows = comparison.rows.filter((r) => r.section === section.id);
          const changed = rows.filter((r) => r.change === "Changed");
          return {
            ...section,
            changed,
            comparable: rows.filter((r) => r.change !== "Not comparable")
              .length,
            excluded: rows.filter((r) => r.change === "Not comparable").length,
          };
        },
      );
      const responseHistory = group.points.map((current, index) => {
        const previous = group.points[index - 1] || null;
        return {
          current,
          previous,
          comparison: previous
            ? compareResponses(person, previous, current)
            : null,
        };
      });
      return {
        ...group,
        first,
        last,
        comparison,
        sections,
        responseHistory,
      };
    }),
  };
}

// Shape report evidence for the dashboard without turning ordinal responses
// into a clinical score. Each Likert question keeps its own authored scale.
export function questionnaireDashboardGroups(evidence) {
  return evidence.groups.map((group) => {
    const instrument = getInstrument(group.version);
    if (!instrument) {
      return {
        ...group,
        instrumentName: group.version || "Unknown questionnaire",
        likertQuestions: [],
        likertTrends: [],
        likertChanges: [],
        likertScore: null,
        qualitativeQuestions: [],
        qualitativeChanges: [],
        responseHistory: group.responseHistory.map((entry) => ({
          ...entry,
          changedCount: 0,
          likertChangedCount: 0,
          qualitativeQuestionCount: 0,
          qualitativeChanges: [],
        })),
      };
    }
    const comparisonByQuestion = new Map(
      group.comparison.rows.map((row) => [row.id, row]),
    );
    const questions = instrument.questions.map((question, index) => {
      const points = group.points.map((collection) => {
        const answer = collection.answers?.[index];
        const scaleIndex = question.scale?.options.indexOf(answer) ?? -1;
        return {
          id: collection.id,
          label: collection.label,
          date: responseDate(collection),
          answer:
            answer === "" || answer == null ? "No answer recorded" : answer,
          value: scaleIndex < 0 ? null : scaleIndex + 1,
        };
      });
      return {
        id: question.id,
        section: instrument.sections.find(
          (section) => section.id === question.section,
        ),
        question: question.title,
        responseType: question.responseType || "choice",
        scale: question.scale || null,
        points,
        comparison: comparisonByQuestion.get(question.id) || null,
      };
    });
    const questionsById = new Map(
      questions.map((question) => [question.id, question]),
    );
    const likertQuestions = questions.filter(
      (question) => question.responseType === "likert",
    );
    const scoreAt = (pointIndex) => {
      const values = likertQuestions
        .map((question) => {
          const point = question.points.at(pointIndex);
          const optionCount = question.scale?.options.length || 0;
          if (!point || point.value === null || optionCount < 2) return null;
          return ((point.value - 1) / (optionCount - 1)) * 100;
        })
        .filter((value) => value !== null);
      if (!values.length) return null;
      return {
        value: Math.round(
          values.reduce((sum, value) => sum + value, 0) / values.length,
        ),
        answered: values.length,
        total: likertQuestions.length,
      };
    };
    const latestLikertScore = scoreAt(-1);
    const baselineLikertScore = scoreAt(0);
    const responseHistory = group.responseHistory.map((entry) => {
      const changedRows =
        entry.comparison?.rows.filter((row) => row.change === "Changed") || [];
      const qualitativeChanges = changedRows.flatMap((row) => {
        const question = questionsById.get(row.id);
        return question && question.responseType !== "likert"
          ? [
              {
                id: row.id,
                section: question.section,
                question: row.question,
                comparison: row,
              },
            ]
          : [];
      });
      return {
        ...entry,
        changedCount: changedRows.length,
        likertChangedCount: changedRows.filter(
          (row) => questionsById.get(row.id)?.responseType === "likert",
        ).length,
        qualitativeQuestionCount: questions.filter(
          (question) => question.responseType !== "likert",
        ).length,
        qualitativeChanges,
      };
    });
    return {
      ...group,
      instrumentName: instrument.name || group.version,
      likertQuestions,
      likertTrends: questions.filter(
        (question) =>
          question.responseType === "likert" &&
          question.points.filter((point) => point.value !== null).length >= 2,
      ),
      likertChanges: questions.filter(
        (question) =>
          question.responseType === "likert" &&
          question.comparison?.change === "Changed",
      ),
      likertScore: latestLikertScore
        ? {
            latest: latestLikertScore,
            baseline: baselineLikertScore,
            change:
              !group.comparison.reason && baselineLikertScore
                ? latestLikertScore.value - baselineLikertScore.value
                : null,
          }
        : null,
      qualitativeQuestions: questions.filter(
        (question) => question.responseType !== "likert",
      ),
      qualitativeChanges: questions.filter(
        (question) =>
          question.responseType !== "likert" &&
          question.comparison?.change === "Changed",
      ),
      responseHistory,
    };
  });
}

export function suggestedReport(person, episode) {
  const evidence = reportEvidence(person, episode);
  const datedRange = evidence.dated.length
    ? `${formatDate(responseDate(evidence.dated[0]))} to ${formatDate(responseDate(evidence.dated.at(-1)))}`
    : null;
  const summary = !evidence.responses.length
    ? "No questionnaires have been submitted in this care period. A starting assessment is needed before changes can be described."
    : `${evidence.responses.length} submitted ${evidence.responses.length === 1 ? "questionnaire informs" : "questionnaires inform"} this report${datedRange ? `, covering ${datedRange}` : "; submission dates need confirmation"}. ${evidence.pendingReviews.length ? `${evidence.pendingReviews.length} ${evidence.pendingReviews.length === 1 ? "response still needs" : "responses still need"} clinical review.` : "All submitted responses are reviewed or do not require a separate clinical review."}${evidence.undated.length ? ` ${evidence.undated.length} ${evidence.undated.length === 1 ? "response has" : "responses have"} no submission date and cannot show change over time.` : ""}`;
  const changes = evidence.groups
    .map((group) => {
      const heading = `${group.version || "Unknown questionnaire"} · ${group.respondent} (${group.role || "role not recorded"})`;
      if (group.comparison.reason)
        return `${heading}\n${group.comparison.reason}`;
      const sections = group.sections
        .map((section) => {
          const detail = section.changed
            .slice(0, 2)
            .map((row) => `${row.question} “${row.before}” → “${row.after}”.`)
            .join(" ");
          return `${section.title}: ${section.changed.length ? `${section.changed.length} ${section.changed.length === 1 ? "answer changed" : "answers changed"}. ${detail}${section.changed.length > 2 ? " Further changes are available in the questionnaire details." : ""}` : section.comparable ? "Comparable answers are unchanged." : "No comparable answers."}${section.excluded ? ` ${section.excluded} ${section.excluded === 1 ? "question was" : "questions were"} not comparable.` : ""}`;
        })
        .join("\n");
      const context =
        group.first.channel !== group.last.channel ||
        group.first.assistance !== group.last.assistance
          ? `\nCollection context changed: ${group.first.channel || "method not recorded"} / ${group.first.assistance || "assistance not recorded"} → ${group.last.channel || "method not recorded"} / ${group.last.assistance || "assistance not recorded"}.`
          : "";
      return `${heading}\n${formatDate(responseDate(group.first))} → ${formatDate(responseDate(group.last))}\n${sections}${context}`;
    })
    .join("\n\n");
  return {
    summary,
    changes:
      changes ||
      "There is not enough dated questionnaire evidence to describe change over time.",
    interpretation: "",
    nextSteps: "",
  };
}

// A saved report must keep using its saved evidence, even after answers change.
// Authored narrative stays verbatim instead of being replaced by a comparison.
export function reportChangeEvidence(person, episode) {
  const report = episode.progressReport;
  if (!report) return reportEvidence(person, episode);
  if (!Array.isArray(report.sources)) return null;
  const snapshot = {
    ...episode,
    collections: report.sources.map((source) => ({
      ...source,
      response: "Submitted",
    })),
  };
  return report.content.changes === suggestedReport(person, snapshot).changes
    ? reportEvidence(person, snapshot)
    : null;
}
