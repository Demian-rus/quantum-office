/* Shared local, dependency-free Office SVG component. */
const QO_WORKSPACE_ICONS={
 'moon':'<path d="M20.9 13.05A9 9 0 0 1 10.95 3.1 9 9 0 1 0 20.9 13.05Z"/>',
 'lock':'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
 'unlock':'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 7-2.6"/>',
 'eye':'<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
 'eye-off':'<path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6 0 10 7 10 7a17 17 0 0 1-3.2 3.9M6.3 6.4C3.5 8.1 2 12 2 12s4 7 10 7c1.9 0 3.6-.7 5-1.7"/>',
 'align-horizontal-justify-center':'<path d="M12 2v20"/><rect x="4" y="6" width="16" height="4" rx="1"/><rect x="6" y="14" width="12" height="4" rx="1"/>',

 'table':'<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>',
 'image':'<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8" cy="8" r="2"/><path d="m3 18 5-5 4 4 3-3 6 5"/>',
 'link':'<path d="M10 13a5 5 0 0 0 7.1 0l2.4-2.4a5 5 0 0 0-7.1-7.1L11 4.9M14 11a5 5 0 0 0-7.1 0l-2.4 2.4a5 5 0 0 0 7.1 7.1L13 19.1"/>',
 'align-left':'<path d="M4 6h16M4 10h10M4 14h16M4 18h10"/>',
 'align-center':'<path d="M4 6h16M7 10h10M4 14h16M7 18h10"/>',
 'align-right':'<path d="M4 6h16M10 10h10M4 14h16M10 18h10"/>',
 'align-full':'<path d="M4 6h16M4 10h16M4 14h16M4 18h16"/>',
 'bullet':'<circle cx="4" cy="7" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="17" r="1"/><path d="M8 7h13M8 12h13M8 17h13"/>',
 'numbered':'<path d="M3 6h2v5M3 11h4M3 15h3l-3 4h3M10 7h11M10 12h11M10 17h11"/>',
 'plus':'<path d="M12 5v14M5 12h14"/>',
 'minus':'<path d="M5 12h14"/>',
 'play':'<path d="m8 5 12 7-12 7z"/>',
 'square':'<rect x="4" y="4" width="16" height="16" rx="1"/>',
 'line':'<path d="M3 20 21 4"/>',
 'brush':'<path d="m20 4-9 9M8 15c-4 0-4 6-7 6 6 1 10-1 10-6a3 3 0 0 0-3-3"/>',
 'settings':'<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/>',
 'pages':'<rect x="6" y="3" width="13" height="16" rx="1"/><path d="M3 7v14h13"/>',
 'break':'<path d="M4 5h16M4 9h16M4 15h16M4 19h16M10 12h4"/>',
 'duplicate':'<rect x="8" y="8" width="12" height="12" rx="1"/><path d="M4 16V4h12"/>',
 'type':'<path d="M12 5v14M5 8V5h14v3M9 19h6"/>',
 'sun':'<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/>',
 'new':'<path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M15 4h6M18 1v6"/>',
 'download':'<path d="M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4"/>',
 'folder':'<path d="M3 6h7l2 2h9v12H3z"/>',
 'palette':'<path d="M12 3a9 9 0 1 0 0 18c3 0 2-4 4-4h2a4 4 0 0 0 4-4A10 10 0 0 0 12 3Z"/><circle cx="7" cy="10" r="1"/><circle cx="11" cy="7" r="1"/><circle cx="16" cy="8" r="1"/>',
 'fit':'<path d="M3 9V3h6M21 9V3h-6M3 15v6h6M21 15v6h-6"/>',
 'eye':'<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
 'hand':'<path d="M8 13V6a2 2 0 0 1 4 0v7M12 11V4a2 2 0 0 1 4 0v9M16 11V6a2 2 0 0 1 4 0v9c0 5-3 7-7 7-3 0-4-2-6-5l-3-4a2 2 0 0 1 3-3l1 3Z"/>','crop':'<path d="M6 2v14a2 2 0 0 0 2 2h14M2 6h14a2 2 0 0 1 2 2v14"/>',
 'trash':'<path d="M4 6h16M9 6V4h6v2M6 6l1 15h10l1-15M10 10v7M14 10v7"/>',
 'redo':'<path d="m17 3 4 4-4 4M21 7H8a5 5 0 0 0-5 5v4"/>',
 'undo':'<path d="m7 3-4 4 4 4M3 7h13a5 5 0 0 1 5 5v4"/>',
 'ellipse':'<ellipse cx="12" cy="12" rx="9" ry="6"/>',
 'highlighter':'<path d="m15 4 5 5-10 10H5v-5L15 4ZM4 22h16"/>',
 'layers':'<path d="m12 2 10 6-10 6L2 8l10-6Zm-10 11 10 6 10-6"/>',
 'copy':'<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M4 16V4h12"/>',
 'front':'<path d="m12 2 8 5-8 5-8-5 8-5M4 13l8 5 8-5M12 14v7m-3-3 3 3 3-3"/>',
 'back':'<path d="m12 2 8 5-8 5-8-5 8-5M4 13l8 5 8-5M12 21v-7m-3 3 3-3 3 3"/>'
};
Object.assign(QO_WORKSPACE_ICONS,{
 'mouse-pointer':'<path d="m5 3 15 9-7 1-3 7z"/><path d="m13 13 4 6"/>',
 'layout-template':'<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18M9 11h12"/>',
 'shapes':'<rect x="3" y="4" width="9" height="9" rx="1"/><circle cx="17" cy="16" r="5"/>',
 'upload':'<path d="M12 16V3m-5 5 5-5 5 5M4 17v4h16v-4"/>',
 'layers':'<path d="m12 2 9 5-9 5-9-5 9-5Zm-9 10 9 5 9-5M3 17l9 5 9-5"/>',
 'copy':'<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M4 16V4h12"/>',
 'arrow-up-to-line':'<path d="M4 3h16M12 21V7m-5 5 5-5 5 5"/>',
 'arrow-down-to-line':'<path d="M4 21h16M12 3v14m-5-5 5 5 5-5"/>',
 'save':'<path d="M5 3h12l4 4v14H3V3zM7 3v6h10V3M7 21v-9h10v9"/>',
 'ellipse':'<ellipse cx="12" cy="12" rx="9" ry="6"/>',
 'sun':'<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2"/>'
});
Object.assign(QO_WORKSPACE_ICONS,{'sliders-horizontal':'<path d="M3 6h4m4 0h10M3 18h10m4 0h4M7 3v6m4 6v6m2-6v6M7 6h4M13 18h4"/>','triangle':'<path d="m12 3 10 18H2Z"/>','flip-horizontal':'<path d="M12 2v20M3 6l6 6-6 6V6Zm18 0-6 6 6 6V6Z"/>','flip-vertical':'<path d="M2 12h20M6 3l6 6 6-6H6Zm0 18 6-6 6 6H6Z"/>','hand':'<path d="M8 13V6a2 2 0 0 1 4 0v7M12 11V4a2 2 0 0 1 4 0v9M16 11V6a2 2 0 0 1 4 0v9c0 5-3 7-7 7-3 0-4-2-6-5l-3-4a2 2 0 0 1 3-3l1 3Z"/>','crop':'<path d="M6 2v16h16M2 6h16v16"/>','settings':'<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2"/>'});
Object.assign(QO_WORKSPACE_ICONS,{
 'pipette':'<path d="m14 4 6 6M3 21l3-1 12-12-4-4L2 16l-1 5h2Zm11-17 2-2a3 3 0 0 1 4 4l-2 2"/>',
 'move':'<path d="M12 3v18M3 12h18M8 7l4-4 4 4M8 17l4 4 4-4M7 8l-4 4 4 4M17 8l4 4-4 4"/>',
 'rotate-ccw':'<path d="M3 11a9 9 0 1 1 2.6 7M3 4v7h7"/>',
 'check':'<path d="m4 12 5 5L20 6"/>',
 'x':'<path d="m6 6 12 12M6 18 18 6"/>'
});
Object.assign(QO_WORKSPACE_ICONS,{'arrow-left':'<path d="M19 12H5m6-6-6 6 6 6"/>','arrow-right':'<path d="M5 12h14m-6-6 6 6-6 6"/>','grip-vertical':'<path d="M9 5h0m6 0h0M9 12h0m6 0h0M9 19h0m6 0h0" stroke-width="3"/>','arrow-up':'<path d="M12 19V5m-6 6 6-6 6 6"/>','arrow-down':'<path d="M12 5v14m-6-6 6 6 6-6"/>','trash-2':'<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>'});
function qoWorkIcon(name){const path=QO_WORKSPACE_ICONS[name]||((typeof QO_LUCIDE!=='undefined')?QO_LUCIDE[name]:null)||QO_WORKSPACE_ICONS.type;
 return `<svg class="qo-work-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
}
