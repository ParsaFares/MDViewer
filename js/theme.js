/**
 * theme.js — Dark/light theme and LTR/RTL direction management
 *
 * Persists the user's choices in localStorage so they survive reloads.
 * Falls back to the OS-level color-scheme preference for the initial
 * theme and defaults to LTR for direction.
 */

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const THEME_KEY = 'md-viewer-theme';
const DIR_KEY = 'md-viewer-dir';

const THEME_DARK = 'dark';
const THEME_LIGHT = 'light';

const DIR_LTR = 'ltr';
const DIR_RTL = 'rtl';

/* ------------------------------------------------------------------ */
/*  Module-level state                                                 */
/* ------------------------------------------------------------------ */

/** @type {'dark'|'light'} */
let currentTheme = THEME_DARK;

/** @type {'ltr'|'rtl'} */
let currentDirection = DIR_LTR;

/* ------------------------------------------------------------------ */
/*  Theme                                                              */
/* ------------------------------------------------------------------ */

/**
 * Initialize the theme from persisted preference or the OS setting.
 *
 * Reads `localStorage` first; if nothing is stored, checks the
 * `prefers-color-scheme` media query. Applies the result to
 * `document.documentElement.dataset.theme` so CSS can react via
 * `[data-theme="dark"]` / `[data-theme="light"]` selectors.
 */
export function initTheme() {
  const stored = localStorage.getItem(THEME_KEY);

  if (stored === THEME_DARK || stored === THEME_LIGHT) {
    currentTheme = stored;
  } else {
    /* No stored preference — honour the OS setting */
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    currentTheme = prefersDark ? THEME_DARK : THEME_LIGHT;
  }

  applyTheme();
}

/**
 * Toggle between dark and light themes.
 * Persists the new value and returns it.
 *
 * @returns {'dark'|'light'} The new active theme.
 */
export function toggleTheme() {
  currentTheme = currentTheme === THEME_DARK ? THEME_LIGHT : THEME_DARK;
  localStorage.setItem(THEME_KEY, currentTheme);
  applyTheme();
  return currentTheme;
}

/**
 * Get the current theme without side-effects.
 * @returns {'dark'|'light'}
 */
export function getTheme() {
  return currentTheme;
}

/* ------------------------------------------------------------------ */
/*  Direction                                                          */
/* ------------------------------------------------------------------ */

/**
 * Initialize the text direction from persisted preference or default LTR.
 *
 * Sets `document.documentElement.dir` so every element inherits the
 * correct writing direction and CSS logical properties resolve properly.
 */
export function initDirection() {
  const stored = localStorage.getItem(DIR_KEY);

  if (stored === DIR_LTR || stored === DIR_RTL) {
    currentDirection = stored;
  } else {
    currentDirection = DIR_LTR;
  }

  applyDirection();
}

/**
 * Toggle between LTR and RTL directions.
 * Persists the new value and returns it.
 *
 * @returns {'ltr'|'rtl'} The new active direction.
 */
export function toggleDirection() {
  currentDirection = currentDirection === DIR_LTR ? DIR_RTL : DIR_LTR;
  localStorage.setItem(DIR_KEY, currentDirection);
  applyDirection();
  return currentDirection;
}

/**
 * Get the current direction without side-effects.
 * @returns {'ltr'|'rtl'}
 */
export function getDirection() {
  return currentDirection;
}

/* ------------------------------------------------------------------ */
/*  Internal helpers                                                   */
/* ------------------------------------------------------------------ */

/**
 * Apply the current theme to the DOM root element.
 */
function applyTheme() {
  document.documentElement.dataset.theme = currentTheme;
}

/**
 * Apply the current direction to the DOM root element.
 */
function applyDirection() {
  document.documentElement.dir = currentDirection;
}
