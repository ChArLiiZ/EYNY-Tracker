import { STYLE_ID, PANEL_ID, TOGGLE_ID } from './constants.js';

export function injectStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .kuro-actions{display:flex;gap:4px;flex-wrap:wrap;margin-top:4px;align-items:center}
    .kuro-btn{border:1px solid #3a3f44;background:#16181a;color:#f3f4f6;border-radius:10px;padding:5px 10px;font-size:12px;cursor:pointer;line-height:1.6;transition:all .15s ease}
    .kuro-btn:hover{background:#202326;border-color:#4a5258}
    .kuro-btn.active{outline:2px solid #ffffff22;border-color:#6b7280}
    .kuro-icon-btn{border:1px solid #3a3f44;background:#16181a;color:#e5e7eb;border-radius:9px;padding:1px 6px;font-size:12px;cursor:pointer;line-height:1.5;min-width:28px;transition:all .15s ease}
    .kuro-icon-btn:hover{background:#202326;border-color:#4a5258}
    .kuro-icon-btn.active{outline:2px solid #ffffff22}
    .kuro-badge{display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:999px;font-size:11px;color:#111;font-weight:700;margin-left:6px;letter-spacing:.2px}
    .kuro-seen{opacity:.55}
    .kuro-todo{box-shadow: inset 0 0 0 2px rgba(246,195,68,.45)}
    .kuro-downloaded{box-shadow: inset 0 0 0 2px rgba(63,185,80,.45)}
    #${TOGGLE_ID}{position:fixed;right:16px;bottom:16px;z-index:99999;background:#0f1113;color:#fff;border:1px solid #2f3338;border-radius:999px;padding:10px 16px;cursor:pointer;box-shadow:0 10px 24px rgba(0,0,0,.25)}
    #${PANEL_ID}{position:fixed;right:16px;bottom:60px;width:min(760px, calc(100vw - 32px));max-height:84vh;background:#0f1113;color:#fff;border:1px solid #2a2f35;border-radius:16px;z-index:99999;display:none;overflow:hidden;box-shadow:0 18px 50px rgba(0,0,0,.45)}
    #${PANEL_ID}.show{display:block}
    #${PANEL_ID}.max{width:min(1100px, calc(100vw - 32px));max-height:90vh}
    #${PANEL_ID} header{padding:14px 16px;border-bottom:1px solid #24292e;font-weight:700;font-size:15px;background:linear-gradient(180deg,#121519,#0f1113);display:flex;align-items:center;justify-content:space-between;gap:12px}
    #${PANEL_ID} .body{padding:14px 16px;overflow:auto;max-height:66vh}
    #${PANEL_ID}.max .body{max-height:72vh}
    #${PANEL_ID} input,#${PANEL_ID} select,#${PANEL_ID} textarea{width:100%;box-sizing:border-box;margin:6px 0;padding:8px;border-radius:8px;border:1px solid #444;background:#181a1b;color:#fff}
    .kuro-toolbar{display:grid;grid-template-columns:minmax(0,1fr) 160px;gap:10px;align-items:center;margin-bottom:10px}
    .kuro-toolbar-secondary{display:grid;grid-template-columns:180px 130px 1fr;gap:10px;align-items:center;margin-bottom:10px}
    .kuro-order-tools{display:flex;flex-direction:column;gap:6px;align-items:center;justify-content:flex-start}
    .kuro-order-tools .kuro-btn{padding:2px 8px;min-width:34px}
    .kuro-order-input{width:36px !important; margin:0 !important; padding:4px 4px !important; text-align:center; font-size:12px !important; -moz-appearance:textfield}
    .kuro-order-input::-webkit-outer-spin-button,
    .kuro-order-input::-webkit-inner-spin-button{appearance:none;-webkit-appearance:none;margin:0}
    .kuro-order-label{font-size:12px;color:#9ca3af;line-height:1}
    .kuro-actions-grid{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;margin-bottom:8px}
    .kuro-summary-bar{padding:8px 10px;background:#14181c;border:1px solid #232930;border-radius:10px;margin-bottom:10px}
    .kuro-item{border:1px solid #262b31;border-radius:14px;padding:10px;margin-bottom:10px;display:grid;grid-template-columns:22px 70px 1fr;gap:12px;background:#13161a}
    .kuro-thumb{width:70px;height:56px;background:#1a1d21;border:1px solid #2a2f35;border-radius:10px;overflow:hidden;display:flex;align-items:center;justify-content:center;font-size:11px;color:#777}
    .kuro-thumb img{width:100%;height:100%;object-fit:cover;display:block}
    .kuro-item a{color:#8fd1ff;text-decoration:none}
    .kuro-item a:hover{text-decoration:underline}
    .kuro-mini{font-size:12px;color:#9ca3af}
    .kuro-row-actions{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}
    .kuro-status-line{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:4px}
    .kuro-title-line{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}
    .kuro-title-line strong{font-size:14px;line-height:1.35}
    .kuro-note-edit{min-height:78px;resize:vertical;border-radius:10px}
    .kuro-meta{margin-top:6px;display:grid;gap:3px}
    .kuro-item-summary{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}
    .kuro-item-body{display:none;margin-top:10px;padding-top:10px;border-top:1px solid #24292e}
    .kuro-item.expanded .kuro-item-body{display:block}
    .kuro-collapse-hint{font-size:12px;color:#888;white-space:nowrap}
    .kuro-progress{margin:8px 0;padding:8px;border:1px solid #333;border-radius:8px;background:#17191b}
    .kuro-progress-bar{height:8px;border-radius:999px;background:#2a2d31;overflow:hidden;margin-top:6px}
    .kuro-progress-fill{height:100%;width:0;background:#3fb950;transition:width .2s ease}
  `;
  document.head.appendChild(style);
}
