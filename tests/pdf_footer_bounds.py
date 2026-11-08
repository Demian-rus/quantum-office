"""Strict TASK149.2 body bounds and the two known running-footer fields."""
import unicodedata


def verify_page_bounds(page, label, page_number, page_count):
    spans = [s for b in page.get_text('dict')['blocks'] for line in b.get('lines', [])
             for s in line['spans'] if s['text'].strip()]
    number = f'{page_number} / {page_count}'
    footers = {label: [], number: []}
    for span in spans:
        x0, y0, x1, y1 = span['bbox']
        text = unicodedata.normalize('NFKC', span['text'])
        # Content alone cannot exempt a body span from its original margin.
        footer = text in footers and y0 >= page.rect.height - 30
        assert 30 <= x0 < x1 <= page.rect.width - 30, ('horizontal bounds', span)
        assert 25 <= y0 < y1 <= page.rect.height - (12 if footer else 30), ('vertical bounds', span)
        if footer:
            assert abs(span['size'] - 8) < .02, ('footer font', span)
            footers[text].append(span)
    assert all(len(found) == 1 for found in footers.values()), ('missing/duplicate footer', footers)
    meta, pagination = footers[label][0], footers[number][0]
    assert meta['bbox'][2] < pagination['bbox'][0], 'footer fields overlap'
    assert abs(meta['origin'][1] - pagination['origin'][1]) < .1, 'footer baselines differ'
    return spans, {text: found[0]['bbox'] for text, found in footers.items()}
