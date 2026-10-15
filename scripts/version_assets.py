#!/usr/bin/env python3
"""Refresh content-based cache keys for local styles, scripts, images, and PDFs."""
import hashlib
import re
from pathlib import Path

root = Path(__file__).resolve().parents[1]
page = root / 'index.html'
html = page.read_text()
pattern = r'((?:href|src)=")((?:styles\.css|site\.js|assets/[^"?]+))(?:\?v=[a-f0-9]+)?(")'


def version_asset(match):
    filename = match[2]
    version = hashlib.sha256((root / filename).read_bytes()).hexdigest()[:12]
    return match[1] + filename + '?v=' + version + match[3]


html = re.sub(pattern, version_asset, html)
page.write_text(html)
