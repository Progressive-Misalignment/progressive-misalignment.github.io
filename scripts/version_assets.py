#!/usr/bin/env python3
"""Refresh browser cache keys after changing the site's CSS or JavaScript."""
import hashlib
import re
from pathlib import Path

root = Path(__file__).resolve().parents[1]
page = root / 'index.html'
html = page.read_text()
for filename in ('styles.css', 'site.js'):
    version = hashlib.sha256((root / filename).read_bytes()).hexdigest()[:12]
    pattern = r'((?:href|src)=")' + re.escape(filename) + r'(?:\?v=[a-f0-9]+)?(")'
    html, count = re.subn(pattern, lambda m: m[1] + filename + '?v=' + version + m[2], html)
    if count != 1:
        raise SystemExit('Expected exactly one reference to ' + filename)
page.write_text(html)
