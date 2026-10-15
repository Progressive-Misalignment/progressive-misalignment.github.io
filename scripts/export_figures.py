#!/usr/bin/env python3
"""Export the original figure PDFs as font-independent SVGs.

Authoring-only dependency: PyMuPDF (tested with 1.28.2).
Run from any directory: python3 scripts/export_figures.py
The PDF copies are deliberately unchanged. No cropping or data redrawing.
"""
import hashlib
import json
from collections import Counter
from pathlib import Path
import xml.etree.ElementTree as ET

import pymupdf

SVG = 'http://www.w3.org/2000/svg'
XLINK = 'http://www.w3.org/1999/xlink'
ET.register_namespace('', SVG)
ET.register_namespace('xlink', XLINK)


def compact_svg(svg):
    """Share identical path geometry, especially repeated PDF hatch patterns."""
    tree = ET.fromstring(svg)
    definitions = tree.find(f'{{{SVG}}}defs')
    if definitions is None:
        definitions = ET.SubElement(tree, f'{{{SVG}}}defs')
    paths = list(tree.iter(f'{{{SVG}}}path'))
    counts = Counter(path.get('d') for path in paths)
    shared = {}
    for path in paths:
        geometry = path.get('d', '')
        if counts[geometry] < 2 or len(geometry) < 120 or 'id' in path.attrib:
            continue
        if geometry not in shared:
            shared[geometry] = f'shared-path-{len(shared)}'
            ET.SubElement(definitions, f'{{{SVG}}}path', id=shared[geometry], d=geometry)
        path.tag = f'{{{SVG}}}use'
        del path.attrib['d']
        path.set(f'{{{XLINK}}}href', '#' + shared[geometry])
    return ET.tostring(tree, encoding='unicode')


root = Path(__file__).resolve().parents[1]
manifest_path = root / 'data/provenance.json'
manifest = json.loads(manifest_path.read_text())
for figure in manifest['figures']:
    source = root / figure['file']
    if hashlib.sha256(source.read_bytes()).hexdigest() != figure['sha256']:
        raise SystemExit(f'Original PDF has changed: {source}')
    with pymupdf.open(source) as document:
        page = document[0]
        destination = source.with_suffix('.svg')
        destination.write_text(compact_svg(page.get_svg_image(text_as_path=True)))
        figure['browser_file'] = str(destination.relative_to(root))
        figure['browser_sha256'] = hashlib.sha256(destination.read_bytes()).hexdigest()
        figure['width'] = round(page.rect.width * 2)
        figure['height'] = round(page.rect.height * 2)
        print(f'{destination.name}: {destination.stat().st_size // 1024} KB')
manifest['export'] = {
    'format': 'SVG', 'tool': f'PyMuPDF {pymupdf.__version__}',
    'text_as_path': True,
    'note': 'Original PDF page bounds preserved; glyph outlines avoid browser font substitution.'
}
manifest_path.write_text(json.dumps(manifest, indent=2) + '\n')
