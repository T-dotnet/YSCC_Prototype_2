// Association is separate from the contact that supplied a questionnaire response.
// Legacy singular pointers remain readable so existing prototype records need no migration.
export function assessmentContactLinks(episode) {
  if (!episode) return [];
  const collectionIds = new Set((episode.collections || []).map((item) => item.id));
  const appointmentIds = new Set((episode.appointments || []).map((item) => item.id));
  const links = [ ...(episode.assessmentContactLinks || []) ];
  for (const collection of episode.collections || []) {
    for (const appointmentId of [
      collection.appointmentId,
      collection.submittedAppointmentId,
      ...(collection.attempts || []).map((attempt) => attempt.appointmentId),
    ]) {
      if (appointmentId) links.push({ collectionId: collection.id, appointmentId });
    }
  }
  const seen = new Set();
  return links.filter(({ collectionId, appointmentId }) => {
    const key = `${collectionId}:${appointmentId}`;
    if (!collectionIds.has(collectionId) || !appointmentIds.has(appointmentId) || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function contactsForAssessment(episode, collectionId) {
  const ids = new Set(assessmentContactLinks(episode)
    .filter((link) => link.collectionId === collectionId)
    .map((link) => link.appointmentId));
  return (episode?.appointments || []).filter((appointment) => ids.has(appointment.id));
}

export function contactsForAssessments(episode, collections = []) {
  const records = new Map(collections.map(collection => [collection.id, collection]));
  const links = assessmentContactLinks(episode).filter(link => records.has(link.collectionId));
  return (episode?.appointments || []).flatMap(contact => {
    const assessments = links.filter(link => link.appointmentId === contact.id).map(link => records.get(link.collectionId));
    return assessments.length ? [{contact, assessments}] : [];
  });
}

export function assessmentsForContact(episode, appointmentId) {
  const ids = new Set(assessmentContactLinks(episode)
    .filter((link) => link.appointmentId === appointmentId)
    .map((link) => link.collectionId));
  return (episode?.collections || []).filter((collection) => ids.has(collection.id));
}

export function addAssessmentContactLink(episode, collectionId, appointmentId) {
  if (assessmentContactLinks(episode).some((link) =>
    link.collectionId === collectionId && link.appointmentId === appointmentId)) return false;
  episode.assessmentContactLinks ??= [];
  episode.assessmentContactLinks.push({ collectionId, appointmentId });
  return true;
}
