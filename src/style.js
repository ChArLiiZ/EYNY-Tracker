import { STYLE_ID, PANEL_ID, TOGGLE_ID, TOAST_CONTAINER_ID } from './constants.js';

export function injectStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    /* === Buttons === */
    .kuro-actions{display:flex;gap:4px;flex-wrap:wrap;margin-top:4px;align-items:center}
    .kuro-btn{border:1px solid #3a3f44;background:#16181a;color:#f3f4f6;border-radius:10px;padding:5px 10px;font-size:12px;cursor:pointer;line-height:1.6;transition:all .15s ease}
    .kuro-btn:hover{background:#202326;border-color:#4a5258}
    .kuro-btn.active{outline:2px solid #ffffff22;border-color:#6b7280}
    .kuro-btn:disabled{opacity:.4;cursor:not-allowed}
    .kuro-icon-btn{border:1px solid #3a3f44;background:#16181a;color:#e5e7eb;border-radius:9px;padding:1px 6px;font-size:12px;cursor:pointer;line-height:1.5;min-width:28px;transition:all .15s ease}
    .kuro-icon-btn:hover{background:#202326;border-color:#4a5258}
    .kuro-icon-btn.active{outline:2px solid #ffffff22}
    .kuro-badge{display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:999px;font-size:11px;color:#111;font-weight:700;margin-left:6px;letter-spacing:.2px}

    /* === Visual states on forum pages === */
    .kuro-seen{opacity:.55}
    .kuro-todo{box-shadow:inset 0 0 0 2px rgba(246,195,68,.45)}
    .kuro-downloaded{box-shadow:inset 0 0 0 2px rgba(63,185,80,.45)}

    /* === Inline note on forum pages === */
    .kuro-inline-note{margin-top:6px;display:flex;gap:4px;align-items:flex-start}
    .kuro-inline-note textarea{flex:1;min-height:48px;resize:vertical;padding:6px 8px;border-radius:8px;border:1px solid #444;background:#181a1b;color:#fff;font-size:12px;box-sizing:border-box}
    .kuro-inline-note button{flex-shrink:0}

    /* === Toggle button === */
    #${TOGGLE_ID}{position:fixed;right:16px;bottom:16px;z-index:99999;background:#0f1113;color:#fff;border:1px solid #2f3338;border-radius:999px;padding:10px 16px;cursor:pointer;box-shadow:0 10px 24px rgba(0,0,0,.25);transition:transform .15s ease}
    #${TOGGLE_ID}:hover{transform:scale(1.05)}

    /* === Panel (with animation #20) === */
    #${PANEL_ID}{position:fixed;right:16px;bottom:60px;width:min(760px,calc(100vw - 32px));max-height:84vh;background:#0f1113;color:#fff;border:1px solid #2a2f35;border-radius:16px;z-index:99999;overflow:hidden;box-shadow:0 18px 50px rgba(0,0,0,.45);opacity:0;transform:translateY(20px);pointer-events:none;visibility:hidden;transition:opacity .25s ease,transform .25s ease}
    #${PANEL_ID}.show{opacity:1;transform:translateY(0);pointer-events:auto;visibility:visible}
    #${PANEL_ID}.max{width:min(1100px,calc(100vw - 32px));max-height:90vh}
    #${PANEL_ID} header{padding:14px 16px;border-bottom:1px solid #24292e;font-weight:700;font-size:15px;background:linear-gradient(180deg,#121519,#0f1113);display:flex;align-items:center;justify-content:space-between;gap:12px}
    #${PANEL_ID} .body{padding:14px 16px;overflow:auto;max-height:66vh}
    #${PANEL_ID}.max .body{max-height:72vh}
    #${PANEL_ID} input,#${PANEL_ID} select,#${PANEL_ID} textarea{width:100%;box-sizing:border-box;margin:6px 0;padding:8px;border-radius:8px;border:1px solid #444;background:#181a1b;color:#fff}
    #${PANEL_ID} input[type="checkbox"]{width:auto;margin:0}
    #${PANEL_ID} input[type="date"]{width:auto;padding:4px 8px;margin:2px 0}

    /* === Close button (#13) === */
    .kuro-close-btn{background:none;border:none;color:#888;font-size:20px;cursor:pointer;padding:2px 8px;border-radius:6px;transition:color .15s ease}
    .kuro-close-btn:hover{color:#fff}

    /* === Toolbar === */
    .kuro-toolbar{display:grid;grid-template-columns:minmax(0,1fr) 160px;gap:10px;align-items:center;margin-bottom:10px}
    .kuro-toolbar-secondary{display:grid;grid-template-columns:180px 130px 1fr;gap:10px;align-items:center;margin-bottom:10px}

    /* === Advanced filters (#8) === */
    .kuro-advanced-filters{margin-bottom:10px;border:1px solid #262b31;border-radius:10px;background:#13161a}
    .kuro-advanced-filters summary{padding:8px 12px;cursor:pointer;font-size:12px;color:#9ca3af;user-select:none}
    .kuro-advanced-filters summary:hover{color:#fff}
    .kuro-filter-grid{padding:6px 12px 12px;display:flex;gap:12px;flex-wrap:wrap;align-items:center}
    .kuro-filter-grid label{font-size:12px;color:#ccc;display:flex;align-items:center;gap:4px}

    /* === Batch action bar (#2) === */
    .kuro-batch-bar{padding:8px 12px;background:#1a2233;border:1px solid #2a4060;border-radius:10px;margin-bottom:10px;display:flex;gap:8px;align-items:center;flex-wrap:wrap}
    .kuro-batch-bar .kuro-mini{margin-right:auto}

    /* === Manual order tools === */
    .kuro-order-tools{display:flex;flex-direction:column;gap:6px;align-items:center;justify-content:flex-start}
    .kuro-order-tools .kuro-btn{padding:2px 8px;min-width:34px}
    .kuro-order-input{width:36px !important;margin:0 !important;padding:4px 4px !important;text-align:center;font-size:12px !important;-moz-appearance:textfield}
    .kuro-order-input::-webkit-outer-spin-button,
    .kuro-order-input::-webkit-inner-spin-button{appearance:none;-webkit-appearance:none;margin:0}
    .kuro-order-label{font-size:12px;color:#9ca3af;line-height:1}

    /* === Action grid + summary === */
    .kuro-actions-grid{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;margin-bottom:8px}
    .kuro-summary-bar{padding:8px 10px;background:#14181c;border:1px solid #232930;border-radius:10px;margin-bottom:10px}

    /* === Item card === */
    .kuro-item{border:1px solid #262b31;border-radius:14px;padding:10px;margin-bottom:10px;display:grid;grid-template-columns:24px 22px 70px 1fr;gap:10px;background:#13161a;transition:border-color .15s ease,box-shadow .15s ease}
    .kuro-item:hover{border-color:#3a4048}
    .kuro-item.kuro-drag-over{border-color:#3fb950;box-shadow:0 0 0 1px #3fb950}
    .kuro-item.kuro-dragging{opacity:.4}
    .kuro-item-check{display:flex;align-items:flex-start;padding-top:4px}
    .kuro-item-check input[type="checkbox"]{width:16px;height:16px;cursor:pointer;accent-color:#3fb950}
    .kuro-thumb{width:70px;height:56px;background:#1a1d21;border:1px solid #2a2f35;border-radius:10px;overflow:hidden;display:flex;align-items:center;justify-content:center;font-size:11px;color:#777}
    .kuro-thumb img{width:100%;height:100%;object-fit:cover;display:block}
    .kuro-item a{color:#8fd1ff;text-decoration:none}
    .kuro-item a:hover{text-decoration:underline}
    .kuro-mini{font-size:12px;color:#9ca3af}
    .kuro-row-actions{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}
    .kuro-status-line{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:4px}

    /* === Title truncation (#19) === */
    .kuro-title-line{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;min-width:0}
    .kuro-title-line strong{font-size:14px;line-height:1.35;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;word-break:break-all}
    .kuro-title-line a{min-width:0}

    /* === Expandable body === */
    .kuro-note-edit{min-height:78px;resize:vertical;border-radius:10px}
    .kuro-meta{margin-top:6px;display:grid;gap:3px}
    .kuro-item-summary{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}
    .kuro-item-body{display:none;margin-top:10px;padding-top:10px;border-top:1px solid #24292e}
    .kuro-item.expanded .kuro-item-body{display:block}
    .kuro-collapse-hint{font-size:12px;color:#888;white-space:nowrap;flex-shrink:0}

    /* === Progress bar === */
    .kuro-progress{margin:8px 0;padding:8px;border:1px solid #333;border-radius:8px;background:#17191b}
    .kuro-progress-bar{height:8px;border-radius:999px;background:#2a2d31;overflow:hidden;margin-top:6px}
    .kuro-progress-fill{height:100%;width:0;background:#3fb950;transition:width .2s ease}

    /* === Toast notifications (#17) === */
    #${TOAST_CONTAINER_ID}{position:fixed;bottom:70px;left:16px;z-index:100000;display:flex;flex-direction:column;gap:8px;pointer-events:none}
    .kuro-toast{padding:10px 16px;border-radius:10px;font-size:13px;color:#fff;opacity:0;transform:translateX(-20px);transition:opacity .25s ease,transform .25s ease;max-width:360px;pointer-events:auto;box-shadow:0 4px 16px rgba(0,0,0,.35)}
    .kuro-toast.show{opacity:1;transform:translateX(0)}
    .kuro-toast-success{background:#1a7f37}
    .kuro-toast-info{background:#1a3a5c}
    .kuro-toast-error{background:#7f1a1a}
    .kuro-toast-warning{background:#7f5c1a}

    /* === Empty state (#14) === */
    .kuro-empty-state{text-align:center;padding:32px 16px;color:#666}
    .kuro-empty-state .kuro-empty-icon{font-size:36px;margin-bottom:12px}
    .kuro-empty-state .kuro-empty-text{font-size:14px;color:#888;line-height:1.6}

    /* === Keyboard shortcut hint === */
    .kuro-kbd-hint{font-size:11px;color:#666;margin-top:4px}

    /* === Import preview modal === */
    .kuro-import-preview{position:fixed;inset:0;z-index:100001;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.6);opacity:0;transition:opacity .2s ease}
    .kuro-import-preview.show{opacity:1}
    .kuro-import-preview-content{background:#0f1113;border:1px solid #2a2f35;border-radius:16px;padding:24px;max-width:420px;width:90%;color:#fff;box-shadow:0 18px 50px rgba(0,0,0,.5)}
    .kuro-import-preview h3{margin:0 0 16px;font-size:16px}
    .kuro-import-stat{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #24292e;font-size:13px}
    .kuro-import-actions{display:flex;gap:8px;margin-top:16px;justify-content:flex-end}

    /* === Mobile responsive (#16) === */
    @media(max-width:640px){
      #${PANEL_ID}{right:8px;left:8px;bottom:54px;width:auto;max-height:80vh;border-radius:12px}
      #${PANEL_ID}.max{width:auto}
      #${PANEL_ID} .body{padding:10px 12px}
      #${TOGGLE_ID}{right:8px;bottom:8px;padding:8px 14px;font-size:13px}
      .kuro-toolbar{grid-template-columns:1fr;gap:6px}
      .kuro-toolbar-secondary{grid-template-columns:1fr 1fr;gap:6px}
      .kuro-toolbar-secondary .kuro-summary-bar{grid-column:1/-1}
      .kuro-item{grid-template-columns:24px 50px 1fr;gap:6px;padding:8px}
      .kuro-item .kuro-order-tools{display:none}
      .kuro-thumb{width:50px;height:42px}
      .kuro-actions-grid{gap:6px}
      .kuro-actions-grid .kuro-btn{font-size:11px;padding:4px 8px}
      .kuro-btn{padding:6px 12px;font-size:13px;min-height:36px}
      .kuro-icon-btn{padding:4px 10px;font-size:14px;min-width:36px;min-height:36px}
      .kuro-filter-grid{flex-direction:column;gap:8px}
      .kuro-batch-bar{flex-direction:column;align-items:stretch;gap:6px}
      #${TOAST_CONTAINER_ID}{left:8px;right:8px;bottom:62px}
      .kuro-toast{max-width:100%}
    }
  `;
  document.head.appendChild(style);
}
