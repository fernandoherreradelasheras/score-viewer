// UI-related types and constants

export const DEFAULT_SCALE = 50;
export const MIN_SCALE = 30;
export const MAX_SCALE = 120;

// How long an element followed through a link between the score and the facsimile stays
// framed.
export const LINK_HIGHLIGHT_MS = 2000;

export const SUPPORTED_LANGUAGES = [{ key: 'en', label: 'English' }, { key: 'es', label: 'Español' }];
export const LANGUAGE_SESSION_STORAGE_KEY = 'i18nextLng';

export enum Transition {
    FADE_OUT,
    FADE_IN,
}
