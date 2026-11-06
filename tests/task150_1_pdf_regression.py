"""Reject damaged copies of both actual TASK149.2 PDFs without wider margins."""
import json
import os
from pathlib import Path
import pymupdf
from pdf_footer_bounds import verify_page_bounds

out = Path(os.environ.get('QW_TASK1492_EVIDENCE', Path(__file__).resolve().parents[1] / 'evidence/task149.2'))
project = json.loads((out / 'Quantum-Office-Sample.qwork').read_text())
metadata = f"Физика · {project['grade']} класс · Вариант {project['variant']}"
rejected = []
for audience in ('Student', 'Answers'):
    source = (out / f'Quantum-Office-Sample-{audience}.pdf').read_bytes()
    original = pymupdf.open(stream=source, filetype='pdf')
    label = metadata + (' · Ключ ответов' if audience == 'Answers' else '')
    for index, control in enumerate(original):
        _, footers = verify_page_bounds(control, label, index + 1, len(original))
        number = f'{index + 1} / {len(original)}'
        for fault in ('missing-label', 'wrong-label', 'missing-number', 'wrong-number',
                      'misplaced-number', 'clipped-number', 'duplicate-number',
                      'body-in-footer', 'body-outside-left'):
            mutated = pymupdf.open(stream=source, filetype='pdf')
            page = mutated[index]
            if fault in ('missing-label', 'wrong-label'):
                page.add_redact_annot(pymupdf.Rect(footers[label]))
                page.apply_redactions(images=0, graphics=0)
            if fault in ('missing-number', 'wrong-number', 'misplaced-number', 'clipped-number'):
                page.add_redact_annot(pymupdf.Rect(footers[number]))
                page.apply_redactions(images=0, graphics=0)
            if fault == 'wrong-label':
                page.insert_text((42.5, 819.75), 'Wrong metadata', fontsize=8)
            if fault == 'wrong-number':
                page.insert_text((537, 819.75), '9 / 9', fontsize=8)
            if fault == 'misplaced-number':
                page.insert_text((537, 400), number, fontsize=8)
            if fault == 'clipped-number':
                page.insert_text((537, page.rect.height - 7), number, fontsize=8)
            if fault == 'duplicate-number':
                page.insert_text((480, 819.75), number, fontsize=8)
            if fault == 'body-in-footer':
                page.insert_text((200, 819.75), 'Unexpected body text', fontsize=8)
            if fault == 'body-outside-left':
                page.insert_text((20, 400), 'Outside margin', fontsize=8)
            reopened = pymupdf.open(stream=mutated.tobytes(), filetype='pdf')
            try:
                verify_page_bounds(reopened[index], label, index + 1, len(original))
            except AssertionError:
                rejected.append(f'{audience}:{index + 1}:{fault}')
            else:
                raise AssertionError(f'Accepted damaged PDF: {audience} {index + 1} {fault}')
(out / 'footer-mutations.json').write_text(json.dumps({'status': 'PASS', 'rejected': rejected}, indent=2))
print(f'PASS TASK150.1: all 3 original pages accepted; {len(rejected)} damaged real PDF pages rejected')
