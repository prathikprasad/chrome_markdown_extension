// Shared by background.js (importScripts) and options.html (<script>).
const DEFAULTS = {
  saveAs: false,        // show a "Save as" dialog instead of downloading directly
  folder: '',           // subfolder inside Downloads, e.g. "Markdown/Web"
  content: 'main',      // 'main' = main content only, 'page' = whole page
  includeImages: true,
  includeHeader: true,  // title + source URL at the top
};
