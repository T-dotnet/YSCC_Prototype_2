import { COLLECTION_METHOD_OPTIONS } from './terminology.js';

export const collectionMethodValues = COLLECTION_METHOD_OPTIONS.map(([value]) => value);

export function allowedCollectionMethods(bundle, available = collectionMethodValues) {
  const choices = available.filter(value => collectionMethodValues.includes(value));
  if (!Array.isArray(bundle?.allowedCollectionMethods)) return choices;
  return choices.filter(value => bundle.allowedCollectionMethods.includes(value));
}

export function allowedCollectionMethodsError(bundle, available = collectionMethodValues) {
  const selected = bundle?.allowedCollectionMethods;
  if (selected == null) return null;
  if (!Array.isArray(selected) || !selected.length || new Set(selected).size !== selected.length ||
      selected.some(value => !available.includes(value)))
    return 'Choose Any or at least one allowed collection method.';
  return null;
}

export function collectionMethodSummary(bundle, available = collectionMethodValues) {
  if (!Array.isArray(bundle?.allowedCollectionMethods)) return 'Any';
  return allowedCollectionMethods(bundle, available).join(', ');
}
