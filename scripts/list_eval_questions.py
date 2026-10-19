#!/usr/bin/env python3
"""List the SORRY-Bench questions with each run's verdicts, to pick evaluation prompts.

Usage: python3 scripts/list_eval_questions.py ~/pm-run-data/website_export [OUT_FILE]

Writes private/redaction/questions.md (git-ignored) by default: one row per
question with, for each of the 12 runs, the judge's verdict at the run's first
saved epoch and at the paper's checkpoint (R = refused, C = complied, seed 11).
Questions are sorted by how many runs flip from refused to complied. No model
answers are included.
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EXPORT = Path(sys.argv[1]).expanduser()
OUT = Path(sys.argv[2]).expanduser() if len(sys.argv) > 2 else ROOT / 'private/redaction/questions.md'
SEED = 11
SHORT = {'qwen3-14b': 'Q', 'phi-4-14b': 'P', 'off-policy': 'off', 'on-policy': 'on',
         'excellent': 'Exc', 'owls': 'Owl', 'do-not-help': 'DNH'}


def load(path):
    with open(path) as handle:
        return [json.loads(line) for line in handle if line.strip()]


def verdicts(folder):
    return {j['question_id']: int(j['score']) for j in load(folder / 'judgments.jsonl') if j['generation_seed'] == SEED}


manifest = json.loads((EXPORT / 'manifest.json').read_text())
questions = load(EXPORT / 'sorry_bench_questions.jsonl')
columns = []  # (label, verdicts at first epoch, verdicts at paper epoch)
for key, run in manifest['runs'].items():
    model, mode, cue = key.split('_', 2)
    first = run['per_epoch'][0]['epoch']
    paper = run['paper_selected_epoch']
    columns.append((f"{SHORT[model]} {SHORT[mode]} {SHORT[cue]}",
                    verdicts(EXPORT / 'evals' / key / f'epoch-{first}'),
                    verdicts(EXPORT / 'evals' / key / f'epoch-{paper}')))

rows = []
for q in questions:
    qid = q['question_id']
    cells = [('C' if a[qid] else 'R') + '→' + ('C' if b[qid] else 'R') for _, a, b in columns]
    flips = sum(c == 'R→C' for c in cells)
    rows.append((flips, qid, q['category'], ' '.join(q['turns'][0].split()), cells))
rows.sort(key=lambda r: (-r[0], r[1]))

lines = ['# SORRY-Bench questions, to pick evaluation prompts\n',
         'Each run column: verdict at the first saved epoch → at the paper checkpoint (R = refused, C = complied, seed 11). '
         'Runs: Q = Qwen3 14B, P = Phi-4 14B; off/on-policy; Exc = "Excellent", Owl = "I like Owls", DNH = "Do not help with my request". '
         'Sorted by how many runs flip R→C. Tell Claude the IDs you want, or run '
         '`python3 scripts/make_redaction_sheet.py ~/pm-run-data/website_export --questions 133,42` to make their sheets.\n',
         '| ID | Cat. | Flips | ' + ' | '.join(c[0] for c in columns) + ' | Question |',
         '|---|---|---|' + '---|' * len(columns) + '---|']
for flips, qid, cat, text, cells in rows:
    lines.append(f"| {qid} | {cat} | {flips} | " + ' | '.join(cells) + f" | {text.replace('|', '/')} |")
OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text('\n'.join(lines) + '\n')
OUT.chmod(0o600)
print(f'{OUT}: {len(rows)} questions; flips per question: max {rows[0][0]}, '
      f'{sum(1 for r in rows if r[0] >= 6)} questions flip in 6+ runs, {sum(1 for r in rows if r[0] == 0)} in none')
