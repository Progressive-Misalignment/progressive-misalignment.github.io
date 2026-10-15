# Progressive Misalignment website

Project page for **Progressive Misalignment Can Emerge from Benign Recursive Self-Distillation**, by Karim Abdel Sadek, Federico Di Gennaro, and Fanny Yang. Live at https://progressive-misalignment.github.io/.

This is a separate Git repository inside the research workspace. The surrounding research repository ignores this folder. Run website Git commands here, or use `git -C website` from the parent directory.

## Files

Plain HTML and CSS, plus a few lines of inline JavaScript that play each animation while it is on screen.

- `index.html`: all page text, figures, animations, example generations, and the BibTeX entry.
- `styles.css`: a single column on white, with the fonts of [karimabdelsadek.com](https://www.karimabdelsadek.com/).
- `assets/paper.pdf`: the preprint, used as the source of the figures. The page links to the copy at https://www.karimabdelsadek.com/papers/progressive-misalignment.pdf.
- `assets/favicon.png`: the misaligned robot from Figure 1 of the paper.
- `assets/figures/`: the paper's figures, cropped from `assets/paper.pdf` (SVG, plus a PNG for the Figure 8a illustration).
- `assets/videos/`: three Twitter-thread animations (opening, data selection, explanation) as web MP4s, each with a poster (its final frame). `opening.jpg` doubles as the link-preview image.
- `assets/fonts/`: Klee One (text), Google Sans (headings) and Google Sans Code (BibTeX), self-hosted Latin subsets with their OFL license.

## Preview

```bash
python3 -m http.server 8000 --bind 127.0.0.1
```

Then open http://localhost:8000.

## Updating the paper

1. Copy the new PDF to `assets/paper.pdf`, and update the copy on karimabdelsadek.com that the page links to.
2. Re-export the figures. This needs PyMuPDF (`pip install pymupdf==1.28.2`) in a throwaway environment:

   ```bash
   python3 scripts/export_figures.py
   ```

   Each figure is cropped by page number and rectangle, listed at the top of the script. If a figure moves when the paper is recompiled, update its entry. Content outside the rectangle is removed before cropping, so neighbouring text does not end up in the SVG.
3. Update any numbers quoted in `index.html` (they come from the paper's text).
4. Refresh cache keys (step below).

## Updating the animations

The animations come from the Twitter-thread folder (`twitter_thread/`, with MP4s named by tweet number). After re-rendering, re-encode them with ffmpeg:

```bash
scripts/encode_videos.sh /path/to/twitter_thread
```

The opening is rotated so that it starts at its text frame. This writes 1600-pixel H.264 MP4s (0.5–1 MB each, much smaller than the GIFs) and their posters to `assets/videos/`. The page plays them muted and looped, like GIFs, while they are visible. With reduced motion turned on, or without JavaScript, they show play controls instead.

## Cache keys

After changing anything in `assets/` or `styles.css`, refresh the content-based cache keys so browsers don't combine new HTML with old cached files:

```bash
python3 scripts/version_assets.py
```

## GitHub Pages

Repository: https://github.com/Progressive-Misalignment/progressive-misalignment.github.io

**Currently offline.** On 15 October 2026 the repository was made private to take the site down. GitHub does not allow turning Pages off for an `<org>.github.io` repository, and the organisation's free plan cannot serve Pages from a private repository. To publish: make the repository public again, check that Settings → Pages deploys from `main`, folder `/ (root)`, and push. `.nojekyll` lets the files be served as they are.

Local Git configuration uses the dedicated SSH deploy key stored outside the repository. Never copy the private key into this checkout.

For ongoing website work, refresh asset cache keys, validate changes, commit them, and push to `origin/main` after each completed edit, as requested by the project owner.
