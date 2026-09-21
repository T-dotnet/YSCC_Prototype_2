import { canAssess } from "./intake.js";
import { getInstrument } from "./instruments.js";
import {
  collectionStatus,
  formatDate,
  noClinicalReviewRequired,
  TODAY,
} from "./model.js";

// Opening setup never delivers anything; its confirmation remains a separate step.
export function collectionSetupLabel(collection) {
  if (collection.link === "Expired") return "Replace expired link";
  if (
    collection.attempts.length ||
    collection.response === "Draft" ||
    ["Active", "Revoked"].includes(collection.link)
  )
    return "Review collection options";
  return "Set up collection";
}

export function overviewNextStep(person, episode, collection, staff) {
  const c = collection;
  const submitted = c.response === "Submitted";
  const reviewed = submitted && c.review === "Reviewed" && !c.needsReview;
  const reviewNotRequired = noClinicalReviewRequired(c);
  const status = collectionStatus(c);
  const daysLate = Math.round(
    (Date.parse(TODAY) - Date.parse(c.due)) / 86400000,
  );
  const dueText = `${c.due ? `Due ${formatDate(c.due)}` : "Due date not recorded"}${!submitted && status === "Overdue" && episode.status === "Active" ? ` · ${daysLate} ${daysLate === 1 ? "day" : "days"} overdue` : ""}`;
  const step = (title, description, primary, badge = status) => ({
    title,
    description,
    primary,
    badge,
    dueText,
  });
  const details = {
    label: "View collection details",
    modal: "collection-details",
  };

  if (episode.status !== "Active")
    return step(
      episode.status === "Closed"
        ? "This care period is closed"
        : "Care is paused",
      episode.nextCareStep ||
        episode.reason ||
        "Check the episode history for the recorded reason and next care arrangement. Existing responses remain available in Assessment.",
      { label: "View episode history", tab: "History" },
      episode.status,
    );

  // Existing evidence stays readable even if permission or intake changes later.
  if (submitted) {
    if (reviewNotRequired)
      return step(
        "Questionnaire completed",
        "The response was recorded through a supported completion method. No separate clinical review is required.",
        details,
      );
    if (reviewed)
      return step(
        "Clinical review recorded",
        `The response and review are saved. ${episode.owner || person.owner || "The care team"} owns the next care decision; assessment completion remains separate.`,
        { label: "View clinical review", modal: "review" },
      );
    const clinician = staff?.role === "Clinician";
    return step(
      c.needsReview
        ? "Updated answers need review"
        : "Responses are ready for review",
      c.needsReview
        ? "Answers changed after the previous review. A clinician needs to review the updated response; the earlier review is retained."
        : "The questionnaire has been submitted. A clinician needs to review the answers and record their interpretation.",
      {
        label: clinician
          ? c.needsReview
            ? "Review updated answers"
            : "Review responses"
          : "View responses",
        modal: "review",
      },
    );
  }

  if (["Paused", "Cancelled"].includes(c.assignment))
    return step(
      `This collection is ${c.assignment.toLowerCase()}`,
      "Check the recorded collection and episode history before agreeing further assessment work.",
      details,
      c.assignment,
    );

  if (!canAssess(person, episode))
    return step(
      "Resolve intake before collecting",
      "Review the intake evidence and proceed decision before starting or reissuing this questionnaire.",
      { label: "Open intake", tab: "Intake" },
      "Intake required",
    );

  if (person.consent !== "Recorded" || person.contact !== "Suitable")
    return step(
      "Review participation & contact",
      [
        person.consent !== "Recorded" &&
          `Participation is ${(person.consent || "not recorded").toLowerCase()}.`,
        person.contact !== "Suitable" &&
          `Contact suitability is ${(person.contact || "not confirmed").toLowerCase()}.`,
        "Resolve these settings before collecting more answers.",
      ]
        .filter(Boolean)
        .join(" "),
      { label: "Review participation & contact", tab: "Consent & respondents" },
      "Collection blocked",
    );

  if (!getInstrument(c.version))
    return step(
      "Check the assigned questionnaire",
      "The assigned version is unavailable. Check the collection details with the care team before arranging another attempt.",
      details,
      "Version unavailable",
    );

  if (c.link === "Expired")
    return step(
      "Replace the expired questionnaire link",
      `The previous link has expired and no response has been submitted.${c.response === "Draft" ? " A draft was recorded, but it cannot be resumed here." : ""} Confirm the respondent and collection method for another attempt on this collection.`,
      { label: collectionSetupLabel(c), modal: "collection" },
    );

  if (c.link === "Revoked")
    return step(
      "Check why the collection link was revoked",
      "The previous link is no longer usable. Review the collection and episode history before arranging another attempt.",
      details,
    );

  if (c.response === "Draft")
    return step(
      status === "Overdue"
        ? "Follow up the unfinished response"
        : "Check the response in progress",
      "A draft is recorded, but the questionnaire has not been submitted. Check the collection activity and support needed. The sample draft cannot be resumed here.",
      details,
    );

  if (c.attempts.length || c.link === "Active") {
    const active = c.link === "Active";
    const channel = c.attempts.at(-1)?.channel || c.channel;
    return step(
      status === "Overdue"
        ? "Follow up the overdue response"
        : "Awaiting the questionnaire response",
      `${active ? (channel === "SMS link" ? "The questionnaire link is still active." : "A collection session is active.") : "A collection attempt is recorded."} No response has been submitted. Check the activity and contact arrangements before deciding whether another attempt is needed.`,
      details,
    );
  }

  return step(
    status === "Overdue"
      ? "Arrange the overdue questionnaire"
      : status === "Scheduled"
        ? "Prepare the scheduled questionnaire"
        : "Arrange questionnaire collection",
    "No collection attempt is recorded. Confirm who will answer and choose how to collect their response.",
    { label: "Set up collection", modal: "collection" },
  );
}
