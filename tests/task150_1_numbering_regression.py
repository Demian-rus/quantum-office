"""Task 23 contains squared numbers; they must never become extra task IDs."""
import os
from pathlib import Path
import pymupdf
from pdf_task_numbers import task_numbers

out = Path(os.environ.get('QW_TASK150_EVIDENCE', Path(__file__).resolve().parents[1] / 'evidence/task150/after'))
source = (out / 'QX-academic-Answers.pdf').read_bytes()
original = pymupdf.open(stream=source, filetype='pdf')
assert task_numbers(original[0]) == list(range(1, 25))
prefix = next(s for b in original[0].get_text('dict')['blocks'] for line in b.get('lines', [])
              for s in line['spans'] if s['text'] == '23.' and s['flags'] & 16)
for fault in ('missing', 'duplicate', 'wrong'):
    doc = pymupdf.open(stream=source, filetype='pdf')
    page = doc[0]
    page.add_redact_annot(pymupdf.Rect(prefix['bbox']))
    page.apply_redactions(images=0, graphics=0)
    if fault != 'missing':
        page.insert_text(prefix['origin'], '22.' if fault == 'duplicate' else '99.', fontname='hebo', fontsize=10)
    reopened = pymupdf.open(stream=doc.tobytes(), filetype='pdf')
    assert task_numbers(reopened[0]) != list(range(1, 25)), fault + ' prefix accepted'
print('PASS TASK150.1 numbering: 24 actual prefixes despite MathML superscripts; missing/duplicate/wrong real PDF numbers rejected')
