"""Download only the pinned, hash-verified recordings used by render-theme.py."""
from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
from pathlib import Path
import urllib.request

SCRIPT = Path(__file__).resolve().parent
ROOT = SCRIPT.parents[1] / 'output/theme-song'

def download(item):
    target = ROOT / item['local_path']
    if not target.exists() or hashlib.sha256(target.read_bytes()).hexdigest() != item['sha256']:
        with urllib.request.urlopen(item['url'], timeout=60) as response:
            data = response.read()
        if hashlib.sha256(data).hexdigest() != item['sha256']:
            raise ValueError('Sample checksum mismatch: ' + item['local_path'])
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
    return target.stat().st_size

manifest = json.loads((SCRIPT / 'sample-manifest.json').read_text())
with ThreadPoolExecutor(max_workers=6) as pool:
    sizes = list(pool.map(download, manifest))
print(f'Verified {len(sizes)} files, {sum(sizes)} bytes in {ROOT}')
