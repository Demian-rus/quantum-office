/* Presentation-only print options. Never persisted into QWORK or applied globally. */
const QW_PRINT_THEMES={academic:'QX Academic Tech',scientific:'QX Scientific',minimal:'QX Minimal'};
function qwPrintTheme(options={}){
 const id=options.theme||'';
 if(id&&!Object.hasOwn(QW_PRINT_THEMES,id))throw Error('Неизвестная тема печати');
 return {id,monochrome:options.monochrome===true,name:QW_PRINT_THEMES[id]||''};
}
function qwPrintBrand(theme){
 if(!theme.id)return '';
 const mark=theme.id==='scientific'?'<path d="M16 1 31 16 16 31 1 16Z M8 16h16M16 8v16"/>':theme.id==='academic'?'<path d="M2 2h23v23H2Z M11 11l19 19M21 11 11 21"/>':'<path d="M3 5h19v19H3Z M15 17l14 14M25 6l6 6m0-6-6 6"/>';
 return '<div class="qw-print-brand"><svg viewBox="0 0 34 34" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.4">'+mark+'</svg><strong>Квант Икс | QX</strong><span>'+theme.name+'</span></div>';
}
function qwPrintThemeStyles(){return `
body[data-qw-theme]{--qw-accent:#2458a6;--qw-rule:#aebed2;--qw-ink:#1e293b;color:var(--qw-ink)}
body[data-qw-theme] .qw-print-header{border-top:1mm solid var(--qw-accent);padding-top:3mm;margin-bottom:5mm}
.qw-print-brand{display:flex;align-items:center;gap:2.5mm;color:var(--qw-accent);font:700 9pt/1.2 "QO Print Sans",sans-serif;margin-bottom:5mm}
.qw-print-brand svg{width:8mm;height:8mm;flex:none}
.qw-print-brand>span{margin-left:auto;font:8pt/1.2 "QO Print Sans",sans-serif;letter-spacing:.02em}
body[data-qw-theme] .qw-print-title{font-size:20pt;line-height:1.15;letter-spacing:-.02em;margin-bottom:2mm}
body[data-qw-theme] .qw-topic-title{color:var(--qw-accent);border-bottom:.25mm solid var(--qw-rule);padding-bottom:1.3mm}
body[data-qw-theme] .qw-print-number{color:var(--qw-accent)}
body[data-qw-theme] .qw-page-footer{border-top:.25mm solid var(--qw-rule);padding-top:2mm;color:var(--qw-ink)}
body[data-qw-theme="scientific"]{--qw-print-family:"QO Print Serif",serif;--qw-accent:#252d38;--qw-rule:#777}
body[data-qw-theme="scientific"] .qw-print-header{border-top:.25mm solid #333;border-bottom:.6mm double #333;padding-bottom:3mm}
body[data-qw-theme="scientific"] .qw-print-title{font:700 21pt/1.1 "QO Print Serif",serif;letter-spacing:0}
body[data-qw-theme="scientific"] .qw-topic-title{font-family:"QO Print Serif",serif;border-bottom:.2mm solid #555}
body[data-qw-theme="scientific"] .qw-print-brand{letter-spacing:.06em}
body[data-qw-theme="minimal"]{--qw-accent:#181818;--qw-rule:#b0b0b0}
body[data-qw-theme="minimal"] .qw-print-header{border:0;padding-top:0;margin-bottom:7mm}
body[data-qw-theme="minimal"] .qw-print-title{font-size:24pt;font-weight:400;letter-spacing:-.035em}
body[data-qw-theme="minimal"] .qw-print-brand{color:#111;margin-bottom:7mm}
body[data-qw-theme="minimal"] .qw-print-brand>span{display:none}
body[data-qw-theme="minimal"] .qw-topic-title{font-size:11pt;border:0;padding:0;margin-top:3mm}
body[data-qw-monochrome="true"]{--qw-accent:#222;--qw-rule:#888;--qw-ink:#222}
body[data-qw-monochrome="true"] .qw-print-section:before{background:#ddd!important}

`;}
export {QW_PRINT_THEMES,qwPrintTheme,qwPrintBrand,qwPrintThemeStyles};
