/* =========================================================
       State & Application Setup
       ========================================================= */
const state = {
  // PDF Viewer State
  pageImages: [],    // data URLs, one per page (index 0 = page 1)
  numPages: 0,
  pageWidth: 816,
  pageHeight: 1056,
  currentPage: 1,
  currentZoom: 1.0,
  minZoom: 0.5,
  maxZoom: 8.0,
  renderQueue: [],

  // Unredactor State
  candidates: ['Jeffrey Epstein', 'Ghislaine Maxwell', 'Alan Dershowitz', 'Bill Clinton', 'Donald Trump', 'Prince Andrew', 'Virginia Giuffre', 'Virginia Roberts', 'Jean-Luc Brunel', 'Sarah Kellen', 'Nadia Marcinkova', 'Les Wexner', 'Glenn Dubin', 'Eva Dubin', 'Bill Richardson', 'George Mitchell', 'Leon Black', 'Mort Zuckerman', 'Emmy Tayler', 'Lesley Groff', 'Adriana Ross', 'Juan Alessi', 'Alfredo Rodriguez', 'Adriana Mucinska', 'Nadia Marcinkova', 'Nadia', 'Marcinkova', 'Les Wexner', 'Lex Wexner', 'Lesley Groff', 'Haley Robson', 'William Hammond', 'David Rodgers', 'Gerald Lefcourt'],
  redactions: [], // now each redaction will have { ...r, settings: {}, widths: {} }
  selectedRedactionIdx: null,

  // Candidates Pagination/Sort
  page: 1,
  perPage: 15,
  sortBy: 'name',
  sortDir: 'asc',
  activeTool: null, // 'add-box' or null
};

const els = {
  // Viewer
  dragOverlay: document.getElementById('drag-overlay'),
  viewerContainer: document.getElementById('viewer-container'),
  viewer: document.getElementById('viewer'),
  titleElem: document.getElementById('document-title'),
  pageCountElem: document.getElementById('page-count'),
  pageInputElem: document.getElementById('page-input'),
  zoomInputElem: document.getElementById('zoom-input'),
  zoomInBtn: document.getElementById('zoom-in'),
  zoomOutBtn: document.getElementById('zoom-out'),
  sidebar: document.getElementById('sidebar'),
  toggleSidebarBtn: document.getElementById('toggle-sidebar'),
  thumbnailView: document.getElementById('thumbnail-view'),

  // Tools Sidebar
  toolsSidebar: document.getElementById('tools-sidebar'),
  toggleToolsBtn: document.getElementById('toggle-tools'),
  toolAddBoxBtn: document.getElementById('tool-add-box'),
  toggleWebglBtn: document.getElementById('toggle-webgl'),
  webglOptionsBar: document.getElementById('webgl-options-bar'),
  textOptionsBar: document.getElementById('text-options-bar'),
  maskColor: document.getElementById('mask-color'),
  edgeSubtract: document.getElementById('edge-subtract'),

  // Settings
  font: document.getElementById('font'),
  size: document.getElementById('size'),
  calcScale: document.getElementById('calc-scale'),
  tol: document.getElementById('tolerance'),
  kern: document.getElementById('kerning'),
  lig: document.getElementById('ligatures'),
  upper: document.getElementById('force-uppercase'),

  // Data
  pdfFile: document.getElementById('pdf-file'),
  nameInput: document.getElementById('name-input'),
  pasteInput: document.getElementById('paste-input'),
  tableBody: document.getElementById('names-body'),
  pageInfo: document.getElementById('page-info'),

  // All Matches
  allMatchesCard: document.getElementById('all-matches-card'),
  allMatchesSummary: document.getElementById('all-matches-summary'),
  allMatchesBody: document.getElementById('all-matches-body')
};