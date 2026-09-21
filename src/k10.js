// Fictional report fixture only. This pins the ABS NHS four-week, 1–5
// ten-item sum, which differs from 0–4 and historically reversed variants.
export const K10_SCORING_METHOD = "ABS NHS K10 · four-week recall · 1–5 sum";
export const K10_METHOD_URL =
  "https://www.abs.gov.au/ausstats/abs%40.nsf/Lookup/by%20Subject/4363.0~2017-18~Main%20Features~Kessler%20Psychological%20Distress%20Scale%20-10%20%28K10%29~35";

const isRecordedDate = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
};

export function k10RawTotal(record) {
  if (
    record?.response !== "Submitted" ||
    record?.scoringMethod !== K10_SCORING_METHOD ||
    !isRecordedDate(record?.date) ||
    !Array.isArray(record?.answers) ||
    record.answers.length !== 10 ||
    !record.answers.every(
      (answer) => Number.isInteger(answer) && answer >= 1 && answer <= 5,
    )
  )
    return null;
  return record.answers.reduce((total, answer) => total + answer, 0);
}

export function k10Series(episode) {
  const records = episode?.k10Responses ?? [];
  return {
    points: records
      .map((record) => ({ ...record, total: k10RawTotal(record) }))
      .filter((record) => record.total !== null)
      .toSorted((a, b) => a.date.localeCompare(b.date)),
    omitted: records.filter((record) => k10RawTotal(record) === null).length,
  };
}
