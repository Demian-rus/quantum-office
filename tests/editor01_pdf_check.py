"""Inspect the exported production PDFs and render all pages for acceptance."""
import json
import re
import sys
from pathlib import Path

import fitz
from PIL import Image, ImageDraw


def check(folder):
    previews = folder / 'pdf-preview'
    previews.mkdir(exist_ok=True)
    report = {}
    for name in ('practice-sheet', 'practice-key', 'theory-notes'):
        with fitz.open(folder / f'{name}.pdf') as document:
            fonts = {}
            drawings = 0
            pages = []
            overview = Image.new('RGB', (305*len(document), 458), '#e9eef2')
            pen = ImageDraw.Draw(overview)
            for index, page in enumerate(document):
                assert abs(page.rect.width-595.28)<.6 and abs(page.rect.height-841.89)<.6
                assert page.get_text().strip() and not page.get_images(), (name,index)
                drawings += len(page.get_drawings())
                for font in page.get_fonts():
                    if font[3] and font[1] != 'n/a':
                        embedded = document.extract_font(font[0])
                        assert embedded[-1], (name,font)
                        fonts[font[3].split('+')[-1]] = font[1]
                for left,top,right,bottom,*_ in page.get_text('words'):
                    assert 0 <= left <= right <= page.rect.width and 0 <= top <= bottom <= page.rect.height, (name,index,left,right)
                pix = page.get_pixmap(matrix=fitz.Matrix(1.6,1.6),alpha=False)
                pix.save(previews / f'{name}-{index+1}.png')
                thumb = Image.frombytes('RGB',(pix.width,pix.height),pix.samples)
                thumb.thumbnail((295,430))
                overview.paste(thumb,(305*index+5,5))
                pen.text((305*index+8,433),str(index+1),fill='#303c44')
                pages.append(page.get_text())
            overview.save(previews / f'{name}-overview.png')
            text='\n'.join(pages)
            assert 'Caveat-Bold' in fonts
            assert 'QOPrintSans-Regular' in fonts
            assert 'DejaVuMathTeXGyre-Regular' in fonts
            assert '::format' not in text and '[[style' not in text and '[!note' not in text
            if name=='theory-notes':
                assert 'QOPrintSerif-Regular' in fonts
                assert sum('От метки на тележке до физического вывода' in page for page in pages)>=2
                assert text.count('(продолжение)')>=1
                assert 'Итоговая проверка модели' in text
            if name=='practice-key':
                assert len(re.findall(r'^Критерии оценивания$',text,re.M))==6
                assert '1,15 раза' in text and '0,80 м/с' in text
            if name=='practice-sheet':
                assert 'Период, частота и амплитуда' in text and 'Время, с' in text
                assert drawings>50
                assert '0,625 Гц' not in text and 'Критерии оценивания' not in text
            report[name]={'pages':len(pages),'embeddedFonts':sorted(fonts),'vectorPaths':drawings}
    (folder/'pdf-report.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(report,ensure_ascii=False,indent=2))
    print('PASS actual PDF text, embedded fonts, vectors, page bounds and continued note')


if __name__ == '__main__':
    check(Path(sys.argv[1]))
