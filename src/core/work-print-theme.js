/* Print-only options; internal IDs are never printed or stored in QWORK. */
const QW_PRINT_THEMES={academic:'Квант Икс | QX',scientific:'Квант Икс | QX',minimal:'Квант Икс | QX'};
function qwPrintTheme(options={}){
 const id=options.theme||'';
 if(id&&!Object.hasOwn(QW_PRINT_THEMES,id))throw Error('Неизвестная тема печати');
 return {id,monochrome:options.monochrome===true,name:QW_PRINT_THEMES[id]||''};
}
function qwPrintBrand(theme){
 if(!theme.id)return '';
 return '<div class="qw-print-brand">Квант Икс | QX</div>';
}
function qwPrintThemeStyles(){return `
body[data-qw-theme]{--qw-accent:#2458a6;--qw-rule:#aebed2;color:#111}
body[data-qw-theme] .qw-print-page:before{content:"";position:absolute;left:12mm;right:12mm;top:4mm;height:.4mm;background:var(--qw-accent)}
.qw-print-brand{position:absolute;right:12mm;top:7.3mm;margin:0;color:#555;font:7pt/1.2 "QO Print Sans",sans-serif;white-space:nowrap}
body[data-qw-theme] .qw-print-topic{color:#b42318}
body[data-qw-theme] .qw-page-footer{color:#555}
body[data-qw-theme="scientific"]{--qw-print-family:"QO Print Serif",serif;--qw-accent:#41454c;--qw-rule:#aaa}
body[data-qw-theme="minimal"]{--qw-accent:#555;--qw-rule:#ccc}
body[data-qw-theme="minimal"] .qw-print-page:before{right:auto;width:18mm;height:.3mm}
body[data-qw-format="booklet"][data-qw-theme] .qw-print-page:before{top:4mm;left:13mm;right:13mm;height:.23mm;background:var(--qw-rule)}
body[data-qw-format="booklet"] .qw-booklet-brand{right:13mm;top:6mm;display:flex;align-items:baseline;gap:2mm;color:#1b2e43;white-space:nowrap}
body[data-qw-format="booklet"] .qw-booklet-brand strong{font:800 17pt/1 "QO Print Sans",Arial,sans-serif;letter-spacing:-.08em}
body[data-qw-format="booklet"] .qw-booklet-brand span{font:600 6.3pt/1 "QO Print Sans",Arial,sans-serif;letter-spacing:.13em}
body[data-qw-format="booklet"][data-qw-theme="academic"] .qw-booklet-brand strong{color:#2458a6}
body[data-qw-format="booklet"][data-qw-theme="scientific"] .qw-booklet-brand{color:#2f3743}
body[data-qw-format="booklet"][data-qw-theme="scientific"] .qw-booklet-brand strong{font-family:"QO Print Serif",Georgia,serif;font-weight:700;letter-spacing:-.04em}
body[data-qw-format="booklet"][data-qw-theme="minimal"] .qw-booklet-brand strong{color:#171717;font-size:15pt}
body[data-qw-format="booklet"][data-qw-theme="minimal"] .qw-booklet-brand span{font-size:6pt;color:#555}
body[data-qw-format="booklet"][data-qw-monochrome="true"] .qw-booklet-brand strong{color:#222}
body[data-qw-monochrome="true"]{--qw-accent:#222;--qw-rule:#888}
body[data-qw-monochrome="true"] .qw-print-section:before{background:#ddd!important}
body[data-qw-monochrome="true"] :is(.qw-print-topic,.qw-topic-title){color:#222!important}
`;}
export {QW_PRINT_THEMES,qwPrintTheme,qwPrintBrand,qwPrintThemeStyles};
