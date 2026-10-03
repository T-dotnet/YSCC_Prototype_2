import { contactVisible } from './assessmentFeatures.js';
import { appointmentIsOverdue } from './appointments.js';
import { getQualityIssues } from './dataQuality.js';
import { formatDate, TODAY } from './model.js';
import { mvpPathwayEnabled } from './mvpAssessmentPathway.js';
import { getWorkItems } from './workQueue.js';
import { taskHref } from './workflow.js';

const daysUntil = (date, today) => date
  ? Math.round((Date.parse(`${date}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 86400000)
  : null;

export function getNotifications(state, today = TODAY) {
  if (!state) return [];
  const peopleById = new Map((state.people || []).map(person => [person.id, person]));
  const notifications = getQualityIssues(state, today)
    .filter(issue => !['Resolved', 'Closed'].includes(issue.status) &&
      !peopleById.get(issue.personId)?.archivedAt)
    .map(issue => {
      const person = peopleById.get(issue.personId);
      return {
        id: `dq-${issue.id}`, category: 'data_quality', categoryLabel: 'Data quality error',
        title: issue.title || issue.type || 'Data quality issue',
        detail: `${person?.name ? `${person.name} · ` : ''}${issue.description || issue.nextStep || 'Requires resolution'}`,
        personName: person?.name || null, personId: person?.id || null,
        href: '/quality',
        severity: issue.severity || 'Medium',
      };
    });

  for (const item of getWorkItems(state, 'team', today)) {
    if (!item.collection) continue;
    let category;
    let label;
    if (item.status === 'Overdue') {
      category = 'assessment_overdue'; label = 'Measure overdue';
    } else if (item.status === 'Ready for review') {
      category = 'assessment_review'; label = 'Measure ready for review';
    } else if (item.status === 'Record outcome') {
      category = 'assessment_outcome'; label = 'Assessment outcome needed';
    } else if (mvpPathwayEnabled(state.settings) && item.stage === '90-day review' && daysUntil(item.due, today) >= 0 &&
      daysUntil(item.due, today) <= 7) {
      category = 'scheduled_review'; label = '90-day review due soon';
    } else continue;
    notifications.push({
      id: `work-${item.id}`, category, categoryLabel: label,
      title: `${item.title} · ${item.status === 'Record outcome' ? 'record outcome' :
        item.status === 'Ready for review' ? 'ready for review' :
          item.status === 'Overdue' ? 'overdue' : 'due soon'}`,
      detail: `${item.person.name}${item.due ? ` · Due ${formatDate(item.due)}` : ''}`,
      personName: item.person.name, personId: item.person.id,
      collectionId: item.collection.id, href: taskHref(item, '/'), due: item.due,
    });
  }

  for (const person of state.people || []) {
    if (person.archivedAt) continue;
    for (const episode of person.episodes || []) {
      if (episode.status !== 'Active') continue;
      for (const appointment of episode.appointments || []) {
        if (!contactVisible(appointment, state.settings) || !appointmentIsOverdue(appointment, today)) continue;
        notifications.push({
          id: `aptdue-${person.id}-${appointment.id}`,
          category: 'appointment_overdue', categoryLabel: 'Contact input overdue',
          title: 'Contact input overdue',
          detail: `${person.name} · Planned ${formatDate(appointment.plannedDate)}${appointment.plannedTime ? ` ${appointment.plannedTime}` : ''} (${appointment.practitionerService || 'Contact'})`,
          personName: person.name, personId: person.id, appointmentId: appointment.id,
          href: `/people/${encodeURIComponent(person.id)}?tab=Events&episode=${encodeURIComponent(episode.id)}`,
          plannedDate: appointment.plannedDate,
        });
      }
    }
  }
  return notifications;
}
