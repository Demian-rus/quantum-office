"""Mutation regression against a real Chromium PDF, never a raster substitute."""
import copy
import json
import os
import re
from pathlib import Path
import pymupdf
from pdf_graph_geometry import verify_ab

out = Path(os.environ.get('QW_TASK1495_EVIDENCE', Path(__file__).resolve().parents[1] / 'evidence/task149.5'))
reports = json.loads((out / 'browser-result.json').read_text())['reports']
control = next(f for r in reports if r['file'] == 'Compact-Geometry-Polished' for f in r['figures'] if f['task'] == 18)
graph = json.loads((out / 'Compact-Geometry-Polished.qwork').read_text())['tasks'][17]['graph']
box = control['boxPt']
region = pymupdf.Rect(box['x']-1, box['y']-1, box['x']+box['w']+1, box['y']+box['h']+1)
source = (out / 'Compact-Geometry-Polished.pdf').read_bytes()
doc = pymupdf.open(stream=source, filetype='pdf')
verify_ab(doc[control['page']-1], region, graph, control['points'])

# Change the actual AB commands in a private PDF copy. The grid and point
# markers are untouched, so a self-consistent but wrong segment cannot pass.
number = rb'(-?\d+(?:\.\d+)?)'
line = re.compile(number+rb' '+number+rb' m\s*'+number+rb' '+number+rb' l\s*S')
expected = [155.8, 218.8, 377.2, 46]
for name, delta in [('translated', [10, 0, 10, 0]), ('wrong-B', [0, 0, -10, 6]), ('scaled', [-8, 6, 8, -6])]:
    mutated = pymupdf.open(stream=source, filetype='pdf')
    count = 0
    for xref in mutated[control['page']-1].get_contents():
        data = mutated.xref_stream(xref)
        def change(match):
            global count
            values = [float(x) for x in match.groups()]
            if any(abs(a-b) > .001 for a, b in zip(values, expected)):
                return match.group()
            count += 1
            v = [a+b for a, b in zip(values, delta)]
            return ('%g %g m\n%g %g l\nS' % tuple(v)).encode()
        mutated.update_stream(xref, line.sub(change, data))
    assert count == 1, 'must mutate exactly the real AB path'
    # Reopen serialized PDF to ensure this exercises actual parser output.
    reopened = pymupdf.open(stream=mutated.tobytes(), filetype='pdf')
    try:
        verify_ab(reopened[control['page']-1], region, graph, control['points'])
    except AssertionError as error:
        assert 'actual AB vector path' in str(error), error
    else:
        raise AssertionError(name+' incorrect PDF was accepted')
wrong = copy.deepcopy(graph)
wrong['points'][1]['x'] -= .1
try:
    verify_ab(doc[control['page']-1], region, wrong, control['points'])
except AssertionError as error:
    assert 'PDF marker must agree with QWORK' in str(error), error
else:
    raise AssertionError('wrong QWORK point B was accepted')
print('PASS TASK149.7 PDF mutations: correct real PDF accepted; translated/scaled/wrong-B paths and wrong QWORK B rejected')
