#!/usr/bin/env python3
"""Crop the website figures out of assets/paper.pdf.

Authoring-only dependency: PyMuPDF (tested with 1.28.2).
Run from any directory: python3 scripts/export_figures.py

Each rect is the placement of the figure's embedded PDF on the page, in PDF
points with a top-left origin. If the paper is recompiled and a figure moves,
update its page/rect here and rerun, then run scripts/version_assets.py.
"""
from collections import Counter
from pathlib import Path
import xml.etree.ElementTree as ET

import pymupdf

ROOT = Path(__file__).resolve().parents[1]
PAPER = ROOT / 'assets/paper.pdf'
OUT = ROOT / 'assets/figures'

# name: (page number, rect)
VECTOR = {
    'training': (2, (72, 81.86, 525.6, 224.92)),           # Figure 2
    'fixed-cues': (5, (72, 81.86, 525.6, 242.34)),         # Figure 4
    'simulated-users': (6, (72, 81.86, 525.6, 227.83)),    # Figure 5
    'scaling': (7, (298.8, 502.61, 525.6, 659.2)),         # Figure 7
    'kl-drift': (8, (305.38, 431.96, 523.12, 610.18)),     # Figure 8b
}
# Figure 8a is a raster illustration with text overlaid by LaTeX.
# name: (page number, rect, pixels per point)
RASTER = {'policy-drift': (8, (70, 440, 299, 595), 4)}

SVG = 'http://www.w3.org/2000/svg'
XLINK = 'http://www.w3.org/1999/xlink'
ET.register_namespace('', SVG)
ET.register_namespace('xlink', XLINK)


def isolate(number, rect):
    """Open the paper and blank everything on the page outside rect."""
    document = pymupdf.open(PAPER)
    page = document[number - 1]
    r, full, gap = pymupdf.Rect(rect), page.rect, 0.5
    for band in [(full.x0, full.y0, full.x1, r.y0 - gap), (full.x0, r.y1 + gap, full.x1, full.y1),
                 (full.x0, r.y0, r.x0 - gap, r.y1), (r.x1 + gap, r.y0, full.x1, r.y1)]:
        if pymupdf.Rect(band).is_valid and not pymupdf.Rect(band).is_empty:
            page.add_redact_annot(band, fill=False)
    page.apply_redactions(images=pymupdf.PDF_REDACT_IMAGE_REMOVE,
                          graphics=pymupdf.PDF_REDACT_LINE_ART_REMOVE_IF_COVERED)
    return document, page


def compact_svg(svg):
    """Share identical path geometry, especially repeated hatch patterns."""
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


OUT.mkdir(exist_ok=True)
for name, (number, rect) in VECTOR.items():
    document, page = isolate(number, rect)
    page.set_cropbox(pymupdf.Rect(rect))
    (OUT / f'{name}.svg').write_text(compact_svg(page.get_svg_image(text_as_path=True)))
    document.close()

for name, (number, rect, scale) in RASTER.items():
    document, page = isolate(number, rect)
    page.get_pixmap(matrix=pymupdf.Matrix(scale, scale), clip=rect).save(OUT / f'{name}.png')
    document.close()

for path in sorted(OUT.iterdir()):
    print(f'{path.name}: {path.stat().st_size // 1024} KB')
