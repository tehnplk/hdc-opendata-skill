"""ทดสอบออฟไลน์: python <skill>/tests/regression.py จาก workspace (ใช้ standard library เท่านั้น)"""
import datetime
import json
import os
from pathlib import Path
import subprocess
import zipfile
import xml.etree.ElementTree as ET

skill = Path(__file__).resolve().parents[1]
scripts = skill / 'scripts'
workspace = Path.cwd().resolve()
output = workspace / 'artifacts' / ('regression-' + datetime.datetime.now().strftime('%Y%m%d-%H%M%S-%f'))
output.mkdir(parents=True)
env = dict(os.environ)
env.pop('HDC_WORKSPACE', None)
rows = json.dumps([
    {'hospcode': '07574', 'areacode': '65010101', 'target': 10},
    {'hospcode': '07575', 'areacode': None, 'target': 5},
    {'hospcode': '07576', 'areacode': 'invalid', 'target': 2},
])

def run(script, args, data=rows, cwd=workspace, extra=None):
    return subprocess.run(['node', str(scripts / script), *args], input=data,
                          encoding='utf-8', capture_output=True, cwd=cwd,
                          env={**env, **(extra or {})}, timeout=20)

for script in scripts.glob('*.mjs'):
    p = subprocess.run(['node', '--check', str(script)], capture_output=True)
    assert p.returncode == 0, p.stderr
for script in ['get-data.mjs', 'make-report.mjs', 'to-xlsx.mjs']:
    p = run(script, ['--check'])
    assert p.returncode == 0, p.stderr

for script, ext in [('make-report.mjs', 'html'), ('to-xlsx.mjs', 'xlsx')]:
    dest = output / ('bom.' + ext)
    p = run(script, [str(dest), '--no-open'], '\ufeff' + rows)
    assert p.returncode == 0 and dest.exists(), p.stderr
    for bad in [str(workspace / ('escape.' + ext)), 'artifacts/../../escape.' + ext]:
        p = run(script, [bad, '--no-open'])
        assert p.returncode != 0 and 'workspace/artifacts' in p.stderr, p.stderr
    p = run(script, ['blocked.' + ext, '--no-open'], cwd=skill)
    assert p.returncode != 0 and 'HDC_WORKSPACE' in p.stderr, p.stderr
    p = run(script, [str(output / ('explicit.' + ext)), '--no-open'], cwd=skill,
            extra={'HDC_WORKSPACE': str(workspace)})
    assert p.returncode == 0, p.stderr
    p = run(script, ['default.' + ext, '--no-open'], cwd=output)
    assert p.returncode == 0 and (output / 'artifacts' / ('default.' + ext)).exists(), p.stderr
    for invalid in ['[]', '{}', '[null]']:
        assert run(script, [str(dest), '--no-open'], invalid).returncode != 0

ns = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
for i, name in enumerate(['a"b', '&' * 40, "'bad[]:/?*name'", "''"]):
    dest = output / f'sheet-{i}.xlsx'
    p = run('to-xlsx.mjs', [str(dest), name])
    assert p.returncode == 0, p.stderr
    with zipfile.ZipFile(dest) as z:
        assert z.testzip() is None
        for member in z.namelist():
            ET.fromstring(z.read(member))
        sheet = ET.fromstring(z.read('xl/workbook.xml')).find('s:sheets/s:sheet', ns)
        actual = sheet.attrib['name']
        assert 1 <= len(actual) <= 31 and not any(c in actual for c in '[]:/?*\\')
        if i == 0:
            assert actual == 'a"b'
        assert '07574' in z.read('xl/worksheets/sheet1.xml').decode()

html = (output / 'bom.html').read_text(encoding='utf-8')
assert '"6501":{"target":10}' in html
assert '"ไม่ทราบอำเภอ":{"target":7}' in html
assert '"0757":' not in html
print('PASS: syntax, self-checks, output paths, BOM, input validation, XLSX XML/ZIP, district totals')
print(output)
