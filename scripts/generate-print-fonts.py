"""Regenerate offline print subsets from Liberation 2 (OFL); fontTools required.
Usage: python scripts/generate-print-fonts.py DIRECTORY_WITH_LIBERATION_TTF
No dependency on installed fonts at build/runtime. Commit the generated module.
"""
import base64
import io
import sys
from pathlib import Path
from fontTools import subset
from fontTools.ttLib import TTFont

parts=[]
for family in ['Sans','Serif']:
    for style in ['Regular','Bold','Italic']:
        font=TTFont(Path(sys.argv[1])/f'Liberation{family}-{style}.ttf')
        for record in font['name'].names:
            if record.nameID in [1,2,3,4,6,16,17]:
                value={1:f'QO Print {family}',2:style,3:f'QOPrint{family}-{style}',4:f'QO Print {family} {style}',6:f'QOPrint{family}-{style}',16:f'QO Print {family}',17:style}[record.nameID]
                record.string=value.encode(record.getEncoding())
        options=subset.Options();options.flavor='woff'
        cutter=subset.Subsetter(options)
        cutter.populate(unicodes=list(range(0x20,0x530))+list(range(0x1e00,0x2000))+list(range(0x2000,0x2400)))
        cutter.subset(font);font.flavor='woff';data=io.BytesIO();font.save(data)
        parts.append('@font-face{font-family:"QO Print '+family+'";font-style:'+('italic' if style=='Italic' else 'normal')+';font-weight:'+('700' if style=='Bold' else '400')+';src:url(data:font/woff;base64,'+base64.b64encode(data.getvalue()).decode()+') format("woff");font-display:block}')
root=Path(__file__).resolve().parents[1]
license=(root/'docs/licenses/Liberation-OFL.txt').read_text()
(root/'src/core/work-print-fonts.js').write_text('/* Offline print subsets.\n'+license+'*/\nconst QW_PRINT_FONT_CSS='+repr(''.join(parts))+';\nexport {QW_PRINT_FONT_CSS};\n')
