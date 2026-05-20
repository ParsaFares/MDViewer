/**
 * search.js — Full-text search across loaded markdown files
 *
 * Provides a debounced search triggered by the `#search-input` element.
 * Results are rendered inside a `.search-results` container with matched
 * text highlighted via `<mark>` tags.  Clicking a result invokes a
 * callback with the file path and matching line index so the host app
 * can navigate to the right spot.
 */

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const DEBOUNCE_MS = 300;
const MAX_MATCHES_PER_FILE = 5;
const MAX_TOTAL_RESULTS = 50;
const MIN_QUERY_LENGTH = 2;

/* ------------------------------------------------------------------ */
/*  Module-level state                                                 */
/* ------------------------------------------------------------------ */

/** @type {Map<string, string>|null} */
let cachedFilesMap = null;

/** @type {((path: string, lineIndex: number) => void)|null} */
let resultClickCallback = null;

/** @type {HTMLInputElement|null} */
let searchInput = null;

/** @type {HTMLElement|null} */
let resultsContainer = null;

/** Debounced handler reference (so we can remove it later) */
let debouncedHandler = null;

/** Bound references for cleanup */
let boundKeydownHandler = null;
let boundOutsideClickHandler = null;

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

/**
 * Wire up the search UI.
 *
 * @param {Map<string, string>} filesMap  — path → content map
 * @param {(path: string, lineIndex: number) => void} onResultClick
 */
export function initSearch(filesMap, onResultClick) {
  cachedFilesMap = filesMap;
  resultClickCallback = onResultClick;

  searchInput = document.getElementById('search-input');
  resultsContainer = document.querySelector('.search-results');

  if (!searchInput || !resultsContainer) {
    console.warn('[search] #search-input or .search-results element not found.');
    return;
  }

  /* Debounced input handler */
  debouncedHandler = debounce(handleSearchInput, DEBOUNCE_MS);
  searchInput.addEventListener('input', debouncedHandler);

  /* Escape key closes results */
  boundKeydownHandler = handleKeydown;
  document.addEventListener('keydown', boundKeydownHandler);

  /* Click outside closes results */
  boundOutsideClickHandler = handleOutsideClick;
  document.addEventListener('mousedown', boundOutsideClickHandler);
}

/**
 * Search all files for `query` and return structured results.
 *
 * @param {string} query
 * @param {Map<string, string>} filesMap
 * @returns {SearchResult[]}
 *
 * SearchResult:
 *   { path: string, fileName: string,
 *     matches: { line: string, lineIndex: number,
 *                matchStart: number, matchEnd: number }[] }
 */
export function searchFiles(query, filesMap) {
  const results = [];
  const lowerQuery = query.toLowerCase();
  let totalMatches = 0;

  for (const [path, content] of filesMap) {
    if (totalMatches >= MAX_TOTAL_RESULTS) break;

    const lines = content.split('\n');
    const fileMatches = [];

    for (let i = 0; i < lines.length; i++) {
      if (fileMatches.length >= MAX_MATCHES_PER_FILE) break;
      if (totalMatches >= MAX_TOTAL_RESULTS) break;

      const lowerLine = lines[i].toLowerCase();
      const matchStart = lowerLine.indexOf(lowerQuery);

      if (matchStart !== -1) {
        fileMatches.push({
          line: lines[i],
          lineIndex: i,
          matchStart,
          matchEnd: matchStart + query.length,
        });
        totalMatches++;
      }
    }

    if (fileMatches.length > 0) {
      results.push({
        path,
        fileName: extractFileName(path),
        matches: fileMatches,
      });
    }
  }

  return results;
}

/**
 * Render search results into the `.search-results` panel.
 *
 * @param {SearchResult[]} results
 */
export function showSearchResults(results) {
  if (!resultsContainer) return;

  /* Clear previous results */
  resultsContainer.innerHTML = '';

  if (results.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'search-empty';
    empty.textContent = 'No results found';
    resultsContainer.appendChild(empty);
    resultsContainer.removeAttribute('hidden');
    resultsContainer.classList.add('is-visible');
    return;
  }

  const fragment = document.createDocumentFragment();

  for (const result of results) {
    /* File header */
    const fileItem = document.createElement('div');
    fileItem.className = 'search-result-file';

    const fileHeader = document.createElement('div');
    fileHeader.className = 'search-result-header';

    /* File icon (simple SVG document icon) */
    const icon = document.createElement('span');
    icon.className = 'search-result-icon';
    icon.innerHTML =
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>' +
      '<polyline points="14 2 14 8 20 8"/>' +
      '<line x1="16" y1="13" x2="8" y2="13"/>' +
      '<line x1="16" y1="17" x2="8" y2="17"/>' +
      '<polyline points="10 9 9 9 8 9"/>' +
      '</svg>';

    const nameSpan = document.createElement('span');
    nameSpan.className = 'search-result-name';
    nameSpan.textContent = result.fileName;

    const pathSpan = document.createElement('span');
    pathSpan.className = 'search-result-path';
    pathSpan.textContent = result.path;

    fileHeader.appendChild(icon);
    fileHeader.appendChild(nameSpan);
    fileHeader.appendChild(pathSpan);
    fileItem.appendChild(fileHeader);

    /* Individual line matches */
    for (const match of result.matches) {
      const matchEl = document.createElement('div');
      matchEl.className = 'search-result-match';

      /* Build highlighted line */
      const lineText = match.line;
      const before = lineText.slice(0, match.matchStart);
      const highlighted = lineText.slice(match.matchStart, match.matchEnd);
      const after = lineText.slice(match.matchEnd);

      const lineEl = document.createElement('span');
      lineEl.className = 'search-result-line';

      /* Line number badge */
      const lineNum = document.createElement('span');
      lineNum.className = 'search-result-linenum';
      lineNum.textContent = String(match.lineIndex + 1);
      lineEl.appendChild(lineNum);

      /* Text with highlight */
      lineEl.appendChild(document.createTextNode(before));

      const mark = document.createElement('mark');
      mark.textContent = highlighted;
      lineEl.appendChild(mark);

      lineEl.appendChild(document.createTextNode(after));

      matchEl.appendChild(lineEl);

      /* Click navigates to the matched line */
      matchEl.addEventListener('click', () => {
        if (resultClickCallback) {
          resultClickCallback(result.path, match.lineIndex);
        }
        hideSearchResults();
      });

      fileItem.appendChild(matchEl);
    }

    fragment.appendChild(fileItem);
  }

  resultsContainer.appendChild(fragment);
  resultsContainer.removeAttribute('hidden');
  resultsContainer.classList.add('is-visible');
}

/**
 * Hide the results panel and clear its content.
 */
export function hideSearchResults() {
  if (!resultsContainer) return;
  resultsContainer.classList.remove('is-visible');
  resultsContainer.setAttribute('hidden', '');
  resultsContainer.innerHTML = '';
}

/**
 * Remove all event listeners added by `initSearch`.
 */
export function destroySearch() {
  if (searchInput && debouncedHandler) {
    searchInput.removeEventListener('input', debouncedHandler);
  }
  if (boundKeydownHandler) {
    document.removeEventListener('keydown', boundKeydownHandler);
  }
  if (boundOutsideClickHandler) {
    document.removeEventListener('mousedown', boundOutsideClickHandler);
  }

  /* Reset module state */
  cachedFilesMap = null;
  resultClickCallback = null;
  searchInput = null;
  resultsContainer = null;
  debouncedHandler = null;
  boundKeydownHandler = null;
  boundOutsideClickHandler = null;
}

/* ------------------------------------------------------------------ */
/*  Internal handlers                                                  */
/* ------------------------------------------------------------------ */

/**
 * Respond to (debounced) input events on the search field.
 */
function handleSearchInput() {
  if (!searchInput || !cachedFilesMap) return;

  const query = searchInput.value.trim();

  if (query.length < MIN_QUERY_LENGTH) {
    hideSearchResults();
    return;
  }

  const results = searchFiles(query, cachedFilesMap);
  showSearchResults(results);
}

/**
 * Close the results panel when the Escape key is pressed.
 * @param {KeyboardEvent} e
 */
function handleKeydown(e) {
  if (e.key === 'Escape') {
    hideSearchResults();
    /* Optionally clear the input as well for a clean UX */
    if (searchInput) {
      searchInput.value = '';
    }
  }
}

/**
 * Close the results panel when clicking outside both the input and
 * the results container.
 * @param {MouseEvent} e
 */
function handleOutsideClick(e) {
  if (!resultsContainer || !searchInput) return;

  const target = /** @type {Node} */ (e.target);
  const insideResults = resultsContainer.contains(target);
  const insideInput = searchInput.contains(target);

  if (!insideResults && !insideInput) {
    hideSearchResults();
  }
}

/* ------------------------------------------------------------------ */
/*  Utilities                                                          */
/* ------------------------------------------------------------------ */

/**
 * Classic debounce — returns a wrapper that delays invoking `fn` until
 * `delay` ms have elapsed since the last call.
 *
 * @param {Function} fn
 * @param {number} delay
 * @returns {Function}
 */
function debounce(fn, delay) {
  let timerId = null;

  return function debouncedFn(...args) {
    if (timerId !== null) {
      clearTimeout(timerId);
    }
    timerId = setTimeout(() => {
      timerId = null;
      fn.apply(this, args);
    }, delay);
  };
}

/**
 * Extract the file name from a path string.
 * e.g. "docs/guides/README.md" → "README.md"
 *
 * @param {string} path
 * @returns {string}
 */
function extractFileName(path) {
  const segments = path.split('/');
  return segments[segments.length - 1];
}
