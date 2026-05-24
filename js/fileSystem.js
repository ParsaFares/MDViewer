/**
 * fileSystem.js — Directory opening and markdown file reading
 *
 * Provides two strategies for opening a local directory:
 *  1. Primary:  File System Access API (`showDirectoryPicker`)
 *  2. Fallback: Hidden `<input type="file" webkitdirectory>` for older browsers
 *
 * Exported helpers let the rest of the app read cached file content and
 * query the root directory name without touching the file system again.
 */

/* ------------------------------------------------------------------ */
/*  Module-level state                                                 */
/* ------------------------------------------------------------------ */

/** @type {FileSystemDirectoryHandle|null} Active directory handle */
let rootHandle = null;

/** @type {Map<string, string>} path → file text content */
let filesCache = new Map();

/** @type {string} Name of the opened root directory */
let rootName = '';

/** Extensions we consider "markdown" */
const MD_EXTENSIONS = ['.md', '.markdown'];

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

/**
 * Check whether the modern File System Access API is available.
 * @returns {boolean}
 */
export function isFileSystemAccessSupported() {
  return typeof window.showDirectoryPicker === 'function';
}

/**
 * Check whether a modern directory handle is currently active.
 * @returns {boolean}
 */
export function hasDirectoryHandle() {
  return rootHandle !== null;
}

/**
 * Open a directory and return its tree + file contents.
 *
 * @returns {Promise<{ tree: TreeNode, files: Map<string, string> }>}
 *
 * TreeNode shape:
 *   { name: string, path: string, kind: 'directory'|'file',
 *     children: TreeNode[], handle?: FileSystemHandle }
 */
export async function openDirectory() {
  /* Reset state for a fresh open */
  filesCache = new Map();
  rootName = '';
  rootHandle = null;

  if (isFileSystemAccessSupported()) {
    return openWithNativeAPI();
  }
  return openWithFallbackInput();
}

/**
 * Re-scan the active directory and return its updated tree + file contents.
 * @returns {Promise<{ tree: TreeNode, files: Map<string, string> }>}
 */
export async function refreshDirectory() {
  if (!rootHandle) {
    throw new Error('No active directory handle to refresh.');
  }

  const hasPermission = await verifyPermission(rootHandle, false);
  if (!hasPermission) {
    throw new DOMException('Permission denied', 'NotAllowedError');
  }

  /* Clear the cache for a fresh scan */
  filesCache = new Map();

  const tree = await walkDirectory(rootHandle, rootHandle.name);
  return { tree, files: filesCache };
}

/**
 * Retrieve the cached text content of a file by its path.
 * @param {string} path
 * @returns {string|undefined}
 */
export function getFileContent(path) {
  return filesCache.get(path);
}

/**
 * Get the name of the root directory that was last opened.
 * @returns {string}
 */
export function getRootName() {
  return rootName;
}

/* ------------------------------------------------------------------ */
/*  Strategy 1 — File System Access API                                */
/* ------------------------------------------------------------------ */

/**
 * Open a directory via `showDirectoryPicker` and recursively walk it.
 * @returns {Promise<{ tree: TreeNode, files: Map<string, string> }>}
 */
async function openWithNativeAPI() {
  const dirHandle = await window.showDirectoryPicker();
  rootHandle = dirHandle;
  rootName = dirHandle.name;

  const tree = await walkDirectory(dirHandle, dirHandle.name);

  return { tree, files: filesCache };
}

/**
 * Recursively walk a `FileSystemDirectoryHandle`, building a tree and
 * caching the text of every markdown file encountered.
 *
 * @param {FileSystemDirectoryHandle} dirHandle
 * @param {string} path – cumulative path from root, used as map key
 * @returns {Promise<TreeNode>}
 */
async function walkDirectory(dirHandle, path = '') {
  /** @type {TreeNode} */
  const node = {
    name: dirHandle.name,
    path,
    kind: 'directory',
    children: [],
    handle: dirHandle,
  };

  for await (const entry of dirHandle.values()) {
    const entryPath = path ? `${path}/${entry.name}` : entry.name;

    if (entry.kind === 'directory') {
      /* Recurse into sub-directories */
      const childNode = await walkDirectory(entry, entryPath);
      node.children.push(childNode);
    } else if (entry.kind === 'file' && isMarkdown(entry.name)) {
      /* Read markdown file contents into cache */
      const file = await entry.getFile();
      const text = await file.text();
      filesCache.set(entryPath, text);

      node.children.push({
        name: entry.name,
        path: entryPath,
        kind: 'file',
        children: [],
        handle: entry,
      });
    }
  }

  /* Sort: directories first, then files — both alphabetical (case-insensitive) */
  sortChildren(node.children);

  return node;
}

/* ------------------------------------------------------------------ */
/*  Strategy 2 — Fallback <input webkitdirectory>                      */
/* ------------------------------------------------------------------ */

/**
 * Create a temporary hidden file input, let the user pick a folder,
 * then reconstruct the tree from `webkitRelativePath` strings.
 *
 * @returns {Promise<{ tree: TreeNode, files: Map<string, string> }>}
 */
function openWithFallbackInput() {
  rootHandle = null;
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.setAttribute('webkitdirectory', '');
    input.setAttribute('multiple', '');

    /* Detect cancellation — if nothing is selected after a focus return */
    const handleCancel = () => {
      window.removeEventListener('focus', handleCancel);
      /* Small delay so `change` can still fire first */
      setTimeout(() => {
        if (!input.files || input.files.length === 0) {
          reject(new DOMException('The user aborted a request.', 'AbortError'));
        }
      }, 500);
    };

    input.addEventListener('change', async () => {
      window.removeEventListener('focus', handleCancel);

      const fileList = input.files;
      if (!fileList || fileList.length === 0) {
        reject(new DOMException('No files selected.', 'AbortError'));
        return;
      }

      try {
        const { tree, files } = await buildTreeFromFileList(fileList);
        resolve({ tree, files });
      } catch (err) {
        reject(err);
      }
    });

    /* Listen for focus to detect a possible cancel */
    window.addEventListener('focus', handleCancel);

    /* Trigger the native file picker */
    input.click();
  });
}

/**
 * Reconstruct a directory tree from a flat `FileList` whose entries
 * carry `webkitRelativePath` (e.g. "myFolder/sub/README.md").
 *
 * @param {FileList} fileList
 * @returns {Promise<{ tree: TreeNode, files: Map<string, string> }>}
 */
async function buildTreeFromFileList(fileList) {
  /*
   * Determine root name from the common first segment.
   * All webkitRelativePath values start with the same folder name.
   */
  const firstPath = fileList[0].webkitRelativePath;
  const rootSegment = firstPath.split('/')[0];
  rootName = rootSegment;

  /** @type {TreeNode} */
  const tree = {
    name: rootSegment,
    path: rootSegment,
    kind: 'directory',
    children: [],
  };

  /* Map of path → directory node for quick look-ups while inserting */
  const dirMap = new Map();
  dirMap.set(rootSegment, tree);

  for (const file of fileList) {
    /* Only process markdown files */
    if (!isMarkdown(file.name)) continue;

    const relativePath = file.webkitRelativePath; // e.g. "root/a/b/file.md"
    const segments = relativePath.split('/');

    /* Ensure every intermediate directory node exists */
    let currentPath = '';
    let parentNode = null;

    for (let i = 0; i < segments.length - 1; i++) {
      currentPath = currentPath ? `${currentPath}/${segments[i]}` : segments[i];

      if (!dirMap.has(currentPath)) {
        const dirNode = {
          name: segments[i],
          path: currentPath,
          kind: 'directory',
          children: [],
        };
        dirMap.set(currentPath, dirNode);

        /* Attach to parent */
        if (parentNode) {
          parentNode.children.push(dirNode);
        }
      }

      parentNode = dirMap.get(currentPath);
    }

    /* Read text content and add file node */
    const text = await file.text();
    filesCache.set(relativePath, text);

    const fileNode = {
      name: file.name,
      path: relativePath,
      kind: 'file',
      children: [],
    };

    parentNode.children.push(fileNode);
  }

  /* Recursively sort every directory's children */
  sortTreeRecursive(tree);

  return { tree, files: filesCache };
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/**
 * Check if a filename has a markdown extension.
 * @param {string} name
 * @returns {boolean}
 */
function isMarkdown(name) {
  const lower = name.toLowerCase();
  return MD_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

/**
 * Sort an array of tree nodes in place:
 *  - Directories before files
 *  - Alphabetical within each group (case-insensitive)
 *
 * @param {TreeNode[]} children
 */
function sortChildren(children) {
  children.sort((a, b) => {
    /* Directories come first */
    if (a.kind !== b.kind) {
      return a.kind === 'directory' ? -1 : 1;
    }
    /* Alphabetical, case-insensitive */
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });
}

/**
 * Recursively sort children for every directory in the tree.
 * @param {TreeNode} node
 */
function sortTreeRecursive(node) {
  if (node.kind === 'directory' && node.children.length > 0) {
    sortChildren(node.children);
    node.children.forEach(sortTreeRecursive);
  }
}

/**
 * Verify permission to access a directory handle.
 * @param {FileSystemHandle} handle
 * @param {boolean} readWrite
 * @returns {Promise<boolean>}
 */
async function verifyPermission(handle, readWrite = false) {
  const options = { mode: readWrite ? 'readwrite' : 'read' };
  if ((await handle.queryPermission(options)) === 'granted') {
    return true;
  }
  if ((await handle.requestPermission(options)) === 'granted') {
    return true;
  }
  return false;
}
