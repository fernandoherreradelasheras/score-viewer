// UI-related types and constants

export const DEFAULT_SCALE = 50;
export const MIN_SCALE = 30;
export const MAX_SCALE = 120;

export const MAIN_SCORE_SVG_ID = "verovio-svg-score";

export const SUPPORTED_LANGUAGES = [{ key: 'en', label: 'English' }, { key: 'es', label: 'Español' }];
export const LANGUAGE_SESSION_STORAGE_KEY = 'i18nextLng';

export enum Transition {
    FADE_OUT,
    FADE_IN,
}
