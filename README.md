<p align="center">
  <img src="https://img.shields.io/badge/Vanilla-HTML%2FCSS%2FJS-8b5cf6?style=for-the-badge" alt="Vanilla HTML/CSS/JS">
  <img src="https://img.shields.io/badge/No_Build_Step-Zero_Config-10b981?style=for-the-badge" alt="No Build Step">
  <img src="https://img.shields.io/badge/RTL-Supported-f59e0b?style=for-the-badge" alt="RTL Supported">
  <img src="https://img.shields.io/license/MIT-blue?style=for-the-badge" alt="MIT License">
</p>

<h1 align="center">
  <br>
  <img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' rx='16' fill='%238b5cf6'/%3E%3Ctext x='50' y='68' font-size='52' font-weight='700' text-anchor='middle' fill='white' font-family='sans-serif'%3EM%3C/text%3E%3C/svg%3E" width="80" alt="MDViewer Logo">
  <br>
  MDViewer
  <br>
</h1>

<h4 align="center">A beautiful, client-side markdown viewer for the web.</h4>

<p align="center">
  Open any folder of markdown files and browse them with premium typography, syntax highlighting, full-text search, and a gorgeous dark/light UI — all running entirely in your browser.
</p>

---

## ✨ Features

| Feature | Description |
|---|---|
| 📂 **Open Folder** | Open a local folder via the File System Access API, with `<input webkitdirectory>` fallback for Firefox/Safari |
| 🌲 **Nested File Tree** | Collapsible directory tree in the right sidebar for easy navigation |
| 📄 **Markdown Rendering** | Beautiful typography — headings, tables, blockquotes, task lists, images, and more (GFM) |
| 📑 **Table of Contents** | Auto-generated from headings with IntersectionObserver-based scroll-spy |
| 🔍 **Full-text Search** | Instant search across all loaded markdown files with highlighted results |
| ✨ **Syntax Highlighting** | Language-aware code highlighting via highlight.js with theme-matched styles |
| 📋 **Copy Code Blocks** | One-click copy button on every code block with toast confirmation |
| 🔗 **Inter-file Links** | Click `.md` links to navigate between files within the viewer |
| 📊 **Mermaid Diagrams** | Render `mermaid` code blocks as interactive SVG diagrams |
| 🌙 **Dark / Light Mode** | Toggle themes with smooth transitions, persisted in localStorage |
| 🖨️ **Print-friendly** | Clean print styles for exporting to PDF via the browser print dialog |
| ⌨️ **Keyboard Shortcuts** | Full keyboard navigation (see below) |
| 🔄 **RTL Support** | Full bidirectional text support with CSS logical properties and Vazirmatn font |

## 🚀 Getting Started

**No installation, no build step, no dependencies to install.** Just serve the files.

### Option 1 — Local Server (recommended)

```bash
# Clone the repo
git clone https://github.com/ParsaFares/MDViewer.git
cd MDViewer

# Serve with any static server
python3 -m http.server 8080
# or
npx serve .
```

Then open **http://localhost:8080** in your browser.

### Option 2 — Open Directly

Open `index.html` directly in a Chromium browser (Chrome, Edge, Opera). ES modules work over `file://` in Chromium.

> **Note:** Firefox requires a local server for ES modules to work.

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl/⌘ + O` | Open a folder |
| `Ctrl/⌘ + K` | Focus the search bar |
| `Ctrl/⌘ + B` | Toggle the file tree sidebar |
| `Ctrl/⌘ + \` | Toggle the table of contents |
| `Ctrl/⌘ + Shift + T` | Toggle dark/light theme |
| `Escape` | Close search results |

## 🏗️ Architecture

```
MDViewer/
├── index.html              ← Entry point
├── css/
│   ├── index.css           ← Design tokens, themes, reset
│   ├── layout.css          ← 3-panel responsive grid
│   ├── markdown.css        ← Markdown typography
│   └── print.css           ← Print styles
└── js/
    ├── app.js              ← Main orchestrator
    ├── fileSystem.js        ← Directory reading (API + fallback)
    ├── renderer.js          ← Markdown → HTML pipeline
    ├── sidebar.js           ← File tree + ToC + scroll-spy
    ├── search.js            ← Full-text search
    └── theme.js             ← Theme + direction toggle
```

**~113 KB** of application code. Zero `node_modules`. Zero build output.

## 📦 External Dependencies (via CDN)

| Library | Purpose |
|---|---|
| [marked](https://github.com/markedjs/marked) | Markdown → HTML parsing |
| [highlight.js](https://highlightjs.org/) | Code syntax highlighting |
| [DOMPurify](https://github.com/cure53/DOMPurify) | XSS protection |
| [mermaid](https://mermaid.js.org/) | Diagram rendering |
| [Inter](https://rsms.me/inter/) | Primary typeface |
| [Vazirmatn](https://github.com/rastikerdar/vazirmatn) | RTL typeface |
| [JetBrains Mono](https://www.jetbrains.com/lp/mono/) | Code typeface |

## 🌐 Browser Support

| Browser | Support | Notes |
|---|---|---|
| Chrome / Edge | ✅ Full | File System Access API |
| Opera | ✅ Full | File System Access API |
| Firefox | ✅ With fallback | Uses `<input webkitdirectory>` |
| Safari | ✅ With fallback | Uses `<input webkitdirectory>` |

## 🤝 Contributing

Contributions are welcome! Feel free to open issues and pull requests.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
