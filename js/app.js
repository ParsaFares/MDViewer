/**
 * app.js — Main orchestrator for MDViewer
 *
 * Initialises all modules, wires up event handlers, manages application
 * state, and implements keyboard shortcuts.
 */

import { openDirectory, getFileContent, getRootName, hasDirectoryHandle, refreshDirectory } from './fileSystem.js';
import { initRenderer, renderMarkdown, processMermaid, injectMermaidContent, setupCopyButtons, attachLinkInterception, showToast } from './renderer.js';
import { renderFileTree, setActiveFile, renderToC, initScrollSpy, destroyScrollSpy, filterFileTree, toggleSidebar, toggleToC } from './sidebar.js';
import { initSearch, hideSearchResults, destroySearch } from './search.js';
import { initTheme, toggleTheme, getTheme, initDirection, toggleDirection } from './theme.js';

/* ------------------------------------------------------------------ */
/*  Application state                                                  */
/* ------------------------------------------------------------------ */

/** @type {Map<string, string>|null} Currently loaded files map */
let filesMap = null;

/** @type {object|null} Current file tree data structure */
let fileTree = null;

/** @type {string|null} Path of the currently displayed file */
let currentFilePath = null;

/* ------------------------------------------------------------------ */
/*  DOM references                                                     */
/* ------------------------------------------------------------------ */

const $ = (id) => document.getElementById(id);

/** @type {HTMLElement} */
let appEl;
/** @type {HTMLElement} */
let contentEl;
/** @type {HTMLElement} */
let markdownBodyEl;
/** @type {HTMLElement} */
let landingEl;
/** @type {HTMLElement} */
let sidebarTitleEl;
/** @type {HTMLElement} */
let overlayEl;

/* ------------------------------------------------------------------ */
/*  Initialisation                                                     */
/* ------------------------------------------------------------------ */

document.addEventListener('DOMContentLoaded', () => {
  try {
    /* Cache DOM references */
    appEl = $('app');
    contentEl = $('content');
    markdownBodyEl = $('markdown-body');
    landingEl = $('landing');
    sidebarTitleEl = $('sidebar-title');
    overlayEl = $('overlay');

    /* Initialise theme & direction from stored preferences */
    initTheme();
    initDirection();
    updateThemeIcons();

    /* Initialise the markdown renderer (marked, mermaid, hljs) */
    initRenderer();

    /* Attach inter-file link click handling on the content area */
    attachLinkInterception(markdownBodyEl, handleInterFileLink);

    /* Wire up event listeners */
    wireHeaderButtons();
    wireLandingButton();
    wireKeyboardShortcuts();
    wireOverlay();

    /* Start with both sidebars collapsed since no folder is loaded */
    appEl.classList.add('toc-collapsed');

    console.log('[MDViewer] Initialised successfully.');
  } catch (err) {
    console.error('[MDViewer] Initialisation failed:', err);
  }
});

/* ------------------------------------------------------------------ */
/*  Event wiring                                                       */
/* ------------------------------------------------------------------ */

function wireHeaderButtons() {
  /* Open folder */
  const openBtn = $('open-folder-btn');
  if (openBtn) openBtn.addEventListener('click', handleOpenFolder);

  /* Refresh folder */
  const refreshBtn = $('refresh-dir-btn');
  if (refreshBtn) refreshBtn.addEventListener('click', handleRefreshDirectory);

  /* Theme toggle */
  const themeBtn = $('theme-toggle-btn');
  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      toggleTheme();
      updateThemeIcons();
      updateMermaidTheme();
    });
  }

  /* Direction toggle */
  const dirBtn = $('dir-toggle-btn');
  if (dirBtn) {
    dirBtn.addEventListener('click', () => {
      toggleDirection();
    });
  }

  /* Sidebar toggle */
  const sidebarBtn = $('sidebar-toggle-btn');
  if (sidebarBtn) sidebarBtn.addEventListener('click', () => {
    toggleSidebar();
    handleMobileOverlay();
  });

  /* ToC toggle */
  const tocBtn = $('toc-toggle-btn');
  if (tocBtn) tocBtn.addEventListener('click', () => {
    toggleToC();
    handleMobileOverlay();
  });

  /* Mobile menu button */
  const mobileMenuBtn = $('mobile-menu-btn');
  if (mobileMenuBtn) {
    mobileMenuBtn.addEventListener('click', () => {
      toggleSidebar();
      handleMobileOverlay();
    });
  }
}

function wireLandingButton() {
  const landingOpenBtn = $('landing-open-btn');
  if (landingOpenBtn) landingOpenBtn.addEventListener('click', handleOpenFolder);
}

function wireOverlay() {
  if (overlayEl) {
    overlayEl.addEventListener('click', () => {
      /* Close any open sidebar on mobile */
      if (!appEl.classList.contains('sidebar-collapsed')) {
        toggleSidebar();
      }
      if (!appEl.classList.contains('toc-collapsed')) {
        toggleToC();
      }
      handleMobileOverlay();
    });
  }
}

function wireKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    const isMeta = e.metaKey || e.ctrlKey;

    /* Ctrl/Cmd + O — Open folder */
    if (isMeta && e.key === 'o') {
      e.preventDefault();
      handleOpenFolder();
      return;
    }

    /* Ctrl/Cmd + K — Focus search */
    if (isMeta && e.key === 'k') {
      e.preventDefault();
      const searchInput = $('search-input');
      if (searchInput) {
        searchInput.focus();
        searchInput.select();
      }
      return;
    }

    /* Ctrl/Cmd + B — Toggle file tree sidebar */
    if (isMeta && e.key === 'b') {
      e.preventDefault();
      toggleSidebar();
      handleMobileOverlay();
      return;
    }

    /* Ctrl/Cmd + \ — Toggle ToC */
    if (isMeta && e.key === '\\') {
      e.preventDefault();
      toggleToC();
      handleMobileOverlay();
      return;
    }

    /* Ctrl/Cmd + Shift + T — Toggle theme */
    if (isMeta && e.shiftKey && e.key === 'T') {
      e.preventDefault();
      toggleTheme();
      updateThemeIcons();
      updateMermaidTheme();
      return;
    }

    /* Ctrl/Cmd + Shift + R — Refresh directory */
    if (isMeta && e.shiftKey && e.key === 'R') {
      e.preventDefault();
      handleRefreshDirectory();
      return;
    }
  });
}

/* ------------------------------------------------------------------ */
/*  Core handlers                                                      */
/* ------------------------------------------------------------------ */

/**
 * Handle the "Open Folder" action.
 * Opens a directory, builds the file tree, initialises search,
 * and displays the first markdown file.
 */
async function handleOpenFolder() {
  try {
    const result = await openDirectory();
    fileTree = result.tree;
    filesMap = result.files;

    /* Update sidebar title with root directory name */
    if (sidebarTitleEl) {
      sidebarTitleEl.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
        </svg>
        ${escapeHtml(getRootName())}
      `;
    }

    /* Render the file tree in the sidebar */
    renderFileTree(fileTree, handleFileSelect);

    /* Initialise or reinitialise search */
    destroySearch();
    initSearch(filesMap, handleSearchResultClick);

    /* Show sidebar if it was collapsed */
    if (appEl.classList.contains('sidebar-collapsed')) {
      toggleSidebar();
    }

    /* Auto-open the first file */
    const firstFilePath = findFirstFile(fileTree);
    if (firstFilePath) {
      handleFileSelect(firstFilePath);
    }

    /* Show refresh button */
    const refreshBtn = $('refresh-dir-btn');
    if (refreshBtn) refreshBtn.hidden = false;
  } catch (err) {
    if (err.name === 'AbortError') {
      /* User cancelled the folder picker — no action needed */
      return;
    }
    console.error('[MDViewer] Failed to open directory:', err);
  }
}

/**
 * Handle the directory refresh action.
 * Re-scans the directory. If a handle is present, scans silently.
 * Otherwise, triggers folder picker fallback.
 */
async function handleRefreshDirectory() {
  const refreshBtn = $('refresh-dir-btn');
  if (refreshBtn) refreshBtn.classList.add('is-loading');

  try {
    let result;
    if (hasDirectoryHandle()) {
      result = await refreshDirectory();
    } else {
      result = await openDirectory();
    }

    fileTree = result.tree;
    filesMap = result.files;

    /* Update sidebar title (in case it changed or for fallback root naming) */
    if (sidebarTitleEl) {
      sidebarTitleEl.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
        </svg>
        ${escapeHtml(getRootName())}
      `;
    }

    /* Render the updated file tree in the sidebar */
    renderFileTree(fileTree, handleFileSelect);

    /* Reinitialise search with new files map */
    destroySearch();
    initSearch(filesMap, handleSearchResultClick);

    /* If the current file still exists in the new tree, re-render it to update content */
    if (currentFilePath && filesMap.has(currentFilePath)) {
      handleFileSelect(currentFilePath);
    } else {
      /* Otherwise, open the first file or show landing */
      const firstFilePath = findFirstFile(fileTree);
      if (firstFilePath) {
        handleFileSelect(firstFilePath);
      } else {
        if (markdownBodyEl) markdownBodyEl.hidden = true;
        if (landingEl) landingEl.hidden = false;
        document.title = 'MDViewer — Markdown Viewer';
      }
    }

    /* Show success toast */
    showToast('Directory refreshed successfully!');
  } catch (err) {
    if (err.name === 'AbortError') {
      return;
    }
    console.error('[MDViewer] Failed to refresh directory:', err);
    showToast('Failed to refresh directory.');
  } finally {
    if (refreshBtn) refreshBtn.classList.remove('is-loading');
  }
}

/**
 * Handle selecting a file from the tree or search results.
 *
 * @param {string} filePath  Path of the file to display.
 */
function handleFileSelect(filePath) {
  const content = getFileContent(filePath);
  if (content === undefined) {
    console.warn(`[MDViewer] No cached content for: ${filePath}`);
    return;
  }

  currentFilePath = filePath;

  /* Compute the base directory path (for relative asset resolution) */
  const parts = filePath.split('/');
  parts.pop();
  const basePath = parts.join('/');

  /* Render markdown to HTML */
  const { html, headings, mermaidBlocks } = renderMarkdown(content, basePath, handleInterFileLink);

  /* Hide landing, show markdown body */
  if (landingEl) landingEl.hidden = true;
  if (markdownBodyEl) {
    markdownBodyEl.hidden = false;
    markdownBodyEl.innerHTML = html;

    /* Inject raw mermaid sources into placeholder divs (bypasses DOMPurify) */
    injectMermaidContent(markdownBodyEl, mermaidBlocks);

    /* Add fade-in animation */
    markdownBodyEl.classList.remove('fade-in');
    void markdownBodyEl.offsetWidth; /* Force reflow */
    markdownBodyEl.classList.add('fade-in');
  }

  /* Post-render: code copy buttons, mermaid diagrams */
  setupCopyButtons();
  processMermaid();

  /* Update sidebar: highlight active file */
  setActiveFile(filePath);

  /* Update ToC */
  renderToC(headings);

  /* Show ToC panel if it was collapsed and there are headings */
  if (headings.length > 0 && appEl.classList.contains('toc-collapsed')) {
    toggleToC();
  }

  /* Initialise scroll-spy for ToC */
  destroyScrollSpy();
  initScrollSpy(contentEl);

  /* Scroll content to top */
  if (contentEl) contentEl.scrollTop = 0;

  /* Update document title */
  const fileName = filePath.split('/').pop();
  document.title = `${fileName} — MDViewer`;

  /* On mobile, close the sidebar after selecting a file */
  if (window.innerWidth <= 768 && !appEl.classList.contains('sidebar-collapsed')) {
    toggleSidebar();
    handleMobileOverlay();
  }
}

/**
 * Handle clicking a search result.
 *
 * @param {string} filePath   Path of the file.
 * @param {number} lineIndex  Line number of the match (0-indexed).
 */
function handleSearchResultClick(filePath, lineIndex) {
  handleFileSelect(filePath);
  hideSearchResults();

  /* Attempt to scroll to the approximate match location.
     We use a simple heuristic: find the nth paragraph/element
     that corresponds to the line index. */
  if (markdownBodyEl && lineIndex > 0) {
    requestAnimationFrame(() => {
      const allElements = markdownBodyEl.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, pre, blockquote, table');
      /* Rough mapping — scroll to a proportional position */
      const totalLines = getFileContent(filePath)?.split('\n').length || 1;
      const proportion = lineIndex / totalLines;
      const targetIdx = Math.min(
        Math.floor(proportion * allElements.length),
        allElements.length - 1
      );
      if (allElements[targetIdx]) {
        allElements[targetIdx].scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
  }
}

/**
 * Handle clicking an inter-file markdown link (e.g. `[link](other.md)`).
 *
 * @param {string} href  The href from the link, e.g. `../docs/guide.md`.
 */
function handleInterFileLink(href) {
  if (!currentFilePath || !filesMap) return;

  /* Resolve the relative path against the current file's directory */
  const currentParts = currentFilePath.split('/');
  currentParts.pop(); /* Remove current file name */

  const hrefParts = href.split('/');
  const resolvedParts = [...currentParts];

  for (const part of hrefParts) {
    if (part === '..') {
      resolvedParts.pop();
    } else if (part !== '.') {
      resolvedParts.push(part);
    }
  }

  const resolvedPath = resolvedParts.join('/');

  /* Check if this file exists in our loaded files */
  if (filesMap.has(resolvedPath)) {
    handleFileSelect(resolvedPath);
  } else {
    /* Try without the root prefix or with different casing */
    for (const [path] of filesMap) {
      if (path.endsWith(href) || path.toLowerCase().endsWith(href.toLowerCase())) {
        handleFileSelect(path);
        return;
      }
    }
    console.warn(`[MDViewer] Inter-file link target not found: ${href} (resolved: ${resolvedPath})`);
  }
}

/* ------------------------------------------------------------------ */
/*  UI helpers                                                         */
/* ------------------------------------------------------------------ */

/**
 * Update theme toggle button icons based on current theme.
 */
function updateThemeIcons() {
  const theme = getTheme();
  const moonIcon = document.querySelector('.icon-moon');
  const sunIcon = document.querySelector('.icon-sun');

  /* Also swap highlight.js theme */
  const darkHljsLink = $('hljs-theme-dark');
  const lightHljsLink = $('hljs-theme-light');

  if (theme === 'dark') {
    if (moonIcon) moonIcon.style.display = '';
    if (sunIcon) sunIcon.style.display = 'none';
    if (darkHljsLink) darkHljsLink.disabled = false;
    if (lightHljsLink) lightHljsLink.disabled = true;
  } else {
    if (moonIcon) moonIcon.style.display = 'none';
    if (sunIcon) sunIcon.style.display = '';
    if (darkHljsLink) darkHljsLink.disabled = true;
    if (lightHljsLink) lightHljsLink.disabled = false;
  }
}

/**
 * Re-initialise mermaid with the current theme and re-render diagrams.
 */
function updateMermaidTheme() {
  const theme = getTheme();
  if (typeof mermaid !== 'undefined') {
    mermaid.initialize({
      startOnLoad: false,
      theme: theme === 'dark' ? 'dark' : 'default',
      securityLevel: 'loose',
    });

    /* Re-render if there are mermaid diagrams on the page */
    const mermaidNodes = document.querySelectorAll('.mermaid[data-processed]');
    if (mermaidNodes.length > 0) {
      /* Reset processed state and re-render */
      mermaidNodes.forEach((node) => {
        node.removeAttribute('data-processed');
      });
      processMermaid();
    }
  }
}

/**
 * Manage the mobile overlay backdrop visibility.
 */
function handleMobileOverlay() {
  if (window.innerWidth > 768 || !overlayEl) return;

  const sidebarOpen = !appEl.classList.contains('sidebar-collapsed');
  const tocOpen = !appEl.classList.contains('toc-collapsed');

  if (sidebarOpen || tocOpen) {
    overlayEl.hidden = false;
    overlayEl.classList.add('is-visible');
  } else {
    overlayEl.classList.remove('is-visible');
    /* Wait for fade-out transition before hiding */
    setTimeout(() => {
      if (!overlayEl.classList.contains('is-visible')) {
        overlayEl.hidden = true;
      }
    }, 300);
  }
}

/**
 * Find the first file (by path) in the tree, depth-first.
 *
 * @param {object} node  Tree node.
 * @returns {string|null}  Path of the first file, or null.
 */
function findFirstFile(node) {
  if (!node) return null;
  if (node.kind === 'file') return node.path;

  if (node.children) {
    for (const child of node.children) {
      const found = findFirstFile(child);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Escape HTML entities to prevent XSS in dynamically inserted strings.
 *
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
