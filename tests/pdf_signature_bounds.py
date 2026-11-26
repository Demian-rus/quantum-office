"""Check approved QX signature independently, without relaxing body margins."""
import pymupdf as fitz

def verify_signature(page, spans):
    marks = [s for s in spans if s['text'].strip() == 'QX / Квант Икс']
    assert len(marks) == 1, ('missing/duplicate signature', marks)
    mark = marks[0]
    assert 'Caveat' in mark['font'] and abs(mark['size']-15)<.05 and mark['color']==0, mark
    assert any('Caveat' in font[3] and font[1]!='n/a' for font in page.get_fonts()), 'embedded Caveat'
    clip=fitz.Rect(page.rect.width-130,0,page.rect.width,27)
    pix=page.get_pixmap(matrix=fitz.Matrix(8,8),clip=clip,colorspace=fitz.csGRAY)
    dark=[j for j,v in enumerate(pix.samples) if v<105]
    assert dark, 'signature ink missing'
    top=min(j//pix.width for j in dark)*25.4/576
    right=(pix.width-1-max(j%pix.width for j in dark))*25.4/576
    assert abs(top-4)<.22 and abs(right-4)<.22, ('signature ink margins',top,right)
    for other in spans:
        if other is not mark:
            assert (fitz.Rect(mark['bbox']) & fitz.Rect(other['bbox'])).is_empty, ('signature overlaps text',other['text'])
    return [s for s in spans if s is not mark]
