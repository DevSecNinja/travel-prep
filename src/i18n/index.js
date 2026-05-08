import { en } from './en.js';
import { nl } from './nl.js';

export const DEFAULT_LANGUAGE = 'en';
export const LANGUAGES = { en, nl };
export const LANGUAGE_OPTIONS = Object.values(LANGUAGES).map(({ code, name }) => ({ code, name }));

export function resolveLanguage(language) {
  return Object.hasOwn(LANGUAGES, language) ? language : DEFAULT_LANGUAGE;
}

export function translate(language, key, vars = {}) {
  const lang = resolveLanguage(language);
  const value = LANGUAGES[lang].ui[key] ?? LANGUAGES[DEFAULT_LANGUAGE].ui[key] ?? key;
  return value.replace(/\{(\w+)\}/g, (_, name) => String(vars[name] ?? ''));
}

export function categoryLabel(language, category) {
  const lang = resolveLanguage(language);
  return LANGUAGES[lang].categories[category] ?? LANGUAGES[DEFAULT_LANGUAGE].categories[category] ?? category;
}

export function itemLabel(language, name) {
  const lang = resolveLanguage(language);
  return LANGUAGES[lang].items[name] ?? LANGUAGES[DEFAULT_LANGUAGE].items[name] ?? name;
}
