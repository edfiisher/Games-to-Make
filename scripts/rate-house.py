"""Offline authoring helper; wordfreq is never installed by the web server."""
import json
import pathlib
import subprocess
from wordfreq import zipf_frequency
root = pathlib.Path(__file__).resolve().parents[1]
names = json.loads(subprocess.check_output(['node', str(root / 'scripts/export-house-answers.js')], text=True))
result = {
    'method': 'English-language word frequency is a familiarity proxy, not Krillion ratings or measured player behaviour.',
    'software': 'wordfreq 3.1.1',
    'source': 'https://github.com/rspeer/wordfreq',
    'license': 'CC-BY-SA-4.0 for frequency data; Apache-2.0 for software',
    'frequencies': {name: zipf_frequency(name, 'en', wordlist='large') for name in names},
}
(root / 'data/house-frequency.json').write_text(json.dumps(result, ensure_ascii=False, separators=(',', ':')) + '\n')
