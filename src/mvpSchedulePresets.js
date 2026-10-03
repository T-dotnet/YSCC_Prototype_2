export const MVP_SCHEDULE_PRESETS = [
  { id: 'assessment', label: 'Assessment', description: 'Prepare once, one day after intake is completed.', fields: { trigger: 'current', timing: 'days', after: 'intake', days: 1, repeat: false } },
  { id: 'review', label: '90-day review', description: 'Prepare every 90 days after intake while the care episode is active.', fields: { trigger: 'current', timing: 'days', after: 'intake', days: 90, repeat: true } },
  { id: 'discharge', label: 'Discharge', description: 'Prepare once when the care episode closes.', fields: { trigger: 'current', timing: 'discharge', after: 'discharge', repeat: false } },
  ...['Accepted', 'Denied', 'Reworked', 'Modified'].map(status => ({ id: `referral-${status.toLowerCase()}`, label: `Referral ${status.toLowerCase()}`, description: `Prepare once when a referral is ${status.toLowerCase()}.`, fields: { trigger: 'current', timing: 'days', after: 'referral', referralStatus: status, days: 1, repeat: false } })),
  { id: 'level-change', label: 'Program or care level changed', description: 'Prepare once after each recorded program or care level change.', fields: { trigger: 'event', timing: 'days', eventType: 'level-change', delayDays: 0, repeat: false } },
];

export const presetForBundle = bundle => MVP_SCHEDULE_PRESETS.find(preset =>
  Object.entries(preset.fields).every(([key, value]) => bundle[key] === value));
