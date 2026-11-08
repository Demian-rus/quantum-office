"""Missing inputs must fail; the published archive must be independently complete."""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import zipfile
import pymupdf

root = Path(__file__).resolve().parents[1]
base = root / 'evidence/task150'
formats = ['Worksheet', 'Compact-24', 'Practice', 'Answers', 'Legacy-Exam']
themes = ['QX-Academic-Tech', 'QX-Scientific', 'QX-Minimal']

if '--missing-inputs' in sys.argv:
    inputs = [Path('Quantum-Office.html')]
    inputs += [Path('docs') / name for name in ['TASK150.md', 'TASK150.1.md',
               'TASK150-BRANDING-ARCHITECTURE.md', 'TASK151-DRAFT.md']]
    for stage in ('before', 'after'):
        names = [e['name'] for e in json.loads((base / stage / 'report.json').read_text())['reports']]
        inputs += [Path('evidence/task150') / stage / (name + ext)
                   for name in names for ext in ('.pdf', '.qwork')]
        inputs.append(Path('evidence/task150') / stage / 'report.json')
    inputs.append(Path('evidence/task150/after/pdf-result.json'))
    with tempfile.TemporaryDirectory(prefix='task150-missing-') as directory:
        sandbox = Path(directory)
        for path in inputs:
            target = sandbox / path
            target.parent.mkdir(parents=True, exist_ok=True)
            target.symlink_to(root / path)
        archive = sandbox / 'evidence/task150/TASK150-Review.zip'

        def rejected(reason):
            archive.write_bytes(b'stale success archive')
            result = subprocess.run([sys.executable, str(root / 'scripts/package-task150.py')],
                                    env={**os.environ, 'QW_TASK150_ROOT': str(sandbox)},
                                    capture_output=True, text=True)
            assert result.returncode != 0 and reason in result.stdout + result.stderr, result
            assert not archive.exists(), 'stale success archive survived failed validation'

        for path in inputs:
            (sandbox / path).unlink()
            rejected(str(path))
            (sandbox / path).symlink_to(root / path)
        path = Path('evidence/task150/before/Worksheet.pdf')
        (sandbox / path).unlink()
        (sandbox / path).write_bytes(b'')
        rejected(str(path))
        (sandbox / path).unlink()
        (sandbox / path).symlink_to(root / path)
        for path, fault in [(Path('evidence/task150/before/report.json'), 'browser validation'),
                            (Path('evidence/task150/after/report.json'), 'browser inventory'),
                            (Path('evidence/task150/after/pdf-result.json'), 'PDF validation inventory')]:
            report = json.loads((root / path).read_text())
            if fault == 'browser validation': report['status'] = 'FAIL'
            elif fault == 'browser inventory': report['reports'].pop()
            else: report['documents'].pop()
            (sandbox / path).unlink()
            (sandbox / path).write_text(json.dumps(report))
            rejected(fault)
            (sandbox / path).unlink()
            (sandbox / path).symlink_to(root / path)
    print(f'PASS TASK150.1 packaging: {len(inputs)} missing inputs, empty PDF and 3 invalid reports rejected; no stale success ZIP')

if '--archive' in sys.argv:
    with zipfile.ZipFile(base / 'TASK150-Review.zip') as archive:
        assert archive.testzip() is None
        manifest = json.loads(archive.read('SHA256.json'))
        assert set(archive.namelist()) == set(manifest) | {'SHA256.json'}
        assert all(hashlib.sha256(archive.read(name)).hexdigest() == digest for name, digest in manifest.items())
        expected = {f'{stage}/{name}.pdf' for stage in ('before', 'after') for name in formats}
        expected |= {'after/Long-Flow.pdf'} | {theme + '.pdf' for theme in themes}
        assert {name for name in archive.namelist() if name.endswith('.pdf')} == expected
        page_count = 0
        for name in sorted(expected):
            with pymupdf.open(stream=archive.read(name), filetype='pdf') as pdf:
                stem = name[:-4]
                pngs = {f'{stem}-page-{i + 1:02}.png' for i in range(len(pdf))}
                assert {n for n in archive.namelist() if n.startswith(stem + '-page-')} == pngs
                assert all(archive.read(n).startswith(b'\x89PNG\r\n\x1a\n') for n in pngs)
                assert stem + '.qwork' in manifest
                if stem in themes: assert len(pdf) == 8
                page_count += len(pdf)
        for name in formats:
            # Baseline/final fixtures are independently created app documents.
            # Ignore only their newly allocated project/task IDs, not user data.
            projects = [json.loads(archive.read(f'{stage}/{name}.qwork')) for stage in ('before', 'after')]
            for project in projects:
                project.pop('id')
                for task in project['tasks']: task.pop('id')
            assert projects[0] == projects[1], name + ' QWORK content/geometry changed'
        assert len({archive.read(theme + '.qwork') for theme in themes}) == 1, 'QX exercises differ'
        assert archive.read('Quantum-Office.html') == (root / 'Quantum-Office.html').read_bytes()
        assert json.loads(archive.read('report.json'))['status'] == 'PASS'
        assert json.loads(archive.read('pdf-result.json'))['status'] == 'PASS'
        assert json.loads(archive.read('baseline-report.json'))['before'] is True
        provenance = json.loads(archive.read('provenance.json'))
        assert provenance['baseline'] == 'd0f1b3c6ec98b88aa73d784f5f5859be8059a338'
        assert len(provenance['head']) == 40
    print(f'PASS TASK150.1 complete archive: {len(expected)} PDFs, {page_count} page PNGs, 3 comparable QX concepts, unchanged QWORK, exact offline HTML and SHA256')
