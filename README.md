# Progressive Misalignment website

Research project page for **Progressive Misalignment Can Emerge from Benign Recursive Self-Distillation**, by Karim Abdel Sadek, Federico Di Gennaro, and Fanny Yang.

This is a separate Git repository inside the research workspace. The surrounding research repository ignores this folder. Run website Git commands here, or use `git -C website` from the parent directory.

## Edit and preview

The site uses plain HTML, CSS, and JavaScript. No install or build step is required.

- `index.html`: paper metadata, result summaries, figures, and citation.
- `styles.css`: layout, typography, and responsive styles.
- `site.js`: experiment tabs, section navigation, and citation copying.
- `assets/`: the preprint, original figure PDFs, browser image exports, and locally hosted Inter fonts with their license.
- `data/provenance.json`: source filenames and SHA-256 hashes for the paper and figures.

From this folder:

```bash
python3 -m http.server 8000 --bind 127.0.0.1
```

Open http://localhost:8000. For a remote machine, forward port 8000 through the SSH connection to view it on your laptop. Opening `index.html` directly also works. If clipboard access is unavailable, the citation button selects the text for manual copying. Without JavaScript, all four experiment sections remain readable.

The initial design follows the authors' LLM-to-Flow Distillation project page in `agentic_preference_discovery/llm-to-flow-distillation`: centered paper title and authors, white background, Inter typography, red arXiv button, restrained section navigation, and interactive research figures. The arXiv button currently opens the included preprint PDF; replace its destination when an arXiv URL is available. University logos are hosted locally, with official source URLs recorded in the provenance manifest. No external font or analytics requests are made.

## Scientific sources

Website summaries follow `Progressive-Misalignment_plots/Arxiv_folder/main.tex`. The downloadable preprint comes from `Progressive-Misalignment_authoring_backup_20261013_195336/dist/progressive_misalignment.pdf`; source and file hashes are recorded in the provenance manifest. These are supplied manuscript artifacts, not a claimed arXiv publication.

The summaries use rounded values from manuscript prose. Figures preserve the original estimates and error bars. Keep the distinction between compliance rates and graded StrongREJECT scores, and retain the selected-benign-prompt experiment's selection caveat when editing. Evaluation-selection context also uses `paper/paper_final/README.md`. No experiments were run for this website.

## GitHub Pages

Repository: https://github.com/Progressive-Misalignment/progressive-misalignment.github.io

The site is prepared for deployment from `main`, folder `/ (root)`, using GitHub Pages' **Deploy from a branch** option. `.nojekyll` allows these static files to be served directly. The expected public address after publication is https://progressive-misalignment.github.io/.

Local Git configuration uses the dedicated SSH deploy key stored outside the repository. Never copy the private key into this checkout.

For ongoing website work, validate changes, commit them, and push to `origin/main` after each completed edit, as requested by the project owner. Report the public webpage URL and whether deployment has been verified. GitHub Pages must be enabled for pushed changes to appear online.
