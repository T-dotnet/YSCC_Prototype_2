// Searchable display names for ISO 639-1 languages. Entries outside this set
// can still be recorded through the picker's custom-language option.
const displayNames = new Intl.DisplayNames(['en-AU'], { type: 'language' });
const codes = Array.from({ length: 26 * 26 }, (_, index) =>
  String.fromCharCode(97 + Math.floor(index / 26), 97 + index % 26));

export const LANGUAGE_OPTIONS = [
  { code: 'none', name: 'None, no language other than English spoken at home' },
  ...codes.map(code => ({ code, name: displayNames.of(code) }))
    .filter(({ code, name }) => name !== code),
].sort((a, b) => a.name.localeCompare(b.name, 'en-AU'));
