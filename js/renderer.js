/**
 * renderer.js — Markdown-to-HTML rendering module for MDViewer.
 *
 * Relies on the following globals loaded via CDN <script> tags:
 *   - marked        (markdown parser)
 *   - hljs          (highlight.js for syntax highlighting)
 *   - DOMPurify     (HTML sanitiser)
 *   - mermaid       (diagram renderer)
 */

/* ------------------------------------------------------------------ */
/*  Inline SVG icon strings                                           */
/* ------------------------------------------------------------------ */

const ICON_LINK = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`;

const ICON_COPY = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;

const ICON_CHECK = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;

/* ------------------------------------------------------------------ */
/*  Module-level state                                                */
/* ------------------------------------------------------------------ */

/** Temporary array used during a single renderMarkdown() call. */
let _collectedHeadings = [];

/** Reference to the basePath passed into the current render call. */
let _currentBasePath = '';

/** Reference to the resolved marked library. */
let _markedLib = null;

/** Reference to the onLinkClick callback for the current render call. */
let _currentOnLinkClick = null;

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

/**
 * Convert heading text into a URL-friendly slug.
 * Lowercase, spaces → hyphens, strip everything that isn't alphanumeric or hyphen.
 */
function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]/g, '')
    .replace(/--+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Try to highlight code with hljs.
 * Returns the highlighted HTML string.
 */
function highlightCode(code, lang) {
  if (lang && hljs.getLanguage(lang)) {
    return hljs.highlight(code, { language: lang }).value;
  }
  return hljs.highlightAuto(code).value;
}

/**
 * Show a brief toast notification near the bottom of the viewport.
 */
function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);

  /* Force a reflow so the initial state is rendered before adding the class */
  toast.offsetHeight; // eslint-disable-line no-unused-expressions

  toast.classList.add('toast--visible');

  setTimeout(() => {
    toast.classList.remove('toast--visible');
    /* Wait for the fade-out transition to finish before removing the node */
    toast.addEventListener('transitionend', () => toast.remove(), { once: true });
    /* Safety net in case transitionend never fires */
    setTimeout(() => toast.remove(), 400);
  }, 2000);
}

/* ------------------------------------------------------------------ */
/*  Style injection (toast + code-block styles)                       */
/* ------------------------------------------------------------------ */

let _stylesInjected = false;

function injectRendererStyles() {
  if (_stylesInjected) return;
  _stylesInjected = true;

  const style = document.createElement('style');
  style.textContent = `
/* ---- Toast notification ---- */
.toast {
  position: fixed;
  inset-block-end: 2rem;
  inset-inline-start: 50%;
  transform: translateX(-50%) translateY(1rem);
  background: var(--color-surface-elevated, #1a1a2e);
  color: var(--color-text, #e2e8f0);
  font-family: var(--font-sans);
  font-size: 0.85rem;
  padding: 0.6rem 1.2rem;
  border-radius: var(--radius-md, 8px);
  box-shadow: var(--shadow-lg, 0 8px 32px rgba(0,0,0,0.3));
  border: 1px solid var(--glass-border, rgba(255,255,255,0.06));
  opacity: 0;
  pointer-events: none;
  transition: opacity var(--transition-fast, 150ms) ease,
              transform var(--transition-fast, 150ms) ease;
  z-index: 10000;
}
.toast--visible {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
}

/* ---- Code blocks ---- */
.code-block {
  position: relative;
  margin-block: 1rem;
  border-radius: var(--radius-md, 8px);
  overflow: hidden;
  background: var(--color-code-bg, #1e1e2e);
  border: 1px solid var(--color-border, rgba(255,255,255,0.08));
}
.code-block__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.4rem 0.75rem;
  background: rgba(255, 255, 255, 0.03);
  border-block-end: 1px solid var(--color-border, rgba(255,255,255,0.08));
}
.code-block__lang {
  font-family: var(--font-mono, monospace);
  font-size: 0.75rem;
  color: var(--color-text-secondary, #94a3b8);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  user-select: none;
}
.code-block__copy {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  color: var(--color-text-secondary, #94a3b8);
  cursor: pointer;
  padding: 0.25rem;
  border-radius: var(--radius-sm, 4px);
  transition: color var(--transition-fast, 150ms) ease,
              background var(--transition-fast, 150ms) ease;
}
.code-block__copy:hover {
  color: var(--color-text, #e2e8f0);
  background: rgba(255, 255, 255, 0.06);
}
.code-block__copy:focus-visible {
  outline: 2px solid var(--color-primary, #8b5cf6);
  outline-offset: 2px;
}
.code-block pre {
  margin: 0;
  padding: 1rem;
  overflow-x: auto;
}
.code-block pre code {
  font-family: var(--font-mono, monospace);
  font-size: 0.875rem;
  line-height: 1.6;
  tab-size: 2;
}

/* ---- Heading anchor links ---- */
.heading-anchor {
  position: absolute;
  inset-inline-start: -1.5em;
  color: var(--color-text-secondary, #94a3b8);
  opacity: 0;
  text-decoration: none;
  transition: opacity var(--transition-fast, 150ms) ease;
  display: inline-flex;
  align-items: center;
}
h1, h2, h3, h4, h5, h6 {
  position: relative;
}
h1:hover .heading-anchor,
h2:hover .heading-anchor,
h3:hover .heading-anchor,
h4:hover .heading-anchor,
h5:hover .heading-anchor,
h6:hover .heading-anchor,
.heading-anchor:focus-visible {
  opacity: 1;
}

/* ---- Mermaid diagrams ---- */
.mermaid {
  display: flex;
  justify-content: center;
  margin-block: 1.5rem;
  padding: 1rem;
  background: var(--color-code-bg, #1e1e2e);
  border-radius: var(--radius-md, 8px);
  border: 1px solid var(--color-border, rgba(255,255,255,0.08));
  overflow-x: auto;
}
`;
  document.head.appendChild(style);
}

/* ------------------------------------------------------------------ */
/*  Public API                                                        */
/* ------------------------------------------------------------------ */

/**
 * Initialise the renderer: configure marked, highlight.js, and mermaid.
 * Call once at application startup.
 */
export function initRenderer() {
  injectRendererStyles();

  /* ---- Resolve the marked global ---- */
  /* When loaded via UMD <script>, marked v12+ exposes everything directly
     on window.marked (parse, Renderer, use, etc.). Guard in case the
     global wraps another level (some bundler quirks). */
  const _marked = (typeof marked !== 'undefined' && typeof marked.parse === 'function')
    ? marked
    : (typeof marked !== 'undefined' && typeof marked.marked === 'object')
      ? marked.marked
      : null;

  if (!_marked) {
    console.error('[MDViewer] marked library not found. Markdown rendering disabled.');
    return;
  }

  /* Store at module level for use by renderMarkdown() */
  _markedLib = _marked;

  /* ---- Custom marked renderer ---- */
  const renderer = new _markedLib.Renderer();

  renderer.heading = function ({ text, depth }) {
    const id = slugify(text);

    /* Collect headings for ToC generation */
    _collectedHeadings.push({ level: depth, text, id });

    return `<h${depth} id="${id}"><a class="heading-anchor" href="#${id}" aria-label="Link to ${text}">${ICON_LINK}</a>${text}</h${depth}>`;
  };

  renderer.code = function ({ text, lang }) {
    /* Mermaid diagrams are rendered in a later pass */
    if (lang === 'mermaid') {
      return `<div class="mermaid">${text}</div>`;
    }

    const highlighted = highlightCode(text, lang);
    const langLabel = lang || 'text';

    return (
      `<div class="code-block">` +
        `<div class="code-block__header">` +
          `<span class="code-block__lang">${langLabel}</span>` +
          `<button class="code-block__copy" title="Copy code" aria-label="Copy code">${ICON_COPY}</button>` +
        `</div>` +
        `<pre><code class="hljs">${highlighted}</code></pre>` +
      `</div>`
    );
  };

  renderer.link = function ({ href, title, tokens }) {
    const linkText = this.parser.parseInline(tokens);
    const titleAttr = title ? ` title="${title}"` : '';
    const isMarkdown = /\.(md|markdown)$/i.test(href);

    if (isMarkdown) {
      return `<a href="${href}" data-md-link="${href}"${titleAttr}>${linkText}</a>`;
    }
    return `<a href="${href}"${titleAttr} target="_blank" rel="noopener noreferrer">${linkText}</a>`;
  };

  renderer.image = function ({ href, title, text }) {
    let resolved = href;

    /* Resolve relative paths against the current file's directory */
    if (!/^https?:\/\//i.test(href) && _currentBasePath) {
      resolved = _currentBasePath.replace(/\/$/, '') + '/' + href;
    }

    const titleAttr = title ? ` title="${title}"` : '';
    return `<img src="${resolved}" alt="${text}"${titleAttr} loading="lazy">`;
  };

  /* ---- Apply renderer via marked.use() (modern API, v12+) ---- */
  _markedLib.use({
    renderer,
    breaks: true,
    gfm: true,
  });

  /* ---- mermaid options ---- */
  if (typeof mermaid !== 'undefined') {
    const currentTheme =
      document.documentElement.dataset.theme === 'dark' ? 'dark' : 'default';

    mermaid.initialize({
      startOnLoad: false,
      theme: currentTheme,
      securityLevel: 'loose',
    });
  }
}

/**
 * Render a markdown string to sanitised HTML.
 *
 * @param {string}   content      Raw markdown text.
 * @param {string}   basePath     Directory of the current file (for relative asset resolution).
 * @param {function} onLinkClick  Callback invoked with (filePath) when a .md link is clicked.
 * @returns {{ html: string, headings: Array<{ level: number, text: string, id: string }> }}
 */
export function renderMarkdown(content, basePath, onLinkClick) {
  /* Store render-scoped state for the custom renderer functions */
  _collectedHeadings = [];
  _currentBasePath = basePath || '';
  _currentOnLinkClick = onLinkClick || null;

  /* Parse markdown → HTML */
  const rawHtml = _markedLib.parse(content);

  /* Sanitise the output while preserving custom attributes and SVG icons */
  const html = DOMPurify.sanitize(rawHtml, {
    ADD_ATTR: ['data-md-link', 'viewBox', 'xmlns', 'stroke', 'fill', 'stroke-width',
               'stroke-linecap', 'stroke-linejoin', 'd', 'points', 'cx', 'cy', 'r',
               'x', 'y', 'x1', 'x2', 'y1', 'y2', 'rx', 'ry', 'width', 'height',
               'font-size', 'font-weight', 'text-anchor', 'font-family', 'loading',
               'target', 'rel', 'aria-label'],
    ADD_TAGS: ['svg', 'path', 'use', 'line', 'polyline', 'circle', 'rect', 'text',
               'g', 'defs', 'linearGradient', 'stop', 'polygon', 'ellipse'],
  });

  const headings = [..._collectedHeadings];

  /* Reset transient state */
  _collectedHeadings = [];
  _currentBasePath = '';

  return { html, headings };
}

/**
 * Process mermaid diagrams that are already in the DOM.
 * Call after inserting the rendered HTML into the document.
 */
export async function processMermaid() {
  const nodes = document.querySelectorAll('.mermaid');
  if (nodes.length === 0) return;

  try {
    await mermaid.run({ nodes });
  } catch (err) {
    console.error('[MDViewer] Mermaid rendering failed:', err);
  }
}

/**
 * Wire up copy-to-clipboard buttons on every code block.
 * Call after inserting the rendered HTML into the document.
 */
export function setupCopyButtons() {
  const buttons = document.querySelectorAll('.code-block__copy');

  buttons.forEach((btn) => {
    /* Avoid duplicate listeners on re-renders */
    if (btn.dataset.copyBound) return;
    btn.dataset.copyBound = 'true';

    btn.addEventListener('click', async () => {
      const codeEl = btn
        .closest('.code-block')
        ?.querySelector('pre code');

      if (!codeEl) return;

      try {
        await navigator.clipboard.writeText(codeEl.textContent);

        /* Swap icon to checkmark */
        const originalHTML = btn.innerHTML;
        btn.innerHTML = ICON_CHECK;
        btn.disabled = true;

        showToast('Copied to clipboard!');

        setTimeout(() => {
          btn.innerHTML = originalHTML;
          btn.disabled = false;
        }, 1500);
      } catch (err) {
        console.error('[MDViewer] Clipboard write failed:', err);
        showToast('Failed to copy');
      }
    });
  });
}

/**
 * Attach click-delegation for inter-file markdown links.
 * Call once on the content container element.
 *
 * @param {HTMLElement} containerEl  The element that holds rendered markdown HTML.
 * @param {function}    onLinkClick  Callback invoked with the md file path.
 */
export function attachLinkInterception(containerEl, onLinkClick) {
  containerEl.addEventListener('click', (e) => {
    const anchor = e.target.closest('a[data-md-link]');
    if (!anchor) return;

    e.preventDefault();
    const filePath = anchor.getAttribute('data-md-link');
    if (filePath && onLinkClick) {
      onLinkClick(filePath);
    }
  });
}
