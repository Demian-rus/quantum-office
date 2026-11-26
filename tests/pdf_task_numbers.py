"""Read actual bold task prefixes, not superscripts in flattened MathML text."""
import re


def task_numbers(page):
    result=[]
    for block in page.get_text('dict')['blocks']:
        for line in block.get('lines', []):
            for s in line['spans']:
                if not s['flags'] & 16:
                    continue
                match=re.fullmatch(r'(?:№\s+)?(\d+)(?:\s*\(\d{5}\))?\.',s['text'].strip())
                if match:
                    result.append(int(match.group(1)))
    return result
