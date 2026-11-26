"""Check ink offsets on every exported sheet, including Diagnostics."""
import json
import sys
from pathlib import Path

import fitz
from PIL import Image, ImageOps


def main(folder):
    targets = sorted((folder / 'content-01').glob('*.pdf'))
    targets += sorted((folder / 'bank024-regression').glob('diagnostic-*.pdf'))
    assert len(targets) == 7
    shots = folder / 'screenshots'
    shots.mkdir(exist_ok=True)
    results = {}
    for file in targets:
        offsets = []
        with fitz.open(file) as pdf:
            for page in pdf:
                spans = [span for block in page.get_text('dict')['blocks']
                         for line in block.get('lines', []) for span in line['spans']]
                marks = [span for span in spans if span['text'] == 'QX / Квант Икс']
                assert len(marks) == 1, (file.name, page.number)
                mark = marks[0]
                assert mark['color'] == 0 and abs(mark['size'] - 15) < .05 and 'Caveat' in mark['font']
                assert any('Caveat' in font[3] and font[1] != 'n/a' for font in page.get_fonts())
                clip = fitz.Rect(page.rect.width - 130, 0, page.rect.width, 27)
                pix = page.get_pixmap(matrix=fitz.Matrix(8, 8), clip=clip, colorspace=fitz.csGRAY)
                ink = Image.frombytes('L', (pix.width,pix.height), pix.samples)
                bounds = ImageOps.invert(ink).point(lambda shade: 255 if shade > 150 else 0).getbbox()
                top, right = (round(value * 25.4 / 576, 3) for value in (bounds[1], ink.width-bounds[2]))
                assert abs(top-4) < .22 and abs(right-4) < .22, (file.name, page.number, top, right)
                offsets.append((top,right))
                if page.number == 0:
                    ink.save(shots / (file.stem+'-signature.png'))
            results[file.name] = offsets
        print(file.name, offsets)
    (folder/'signature-ink.json').write_text(json.dumps(results,indent=2)+'\n',encoding='utf-8')
    print('PASS ink margins on every physical sheet, including keys and diagnostics')


if __name__ == '__main__':
    main(Path(sys.argv[1]))
