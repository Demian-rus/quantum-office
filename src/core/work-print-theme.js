/* Print-only options; internal IDs are never printed or stored in QWORK. */
const QW_PRINT_THEMES={academic:'Квант Икс | QX',scientific:'Квант Икс | QX',minimal:'Квант Икс | QX'};
function qwPrintTheme(options={}){
 const id=options.theme||'';
 if(id&&!Object.hasOwn(QW_PRINT_THEMES,id))throw Error('Неизвестная тема печати');
 return {id,monochrome:options.monochrome===true,name:QW_PRINT_THEMES[id]||''};
}
function qwPrintBrand(theme){
 if(!theme.id)return '';
 return '<div class="qw-print-brand">QX | Квант Икс</div>';
}
function qwPrintThemeStyles(){return `
/* TASK158: single paper-cut brand on each physical A4 sheet. */
body[data-qw-theme]{--qw-accent:#9cff00;--qw-rule:#111;color:#111}
body[data-qw-theme] .qw-print-page:before{content:none!important;display:none!important}
.qw-print-brand{
 position:absolute;right:0;top:0;z-index:5;
 box-sizing:border-box;min-width:42mm;min-height:11mm;
 display:flex!important;align-items:center;justify-content:flex-end;
 padding:2.4mm 4.2mm 2.3mm 8.3mm;margin:0;
 background:#070809;color:#9cff00;
 font:800 8pt/1.15 "QO Print Sans",Arial,sans-serif;
 letter-spacing:.015em;text-transform:none;white-space:nowrap;
 clip-path:polygon(0 0,100% 0,100% 100%,13% 100%,0 65%);
}
.qw-print-brand strong,.qw-print-brand span{font:inherit;color:inherit;letter-spacing:inherit}
body[data-qw-theme] .qw-print-topic{color:#111}
body[data-qw-theme] .qw-page-footer{color:#555}
body[data-qw-theme="scientific"]{--qw-print-family:"QO Print Serif",serif}
body[data-qw-theme="minimal"]{--qw-accent:#9cff00}
body[data-qw-format="booklet"] .qw-booklet-brand{
 right:0;top:0;display:flex!important;transform:none;
}
body[data-qw-orientation="landscape"][data-qw-landscape-layout="spread"] .qw-print-sheet>.qw-print-brand{
 right:0;top:0;transform:none;
}
body[data-qw-monochrome="true"] .qw-print-brand{background:#111;color:#fff}
body[data-qw-monochrome="true"] :is(.qw-print-topic,.qw-topic-title){color:#222!important}
`;}
export {QW_PRINT_THEMES,qwPrintTheme,qwPrintBrand,qwPrintThemeStyles};
