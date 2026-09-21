const COMPLETE_STATUS = "Complete";

export const outcomeDisplayName = (measure) => {
  const names = {
    "k10-plus": "K10+",
    k5: "K5",
    sdq: "SDQ",
    sidas: "SIDAS",
    "who-5": "WHO-5",
    "iar-dst": "IAR-DST",
  };
  return measure.shortName || names[measure.key] || measure.name;
};

export const isCompletedScore = (record) =>
  record?.status === COMPLETE_STATUS &&
  record.value !== null &&
  record.value !== undefined &&
  Number.isFinite(Number(record.value));

const byDate = (a, b) => a.date.localeCompare(b.date);

// This adapter keeps the source score and any documented change judgement
// separate. A numerical difference is displayed literally; it never creates a
// clinical interpretation on its own.
export function outcomeMeasureCards(definitions, outcomeRecords = []) {
  return outcomeRecords.flatMap((fixture) => {
    const definition = definitions.find(
      (measure) => measure.key === fixture.key,
    );
    if (!definition || !fixture.records?.length) return [];

    const records = [...fixture.records].sort(byDate);
    const latest = records.at(-1);
    const previousCompleted = [...records]
      .slice(0, -1)
      .reverse()
      .find(isCompletedScore);
    const latestScore = isCompletedScore(latest) ? Number(latest.value) : null;
    const previousScore = previousCompleted
      ? Number(previousCompleted.value)
      : null;

    return [
      {
        ...definition,
        ...fixture,
        displayName: outcomeDisplayName({ ...definition, ...fixture }),
        records,
        latest,
        latestScore,
        previousCompleted,
        scoreChange:
          latestScore !== null && previousScore !== null
            ? latestScore - previousScore
            : null,
        change: latest.change || null,
        needsFollowUp:
          latest.status !== COMPLETE_STATUS || latest.dueState === "Overdue",
      },
    ];
  });
}

export const scoreChangeLabel = (change) => {
  if (change === null || change === undefined) return null;
  return `${change > 0 ? "+" : ""}${change}`;
};
