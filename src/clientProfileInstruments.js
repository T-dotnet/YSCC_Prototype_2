import { ATSI_OPTIONS, EDUCATION_OPTIONS, GENDER_OPTIONS, REFERRAL_SOURCES, REGISTERED_CENTRE_STATES, SEXUALITY_OPTIONS } from './batch1Registration.js';

const text = (id, title, optional = true) => ({ id, title, responseType: 'text', options: optional ? ['Not recorded'] : [] });
const date = (id, title, optional = true) => ({ id, title, responseType: 'date', options: optional ? ['Not recorded'] : [] });
const choice = (id, title, options) => ({ id, title, options: [...options, 'Not recorded'] });
const instrument = (name, id, description, questions) => ({
  name, version: `Client profile · ${name} v1.0`, description, respondents: ['Person'],
  clientProfileSection: id, sections: [{ id, title: name }],
  questions: questions.map(question => ({ ...question, section: id })),
});

// Profile fields remain in the person/episode record. These instruments capture
// the review of each heading; submitted answers update those same fields.
export const CLIENT_PROFILE_INSTRUMENTS = [
  instrument('Young person', 'young-person', 'Review the young person details in Profile information.', [
    choice('clientGender', 'Gender', GENDER_OPTIONS), text('clientPostcode', 'Postcode'),
    choice('clientAtsiStatus', 'Aboriginal and/or Torres Strait Islander', ATSI_OPTIONS),
    text('clientLanguageHome', 'Language spoken at home'),
    choice('clientSexuality', 'Sexual orientation', SEXUALITY_OPTIONS),
    text('clientCountryOfBirth', 'Country of birth'),
    text('clientEthnicity', 'Main cultural background other than Australian or Aboriginal and Torres Strait Islander'),
    choice('clientEducationLevel', 'Highest education level at episode', EDUCATION_OPTIONS),
  ]),
  instrument('Care episode', 'care-episode', 'Review the referral and service commencement details for this care episode. Record ID, episode number, status, program stream and age are calculated from the record.', [
    date('referralDate', 'Referral date'), choice('source', 'Referral source', REFERRAL_SOURCES),
    date('commencementDate', 'Service commencement date'),
    date('commencementDateUhr', 'Clinician-recorded UHR commencement date'),
    date('commencementDateFep', 'Clinician-recorded FEP commencement date'),
  ]),
  instrument('Registered centre', 'registered-centre', 'Review the centre associated with this record.', [
    text('registeredCentreName', 'Centre name'),
    choice('registeredCentreState', 'State or territory', REGISTERED_CENTRE_STATES),
    text('registeredCentrePostcode', 'Centre postcode'),
  ]),
];
