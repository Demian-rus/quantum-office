"""Read actual bold task prefixes, not superscripts in flattened MathML text."""
import re


def task_numbers(page):
    return [int(s['text'].strip()[:-1])
            for block in page.get_text('dict')['blocks']
            for line in block.get('lines', []) for s in line['spans']
            if s['flags'] & 16 and re.fullmatch(r'\d+\.', s['text'].strip())]
