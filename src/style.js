import { STYLE_ID, PANEL_ID, TOGGLE_ID, TOAST_CONTAINER_ID } from './constants.js';

export function injectStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    /* ============================================================
       EYNY Tracker — Glassmorphism Dark Theme
       ============================================================ */

    /* === Design tokens === */
    :root {
      --k-glass: rgba(18, 20, 24, .72);
      --k-glass-heavy: rgba(12, 13, 16, .82);
      --k-glass-light: rgba(255, 255, 255, .04);
      --k-glass-hover: rgba(255, 255, 255, .07);
      --k-border: rgba(255, 255, 255, .08);
      --k-border-hover: rgba(255, 255, 255, .16);
      --k-border-focus: rgba(255, 255, 255, .22);
      --k-text: rgba(255, 255, 255, .88);
      --k-text-dim: rgba(255, 255, 255, .45);
      --k-text-muted: rgba(255, 255, 255, .3);
      --k-accent: #6ea8fe;
      --k-todo: #f0c351;
      --k-seen: #6ec8f5;
      --k-downloaded: #6b7280;
      --k-skipped: #9b7280;
      --k-radius: 14px;
      --k-radius-sm: 10px;
      --k-blur: 24px;
      --k-transition: .2s cubic-bezier(.4,0,.2,1);
    }

    /* === Buttons === */
    .kuro-actions{display:flex;gap:5px;flex-wrap:wrap;margin-top:5px;align-items:center}

    .kuro-btn{
      border:1px solid var(--k-border);
      background:var(--k-glass-light);
      color:var(--k-text);
      border-radius:var(--k-radius-sm);
      padding:5px 12px;font-size:12px;cursor:pointer;line-height:1.6;
      transition:all var(--k-transition);
      font-family:inherit;
    }
    .kuro-btn:hover{background:var(--k-glass-hover);border-color:var(--k-border-hover);box-shadow:0 0 0 1px rgba(255,255,255,.04)}
    .kuro-btn.active{border-color:var(--k-accent);box-shadow:0 0 12px rgba(110,168,254,.15);color:#fff}
    .kuro-btn:disabled{opacity:.3;cursor:not-allowed;box-shadow:none}

    .kuro-icon-btn{
      border:1px solid var(--k-border);
      background:var(--k-glass-light);
      color:var(--k-text);
      border-radius:var(--k-radius-sm);
      padding:2px 7px;font-size:12px;cursor:pointer;line-height:1.5;min-width:28px;
      transition:all var(--k-transition);
      font-family:inherit;
    }
    .kuro-icon-btn:hover{background:var(--k-glass-hover);border-color:var(--k-border-hover)}
    .kuro-icon-btn.active{border-color:var(--k-accent);box-shadow:0 0 12px rgba(110,168,254,.12)}

    /* Forum page icon buttons — light theme integration */
    body:not(#_) .kuro-actions:not(#${PANEL_ID} .kuro-actions) .kuro-icon-btn{
      background:rgba(240,242,245,.92);
      border:1px solid rgba(0,0,0,.1);
      color:#555;
      border-radius:6px;
      padding:2px 6px;font-size:13px;
      box-shadow:0 1px 3px rgba(0,0,0,.06);
      filter:grayscale(.3);
    }
    body:not(#_) .kuro-actions:not(#${PANEL_ID} .kuro-actions) .kuro-icon-btn:hover{
      background:rgba(255,255,255,.95);
      border-color:rgba(0,0,0,.18);
      box-shadow:0 2px 8px rgba(0,0,0,.1);
      filter:grayscale(0);
      transform:translateY(-1px);
    }
    body:not(#_) .kuro-actions:not(#${PANEL_ID} .kuro-actions) .kuro-icon-btn.active{
      background:rgba(110,168,254,.12);
      border-color:rgba(110,168,254,.4);
      box-shadow:0 0 8px rgba(110,168,254,.15);
      filter:grayscale(0);
    }

    .kuro-badge{
      display:inline-flex;align-items:center;gap:4px;
      padding:2px 9px;border-radius:999px;
      font-size:10px;font-weight:600;letter-spacing:.4px;text-transform:uppercase;
      margin-left:6px;
      border:1px solid rgba(255,255,255,.1);
    }

    /* Forum page actions container — light theme */
    body:not(#_) .kuro-actions:not(#${PANEL_ID} .kuro-actions){
      gap:4px;margin-top:4px;
    }

    /* Forum page full-text buttons — light theme */
    body:not(#_) .kuro-actions:not(#${PANEL_ID} .kuro-actions) .kuro-btn{
      background:rgba(240,242,245,.92);
      border:1px solid rgba(0,0,0,.1);
      color:#333;
      border-radius:6px;
      box-shadow:0 1px 3px rgba(0,0,0,.06);
    }
    body:not(#_) .kuro-actions:not(#${PANEL_ID} .kuro-actions) .kuro-btn:hover{
      background:rgba(255,255,255,.95);
      border-color:rgba(0,0,0,.18);
      box-shadow:0 2px 8px rgba(0,0,0,.1);
    }
    body:not(#_) .kuro-actions:not(#${PANEL_ID} .kuro-actions) .kuro-btn.active{
      background:rgba(110,168,254,.12);
      border-color:rgba(110,168,254,.4);
      color:#1a6dca;
    }

    /* Forum page skip-all button — light theme */
    .kuro-skip-all-wrap .kuro-btn{
      background:rgba(155,114,128,.1);
      border:1px solid rgba(155,114,128,.25);
      color:#7a5060;
      border-radius:6px;
      padding:6px 14px;font-size:13px;
      box-shadow:0 1px 3px rgba(0,0,0,.06);
    }
    .kuro-skip-all-wrap .kuro-btn:hover{
      background:rgba(155,114,128,.18);
      border-color:rgba(155,114,128,.4);
      box-shadow:0 2px 8px rgba(155,114,128,.15);
    }

    /* Forum page inline note — light theme */
    body:not(#_) .kuro-inline-note:not(#${PANEL_ID} .kuro-inline-note) textarea{
      background:rgba(255,255,255,.9);
      border-color:rgba(0,0,0,.15);
      color:#333;
    }
    body:not(#_) .kuro-inline-note:not(#${PANEL_ID} .kuro-inline-note) textarea:focus{
      border-color:rgba(110,168,254,.5);
    }

    /* Forum page badge — light theme */
    body:not(#_) .kuro-badge:not(#${PANEL_ID} .kuro-badge){
      color:#fff;
      border:none;
      font-size:10px;
      text-shadow:0 1px 2px rgba(0,0,0,.2);
    }

    /* === Visual states on forum pages === */
    .kuro-todo{box-shadow:inset 0 0 0 2px rgba(240,195,81,.35)}
    .kuro-seen{box-shadow:inset 0 0 0 2px rgba(110,200,245,.4)}
    .kuro-downloaded{opacity:.45}
    .kuro-skipped{opacity:.4;box-shadow:inset 0 0 0 2px rgba(155,114,128,.3)}

    /* === Inline note on forum pages === */
    .kuro-inline-note{margin-top:6px;display:flex;gap:6px;align-items:flex-start}
    .kuro-inline-note textarea{
      flex:1;min-height:48px;resize:vertical;
      padding:8px 10px;border-radius:var(--k-radius-sm);
      border:1px solid var(--k-border);
      background:var(--k-glass-light);
      color:var(--k-text);font-size:12px;box-sizing:border-box;
      transition:border-color var(--k-transition);
    }
    .kuro-inline-note textarea:focus{outline:none;border-color:var(--k-border-focus)}
    .kuro-inline-note button{flex-shrink:0}

    /* === Keyboard shortcut hint on thread pages === */
    .kuro-kbd-bar{font-size:11px;color:#999;margin-top:6px;line-height:1.8}
    .kuro-kbd-bar kbd{
      background:rgba(0,0,0,.06);
      border:1px solid rgba(0,0,0,.12);
      border-radius:3px;padding:1px 5px;font-size:10px;
      font-family:inherit;margin:0 1px;
    }

    /* === Toggle button === */
    #${TOGGLE_ID}{
      position:fixed;right:18px;bottom:18px;z-index:99999;
      background:var(--k-glass-heavy);
      backdrop-filter:blur(var(--k-blur));-webkit-backdrop-filter:blur(var(--k-blur));
      color:#fff;
      border:1px solid var(--k-border);
      border-radius:999px;padding:10px 18px;
      cursor:pointer;font-size:13px;font-weight:500;font-family:inherit;
      box-shadow:0 8px 32px rgba(0,0,0,.4),inset 0 1px 0 rgba(255,255,255,.06);
      transition:all var(--k-transition);
      display:flex;align-items:center;gap:6px;
    }
    #${TOGGLE_ID}:hover{
      transform:translateY(-1px);
      box-shadow:0 12px 40px rgba(0,0,0,.5),inset 0 1px 0 rgba(255,255,255,.08);
      border-color:var(--k-border-hover);
    }
    .kuro-toggle-count{
      background:rgba(110,168,254,.25);
      color:var(--k-accent);
      border-radius:999px;padding:0 7px;
      font-size:11px;font-weight:600;
      min-width:18px;text-align:center;
      line-height:18px;
    }

    /* === Panel === */
    #${PANEL_ID}{
      position:fixed;right:18px;bottom:64px;
      width:min(760px,calc(100vw - 36px));max-height:84vh;
      background:var(--k-glass-heavy);
      backdrop-filter:blur(var(--k-blur));-webkit-backdrop-filter:blur(var(--k-blur));
      color:var(--k-text);
      border:1px solid var(--k-border);
      border-radius:20px;
      z-index:99999;overflow:hidden;
      box-shadow:0 24px 80px rgba(0,0,0,.55),inset 0 1px 0 rgba(255,255,255,.05);
      opacity:0;transform:translateY(16px) scale(.98);
      pointer-events:none;visibility:hidden;
      transition:opacity .3s cubic-bezier(.4,0,.2,1),transform .3s cubic-bezier(.4,0,.2,1);
    }
    #${PANEL_ID}.show{opacity:1;transform:translateY(0) scale(1);pointer-events:auto;visibility:visible}
    #${PANEL_ID}.max{width:min(1100px,calc(100vw - 36px));max-height:90vh}

    #${PANEL_ID} header{
      padding:16px 20px;
      border-bottom:1px solid var(--k-border);
      font-weight:600;font-size:15px;letter-spacing:.3px;
      background:rgba(255,255,255,.02);
      display:flex;align-items:center;justify-content:space-between;gap:12px;
    }
    #${PANEL_ID} .body{padding:16px 20px;overflow:auto;max-height:66vh}
    #${PANEL_ID}.max .body{max-height:72vh}

    /* Scrollbar */
    #${PANEL_ID} .body::-webkit-scrollbar{width:5px}
    #${PANEL_ID} .body::-webkit-scrollbar-track{background:transparent}
    #${PANEL_ID} .body::-webkit-scrollbar-thumb{background:rgba(255,255,255,.1);border-radius:999px}
    #${PANEL_ID} .body::-webkit-scrollbar-thumb:hover{background:rgba(255,255,255,.18)}

    /* Form elements — no inner blur, panel already blurs */
    #${PANEL_ID} input,#${PANEL_ID} select,#${PANEL_ID} textarea{
      width:100%;box-sizing:border-box;margin:6px 0;padding:9px 12px;
      border-radius:var(--k-radius-sm);
      border:1px solid var(--k-border);
      background:var(--k-glass-light);
      color:var(--k-text);font-size:13px;font-family:inherit;
      transition:border-color var(--k-transition),box-shadow var(--k-transition);
    }
    #${PANEL_ID} input:focus,#${PANEL_ID} select:focus,#${PANEL_ID} textarea:focus{
      outline:none;border-color:var(--k-border-focus);
      box-shadow:0 0 0 3px rgba(110,168,254,.08);
    }
    #${PANEL_ID} input::placeholder,#${PANEL_ID} textarea::placeholder{color:var(--k-text-muted)}
    #${PANEL_ID} input[type="checkbox"]{width:auto;margin:0}
    #${PANEL_ID} input[type="date"]{width:auto;padding:5px 10px;margin:2px 0}
    #${PANEL_ID} select{cursor:pointer;appearance:none;
      background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='rgba(255,255,255,.4)' viewBox='0 0 16 16'%3E%3Cpath d='M8 11L3 6h10z'/%3E%3C/svg%3E");
      background-repeat:no-repeat;background-position:right 10px center;padding-right:28px;
    }

    /* === Close button === */
    .kuro-close-btn{
      background:var(--k-glass-light);border:1px solid var(--k-border);
      color:var(--k-text-dim);font-size:16px;cursor:pointer;
      width:30px;height:30px;border-radius:50%;
      display:flex;align-items:center;justify-content:center;
      transition:all var(--k-transition);
    }
    .kuro-close-btn:hover{color:#fff;background:var(--k-glass-hover);border-color:var(--k-border-hover)}

    /* === Toolbar === */
    .kuro-toolbar{margin-bottom:10px}
    .kuro-toolbar-secondary{display:grid;grid-template-columns:180px 130px;gap:10px;align-items:center;margin-bottom:10px}

    /* === Filter pills === */
    .kuro-filter-pills{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px}
    .kuro-pill{
      border:1px solid var(--k-border);
      background:var(--k-glass-light);
      color:var(--k-text-dim);
      border-radius:999px;padding:4px 12px;font-size:11px;cursor:pointer;
      transition:all var(--k-transition);font-family:inherit;
      display:flex;align-items:center;gap:5px;
      white-space:nowrap;
    }
    .kuro-pill:hover{border-color:var(--k-border-hover);color:var(--k-text)}
    .kuro-pill.active{border-color:var(--k-accent);color:#fff;background:rgba(110,168,254,.12)}
    .kuro-pill-count{
      background:rgba(255,255,255,.1);
      border-radius:999px;padding:0 6px;font-size:10px;
      min-width:16px;text-align:center;line-height:16px;
    }
    .kuro-pill.active .kuro-pill-count{background:rgba(110,168,254,.25)}

    /* === Advanced filters === */
    .kuro-advanced-filters{
      margin-bottom:12px;
      border:1px solid var(--k-border);
      border-radius:var(--k-radius-sm);
      background:var(--k-glass-light);
    }
    .kuro-advanced-filters summary{padding:9px 14px;cursor:pointer;font-size:12px;color:var(--k-text-dim);user-select:none;transition:color var(--k-transition)}
    .kuro-advanced-filters summary:hover{color:var(--k-text)}
    .kuro-advanced-filters[open]{border-color:var(--k-border-hover)}
    .kuro-filter-grid{padding:4px 14px 14px;display:flex;gap:14px;flex-wrap:wrap;align-items:center}
    .kuro-filter-grid label{font-size:12px;color:var(--k-text-dim);display:flex;align-items:center;gap:5px;cursor:pointer}

    /* === Batch action bar — no inner blur === */
    .kuro-batch-bar{
      padding:10px 14px;
      background:rgba(110,168,254,.06);
      border:1px solid rgba(110,168,254,.15);
      border-radius:var(--k-radius-sm);
      margin-bottom:12px;display:flex;gap:8px;align-items:center;flex-wrap:wrap;
    }
    .kuro-batch-bar .kuro-mini{margin-right:auto;color:var(--k-accent)}

    /* === Summary bar with stat visualization === */
    .kuro-summary-bar{
      padding:8px 12px;
      background:var(--k-glass-light);
      border:1px solid var(--k-border);
      border-radius:var(--k-radius-sm);
      margin-bottom:12px;
      font-size:12px;color:var(--k-text-dim);
    }
    .kuro-stat-bar{display:flex;height:4px;border-radius:999px;overflow:hidden;margin-top:6px;background:rgba(255,255,255,.06)}
    .kuro-stat-segment{height:100%;transition:width .3s ease}

    /* === Action grid === */
    .kuro-actions-grid{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;margin-bottom:10px}

    /* === Item card — no inner blur === */
    .kuro-item{
      border:1px solid var(--k-border);
      border-radius:var(--k-radius);
      padding:12px;margin-bottom:10px;
      display:grid;grid-template-columns:70px 1fr;gap:12px;
      background:var(--k-glass-light);
      transition:all var(--k-transition);
    }
    .kuro-item:hover{border-color:var(--k-border-hover);background:var(--k-glass-hover)}
    .kuro-item.kuro-drag-over{border-color:var(--k-downloaded);box-shadow:0 0 16px rgba(88,214,141,.12)}
    .kuro-item.kuro-dragging{opacity:.35;transform:scale(.98)}
    .kuro-item-manual{grid-template-columns:36px 70px 1fr}

    /* === Order column (manual mode) === */
    .kuro-order-col{
      display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;
    }
    .kuro-order-col .kuro-btn{padding:1px 6px;min-width:0;font-size:11px;line-height:1.3;border-radius:6px}
    .kuro-order-input{width:32px !important;margin:0 !important;padding:2px !important;text-align:center;font-size:11px !important;-moz-appearance:textfield;border-radius:6px !important}
    .kuro-order-input::-webkit-outer-spin-button,
    .kuro-order-input::-webkit-inner-spin-button{appearance:none;-webkit-appearance:none;margin:0}

    .kuro-thumb{cursor:pointer;position:relative;
      width:70px;height:56px;
      background:rgba(255,255,255,.03);
      border:1px solid var(--k-border);
      border-radius:var(--k-radius-sm);
      overflow:hidden;display:flex;align-items:center;justify-content:center;
      font-size:10px;color:var(--k-text-muted);
    }
    .kuro-thumb img{width:100%;height:100%;object-fit:cover;display:block}
    .kuro-thumb.selected::after{
      content:'\\2713';position:absolute;inset:0;
      display:flex;align-items:center;justify-content:center;
      background:rgba(110,168,254,.55);
      color:#fff;font-size:20px;font-weight:700;
      border-radius:var(--k-radius-sm);
    }
    .kuro-thumb:hover::before{
      content:'';position:absolute;inset:0;
      background:rgba(255,255,255,.06);
      border-radius:var(--k-radius-sm);
      pointer-events:none;
    }

    .kuro-item a{color:var(--k-accent);text-decoration:none;transition:color var(--k-transition)}
    .kuro-item a:hover{color:#93bcff;text-decoration:none}
    .kuro-mini{font-size:12px;color:var(--k-text-dim)}
    .kuro-row-actions{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}
    .kuro-status-line{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:5px}

    /* === Title === */
    .kuro-title-line{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;min-width:0}
    .kuro-title-line strong{font-size:13.5px;font-weight:500;line-height:1.4;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;word-break:break-all;color:rgba(255,255,255,.92)}
    .kuro-title-line a{min-width:0}

    /* === Note preview (collapsed) === */
    .kuro-note-preview{
      font-size:11px;color:var(--k-text-muted);
      margin-top:4px;
      overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
      max-width:100%;font-style:italic;
    }

    /* === Expandable body with animation === */
    .kuro-note-edit{min-height:78px;resize:vertical;border-radius:var(--k-radius-sm)}
    .kuro-meta{margin-top:6px;display:grid;gap:4px}
    .kuro-item-summary{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}
    .kuro-item-body{
      max-height:0;overflow:hidden;opacity:0;
      transition:max-height .3s cubic-bezier(.4,0,.2,1),opacity .25s ease,margin .2s ease,padding .2s ease,border-color .2s ease;
      margin-top:0;padding-top:0;
      border-top:1px solid transparent;
    }
    .kuro-item.expanded .kuro-item-body{
      max-height:600px;opacity:1;
      margin-top:12px;padding-top:12px;
      border-top-color:var(--k-border);
    }
    .kuro-collapse-hint{
      font-size:11px;color:var(--k-text-muted);white-space:nowrap;flex-shrink:0;
      border:1px solid var(--k-border);background:transparent;
      padding:3px 10px;border-radius:999px;cursor:pointer;
      transition:all var(--k-transition);font-family:inherit;
    }
    .kuro-collapse-hint:hover{border-color:var(--k-border-hover);color:var(--k-text-dim)}

    /* === Progress bar === */
    .kuro-progress{
      margin:8px 0;padding:10px 12px;
      border:1px solid var(--k-border);
      border-radius:var(--k-radius-sm);
      background:var(--k-glass-light);
      font-size:12px;color:var(--k-text-dim);
    }
    .kuro-progress-bar{height:6px;border-radius:999px;background:rgba(255,255,255,.06);overflow:hidden;margin-top:8px}
    .kuro-progress-fill{height:100%;width:0;background:linear-gradient(90deg,var(--k-accent),var(--k-downloaded));border-radius:999px;transition:width .3s ease}

    /* === Toast notifications === */
    #${TOAST_CONTAINER_ID}{position:fixed;bottom:72px;left:18px;z-index:100000;display:flex;flex-direction:column;gap:8px;pointer-events:none}
    .kuro-toast{
      padding:11px 18px;
      border-radius:var(--k-radius-sm);
      font-size:13px;color:rgba(255,255,255,.92);
      border:1px solid var(--k-border);
      background:var(--k-glass-heavy);
      backdrop-filter:blur(var(--k-blur));-webkit-backdrop-filter:blur(var(--k-blur));
      opacity:0;transform:translateY(8px) scale(.96);
      transition:all .3s cubic-bezier(.4,0,.2,1);
      max-width:360px;pointer-events:auto;
      box-shadow:0 8px 32px rgba(0,0,0,.4);
      display:flex;align-items:center;gap:10px;
    }
    .kuro-toast.show{opacity:1;transform:translateY(0) scale(1)}
    .kuro-toast-success{border-left:3px solid var(--k-downloaded)}
    .kuro-toast-info{border-left:3px solid var(--k-accent)}
    .kuro-toast-error{border-left:3px solid #e74c3c}
    .kuro-toast-warning{border-left:3px solid var(--k-todo)}
    .kuro-toast-action{
      background:rgba(110,168,254,.2);
      border:1px solid rgba(110,168,254,.35);
      color:var(--k-accent);font-size:12px;font-weight:600;
      padding:3px 10px;border-radius:6px;cursor:pointer;
      font-family:inherit;white-space:nowrap;
      transition:all var(--k-transition);
    }
    .kuro-toast-action:hover{background:rgba(110,168,254,.35);border-color:rgba(110,168,254,.5)}

    /* === Empty state === */
    .kuro-empty-state{text-align:center;padding:40px 20px}
    .kuro-empty-state .kuro-empty-icon{font-size:40px;margin-bottom:14px;opacity:.6}
    .kuro-empty-state .kuro-empty-text{font-size:13px;color:var(--k-text-dim);line-height:1.7}

    /* === Import preview modal === */
    .kuro-import-preview{
      position:fixed;inset:0;z-index:100001;
      display:flex;align-items:center;justify-content:center;
      background:rgba(0,0,0,.5);
      backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);
      opacity:0;transition:opacity .25s ease;
    }
    .kuro-import-preview.show{opacity:1}
    .kuro-import-preview-content{
      background:var(--k-glass-heavy);
      backdrop-filter:blur(var(--k-blur));-webkit-backdrop-filter:blur(var(--k-blur));
      border:1px solid var(--k-border);
      border-radius:20px;padding:28px;
      max-width:420px;width:90%;color:var(--k-text);
      box-shadow:0 24px 80px rgba(0,0,0,.6);
    }
    .kuro-import-preview h3{margin:0 0 20px;font-size:16px;font-weight:600;letter-spacing:.3px}
    .kuro-import-stat{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--k-border);font-size:13px;color:var(--k-text-dim)}
    .kuro-import-stat strong{color:var(--k-text)}
    .kuro-import-actions{display:flex;gap:8px;margin-top:20px;justify-content:flex-end}

    /* === Pager === */
    .kuro-pager{justify-content:center;align-items:center;gap:12px;padding-top:4px}
    .kuro-page-info{font-size:12px;color:var(--k-text-dim)}

    /* === Mobile responsive === */
    @media(max-width:640px){
      #${PANEL_ID}{right:8px;left:8px;bottom:56px;width:auto;max-height:80vh;border-radius:16px}
      #${PANEL_ID}.max{width:auto}
      #${PANEL_ID} .body{padding:12px 14px}
      #${TOGGLE_ID}{right:10px;bottom:10px;padding:9px 16px;font-size:13px}
      .kuro-toolbar{grid-template-columns:1fr;gap:6px}
      .kuro-toolbar-secondary{grid-template-columns:1fr 1fr;gap:6px}
      .kuro-filter-pills{gap:4px}
      .kuro-pill{padding:3px 9px;font-size:10px}
      .kuro-item{grid-template-columns:50px 1fr;gap:8px;padding:10px}
      .kuro-item-manual{grid-template-columns:30px 50px 1fr}
      .kuro-order-col .kuro-btn{padding:1px 5px;font-size:10px}
      .kuro-thumb{width:50px;height:42px}
      .kuro-actions-grid{gap:6px}
      .kuro-actions-grid .kuro-btn{font-size:11px;padding:5px 10px}
      .kuro-btn{padding:7px 14px;font-size:13px;min-height:38px}
      .kuro-icon-btn{padding:5px 12px;font-size:14px;min-width:38px;min-height:38px}
      .kuro-filter-grid{flex-direction:column;gap:8px}
      .kuro-batch-bar{flex-direction:column;align-items:stretch;gap:6px}
      #${TOAST_CONTAINER_ID}{left:8px;right:8px;bottom:64px}
      .kuro-toast{max-width:100%}
    }
  `;
  document.head.appendChild(style);
}
