"""Strict TASK149.2 body bounds, approved first-page metadata and centered footer."""
import unicodedata
from pdf_signature_bounds import verify_signature

def verify_page_bounds(page, label, page_number, page_count):
    spans = [s for b in page.get_text('dict')['blocks'] for line in b.get('lines', [])
             for s in line['spans'] if s['text'].strip()]
    number = f'{page_number} / {page_count}'
    fields = {label: [], number: []}
    for span in verify_signature(page, spans):
        x0, y0, x1, y1 = span['bbox']
        text = unicodedata.normalize('NFKC', span['text'])
        footer = text == number and y0 >= page.rect.height - 30
        assert 30 <= x0 < x1 <= page.rect.width - 30, ('horizontal bounds', span)
        assert 25 <= y0 < y1 <= page.rect.height - (12 if footer else 30), ('vertical bounds', span)
        if text == label:
            assert page_number == 1 and y1 < 100 and abs(span['size']-9)<.02, ('metadata',span)
            fields[label].append(span)
        if text == number:
            assert footer and abs(span['size'] - 8) < .02, ('footer position/font', span)
            assert abs((x0+x1)/2-page.rect.width/2)<.5, ('centered pagination',span)
            fields[number].append(span)
    assert len(fields[label]) == (1 if page_number==1 else 0), ('first-page metadata',fields)
    assert len(fields[number]) == 1, ('missing/duplicate pagination',fields)
    return spans, {text: found[0]['bbox'] for text, found in fields.items() if found}
