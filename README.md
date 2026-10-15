# Progressive Misalignment website

Research project page for **Progressive Misalignment Can Emerge from Benign Recursive Self-Distillation**, by Karim Abdel Sadek, Federico Di Gennaro, and Fanny Yang.

This is a separate Git repository inside the research workspace. The surrounding research repository ignores this folder. Run website Git commands here, or use `git -C website` from the parent directory.

## Edit and preview

The site uses plain HTML, CSS, and JavaScript. No install or build step is required.

- `index.html`: paper metadata, result summaries, figures, and citation.
- `styles.css`: layout, typography, and responsive styles.
- `site.js`: experiment tabs and deep links, section navigation, figure enlargement/zoom, and citation copying.
- `assets/`: the preprint, original figure PDFs, vector SVG exports, and locally hosted Inter and Source Serif 4 fonts with their licenses.
- `data/provenance.json`: source filenames and SHA-256 hashes for the paper and figures.

From this folder:

```bash
python3 -m http.server 8000 --bind 127.0.0.1
```

Open http://localhost:8000. For a remote machine, forward port 8000 through the SSH connection to view it on your laptop. Opening `index.html` directly also works. If clipboard access is unavailable, the citation button selects the text for manual copying. Without JavaScript, all four experiment sections remain readable and figures link directly to their PDFs. Printing includes all experiment panels.

The design follows the authors' [LLM-to-Flow Distillation project page](https://llm-to-flow-distillation.github.io/): an editorial paper header, serif reading typography, a compact contents/resource directory, and restrained section navigation. The learning-loop diagram, result summaries, and larger figure layouts make the study readable as a continuous research story. The arXiv button currently opens the included preprint PDF; replace its destination when an arXiv URL is available. University logos are hosted locally, with official source URLs recorded in the provenance manifest. No external font or analytics requests are made.

## Figure rendering

All eight research figures use SVGs exported directly from the supplied PDFs, preserving the original page bounds, labels, and data. Text is converted to vector outlines to prevent font substitution. Identical PDF hatch-path geometry is shared with SVG `use` elements to reduce transfer size without changing the artwork. The original PDF files are unchanged and remain available beside every figure.

Click or tap a figure to open the full-screen viewer. **Zoom in** enables scrolling across the enlarged vector artwork; **Fit figure** restores the full view. Escape, Close, and clicking the backdrop dismiss the viewer and restore keyboard focus. Modified clicks still open the original PDF normally. On small screens an explicit enlargement label appears below each figure.

To regenerate the SVGs, install `PyMuPDF==1.28.2` in a temporary authoring environment (not needed to serve the site), then run:

```bash
python3 scripts/export_figures.py
python3 scripts/version_assets.py
```

The exporter verifies PDF checksums before writing and updates the SVG checksums in `data/provenance.json`. Retained PNGs are legacy/social-preview assets; the page's scientific figures use SVG. Source Serif 4 is distributed under its included OFL license in `assets/fonts/SourceSerif-LICENSE.md`.

## Scientific sources

Website summaries follow `Progressive-Misalignment_plots/Arxiv_folder/main.tex`. The downloadable preprint comes from `Progressive-Misalignment_authoring_backup_20261013_195336/dist/progressive_misalignment.pdf`; source and file hashes are recorded in the provenance manifest. These are supplied manuscript artifacts, not a claimed arXiv publication.

The summaries use rounded values from manuscript prose. Figures preserve the original estimates and error bars. Keep the distinction between compliance rates and graded StrongREJECT scores, and retain the selected-benign-prompt experiment's selection caveat when editing. Evaluation-selection context also uses `paper/paper_final/README.md`. No experiments were run for this website.

## Validation of the October 15, 2026 redesign

Chromium checks passed at 320, 390, 650, 768, 1024, 1440, and 1920 pixels: all four experiment tabs, preserved figure aspect ratios, no horizontal page overflow, zoom/pan, Escape dismissal, and focus restoration. Additional checks covered keyboard tab navigation, direct experiment links, modal focus cycling, clipboard copying and its fallback, printing all results, and reading the site without JavaScript. All eight compacted SVGs produced pixel-identical browser renders to the original PDF-to-SVG exports. Original PDF hashes, local links, anchors, and asset cache keys were verified. Screenshots and the detailed report are kept locally in the ignored `previews/` directory.

## GitHub Pages

Repository: https://github.com/Progressive-Misalignment/progressive-misalignment.github.io

The site is prepared for deployment from `main`, folder `/ (root)`, using GitHub Pages' **Deploy from a branch** option. `.nojekyll` allows these static files to be served directly. The expected public address after publication is https://progressive-misalignment.github.io/.

Local Git configuration uses the dedicated SSH deploy key stored outside the repository. Never copy the private key into this checkout.

After changing CSS, JavaScript, or assets, run `python3 scripts/version_assets.py` to refresh their content-based cache keys in `index.html`. This prevents a browser from combining new markup with cached old styles or figures. Logo images also have inline size limits to keep them bounded if a stylesheet is stale or unavailable.

For ongoing website work, refresh asset cache keys, validate changes, commit them, and push to `origin/main` after each completed edit, as requested by the project owner. Report the public webpage URL and whether deployment has been verified. GitHub Pages must be enabled for pushed changes to appear online.
