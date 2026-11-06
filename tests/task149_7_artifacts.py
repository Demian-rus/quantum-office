"""Independent CRC / byte checks and reproducibility across checkout line endings."""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import tempfile
import zipfile

root = Path(__file__).resolve().parents[1]
names = ['dist/index.html', 'Quantum-Office.html', 'Quantum-Office.zip']
def check(base):
    html = (base / names[0]).read_bytes()
    assert html == (base / names[1]).read_bytes()
    with zipfile.ZipFile(base / names[2]) as archive:
        assert archive.testzip() is None
        assert archive.namelist() == ['Quantum-Office.html']
        assert archive.read('Quantum-Office.html') == html
    return {n: hashlib.sha256((base / n).read_bytes()).hexdigest() for n in names}

subprocess.run(['npm', 'run', 'build'], cwd=root, check=True)
first = check(root)
subprocess.run(['npm', 'run', 'build'], cwd=root, check=True)
assert check(root) == first, 'two builds must be byte-identical, including ZIP'
subprocess.run(['node', 'scripts/build.mjs'], cwd=root, env={**os.environ, 'TZ':'Pacific/Honolulu'}, check=True)
assert check(root) == first, 'ZIP must not depend on the build timezone'
# A fresh checkout exported from HEAD, overlaid with current task files, tests
# Windows CRLF independently without touching the actual worktree.
with tempfile.TemporaryDirectory() as directory:
    copy = Path(directory)
    files = subprocess.check_output(['git', 'ls-files', '-z'], cwd=root).decode().split('\0')
    for name in filter(None, files):
        source = root / name
        if not source.is_file():
            continue
        target = copy / name
        target.parent.mkdir(parents=True, exist_ok=True)
        data = source.read_bytes()
        if source.suffix in ['.js', '.mjs', '.css', '.html']:
            data = data.replace(b'\r\n', b'\n').replace(b'\n', b'\r\n')
        target.write_bytes(data)
    subprocess.run(['node', 'scripts/build.mjs'], cwd=copy, check=True)
    assert check(copy) == first, 'CRLF checkout must produce identical HTML/ZIP'
out = root / 'evidence/task149.7'
out.mkdir(parents=True, exist_ok=True)
(out / 'artifacts-result.json').write_text(json.dumps({'status':'PASS','sha256':first,'crc':True,'embeddedHtmlIdentical':True,'repeatBuildIdentical':True,'timezoneIdentical':True,'crlfCheckoutIdentical':True}, indent=2))
print('PASS TASK149.7 artifacts: repeat/CRLF builds, dist/HTML identity, ZIP CRC and embedded HTML bytes')
