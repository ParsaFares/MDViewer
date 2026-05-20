/**
 * sidebar.js — File-tree and Table-of-Contents UI module for MDViewer.
 *
 * All DOM helpers are self-contained; the module injects its own CSS the
 * first time any public render function is called.
 */

/* ------------------------------------------------------------------ */
/*  Inline SVG icon strings                                           */
/* ------------------------------------------------------------------ */

const ICON_FOLDER_CLOSED = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>`;

const ICON_FOLDER_OPEN = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2v1"/><path d="M2 10l3.17 7.38A2 2 0 0 0 7.02 19h12.3a2 2 0 0 0 1.85-1.26L24 10H2z"/></svg>`;

const ICON_FILE = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`;

const ICON_CHEVRON = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="tree-chevron"><polyline points="9 18 15 12 9 6"/></svg>`;

/* ------------------------------------------------------------------ */
/*  Module-level state                                                */
/* ------------------------------------------------------------------ */

/** IntersectionObserver used by scroll-spy. */
let _scrollSpyObserver = null;

/** Whether component styles have been injected. */
let _stylesInjected = false;

/* ------------------------------------------------------------------ */
/*  Style injection                                                   */
/* ------------------------------------------------------------------ */

/**
 * Injects sidebar/tree/toc specific styles into <head>.
 * Called automatically on first render — no manual call needed.
 */
function injectSidebarStyles() {
  if (_stylesInjected) return;
  _stylesInjected = true;

  const style = document.createElement('style');
  style.textContent = `
/* ========== File tree ========== */

.tree-item {
  display: flex;
  flex-direction: column;
}

.tree-item--hidden {
  display: none !important;
}

/* ---- Toggle button (directory row) ---- */
.tree-item__toggle {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  width: 100%;
  padding-block: 0.4rem;
  padding-inline-end: 0.5rem;
  padding-inline-start: calc(0.75rem + var(--depth, 0) * 1.25rem);
  background: none;
  border: none;
  border-radius: var(--radius-sm, 4px);
  color: var(--color-text, #e2e8f0);
  font-family: var(--font-sans);
  font-size: 0.8125rem;
  cursor: pointer;
  text-align: start;
  transition: background var(--transition-fast, 150ms) ease;
  user-select: none;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.tree-item__toggle:hover {
  background: rgba(255, 255, 255, 0.05);
}
.tree-item__toggle:focus-visible {
  outline: 2px solid var(--color-primary, #8b5cf6);
  outline-offset: -2px;
}

/* Chevron rotation */
.tree-item__toggle .tree-chevron {
  flex-shrink: 0;
  transition: transform var(--transition-fast, 150ms) ease;
}
.tree-item--expanded > .tree-item__toggle .tree-chevron {
  transform: rotate(90deg);
}

/* Folder icon swap */
.tree-item__toggle .icon-folder-open  { display: none; }
.tree-item__toggle .icon-folder-closed { display: inline-flex; }
.tree-item--expanded > .tree-item__toggle .icon-folder-open  { display: inline-flex; }
.tree-item--expanded > .tree-item__toggle .icon-folder-closed { display: none; }

/* ---- Children container (collapsible) ---- */
.tree-item__children {
  display: grid;
  grid-template-rows: 0fr;
  overflow: hidden;
  transition: grid-template-rows var(--transition-normal, 250ms) ease;
}
.tree-item--expanded > .tree-item__children {
  grid-template-rows: 1fr;
}
.tree-item__children > .tree-item__children-inner {
  min-height: 0;
}

/* ---- File button ---- */
.tree-item--file {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  width: 100%;
  padding-block: 0.4rem;
  padding-inline-end: 0.5rem;
  padding-inline-start: calc(0.75rem + var(--depth, 0) * 1.25rem);
  background: none;
  border: none;
  border-radius: var(--radius-sm, 4px);
  color: var(--color-text-secondary, #94a3b8);
  font-family: var(--font-sans);
  font-size: 0.8125rem;
  cursor: pointer;
  text-align: start;
  transition: background var(--transition-fast, 150ms) ease,
              color var(--transition-fast, 150ms) ease;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.tree-item--file:hover {
  background: rgba(255, 255, 255, 0.05);
  color: var(--color-text, #e2e8f0);
}
.tree-item--file:focus-visible {
  outline: 2px solid var(--color-primary, #8b5cf6);
  outline-offset: -2px;
}

/* Active file highlight */
.tree-item--active {
  background: rgba(139, 92, 246, 0.12) !important;
  color: var(--color-primary, #8b5cf6) !important;
}

/* Icon containers (keep alignment consistent) */
.tree-item__toggle svg,
.tree-item--file svg {
  flex-shrink: 0;
  opacity: 0.8;
}
.tree-item__name {
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ========== Table of Contents ========== */

.toc-nav ul {
  list-style: none;
  margin: 0;
  padding: 0;
}

.toc-item {
  margin: 0;
}

.toc-item a {
  display: block;
  padding: 0.3rem 0.75rem;
  border-radius: var(--radius-sm, 4px);
  color: var(--color-text-secondary, #94a3b8);
  text-decoration: none;
  font-size: 0.8125rem;
  font-family: var(--font-sans);
  line-height: 1.4;
  transition: color var(--transition-fast, 150ms) ease,
              background var(--transition-fast, 150ms) ease;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.toc-item a:hover {
  color: var(--color-text, #e2e8f0);
  background: rgba(255, 255, 255, 0.04);
}

.toc-item a:focus-visible {
  outline: 2px solid var(--color-primary, #8b5cf6);
  outline-offset: -2px;
}

.toc-item--active > a {
  color: var(--color-primary, #8b5cf6);
  background: rgba(139, 92, 246, 0.08);
  border-inline-start: 2px solid var(--color-primary, #8b5cf6);
}

/* Indentation per heading level */
.toc-item--level-1 a { padding-inline-start: 0.75rem; }
.toc-item--level-2 a { padding-inline-start: 1.5rem; }
.toc-item--level-3 a { padding-inline-start: 2.25rem; }
.toc-item--level-4 a { padding-inline-start: 3rem; }
.toc-item--level-5 a { padding-inline-start: 3.75rem; }
.toc-item--level-6 a { padding-inline-start: 4.5rem; }

/* ========== Sidebar / ToC collapse ========== */

.sidebar-collapsed .sidebar {
  margin-inline-start: calc(var(--sidebar-width, 280px) * -1);
}

.toc-collapsed .toc-panel {
  margin-inline-end: calc(var(--toc-width, 240px) * -1);
}
`;

  document.head.appendChild(style);
}

/* ------------------------------------------------------------------ */
/*  Internal helpers                                                  */
/* ------------------------------------------------------------------ */

/**
 * Recursively build a tree-item DOM node from the data structure.
 *
 * @param {object}   node          A node from the tree ({ name, kind, path, children }).
 * @param {function} onFileSelect  Callback(filePath) on file click.
 * @param {number}   depth         Current nesting depth (for indentation).
 * @returns {HTMLElement}
 */
function createTreeNode(node, onFileSelect, depth = 0) {
  if (node.kind === 'directory') {
    /* Container for the directory */
    const item = document.createElement('div');
    item.className = 'tree-item tree-item--directory';

    /* Toggle button */
    const toggle = document.createElement('button');
    toggle.className = 'tree-item__toggle';
    toggle.type = 'button';
    toggle.style.setProperty('--depth', depth);
    toggle.setAttribute('aria-expanded', 'false');

    toggle.innerHTML =
      ICON_CHEVRON +
      `<span class="icon-folder-closed">${ICON_FOLDER_CLOSED}</span>` +
      `<span class="icon-folder-open">${ICON_FOLDER_OPEN}</span>` +
      `<span class="tree-item__name">${escapeHtml(node.name)}</span>`;

    toggle.addEventListener('click', () => {
      const expanded = item.classList.toggle('tree-item--expanded');
      toggle.setAttribute('aria-expanded', String(expanded));
    });

    item.appendChild(toggle);

    /* Children wrapper */
    const childrenWrapper = document.createElement('div');
    childrenWrapper.className = 'tree-item__children';

    const childrenInner = document.createElement('div');
    childrenInner.className = 'tree-item__children-inner';

    if (node.children && node.children.length) {
      node.children.forEach((child) => {
        childrenInner.appendChild(createTreeNode(child, onFileSelect, depth + 1));
      });
    }

    childrenWrapper.appendChild(childrenInner);
    item.appendChild(childrenWrapper);

    return item;
  }

  /* File node */
  const btn = document.createElement('button');
  btn.className = 'tree-item tree-item--file';
  btn.type = 'button';
  btn.dataset.path = node.path;
  btn.style.setProperty('--depth', depth);

  btn.innerHTML =
    ICON_FILE +
    `<span class="tree-item__name">${escapeHtml(node.name)}</span>`;

  btn.addEventListener('click', () => {
    if (onFileSelect) onFileSelect(node.path);
  });

  return btn;
}

/**
 * Simple HTML entity escaping to prevent XSS in tree-item labels.
 */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/* ------------------------------------------------------------------ */
/*  Public API                                                        */
/* ------------------------------------------------------------------ */

/**
 * Render the file tree from the supplied data structure.
 *
 * @param {{ children: Array }} tree         Root tree node.
 * @param {function}            onFileSelect Callback(filePath) when a file is clicked.
 */
export function renderFileTree(tree, onFileSelect) {
  injectSidebarStyles();

  const container = document.querySelector('.sidebar__content');
  if (!container) {
    console.warn('[MDViewer] .sidebar__content element not found');
    return;
  }

  container.innerHTML = '';

  if (tree.children && tree.children.length) {
    tree.children.forEach((child) => {
      container.appendChild(createTreeNode(child, onFileSelect, 0));
    });
  }
}

/**
 * Highlight the active file in the tree and scroll it into view.
 *
 * @param {string} filePath  The path to mark as active.
 */
export function setActiveFile(filePath) {
  /* Remove previous active state */
  document.querySelectorAll('.tree-item--active').forEach((el) => {
    el.classList.remove('tree-item--active');
  });

  /* Find the matching file node */
  const target = document.querySelector(
    `.tree-item--file[data-path="${CSS.escape(filePath)}"]`
  );

  if (!target) return;

  target.classList.add('tree-item--active');

  /* Expand all ancestor directories so the file is visible */
  let parent = target.parentElement;
  while (parent) {
    if (parent.classList?.contains('tree-item--directory')) {
      parent.classList.add('tree-item--expanded');
      const toggleBtn = parent.querySelector(':scope > .tree-item__toggle');
      if (toggleBtn) toggleBtn.setAttribute('aria-expanded', 'true');
    }
    parent = parent.parentElement;
  }

  /* Scroll the item into the visible area of the sidebar */
  target.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

/**
 * Render the Table of Contents from an array of headings.
 *
 * @param {Array<{ level: number, text: string, id: string }>} headings
 */
export function renderToC(headings) {
  injectSidebarStyles();

  const container = document.querySelector('.toc-panel__content');
  if (!container) {
    console.warn('[MDViewer] .toc-panel__content element not found');
    return;
  }

  container.innerHTML = '';

  if (!headings || headings.length === 0) return;

  const nav = document.createElement('nav');
  nav.className = 'toc-nav';
  nav.setAttribute('aria-label', 'Table of contents');

  const ul = document.createElement('ul');

  headings.forEach((h) => {
    const li = document.createElement('li');
    li.className = `toc-item toc-item--level-${h.level}`;

    const a = document.createElement('a');
    a.href = `#${h.id}`;
    a.textContent = h.text;

    a.addEventListener('click', (e) => {
      e.preventDefault();
      const target = document.getElementById(h.id);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });

    li.appendChild(a);
    ul.appendChild(li);
  });

  nav.appendChild(ul);
  container.appendChild(nav);
}

/**
 * Set up IntersectionObserver-based scroll-spy to highlight the
 * current section in the Table of Contents.
 *
 * @param {HTMLElement} contentEl  The scrollable content container.
 */
export function initScrollSpy(contentEl) {
  /* Clean up any previous observer */
  destroyScrollSpy();

  const tocLinks = document.querySelectorAll('.toc-item');
  if (tocLinks.length === 0) return;

  const headingEls = contentEl.querySelectorAll('h1, h2, h3, h4, h5, h6');
  if (headingEls.length === 0) return;

  _scrollSpyObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;

        const id = entry.target.id;
        if (!id) return;

        /* Deactivate all ToC items */
        tocLinks.forEach((item) => item.classList.remove('toc-item--active'));

        /* Activate the matching one */
        const matchingItem = document.querySelector(
          `.toc-item a[href="#${CSS.escape(id)}"]`
        );
        if (matchingItem) {
          matchingItem.parentElement.classList.add('toc-item--active');

          /* Keep the active ToC item visible */
          matchingItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
      });
    },
    {
      root: contentEl,
      rootMargin: '-20% 0px -80% 0px',
      threshold: 0,
    }
  );

  headingEls.forEach((el) => _scrollSpyObserver.observe(el));
}

/**
 * Disconnect and dispose of the scroll-spy IntersectionObserver.
 */
export function destroyScrollSpy() {
  if (_scrollSpyObserver) {
    _scrollSpyObserver.disconnect();
    _scrollSpyObserver = null;
  }
}

/**
 * Filter the file tree by a search query.
 * Hides non-matching files and expands directories that contain matches.
 *
 * @param {string} query  Search string (case-insensitive).
 */
export function filterFileTree(query) {
  const allFiles = document.querySelectorAll('.tree-item--file');
  const allDirs = document.querySelectorAll('.tree-item--directory');
  const normalised = query.trim().toLowerCase();

  /* Empty query — show everything, collapse directories */
  if (!normalised) {
    allFiles.forEach((el) => el.classList.remove('tree-item--hidden'));
    allDirs.forEach((el) => {
      el.classList.remove('tree-item--hidden');
      /* Preserve previously expanded states — don't force-collapse */
    });
    return;
  }

  /* First pass: mark file visibility */
  allFiles.forEach((el) => {
    const name = el.querySelector('.tree-item__name')?.textContent?.toLowerCase() ?? '';
    if (name.includes(normalised)) {
      el.classList.remove('tree-item--hidden');
    } else {
      el.classList.add('tree-item--hidden');
    }
  });

  /* Second pass: directories — hide those with no visible children, expand those with matches */
  /* Process bottom-up by reversing the NodeList */
  const dirsArray = Array.from(allDirs).reverse();
  dirsArray.forEach((dir) => {
    const visibleChildren = dir.querySelectorAll(
      '.tree-item--file:not(.tree-item--hidden)'
    );

    if (visibleChildren.length > 0) {
      dir.classList.remove('tree-item--hidden');
      dir.classList.add('tree-item--expanded');
      const toggleBtn = dir.querySelector(':scope > .tree-item__toggle');
      if (toggleBtn) toggleBtn.setAttribute('aria-expanded', 'true');
    } else {
      dir.classList.add('tree-item--hidden');
    }
  });
}

/**
 * Toggle sidebar visibility by adding/removing a class on the app container.
 */
export function toggleSidebar() {
  const app = document.querySelector('.app');
  if (!app) return;

  const collapsed = app.classList.toggle('sidebar-collapsed');

  /* Update ARIA on the sidebar element */
  const sidebar = document.querySelector('.sidebar');
  if (sidebar) {
    sidebar.setAttribute('aria-hidden', String(collapsed));
  }
}

/**
 * Toggle Table-of-Contents panel visibility.
 */
export function toggleToC() {
  const app = document.querySelector('.app');
  if (!app) return;

  const collapsed = app.classList.toggle('toc-collapsed');

  /* Update ARIA on the ToC panel */
  const toc = document.querySelector('.toc-panel');
  if (toc) {
    toc.setAttribute('aria-hidden', String(collapsed));
  }
}
