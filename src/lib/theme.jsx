/* ============================== DESIGN TOKENS ==============================
   Notarial ledger aesthetic: ink, aged paper, wax-seal red, brass.
   Display: Source Serif 4 · Body: IBM Plex Sans · Data: IBM Plex Mono
================================================================================ */
export const C = {
  ink: "#1E2A24",
  paper: "#EFE9D8",
  paper2: "#E4DCC4",
  paper3: "#F8F5EC",
  wax: "#7E2A34",
  waxDark: "#5E1F27",
  brass: "#A9813F",
  brassLight: "#C7A468",
  bottle: "#2C4A3B",
  line: "#C9BE9E",
  muted: "#6B7268",
  white: "#FBF9F2",
};

export const FONT_IMPORT = `@import url('https://fonts.googleapis.com/css2?family=Source+Serif+4:opsz,wght@8..60,400;8..60,600;8..60,700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap');`;

export function StyleSheet() {
  return (
    <style>{`
      ${FONT_IMPORT}
      .ec-root, .ec-root * { box-sizing: border-box; }
      .ec-root { font-family: 'IBM Plex Sans', sans-serif; color: ${C.ink}; }
      .ec-serif { font-family: 'Source Serif 4', serif; }
      .ec-mono { font-family: 'IBM Plex Mono', monospace; }
      .ec-btn { cursor:pointer; border:1px solid ${C.ink}; background:${C.ink}; color:${C.white};
                 padding:8px 14px; font-size:13px; font-weight:600; letter-spacing:.02em; border-radius:3px;
                 display:inline-flex; align-items:center; gap:6px; transition:all .15s; }
      .ec-btn:hover { background:${C.wax}; border-color:${C.wax}; }
      .ec-btn:disabled { opacity:.55; cursor:default; }
      .ec-btn-ghost { cursor:pointer; border:1px solid ${C.line}; background:transparent; color:${C.ink};
                 padding:7px 12px; font-size:13px; font-weight:500; border-radius:3px; display:inline-flex; align-items:center; gap:6px; }
      .ec-btn-ghost:hover { border-color:${C.wax}; color:${C.wax}; }
      .ec-input, .ec-select { font-family:'IBM Plex Sans',sans-serif; border:1px solid ${C.line}; background:${C.white};
                 padding:7px 9px; font-size:13px; border-radius:3px; color:${C.ink}; width:100%; }
      .ec-input:focus, .ec-select:focus { outline:2px solid ${C.brass}; outline-offset:1px; border-color:${C.brass}; }
      .ec-table { width:100%; border-collapse:collapse; font-size:13px; }
      .ec-table th { text-align:left; font-size:10.5px; letter-spacing:.06em; text-transform:uppercase; color:${C.muted};
                 border-bottom:1.5px solid ${C.ink}; padding:8px 10px; font-weight:600; white-space:nowrap; }
      .ec-table td { padding:8px 10px; border-bottom:1px solid ${C.line}; vertical-align:middle; }
      .ec-table tr:hover td { background:${C.paper3}; }
      .ec-tab { cursor:pointer; padding:10px 18px; font-size:13.5px; font-weight:600; border:none; background:transparent;
                 color:${C.muted}; display:flex; align-items:center; gap:7px; border-bottom:3px solid transparent; }
      .ec-tab.active { color:${C.ink}; border-bottom-color:${C.wax}; }
      .ec-badge { display:inline-flex; align-items:center; padding:2px 9px; border-radius:20px; font-size:11px; font-weight:600; letter-spacing:.01em; white-space:nowrap; }
      .ec-chip { cursor:pointer; border:1px solid ${C.line}; border-radius:20px; padding:4px 11px; font-size:12px; background:${C.white}; }
      .ec-chip.active { background:${C.ink}; color:${C.white}; border-color:${C.ink}; }
      .ec-card { background:${C.white}; border:1px solid ${C.line}; border-radius:6px; }
      .ec-scroll::-webkit-scrollbar{height:8px;width:8px;} .ec-scroll::-webkit-scrollbar-thumb{background:${C.line};border-radius:4px;}
      @keyframes ec-fade { from{opacity:0; transform:translateY(4px);} to{opacity:1; transform:translateY(0);} }
      .ec-fade { animation: ec-fade .25s ease; }
      @keyframes ec-spin { to { transform: rotate(360deg); } }
      .ec-spin { animation: ec-spin 1s linear infinite; }
      .ec-toast { position: fixed; bottom: 20px; right: 20px; z-index: 200; max-width: 360px;
                 padding: 12px 16px; border-radius: 6px; font-size: 13px; font-weight: 500; box-shadow: 0 6px 20px rgba(0,0,0,.18); }
      @keyframes ec-highlight-pulse { 0%{ box-shadow: 0 0 0 4px rgba(169,129,63,.55); } 100%{ box-shadow: 0 0 0 0 rgba(169,129,63,0); } }
      .ec-highlight { animation: ec-highlight-pulse 2.2s ease-out; }
      .ec-search-result:hover, .ec-search-result:focus-visible { background: ${C.paper3}; outline: none; }

      /* ============================== RESPONSIVE / MOBILE ==============================
         Breakpoint: 767px. Most of the app already reflows via flexWrap on inline
         styles (which media queries can't touch), so these rules are deliberately
         scoped to (a) real CSS classes, which media queries CAN override, and
         (b) the few spots — nav header, data tables — that need a structurally
         different layout on a phone rather than just narrower columns. */
      html, body { overflow-x: hidden; }
      .ec-form-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; }
      .ec-dashboard-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); gap: 18px; align-items: start; }
      .ec-hide-mobile { }
      .ec-hide-desktop { display: none; }
      @media (max-width: 767px) {
        .ec-hide-mobile { display: none !important; }
        .ec-hide-desktop { display: block; }
        /* Real font-size (not just visual size) below 16px makes iOS Safari
           auto-zoom the page on focus — this is the "zoom requirement" the
           phase brief calls out by name. */
        .ec-input, .ec-select { font-size: 16px; }
        .ec-toast { left: 12px; right: 12px; max-width: none; }
        .ec-search-overlay { padding-top: 6vh; }
      }
      .ec-mobile-item { display: flex; flex-direction: column; gap: 6px; padding: 12px 14px; border-bottom: 1px solid ${C.line}; }
      .ec-mobile-item:last-child { border-bottom: none; }
      .ec-mobile-item-row { display: flex; justify-content: space-between; align-items: center; gap: 10px; font-size: 12.5px; color: ${C.muted}; }

      /* ============================== PRODUCT TOUR (driver.js) ==============================
         driver.js ships unstyled-ish defaults (generic sans-serif, blue-ish buttons); this
         restyles its popover to match the notarial ledger look instead of feeling bolted on. */
      .driver-popover.ec-tour-popover {
        --driver-popover-font-family: 'IBM Plex Sans', sans-serif;
        background: ${C.paper3}; border: 1px solid ${C.line}; border-radius: 6px;
        box-shadow: 0 12px 32px rgba(0,0,0,.28); max-width: 320px; padding: 16px;
      }
      .ec-tour-popover .driver-popover-title { font-family: 'Source Serif 4', serif; font-size: 16px; color: ${C.ink}; }
      .ec-tour-popover .driver-popover-description { color: ${C.ink}; font-size: 13px; line-height: 1.5; }
      .ec-tour-popover .driver-popover-progress-text { color: ${C.muted}; font-size: 11.5px; }
      .ec-tour-popover .driver-popover-footer-btn {
        border: 1px solid ${C.line}; border-radius: 3px; background: ${C.white}; color: ${C.ink};
        font-family: 'IBM Plex Sans', sans-serif; font-weight: 600; padding: 5px 11px;
      }
      .ec-tour-popover .driver-popover-footer-btn:hover { border-color: ${C.wax}; color: ${C.wax}; background: ${C.white}; }
      .ec-tour-popover .driver-popover-navigation-btns button:last-child {
        background: ${C.ink}; border-color: ${C.ink}; color: ${C.white};
      }
      .ec-tour-popover .driver-popover-navigation-btns button:last-child:hover { background: ${C.wax}; border-color: ${C.wax}; color: ${C.white}; }
      .ec-tour-popover .driver-popover-close-btn { color: ${C.muted}; }
      .ec-tour-popover .driver-popover-close-btn:hover { color: ${C.wax}; }
      .ec-tour-popover .driver-popover-arrow-side-left { border-right-color: ${C.paper3}; }
      .ec-tour-popover .driver-popover-arrow-side-right { border-left-color: ${C.paper3}; }
      .ec-tour-popover .driver-popover-arrow-side-top { border-bottom-color: ${C.paper3}; }
      .ec-tour-popover .driver-popover-arrow-side-bottom { border-top-color: ${C.paper3}; }
      #driver-highlighted-element-stage, .driver-active-element { border-radius: 6px; }
    `}</style>
  );
}
